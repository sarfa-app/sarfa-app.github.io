import { useRef, useState } from 'react';
import { FUNDS } from '../domain/constants';
import { monthName, monthPrep, ymOf } from '../domain/dates';
import { newId } from '../domain/ids';
import { freshState } from '../domain/initial';
import type { State } from '../domain/types';
import { parseStateJson } from '../domain/validate';
import { AmountField } from '../ui/bits';
import { Logo } from '../ui/Logo';
import { PlanEditor, type Plan } from '../ui/PlanEditor';

/** Первый вход: счета, доход и лимиты текущего месяца. Или восстановление из файла. */
export function SetupScreen({
  login,
  today,
  onDone,
  onLogout,
}: {
  login: string;
  today: string;
  onDone: (s: State) => void;
  onLogout: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [main, setMain] = useState(0);
  const [receivables, setReceivables] = useState(0);
  const [funds, setFunds] = useState<Record<string, number>>({});
  const [salary, setSalary] = useState(0);
  const [plan, setPlan] = useState<Plan>({ limits: {}, fundPlan: {} });
  const [importError, setImportError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const ym = ymOf(today);

  const finish = () => {
    const s = freshState(today, { mainAccount: main, receivables, fundBalances: funds, ...plan });
    if (salary > 0) {
      s.months[ym].incomes.push({ id: newId(), date: today, amount: salary, label: 'Зарплата', routing: 'blocks' });
    }
    onDone(s);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const r = parseStateJson(await f.text());
    if (r.ok) onDone(r.state);
    else setImportError(r.error);
  };

  return (
    <main className="screen mx-auto max-w-[560px] !pb-32">
      <header className="mb-6 flex items-center gap-3 pt-4">
        <Logo size={40} />
        <div className="flex-1">
          <h1 className="text-xl font-semibold leading-tight">Добро пожаловать, {login}</h1>
          <p className="text-soft">Шаг {step} из 2 · {step === 1 ? 'счета' : `план на ${monthName(ym)}`}</p>
        </div>
      </header>

      {step === 1 && (
        <div className="flex flex-col gap-5">
          <p className="text-[15px] leading-relaxed text-soft">
            Начнём с того, что есть прямо сейчас. Это реальные деньги, без прогнозов — потом всё можно поправить в
            Настройках.
          </p>
          <AmountField label="Основной (накопительный) счёт сейчас" value={main} onChange={setMain} allowNegative />
          <AmountField label="Мне должны" value={receivables} onChange={setReceivables} />
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-[15px] font-semibold">Уже накоплено в фондах</legend>
            {FUNDS.map((f) => (
              <AmountField key={f.id} label={f.name} value={funds[f.id] ?? 0} onChange={(v) => setFunds({ ...funds, [f.id]: v })} />
            ))}
          </fieldset>

          <div className="hairline pt-5">
            <p className="text-[15px] text-soft">Уже вели бюджет в Сарфе и сохранили файл?</p>
            <button type="button" className="btn-quiet mt-2 w-full" onClick={() => file.current?.click()}>
              Восстановить из файла
            </button>
            <input ref={file} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFile(e.target.files?.[0])} />
            {importError && <p className="mt-2 text-[15px] text-over" role="alert">{importError}</p>}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-5">
          <AmountField
            label={`Зарплата в ${monthPrep(ym)} — в конверты`}
            value={salary}
            onChange={setSalary}
            hint="Можно оставить пустым и добавить доход позже"
          />
          <PlanEditor value={plan} onChange={setPlan} income={salary || undefined} />
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-rule bg-card px-4 pt-3" style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}>
        <div className="mx-auto flex max-w-[560px] gap-2">
          {step === 1 ? (
            <>
              <button type="button" className="btn-quiet" onClick={onLogout}>
                Выйти
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => setStep(2)}>
                Дальше
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-quiet" onClick={() => setStep(1)}>
                Назад
              </button>
              <button type="button" className="btn-primary flex-1" onClick={finish}>
                Начать
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
