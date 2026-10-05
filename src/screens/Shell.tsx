import { useEffect, useState } from 'react';
import { CalendarDays, ChartNoAxesColumn, Plus, ReceiptText, Settings } from 'lucide-react';
import { navigableYms, openMonth, sortedYms } from '../domain/months';
import { useApp } from '../ui/context';
import { AddTxSheet } from '../sheets/AddTxSheet';
import { HistoryScreen } from './HistoryScreen';
import { JournalScreen } from './JournalScreen';
import { MonthScreen } from './MonthScreen';
import { SettingsScreen } from './SettingsScreen';

type Tab = 'month' | 'txs' | 'history' | 'settings';

export function Shell() {
  const { state } = useApp();
  const open = openMonth(state);
  const fallbackYm = open?.ym ?? sortedYms(state).slice(-1)[0];
  const [tab, setTab] = useState<Tab>('month');
  const [ym, setYm] = useState(fallbackYm);
  const [journalCat, setJournalCat] = useState('');
  const [adding, setAdding] = useState(false);

  // Месяц пропал (импорт, сброс) — вернуться к открытому.
  useEffect(() => {
    if (!navigableYms(state).includes(ym)) setYm(fallbackYm);
  }, [state, ym, fallbackYm]);

  const go = (t: Tab) => {
    setTab(t);
    window.scrollTo(0, 0);
  };

  return (
    <>
      <div className="mx-auto max-w-[640px]">
        {tab === 'month' && (
          <MonthScreen
            ym={ym}
            setYm={setYm}
            onOpenCategory={(c) => {
              setJournalCat(c);
              go('txs');
            }}
            onOpenSettings={() => go('settings')}
          />
        )}
        {tab === 'txs' && <JournalScreen ym={ym} setYm={setYm} category={journalCat} setCategory={setJournalCat} />}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-card"
        style={{ paddingBottom: 'var(--safe-bottom)', paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
        aria-label="Разделы"
      >
        <ul className="mx-auto grid h-[var(--nav-h)] max-w-[640px] grid-cols-5 items-center">
          <NavItem label="Месяц" icon={CalendarDays} active={tab === 'month'} onClick={() => go('month')} />
          <NavItem
            label="Траты"
            icon={ReceiptText}
            active={tab === 'txs'}
            onClick={() => {
              setJournalCat('');
              go('txs');
            }}
          />
          <li className="flex justify-center">
            <button
              type="button"
              className="-mt-5 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-ink text-white shadow-[0_4px_14px_rgba(22,37,44,0.35)] active:bg-[#0c171c] disabled:bg-[#9AA6AC]"
              aria-label="Записать трату"
              disabled={!open}
              onClick={() => setAdding(true)}
            >
              <Plus size={30} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </li>
          <NavItem label="История" icon={ChartNoAxesColumn} active={tab === 'history'} onClick={() => go('history')} />
          <NavItem label="Настройки" icon={Settings} active={tab === 'settings'} onClick={() => go('settings')} />
        </ul>
      </nav>

      {adding && <AddTxSheet onClose={() => setAdding(false)} />}
    </>
  );
}

function NavItem({ label, icon: Icon, active, onClick }: { label: string; icon: typeof Settings; active: boolean; onClick: () => void }) {
  return (
    <li className="flex justify-center">
      <button
        type="button"
        className={`flex h-[52px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[12px] font-medium ${
          active ? 'text-ink' : 'text-soft'
        }`}
        aria-current={active ? 'page' : undefined}
        onClick={onClick}
      >
        <Icon size={23} strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
        <span>{label}</span>
      </button>
    </li>
  );
}
