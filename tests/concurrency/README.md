# Real PostgreSQL acceptance

This is independent-session acceptance, not PGlite or a mocked SQL engine.
Run it only on a fresh disposable local cluster with no Supabase roles/data.
It refuses remote hosts and clusters already containing application roles.

The CI verify job runs the pinned official PostgreSQL 16.15 image, reachable
only on runner loopback, installs psycopg 3.3.6 in a temporary venv, and
executes this harness. It requires no repository/environment secrets.
All existing npm audit/test/typecheck/build gates still run.

For a machine with Docker and Node 24:

    docker run --detach --name blagova-concurrency-pg \
      -e POSTGRES_HOST_AUTH_METHOD=trust -p 127.0.0.1:55432:5432 \
      postgres:16.15@sha256:65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65
    # Wait for pg_isready success; do not replace readiness with an arbitrary sleep.
    docker exec blagova-concurrency-pg pg_isready -U postgres
    python3 -m venv /tmp/blagova-concurrency-venv
    /tmp/blagova-concurrency-venv/bin/pip install -r tests/concurrency/requirements.txt
    PGHOST=127.0.0.1 PGPORT=55432 BLAGOVA_DISPOSABLE_PG=1 \
      CONCURRENCY_REPORT=/tmp/blagova-concurrency.json \
      /tmp/blagova-concurrency-venv/bin/python tests/concurrency/postgres_acceptance.py
    docker rm -f blagova-concurrency-pg

Always remove the dedicated container after inspection, including on failure.
The harness creates its own randomly named DB, applies all unmodified
application migrations and four existing rollback SQL suites, and creates
compatible auth/storage scaffolding. Real pgcrypto supplies randomness.
The local synthetic Vault read interface exercises authorization; it does
not run the platform ops script or install/use Cron, pg_net or live Vault.

SQL assertions record backend PIDs, open transactions, transaction IDs,
lock waits and blocking PIDs. Held claim rows additionally reject independent
NOWAIT probes with 55P03. Waiting RPCs must be observed blocked before the
holder commits. Polling is bounded by readiness, not client timestamps/sleep.

The test transport maps the actual worker's RPC calls to genuine SQL on new
independent connections. Two handleRequest calls are held at their claim
transactions until both batches exist. PostgREST, hosted gateway/JWT, Cron
and real provider delivery are outside this evidence.

The separate provider mock prevents every external network request and
uses only example.invalid recipients. It exercises 429, real SQL completion,
staff retry, re-claim and success; keys and serialized request hashes must
match across attempts. It also records the already documented post-claim
order/provider race without changing application mail architecture.

Before dropping its own DB, the harness cancels its saved fixtures through
staff_change_order, asserts zero active orders/reservations, and records
note/attempt/order-event counts. It closes all connections and removes only
the owned temporary DB/roles; the CI service itself is removed by the runner.
The JSON report contains synthetic IDs/tokens and hashes, never credentials
or real customer data. It is retained as a CI artifact for 14 days.

For test/documentation-only pushes, the commit marker [no-preview] skips only
automatic Preview deployment. It does not skip verification or PR CI.
Use it only when application/migration/Edge Function/runtime changes are absent.
Normal application pushes and explicit workflow_dispatch deploy retain the
existing verified-branch/environment deployment path.
