// Run with an ephemeral confirmed test account; never use the owner's password.
// BLAGOVA_TEST_AUTH is JSON { id, email, password }; credentials are never logged.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const fixture = JSON.parse(process.env.BLAGOVA_TEST_AUTH || '{}');
assert.ok(fixture.email && fixture.password && fixture.id, 'Provide ephemeral fixture');
const url = 'https://upmmgdshvgyqivfsyqju.supabase.co';
const key = 'sb_publishable_CW9cxf0XMRGtB88LBKz5IQ_0GNX8C6a';
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(20000) }) },
});
let signedIn = false;
try {
  const denied = await client.from('orders').select('id');
  assert.ok(denied.error, 'Anonymous order reads must fail');
  const login = await client.auth.signInWithPassword({ email: fixture.email, password: fixture.password });
  if (login.error) throw new Error(`Test sign-in failed: ${login.error.code || login.error.status}`);
  signedIn = true;
  const user = await client.auth.getUser();
  assert.equal(user.data.user?.id, fixture.id);
  const member = await client.from('staff_members').select('role,active').eq('user_id', fixture.id).single();
  assert.equal(member.error, null); assert.equal(member.data.role, 'manager'); assert.equal(member.data.active, true);
  const data = await client.from('orders').select('*,order_items(*),order_events(*)').limit(1);
  assert.equal(data.error, null, 'Authenticated query used by admin must work');
  const threads = await client.from('conversations').select('*,customers(display_name)').limit(1);
  assert.equal(threads.error, null);
  const knowledge = await client.from('knowledge_documents').select('*').limit(1);
  assert.equal(knowledge.error, null);
  const escalation = await client.from('staff_members').update({ role: 'owner' }).eq('user_id', fixture.id);
  assert.ok(escalation.error, 'Self promotion denied');
  const catalog = await client.from('knowledge_documents').insert({ slug:'qa-forbidden', title:'QA',locale:'ru',body:'QA' });
  assert.ok(catalog.error, 'Manager publication/editor writes denied');
  const refresh = await client.auth.refreshSession();
  assert.equal(refresh.error, null, 'Session refresh must succeed');
  const signOut = await client.auth.signOut({ scope: 'local' });
  assert.equal(signOut.error, null); signedIn = false;
  assert.equal((await client.auth.getSession()).data.session, null);
  const after = await client.from('orders').select('id');
  assert.ok(after.error, 'Order reads after sign-out must fail');
  console.log('PASS: password sign-in, getUser, staff role, admin queries, write denial, refresh, logout, anonymous denial');
} finally {
  if (signedIn) await client.auth.signOut({ scope: 'local' });
}
