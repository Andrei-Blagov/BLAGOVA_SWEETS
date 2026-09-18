# Staff workspace

`/login` authenticates through Supabase Auth. `/admin` verifies the active staff membership and loads real database records; `/demo-admin` retains local demonstration data. The verified owner account has been activated.

The browser uses only the public publishable key. RLS protects reads. Staff RPC functions enforce active membership, order revisions and conversation ownership on every mutation. Orders have a status history; rescheduling uses Asia/Bangkok. Manager replies are idempotent. Only owners edit and publish knowledge. Sign-out clears the displayed data; access is rechecked on focus and every minute.

Orders paginate by 100. Calendar and summary cover the loaded page. Conversations, messages and knowledge show the latest 100 records. Website checkout and public chat still use local demo storage; replies in the real workspace are database records, not delivered customer messages. LINE, Google Calendar, embeddings and LLM remain disconnected; integration jobs remain held.

Validation: production static build; anonymous redirect; temporary manager password login, refresh and logout using the real SDK; SQL transaction tests in tests/staff-actions.sql. All fixtures were removed or rolled back. tests/supabase-auth.mjs requires a separately provisioned disposable confirmed manager account through BLAGOVA_TEST_AUTH, never owner credentials.

Supabase security advisor reports no database findings. Leaked-password protection is currently disabled in Auth; see https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection before production launch.
