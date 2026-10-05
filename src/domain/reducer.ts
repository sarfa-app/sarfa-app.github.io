/**
 * Все изменения состояния — через действия. Действия детерминированы (id и время
 * приходят снаружи), поэтому их можно переиграть поверх свежей версии с сервера,
 * если пользователь менял данные с двух устройств.
 */
import { distributionDelta, mainNow, undistributedDiff, unspentEnvelopes } from './calc';
import { FUNDS } from './constants';
import { addMonths } from './dates';
import { emptyMonth } from './months';
import type { Income, Month, Settings, State, Tx } from './types';

export type TxPatch = Partial<Pick<Tx, 'date' | 'amount' | 'categoryId' | 'note' | 'payment' | 'fromMain'>>;
export type IncomePatch = Partial<Pick<Income, 'date' | 'amount' | 'label' | 'routing'>>;

export type Action =
  | { type: 'replace'; state: State }
  | { type: 'addTx'; ym: string; tx: Tx }
  | { type: 'addTxs'; ym: string; txs: Tx[] }
  | { type: 'updateTx'; ym: string; id: string; patch: TxPatch }
  | { type: 'deleteTx'; ym: string; id: string }
  | { type: 'addIncome'; ym: string; income: Income }
  | { type: 'updateIncome'; ym: string; id: string; patch: IncomePatch }
  | { type: 'deleteIncome'; ym: string; id: string }
  | { type: 'setPlan'; ym: string; limits?: Record<string, number>; fundPlan?: Record<string, number> }
  | { type: 'setAccounts'; mainAccount?: number; receivables?: number; fundBalances?: Record<string, number> }
  | { type: 'setSettings'; settings: Partial<Settings> }
  | { type: 'distribute'; ym: string }
  | { type: 'distributeDiff'; ym: string }
  | { type: 'closeMonth'; ym: string; at: string };

const int = (n: unknown, fallback = 0): number => {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : fallback;
  return v;
};
const nonNeg = (n: unknown) => Math.max(0, int(n));

function normalizeTx(tx: Tx): Tx | null {
  const amount = int(tx.amount);
  if (amount <= 0) return null;
  const fromMain = Math.min(amount, nonNeg(tx.fromMain));
  return { ...tx, amount, fromMain, note: tx.note ?? '' };
}

/** Сколько трата забирает из фонда. */
function fundUse(tx: Tx): number {
  return tx.fundId ? tx.amount - tx.fromMain : 0;
}

function adjustFund(s: State, fundId: string | undefined, delta: number): Record<string, number> {
  if (!fundId || delta === 0) return s.fundBalances;
  return { ...s.fundBalances, [fundId]: (s.fundBalances[fundId] ?? 0) + delta };
}

/** Изменить открытый месяц; закрытые месяцы не редактируются. */
function withOpenMonth(s: State, ym: string, fn: (m: Month) => Month): State {
  const m = s.months[ym];
  if (!m || m.closed) return s;
  const next = fn(m);
  if (next === m) return s;
  return { ...s, months: { ...s.months, [ym]: next } };
}

function cleanRecord(rec: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec ?? {})) out[k] = nonNeg(v);
  return out;
}

