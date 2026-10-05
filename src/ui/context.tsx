import { createContext, useContext, useEffect, useState } from 'react';
import { todayYmd } from '../domain/dates';
import type { Action } from '../domain/reducer';
import type { State } from '../domain/types';
import type { SessionInfo } from '../sync/backend';
import type { BudgetStore, StoreSnapshot } from '../sync/store';

export interface AppCtx {
  session: SessionInfo;
  store: BudgetStore;
  snap: StoreSnapshot;
  state: State;
  dispatch: (a: Action) => void;
  logout: () => Promise<void>;
  today: string;
}

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const v = useContext(AppContext);
  if (!v) throw new Error('useApp вне AppContext');
  return v;
}

/** Сегодняшняя дата; обновляется, когда приложение возвращают на экран. */
export function useToday(): string {
  const [today, setToday] = useState(todayYmd);
  useEffect(() => {
    const on = () => setToday(todayYmd());
    document.addEventListener('visibilitychange', on);
    const t = setInterval(on, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', on);
      clearInterval(t);
    };
  }, []);
  return today;
}

/** Небольшие настройки интерфейса, только на этом устройстве (не данные бюджета). */
export function usePref<T>(uid: string, key: string, fallback: T): [T, (v: T) => void] {
  const k = `sarfa:v1:${uid}:pref:${key}`;
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  });
  const set = (nv: T) => {
    setV(nv);
    try {
      localStorage.setItem(k, JSON.stringify(nv));
    } catch {
      /* не критично */
    }
  };
  return [v, set];
}
