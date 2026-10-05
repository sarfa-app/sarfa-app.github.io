/**
 * Проверка состояния при импорте и при загрузке с сервера. Принимает только то,
 * что соответствует модели данных; лишние поля отбрасываются.
 */
import { CATEGORIES, DEFAULT_THRESHOLD, FUNDS } from './constants';
import { isYm, isYmd } from './dates';
import type { HistoryEntry, Income, Month, State, Tx } from './types';

export class InvalidState extends Error {}

const CAT_IDS = new Set(CATEGORIES.map((c) => c.id));
const FUND_IDS = new Set(FUNDS.map((f) => f.id));

function fail(msg: string): never {
  throw new InvalidState(msg);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function int(v: unknown, where: string, { min, max }: { min?: number; max?: number } = {}): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) fail(`${where}: ожидалось целое число`);
  if (min !== undefined && v < min) fail(`${where}: не меньше ${min}`);
  if (max !== undefined && v > max) fail(`${where}: не больше ${max}`);
  return v;
}

function str(v: unknown, where: string, maxLen = 500): string {
  if (typeof v !== 'string') fail(`${where}: ожидалась строка`);
  if (v.length > maxLen) fail(`${where}: слишком длинная строка`);
  return v;
}

const MAX = 1_000_000_000;

function numRecord(v: unknown, where: string, allowed: Set<string>, min = 0): Record<string, number> {
  if (!isObj(v)) fail(`${where}: ожидался объект`);
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v)) {
    if (!allowed.has(k)) continue;
    out[k] = int(val, `${where}.${k}`, { min, max: MAX });
  }
  return out;
}

function parseTx(v: unknown, where: string): Tx {
  if (!isObj(v)) fail(`${where}: ожидался объект`);
  const amount = int(v.amount, `${where}.amount`, { min: 1, max: MAX });
  const fromMain = int(v.fromMain ?? 0, `${where}.fromMain`, { min: 0, max: amount });
  if (!isYmd(v.date)) fail(`${where}.date: дата в формате ГГГГ-ММ-ДД`);
  const categoryId = str(v.categoryId, `${where}.categoryId`, 40);
  if (!CAT_IDS.has(categoryId)) fail(`${where}.categoryId: неизвестная категория «${categoryId}»`);
  if (v.payment !== 'cash' && v.payment !== 'card') fail(`${where}.payment: cash или card`);
  const tx: Tx = {
    id: str(v.id, `${where}.id`, 100),
    date: v.date,
    amount,
    categoryId,
    note: str(v.note ?? '', `${where}.note`),
    payment: v.payment,
    fromMain,
    createdAt: str(v.createdAt ?? '', `${where}.createdAt`, 40),
  };
  if (v.fundId !== undefined) {
    const fundId = str(v.fundId, `${where}.fundId`, 40);
    if (!FUND_IDS.has(fundId)) fail(`${where}.fundId: неизвестный фонд`);
    tx.fundId = fundId;
  }
  return tx;
}

function parseIncome(v: unknown, where: string): Income {
  if (!isObj(v)) fail(`${where}: ожидался объект`);
  if (v.routing !== 'blocks' && v.routing !== 'savings') fail(`${where}.routing: blocks или savings`);
  if (!isYmd(v.date)) fail(`${where}.date: дата в формате ГГГГ-ММ-ДД`);
  return {
    id: str(v.id, `${where}.id`, 100),
    date: v.date,
    amount: int(v.amount, `${where}.amount`, { min: 1, max: MAX }),
    label: str(v.label ?? '', `${where}.label`, 100),
    routing: v.routing,
  };
}

