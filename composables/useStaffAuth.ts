import { readStaffIdentity } from '~/utils/staffIdentity';
import type { StaffIdentity } from '~/types/studio';

export function useStaffAuth() {
  const staff = useState<StaffIdentity | null>('staff-identity', () => null);
  const verification = useState<number>('staff-verification', () => 0);
  const client = () => useNuxtApp().$supabase;

  async function verify(): Promise<StaffIdentity | null> {
    if (import.meta.server) return null;
    const current = ++verification.value;
    try {
      const identity = await readStaffIdentity(client());
      if (current !== verification.value) throw new Error('Сессия изменилась. Повторите проверку доступа.');
      staff.value = identity;
      return staff.value;
    } catch (error) {
      if (current === verification.value) { ++verification.value; staff.value = null; }
      throw error;
    }
  }

  async function login(email: string, password: string) {
    const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.status === 429
      ? 'Слишком много попыток. Повторите вход позже.'
      : 'Не удалось войти. Проверьте email, пароль и соединение.');
    try {
      if (!await verify()) throw new Error('Сессия не подтверждена. Повторите вход.');
    } catch (error) {
      await client().auth.signOut({ scope: 'local' });
      throw error;
    }
  }

  async function logout() {
    ++verification.value;
    staff.value = null;
    try { await client().auth.signOut({ scope: 'local' }); }
    finally { await navigateTo('/login', { replace: true }); }
  }
  return { staff, verify, login, logout };
}
