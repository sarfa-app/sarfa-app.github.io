import { useState } from 'react';
import { deficitFor, orderedCategories, remaining } from '../domain/calc';
import { getCategory, SHORT_NAME } from '../domain/constants';
import { dayMonth } from '../domain/dates';
import { money, num } from '../domain/format';
import { newId } from '../domain/ids';
import { openMonth } from '../domain/months';
import type { Month, Payment, Tx } from '../domain/types';
import { AmountField, DateChips, PaymentToggle } from '../ui/bits';
import { useApp, usePref } from '../ui/context';
import { Numpad } from '../ui/Numpad';
import { Sheet, useVisualViewport } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

/** Запись траты (§5.2): всё на одном экране вместе с клавиатурой, кнопка закреплена внизу. */
export function AddTxSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch, today, session } = useApp();
  const toast = useToast();
  const m = openMonth(state)!;
  // Порядок фиксируется при открытии, чтобы чипы не прыгали во время ввода.
  const [order] = useState(() => orderedCategories(state));
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [payment, setPayment] = usePref<Payment>(session.uid, 'payment', 'card');
  const [note, setNote] = useState('');
  const [noteFocus, setNoteFocus] = useState(false);
  const [deficit, setDeficit] = useState<number | null>(null);
  const [displacing, setDisplacing] = useState(false);
  const vv = useVisualViewport();
  const value = Number(amount || 0);
  const tight = vv.height < 620;

  const record = (fromMain: number) => {
    if (!cat) return;
    const tx: Tx = {
      id: newId(),
      date,
      amount: value,
      categoryId: cat,
      note: note.trim(),
      payment,
      fromMain,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'addTx', ym: m.ym, tx });
    onClose();
    toast({
      message: `Записано: ${money(value)} · ${SHORT_NAME[cat]}${fromMain ? `, ${money(fromMain)} с основного счёта` : ''}`,
      actionLabel: 'Отменить',
      onAction: () => dispatch({ type: 'deleteTx', ym: m.ym, id: tx.id }),
      duration: 5000,
    });
  };

  const submit = () => {
    if (!cat || value <= 0) return;
    const d = deficitFor(m, cat, value);
    if (d > 0) setDeficit(d);
    else record(0);
  };

  const rest = cat ? remaining(m, cat) : null;
  const after = rest !== null ? rest - value : null;
  const otherMonth = date.slice(0, 7) !== m.ym;

  return (
    <Sheet title="Новая трата" onClose={onClose} size="full">
      <div className={`flex min-h-0 flex-1 flex-col ${tight ? 'gap-2' : 'gap-3'}`}>
        {/* 1. Сумма — забирает свободную высоту на больших экранах */}
        <div className="flex flex-[1_0_auto] flex-col justify-center text-center" aria-live="polite">
          <div className={`num font-bold leading-none tracking-tight ${value ? 'text-ink' : 'text-faint'}`} style={{ fontSize: tight ? 32 : 44 }}>
            <span className="sr-only">Сумма: </span>
            {num(value)}
            <span className="ml-1.5 text-[0.5em] font-semibold text-soft">смн</span>
          </div>
          <div className={`mt-1 text-sm ${tight ? 'h-4 leading-4' : 'h-5'}`}>
            {cat && after !== null && (
              <span className={after < 0 ? 'font-medium text-over' : 'text-soft'}>
                {after < 0
                  ? `Не хватает ${money(deficitFor(m, cat, value))} — предложу варианты`
                  : `В конверте останется ${money(after)}`}
              </span>
            )}
            {!cat && <span className="text-soft">Выберите категорию</span>}
          </div>
        </div>

        {/* 2. Категория */}
        <div className="no-scrollbar -mx-4 flex shrink-0 gap-1.5 overflow-x-auto px-4" role="group" aria-label="Категория">
          {order.map((id) => {
            const r = remaining(m, id);
            return (
              <button
                key={id}
                type="button"
                className={`chip ${tight ? 'h-12' : 'h-[52px]'} shrink-0 flex-col !items-start !px-3 leading-tight`}
                aria-pressed={cat === id}
                aria-label={`${getCategory(id)?.name}, осталось ${num(r)} смн`}
                onClick={() => setCat(id)}
              >
                <span className="whitespace-nowrap text-[15px] font-semibold">{SHORT_NAME[id]}</span>
                <span className={`num whitespace-nowrap text-[13px] ${r < 0 && cat !== id ? 'text-over' : cat === id ? 'text-white/85' : 'text-soft'}`}>
                  {num(r)}
                </span>
              </button>
            );
          })}
        </div>

        {/* 3. Дата */}
        <div className="shrink-0">
          <DateChips value={date} onChange={setDate} max={today} />
          {otherMonth && !tight && (
            <p className="mt-1 truncate text-sm text-warn-ink">
              {dayMonth(date)} — трата попадёт в открытый месяц
            </p>
          )}
        </div>

        {/* 4. Наличка / карта */}
        <div className="shrink-0">
          <PaymentToggle value={payment} onChange={setPayment} />
        </div>

        {/* 5. Заметка */}
        <input
          className="field shrink-0"
          placeholder="Заметка (необязательно)"
          aria-label="Заметка"
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          onFocus={() => setNoteFocus(true)}
          onBlur={() => setNoteFocus(false)}
          enterKeyHint="done"
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />

        {/* Цифровая клавиатура прячется, пока открыта системная (для заметки). */}
        {!noteFocus && (
          <div className="min-h-[152px] flex-[0_1_272px]">
            <Numpad value={amount} onChange={setAmount} fill />
          </div>
        )}

        <div className="shrink-0 pb-3" style={{ paddingBottom: vv.height < window.innerHeight - 80 ? 8 : 'calc(var(--safe-bottom) + 8px)' }}>
          <button
            type="button"
            className="btn-primary h-12 w-full text-[17px]"
            disabled={!cat || value <= 0}
            onMouseDown={(e) => e.preventDefault() /* не терять фокус заметки до нажатия */}
            onClick={submit}
          >
            {value > 0 ? `Записать ${money(value)}` : 'Записать'}
          </button>
        </div>
      </div>

      {deficit !== null && cat && !displacing && (
        <OverflowDialog
          m={m}
          cat={cat}
          amount={value}
          deficit={deficit}
          threshold={state.settings.bigFromMainThreshold}
          onPostpone={() => {
            setDeficit(null);
            onClose();
            toast({ message: 'Трата не записана — отложена до следующего месяца' });
          }}
          onDisplace={() => setDisplacing(true)}
          onFromMain={() => record(deficit)}
          onCancel={() => setDeficit(null)}
        />
      )}
      {displacing && cat && (
        <DisplaceSheet
          m={m}
          cat={cat}
          amount={value}
          onBack={() => {
            setDisplacing(false);
            setDeficit(null);
          }}
        />
      )}
    </Sheet>
  );
}

