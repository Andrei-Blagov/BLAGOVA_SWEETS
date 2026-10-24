import type { SupabaseClient } from '@supabase/supabase-js';
import type { StaffIdentity } from '../types/studio';

// SDK session initialization/refresh can wait independently of the HTTP request.
// Keep the whole check bounded, and never mutate application state in late work.
export async function readStaffIdentity(client: SupabaseClient, timeoutMs = 20_000): Promise<StaffIdentity | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Проверка доступа заняла слишком много времени. Повторите проверку или войдите снова.'));
    }, timeoutMs);
  });
  const check = async (): Promise<StaffIdentity | null> => {
    const { data, error } = await client.auth.getUser();
    if (controller.signal.aborted) throw new Error('Проверка доступа прервана.');
    if (error || !data.user) return null;
    const { data: member, error: accessError } = await client.from('staff_members')
      .select('role,active').eq('user_id', data.user.id).eq('active', true)
      .abortSignal(controller.signal).maybeSingle();
    if (accessError) throw new Error('Не удалось проверить доступ. Проверьте соединение и повторите.');
    if (!member?.active || !['owner', 'manager'].includes(member.role)) {
      throw new Error('У этой учётной записи нет доступа сотрудника.');
    }
    return { id: data.user.id, email: data.user.email || '', role: member.role };
  };
  try { return await Promise.race([check(), timeout]); }
  finally { clearTimeout(timer!); }
}