export function reduce(s: State, a: Action): State {
  switch (a.type) {
    case 'replace':
      return a.state;

    case 'addTx':
    case 'addTxs': {
      const list = a.type === 'addTx' ? [a.tx] : a.txs;
      let next = s;
      for (const raw of list) {
        const tx = normalizeTx(raw);
        const m = next.months[a.ym];
        if (!tx || !m || m.closed || m.txs.some((t) => t.id === tx.id)) continue;
        next = withOpenMonth(next, a.ym, (mm) => ({ ...mm, txs: [...mm.txs, tx] }));
        next = { ...next, fundBalances: adjustFund(next, tx.fundId, -fundUse(tx)) };
      }
      return next;
    }

    case 'updateTx': {
      const m = s.months[a.ym];
      const old = m?.txs.find((t) => t.id === a.id);
      if (!m || m.closed || !old) return s;
      const updated = normalizeTx({ ...old, ...a.patch });
      if (!updated) return s;
      let next = withOpenMonth(s, a.ym, (mm) => ({ ...mm, txs: mm.txs.map((t) => (t.id === a.id ? updated : t)) }));
      next = { ...next, fundBalances: adjustFund(next, old.fundId, fundUse(old) - fundUse(updated)) };
      return next;
    }

    case 'deleteTx': {
      const m = s.months[a.ym];
      const old = m?.txs.find((t) => t.id === a.id);
      if (!m || m.closed || !old) return s;
      const next = withOpenMonth(s, a.ym, (mm) => ({ ...mm, txs: mm.txs.filter((t) => t.id !== a.id) }));
      return { ...next, fundBalances: adjustFund(next, old.fundId, fundUse(old)) };
    }

    case 'addIncome':
      return withOpenMonth(s, a.ym, (m) => {
        if (m.incomes.some((i) => i.id === a.income.id) || int(a.income.amount) <= 0) return m;
        return { ...m, incomes: [...m.incomes, { ...a.income, amount: int(a.income.amount) }] };
      });

    case 'updateIncome':
      return withOpenMonth(s, a.ym, (m) => {
        if (!m.incomes.some((i) => i.id === a.id)) return m;
        return {
          ...m,
          incomes: m.incomes.map((i) => {
            if (i.id !== a.id) return i;
            const next = { ...i, ...a.patch };
            next.amount = int(next.amount) > 0 ? int(next.amount) : i.amount;
            return next;
          }),
        };
      });

    case 'deleteIncome':
      return withOpenMonth(s, a.ym, (m) => ({ ...m, incomes: m.incomes.filter((i) => i.id !== a.id) }));

    case 'setPlan':
      return withOpenMonth(s, a.ym, (m) => ({
        ...m,
        limits: a.limits ? { ...m.limits, ...cleanRecord(a.limits) } : m.limits,
        fundPlan: a.fundPlan ? { ...m.fundPlan, ...cleanRecord(a.fundPlan) } : m.fundPlan,
      }));

    case 'setAccounts':
      return {
        ...s,
        mainAccount: a.mainAccount !== undefined ? int(a.mainAccount, s.mainAccount) : s.mainAccount,
        receivables: a.receivables !== undefined ? nonNeg(a.receivables) : s.receivables,
        fundBalances: a.fundBalances ? { ...s.fundBalances, ...mapInts(a.fundBalances) } : s.fundBalances,
      };

    case 'setSettings':
      return {
        ...s,
        settings: {
          ...s.settings,
          ...(a.settings.bigFromMainThreshold !== undefined
            ? { bigFromMainThreshold: nonNeg(a.settings.bigFromMainThreshold) }
            : {}),
        },
      };

    case 'distribute': {
      const m = s.months[a.ym];
      if (!m || m.closed || m.distributed) return s;
      const delta = distributionDelta(m);
      return {
        ...s,
        mainAccount: s.mainAccount + delta,
        months: { ...s.months, [a.ym]: { ...m, distributed: true, distributedDelta: delta } },
      };
    }

    case 'distributeDiff': {
      const m = s.months[a.ym];
      if (!m || m.closed || !m.distributed) return s;
      const diff = undistributedDiff(m);
      if (diff === 0) return s;
      return {
        ...s,
        mainAccount: s.mainAccount + diff,
        months: { ...s.months, [a.ym]: { ...m, distributedDelta: (m.distributedDelta ?? 0) + diff } },
      };
    }

    case 'closeMonth': {
      const m = s.months[a.ym];
      if (!m || m.closed) return s;
      const fundBalances = { ...s.fundBalances };
      for (const f of FUNDS) fundBalances[f.id] = (fundBalances[f.id] ?? 0) + (m.fundPlan[f.id] ?? 0);
      const mainAccount = mainNow(s, m) + unspentEnvelopes(m);
      const nextYm = addMonths(a.ym, 1);
      const months = { ...s.months, [a.ym]: { ...m, closed: true, closedAt: a.at } };
      if (!months[nextYm]) months[nextYm] = emptyMonth(nextYm, m.limits, m.fundPlan);
      return { ...s, fundBalances, mainAccount, months };
    }
  }
}

function mapInts(rec: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec)) out[k] = int(v);
  return out;
}

export function reduceAll(s: State, actions: Action[]): State {
  return actions.reduce(reduce, s);
}
