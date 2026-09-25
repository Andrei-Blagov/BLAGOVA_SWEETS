export interface StaffIdentity { id: string; email: string; role: 'owner' | 'manager' }

export function useStaffAuth() {
  const staff = useState<StaffIdentity | null>('staff-identity', () => null);
  const client = () => useNuxtApp().$supabase;

  async function verify(): Promise<StaffIdentity | null> {
    if (import.meta.server) return null;
    try {
      const { data, error } = await client().auth.getUser();
      if (error || !data.user) { staff.value = null; return null; }
      const { data: member, error: accessError } = await client().from('staff_members')
        .select('role,active').eq('user_id', data.user.id).eq('active', true).maybeSingle();
      if (accessError) throw new Error('Не удалось проверить доступ. Проверьте соединение и повторите.');
      if (!member || !['owner', 'manager'].includes(member.role)) {
        staff.value = null;
        throw new Error('У этой учётной записи нет доступа сотрудника.');
      }
      staff.value = { id: data.user.id, email: data.user.email || '', role: member.role };
      return staff.value;
    } catch (error) { staff.value = null; throw error; }
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
    staff.value = null;
    try { await client().auth.signOut({ scope: 'local' }); }
    finally { await navigateTo('/login', { replace: true }); }
  }
  return { staff, verify, login, logout };
}
