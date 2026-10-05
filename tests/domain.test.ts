import { describe, expect, it } from 'vitest';
import {
  blockSpent,
  deficitFor,
  distributionDelta,
  expectedInEnvelope,
  fromMainByCategory,
  fundPlanTotal,
  incomeToBlocks,
  limitsTotal,
  mainNow,
  mainProjected,
  orderedCategories,
  pace,
  planShortfall,
  planTotal,
  remaining,
  smallFromMain,
  spentByCategory,
  spentTotal,
  takenFromMain,
  undistributedDiff,
  unspentEnvelopes,
} from '../src/domain/calc';
import { famAverage, famRows, historyRows, historySummary, monthExpense } from '../src/domain/history';
import { freshState } from '../src/domain/initial';
import { navigableYms, openMonth } from '../src/domain/months';
import { reduce, reduceAll, type Action } from '../src/domain/reducer';
import type { State, Tx } from '../src/domain/types';
import { parseState, parseStateJson } from '../src/domain/validate';
import { money } from '../src/domain/format';
import { buildSeed } from './fixtures/seed';

const OCT = '2026-10';
const SEP = '2026-09';

let n = 0;
function tx(p: Partial<Tx> & Pick<Tx, 'amount' | 'categoryId'>): Tx {
  n += 1;
  return { id: `t${n}`, date: '2026-10-05', note: '', payment: 'cash', fromMain: 0, createdAt: '2026-10-05T10:00:00Z', ...p };
}

describe('Стартовые данные: октябрь (приёмка 4, 7)', () => {
  const s = buildSeed();
  const m = s.months[OCT];

  it('план 17 300: лимиты 15 450 + фонды 1 850', () => {
    expect(limitsTotal(m)).toBe(15450);
    expect(fundPlanTotal(m)).toBe(1850);
    expect(planTotal(m)).toBe(17300);
  });

  it('в накопления уходит 4 556', () => {
    expect(incomeToBlocks(m)).toBe(21856);
    expect(distributionDelta(m)).toBe(4556);
    expect(planShortfall(m)).toBe(0);
  });

  it('до распределения основной счёт 6 256, а не 10 812', () => {
    expect(mainNow(s, m)).toBe(6256);
    const after = reduce(s, { type: 'distribute', ym: OCT });
    expect(mainNow(after, after.months[OCT])).toBe(10812);
    expect(after.months[OCT].distributed).toBe(true);
  });

  it('распределение — один раз за месяц', () => {
    const twice = reduceAll(s, [
      { type: 'distribute', ym: OCT },
      { type: 'distribute', ym: OCT },
    ]);
    expect(twice.mainAccount).toBe(10812);
  });

  it('«станет к концу месяца» ≥ «сейчас» (приёмка 8)', () => {
    expect(mainProjected(s, m)).toBeGreaterThanOrEqual(mainNow(s, m));
    expect(mainProjected(s, m) - mainNow(s, m)).toBe(unspentEnvelopes(m));
  });
});

describe('Стартовые данные: сентябрь (приёмка 5)', () => {
  const m = buildSeed().months[SEP];

  it('40 трат на 25 914, с основного счёта 4 137', () => {
    expect(m.txs).toHaveLength(40);
    expect(monthExpense(m)).toBe(25914);
    expect(spentTotal(m)).toBe(25914);
    expect(takenFromMain(m)).toBe(4137);
  });

  it('по блокам 17 538 / 3 356 / 5 020', () => {
    expect(blockSpent(m, 'ob')).toBe(17538);
    expect(blockSpent(m, 'fam')).toBe(3356);
    expect(blockSpent(m, 'var')).toBe(5020);
  });
});

describe('История (приёмка 6)', () => {
  const s = buildSeed();
  const rows = historyRows(s);
  const sum = historySummary(rows);

  it('доход 389 262, расход 356 842, накоплено 32 420', () => {
    expect(rows).toHaveLength(20);
    expect(sum.income).toBe(389262);
    expect(sum.expense).toBe(356842);
    expect(sum.saved).toBe(32420);
  });

  it('норма сбережений 8%, 9 месяцев из 20 в минусе', () => {
    expect(Math.round(sum.rate * 100)).toBe(8);
    expect(sum.minusMonths).toBe(9);
    expect(sum.months).toBe(20);
  });

  it('неполные месяцы помечены', () => {
    expect(rows.filter((r) => r.incomplete).map((r) => r.ym)).toEqual(['2025-04', '2026-05']);
  });

  it('помощь родне в 2026: 9 месяцев, среднее 4 318, отклонение от 3 000', () => {
    const fam = famRows(s, '2026');
    expect(fam).toHaveLength(9);
    expect(famAverage(fam)).toBe(4318);
    expect(fam.find((r) => r.ym === '2026-03')?.deviation).toBe(5435);
  });

  it('закрытый в приложении месяц попадает в историю', () => {
    const closed = reduceAll(s, [
      { type: 'distribute', ym: OCT },
      { type: 'addTx', ym: OCT, tx: tx({ amount: 1000, categoryId: 'food' }) },
      { type: 'closeMonth', ym: OCT, at: '2026-10-31T20:00:00Z' },
    ]);
    const r = historyRows(closed);
    expect(r).toHaveLength(21);
    expect(r[20]).toMatchObject({ ym: OCT, income: 21856, expense: 1000, balance: 20856 });
  });
});

