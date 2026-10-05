import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { monthShort, monthTitle } from '../domain/dates';
import { money, num, percent } from '../domain/format';
import { famAverage, famRows, historyRows, historySummary, type HistoryRow } from '../domain/history';
import { openMonth } from '../domain/months';
import { useApp } from '../ui/context';
import { SyncBadge } from '../ui/SyncBadge';

export function HistoryScreen() {
  const { state, today } = useApp();
  const rows = historyRows(state);
  const sum = historySummary(rows);
  const year = (openMonth(state)?.ym ?? today).slice(0, 4);
  const fam = famRows(state, year);
  const famAvg = famAverage(fam);

  return (
    <main className="screen">
      <header className="flex items-center justify-between pb-2">
        <h1 className="text-[22px] font-bold">История</h1>
        <SyncBadge />
      </header>

      {rows.length === 0 ? (
        <p className="mt-4 bg-card px-4 py-6 text-soft">
          Здесь появятся итоги месяцев, когда вы закроете первый. Итоги из заметок можно загрузить через импорт в Настройках.
        </p>
      ) : (
        <>
          <section className="bg-card px-4 pb-3 pt-3" aria-labelledby="chart-title">
            <h2 id="chart-title" className="text-[17px] font-semibold">
              Сальдо и расход по месяцам
            </h2>
            <p className="text-sm text-soft">Одна шкала для дохода, расхода и сальдо</p>
            <Chart rows={rows} />
          </section>

          <section className="mt-3 bg-card px-4 py-2" aria-labelledby="sum-title">
            <h2 id="sum-title" className="py-1 text-[17px] font-semibold">
              Сводка за {rows.length} мес.
            </h2>
            <dl className="text-[15px]">
              <SumRow k="Доход всего" v={money(sum.income)} />
              <SumRow k="Расход всего" v={money(sum.expense)} />
              <SumRow k={sum.saved >= 0 ? 'Накоплено' : 'Проедено'} v={money(sum.saved)} tone={sum.saved < 0 ? 'over' : undefined} />
              <SumRow k="Норма сбережений" v={percent(sum.rate)} />
              <SumRow
                k="Месяцев в минусе"
                v={`${sum.minusMonths} из ${sum.months}`}
                tone={sum.minusMonths > sum.months / 3 ? 'over' : undefined}
              />
            </dl>
            {sum.hasIncomplete && <p className="pb-2 text-sm text-soft">С учётом месяцев с неполными данными (*) — см. сноску ниже.</p>}
          </section>

          {fam.length > 0 && (
            <section className="mt-3 border-l-4 border-b-fam bg-card px-4 py-2" aria-labelledby="fam-title">
              <h2 id="fam-title" className="py-1 text-[17px] font-semibold">
                Помощь родне в {year}
              </h2>
              <table className="num w-full text-[15px]">
                <thead>
                  <tr className="text-left text-sm text-soft">
                    <th className="py-1.5 font-medium">Месяц</th>
                    <th className="py-1.5 text-right font-medium">Сумма</th>
                    <th className="py-1.5 text-right font-medium">Лимит</th>
                    <th className="py-1.5 text-right font-medium">Откл.</th>
                  </tr>
                </thead>
                <tbody>
                  {fam.map((r) => (
                    <tr key={r.ym} className="border-t border-rule">
                      <td className="py-1.5">{monthShort(r.ym, false)}</td>
                      <td className="py-1.5 text-right">{num(r.help)}</td>
                      <td className="py-1.5 text-right text-soft">{num(r.limit)}</td>
                      <td className={`py-1.5 text-right font-medium ${r.deviation > 0 ? 'text-over' : 'text-ok'}`}>
                        {r.deviation > 0 ? '+' : ''}
                        {num(r.deviation)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-ink font-semibold">
                    <td className="py-2">Среднее</td>
                    <td className="py-2 text-right">{num(famAvg)}</td>
                    <td />
                    <td />
                  </tr>
                </tfoot>
              </table>
            </section>
          )}

          <section className="mt-3 bg-card px-4 py-2" aria-labelledby="table-title">
            <h2 id="table-title" className="py-1 text-[17px] font-semibold">
              По месяцам
            </h2>
            <table className="num w-full text-[15px]">
              <thead>
                <tr className="text-left text-sm text-soft">
                  <th className="py-1.5 font-medium">Месяц</th>
                  <th className="py-1.5 text-right font-medium">Доход</th>
                  <th className="py-1.5 text-right font-medium">Расход</th>
                  <th className="py-1.5 text-right font-medium">Сальдо</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.ym} className="border-t border-rule">
                    <td className="whitespace-nowrap py-1.5">
                      {monthShort(r.ym)}
                      {r.incomplete && <span aria-label="данные неполные">*</span>}
                    </td>
                    <td className="py-1.5 text-right">{num(r.income)}</td>
                    <td className="py-1.5 text-right">{num(r.expense)}</td>
                    <td className={`py-1.5 text-right font-medium ${r.balance < 0 ? 'text-over' : 'text-ok'}`}>
                      {r.balance > 0 ? '+' : ''}
                      {num(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sum.hasIncomplete && (
              <p className="border-t border-rule py-2 text-sm leading-relaxed text-soft">
                * Данные неполные: расход в эти месяцы занижен, поэтому накопления по сводке выглядят больше реальных.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function SumRow({ k, v, tone }: { k: string; v: string; tone?: 'over' }) {
  return (
    <div className="flex justify-between gap-3 border-t border-rule py-2 first:border-t-0">
      <dt>{k}</dt>
      <dd className={`num font-semibold ${tone === 'over' ? 'text-over' : ''}`}>{v}</dd>
    </div>
  );
}

// ---------- График ----------

const BAR = '#7D8D95';
const BAR_INCOMPLETE = '#C3CCD1';

function Chart({ rows }: { rows: HistoryRow[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(340);
  const [sel, setSel] = useState(rows.length - 1);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setW(Math.max(260, el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setSel(rows.length - 1), [rows.length]);

  const n = rows.length;
  const maxBal = Math.max(0, ...rows.map((r) => r.balance));
  const minBal = Math.min(0, ...rows.map((r) => r.balance));
  const maxVal = Math.max(1, ...rows.map((r) => Math.max(r.expense, r.income)));
  const PLOT = 250; // высота обеих панелей вместе, px
  const GAP = 18;
  const k = (PLOT - GAP) / (maxBal - minBal + maxVal); // одна шкала: px на сомони
  const topH = (maxBal - minBal) * k;
  const botH = maxVal * k;
  const padL = 4;
  const padR = 4;
  const step = (w - padL - padR) / n;
  const x = (i: number) => padL + step * i + step / 2;
  const yBal = (v: number) => (maxBal - v) * k;
  const y0 = yBal(0);
  const botTop = topH + GAP;
  const yBot = (v: number) => botTop + botH - v * k;
  const barW = Math.max(3, Math.min(18, step - 2));
  const labelEvery = n > 16 ? 4 : n > 8 ? 2 : 1;
  const H = botTop + botH + 22;
  const s = rows[sel] ?? rows[n - 1];

  const path = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yBal(r.balance).toFixed(1)}`).join(' ');

  return (
    <div className="mt-2">
      {/* Подробности выбранного месяца: тап по столбцу или стрелки */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[15px]" aria-live="polite">
        <span className="font-semibold">
          {monthTitle(s.ym)}
          {s.incomplete ? '*' : ''}
        </span>
        <span className="num text-soft">
          доход <span className="text-ink">{num(s.income)}</span>
        </span>
        <span className="num text-soft">
          расход <span className="text-ink">{num(s.expense)}</span>
        </span>
        <span className={`num font-semibold ${s.balance < 0 ? 'text-over' : 'text-ok'}`}>
          {s.balance > 0 ? '+' : ''}
          {num(s.balance)}
        </span>
      </div>

      <div
        ref={box}
        className="mt-2 rounded-md"
        tabIndex={0}
        role="group"
        aria-label="График по месяцам. Стрелки влево и вправо — выбор месяца"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setSel((v) => Math.max(0, v - 1));
          if (e.key === 'ArrowRight') setSel((v) => Math.min(n - 1, v + 1));
        }}
      >
        <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden="true" className="block">
          {/* выбранный столбец */}
          <rect x={x(sel) - step / 2} y={0} width={step} height={botTop + botH} fill="#EDEFF1" />
          {/* верхняя панель: сальдо */}
          <line x1={0} x2={w} y1={y0} y2={y0} stroke="#16252C" strokeWidth={1} />
          <text x={w - 2} y={y0 - 4} textAnchor="end" fontSize={11} fill="#53656E">
            0
          </text>
          <path d={path} fill="none" stroke="#16252C" strokeWidth={2} strokeLinejoin="round" />
          {rows.map((r, i) => (
            <circle key={r.ym} cx={x(i)} cy={yBal(r.balance)} r={i === sel ? 5 : 3.5} fill={r.balance < 0 ? '#A63A2C' : '#2F6F58'} stroke="#fff" strokeWidth={2} />
          ))}
          {/* нижняя панель: расход столбцами, доход — риской */}
          <line x1={0} x2={w} y1={botTop + botH} y2={botTop + botH} stroke="#D5DBDE" strokeWidth={1} />
          {rows.map((r, i) => {
            const h = r.expense * k;
            return (
              <g key={r.ym}>
                <path
                  d={roundedTop(x(i) - barW / 2, yBot(r.expense), barW, h, Math.min(3, barW / 2))}
                  fill={r.incomplete ? BAR_INCOMPLETE : r.expense > r.income ? '#A63A2C' : BAR}
                />
                <line x1={x(i) - barW / 2 - 2} x2={x(i) + barW / 2 + 2} y1={yBot(r.income)} y2={yBot(r.income)} stroke="#16252C" strokeWidth={2} />
                {r.incomplete && (
                  <text x={x(i)} y={yBot(Math.max(r.expense, r.income)) - 4} textAnchor="middle" fontSize={12} fill="#53656E">
                    *
                  </text>
                )}
                {(i % labelEvery === 0 || i === n - 1) && (n - 1 - i >= labelEvery / 2 || i === n - 1) && (
                  <text
                    x={i === 0 ? x(i) - barW / 2 : i === n - 1 ? x(i) + barW / 2 : x(i)}
                    y={H - 6}
                    textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
                    fontSize={11}
                    fill="#53656E"
                  >
                    {monthShort(r.ym, false)}
                    {r.ym.endsWith('-01') || i === 0 ? ` ${r.ym.slice(2, 4)}` : ''}
                  </text>
                )}
              </g>
            );
          })}
          {/* зоны нажатия во всю высоту столбца */}
          {rows.map((r, i) => (
            <rect key={r.ym} x={x(i) - step / 2} y={0} width={step} height={H} fill="transparent" onClick={() => setSel(i)} style={{ cursor: 'pointer' }} />
          ))}
        </svg>
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-soft" aria-label="Легенда">
        <li className="flex items-center gap-1.5">
          <svg width="18" height="10" aria-hidden="true">
            <line x1="0" x2="18" y1="5" y2="5" stroke="#16252C" strokeWidth="2" />
            <circle cx="9" cy="5" r="3" fill="#2F6F58" />
          </svg>
          сальдо (доход − расход)
        </li>
        <li className="flex items-center gap-1.5">
          <svg width="10" height="12" aria-hidden="true">
            <rect width="10" height="12" rx="2" fill={BAR} />
          </svg>
          расход
        </li>
        <li className="flex items-center gap-1.5">
          <svg width="14" height="10" aria-hidden="true">
            <line x1="0" x2="14" y1="5" y2="5" stroke="#16252C" strokeWidth="2" />
          </svg>
          доход
        </li>
        <li className="flex items-center gap-1.5">
          <svg width="10" height="12" aria-hidden="true">
            <rect width="10" height="12" rx="2" fill="#A63A2C" />
          </svg>
          расход больше дохода
        </li>
      </ul>
    </div>
  );
}

/** Столбец со скруглёнными верхними углами, низ на базовой линии. */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return '';
  const rr = Math.min(r, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}
