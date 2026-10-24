# Order notifications and retry runbook

Stage 3 processes customer confirmation, rescheduling and cancellation through a durable database queue. The order change and its delivery record commit atomically. `confirm-order` and `order-change` only authenticate the staff request and enqueue; a mail failure does not turn a successful order change into a failed request.

## Preview

Every `is_demo=true` delivery is rendered and recorded as `simulated` without calling Resend, even if mail secrets exist. Missing email is `manual_required`. `simulated` has no provider ID or `sent_at`; the interface explicitly says “Демо: отправка проверена”. No real mail or payment integration is enabled by this stage.

The existing `storefront-order` intake acknowledgement to manager/customer is still a separate best-effort path. This worker handles the three staff operation events; moving intake acknowledgements into the same queue is future work before production mail is enabled.

## Queue guarantees

- Payload captures reference, event/revision, name/contact, locale, schedule, saved item descriptions/prices, total and demo flag when the delivery is inserted. Retrying never reconstructs from current catalogue/order values.
- Claim is transactional `FOR UPDATE SKIP LOCKED`. Each attempt gets a random lease token and an audit record. After five minutes an abandoned lease can be reclaimed; completion compares the current token, so an old worker cannot overwrite a new attempt.
- Transport/429/5xx errors use exponential backoff: 2, 4, 8, 16 minutes (up to one hour). Five claims exhaust the delivery and require manual review. Permanent provider/config/contact failures also require manual review.
- Resend idempotency key is `blagova/<kind>/<delivery_id>`. Retry is stopped at 23 hours after the first claim, inside Resend’s 24-hour key lifetime. Do not change sender/reply-to configuration during an active retry window. A provider success with missing/unreadable ID requires review rather than risking another email.
- Older confirmations/transfers are suppressed after a newer transfer/cancellation or a changed schedule; terminal cancelled/completed orders do not get an old confirmation/transfer. The cancellation event remains deliverable. Changes after a job has already been claimed can still race with an external provider; no atomic transaction spans PostgreSQL and email.
- Staff can request an immediate retry of `failed` only, with current order revision. This requeues the existing delivery; it does not confirm, transfer or cancel the order again. Repeated retry requests while pending/sending are idempotent. Successful/simulated deliveries cannot be resent through this API.
- Old unsent rows without a frozen payload are quarantined with `legacy_notification_review`. Existing orders, saved composition and messages are unchanged.
- Raw mail errors/recipients/secrets are excluded from worker responses and logs. Worker replies contain counts only. Attempt status, safe error code and staff retry actor are readable only by active owner/manager.

## Hosted schedule and authentication

Application schema migration: `20261005155537_staff_assignments_and_delivery_worker.sql`. Hosted infrastructure script: `supabase/ops/install_notification_schedule.sql`, applied separately as `install_notification_schedule`. The portable PGlite chain excludes platform extensions.

The script enables `pg_cron` and `pg_net`, stores a newly generated dedicated credential and demo endpoint in Supabase Vault, and upserts `blagova-notification-worker` on `*/2 * * * *`. Re-running preserves the credential. The Cron command looks up Vault values at runtime and does not contain plaintext secrets.

`notification-worker` has `verify_jwt=false` because this is service-to-service authentication. It requires `x-blagova-worker-token` and validates that dedicated token through a service-role-only RPC before claiming anything. A user JWT/publishable key cannot run it. `confirm-order` preserves its existing custom staff RPC authorization; `order-change` preserves `verify_jwt=true` and also rechecks active membership in its staff RPC. All browser preflights return bodyless 204 for approved origins.

Inspection (do not select Vault secret values or HTTP request headers):

```sql
select jobid, jobname, schedule, active from cron.job
where jobname = 'blagova-notification-worker';
select status, start_time, end_time, return_message from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'blagova-notification-worker')
order by start_time desc limit 10;
select status_code, timed_out, content from net._http_response
order by created desc limit 10;
```

A successful Cron SQL run only enqueues HTTP. Verify the HTTP response is 200 and inspect delivery/attempt states as well. Cron history is not automatically retained/pruned; review retention before production. `net._http_response` is transient, so durable delivery attempts are the application history.

Pause/resume the worker through its supported API, not a direct UPDATE of `cron.job`:

```sql
select cron.alter_job(job_id := (select jobid from cron.job
  where jobname = 'blagova-notification-worker'), active := false);
-- After inspection/resolution:
select cron.alter_job(job_id := (select jobid from cron.job
  where jobname = 'blagova-notification-worker'), active := true);
```

## Future live activation

Not authorized by the current demo task. Requires non-demo orders, explicit `NOTIFICATION_SEND_ENABLED=true`, `RESEND_API_KEY`, verified `ORDER_EMAIL_FROM` and `ORDER_EMAIL_MANAGER_TO`. Keep secrets in Edge secrets/Vault, never frontend/VPS/git. Thai copy remains a draft pending a native speaker. Live provider acceptance is mocked in regression tests; live sending is not acceptance-tested here.

## Rollback

App Preview rollback remains `docs/PREVIEW_DEPLOYMENT.md`; the new RPC default filter remains compatible with the previous app. Keep the new enqueue-only Edge Functions/worker when rolling back UI. Do not restore the old unleased claim/complete grants: they bypass lease protection. To halt deliveries, pause the job; saved orders and pending queue stay intact. Never delete deliveries to repair a failed email. A manual review should reconcile provider state before any future explicit resend outside the safe window.

## Independent-session acceptance — 7 October 2026

See [concurrency acceptance](concurrency-acceptance-20261007.md) and the two raw
PG evidence JSON files. Both CI PostgreSQL jobs passed with the unmodified
application migrations/RPC, independent held transactions and observable locks.
Actual TypeScript worker handlers used a local SQL transport bridge and a
separate in-memory provider mock. Keys and exact request-body hashes stayed
stable across a real SQL retry/reclaim. No hosted PostgREST, Cron or real mail
provider delivery is asserted.

The post-claim race was observed directly: after a committed cancellation but
before processJob, the frozen confirmation still reached the mock and completed
as sent. CAS protects lease ownership; it does not atomically couple the
provider call to current order state. This existing limitation remains a
separate future mail decision. Application mail architecture was not changed.

Test fixtures, auth/storage and synthetic Vault read interface were confined
to disposable CI databases; no hosted Cron/Vault/auth or live data was used.
All fixtures were cancelled through staff_change_order before connection/DB
cleanup; synthetic audit is retained in git. The overall CI is currently red
on the unchanged full audit because shell-quote 1.10.0 gained a critical
advisory; this is separate from successful concurrency acceptance.
