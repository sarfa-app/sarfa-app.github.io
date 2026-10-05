import { useState } from 'react';
import {
  blockLimit,
  blockSpent,
  distributionDelta,
  fromMainByCategory,
  incomeToBlocks,
  incomeToSavings,
  limitOf,
  mainNow,
  mainProjected,
  pace,
  planShortfall,
  planTotal,
  smallFromMain,
  spentByCategory,
  spentTotal,
  takenFromMain,
  undistributedDiff,
  type Pace,
} from '../domain/calc';
import { BLOCKS, categoriesOfBlock, FUNDS } from '../domain/constants';
import { dayMonth, monthGen, monthName, monthTitle } from '../domain/dates';
import { money, num, signedMoney } from '../domain/format';
import { openMonth } from '../domain/months';
import type { BlockId, Month } from '../domain/types';
import { Bar, Confirm, Money, toneOf, toneText } from '../ui/bits';
import { useApp } from '../ui/context';
import { MonthNav } from '../ui/MonthNav';
import { CloseMonthSheet } from '../sheets/CloseMonthSheet';
import { FundSpendSheet } from '../sheets/FundSpendSheet';
import { ReconcileSheet } from '../sheets/ReconcileSheet';

const BLOCK_BAR: Record<BlockId, string> = { ob: 'border-b-ob', fam: 'border-b-fam', var: 'border-b-var' };

export function MonthScreen({
  ym,
  setYm,
  onOpenCategory,
  onOpenSettings,
}: {
  ym: string;
  setYm: (ym: string) => void;
  onOpenCategory: (cat: string) => void;
  onOpenSettings: () => void;
}) {
  const { state } = useApp();
  const m = state.months[ym];
  const open = openMonth(state);

  return (
    <main className="screen">
      <MonthNav ym={ym} setYm={setYm} suffix={m?.closed ? 'закрыт' : undefined} />
      {!m ? (
        <FutureMonth ym={ym} openYm={open?.ym} onBack={() => open && setYm(open.ym)} />
      ) : (
        <MonthBody key={ym} m={m} onOpenCategory={onOpenCategory} onOpenSettings={onOpenSettings} onMonthClosed={setYm} />
      )}
    </main>
  );
}

function FutureMonth({ ym, openYm, onBack }: { ym: string; openYm?: string; onBack: () => void }) {
  return (
    <section className="mt-6 bg-card px-4 py-6">
      <h2 className="text-lg font-semibold">{monthTitle(ym)} ещё не начат</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-soft">
        {openYm
          ? `Он откроется, когда вы закроете ${monthName(openYm)}: лимиты перенесутся, и их можно будет поменять.`
          : 'Он откроется после закрытия текущего месяца.'}
      </p>
      {openYm && (
        <button type="button" className="btn-quiet mt-4" onClick={onBack}>
          Вернуться в {monthName(openYm)}
        </button>
      )}
    </section>
  );
}

