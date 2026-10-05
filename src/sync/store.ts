/**
 * Хранилище бюджета одного пользователя.
 *
 * Состояние = последняя версия с сервера (base) + действия, которые ещё не сохранены (pending).
 * Оба лежат в localStorage под id пользователя, поэтому трата сохраняется на устройстве
 * сразу, а на сервер уходит, когда есть сеть. Если сервер успел измениться с другого
 * устройства, несохранённые действия переигрываются поверх свежей версии.
 */
import { todayYmd } from '../domain/dates';
import { freshState } from '../domain/initial';
import { reduceAll, type Action } from '../domain/reducer';
import type { State } from '../domain/types';
import { InvalidState, parseState } from '../domain/validate';
import { NetworkError, type Backend } from './backend';

export type SyncStatus = 'synced' | 'saving' | 'offline' | 'error';

export interface StoreSnapshot {
  phase: 'loading' | 'ready' | 'setup' | 'error';
  state: State | null;
  pending: number;
  sync: SyncStatus;
  error?: string;
}

interface Base {
  state: State | null;
  /** 0 — строки на сервере ещё нет */
  rev: number;
}

const PREFIX = 'sarfa:v1:';
const baseKey = (uid: string) => `${PREFIX}${uid}:base`;
const pendingKey = (uid: string) => `${PREFIX}${uid}:pending`;

/** Удалить с устройства всё, что относится к пользователю (данные, очередь, настройки интерфейса). */
export function clearUserCache(uid: string) {
  try {
    const prefix = `${PREFIX}${uid}:`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* хранилище недоступно — нечего чистить */
  }
}

function readJson<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export class BudgetStore {
  private base: Base | null = null;
  private pending: Action[] = [];
  private snap: StoreSnapshot = { phase: 'loading', state: null, pending: 0, sync: 'synced' };
  private listeners = new Set<() => void>();
  /** Все сетевые операции идут строго по одной. */
  private busy: Promise<void> | null = null;
  private rerun = false;
  private needPull = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private retryDelay = 2000;
  private disposed = false;
  private cleanup: (() => void)[] = [];

  constructor(
    private backend: Backend,
    readonly uid: string,
  ) {}

  // ---------- подписка для React ----------

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  getSnapshot = () => this.snap;

  private emit(patch: Partial<StoreSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  private current(): State | null {
    if (this.base?.state) return reduceAll(this.base.state, this.pending);
    if (this.pending.length) return reduceAll(freshState(todayYmd()), this.pending);
    return null;
  }

  private publish(extra: Partial<StoreSnapshot> = {}) {
    const state = this.current();
    const phase = state ? 'ready' : this.base ? 'setup' : this.snap.phase;
    this.emit({ state, phase, pending: this.pending.length, ...extra });
  }

  private persist() {
    try {
      localStorage.setItem(baseKey(this.uid), JSON.stringify(this.base));
      localStorage.setItem(pendingKey(this.uid), JSON.stringify(this.pending));
    } catch {
      this.emit({ sync: 'error', error: 'Не удалось сохранить данные на устройстве' });
    }
  }

  // ---------- жизненный цикл ----------

  async start() {
    const cachedBase = readJson<Base>(baseKey(this.uid));
    const cachedPending = readJson<Action[]>(pendingKey(this.uid)) ?? [];
    this.base = cachedBase;
    this.pending = cachedPending;
    if (cachedBase || cachedPending.length) this.publish();

    const onVisible = () => {
      if (document.visibilityState === 'visible') this.sync();
    };
    const onOnline = () => this.sync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') this.sync();
    }, 60_000);
    this.cleanup.push(
      () => document.removeEventListener('visibilitychange', onVisible),
      () => window.removeEventListener('online', onOnline),
      () => clearInterval(interval),
    );

    this.sync();
    await this.busy;
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.cleanup.forEach((f) => f());
    this.listeners.clear();
  }

  // ---------- изменения ----------

  dispatch = (action: Action) => {
    this.pending = [...this.pending, action];
    this.persist();
    this.publish({ sync: 'saving' });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.kick(), 300);
  };

  /** Первое заполнение для нового пользователя. */
  setup(state: State) {
    this.dispatch({ type: 'replace', state });
  }

  // ---------- сеть ----------

  /** Забрать свежую версию с сервера и отправить несохранённое. */
  sync = () => {
    this.needPull = true;
    this.kick();
  };

  private kick() {
    if (this.disposed) return;
    if (this.busy) {
      this.rerun = true;
      return;
    }
    this.busy = (async () => {
      try {
        do {
          this.rerun = false;
          if (this.needPull || !this.base) {
            this.needPull = false;
            await this.pull();
          }
          await this.push();
        } while (this.rerun && !this.disposed);
        this.retryDelay = 2000;
        if (!this.disposed) this.publish({ sync: this.pending.length ? 'saving' : 'synced', error: undefined });
      } catch (e) {
        this.onError(e);
      } finally {
        this.busy = null;
      }
    })();
  }

  private async pull() {
    const remote = await this.backend.fetchBudget(this.uid);
    if (this.disposed) return;
    if (!remote) {
      if (!this.base || this.base.rev !== 0) {
        // На сервере пусто: новый пользователь.
        this.base = { state: null, rev: 0 };
        this.persist();
      }
      this.publish();
      return;
    }
    if (!this.base || remote.rev !== this.base.rev) {
      let state: State;
      try {
        state = parseState(remote.state);
      } catch (e) {
        const msg = e instanceof InvalidState ? e.message : String(e);
        throw new Error(`Данные на сервере не прошли проверку: ${msg}`);
      }
      this.base = { state, rev: remote.rev };
      this.persist();
    }
    this.publish();
  }

  private async push() {
    let conflicts = 0;
    while (this.pending.length && !this.disposed) {
      if (!this.base) {
        await this.pull();
        if (!this.base) return;
      }
      const count = this.pending.length;
      const sentRev = this.base.rev;
      const next = this.current();
      if (!next) return;
      const res =
        sentRev === 0
          ? await this.backend.insertBudget(this.uid, next)
          : await this.backend.updateBudget(this.uid, next, sentRev);
      if (this.disposed) return;
      if (res === 'ok') {
        this.base = { state: next, rev: sentRev + 1 };
        this.pending = this.pending.slice(count);
        this.persist();
        this.publish();
      } else {
        conflicts += 1;
        if (conflicts > 5) throw new Error('Не удалось сохранить: данные одновременно меняются с другого устройства');
        await this.pull();
      }
    }
  }

  private onError(e: unknown) {
    if (this.disposed) return;
    const offline = e instanceof NetworkError || (typeof navigator !== 'undefined' && navigator.onLine === false);
    const message = e instanceof Error ? e.message : String(e);
    if (!this.snap.state && !this.base) {
      this.emit({
        phase: 'error',
        sync: offline ? 'offline' : 'error',
        error: offline ? 'Нет связи с сервером. Данные загрузятся, когда появится интернет.' : message,
      });
    } else {
      this.emit({ sync: offline ? 'offline' : 'error', error: offline ? undefined : message });
    }
    // Повторяем с нарастающей паузой, пока не получится.
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.sync(), this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 60_000);
  }
}
