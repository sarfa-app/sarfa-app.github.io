/**
 * Стартовые данные из ТЗ §8 для тестов. Суммы, категории и признаки — как в ТЗ;
 * заметки обезличены, чтобы в публичный репозиторий не попали личные данные.
 * buildSeed(notes) позволяет подставить настоящие заметки при сборке файла импорта.
 */
import type { HistoryEntry, State, Tx } from '../../src/domain/types';

/** сумма | категория | fromMain — ровно 40 строк из §8.3 */
export const SEPT_ROWS: [number, string, number][] = [
  [3000, 'food', 0], [1500, 'self', 0], [1287, 'auto', 0], [380, 'auto', 0],
  [500, 'health', 0], [700, 'health', 0], [700, 'utils', 0], [700, 'wife', 0],
  [7800, 'auto', 0], [210, 'food', 0], [120, 'fam', 0], [60, 'fam', 0],
  [189, 'fam', 0], [50, 'fam', 0], [207, 'fam', 0], [50, 'fam', 0],
  [1774, 'fam', 0], [550, 'unacc_fam', 0], [151, 'var', 0], [5, 'var', 0],
  [110, 'var', 0], [374, 'var', 0], [100, 'var', 0], [100, 'var', 0],
  [50, 'var', 0], [150, 'var', 0], [50, 'var', 0], [30, 'var', 0],
  [100, 'var', 0], [50, 'var', 0], [20, 'var', 0], [710, 'unacc_var', 0],
  [100, 'var', 100], [226, 'fam', 226], [222, 'health', 222], [245, 'utils', 245],
  [2920, 'var', 2920], [54, 'food', 54], [240, 'food', 240], [130, 'fam', 130],
];

/** §8.4: месяц | доход | расход | неполные */
export const HISTORY_ROWS: [string, number, number, boolean?][] = [
  ['2024-12', 9950, 6960], ['2025-01', 13912, 6670], ['2025-02', 6900, 11389],
  ['2025-03', 6900, 7000], ['2025-04', 6814, 3100, true], ['2025-07', 15586, 11000],
  ['2025-08', 9898, 10600], ['2025-09', 10350, 12000], ['2025-10', 20350, 19000],
  ['2025-11', 11850, 11554], ['2025-12', 10350, 10000], ['2026-01', 24150, 24800],
  ['2026-02', 36150, 28500], ['2026-03', 29150, 29302], ['2026-04', 24000, 21271],
  ['2026-05', 45600, 14139, true], ['2026-06', 24000, 35320], ['2026-07', 24000, 19443],
  ['2026-08', 35352, 48880], ['2026-09', 24000, 25914],
];

/** Помощь родне в 2026 */
export const FAM_HELP_2026: Record<string, number> = {
  '2026-01': 2666, '2026-02': 2097, '2026-03': 8435, '2026-04': 3368, '2026-05': 3552,
  '2026-06': 3352, '2026-07': 7133, '2026-08': 4400, '2026-09': 3856,
};

const NOW = '2026-10-01T00:00:00.000Z';

export function buildSeed(notes?: string[]): State {
  const txs: Tx[] = SEPT_ROWS.map(([amount, categoryId, fromMain], i) => ({
    id: `seed-sep-${String(i + 1).padStart(2, '0')}`,
    date: '2026-09-15',
    amount,
    categoryId,
    note: notes?.[i] ?? (categoryId.startsWith('unacc_') ? 'Не записано' : `Трата ${i + 1}`),
    payment: fromMain > 0 ? 'card' : 'cash',
    fromMain,
    createdAt: NOW,
  }));

  const history: HistoryEntry[] = HISTORY_ROWS.map(([ym, income, expense, incomplete]) => {
    const e: HistoryEntry = { ym, income, expense };
    if (incomplete) e.incomplete = true;
    if (FAM_HELP_2026[ym] !== undefined) {
      e.famHelp = FAM_HELP_2026[ym];
      e.famLimit = 3000;
    }
    return e;
  });

  return {
    version: 2,
    mainAccount: 6256,
    receivables: 1076,
    fundBalances: { f_auto: 0, f_rod: 0, f_home: 0 },
    settings: { bigFromMainThreshold: 2000 },
    months: {
      '2026-09': {
        ym: '2026-09',
        incomes: [{ id: 'seed-inc-sep', date: '2026-09-01', amount: 24000, label: 'Зарплата', routing: 'blocks' }],
        limits: { food: 3000, self: 1500, auto: 1500, health: 500, utils: 700, wife: 700, fam: 3000, var: 2000, unacc_ob: 0, unacc_fam: 0, unacc_var: 0 },
        fundPlan: {},
        txs,
        distributed: true,
        closed: true,
        closedAt: NOW,
      },
      '2026-10': {
        ym: '2026-10',
        incomes: [{ id: 'seed-inc-oct', date: '2026-10-01', amount: 21856, label: 'Зарплата', routing: 'blocks' }],
        limits: { food: 3500, self: 1500, auto: 1500, health: 1500, utils: 950, wife: 700, fam: 3500, var: 2300, unacc_ob: 0, unacc_fam: 0, unacc_var: 0 },
        fundPlan: { f_auto: 900, f_rod: 600, f_home: 350 },
        txs: [],
        distributed: false,
        closed: false,
      },
    },
    history,
  };
}
