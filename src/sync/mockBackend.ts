/**
 * Локальный «сервер» для разработки и автотестов интерфейса: аккаунты и данные лежат
 * в localStorage этого браузера. В рабочую сборку не попадает (см. src/sync/index.ts).
 */
import { normalizeLogin, UserError, type Backend, type RemoteBudget, type SessionInfo } from './backend';

const USERS = 'mock:users';
const SESSION = 'mock:session';
const budgetKey = (uid: string) => `mock:budget:${uid}`;

type Users = Record<string, { uid: string; password: string }>;

const read = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const delay = () => new Promise((r) => setTimeout(r, 120));

export function createMockBackend(): Backend {
  const listeners = new Set<() => void>();
  return {
    configured: true,

    async getSession() {
      return { session: read<SessionInfo | null>(SESSION, null), offline: false };
    },

    onSessionLost(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    async signUp(login, password) {
      await delay();
      const users = read<Users>(USERS, {});
      const l = normalizeLogin(login);
      if (users[l]) throw new UserError('Такой логин уже занят');
      const uid = `mock-${Math.random().toString(36).slice(2, 10)}`;
      users[l] = { uid, password };
      write(USERS, users);
      const s = { uid, login: l };
      write(SESSION, s);
      return s;
    },

    async signIn(login, password) {
      await delay();
      const u = read<Users>(USERS, {})[normalizeLogin(login)];
      if (!u || u.password !== password) throw new UserError('Неверный логин или пароль');
      const s = { uid: u.uid, login: normalizeLogin(login) };
      write(SESSION, s);
      return s;
    },

    async signOut() {
      localStorage.removeItem(SESSION);
    },

    async changePassword(password) {
      const s = read<SessionInfo | null>(SESSION, null);
      const users = read<Users>(USERS, {});
      if (s && users[s.login]) {
        users[s.login].password = password;
        write(USERS, users);
      }
    },

    async deleteAccount() {
      const s = read<SessionInfo | null>(SESSION, null);
      if (!s) return;
      const users = read<Users>(USERS, {});
      delete users[s.login];
      write(USERS, users);
      localStorage.removeItem(budgetKey(s.uid));
      localStorage.removeItem(SESSION);
    },

    async fetchBudget(uid) {
      await delay();
      return read<RemoteBudget | null>(budgetKey(uid), null);
    },

    async insertBudget(uid, state) {
      await delay();
      if (read(budgetKey(uid), null)) return 'conflict';
      write(budgetKey(uid), { state, rev: 1 });
      return 'ok';
    },

    async updateBudget(uid, state, baseRev) {
      await delay();
      const cur = read<RemoteBudget | null>(budgetKey(uid), null);
      if (!cur || cur.rev !== baseRev) return 'conflict';
      write(budgetKey(uid), { state, rev: baseRev + 1 });
      return 'ok';
    },
  };
}
