import { useMemo, useState } from 'react';
import { Banknote, CreditCard, Search } from 'lucide-react';
import { CATEGORIES, getCategory, getFund, SHORT_NAME } from '../domain/constants';
import { dayLabel } from '../domain/dates';
import { money, plural } from '../domain/format';
import type { Tx } from '../domain/types';
import { useApp } from '../ui/context';
import { MonthNav } from '../ui/MonthNav';
import { EditTxSheet } from '../sheets/EditTxSheet';

/** §5.3: журнал за месяц по дням, свежие сверху. */
export function JournalScreen({
  ym,
  setYm,
  category,
  setCategory,
}: {
  ym: string;
  setYm: (ym: string) => void;
  category: string;
  setCategory: (c: string) => void;
}) {
  const { state } = useApp();
  const m = state.months[ym];
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Tx | null>(null);

  const filtered = useMemo(() => {
    if (!m) return [];
    const q = query.trim().toLowerCase();
    return m.txs
      .filter((t) => (category ? t.categoryId === category : true))
      .filter((t) => (q ? t.note.toLowerCase().includes(q) : true))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [m, category, query]);

  const groups = useMemo(() => {
    const g: { date: string; txs: Tx[]; total: number }[] = [];
    for (const t of filtered) {
      const last = g[g.length - 1];
      if (last && last.date === t.date) {
        last.txs.push(t);
        last.total += t.amount;
      } else g.push({ date: t.date, txs: [t], total: t.amount });
    }
    return g;
  }, [filtered]);

  const total = filtered.reduce((a, t) => a + t.amount, 0);
  const usedCats = m ? CATEGORIES.filter((c) => m.txs.some((t) => t.categoryId === c.id)) : [];

  return (
    <main className="screen">
      <MonthNav ym={ym} setYm={setYm} />
      {!m ? (
        <p className="mt-6 text-soft">В этом месяце ещё нет трат.</p>
      ) : (
        <>
          <p className="pb-2 text-[15px]" aria-live="polite">
            <span className="font-semibold">
              {filtered.length} {plural(filtered.length, 'трата', 'траты', 'трат')}
            </span>{' '}
            на <span className="num font-semibold">{money(total)}</span>
            {(category || query) && <span className="text-soft"> · с фильтром</span>}
          </p>

          <div className="flex gap-2 pb-3">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Поиск по заметке</span>
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
              <input className="field pl-9" placeholder="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} type="search" />
            </label>
            <label className="w-[42%] shrink-0">
              <span className="sr-only">Категория</span>
              <select className="field appearance-none bg-card pr-2 text-[15px]" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Все категории</option>
                {usedCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {category && !usedCats.some((c) => c.id === category) && (
                  <option value={category}>{getCategory(category)?.name}</option>
                )}
              </select>
            </label>
          </div>

          {groups.length === 0 && <p className="py-6 text-center text-soft">{m.txs.length ? 'Ничего не нашлось' : 'Трат пока нет'}</p>}

          {groups.map((g) => (
            <section key={g.date} className="mb-3 bg-card" aria-label={dayLabel(g.date)}>
              <h2 className="flex justify-between border-b border-rule px-4 py-2 text-sm">
                <span className="font-semibold">{dayLabel(g.date)}</span>
                <span className="num text-soft">{money(g.total)}</span>
              </h2>
              <ul>
                {g.txs.map((t) => (
                  <li key={t.id} className="border-t border-rule first:border-t-0">
                    <TxRow tx={t} onClick={() => setEditing(t)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
      {editing && m && <EditTxSheet m={m} tx={m.txs.find((t) => t.id === editing.id) ?? editing} onClose={() => setEditing(null)} />}
    </main>
  );
}

function TxRow({ tx, onClick }: { tx: Tx; onClick: () => void }) {
  const cat = getCategory(tx.categoryId);
  const fund = tx.fundId ? getFund(tx.fundId) : undefined;
  const PayIcon = tx.payment === 'cash' ? Banknote : CreditCard;
  return (
    <button type="button" className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-paper" onClick={onClick}>
      <PayIcon size={18} className="shrink-0 text-faint" aria-label={tx.payment === 'cash' ? 'Наличка' : 'Карта'} />
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[15px] ${cat?.system ? 'font-medium text-over' : ''}`}>{tx.note || cat?.name}</div>
        <div className="truncate text-sm text-soft">
          {SHORT_NAME[tx.categoryId] ?? cat?.name}
          {fund && <span className="text-ok"> · из фонда</span>}
          {tx.fromMain > 0 && <span className="text-warn-ink"> · {money(tx.fromMain)} с основного</span>}
        </div>
      </div>
      <span className="num shrink-0 font-semibold">{money(tx.amount)}</span>
    </button>
  );
}
