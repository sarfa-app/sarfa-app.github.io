import { Cloud, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { useApp } from './context';

/** Состояние сохранения на сервер — коротко, в шапке экрана. */
export function SyncBadge() {
  const { snap, store } = useApp();
  const map = {
    synced: { icon: Cloud, text: 'Сохранено', cls: 'text-soft' },
    saving: { icon: RefreshCw, text: 'Сохраняю…', cls: 'text-soft' },
    offline: { icon: CloudOff, text: 'Нет сети · на телефоне', cls: 'text-warn-ink' },
    error: { icon: TriangleAlert, text: 'Ошибка сохранения', cls: 'text-over' },
  }[snap.sync];
  const Icon = map.icon;
  return (
    <button
      type="button"
      className={`tap -mr-2 flex items-center gap-1.5 rounded-lg px-2 text-[13px] ${map.cls}`}
      onClick={() => store.sync()}
      aria-label={`${map.text}${snap.pending ? `, не отправлено изменений: ${snap.pending}` : ''}. Нажмите, чтобы синхронизировать`}
      title={snap.error}
    >
      <Icon size={16} aria-hidden="true" />
      <span className="hidden min-[400px]:inline">{map.text}</span>
    </button>
  );
}
