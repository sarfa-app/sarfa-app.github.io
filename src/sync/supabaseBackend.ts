import { createClient, isAuthRetryableFetchError, type AuthError, type Session } from '@supabase/supabase-js';
import {
  NetworkError,
  normalizeLogin,
  UserError,
  type Backend,
  type RemoteBudget,
  type SaveResult,
  type SessionInfo,
} from './backend';

/**
 * Вход по логину: Supabase Auth работает с email, поэтому логин превращается в служебный
 * адрес. Письма на него не отправляются (подтверждение email в проекте выключено).
 */
const LOGIN_DOMAIN = 'sarfa.local';

const toEmail = (login: string) => `${normalizeLogin(login)}@${LOGIN_DOMAIN}`;

function toSession(s: Session | null): SessionInfo | null {
  if (!s) return null;
  const email = s.user.email ?? '';
  const login = email.endsWith(`@${LOGIN_DOMAIN}`) ? email.slice(0, -LOGIN_DOMAIN.length - 1) : email;
  return { uid: s.user.id, login };
}

function authMessage(e: AuthError): Error {
  if (isAuthRetryableFetchError(e)) return new NetworkError('Нет связи с сервером. Проверьте интернет.');
  switch (e.code) {
    case 'invalid_credentials':
      return new UserError('Неверный логин или пароль');
    case 'user_already_exists':
    case 'email_exists':
      return new UserError('Такой логин уже занят');
    case 'weak_password':
      return new UserError('Слишком простой пароль. Добавьте буквы и цифры.');
    case 'same_password':
      return new UserError('Новый пароль совпадает со старым');
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return new UserError('Слишком много попыток. Подождите пару минут.');
    case 'signup_disabled':
    case 'email_provider_disabled':
      return new UserError('Регистрация на сервере отключена');
    case 'email_not_confirmed':
    case 'email_address_invalid':
    case 'email_address_not_authorized':
      return new UserError(
        'Сервер требует подтверждение email. В Supabase выключите Authentication → Email → Confirm email.',
      );
  }
  if (e.status === 0 || e.status === undefined) return new NetworkError('Нет связи с сервером. Проверьте интернет.');
  return new UserError('Сервер отклонил запрос. Попробуйте ещё раз.');
}

function isNetworkLike(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = (err.message ?? '').toLowerCase();
  return m.includes('fetch') || m.includes('network') || m.includes('load failed');
}

export function createSupabaseBackend(url: string, key: string): Backend {
  const sb = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'sarfa-auth' },
  });

  async function dbError(err: { message?: string; code?: string; status?: number } | null): Promise<never> {
    if (isNetworkLike(err)) throw new NetworkError('Нет связи с сервером');
    // Просроченный токен: обновляем и даём повторить позже.
    if (err?.code === 'PGRST301' || err?.code === 'PGRST303' || err?.status === 401) {
      await sb.auth.refreshSession().catch(() => undefined);
      throw new NetworkError('Сессия обновляется');
    }
    throw new Error(err?.message ?? 'Ошибка сервера');
  }

  return {
    configured: true,

    async getSession() {
      const { data, error } = await sb.auth.getSession();
      if (error && isAuthRetryableFetchError(error)) return { session: null, offline: true };
      return { session: toSession(data.session), offline: false };
    },

    onSessionLost(cb) {
      const { data } = sb.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') cb();
      });
      return () => data.subscription.unsubscribe();
    },

    async signUp(login, password) {
      const { data, error } = await sb.auth.signUp({ email: toEmail(login), password });
      if (error) throw authMessage(error);
      // Если сервер вернул пользователя без сессии — значит, включено подтверждение email.
      if (!data.session) {
        throw new UserError('Сервер требует подтверждение email. В Supabase выключите Authentication → Email → Confirm email.');
      }
      return toSession(data.session)!;
    },

    async signIn(login, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email: toEmail(login), password });
      if (error) throw authMessage(error);
      return toSession(data.session)!;
    },

    async signOut() {
      await sb.auth.signOut({ scope: 'local' });
    },

    async changePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw authMessage(error);
    },

    async deleteAccount() {
      const { error } = await sb.rpc('delete_my_account');
      if (error) {
        if (isNetworkLike(error)) throw new NetworkError('Нет связи с сервером');
        throw new UserError('Не удалось удалить аккаунт');
      }
      await sb.auth.signOut({ scope: 'local' }).catch(() => undefined);
    },

    async fetchBudget(uid): Promise<RemoteBudget | null> {
      const { data, error } = await sb.from('budgets').select('state, rev').eq('user_id', uid).maybeSingle();
      if (error) return dbError(error);
      return data ? { state: data.state, rev: Number(data.rev) } : null;
    },

    async insertBudget(uid, state): Promise<SaveResult> {
      const { error } = await sb.from('budgets').insert({ user_id: uid, state, rev: 1 });
      if (!error) return 'ok';
      if (error.code === '23505') return 'conflict';
      return dbError(error);
    },

    async updateBudget(uid, state, baseRev): Promise<SaveResult> {
      const { data, error } = await sb
        .from('budgets')
        .update({ state, rev: baseRev + 1 })
        .eq('user_id', uid)
        .eq('rev', baseRev)
        .select('rev');
      if (error) return dbError(error);
      return data && data.length === 1 ? 'ok' : 'conflict';
    },
  };
}
