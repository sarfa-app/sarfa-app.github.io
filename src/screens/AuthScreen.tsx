import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { backend } from '../sync';
import { loginError, MIN_PASSWORD, passwordError, type SessionInfo } from '../sync/backend';
import { Logo } from '../ui/Logo';

type Mode = 'login' | 'register';

export function AuthScreen({ onAuthed }: { onAuthed: (s: SessionInfo) => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const le = loginError(login);
    if (le) return setError(le);
    if (mode === 'register') {
      const pe = passwordError(password);
      if (pe) return setError(pe);
      if (password !== password2) return setError('Пароли не совпадают');
    } else if (!password) {
      return setError('Введите пароль');
    }
    setBusy(true);
    try {
      const s = mode === 'login' ? await backend.signIn(login, password) : await backend.signUp(login, password);
      onAuthed(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setPassword('');
    setPassword2('');
  };

  return (
    <main className="screen mx-auto flex min-h-[100dvh] max-w-[440px] flex-col justify-center !pb-10">
      <div className="mb-8 flex items-center gap-3">
        <Logo size={52} />
        <div>
          <h1 className="text-[28px] font-bold leading-none tracking-tight">Сарфа</h1>
          <p className="mt-1 text-soft">Бюджет по конвертам</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 rounded-lg bg-card p-1" role="tablist" aria-label="Вход или регистрация">
        {(['login', 'register'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={`tap rounded-md text-[15px] font-semibold ${mode === m ? 'bg-ink text-white' : 'text-soft'}`}
            onClick={() => switchMode(m)}
          >
            {m === 'login' ? 'Вход' : 'Регистрация'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor="auth-login" className="label">
            Логин
          </label>
          <input
            id="auth-login"
            className="field mt-1"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            aria-describedby={mode === 'register' ? 'login-hint' : undefined}
          />
          {mode === 'register' && (
            <span id="login-hint" className="mt-1 block text-sm text-soft">
              Латинские буквы, цифры, точка, дефис. Почта не нужна.
            </span>
          )}
        </div>

        <div>
          <label htmlFor="auth-pw" className="label">
            Пароль
          </label>
          <div className="relative mt-1">
            <input
              id="auth-pw"
              className="field pr-12"
              type={show ? 'text' : 'password'}
              name="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={mode === 'register' ? 'pw-hint' : undefined}
            />
            <button
              type="button"
              className="tap absolute right-0 top-0 flex items-center justify-center text-soft"
              onClick={() => setShow(!show)}
              aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
              aria-pressed={show}
            >
              {show ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            </button>
          </div>
          {mode === 'register' && (
            <span id="pw-hint" className="mt-1 block text-sm text-soft">
              Минимум {MIN_PASSWORD} символов. Восстановить пароль без почты нельзя — запишите его.
            </span>
          )}
        </div>

        {mode === 'register' && (
          <label className="block">
            <span className="label">Пароль ещё раз</span>
            <input
              className="field mt-1"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
          </label>
        )}

        <div aria-live="assertive" className="min-h-[1.25rem]">
          {error && <p className="text-[15px] font-medium text-over">{error}</p>}
        </div>

        <button type="submit" className="btn-primary h-12 text-[17px]" disabled={busy}>
          {busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
        </button>
      </form>

      <p className="mt-8 text-sm leading-relaxed text-soft">
        Ваши траты видите только вы: сервер отдаёт данные лишь владельцу аккаунта, пароль хранится в виде хэша.
      </p>
    </main>
  );
}
