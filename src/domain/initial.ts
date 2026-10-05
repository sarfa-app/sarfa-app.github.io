import { DEFAULT_THRESHOLD, FUNDS } from './constants';
import { ymOf } from './dates';
import { emptyMonth } from './months';
import type { State } from './types';

export interface Setup {
  mainAccount: number;
  receivables: number;
  fundBalances: Record<string, number>;
  limits: Record<string, number>;
  fundPlan: Record<string, number>;
}

/** Состояние нового пользователя: открыт текущий месяц, всё остальное — из анкеты. */
export function freshState(today: string, setup?: Partial<Setup>): State {
  const ym = ymOf(today);
  const fundBalances: Record<string, number> = {};
  for (const f of FUNDS) fundBalances[f.id] = setup?.fundBalances?.[f.id] ?? 0;
  return {
    version: 2,
    mainAccount: setup?.mainAccount ?? 0,
    receivables: setup?.receivables ?? 0,
    fundBalances,
    months: { [ym]: emptyMonth(ym, setup?.limits ?? {}, setup?.fundPlan ?? {}) },
    settings: { bigFromMainThreshold: DEFAULT_THRESHOLD },
    history: [],
  };
}
