import { createClient } from '@supabase/supabase-js';

// Independent public client: a signed-in manager must not turn a public listing
// into an authenticated query against owner-only catalog policies.
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig().public;
  const catalogDb = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { storageKey:'blagova-public-catalog-v1', persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
  });
  return { provide:{ catalogDb } };
});