describe('Запись траты сверх лимита (§4.4, приёмка 9–11)', () => {
  const s = buildSeed();
  const m = s.months[OCT];

  it('недостача = сумма − max(0, остаток)', () => {
    expect(deficitFor(m, 'food', 3000)).toBe(0);
    expect(deficitFor(m, 'food', 3500)).toBe(0);
    expect(deficitFor(m, 'food', 3800)).toBe(300);
    const over = reduce(s, { type: 'addTx', ym: OCT, tx: tx({ amount: 3600, categoryId: 'food', fromMain: 100 }) });
    expect(remaining(over.months[OCT], 'food')).toBe(-100);
    expect(deficitFor(over.months[OCT], 'food', 250)).toBe(250);
  });

  it('«взять с основного счёта» записывает fromMain и строку «добрано»', () => {
    const amount = 4000;
    const deficit = deficitFor(m, 'food', amount);
    const after = reduce(s, { type: 'addTx', ym: OCT, tx: tx({ amount, categoryId: 'food', fromMain: deficit }) });
    const am = after.months[OCT];
    expect(fromMainByCategory(am, 'food')).toBe(500);
    expect(spentByCategory(am, 'food')).toBe(4000);
    expect(mainNow(after, am)).toBe(6256 - 500);
  });

  it('мелкие траты с основного счёта видны как нарушение правила', () => {
    const after = reduceAll(s, [
      { type: 'addTx', ym: OCT, tx: tx({ amount: 3700, categoryId: 'food', fromMain: 200 }) },
      { type: 'addTx', ym: OCT, tx: tx({ amount: 4500, categoryId: 'auto', fromMain: 3000 }) },
    ]);
    expect(smallFromMain(after.months[OCT], 2000)).toEqual({ count: 1, total: 200 });
  });

  it('fromMain не может превышать сумму', () => {
    const after = reduce(s, { type: 'addTx', ym: OCT, tx: tx({ amount: 100, categoryId: 'food', fromMain: 500 }) });
    expect(after.months[OCT].txs[0].fromMain).toBe(100);
  });
});

describe('Сверка наличных (§4.6, приёмка 12)', () => {
  it('разница уходит в «Не записано» своего блока, еда не меняется', () => {
    const s = reduceAll(buildSeed(), [
      { type: 'addTx', ym: OCT, tx: tx({ amount: 1000, categoryId: 'food' }) },
      { type: 'addTx', ym: OCT, tx: tx({ amount: 1800, categoryId: 'health', fromMain: 300 }) },
    ]);
    const m = s.months[OCT];
    // ob: лимит 9 650, потрачено 2 800, из них 300 с основного → должно остаться 7 150
    expect(expectedInEnvelope(m, 'ob')).toBe(7150);
    const actual = 6900;
    const diff = expectedInEnvelope(m, 'ob') - actual;
    const after = reduce(s, {
      type: 'addTxs',
      ym: OCT,
      txs: [tx({ amount: diff, categoryId: 'unacc_ob', note: 'Не записано (сверка)' })],
    });
    const am = after.months[OCT];
    expect(spentByCategory(am, 'unacc_ob')).toBe(250);
    expect(spentByCategory(am, 'food')).toBe(1000);
    expect(expectedInEnvelope(am, 'ob')).toBe(actual);
  });
});

