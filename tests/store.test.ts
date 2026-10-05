import { beforeEach, describe, expect, it } from 'vitest';
import { NetworkError, type Backend, type RemoteBudget } from '../src/sync/backend';
import { BudgetStore, clearUserCache } from '../src/sync/store';
import type { State, Tx } from '../src/domain/types';
import { buildSeed } from './fixtures/seed';

// --- окружение браузера для узла ---
class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  get length() {
    return this.m.size;
  }
}
const g = globalThis as Record<string, unknown>;
const noop = () => {};
g.document = { visibilityState: 'visible', addEventListener: noop, removeEventListener: noop };
g.window = { addEventListener: noop, removeEventListener: noop };

/** Сервер в памяти с той же логикой версий, что и в Supabase. */
function fakeServer() {
  const rows = new Map<string, RemoteBudget>();
  let offline = false;
  const check = () => {
    if (offline) throw new NetworkError('offline');
  };
  const backend = {
    configured: true,
    async fetchBudget(uid: string) {
      check();
      const r = rows.get(uid);
      return r ? JSON.parse(JSON.stringify(r)) : null;
    },
    async insertBudget(uid: string, state: unknown) {
      check();
      if (rows.has(uid)) return 'conflict' as const;
      rows.set(uid, { state: JSON.parse(JSON.stringify(state)), rev: 1 });
      return 'ok' as const;
    },
    async updateBudget(uid: string, state: unknown, baseRev: number) {
      check();
      const r = rows.get(uid);
      if (!r || r.rev !== baseRev) return 'conflict' as const;
      rows.set(uid, { state: JSON.parse(JSON.stringify(state)), rev: baseRev + 1 });
      return 'ok' as const;
    },
  } as unknown as Backend;
  return {
    backend,
    rows,
    setOffline(v: boolean) {
      offline = v;
    },
  };
}

const settle = () => new Promise((r) => setTimeout(r, 450));
const tx = (id: string, amount: number): Tx => ({
  id, date: '2026-10-02', amount, categoryId: 'food', note: '', payment: 'cash', fromMain: 0, createdAt: '2026-10-02T09:00:00Z',
});

beforeEach(() => {
  g.localStorage = new MemStorage();
});

describe('Хранилище с синхронизацией', () => {
  it('новый пользователь видит анкету, после заполнения данные уходят на сервер', async () => {
    const srv = fakeServer();
    const store = new BudgetStore(srv.backend, 'u1');
    await store.start();
    expect(store.getSnapshot().phase).toBe('setup');
    store.setup(buildSeed());
    await settle();
    expect(store.getSnapshot()).toMatchObject({ phase: 'ready', pending: 0, sync: 'synced' });
    expect(srv.rows.get('u1')?.rev).toBe(1);
    store.dispose();
  });

  it('трата без сети сохраняется на устройстве и переживает перезапуск (приёмка 1)', async () => {
    const srv = fakeServer();
    const a = new BudgetStore(srv.backend, 'u1');
    await a.start();
    a.setup(buildSeed());
    await settle();

    srv.setOffline(true);
    a.dispatch({ type: 'addTx', ym: '2026-10', tx: tx('off1', 250) });
    await settle();
    expect(a.getSnapshot().sync).toBe('offline');
    expect(a.getSnapshot().pending).toBe(1);
    a.dispose();

    // «Закрыли приложение и открыли» без сети: трата на месте.
    const b = new BudgetStore(srv.backend, 'u1');
    await b.start();
    expect(b.getSnapshot().state?.months['2026-10'].txs.map((t) => t.id)).toEqual(['off1']);

    // Сеть вернулась — трата уехала на сервер.
    srv.setOffline(false);
    b.sync();
    await settle();
    expect(b.getSnapshot().pending).toBe(0);
    expect((srv.rows.get('u1')?.state as State).months['2026-10'].txs).toHaveLength(1);
    b.dispose();
  });

  it('изменения с двух устройств не теряются', async () => {
    const srv = fakeServer();
    const phone = new BudgetStore(srv.backend, 'u1');
    await phone.start();
    phone.setup(buildSeed());
    await settle();

    // Другое устройство записало трату напрямую на сервер.
    const row = srv.rows.get('u1')!;
    const other = JSON.parse(JSON.stringify(row.state)) as State;
    other.months['2026-10'].txs.push(tx('laptop', 900));
    srv.rows.set('u1', { state: other, rev: row.rev + 1 });

    // Телефон, не зная об этом, пишет свою.
    phone.dispatch({ type: 'addTx', ym: '2026-10', tx: tx('phone', 300) });
    await settle();

    const ids = (srv.rows.get('u1')!.state as State).months['2026-10'].txs.map((t) => t.id).sort();
    expect(ids).toEqual(['laptop', 'phone']);
    expect(phone.getSnapshot().state?.months['2026-10'].txs).toHaveLength(2);
    phone.dispose();
  });

  it('данные разных пользователей на одном устройстве не смешиваются', async () => {
    const srv = fakeServer();
    const a = new BudgetStore(srv.backend, 'alice');
    await a.start();
    a.setup(buildSeed());
    await settle();
    a.dispose();

    const b = new BudgetStore(srv.backend, 'bob');
    await b.start();
    expect(b.getSnapshot().phase).toBe('setup');
    expect(b.getSnapshot().state).toBeNull();
    b.dispose();
  });

  it('выход стирает с устройства все данные пользователя, чужие не трогает', async () => {
    const srv = fakeServer();
    const a = new BudgetStore(srv.backend, 'alice');
    await a.start();
    a.setup(buildSeed());
    await settle();
    a.dispose();
    localStorage.setItem('sarfa:v1:alice:pref:payment', '"cash"');
    localStorage.setItem('sarfa:v1:bob:base', '{}');
    clearUserCache('alice');
    const keys = [...(localStorage as unknown as MemStorage).m.keys()];
    expect(keys.filter((k) => k.includes('alice'))).toEqual([]);
    expect(keys).toContain('sarfa:v1:bob:base');
  });
});
