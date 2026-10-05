import { useState } from 'react';
import { getCategory, getFund, SHORT_NAME, USER_CATEGORIES } from '../domain/constants';
import { dayLabel } from '../domain/dates';
import { money } from '../domain/format';
import type { Month, Tx } from '../domain/types';
import { AmountField, Confirm, DateChips, Money, PaymentToggle } from '../ui/bits';
import { useApp } from '../ui/context';
import { Sheet } from '../ui/Sheet';

/** §5.3: карточка траты — правка суммы, категории, даты, способа оплаты и заметки. */
export function EditTxSheet({ m, tx, onClose }: { m: Month; tx: Tx; onClose: () => void }) {
  const { dispatch, today } = useApp();
  const [amount, setAmount] = useState(tx.amount);
  const [cat, setCat] = useState(tx.categoryId);
  const [date, setDate] = useState(tx.date);
  const [payment, setPayment] = useState(tx.payment);
  const [note, setNote] = useState(tx.note);
  const [fromMain, setFromMain] = useState(tx.fromMain);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const system = !!getCategory(tx.categoryId)?.system;
  const fund = tx.fundId ? getFund(tx.fundId) : undefined;
  const readOnly = m.closed;

  if (readOnly) {
    return (
      <Sheet title="Трата" onClose={onClose}>
        <dl className="text-[15px]">
          <Item k="Сумма" v={<Money value={tx.amount} className="font-semibold" />} />
          <Item k="Категория" v={getCategory(tx.categoryId)?.name} />
          <Item k="Дата" v={dayLabel(tx.date)} />
          <Item k="Оплата" v={tx.payment === 'cash' ? 'Наличка' : 'Карта'} />
          {tx.fromMain > 0 && <Item k="С основного счёта" v={money(tx.fromMain)} />}
          {fund && <Item k="Из фонда" v={fund.name} />}
          {tx.note && <Item k="Заметка" v={tx.note} />}
        </dl>
        <p className="mt-3 text-sm text-soft">Месяц закрыт — траты не редактируются.</p>
      </Sheet>
    );
  }

  const valid = amount > 0 && fromMain <= amount;
  const save = () => {
    if (!valid) return;
    dispatch({
      type: 'updateTx',
      ym: m.ym,
      id: tx.id,
      patch: { amount, categoryId: cat, date, payment, note: note.trim(), fromMain },
    });
    onClose();
  };

  return (
    <Sheet
      title="Трата"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button type="button" className="btn-quiet text-over" onClick={() => setConfirmDelete(true)}>
            Удалить
          </button>
          <button type="button" className="btn-primary flex-1" disabled={!valid} onClick={save}>
            Сохранить
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {fund && <p className="border-l-4 border-b-fund pl-3 text-[15px]">Из фонда «{fund.name}» — лимиты месяца не трогает</p>}
        <AmountField label="Сумма" value={amount} onChange={(v) => setAmount(v)} />

        <div>
          <span className="label">Категория</span>
          {system ? (
            <p className="mt-1 font-medium text-over">{getCategory(cat)?.name}</p>
          ) : (
            <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Категория">
              {USER_CATEGORIES.map((c) => (
                <button key={c.id} type="button" className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)} aria-label={c.name}>
                  {SHORT_NAME[c.id]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="label">Дата</span>
          <div className="mt-1">
            <DateChips value={date} onChange={setDate} max={today} />
          </div>
        </div>

        <div>
          <span className="label">Оплата</span>
          <div className="mt-1">
            <PaymentToggle value={payment} onChange={setPayment} />
          </div>
        </div>

        <label className="block">
          <span className="label">Заметка</span>
          <input className="field mt-1" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </label>

        <AmountField
          label="Из них с основного счёта"
          value={fromMain}
          onChange={(v) => setFromMain(v)}
          hint={fromMain > amount ? <span className="text-over">Не может быть больше суммы траты</span> : 'Часть, добранная сверх конверта'}
        />
      </div>

      {confirmDelete && (
        <Confirm
          title="Удалить трату?"
          confirmLabel="Удалить"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            dispatch({ type: 'deleteTx', ym: m.ym, id: tx.id });
            setConfirmDelete(false);
            onClose();
          }}
        >
          {money(tx.amount)} · {getCategory(tx.categoryId)?.name}
          {tx.note ? ` · ${tx.note}` : ''}
          {fund ? `. Деньги вернутся в фонд «${fund.name}».` : ''}
        </Confirm>
      )}
    </Sheet>
  );
}

function Item({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-t border-rule py-2 first:border-t-0">
      <dt className="text-soft">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
