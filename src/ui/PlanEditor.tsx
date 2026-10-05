import { BLOCKS, categoriesOfBlock, FUNDS } from '../domain/constants';
import { money } from '../domain/format';
import { AmountField, Money } from './bits';

const BLOCK_BAR: Record<string, string> = { ob: 'border-b-ob', fam: 'border-b-fam', var: 'border-b-var' };

export interface Plan {
  limits: Record<string, number>;
  fundPlan: Record<string, number>;
}

export function planSums(p: Plan) {
  const limits = Object.entries(p.limits).reduce((a, [, v]) => a + (v || 0), 0);
  const funds = FUNDS.reduce((a, f) => a + (p.fundPlan[f.id] || 0), 0);
  return { limits, funds, total: limits + funds };
}

/** Лимиты конвертов и план по фондам. prev — значения прошлого месяца для сравнения. */
export function PlanEditor({
  value,
  onChange,
  prev,
  income,
}: {
  value: Plan;
  onChange: (p: Plan) => void;
  prev?: Plan;
  /** доход «в конверты», чтобы показать, хватает ли его на план */
  income?: number;
}) {
  const sums = planSums(value);
  const setLimit = (id: string, v: number) => onChange({ ...value, limits: { ...value.limits, [id]: v } });
  const setFund = (id: string, v: number) => onChange({ ...value, fundPlan: { ...value.fundPlan, [id]: v } });

  const was = (cur: number, before: number | undefined) =>
    prev && before !== undefined && before !== cur ? `было ${money(before)}` : undefined;

  return (
    <div className="flex flex-col gap-5">
      {BLOCKS.map((b) => (
        <fieldset key={b.id} className={`border-l-4 pl-3 ${BLOCK_BAR[b.id]}`}>
          <legend className="mb-2 text-[15px] font-semibold">{b.name}</legend>
          <div className="flex flex-col gap-3">
            {categoriesOfBlock(b.id)
              .filter((c) => !c.system)
              .map((c) => (
                <AmountField
                  key={c.id}
                  label={c.name}
                  value={value.limits[c.id] ?? 0}
                  onChange={(v) => setLimit(c.id, v)}
                  hint={was(value.limits[c.id] ?? 0, prev?.limits[c.id])}
                />
              ))}
          </div>
        </fieldset>
      ))}
      <fieldset className="border-l-4 border-b-fund pl-3">
        <legend className="mb-2 text-[15px] font-semibold">Фонды — отложить в этом месяце</legend>
        <div className="flex flex-col gap-3">
          {FUNDS.map((f) => (
            <AmountField
              key={f.id}
              label={f.name}
              value={value.fundPlan[f.id] ?? 0}
              onChange={(v) => setFund(f.id, v)}
              hint={was(value.fundPlan[f.id] ?? 0, prev?.fundPlan[f.id])}
            />
          ))}
        </div>
      </fieldset>

      <div className="rounded-lg bg-paper px-3 py-2 text-[15px]">
        <div className="flex justify-between py-0.5">
          <span>Лимиты конвертов</span>
          <Money value={sums.limits} />
        </div>
        <div className="flex justify-between py-0.5">
          <span>Фонды</span>
          <Money value={sums.funds} />
        </div>
        <div className="flex justify-between py-0.5 font-semibold">
          <span>План месяца</span>
          <Money value={sums.total} />
        </div>
        {income !== undefined && income > 0 && (
          <div className={`flex justify-between py-0.5 ${income < sums.total ? 'text-over' : 'text-ok'}`}>
            <span>{income < sums.total ? 'Дохода не хватает на план' : 'Останется на основной счёт'}</span>
            <Money value={Math.abs(income - sums.total)} />
          </div>
        )}
      </div>
    </div>
  );
}
