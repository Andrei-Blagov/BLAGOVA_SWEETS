import type { StaffIdentity } from '~/composables/useStaffAuth';
import { createClient } from '@supabase/supabase-js';

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig().public;
  const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  const staff = useState<StaffIdentity | null>('staff-identity', () => null);
  // Keep callbacks synchronous: awaiting an Auth call here can deadlock the SDK.
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session || (staff.value && staff.value.id !== session.user.id)) {
      staff.value = null;
    }
  });
  return { provide: { supabase } };
});
