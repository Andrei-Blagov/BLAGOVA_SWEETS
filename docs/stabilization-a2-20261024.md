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
