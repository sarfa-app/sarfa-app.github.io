/**
 * Экран «История» (§5.4): итоги месяцев из заметок плюс закрытые месяцы приложения.
 * Если месяц есть и там и там, верим записи из заметок: это итог, который пользователь
 * сверял сам.
 */
import { blockLimit, blockSpent, incomeTotal } from './calc';
import { DEFAULT_FAM_LIMIT } from './constants';
import type { Month, State } from './types';

export interface HistoryRow {
  ym: string;
  income: number;
  expense: number;
  balance: number;
  incomplete: boolean;
}

export interface FamRow {
  ym: string;
  help: number;
  limit: number;
  deviation: number;
}

/** Все фактические расходы месяца, включая траты из фондов. */
export function monthExpense(m: Month): number {
  return m.txs.reduce((a, t) => a + t.amount, 0);
}

export function historyRows(s: State): HistoryRow[] {
  const byYm = new Map<string, HistoryRow>();
  for (const m of Object.values(s.months)) {
    if (!m.closed) continue;
    const income = incomeTotal(m);
    const expense = monthExpense(m);
    byYm.set(m.ym, { ym: m.ym, income, expense, balance: income - expense, incomplete: false });
  }
  for (const h of s.history) {
    byYm.set(h.ym, {
      ym: h.ym,
      income: h.income,
      expense: h.expense,
      balance: h.income - h.expense,
      incomplete: !!h.incomplete,
    });
  }
  return [...byYm.values()].sort((a, b) => a.ym.localeCompare(b.ym));
}

export interface HistorySummary {
  income: number;
  expense: number;
  saved: number;
  /** норма сбережений, доля 0..1 (может быть отрицательной) */
  rate: number;
  minusMonths: number;
  months: number;
  hasIncomplete: boolean;
}

export function historySummary(rows: HistoryRow[]): HistorySummary {
  const income = rows.reduce((a, r) => a + r.income, 0);
  const expense = rows.reduce((a, r) => a + r.expense, 0);
  const saved = income - expense;
  return {
    income,
    expense,
    saved,
    rate: income > 0 ? saved / income : 0,
    minusMonths: rows.filter((r) => r.balance < 0).length,
    months: rows.length,
    hasIncomplete: rows.some((r) => r.incomplete),
  };
}

export function famRows(s: State, year: string): FamRow[] {
  const byYm = new Map<string, FamRow>();
  for (const m of Object.values(s.months)) {
    if (!m.closed || !m.ym.startsWith(year)) continue;
    const help = blockSpent(m, 'fam');
    const limit = blockLimit(m, 'fam');
    byYm.set(m.ym, { ym: m.ym, help, limit, deviation: help - limit });
  }
  for (const h of s.history) {
    if (!h.ym.startsWith(year) || h.famHelp === undefined) continue;
    const limit = h.famLimit ?? DEFAULT_FAM_LIMIT;
    byYm.set(h.ym, { ym: h.ym, help: h.famHelp, limit, deviation: h.famHelp - limit });
  }
  return [...byYm.values()].sort((a, b) => a.ym.localeCompare(b.ym));
}

export function famAverage(rows: FamRow[]): number {
  if (rows.length === 0) return 0;
  return Math.round(rows.reduce((a, r) => a + r.help, 0) / rows.length);
}
