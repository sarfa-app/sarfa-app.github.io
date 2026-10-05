import { useState } from 'react';
import { distributionDelta, mainNow, planTotal, spentTotal, takenFromMain, unspentEnvelopes } from '../domain/calc';
import { FUNDS } from '../domain/constants';
import { addMonths, monthName, monthTitle } from '../domain/dates';
import { money } from '../domain/format';
import type { Month } from '../domain/types';
import { Money } from '../ui/bits';
import { useApp } from '../ui/context';
import { PlanEditor, type Plan } from '../ui/PlanEditor';
import { Sheet } from '../ui/Sheet';

/**
 * §4.7: сводка → подтверждение → закрытие. Затем сразу экран лимитов нового месяца:
 * они скопированы из закрытого, и их можно поменять по каждому конверту.
 */
export function CloseMonthSheet({ m, onClose, onClosed }: { m: Month; onClose: () => void; onClosed: (nextYm: string) => void }) {
  const { state, dispatch } = useApp();
  const [step, setStep] = useState<'summary' | 'plan'>('summary');
  const nextYm = addMonths(m.ym, 1);
  const [plan, setPlan] = useState<Plan>({ limits: { ...m.limits }, fundPlan: { ...m.fundPlan } });
  const [prevPlan] = useState<Plan>({ limits: { ...m.limits }, fundPlan: { ...m.fundPlan } });

  if (step === 'plan') {
    const next = state.months[nextYm];
    return (
      <Sheet
        title={`Лимиты на ${monthName(nextYm)}`}
        onClose={() => {
          onClosed(nextYm);
          onClose();
        }}
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-quiet flex-1"
              onClick={() => {
                onClosed(nextYm);
                onClose();
              }}
            >
              Оставить как было
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => {
                dispatch({ type: 'setPlan', ym: nextYm, limits: plan.limits, fundPlan: plan.fundPlan });
                onClosed(nextYm);
                onClose();
              }}
            >
              Сохранить лимиты
            </button>
          </div>
        }
      >
        <p className="mb-4 text-[15px] leading-relaxed text-soft">
          {monthTitle(m.ym)} закрыт. Лимиты перенесены в {monthName(nextYm)} — поменяйте те, что не совпали с жизнью.
          {next && next.incomes.length === 0 && ' Доход нового месяца добавьте в Настройках, когда придёт.'}
        </p>
        <PlanEditor value={plan} onChange={setPlan} prev={prevPlan} />
      </Sheet>
    );
  }

  const plan0 = planTotal(m);
  const spent = spentTotal(m);
  const unspent = unspentEnvelopes(m);
  const taken = takenFromMain(m);
  const now = mainNow(state, m);
  const after = now + unspent;

  return (
    <Sheet
      title={`Закрыть ${monthName(m.ym)}?`}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn-primary h-12 w-full"
          onClick={() => {
            dispatch({ type: 'closeMonth', ym: m.ym, at: new Date().toISOString() });
            setStep('plan');
          }}
        >
          Закрыть {monthName(m.ym)}
        </button>
      }
    >
      {!m.distributed && (
        <div className="mb-4 border-l-4 border-warn bg-[#FBF4EA] px-3 py-2 text-[15px]" role="note">
          <p className="font-semibold">Доход месяца ещё не распределён</p>
          <p className="mt-0.5">
            Если закрыть сейчас, {money(distributionDelta(m))} не попадут на основной счёт.
          </p>
          <button type="button" className="btn-quiet mt-2 w-full" onClick={() => dispatch({ type: 'distribute', ym: m.ym })}>
            Сначала распределить
          </button>
        </div>
      )}
      <dl className="text-[15px]">
        <div className="flex justify-between gap-3 py-1.5">
          <dt>Потрачено</dt>
          <dd>
            <Money value={spent} /> из <Money value={plan0} />
          </dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-rule py-1.5">
          <dt>Остатки конвертов → на основной счёт</dt>
          <dd className="text-ok">
            <Money value={unspent} signed />
          </dd>
        </div>
        {taken > 0 && (
          <div className="flex justify-between gap-3 border-t border-rule py-1.5">
            <dt>Взято с основного счёта</dt>
            <dd>
              <Money value={-taken} />
            </dd>
          </div>
        )}
        {FUNDS.filter((f) => (m.fundPlan[f.id] ?? 0) > 0).map((f) => (
          <div key={f.id} className="flex justify-between gap-3 border-t border-rule py-1.5">
            <dt>Фонд «{f.name}»</dt>
            <dd className="whitespace-nowrap">
              <Money value={state.fundBalances[f.id] ?? 0} /> → <Money value={(state.fundBalances[f.id] ?? 0) + m.fundPlan[f.id]} />
            </dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-ink py-2 font-semibold">
          <dt>Основной счёт</dt>
          <dd className="whitespace-nowrap">
            <Money value={now} /> → <Money value={after} />
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-sm text-soft">
        Откроется {monthName(nextYm)} с теми же лимитами — на следующем шаге их можно поменять. Закрытый месяц потом не
        редактируется.
      </p>
    </Sheet>
  );
}