describe('Фонды (§4.5, приёмка 13)', () => {
  it('трата из фонда уменьшает фонд и не трогает лимиты', () => {
    const s0: State = { ...buildSeed(), fundBalances: { f_auto: 5000, f_rod: 0, f_home: 0 } };
    const before = s0.months[OCT];
    const t = tx({ amount: 1200, categoryId: 'auto', fundId: 'f_auto' });
    const s1 = reduce(s0, { type: 'addTx', ym: OCT, tx: t });
    const m = s1.months[OCT];
    expect(s1.fundBalances.f_auto).toBe(3800);
    expect(m.limits).toEqual(before.limits);
    expect(spentTotal(m)).toBe(0);
    expect(remaining(m, 'auto')).toBe(1500);
    expect(m.txs).toHaveLength(1);

    const s2 = reduce(s1, { type: 'deleteTx', ym: OCT, id: t.id });
    expect(s2.fundBalances.f_auto).toBe(5000);
  });

  it('если в фонде не хватает, недостача добирается с основного счёта', () => {
    const s0: State = { ...buildSeed(), fundBalances: { f_auto: 700, f_rod: 0, f_home: 0 } };
    const s1 = reduce(s0, { type: 'addTx', ym: OCT, tx: tx({ amount: 1000, categoryId: 'auto', fundId: 'f_auto', fromMain: 300 }) });
    expect(s1.fundBalances.f_auto).toBe(0);
    expect(mainNow(s1, s1.months[OCT])).toBe(6256 - 300);
  });

  it('редактирование траты из фонда пересчитывает фонд', () => {
    const s0: State = { ...buildSeed(), fundBalances: { f_auto: 5000, f_rod: 0, f_home: 0 } };
    const t = tx({ amount: 1000, categoryId: 'auto', fundId: 'f_auto' });
    const s1 = reduceAll(s0, [
      { type: 'addTx', ym: OCT, tx: t },
      { type: 'updateTx', ym: OCT, id: t.id, patch: { amount: 1500 } },
    ]);
    expect(s1.fundBalances.f_auto).toBe(3500);
  });
});

describe('Закрытие месяца (§4.7, приёмка 14)', () => {
  const s = reduceAll(buildSeed(), [
    { type: 'distribute', ym: OCT },
    { type: 'addTx', ym: OCT, tx: tx({ amount: 3000, categoryId: 'food' }) },
    { type: 'addTx', ym: OCT, tx: tx({ amount: 2000, categoryId: 'health', fromMain: 500 }) },
  ]);
  const m = s.months[OCT];
  const closed = reduce(s, { type: 'closeMonth', ym: OCT, at: '2026-10-31T20:00:00Z' });

  it('остатки конвертов переходят на основной счёт, фонды пополняются', () => {
    expect(closed.mainAccount).toBe(mainNow(s, m) + unspentEnvelopes(m));
    expect(closed.mainAccount).toBe(10812 - 500 + (15450 - 3000 - 1500));
    expect(closed.fundBalances).toEqual({ f_auto: 900, f_rod: 600, f_home: 350 });
    expect(closed.months[OCT].closed).toBe(true);
  });

  it('следующий месяц получает копию лимитов и плана фондов, пустые траты и доход', () => {
    const nov = closed.months['2026-11'];
    expect(nov.limits).toEqual(m.limits);
    expect(nov.fundPlan).toEqual(m.fundPlan);
    expect(nov.txs).toEqual([]);
    expect(nov.incomes).toEqual([]);
    expect(nov.distributed).toBe(false);
    expect(openMonth(closed)?.ym).toBe('2026-11');
  });

  it('лимиты нового месяца можно поменять, старый месяц не меняется', () => {
    const edited = reduce(closed, { type: 'setPlan', ym: '2026-11', limits: { health: 2000, food: 3200 }, fundPlan: { f_home: 0 } });
    expect(edited.months['2026-11'].limits.health).toBe(2000);
    expect(edited.months['2026-11'].limits.food).toBe(3200);
    expect(edited.months['2026-11'].limits.auto).toBe(1500);
    expect(edited.months['2026-11'].fundPlan.f_home).toBe(0);
    expect(edited.months[OCT].limits.health).toBe(1500);
  });

  it('закрытый месяц не редактируется и повторно не закрывается', () => {
    const again = reduceAll(closed, [
      { type: 'addTx', ym: OCT, tx: tx({ amount: 100, categoryId: 'food' }) },
      { type: 'setPlan', ym: OCT, limits: { food: 1 } },
      { type: 'closeMonth', ym: OCT, at: 'x' },
    ]);
    expect(again).toEqual(closed);
  });
});