/** §4.4: три варианта именно в этом порядке. */
function OverflowDialog({
  m,
  cat,
  amount,
  deficit,
  threshold,
  onPostpone,
  onDisplace,
  onFromMain,
  onCancel,
}: {
  m: Month;
  cat: string;
  amount: number;
  deficit: number;
  threshold: number;
  onPostpone: () => void;
  onDisplace: () => void;
  onFromMain: () => void;
  onCancel: () => void;
}) {
  const rest = remaining(m, cat);
  const name = getCategory(cat)?.name ?? cat;
  return (
    <Sheet title={`Конверт «${SHORT_NAME[cat]}» не вмещает трату`} onClose={onCancel}>
      <p className="text-[15px] leading-relaxed">
        В конверте «{name}» {rest > 0 ? `осталось ${money(rest)}` : rest === 0 ? 'ничего не осталось' : `уже перерасход ${money(-rest)}`}, трата —{' '}
        {money(amount)}. Не хватает <b className="num">{money(deficit)}</b>.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <button type="button" className="btn-quiet h-auto flex-col !items-start py-3 text-left" onClick={onPostpone}>
          <span className="text-[16px]">1. Отложить до следующего месяца</span>
          <span className="text-sm font-normal text-soft">Трата не записывается</span>
        </button>
        <button type="button" className="btn-quiet h-auto flex-col !items-start py-3 text-left" onClick={onDisplace}>
          <span className="text-[16px]">2. Вытеснить другую трату</span>
          <span className="text-sm font-normal text-soft">Удалить или уменьшить трату из этого конверта</span>
        </button>
        <button type="button" className="btn-quiet h-auto flex-col !items-start py-3 text-left" onClick={onFromMain}>
          <span className="text-[16px]">3. Взять с основного счёта</span>
          <span className="text-sm font-normal text-soft">
            {money(deficit)} с основного счёта, {money(amount - deficit)} из конверта
          </span>
        </button>
        {deficit < threshold && (
          <p className="border-l-4 border-warn bg-[#FBF4EA] px-3 py-2 text-[15px] text-ink" role="note">
            По твоему правилу траты меньше {money(threshold)} с основного счёта не берутся. Здесь — {money(deficit)}.
          </p>
        )}
      </div>
    </Sheet>
  );
}

