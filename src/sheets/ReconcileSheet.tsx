import { useState } from 'react';
import { expectedInEnvelope } from '../domain/calc';
import { BLOCKS, UNACCOUNTED_BY_BLOCK } from '../domain/constants';
import { money } from '../domain/format';
import { newId } from '../domain/ids';
import type { BlockId, Month, Tx } from '../domain/types';
import { AmountField } from '../ui/bits';
import { useApp } from '../ui/context';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';

/**
 * §4.6: сверка наличных. Разница пишется в «Не записано» своего блока — никогда
 * в обычные категории.
 */
export function ReconcileSheet({ m, onClose }: { m: Month; onClose: () => void }) {
  const { dispatch, today } = useApp();
  const toast = useToast();
  const [fact, setFact] = useState<Partial<Record<BlockId, number>>>({});

  const rows = BLOCKS.map((b) => {
    const expected = expectedInEnvelope(m, b.id);
    const f = fact[b.id];
    const diff = f === undefined ? null : expected - f;
    return { ...b, expected, fact: f, diff };
  });
  const toWrite = rows.filter((r) => r.diff !== null && r.diff > 0);

  const save = () => {
    const txs: Tx[] = toWrite.map((r) => ({
      id: newId(),
      date: today,
      amount: r.diff!,
      categoryId: UNACCOUNTED_BY_BLOCK[r.id],
      note: 'Не записано (сверка)',
      payment: 'cash',
      fromMain: 0,
      createdAt: new Date().toISOString(),
    }));
    if (txs.length) dispatch({ type: 'addTxs', ym: m.ym, txs });
    onClose();
    const total = txs.reduce((a, t) => a + t.amount, 0);
    toast(
      txs.length
        ? {
            message: `В «Не записано» добавлено ${money(total)}`,
            actionLabel: 'Отменить',
            onAction: () => txs.forEach((t) => dispatch({ type: 'deleteTx', ym: m.ym, id: t.id })),
          }
        : { message: 'Расхождений нет — всё записано' },
    );
  };

  return (
    <Sheet
      title="Сверка наличных"
      onClose={onClose}
      footer={
        <button type="button" className="btn-primary h-12 w-full" disabled={rows.every((r) => r.fact === undefined)} onClick={save}>
          {toWrite.length ? `Записать разницу: ${money(toWrite.reduce((a, r) => a + r.diff!, 0))}` : 'Готово'}
        </button>
      }
    >
      <p className="text-[15px] leading-relaxed text-soft">
        Посчитайте, сколько реально осталось в каждом конверте. Разница с записями уйдёт в строку «Не записано» этого блока.
      </p>
      <div className="mt-4 flex flex-col gap-5">
        {rows.map((r) => (
          <div key={r.id} className={`border-l-4 pl-3 ${{ ob: 'border-b-ob', fam: 'border-b-fam', var: 'border-b-var' }[r.id]}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{r.name}</span>
              <span className="text-[15px] text-soft">
                по записям <span className="num font-semibold text-ink">{money(r.expected)}</span>
              </span>
            </div>
            <div className="mt-2">
              <AmountField
                label="Фактически в конверте"
                value={r.fact}
                showZero
                onChange={(v, empty) => {
                  const next = { ...fact };
                  if (empty) delete next[r.id];
                  else next[r.id] = v;
                  setFact(next);
                }}
              />
            </div>
            <p className="mt-1 min-h-[1.25rem] text-sm" aria-live="polite">
              {r.diff === null ? null : r.diff > 0 ? (
                <span className="font-medium text-over">Не записано {money(r.diff)} — уйдёт в «Не записано»</span>
              ) : r.diff < 0 ? (
                <span className="text-warn-ink">
                  В конверте на {money(-r.diff)} больше, чем по записям — возможно, трата записана дважды
                </span>
              ) : (
                <span className="text-ok">Сходится до сомони</span>
              )}
            </p>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
