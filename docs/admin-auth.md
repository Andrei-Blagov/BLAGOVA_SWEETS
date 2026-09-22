# Staff workspace

`/login` authenticates through Supabase Auth. `/admin` verifies active staff membership and loads database records; `/demo-admin` keeps the isolated browser demonstration.

The browser uses only the public publishable key. RLS protects reads. Staff RPC functions enforce membership, order revision and conversation ownership on mutations. Orders have status history; scheduling uses Asia/Bangkok. Manager replies are idempotent. Only owners edit and publish knowledge. Sign-out clears displayed data; access is rechecked on focus and every minute.

Website checkout and the chat order form create `is_demo` applications through `storefront-order`. Storefront chat sessions, messages, manager handoff and staff replies are stored in Supabase and delivered back to the visitor by polling. The deterministic assistant still searches local seed knowledge; published `knowledge_documents` are not yet the storefront search source. LINE, Google Calendar, embeddings and generative LLM remain disconnected.

Orders paginate by 100. Current calendar and summary cover the loaded page, so they are not reliable full-dataset metrics. Conversations, messages and knowledge load recent records with similar limits. This must be replaced by server pagination and aggregate queries.

Validation includes the production build, anonymous redirect, disposable manager login/refresh/logout and SQL transaction tests. Never use owner credentials in tests. `tests/supabase-auth.mjs` requires a separately provisioned disposable confirmed manager through `BLAGOVA_TEST_AUTH`.

The Free plan cannot enable leaked-password protection. Current Auth policy requires at least eight characters, lower and upper case, a digit and a special character. Security Advisor therefore keeps the expected leaked-password warning. `production_slots` and `production_blackout_dates` have RLS without user policies because only `service_role` may access them; re-check this closed access model after schedule-schema changes.
