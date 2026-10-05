import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthTitle } from '../domain/dates';
import { navigableYms } from '../domain/months';
import { useApp } from './context';
import { SyncBadge } from './SyncBadge';

/** Шапка с переключением месяцев: существующие плюс один следующий (§4.8). */
export function MonthNav({ ym, setYm, suffix }: { ym: string; setYm: (ym: string) => void; suffix?: string }) {
  const { state } = useApp();
  const yms = navigableYms(state);
  const i = yms.indexOf(ym);
  const prev = i > 0 ? yms[i - 1] : undefined;
  const next = i >= 0 && i < yms.length - 1 ? yms[i + 1] : undefined;
  return (
    <header className="flex items-center gap-1 pb-2">
      <button
        type="button"
        className="tap -ml-3 flex items-center justify-center rounded-lg text-ink disabled:text-rule"
        disabled={!prev}
        onClick={() => prev && setYm(prev)}
        aria-label={prev ? `Предыдущий месяц: ${monthTitle(prev)}` : 'Предыдущего месяца нет'}
      >
        <ChevronLeft size={24} aria-hidden="true" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold" aria-live="polite">
        {monthTitle(ym)}
        {suffix && <span className="font-normal text-soft"> · {suffix}</span>}
      </h1>
      <button
        type="button"
        className="tap flex items-center justify-center rounded-lg text-ink disabled:text-rule"
        disabled={!next}
        onClick={() => next && setYm(next)}
        aria-label={next ? `Следующий месяц: ${monthTitle(next)}` : 'Следующего месяца нет'}
      >
        <ChevronRight size={24} aria-hidden="true" />
      </button>
      <SyncBadge />
    </header>
  );
}