function parseMonth(key: string, v: unknown): Month {
  const where = `months.${key}`;
  if (!isObj(v)) fail(`${where}: ожидался объект`);
  if (!isYm(key) || v.ym !== key) fail(`${where}: ключ и ym должны совпадать и иметь вид ГГГГ-ММ`);
  if (!Array.isArray(v.txs)) fail(`${where}.txs: ожидался список`);
  if (!Array.isArray(v.incomes)) fail(`${where}.incomes: ожидался список`);
  const txs = v.txs.map((t, i) => parseTx(t, `${where}.txs[${i}]`));
  const ids = new Set<string>();
  for (const t of txs) {
    if (ids.has(t.id)) fail(`${where}: повторяется id траты ${t.id}`);
    ids.add(t.id);
  }
  const m: Month = {
    ym: key,
    incomes: v.incomes.map((x, i) => parseIncome(x, `${where}.incomes[${i}]`)),
    limits: numRecord(v.limits, `${where}.limits`, CAT_IDS),
    fundPlan: numRecord(v.fundPlan, `${where}.fundPlan`, FUND_IDS),
    txs,
    distributed: v.distributed === true,
    closed: v.closed === true,
  };
  if (v.distributedDelta !== undefined) m.distributedDelta = int(v.distributedDelta, `${where}.distributedDelta`);
  if (v.closedAt !== undefined) m.closedAt = str(v.closedAt, `${where}.closedAt`, 40);
  return m;
}

function parseHistory(v: unknown): HistoryEntry[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) fail('history: ожидался список');
  const seen = new Set<string>();
  return v.map((h, i) => {
    const where = `history[${i}]`;
    if (!isObj(h)) fail(`${where}: ожидался объект`);
    if (!isYm(h.ym)) fail(`${where}.ym: вид ГГГГ-ММ`);
    if (seen.has(h.ym)) fail(`${where}: месяц ${h.ym} повторяется`);
    seen.add(h.ym);
    const e: HistoryEntry = {
      ym: h.ym,
      income: int(h.income, `${where}.income`, { min: 0, max: MAX }),
      expense: int(h.expense, `${where}.expense`, { min: 0, max: MAX }),
    };
    if (h.incomplete === true) e.incomplete = true;
    if (h.famHelp !== undefined) e.famHelp = int(h.famHelp, `${where}.famHelp`, { min: 0, max: MAX });
    if (h.famLimit !== undefined) e.famLimit = int(h.famLimit, `${where}.famLimit`, { min: 0, max: MAX });
    return e;
  });
}

export function parseState(v: unknown): State {
  if (!isObj(v)) fail('Файл не похож на данные Сарфы');
  if (v.version !== 2) fail('Неподдерживаемая версия данных (нужна version: 2)');
  if (!isObj(v.months)) fail('months: ожидался объект');
  const months: Record<string, Month> = {};
  for (const [k, m] of Object.entries(v.months)) months[k] = parseMonth(k, m);
  const open = Object.values(months).filter((m) => !m.closed);
  if (Object.keys(months).length > 0 && open.length === 0) fail('Нет открытого месяца');
  const settings = isObj(v.settings) ? v.settings : {};
  const fundBalances = numRecord(v.fundBalances ?? {}, 'fundBalances', FUND_IDS, -MAX);
  for (const f of FUNDS) fundBalances[f.id] ??= 0;
  return {
    version: 2,
    mainAccount: int(v.mainAccount, 'mainAccount', { min: -MAX, max: MAX }),
    receivables: int(v.receivables ?? 0, 'receivables', { min: 0, max: MAX }),
    fundBalances,
    months,
    settings: {
      bigFromMainThreshold: int(settings.bigFromMainThreshold ?? DEFAULT_THRESHOLD, 'settings.bigFromMainThreshold', {
        min: 0,
        max: MAX,
      }),
    },
    history: parseHistory(v.history),
  };
}

/** Разбор файла импорта с понятной ошибкой. */
export function parseStateJson(text: string): { ok: true; state: State } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Это не JSON-файл' };
  }
  try {
    return { ok: true, state: parseState(raw) };
  } catch (e) {
    return { ok: false, error: e instanceof InvalidState ? e.message : 'Не удалось прочитать файл' };
  }
}
