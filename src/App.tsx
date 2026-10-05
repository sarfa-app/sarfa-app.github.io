import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { backend } from './sync';
import type { SessionInfo } from './sync/backend';
import { BudgetStore, clearUserCache } from './sync/store';
import { AppContext, useToday } from './ui/context';
import { ToastProvider } from './ui/Toast';
import { AuthScreen } from './screens/AuthScreen';
import { SetupScreen } from './screens/SetupScreen';
import { Shell } from './screens/Shell';

const LAST_USER = 'sarfa:v1:lastUser';

function readLastUser(): SessionInfo | null {
  try {
    const v = localStorage.getItem(LAST_USER);
    return v ? (JSON.parse(v) as SessionInfo) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);

  useEffect(() => {
    if (!backend.configured) return;
    let alive = true;
    backend
      .getSession()
      .then(({ session: s, offline }) => {
        if (!alive) return;
        // Без сети пускаем к данным, сохранённым на этом устройстве.
        setSession(s ?? (offline ? readLastUser() : null));
      })
      .catch(() => alive && setSession(readLastUser()));
    const off = backend.onSessionLost(() => setSession(null));
    return () => {
      alive = false;
      off();
    };
  }, []);

  const onAuthed = useCallback((s: SessionInfo) => {
    try {
      localStorage.setItem(LAST_USER, JSON.stringify(s));
    } catch {
      /* не критично */
    }
    setSession(s);
  }, []);

  if (!backend.configured) return <NotConfigured />;
  if (session === undefined) return <Splash />;
  if (!session) return <AuthScreen onAuthed={onAuthed} />;
  return (
    <ToastProvider>
      <UserApp key={session.uid} session={session} onLoggedOut={() => setSession(null)} />
    </ToastProvider>
  );
}

function UserApp({ session, onLoggedOut }: { session: SessionInfo; onLoggedOut: () => void }) {
  const store = useMemo(() => new BudgetStore(backend, session.uid), [session.uid]);
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const today = useToday();

  useEffect(() => {
    void store.start();
    return () => store.dispose();
  }, [store]);

  const logout = useCallback(async () => {
    store.dispose();
    await backend.signOut().catch(() => undefined);
    // На общем устройстве после выхода не должно остаться чужих трат.
    clearUserCache(session.uid);
    try {
      localStorage.removeItem(LAST_USER);
    } catch {
      /* не критично */
    }
    onLoggedOut();
  }, [store, session.uid, onLoggedOut]);

  if (snap.phase === 'loading') return <Splash />;
  if (snap.phase === 'error' || (!snap.state && snap.phase !== 'setup')) {
    return (
      <main className="screen flex min-h-[100dvh] flex-col justify-center gap-4">
        <h1 className="text-xl font-semibold">Не получилось загрузить данные</h1>
        <p className="text-soft">{snap.error}</p>
        <div className="flex gap-2">
          <button type="button" className="btn-primary" onClick={() => store.sync()}>
            Повторить
          </button>
          <button type="button" className="btn-quiet" onClick={logout}>
            Выйти
          </button>
        </div>
      </main>
    );
  }
  if (snap.phase === 'setup' || !snap.state) {
    return <SetupScreen login={session.login} today={today} onDone={(s) => store.setup(s)} onLogout={logout} />;
  }

  return (
    <AppContext.Provider value={{ session, store, snap, state: snap.state, dispatch: store.dispatch, logout, today }}>
      <Shell />
    </AppContext.Provider>
  );
}

function Splash() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center" aria-busy="true">
      <span className="text-soft">Загрузка…</span>
    </div>
  );
}

function NotConfigured() {
  return (
    <main className="screen flex min-h-[100dvh] flex-col justify-center gap-3">
      <h1 className="text-xl font-semibold">Сервер не настроен</h1>
      <p className="text-soft">
        Укажите VITE_SUPABASE_URL и VITE_SUPABASE_KEY при сборке. Подробности — в README.
      </p>
    </main>
  );
}
