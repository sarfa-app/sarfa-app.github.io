/**
 * Расчёты ТЗ §4.1–4.6. Чистые функции без побочных эффектов.
 */
import { BLOCKS, CATEGORIES, categoriesOfBlock, FUNDS, PACE_TOLERANCE } from './constants';
import { daysInMonth, ymOf } from './dates';
import type { BlockId, Month, State, Tx } from './types';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Траты, которые относятся к конвертам месяца (без трат из фондов). */
export function envelopeTxs(m: Month): Tx[] {
  return m.txs.filter((t) => !t.fundId);
}

export function spentByCategory(m: Month, cat: string): number {
  return sum(m.txs.filter((t) => t.categoryId === cat && !t.fundId).map((t) => t.amount));
}

export function limitOf(m: Month, cat: string): number {
  return m.limits[cat] ?? 0;
}

/** Может быть отрицательным. */
export function remaining(m: Month, cat: string): number {
  return limitOf(m, cat) - spentByCategory(m, cat);
}

/** Сколько по категории добрано с основного счёта (только траты из конвертов). */
export function fromMainByCategory(m: Month, cat: string): number {
  return sum(m.txs.filter((t) => t.categoryId === cat && !t.fundId).map((t) => t.fromMain));
}

export function blockLimit(m: Month, b: BlockId): number {
  return sum(categoriesOfBlock(b).map((c) => limitOf(m, c.id)));
}

export function blockSpent(m: Month, b: BlockId): number {
  return sum(categoriesOfBlock(b).map((c) => spentByCategory(m, c.id)));
}

export function blockFromMain(m: Month, b: BlockId): number {
  return sum(categoriesOfBlock(b).map((c) => fromMainByCategory(m, c.id)));
}

export function limitsTotal(m: Month): number {
  return sum(CATEGORIES.map((c) => limitOf(m, c.id)));
}

export function fundPlanTotal(m: Month): number {
  return sum(FUNDS.map((f) => m.fundPlan[f.id] ?? 0));
}

export function planTotal(m: Month): number {
  return limitsTotal(m) + fundPlanTotal(m);
}

export function spentTotal(m: Month): number {
  return sum(CATEGORIES.map((c) => spentByCategory(m, c.id)));
}

export function takenFromMain(m: Month): number {
  return sum(m.txs.map((t) => t.fromMain));
}

export function unspentEnvelopes(m: Month): number {
  return sum(CATEGORIES.map((c) => Math.max(0, remaining(m, c.id))));
}

export function incomeToBlocks(m: Month): number {
  return sum(m.incomes.filter((i) => i.routing === 'blocks').map((i) => i.amount));
}

export function incomeToSavings(m: Month): number {
  return sum(m.incomes.filter((i) => i.routing === 'savings').map((i) => i.amount));
}

export function incomeTotal(m: Month): number {
  return incomeToBlocks(m) + incomeToSavings(m);
}

/** §4.2: на сколько изменится основной счёт при распределении дохода. */
export function distributionDelta(m: Month): number {
  return incomeToBlocks(m) - planTotal(m) + incomeToSavings(m);
}

/** Не хватает дохода на план (0, если хватает). */
export function planShortfall(m: Month): number {
  return Math.max(0, planTotal(m) - incomeToBlocks(m));
}

/**
 * Доход или план поменяли после распределения: сколько ещё не разнесено
 * (может быть отрицательным). 0 — расхождений нет.
 */
export function undistributedDiff(m: Month): number {
  if (!m.distributed || m.distributedDelta === undefined) return 0;
  return distributionDelta(m) - m.distributedDelta;
}

/** §4.3 */
export function mainNow(s: State, m: Month): number {
  return s.mainAccount - takenFromMain(m);
}

export function mainProjected(s: State, m: Month): number {
  return mainNow(s, m) + unspentEnvelopes(m);
}

/** Мелкие траты с основного счёта — нарушение правила пользователя (дефект 1). */
export function smallFromMain(m: Month, threshold: number): { count: number; total: number } {
  const small = m.txs.filter((t) => t.fromMain > 0 && t.fromMain < threshold);
  return { count: small.length, total: sum(small.map((t) => t.fromMain)) };
}

/** §4.4: недостача конверта для новой траты. 0 — лимита хватает. */
export function deficitFor(m: Month, cat: string, amount: number): number {
  const rem = remaining(m, cat);
  if (amount <= rem) return 0;
  return amount - Math.max(0, rem);
}

/** §4.6: сколько должно остаться в конверте блока по записям. */
export function expectedInEnvelope(m: Month, b: BlockId): number {
  return blockLimit(m, b) - (blockSpent(m, b) - blockFromMain(m, b));
}

// ---------- Полоса темпа (§5.1) ----------

export type PaceStatus = 'fast' | 'slow' | 'even' | 'noplan' | 'before' | 'closed';

export interface Pace {
  status: PaceStatus;
  /** доля потраченного от плана, 0..∞ */
  fill: number;
  /** доля прошедших дней месяца, 0..1 */
  tick: number;
  day: number;
  days: number;
  /** разница заливки и риски в процентных пунктах, округлённая */
  diffPct: number;
  /** ожидаемый перерасход при сохранении темпа (для status = 'fast') */
  forecastOver: number;
}

export function monthProgress(ym: string, today: string): { day: number; days: number; tick: number } {
  const days = daysInMonth(ym);
  const tym = ymOf(today);
  if (tym < ym) return { day: 0, days, tick: 0 };
  if (tym > ym) return { day: days, days, tick: 1 };
  const day = Number(today.slice(8, 10));
  return { day, days, tick: day / days };
}

export function pace(m: Month, today: string): Pace {
  const plan = planTotal(m);
  const spent = spentTotal(m);
  const { day, days, tick } = monthProgress(m.ym, today);
  const fill = plan > 0 ? spent / plan : 0;
  const diff = fill - tick;
  const base: Pace = { status: 'even', fill, tick, day, days, diffPct: Math.round(Math.abs(diff) * 100), forecastOver: 0 };

  if (m.closed) return { ...base, status: 'closed' };
  if (plan <= 0) return { ...base, status: 'noplan' };
  if (tick === 0) return { ...base, status: 'before' };
  if (diff > PACE_TOLERANCE) {
    const over = spent / tick - plan;
    return { ...base, status: 'fast', forecastOver: Math.max(0, Math.round(over / 10) * 10) };
  }
  if (diff < -PACE_TOLERANCE) return { ...base, status: 'slow' };
  return base;
}

// ---------- Частые категории (§5.2) ----------

/** Категории для формы траты: сначала 4 самые частые по истории, потом остальные. */
export function orderedCategories(s: State, top = 4): string[] {
  const counts = new Map<string, number>();
  for (const m of Object.values(s.months)) {
    for (const t of m.txs) {
      if (t.fundId) continue;
      counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
    }
  }
  const user = CATEGORIES.filter((c) => !c.system).map((c) => c.id);
  const frequent = user
    .filter((id) => (counts.get(id) ?? 0) > 0)
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || user.indexOf(a) - user.indexOf(b))
    .slice(0, top);
  return [...frequent, ...user.filter((id) => !frequent.includes(id))];
}

export function blockOfCategory(cat: string): BlockId | undefined {
  return CATEGORIES.find((c) => c.id === cat)?.block;
}

export const BLOCK_IDS: BlockId[] = BLOCKS.map((b) => b.id);
