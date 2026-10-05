import { useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { takenFromMain } from '../domain/calc';
import { FUNDS } from '../domain/constants';
import { dayMonth, monthName, monthPrep, todayYmd } from '../domain/dates';
import { money } from '../domain/format';
import { newId } from '../domain/ids';
import { freshState } from '../domain/initial';
import { openMonth } from '../domain/months';
import type { Income, Month, Routing, State } from '../domain/types';
import { parseStateJson } from '../domain/validate';
import { backend } from '../sync';
import { passwordError } from '../sync/backend';
import { AmountField, Confirm, DateChips, Money } from '../ui/bits';
import { useApp } from '../ui/context';
import { PlanEditor, type Plan } from '../ui/PlanEditor';
import { Sheet } from '../ui/Sheet';
import { SyncBadge } from '../ui/SyncBadge';
import { useToast } from '../ui/Toast';

export function SettingsScreen() {
  const { state } = useApp();
  const m = openMonth(state);
  return (
    <main className="screen">
      <header className="flex items-center justify-between pb-2">
        <h1 className="text-[22px] font-bold">Настройки</h1>
        <SyncBadge />
      </header>
      {m && <IncomeSection m={m} />}
      {m && <PlanSection key={m.ym} m={m} />}
      {m && <AccountsSection m={m} />}
      <RuleSection />
      <DataSection />
      <AccountSection />
      <p className="mt-6 text-center text-sm text-soft">Сарфа {__APP_VERSION__}</p>
    </main>
  );
}

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <section className="mt-3 bg-card px-4 py-3">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      {note && <p className="mt-0.5 text-sm text-soft">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const distributedNote = (m: Month) =>
  m.distributed ? 'Доход уже распределён: изменения появятся на главном экране как разница, которую нужно разнести.' : undefined;

// ---------- Доход ----------

function IncomeSection({ m }: { m: Month }) {
  const [editing, setEditing] = useState<Income | 'new' | null>(null);
  const total = m.incomes.reduce((a, i) => a + i.amount, 0);
  return (
    <Section title={`Доход в ${monthPrep(m.ym)}`} note={distributedNote(m)}>
      {m.incomes.length === 0 && <p className="pb-2 text-soft">Поступлений пока нет.</p>}
      <ul>
        {m.incomes.map((i) => (
          <li key={i.id} className="border-t border-rule first:border-t-0">
            <button type="button" className="flex w-full items-center gap-3 py-2.5 text-left" onClick={() => setEditing(i)}>
              <div className="min-w-0 flex-1">
                <div className="text-[15px]">{i.label || 'Поступление'}</div>
                <div className="text-sm text-soft">
                  {dayMonth(i.date)} · {i.routing === 'blocks' ? 'в конверты' : 'в накопления'}
                </div>
              </div>
              <Money value={i.amount} className="font-semibold" />
              <ChevronRight size={18} className="text-faint" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {m.incomes.length > 1 && (
        <div className="flex justify-between border-t border-ink py-2 font-semibold">
          <span>Всего</span>
          <Money value={total} />
        </div>
      )}
      <button type="button" className="btn-quiet mt-2 w-full" onClick={() => setEditing('new')}>
        Добавить поступление
      </button>
      {editing && <IncomeSheet m={m} income={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Section>
  );
}

const LABELS = ['Зарплата', 'KPI', 'Отпускные'];

function IncomeSheet({ m, income, onClose }: { m: Month; income?: Income; onClose: () => void }) {
  const { dispatch } = useApp();
  const [label, setLabel] = useState(income?.label ?? 'Зарплата');
  const [amount, setAmount] = useState(income?.amount ?? 0);
  const [date, setDate] = useState(income?.date ?? todayYmd());
  const [routing, setRouting] = useState<Routing>(income?.routing ?? 'blocks');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    if (amount <= 0) return;
    if (income) dispatch({ type: 'updateIncome', ym: m.ym, id: income.id, patch: { label: label.trim(), amount, date, routing } });
    else dispatch({ type: 'addIncome', ym: m.ym, income: { id: newId(), label: label.trim(), amount, date, routing } });
    onClose();
  };

  return (
    <Sheet
      title={income ? 'Поступление' : 'Новое поступление'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {income && (
            <button type="button" className="btn-quiet text-over" onClick={() => setConfirmDelete(true)}>
              Удалить
            </button>
          )}
          <button type="button" className="btn-primary flex-1" disabled={amount <= 0} onClick={save}>
            Сохранить
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <span className="label">Что это</span>
          <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Тип поступления">
            {LABELS.map((l) => (
              <button key={l} type="button" className="chip" aria-pressed={label === l} onClick={() => setLabel(l)}>
                {l}
              </button>
            ))}
          </div>
          <input className="field mt-2" aria-label="Название поступления" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <AmountField label="Сумма" value={amount} onChange={(v) => setAmount(v)} />
        <div>
          <span className="label">Дата</span>
          <div className="mt-1">
            <DateChips value={date} onChange={setDate} />
          </div>
        </div>
        <div>
          <span className="label">Куда</span>
          <div className="mt-1 flex gap-1.5" role="group" aria-label="Маршрут">
            <button type="button" className="chip flex-1" aria-pressed={routing === 'blocks'} onClick={() => setRouting('blocks')}>
              В конверты
            </button>
            <button type="button" className="chip flex-1" aria-pressed={routing === 'savings'} onClick={() => setRouting('savings')}>
              В накопления
            </button>
          </div>
          <p className="mt-1 text-sm text-soft">
            {routing === 'blocks' ? 'Покрывает план месяца, остаток уйдёт на основной счёт' : 'Целиком на основной счёт при распределении'}
          </p>
        </div>
      </div>
      {confirmDelete && income && (
        <Confirm
          title="Удалить поступление?"
          confirmLabel="Удалить"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            dispatch({ type: 'deleteIncome', ym: m.ym, id: income.id });
            onClose();
          }}
        >
          {income.label} · {money(income.amount)}
        </Confirm>
      )}
    </Sheet>
  );
}

// ---------- Лимиты ----------

function PlanSection({ m }: { m: Month }) {
  const { dispatch } = useApp();
  const toast = useToast();
  const [draft, setDraft] = useState<Plan>({ limits: { ...m.limits }, fundPlan: { ...m.fundPlan } });
  const changed = differs(draft, m);
  const income = m.incomes.filter((i) => i.routing === 'blocks').reduce((a, i) => a + i.amount, 0);
  return (
    <Section title={`Лимиты и фонды · ${monthName(m.ym)}`} note={distributedNote(m)}>
      <PlanEditor value={draft} onChange={setDraft} income={income || undefined} />
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-quiet flex-1" disabled={!changed} onClick={() => setDraft({ limits: { ...m.limits }, fundPlan: { ...m.fundPlan } })}>
          Отменить
        </button>
        <button
          type="button"
          className="btn-primary flex-1"
          disabled={!changed}
          onClick={() => {
            dispatch({ type: 'setPlan', ym: m.ym, limits: draft.limits, fundPlan: draft.fundPlan });
            toast({ message: 'Лимиты сохранены' });
          }}
        >
          Сохранить лимиты
        </button>
      </div>
    </Section>
  );
}

function differs(p: Plan, m: Month): boolean {
  const keys = new Set([...Object.keys(p.limits), ...Object.keys(m.limits)]);
  for (const k of keys) if ((p.limits[k] ?? 0) !== (m.limits[k] ?? 0)) return true;
  for (const f of FUNDS) if ((p.fundPlan[f.id] ?? 0) !== (m.fundPlan[f.id] ?? 0)) return true;
  return false;
}

// ---------- Счета ----------

function AccountsSection({ m }: { m: Month }) {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const taken = takenFromMain(m);
  // Пользователь вводит фактический остаток СЕЙЧАС; в хранилище — до вычета трат месяца с основного счёта.
  const liveMain = state.mainAccount - taken;
  const [dMain, setDMain] = useState<number>();
  const [dRecv, setDRecv] = useState<number>();
  const [dFunds, setDFunds] = useState<Record<string, number>>({});
  const main = dMain ?? liveMain;
  const recv = dRecv ?? state.receivables;
  const fundVal = (id: string) => dFunds[id] ?? state.fundBalances[id] ?? 0;
  const changed =
    main !== liveMain || recv !== state.receivables || FUNDS.some((f) => fundVal(f.id) !== (state.fundBalances[f.id] ?? 0));
  return (
    <Section title="Счета" note="Реальные деньги на сегодня, без прогнозов">
      <div className="flex flex-col gap-3">
        <AmountField label="Основной счёт сейчас" value={main} onChange={(v) => setDMain(v)} allowNegative showZero />
        <AmountField label="Мне должны" value={recv} onChange={(v) => setDRecv(v)} />
        {FUNDS.map((f) => (
          <AmountField
            key={f.id}
            label={`Накоплено: ${f.name}`}
            value={fundVal(f.id)}
            onChange={(v) => setDFunds({ ...dFunds, [f.id]: v })}
            allowNegative
          />
        ))}
      </div>
      <button
        type="button"
        className="btn-primary mt-3 w-full"
        disabled={!changed}
        onClick={() => {
          const fundBalances: Record<string, number> = {};
          for (const f of FUNDS) fundBalances[f.id] = fundVal(f.id);
          dispatch({ type: 'setAccounts', mainAccount: main + taken, receivables: recv, fundBalances });
          setDMain(undefined);
          setDRecv(undefined);
          setDFunds({});
          toast({ message: 'Счета сохранены' });
        }}
      >
        Сохранить счета
      </button>
    </Section>
  );
}

// ---------- Правило ----------

function RuleSection() {
  const { state, dispatch } = useApp();
  const [v, setV] = useState(state.settings.bigFromMainThreshold);
  return (
    <Section title="Правило основного счёта" note="Траты меньше этой суммы с основного счёта не берутся. Приложение предупредит, но не запретит.">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <AmountField label="Порог" value={v} onChange={(x) => setV(x)} />
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={v === state.settings.bigFromMainThreshold}
          onClick={() => dispatch({ type: 'setSettings', settings: { bigFromMainThreshold: v } })}
        >
          Сохранить
        </button>
      </div>
    </Section>
  );
}

// ---------- Данные ----------

async function exportState(state: State, login: string) {
  const name = `sarfa-${login}-${todayYmd()}.json`;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const file = typeof File !== 'undefined' ? new File([blob], name, { type: 'application/json' }) : null;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (file && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function DataSection() {
  const { state, dispatch, session, today } = useApp();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<State | null>(null);
  const [reset, setReset] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (file.current) file.current.value = '';
    if (!f) return;
    const r = parseStateJson(await f.text());
    if (r.ok) setPendingImport(r.state);
    else toast({ message: `Не получилось импортировать: ${r.error}`, duration: 8000 });
  };

  return (
    <Section title="Данные" note="Файл — полная копия бюджета. Храните его в надёжном месте: внутри все ваши траты.">
      <div className="flex flex-col gap-2">
        <button type="button" className="btn-quiet w-full" onClick={() => void exportState(state, session.login)}>
          Экспорт в файл
        </button>
        <button type="button" className="btn-quiet w-full" onClick={() => file.current?.click()}>
          Импорт из файла
        </button>
        <input ref={file} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFile(e.target.files?.[0])} />
        <button type="button" className="btn-quiet w-full text-over" onClick={() => setReset(true)}>
          Сбросить все данные
        </button>
      </div>
      {pendingImport && (
        <Confirm
          title="Заменить данные из файла?"
          confirmLabel="Заменить"
          onCancel={() => setPendingImport(null)}
          onConfirm={() => {
            dispatch({ type: 'replace', state: pendingImport });
            setPendingImport(null);
            toast({ message: 'Данные восстановлены из файла' });
          }}
        >
          В файле {Object.keys(pendingImport.months).length} мес. и{' '}
          {Object.values(pendingImport.months).reduce((a, m) => a + m.txs.length, 0)} трат. Текущие данные будут полностью заменены.
        </Confirm>
      )}
      {reset && (
        <Confirm
          title="Сбросить все данные?"
          confirmLabel="Сбросить"
          danger
          onCancel={() => setReset(false)}
          onConfirm={() => {
            dispatch({ type: 'replace', state: freshState(today) });
            setReset(false);
            toast({ message: 'Данные сброшены' });
          }}
        >
          Все месяцы, траты, доходы и фонды будут удалены — и на этом устройстве, и на сервере. Перед сбросом можно сделать экспорт.
        </Confirm>
      )}
    </Section>
  );
}

// ---------- Аккаунт ----------

function AccountSection() {
  const { session, snap, logout } = useApp();
  const [sheet, setSheet] = useState<null | 'password' | 'logout' | 'delete'>(null);
  return (
    <Section title="Аккаунт" note={`Вы вошли как ${session.login}`}>
      <div className="flex flex-col gap-2">
        <button type="button" className="btn-quiet w-full" onClick={() => setSheet('password')}>
          Сменить пароль
        </button>
        <button type="button" className="btn-quiet w-full" onClick={() => (snap.pending ? setSheet('logout') : void logout())}>
          Выйти
        </button>
        <button type="button" className="btn-quiet w-full text-over" onClick={() => setSheet('delete')}>
          Удалить аккаунт
        </button>
      </div>
      {sheet === 'password' && <PasswordSheet onClose={() => setSheet(null)} />}
      {sheet === 'logout' && (
        <Confirm title="Выйти без сохранения?" confirmLabel="Выйти" danger onCancel={() => setSheet(null)} onConfirm={() => void logout()}>
          {snap.pending} {snap.pending === 1 ? 'изменение ещё не отправлено' : 'изменений ещё не отправлены'} на сервер — нет связи. После
          выхода они пропадут. Лучше дождаться интернета.
        </Confirm>
      )}
      {sheet === 'delete' && <DeleteAccountSheet onClose={() => setSheet(null)} />}
    </Section>
  );
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const e = passwordError(pw) ?? (pw !== pw2 ? 'Пароли не совпадают' : null);
    if (e) return setError(e);
    setBusy(true);
    try {
      await backend.changePassword(pw);
      toast({ message: 'Пароль изменён' });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не получилось');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      title="Новый пароль"
      onClose={onClose}
      footer={
        <button type="button" className="btn-primary w-full" disabled={busy} onClick={submit}>
          {busy ? 'Подождите…' : 'Сменить пароль'}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="label">Новый пароль</span>
          <input className="field mt-1" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Ещё раз</span>
          <input className="field mt-1" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </label>
        <p className="min-h-[1.25rem] text-[15px] text-over" aria-live="assertive">
          {error}
        </p>
      </div>
    </Sheet>
  );
}

function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const { session, logout } = useApp();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ok = typed.trim().toLowerCase() === session.login;
  return (
    <Sheet
      title="Удалить аккаунт"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn-danger w-full"
          disabled={!ok || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await backend.deleteAccount();
              await logout();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Не получилось');
              setBusy(false);
            }
          }}
        >
          Удалить навсегда
        </button>
      }
    >
      <p className="text-[15px] leading-relaxed">
        Аккаунт и все данные будут удалены с сервера без возможности восстановления. Если они ещё нужны — сначала сделайте экспорт.
      </p>
      <label className="mt-4 block">
        <span className="label">Введите логин «{session.login}» для подтверждения</span>
        <input className="field mt-1" autoCapitalize="none" autoCorrect="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
      </label>
      {error && <p className="mt-2 text-[15px] text-over">{error}</p>}
    </Sheet>
  );
}