describe('Доход после распределения', () => {
  it('новое поступление видно как неразнесённая разница', () => {
    const s = reduceAll(buildSeed(), [
      { type: 'distribute', ym: OCT },
      { type: 'addIncome', ym: OCT, income: { id: 'kpi', date: '2026-10-20', amount: 3000, label: 'KPI', routing: 'savings' } },
    ]);
    expect(undistributedDiff(s.months[OCT])).toBe(3000);
    const fixed = reduce(s, { type: 'distributeDiff', ym: OCT });
    expect(fixed.mainAccount).toBe(10812 + 3000);
    expect(undistributedDiff(fixed.months[OCT])).toBe(0);
  });

  it('поднятый после распределения лимит забирает деньги с основного счёта', () => {
    const s = reduceAll(buildSeed(), [
      { type: 'distribute', ym: OCT },
      { type: 'setPlan', ym: OCT, limits: { food: 4000 } },
      { type: 'distributeDiff', ym: OCT },
    ]);
    expect(s.mainAccount).toBe(10812 - 500);
  });
});

describe('Навигация по месяцам (§4.8, приёмка 3)', () => {
  it('доступны существующие месяцы и один следующий, пустые не создаются', () => {
    const s = buildSeed();
    expect(navigableYms(s)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(Object.keys(s.months)).toEqual(['2026-09', '2026-10']);
  });
});

describe('Полоса темпа (§5.1)', () => {
  const s = buildSeed();
  const plan = planTotal(s.months[OCT]);
  const withSpent = (amount: number) =>
    reduce(s, { type: 'addTx', ym: OCT, tx: tx({ amount, categoryId: 'var' }) }).months[OCT];

  it('совпадает с календарём', () => {
    const p = pace(withSpent(Math.round(plan * 0.5)), '2026-10-15');
    expect(p.status).toBe('even');
    expect(p.day).toBe(15);
    expect(p.days).toBe(31);
  });

  it('быстрее календаря — с прогнозом перерасхода', () => {
    const p = pace(withSpent(Math.round(plan * 0.6)), '2026-10-10');
    expect(p.status).toBe('fast');
    expect(p.diffPct).toBe(28);
    // 10 380 / (10/31) − 17 300 ≈ 14 878 → около 14 880
    expect(p.forecastOver).toBe(14880);
  });

  it('медленнее календаря', () => {
    expect(pace(withSpent(1000), '2026-10-20').status).toBe('slow');
  });

  it('без плана нет деления на ноль', () => {
    const f = freshState('2026-10-03');
    expect(pace(f.months[OCT], '2026-10-03').status).toBe('noplan');
  });
});

describe('Частые категории', () => {
  it('сначала 4 самые частые, системных нет', () => {
    const order = orderedCategories(buildSeed());
    expect(order.slice(0, 4)).toEqual(['var', 'fam', 'food', 'auto']);
    expect(order).toHaveLength(8);
    expect(order.some((c) => c.startsWith('unacc'))).toBe(false);
  });
});

describe('Экспорт и импорт (приёмка 2)', () => {
  it('импорт экспортированного JSON полностью восстанавливает состояние', () => {
    const s = reduceAll(buildSeed(), [
      { type: 'distribute', ym: OCT },
      { type: 'addTx', ym: OCT, tx: tx({ amount: 4000, categoryId: 'food', fromMain: 500, fundId: undefined }) },
    ]);
    const parsed = parseStateJson(JSON.stringify(s));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.state).toEqual(JSON.parse(JSON.stringify(s)));
  });

  it('отклоняет чужие и битые файлы', () => {
    expect(parseStateJson('не json').ok).toBe(false);
    expect(parseStateJson('{"version":1}').ok).toBe(false);
    const bad = JSON.parse(JSON.stringify(buildSeed()));
    bad.months['2026-10'].txs.push({ id: 'x', date: '2026-10-01', amount: -5, categoryId: 'food', note: '', payment: 'cash', fromMain: 0, createdAt: '' });
    const r = parseStateJson(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('amount');
    const badCat = JSON.parse(JSON.stringify(buildSeed()));
    badCat.months['2026-10'].txs.push({ id: 'y', date: '2026-10-01', amount: 5, categoryId: 'casino', note: '', payment: 'cash', fromMain: 0, createdAt: '' });
    expect(parseStateJson(JSON.stringify(badCat)).ok).toBe(false);
  });

  it('стартовые данные проходят проверку', () => {
    expect(() => parseState(buildSeed())).not.toThrow();
  });
});

describe('Действия можно переиграть повторно (синхронизация)', () => {
  it('повтор того же действия не дублирует трату', () => {
    const t = tx({ amount: 500, categoryId: 'food' });
    const a: Action = { type: 'addTx', ym: OCT, tx: t };
    const s = reduceAll(buildSeed(), [a, a]);
    expect(s.months[OCT].txs).toHaveLength(1);
  });
});

describe('Форматирование', () => {
  it('минус и неразрывные пробелы', () => {
    expect(money(-13528)).toBe('−13 528 смн');
    expect(money(6256)).toBe('6 256 смн');
  });
});
