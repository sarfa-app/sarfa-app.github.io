import { useState } from 'react';
import { FUND_DEFAULT_CATEGORY, getFund } from '../domain/constants';
import { money, num } from '../domain/format';
import { newId } from '../domain/ids';
import type { Month, Payment, Tx } from '../domain/types';
import { DateChips, Money, PaymentToggle } from '../ui/bits';
import { useApp, usePref } from '../ui/context';
import { Numpad } from '../ui/Numpad';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

/** §4.5: трата из фонда уменьшает фонд и не трогает лимиты месяца. */
export function FundSpendSheet({ fundId, m, onClose }: { fundId: string; m: Month; onClose: () => void }) {
  const { state, dispatch, today, session } = useApp();
  const toast = useToast();
  const fund = getFund(fundId)!;
  const balance = state.fundBalances[fundId] ?? 0;
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today);
  const [payment, setPayment] = usePref<Payment>(session.uid, 'payment', 'card');
  const [askShortfall, setAskShortfall] = useState(false);
  const value = Number(amount || 0);
  const shortfall = Math.max(0, value - Math.max(0, balance));

  const record = (fromMain: number) => {
    const tx: Tx = {
      id: newId(),
      date,
      amount: value,
      categoryId: FUND_DEFAULT_CATEGORY[fundId] ?? 'var',
      note: note.trim() || fund.name,
      payment,
      fromMain,
      fundId,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'addTx', ym: m.ym, tx });
    onClose();
    toast({
      message: `Из фонда: ${money(value - fromMain)}${fromMain ? ` + ${money(fromMain)} с основного счёта` : ''}`,
      actionLabel: 'Отменить',
      onAction: () => dispatch({ type: 'deleteTx', ym: m.ym, id: tx.id }),
    });
  };

  return (
    <Sheet
      title={`Потратить из фонда`}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="btn-primary h-12 w-full text-[17px]"
          disabled={value <= 0}
          onClick={() => (shortfall > 0 ? setAskShortfall(true) : record(0))}
        >
          {value > 0 ? `Потратить ${money(value)}` : 'Потратить'}
        </button>
      }
    >
      <p className="font-semibold">{fund.name}</p>
      <p className="text-[15px] text-soft">
        В фонде <Money value={balance} className={balance < 0 ? 'text-over' : 'text-ink'} />. Лимиты месяца не меняются.
      </p>
      <div className="my-3 text-center" aria-live="polite">
        <span className={`num text-[40px] font-bold leading-none ${value ? '' : 'text-faint'}`}>{num(value)}</span>
        <span className="ml-1.5 text-xl font-semibold text-soft">смн</span>
        {shortfall > 0 && <p className="mt-1 text-sm font-medium text-over">В фонде не хватает {money(shortfall)}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <DateChips value={date} onChange={setDate} max={today} />
        <PaymentToggle value={payment} onChange={setPayment} />
        <input className="field" placeholder="На что (необязательно)" aria-label="Заметка" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        <Numpad value={amount} onChange={setAmount} compact />
      </div>

      {askShortfall && (
        <Sheet title="В фонде не хватает" onClose={() => setAskShortfall(false)}>
          <p className="text-[15px] leading-relaxed">
            В фонде «{fund.name}» {money(Math.max(0, balance))}, трата — {money(value)}. Не хватает <b className="num">{money(shortfall)}</b>.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" className="btn-primary h-auto flex-col py-3" onClick={() => record(shortfall)}>
              <span>Добрать {money(shortfall)} с основного счёта</span>
              <span className="text-sm font-normal text-white/85">фонд обнулится</span>
            </button>
            <button type="button" className="btn-quiet h-auto flex-col py-3" onClick={() => record(0)}>
              <span>Всё из фонда</span>
              <span className="text-sm font-normal text-soft">фонд уйдёт в минус на {money(shortfall)}</span>
            </button>
          </div>
        </Sheet>
      )}
    </Sheet>
  );
}
