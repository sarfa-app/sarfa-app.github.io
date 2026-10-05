import { addMonths } from './dates';
import type { Month, State } from './types';

export function emptyMonth(ym: string, limits: Record<string, number> = {}, fundPlan: Record<string, number> = {}): Month {
  return { ym, incomes: [], limits: { ...limits }, fundPlan: { ...fundPlan }, txs: [], distributed: false, closed: false };
}

export function sortedYms(s: State): string[] {
  return Object.keys(s.months).sort();
}

/** Открытый месяц — последний незакрытый. В нормальном состоянии он один. */
export function openMonth(s: State): Month | undefined {
  const yms = sortedYms(s);
  for (let i = yms.length - 1; i >= 0; i--) {
    const m = s.months[yms[i]];
    if (!m.closed) return m;
  }
  return undefined;
}

/**
 * §4.8: листать можно существующие месяцы плюс один следующий.
 * Возвращает список ym для навигации; последний может не существовать в хранилище.
 */
export function navigableYms(s: State): string[] {
  const yms = sortedYms(s);
  if (yms.length === 0) return [];
  return [...yms, addMonths(yms[yms.length - 1], 1)];
}