/** Вытеснение: удалить или уменьшить трату этой категории, затем вернуться к записи. */
function DisplaceSheet({ m, cat, amount, onBack }: { m: Month; cat: string; amount: number; onBack: () => void }) {
  const { state, dispatch } = useApp();
  const live = state.months[m.ym];
  const txs = live.txs.filter((t) => t.categoryId === cat && !t.fundId).sort((a, b) => b.date.localeCompare(a.date));
  const rest = remaining(live, cat);
  const fits = rest >= amount;
  const [editing, setEditing] = useState<string | null>(null);
  const [newAmount, setNewAmount] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);

  return (
    <Sheet
      title={`Вытеснить трату · ${SHORT_NAME[cat]}`}
      onClose={onBack}
      footer={
        <button type="button" className="btn-primary w-full" onClick={onBack}>
          Вернуться к записи
        </button>
      }
    >
      <p className={`text-[15px] ${fits ? 'font-medium text-ok' : 'text-soft'}`} aria-live="polite">
        {fits
          ? `Теперь трата ${money(amount)} помещается: в конверте ${money(rest)}`
          : `В конверте ${money(rest)}, для новой траты нужно ${money(amount)}. Освободите ещё ${money(amount - Math.max(0, rest))}.`}
      </p>
      {txs.length === 0 && <p className="mt-4 text-soft">В этом месяце по категории ещё нет трат.</p>}
      <ul className="mt-3">
        {txs.map((t) => (
          <li key={t.id} className="border-t border-rule py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[15px]">{t.note || SHORT_NAME[cat]}</div>
                <div className="text-sm text-soft">{dayMonth(t.date)}</div>
              </div>
              <span className="num shrink-0 font-semibold">{money(t.amount)}</span>
            </div>
            {editing === t.id ? (
              <div className="mt-2 flex items-end gap-2">
                <div className="flex-1">
                  <AmountField label="Новая сумма" value={newAmount} onChange={setNewAmount} />
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={newAmount <= 0 || newAmount >= t.amount}
                  onClick={() => {
                    dispatch({ type: 'updateTx', ym: m.ym, id: t.id, patch: { amount: newAmount, fromMain: Math.min(t.fromMain, newAmount) } });
                    setEditing(null);
                  }}
                >
                  Сохранить
                </button>
              </div>
            ) : deleting === t.id ? (
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn-quiet flex-1" onClick={() => setDeleting(null)}>
                  Не удалять
                </button>
                <button
                  type="button"
                  className="btn-danger flex-1"
                  onClick={() => {
                    dispatch({ type: 'deleteTx', ym: m.ym, id: t.id });
                    setDeleting(null);
                  }}
                >
                  Удалить {money(t.amount)}
                </button>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="btn-quiet flex-1"
                  onClick={() => {
                    setEditing(t.id);
                    setNewAmount(t.amount);
                    setDeleting(null);
                  }}
                >
                  Уменьшить
                </button>
                <button
                  type="button"
                  className="btn-quiet flex-1 text-over"
                  onClick={() => {
                    setDeleting(t.id);
                    setEditing(null);
                  }}
                >
                  Удалить
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
