# A2 — local pending intent and durable initial notification

Base: A1 `8cd6c2f7bc484072d737a3b864ce7854f0d8842a`, branch
`fix/preview-release-recovery`. No push, deployment or live migration.

## Separate portability prerequisite

Commit `fa1ce1b` only replaces URL.pathname with fileURLToPath in the existing
disposable SQL harness. Its normal command passed 22 local migrations (including
the A2 scaffold under development) and four existing SQL suites on Windows.
This does not fix or reclassify the old launch-editor Windows regression failure.

## F1 contract and implementation

See [pending-intent-contract.md](pending-intent-contract.md). New service-only
invoker RPCs retain the existing authoritative intake transaction and capacity/
lead-time/RLS checks, adding a private immutable receipt or close fence under the
same request advisory lock. Independent random recovery capability is hashed;
request key alone grants no lookup. Changed payload conflicts before business
mutation; original schedule/cart/price summary excludes contact/address/free text.
Timestamp fingerprint input is UTC-normalized, independent of DB session zone.

Checkout sessionStorage contains only identity/capability/hashes/times for 24h;
full payload stays in memory. Reload resolves before sending. Unknown results
remain blocked until close returns saved or fences late submission. Expiry removes
the token and blocks silent new orders. Success uses the saved summary and keeps
an edited cart. Storage failure stops before sending. Closing the session loses
this recovery channel; unrelated request keys are not semantically deduplicated.

## F1 evidence

- Actual checkout Vue script: timeout after mocked commit, changed date/cart,
  canonical saved date/slot, edited cart preservation, reload without new submit;
  minimal storage/expiry/failure checks passed.
- Actual Edge handler with all local migrations in disposable PGlite: repeat,
  changed date/cart conflicts, wrong/missing token, no receipt PII, closed-key late
  submission, anon/authenticated denial passed.
- Real cached PostgreSQL **17.11** in a newly created network-less Docker container:
  all local migrations and four old SQL suites; independent duplicate sessions,
  held TX observed idle, waiter observed via pg_blocking_pids; one order/receipt;
  changed payload rejection, close fence and lost-response resolution passed.
  Owned DB/roles removed by harness. No hosted Auth/PostgREST/Cron/provider proof.
- Pinned CI PostgreSQL 16.15 image pull failed on Docker CDN DNS/proxy. No proxy or
  network settings changed. Cached 17.11 is local additional evidence, not a claim
  that the pinned CI image ran. Aggregate Linux CI/review remains before publication.

F1 checkpoint: 13/13 focused pending-intent/Edge/stage-2 regressions passed;
TypeScript passed with the known upstream route-block warning; static build
passed, 32 routes. The outbox change follows in a separate commit; this F1
checkpoint does not claim that synchronous initial mail has already been removed.

## Rollout boundaries

New Edge requires a recovery token; do not roll it independently over an old
frontend without a coordinated staging plan. Backend schema/RPC must exist before
new Edge; no live steps performed here. The old receive_storefront_order is still
service-only compatibility, not a tokenless public fallback. Schema/Edge deployed
parity remains explicitly unknown in the manifest. Historical A1/audit acceptance
is preserved, not overwritten by local test results.

## Durable initial outbox (second A2 commit)

The saved-intent insert now enqueues manager and customer receipt notifications
in the existing order_notification_deliveries table, after structured items exist,
in the same transaction as order/receipt/reservation. Unique event keys and the
single saved-intent row prevent duplicate enqueue. Initial request emails are
explicitly pending, not production confirmations. The intake Edge no longer has
provider/email code or provider credentials. No broker or paid API was added.

Existing worker claim/lease/CAS/backoff/manual retry/attempt records are reused.
Demo receipts simulate without delivery; a customer with no email requires manual
contact. Live receipts require explicit NOTIFICATION_SEND_ENABLED plus configured
from/manager/provider values; missing manager email has no hardcoded fallback.
Provider timeout is bounded at 10s. The first live receipt attempt binds a SHA-256
of the exact body to the leased delivery; a changed body/config cannot reuse its
idempotency key silently after an ambiguous result. Staff UI names both initial
receipt events separately. No historical outbox backfill or historical mail send.

Existing supersession/23h/five-attempt rules are unchanged. Delayed receipts can
be quarantined after order changes; post-claim cancellation/provider race remains
the prior documented boundary, not solved by a database outbox. Real provider
acceptance, external idempotency window and deployment still require review.

Outbox focused tests: atomic enqueue and rollback failure, demo with configured
credentials, SQL leases/backoff/staff retry, 429/timeout/success with identical
body/key, unchanged order revision, body conflict fail-closed, RU/EN/TH pending
copy, and no provider code in intake passed. The tests use synthetic data and a
mock provider. TypeScript passed with the known upstream route-block warning.

## Aggregate local results and remaining gates

- Final expanded real PostgreSQL 17.11 disposable run: eight scenarios passed,
  including two observed independent-session lock barriers (duplicate and close
  versus in-flight submit), durable demo outbox, actual worker + mock provider
  retry with stable body/key, and whole-intake rollback on outbox failure. Owned
  DB/roles were removed; the exact owned container was removed afterward too.
- Aggregate local security regression snapshot: **98 passed / 1 failed of 99**. The sole
  failure is the existing Windows launch-editor mock expecting spawn instead of
  exec. It is not hidden, skipped, or fixed in this package. This is not an
  aggregate green CI claim.
- Focused pending/outbox/staff tests passed 14/14; final strict-capability and
  basket-hydration follow-up passed 5/5. Gate/CORS/manifest checks passed 11/11.
- TypeScript passed (known upstream vue-router route-block warning). Final static
  build after the hydration guard passed 32 routes. The normal, portable SQL
  harness passed **23 migrations and four SQL suites**. Manifest validation passed
  all 33 normalized source hashes. Repository and built-assets scanners are
  passed before commit: 296 tracked/staged files and 77 newly built text assets;
  diff checks passed. Final capability/hydration changes were checked by the
  affected 5/5 follow-up; the full aggregate Linux CI remains a later gate.

No real browser/hosted Auth/PostgREST/Cron or provider delivery accepted. Before
publication: independent review plus final aggregate Linux CI on the pinned image.
Before Preview: explicitly coordinated migration/Edge/frontend rollout and A1
recovery drill. Do not promote main, send production mail, or backfill historical
initial notifications as part of this local package.
