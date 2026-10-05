/** Граница между приложением и сервером. Реализации: Supabase и локальная (для разработки). */

export interface SessionInfo {
  uid: string;
  login: string;
}

export type SaveResult = 'ok' | 'conflict';

export interface RemoteBudget {
  state: unknown;
  rev: number;
}

export interface Backend {
  /** Настроен ли сервер. Если нет, приложение показывает подсказку вместо входа. */
  configured: boolean;

  getSession(): Promise<{ session: SessionInfo | null; offline: boolean }>;
  onSessionLost(cb: () => void): () => void;
  signUp(login: string, password: string): Promise<SessionInfo>;
  signIn(login: string, password: string): Promise<SessionInfo>;
  signOut(): Promise<void>;
  changePassword(password: string): Promise<void>;
  deleteAccount(): Promise<void>;

  fetchBudget(uid: string): Promise<RemoteBudget | null>;
  insertBudget(uid: string, state: unknown): Promise<SaveResult>;
  updateBudget(uid: string, state: unknown, baseRev: number): Promise<SaveResult>;
}

/** Ошибка с текстом для пользователя. */
export class UserError extends Error {}

/** Сетевая ошибка: операцию можно повторить позже. */
export class NetworkError extends Error {}

export const LOGIN_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

export function loginError(login: string): string | null {
  const l = normalizeLogin(login);
  if (l.length < 3) return 'Логин — минимум 3 символа';
  if (l.length > 32) return 'Логин — не длиннее 32 символов';
  if (!LOGIN_RE.test(l)) return 'Только латинские буквы, цифры и знаки . _ -';
  return null;
}

export const MIN_PASSWORD = 8;

export function passwordError(pw: string): string | null {
  if (pw.length < MIN_PASSWORD) return `Пароль — минимум ${MIN_PASSWORD} символов`;
  if (pw.length > 72) return 'Пароль — не длиннее 72 символов';
  if (/^\d+$/.test(pw)) return 'Пароль не должен состоять только из цифр';
  return null;
}