function MonthBody({
  m,
  onOpenCategory,
  onOpenSettings,
  onMonthClosed,
}: {
  m: Month;
  onOpenCategory: (cat: string) => void;
  onOpenSettings: () => void;
  onMonthClosed: (nextYm: string) => void;
}) {
  const { state, dispatch, today } = useApp();
  const [sheet, setSheet] = useState<null | 'reconcile' | 'close' | 'distribute' | { fund: string }>(null);
  const plan = planTotal(m);
  const spent = spentTotal(m);
  const p = pace(m, today);
  const isOpen = !m.closed;

  return (
    <>
      {/* Главный элемент: остаток по плану и полоса темпа */}
      <section className="bg-card px-4 pb-4 pt-3" aria-labelledby="hero-title">
        <h2 id="hero-title" className="text-[15px] text-soft">
          Осталось по плану
        </h2>
        <p
          className={`mt-0.5 font-bold leading-none tracking-tight ${plan - spent < 0 ? 'text-over' : 'text-ink'}`}
          style={{ fontSize: 'clamp(30px, 10.5vw, 48px)' }}
        >
          {num(plan - spent)}
          <span className="ml-1.5 text-[0.5em] font-semibold text-soft">смн</span>
        </p>
        <p className="mt-1.5 text-[15px] text-soft">
          потрачено <Money value={spent} className="text-ink" /> из <Money value={plan} className="text-ink" />
        </p>
        <PaceBar p={p} />
        <PaceVerdict p={p} spent={spent} plan={plan} />
      </section>

      {isOpen && !m.distributed && <DistributeBanner m={m} onDistribute={() => setSheet('distribute')} onOpenSettings={onOpenSettings} />}
      {isOpen && m.distributed && undistributedDiff(m) !== 0 && (
        <section className="mt-3 border-l-4 border-warn bg-card px-4 py-3" aria-label="Доход изменился после распределения">
          <h2 className="font-semibold">Доход или план изменились после распределения</h2>
          <p className="mt-1 text-[15px] text-soft">
            Не разнесено на основной счёт: <Money value={undistributedDiff(m)} signed className="font-semibold text-ink" />
          </p>
          <button type="button" className="btn-primary mt-3 w-full" onClick={() => dispatch({ type: 'distributeDiff', ym: m.ym })}>
            Разнести разницу
          </button>
        </section>
      )}

      {BLOCKS.map((b) => (
        <BlockSection key={b.id} m={m} block={b.id} name={b.name} onOpenCategory={onOpenCategory} />
      ))}

      <section className="mt-3 border-l-4 border-b-fund bg-card" aria-labelledby="funds-title">
        <h2 id="funds-title" className="px-4 pb-1 pt-3 text-[17px] font-semibold">
          Фонды
        </h2>
        <ul>
          {FUNDS.map((f) => {
            const bal = state.fundBalances[f.id] ?? 0;
            const plan = m.fundPlan[f.id] ?? 0;
            return (
              <li key={f.id} className="border-t border-rule px-4 py-2.5 first:border-t-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-[15px]">{f.name}</span>
                  <Money value={bal} className={`font-semibold ${bal < 0 ? 'text-over' : ''}`} />
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-sm text-soft">
                    {isOpen && plan > 0 ? (
                      <>
                        +<Money value={plan} /> в этом месяце
                      </>
                    ) : (
                      'накоплено'
                    )}
                  </span>
                  {isOpen && (
                    <button type="button" className="btn-quiet h-11 shrink-0 px-3 text-sm" onClick={() => setSheet({ fund: f.id })}>
                      Потратить из фонда
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {isOpen ? <Accounts m={m} /> : <ClosedNote m={m} />}

      {isOpen && (
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" className="btn-quiet w-full" onClick={() => setSheet('reconcile')}>
            Сверить наличку по блокам
          </button>
          {!m.distributed && (
            <button type="button" className="btn-quiet w-full" onClick={() => setSheet('distribute')}>
              Распределить доход
            </button>
          )}
          <button type="button" className="btn-quiet w-full" onClick={() => setSheet('close')}>
            Закрыть месяц
          </button>
        </div>
      )}

      {sheet === 'reconcile' && <ReconcileSheet m={m} onClose={() => setSheet(null)} />}
      {sheet === 'close' && (
        <CloseMonthSheet
          m={m}
          onClose={() => setSheet(null)}
          onClosed={(nextYm) => {
            onMonthClosed(nextYm);
          }}
        />
      )}
      {sheet === 'distribute' && (
        <Confirm
          title="Распределить доход"
          confirmLabel="Распределить"
          onCancel={() => setSheet(null)}
          onConfirm={() => {
            dispatch({ type: 'distribute', ym: m.ym });
            setSheet(null);
          }}
        >
          <p>
            Основной счёт: <Money value={state.mainAccount} className="font-semibold" /> →{' '}
            <Money value={state.mainAccount + distributionDelta(m)} className="font-semibold" />
          </p>
          <p className="mt-2 text-soft">
            Доход в конверты <Money value={incomeToBlocks(m)} /> минус план <Money value={planTotal(m)} />
            {incomeToSavings(m) > 0 && (
              <>
                {' '}
                плюс сразу в накопления <Money value={incomeToSavings(m)} />
              </>
            )}
            . Делается один раз за месяц.
          </p>
        </Confirm>
      )}
      {sheet && typeof sheet === 'object' && <FundSpendSheet fundId={sheet.fund} m={m} onClose={() => setSheet(null)} />}
    </>
  );
}

function PaceBar({ p }: { p: Pace }) {
  const fillPct = Math.min(1, p.fill) * 100;
  const tickPct = p.tick * 100;
  const color = p.fill > 1 || p.status === 'fast' ? 'bg-over' : 'bg-ok';
  const label = `Потрачено ${Math.round(p.fill * 100)}% плана, прошло ${Math.round(p.tick * 100)}% месяца`;
  return (
    <div className="relative mb-1 mt-4 pb-6" role="img" aria-label={label}>
      <div className="h-3 w-full overflow-hidden rounded-full bg-track">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${fillPct}%` }} />
      </div>
      {p.status !== 'closed' && p.status !== 'noplan' && p.status !== 'before' && (
        <>
          <div className="absolute -top-1.5 h-6 w-[3px] -translate-x-1/2 rounded-full bg-ink ring-2 ring-card" style={{ left: `${tickPct}%` }} aria-hidden="true" />
          <div
            className="absolute top-5 whitespace-nowrap text-[13px] text-soft"
            style={{ left: `${tickPct}%`, transform: `translateX(${tickPct > 80 ? '-100%' : tickPct < 20 ? '0' : '-50%'})` }}
            aria-hidden="true"
          >
            сегодня
          </div>
        </>
      )}
    </div>
  );
}

function PaceVerdict({ p, spent, plan }: { p: Pace; spent: number; plan: number }) {
  let text: string;
  let cls = 'text-ink';
  switch (p.status) {
    case 'fast':
      text = `Тратишь быстрее календаря на ${p.diffPct}%. При таком темпе месяц закончится перерасходом около ${money(p.forecastOver)}`;
      cls = 'text-over';
      break;
    case 'slow':
      text = `Идёшь медленнее календаря на ${p.diffPct}%. Запас есть`;
      cls = 'text-ok';
      break;
    case 'even':
      text = `Темп совпадает с календарём. День ${p.day} из ${p.days}`;
      break;
    case 'noplan':
      text = 'Лимиты на месяц не заданы — задайте их в Настройках';
      cls = 'text-warn-ink';
      break;
    case 'before':
      text = 'Месяц ещё не начался';
      break;
    case 'closed':
      text = spent > plan ? `Месяц закрыт с перерасходом ${money(spent - plan)}` : `Месяц закрыт. Не потрачено ${money(plan - spent)}`;
      cls = spent > plan ? 'text-over' : 'text-ok';
      break;
  }
  return <p className={`text-[16px] font-medium leading-snug ${cls}`}>{text}</p>;
}

function DistributeBanner({ m, onDistribute, onOpenSettings }: { m: Month; onDistribute: () => void; onOpenSettings: () => void }) {
  const toBlocks = incomeToBlocks(m);
  const shortfall = planShortfall(m);
  const delta = distributionDelta(m);
  const empty = m.incomes.length === 0;
  return (
    <section className="mt-3 border-l-4 border-warn bg-card px-4 py-3" aria-labelledby="dist-title">
      <h2 id="dist-title" className="font-semibold">
        Доход ещё не распределён
      </h2>
      {empty ? (
        <>
          <p className="mt-1 text-[15px] text-soft">Добавьте поступления этого месяца — зарплату, KPI, отпускные.</p>
          <button type="button" className="btn-quiet mt-3 w-full" onClick={onOpenSettings}>
            Добавить доход
          </button>
        </>
      ) : (
        <>
          <div className="mt-1 text-[15px]">
            <div className="flex justify-between py-0.5">
              <span className="text-soft">Доход в конверты</span>
              <Money value={toBlocks} />
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-soft">План месяца</span>
              <Money value={planTotal(m)} />
            </div>
            {incomeToSavings(m) > 0 && (
              <div className="flex justify-between py-0.5">
                <span className="text-soft">Сразу в накопления</span>
                <Money value={incomeToSavings(m)} />
              </div>
            )}
            <div className="flex justify-between py-0.5 font-semibold">
              <span>На основной счёт</span>
              <span className={`num ${delta < 0 ? 'text-over' : ''}`}>{signedMoney(delta)}</span>
            </div>
            {shortfall > 0 && (
              <p className="mt-1 font-medium text-over">Дохода не хватает на план: {money(shortfall)}</p>
            )}
          </div>
          <button type="button" className="btn-primary mt-3 w-full" onClick={onDistribute}>
            Распределить доход
          </button>
        </>
      )}
    </section>
  );
}

function BlockSection({ m, block, name, onOpenCategory }: { m: Month; block: BlockId; name: string; onOpenCategory: (c: string) => void }) {
  const limit = blockLimit(m, block);
  const spent = blockSpent(m, block);
  const cats = categoriesOfBlock(block).filter((c) => !c.system || spentByCategory(m, c.id) > 0);
  const tone = toneOf(spent, limit);
  return (
    <section className={`mt-3 border-l-4 bg-card ${BLOCK_BAR[block]}`} aria-labelledby={`block-${block}`}>
      <div className="flex items-baseline justify-between gap-3 px-4 pb-1 pt-3">
        <h2 id={`block-${block}`} className="text-[17px] font-semibold">
          {name}
        </h2>
        <span className="num text-[15px]">
          <span className={tone === 'over' ? 'font-semibold text-over' : 'font-semibold'}>{num(spent)}</span>
          <span className="text-soft"> / {money(limit)}</span>
        </span>
      </div>
      <ul>
        {cats.map((c) => {
          const s = spentByCategory(m, c.id);
          const l = limitOf(m, c.id);
          const fm = fromMainByCategory(m, c.id);
          const t = toneOf(s, l);
          const rest = l - s;
          return (
            <li key={c.id} className="border-t border-rule first:border-t-0">
              <button type="button" className="block w-full px-4 py-2.5 text-left active:bg-paper" onClick={() => onOpenCategory(c.id)}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`min-w-0 text-[15px] ${c.system ? 'font-medium text-over' : ''}`}>{c.name}</span>
                  <span className="num shrink-0 text-[15px]">
                    <span className={t === 'over' ? 'font-semibold text-over' : ''}>{num(s)}</span>
                    <span className="text-soft"> / {num(l)}</span>
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar ratio={l > 0 ? s / l : s > 0 ? 2 : 0} tone={t} label={`${c.name}: потрачено ${num(s)} из ${num(l)}`} />
                </div>
                <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-sm">
                  <span className={rest < 0 ? `font-medium ${toneText.over}` : 'text-soft'}>
                    {rest < 0 ? `перерасход ${money(-rest)}` : `осталось ${money(rest)}`}
                  </span>
                  {fm > 0 && <span className="font-medium text-warn-ink">добрано с основного счёта: {money(fm)}</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Accounts({ m }: { m: Month }) {
  const { state } = useApp();
  const now = mainNow(state, m);
  const projected = mainProjected(state, m);
  const taken = takenFromMain(m);
  const small = smallFromMain(m, state.settings.bigFromMainThreshold);
  return (
    <section className="mt-3 bg-card px-4 py-2" aria-labelledby="acc-title">
      <h2 id="acc-title" className="pb-1 pt-1 text-[17px] font-semibold">
        Счета
      </h2>
      <div className="flex items-baseline justify-between gap-3 py-2">
        <span>Основной счёт сейчас</span>
        <Money value={now} className={`text-[17px] font-semibold ${now < 0 ? 'text-over' : ''}`} />
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-rule py-2">
        <div>
          <div>Станет к концу месяца</div>
          <div className="text-sm text-soft">прогноз — если конверты не доесть</div>
        </div>
        <Money value={projected} className="text-soft" />
      </div>
      {taken > 0 && (
        <div className="border-t border-rule py-2">
          <div className="flex items-baseline justify-between gap-3">
            <span>Взято с основного счёта</span>
            <Money value={taken} />
          </div>
          {small.count > 0 && (
            <p className="mt-0.5 text-sm font-medium text-warn-ink">
              Против правила «от {money(state.settings.bigFromMainThreshold)}»: {small.count} на {money(small.total)}
            </p>
          )}
        </div>
      )}
      <div className="flex items-baseline justify-between gap-3 border-t border-rule py-2">
        <span>Мне должны</span>
        <Money value={state.receivables} />
      </div>
    </section>
  );
}

function ClosedNote({ m }: { m: Month }) {
  const closedDay = m.closedAt && /^\d{4}-\d{2}-\d{2}/.test(m.closedAt) ? m.closedAt.slice(0, 10) : undefined;
  return (
    <section className="mt-3 bg-card px-4 py-3 text-[15px] text-soft">
      Месяц закрыт{closedDay ? ` ${dayMonth(closedDay)}` : ''}. Траты {monthGen(m.ym)} можно смотреть, но не менять — остатки уже
      перенесены на основной счёт.
    </section>
  );
}
