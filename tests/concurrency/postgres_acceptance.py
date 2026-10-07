"""Real PostgreSQL acceptance. Creates/drops its own empty DB; never accepts a remote DSN.

Requires a disposable local PG superuser and psycopg[binary]==3.3.6. No production
credentials, extensions for Cron/network, or application function replacements.
"""
import concurrent.futures
import contextlib
import hashlib
import http.server
import json
import os
from pathlib import Path
import subprocess
import threading
import time
import uuid

import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[2]
REPORT = Path(os.environ.get("CONCURRENCY_REPORT", "/tmp/blagova-concurrency.json"))
HOST = os.environ.get("PGHOST", "127.0.0.1")
if HOST not in ("127.0.0.1", "::1", "localhost"):
    raise SystemExit("Only disposable loopback PostgreSQL is permitted")
DB = "blagova_concurrency_" + uuid.uuid4().hex
OWNER, MANAGER = uuid.uuid4(), uuid.uuid4()
TOKEN = "local-fixture-only-" + "x" * 48
evidence = {"source_sha": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
            "environment": "disposable loopback PostgreSQL", "scenarios": [], "overlap": [],
            "migration_hashes": {}, "limits": ["auth/storage compatibility scaffolding; not full Supabase",
            "mock provider only; no real email, network provider or hosted Cron acceptance"]}
pool = concurrent.futures.ThreadPoolExecutor(max_workers=6)
connections = []
admin = monitor = None
order_number = 0


def connect(role=None, actor=OWNER, name="qa"):
    c = psycopg.connect(host=HOST, port=os.environ.get("PGPORT", "5432"),
                        user=os.environ.get("PGUSER", "postgres"),
                        password=os.environ.get("PGPASSWORD", ""), dbname=DB,
                        autocommit=True, application_name=name)
    connections.append(c)
    c.execute("set statement_timeout='12s'")
    c.execute("set lock_timeout='10s'")
    if role:
        c.execute(sql.SQL("set role {}").format(sql.Identifier(role)))
    if role == "authenticated":
        c.execute("select set_config('request.jwt.claim.sub',%s,false)", (str(actor),))
    return c


def scalar(c, query, params=()):
    return c.execute(query, params).fetchone()[0]


def check(value, message):
    if not value:
        raise AssertionError(message)


def record(name, **facts):
    evidence["scenarios"].append({"name": name, "status": "passed", **facts})
    print("PASS", name, flush=True)


def snapshot(order):
    return scalar(admin, """select jsonb_build_object('order',to_jsonb(o),
      'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.order_items i where i.order_id=o.id),'[]'),
      'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.revision) from public.order_events e where e.order_id=o.id),'[]'),
      'integration',coalesce((select jsonb_agg(to_jsonb(j) order by j.id) from private.integration_jobs j where j.order_id=o.id),'[]'))
      from public.orders o where o.id=%s""", (order,))


def rev(order):
    return scalar(admin, "select revision from public.orders where id=%s", (order,))


def order(live=False):
    global order_number
    order_number += 1
    # One structured cake per distinct future day; actual public intake/price/load.
    starts = scalar(admin, """select (((clock_timestamp() at time zone 'Asia/Bangkok')::date
      + %s)+time '09:00') at time zone 'Asia/Bangkok'""", (365 + order_number,))
    oid = scalar(admin, """select order_id from public.receive_storefront_order(
      %s,'website','ru','Concurrency QA','concurrency@example.invalid','pickup','','pickup',
      %s,%s+interval '3 hours','','[{"sku":"berry-cloud-1kg","quantity":1}]','[]',%s)""",
      (uuid.uuid4(), starts, starts, uuid.uuid4().hex * 2))
    if live:
        # Synthetic local non-demo flag exercises the enable/provider branch only.
        admin.execute("update public.orders set is_demo=false where id=%s", (oid,))
    return oid


def delivery(kind="confirmation", live=False):
    oid = order(live)
    with connect("authenticated") as c:
        scalar(c, "select public.staff_confirm_order(%s,%s)", (oid, rev(oid)))
        if kind == "change":
            scalar(c, "select public.staff_change_order(%s,%s,'reschedule',"
                      "(select scheduled_start+interval '1 day' from public.orders where id=%s),"
                      "(select scheduled_end+interval '1 day' from public.orders where id=%s))",
                   (oid, rev(oid), oid, oid))
            # Older confirmation is terminal in this fixture, not another queue candidate.
            admin.execute("update public.order_notification_deliveries set status='manual_required',"
                          "last_error='superseded_notification' where order_id=%s", (oid,))
    table = "order_notification_deliveries" if kind == "confirmation" else "order_change_deliveries"
    did = scalar(admin, sql.SQL("select id from public.{} where order_id=%s").format(sql.Identifier(table)), (oid,))
    return oid, did


def note(c, oid, revision, nid, body):
    return scalar(c, "select public.staff_add_order_note(%s,%s,%s,%s)", (oid, revision, nid, body))


def claim(c, limit=5):
    return scalar(c, "select public.claim_order_deliveries(%s)", (limit,))


def complete(c, job, status="simulated"):
    return scalar(c, "select public.complete_order_delivery(%s,%s,%s,%s,%s,null)",
                  (job["kind"], job["id"], job["lease_token"], status,
                   "mock-provider" if status == "sent" else None))


def activity(pids):
    rows = monitor.execute("""select pid,state,wait_event_type,wait_event,backend_xid::text,
      pg_blocking_pids(pid),xact_start is not null from pg_stat_activity
      where pid=any(%s) order by pid""", (pids,)).fetchall()
    return [{"pid": r[0], "state": r[1], "wait_type": r[2], "wait_event": r[3],
             "xid": r[4], "blocking_pids": r[5], "transaction_open": r[6]} for r in rows]


def blocked(label, holder, waiter, future):
    hp, wp = holder.info.backend_pid, waiter.info.backend_pid
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        rows = activity([hp, wp])
        waiting = next((r for r in rows if r["pid"] == wp), None)
        holding = next((r for r in rows if r["pid"] == hp), None)
        if waiting and hp in waiting["blocking_pids"] and waiting["wait_type"] == "Lock":
            check(holding["transaction_open"] and holding["state"] == "idle in transaction",
                  "holder must remain open while waiter blocks")
            check(not future.done(), "waiter must still be pending")
            locks = monitor.execute("""select pid,locktype,mode,granted from pg_locks
              where pid=any(%s) and locktype in ('transactionid','tuple') order by pid,locktype,granted""",
              ([hp, wp],)).fetchall()
            evidence["overlap"].append({"label": label, "activity": rows, "locks": locks})
            return
        check(not future.done(), label + ": RPC completed before observable barrier")
        # Bounded readiness poll, not a timing-based assertion.
        threading.Event().wait(.01)
    raise AssertionError(label + ": no PostgreSQL blocking relationship")


def race(label, first, second, expect_error=None, role="authenticated", second_actor=OWNER):
    a, b = connect(role, name=label + "-a"), connect(role, actor=second_actor, name=label + "-b")
    try:
        a.execute("begin")
        result = first(a)
        b.execute("begin")
        future = pool.submit(second, b)
        blocked(label, a, b, future)
        a.execute("commit")
        if expect_error:
            try:
                future.result(12)
                raise AssertionError(label + ": expected rejection")
            except psycopg.Error as error:
                check(error.sqlstate == expect_error[0], (label, error.sqlstate, str(error)))
                if expect_error[1]:
                    check(str(error).startswith(expect_error[1]), label + ": wrong contract error")
                b.execute("rollback")
                return result, error.sqlstate
        result2 = future.result(12)
        b.execute("commit")
        return result, result2
    finally:
        # Rollback releases locks even on assertion failure; no dangling futures.
        for c in (a, b):
            if not c.closed:
                c.execute("rollback")
                c.close()


def sql_scenarios():
    fixtures = [delivery("confirmation") for _ in range(2)] + [delivery("change") for _ in range(2)]
    before = {str(o): snapshot(o) for o, _ in fixtures}
    a, b = connect("service_role", name="claim-a"), connect("service_role", name="claim-b")
    try:
        a.execute("begin")
        ja = claim(a, 2)
        b.execute("begin")
        jb = claim(b, 2)
        check(len(ja) == len(jb) == 2, "both workers claim a full batch")
        ids_a, ids_b = {j["id"] for j in ja}, {j["id"] for j in jb}
        check(ids_a.isdisjoint(ids_b), "SKIP LOCKED must skip the held first batch")
        check(ids_a | ids_b == {str(d) for _, d in fixtures}, "exact fixture coverage")
        rows = activity([a.info.backend_pid, b.info.backend_pid])
        check(len(rows) == 2 and all(r["state"] == "idle in transaction" and r["transaction_open"] and r["xid"] for r in rows),
              "two simultaneous real transactions")
        evidence["overlap"].append({"label": "claim-skip-locked", "activity": rows,
                                    "ids_a": sorted(ids_a), "ids_b": sorted(ids_b)})
        for job in ja + jb:
            table = "order_notification_deliveries" if job["kind"] == "confirmation" else "order_change_deliveries"
            try:
                monitor.execute(sql.SQL("select id from public.{} where id=%s for update nowait").format(sql.Identifier(table)), (job["id"],))
                raise AssertionError("claimed row is not held")
            except psycopg.errors.LockNotAvailable:
                pass
        a.execute("commit")
        b.execute("commit")
        # Two completions compete on each same token: exactly one wins.
        for job in ja + jb:
            results = race("complete-" + job["kind"], lambda c: complete(c, job),
                           lambda c: complete(c, job), role="service_role")
            check(results == (True, False), "double completion must be CAS false")
            check(scalar(admin, "select count(*) from public.order_delivery_attempts where delivery_id=%s", (job["id"],)) == 1,
                  "one attempt/audit per first claim")
        check(all(snapshot(o) == before[str(o)] for o, _ in fixtures), "worker cannot alter business state")
        record("worker parallel claim and completion", batches=[sorted(ids_a), sorted(ids_b)],
               row_lock_probe="55P03 for all four held rows", attempts=4, completion_results=[True, False])
    finally:
        a.close()
        b.close()

    for kind in ("confirmation", "change"):
        oid, did = delivery(kind)
        crash = connect("service_role", name="crashed-worker")
        old = claim(crash, 1)[0]
        crash_pid = crash.info.backend_pid
        crash.close()  # claim committed, process gone before provider/completion
        table = "order_notification_deliveries" if kind == "confirmation" else "order_change_deliveries"
        admin.execute(sql.SQL("update public.{} set locked_at=clock_timestamp()-interval '6 minutes' where id=%s")
                      .format(sql.Identifier(table)), (did,))
        captured = {}

        def reclaim(c):
            new = claim(c, 1)[0]
            check(new["id"] == old["id"] and new["lease_token"] != old["lease_token"] and new["attempt"] == 2,
                  "real reclaim changes owner/token")
            captured["new"] = new
            check(complete(c, new), "new token completion")
            return new

        new, late = race("reclaim-" + kind, reclaim, lambda c: complete(c, old, "sent"), role="service_role")
        check(late is False, "late stale token cannot change the new owner outcome")
        states = admin.execute("select attempt,status from public.order_delivery_attempts where delivery_id=%s order by attempt", (did,)).fetchall()
        check(states == [(1, "lease_expired"), (2, "simulated")], "exact crash/reclaim audit")
        state = scalar(admin, sql.SQL("select jsonb_build_object('status',status,'attempts',attempts,'sent_at',sent_at,'provider',provider_message_id) from public.{} where id=%s")
                       .format(sql.Identifier(table)), (did,))
        check(state == {"status": "simulated", "attempts": 2, "sent_at": None, "provider": None}, "stale sent result must not leak")
        record("worker crash/reclaim " + kind, crashed_pid=crash_pid, old_token=old["lease_token"],
               new_token=new["lease_token"], stale_completion=False, attempt_states=states)

    for kind in ("confirmation", "change"):
        oid, did = delivery(kind)
        with connect("service_role") as c:
            j = claim(c, 1)[0]
            scalar(c, "select public.complete_order_delivery(%s,%s,%s,'failed',null,'provider_429')",
                   (kind, did, j["lease_token"]))
        before = snapshot(oid)
        r = rev(oid)
        call = lambda c: scalar(c, "select public.staff_retry_order_notification(%s,%s,%s)", (kind, did, r))
        check(race("retry-" + kind, call, call) == ("pending", "pending"), "retry contract is desired-state pending")
        check(snapshot(oid) == before, "retry leaves entire business state untouched")
        check(scalar(admin, "select count(*) from public.order_delivery_attempts where delivery_id=%s and status='retry_requested'", (did,)) == 1,
              "one retry audit")
        table = "order_notification_deliveries" if kind == "confirmation" else "order_change_deliveries"
        check(scalar(admin, sql.SQL("select count(*) from public.{} where order_id=%s").format(sql.Identifier(table)), (oid,)) == 1,
              "same delivery, no duplicated business action")
        with connect("service_role") as c:
            complete(c, claim(c, 1)[0])
        record("worker parallel retry " + kind, results=["pending", "pending"], retry_audits=1,
               business_snapshot_unchanged=True)

    oid = order()
    r, nid = rev(oid), uuid.uuid4()
    before = snapshot(oid)
    same = lambda c: note(c, oid, r, nid, "same request")
    check(race("notes-identical", same, same) == (nid, nid), "same ID returns same note")
    check(scalar(admin, "select count(*) from public.order_notes where id=%s", (nid,)) == 1, "one append-only audit row")
    check(snapshot(oid) == before, "note must not mutate any business state/order events")
    record("notes identical request", notes=1, audit="note actor/revision/created_at; no separate order_event", business_snapshot_unchanged=True)

    for who, text in ((OWNER, "different content"), (MANAGER, "same request")):
        conflict_id = uuid.uuid4()
        race("notes-conflict", lambda c: note(c, oid, r, conflict_id, "same request"),
             lambda c: note(c, oid, r, conflict_id, text),
             expect_error=("P0001", "order_note_id_conflict"), second_actor=who)
        saved = admin.execute("select actor_id,body from public.order_notes where id=%s", (conflict_id,)).fetchone()
        check(saved == (OWNER, "same request"), "first author's note cannot be overwritten")
    record("notes conflicting content/author", error="P0001 order_note_id_conflict", overwritten=False)

    n1, n2 = uuid.uuid4(), uuid.uuid4()
    check(race("notes-distinct", lambda c: note(c, oid, r, n1, "first"),
               lambda c: note(c, oid, r, n2, "second")) == (n1, n2), "different IDs both persist")
    notes = admin.execute("select id,order_revision from public.order_notes where id=any(%s) order by created_at,id", ([n1, n2],)).fetchall()
    check(notes == [(n1, r), (n2, r)] and snapshot(oid) == before, "serialized note order without new revision")
    record("notes distinct IDs", same_revision=r, persisted_order=[str(n1), str(n2)])

    # Both serializations of a genuinely overlapping note/order mutation.
    for note_first in (True, False):
        oid, nid = order(), uuid.uuid4()
        r = rev(oid)
        def change(c):
            return scalar(c, "select public.staff_change_order(%s,%s,'cancel')", (oid, r))
        add = lambda c: note(c, oid, r, nid, "concurrent revision")
        if note_first:
            race("note-before-change", add, change)
            check(scalar(admin, "select order_revision from public.order_notes where id=%s", (nid,)) == r,
                  "note recorded against pre-change revision")
        else:
            race("change-before-note", change, add, expect_error=("40001", "Order changed"))
            check(scalar(admin, "select count(*) from public.order_notes where id=%s", (nid,)) == 0,
                  "no stale append after the committed change")
        check(rev(oid) == r + 1, "only order mutation increments revision")
        # Quarantine own cancellation: not a later worker fixture.
        admin.execute("update public.order_change_deliveries set status='manual_required',last_error='fixture_complete' where order_id=%s", (oid,))
        record("notes/change " + ("note first" if note_first else "change first"),
               outcome="saved at old revision before change" if note_first else "40001; no note",
               resulting_revision=r + 1)


class RpcBridge(http.server.BaseHTTPRequestHandler):
    """Test transport only: genuine SQL/RPC through separate PG connections."""
    claims = []
    first_claim = threading.Event()
    second_claim = threading.Event()
    guard = threading.Lock()
    barrier_enabled = True
    errors = []

    def log_message(self, *args):
        pass

    def do_POST(self):
        c = None
        try:
            args = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            name = self.path.removeprefix("/rest/v1/rpc/")
            check(self.path.startswith("/rest/v1/rpc/"), "RPC path only")
            c = connect("service_role", name="worker-http-" + name)
            if name == "authorize_notification_worker":
                result = scalar(c, "select public.authorize_notification_worker(%s)", (args["p_token"],))
            elif name == "claim_order_deliveries":
                c.execute("begin")
                with self.guard:
                    position = len(self.claims)
                # Second request must reach PostgreSQL while first claim is held.
                if position == 1 and self.barrier_enabled:
                    check(self.first_claim.wait(8), "first worker claim barrier")
                result = claim(c, args["p_limit"])
                with self.guard:
                    self.claims.append({"pid": c.info.backend_pid, "jobs": result})
                    position = len(self.claims) - 1
                if self.barrier_enabled and position == 0:
                    self.first_claim.set()
                    check(self.second_claim.wait(8), "second worker must claim before first commit")
                elif self.barrier_enabled and position == 1:
                    rows = activity([x["pid"] for x in self.claims])
                    check(len(rows) == 2 and all(x["transaction_open"] and x["xid"] for x in rows),
                          "full worker claim transactions overlap in PostgreSQL")
                    check({j["id"] for j in self.claims[0]["jobs"]}.isdisjoint({j["id"] for j in result}), "full worker batches overlap IDs")
                    evidence["overlap"].append({"label": "two-real-worker-handlers", "activity": rows,
                                                "batch_ids": [[j["id"] for j in x["jobs"]] for x in self.claims]})
                    self.barrier_enabled = False
                    self.second_claim.set()
                c.execute("commit")
            elif name == "complete_order_delivery":
                result = scalar(c, "select public.complete_order_delivery(%s,%s,%s,%s,%s,%s)",
                                tuple(args[k] for k in ("p_kind", "p_delivery_id", "p_lease_token", "p_status", "p_provider_id", "p_error")))
            else:
                raise AssertionError("unapproved bridge RPC")
            body, code = json.dumps(result).encode(), 200
        except Exception as error:
            self.errors.append(str(error))
            if c and not c.closed:
                c.execute("rollback")
            body, code = json.dumps({"code": getattr(error, "sqlstate", "test_bridge_error"),
                                     "message": str(error)}).encode(), 400
        finally:
            if c:
                c.close()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def node_worker(mode, jobs=None):
    p = subprocess.run(["node", str(ROOT / "tests/concurrency/worker_mock.mjs")],
                       input=json.dumps({"mode": mode, "jobs": jobs or []}), capture_output=True, text=True,
                       env={**os.environ, "LOCAL_RPC_URL": bridge_url}, timeout=35, cwd=ROOT)
    check(p.returncode == 0, "real worker subprocess failed: " + p.stderr)
    return json.loads(p.stdout)


def worker_scenarios():
    global bridge_url
    fixtures = [delivery(kind, live=True) for kind in ["confirmation"] * 5 + ["change"] * 5]
    before = {str(o): snapshot(o) for o, _ in fixtures}
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), RpcBridge)
    bridge_url = "http://127.0.0.1:" + str(server.server_port)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        result = node_worker("parallel")
        check(not RpcBridge.errors, RpcBridge.errors)
        check(len(RpcBridge.claims) == 2 and all(len(x["jobs"]) == 5 for x in RpcBridge.claims), "two full real handler batches")
        check(len(result["provider_calls"]) == 10, "all 10 jobs use only the mock boundary")
        status_counts = {}
        for response in result["responses"]:
            check(response["status"] == 200 and response["body"]["processed"] == 5, "full worker HTTP contract")
            for k, v in response["body"]["results"].items():
                status_counts[k] = status_counts.get(k, 0) + v
        check(status_counts == {"failed": 1, "sent": 9}, "mock 429 classification")
        all_jobs = [j for batch in RpcBridge.claims for j in batch["jobs"]]
        failed_call = next(x for x in result["provider_calls"] if x["status"] == 429)
        failed_job = next(j for j in all_jobs if failed_call["key"] == "blagova/" + j["kind"] + "/" + j["id"])
        with connect("authenticated") as c:
            check(scalar(c, "select public.staff_retry_order_notification(%s,%s,%s)",
                         (failed_job["kind"], failed_job["id"], rev(failed_job["payload"]["order_id"]))) == "pending", "mock failure retry")
        again = node_worker("retry")
        check(again["responses"][0]["body"] == {"processed": 1, "results": {"sent": 1}}, "second full handler completes same delivery")
        retried_call = again["provider_calls"][0]
        check(failed_call["key"] == retried_call["key"] and failed_call["body_sha256"] == retried_call["body_sha256"],
              "idempotency key and exact provider payload stable over real re-claim")
        check(all(snapshot(o) == before[str(o)] for o, _ in fixtures), "full workers/retry never alter orders or resources")
        states = admin.execute("select status,count(*) from public.order_delivery_attempts where order_id=any(%s) group by status order by status",
                               ([o for o, _ in fixtures],)).fetchall()
        check(states == [("failed", 1), ("retry_requested", 1), ("sent", 10)], "provider result agrees with real audit")
        record("provider boundary two full worker calls and retry", responses=result["responses"] + again["responses"],
               provider_calls=result["provider_calls"] + again["provider_calls"], attempt_states=states,
               key_and_payload_stable=True, real_provider_delivery="not tested")

        oid, did = delivery(live=True)
        with connect("service_role") as c:
            job = claim(c, 1)[0]
        with connect("authenticated") as c:
            scalar(c, "select public.staff_change_order(%s,%s,'cancel')", (oid, rev(oid)))
        check(scalar(admin, "select status from public.orders where id=%s", (oid,)) == "cancelled", "order changed after claim before processJob")
        post_change = snapshot(oid)
        late = node_worker("claimed", [job])
        check(late["outcomes"] == ["sent"] and len(late["provider_calls"]) == 1,
              "existing frozen job is still sent after post-claim cancellation")
        check(snapshot(oid) == post_change, "completion never reverts cancellation")
        record("post-claim order/provider race observed", behavior="frozen confirmation reached mock after cancellation; CAS completion sent",
               limitation="no pre-provider revision recheck or DB/provider atomicity; already documented",
               real_email_sent=False)
    finally:
        server.shutdown()
        server.server_close()
        thread.join(3)


def setup():
    global admin, monitor
    admin, monitor = connect(name="admin"), connect(name="monitor")
    evidence["postgres_version"] = scalar(admin, "select version()")
    # These are compatibility scaffolds, not replacements for app RPC/schema.
    admin.execute("""create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage; create schema extensions;
      create extension pgcrypto with schema public;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema public,auth,storage to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;""")
    for file in sorted((ROOT / "supabase/migrations").glob("*.sql")):
        content = file.read_bytes()
        admin.execute(content.decode())
        evidence["migration_hashes"][file.name] = hashlib.sha256(content).hexdigest()
    # Local table exposes the same read interface solely for real authorization RPC.
    # No hosted Vault/secret, cron, pg_net, platform runbook or external endpoint.
    admin.execute("create schema vault; create table vault.decrypted_secrets(name text primary key,decrypted_secret text)")
    admin.execute("insert into vault.decrypted_secrets values('blagova_notification_worker_token',%s)", (TOKEN,))
    admin.execute("insert into auth.users(id,email) values(%s,'concurrency-owner@example.invalid'),(%s,'concurrency-manager@example.invalid')", (OWNER, MANAGER))
    admin.execute("insert into public.staff_members(user_id,role) values(%s,'owner'),(%s,'manager')", (OWNER, MANAGER))
    # Sequential suites remain a separate prerequisite, never concurrency evidence.
    for suite in ("structured_order_capacity.sql", "stage2_acceptance.sql", "staff_order_workspace.sql", "staff_operations.sql"):
        admin.execute((ROOT / "supabase/tests" / suite).read_text())
    evidence["sql_prerequisites"] = "21 unmodified migrations and 4 rollback suites on real PostgreSQL"
    with connect("service_role") as c:
        check(scalar(c, "select public.authorize_notification_worker(%s)", (TOKEN,)), "local dedicated token authorizes")
        check(not scalar(c, "select public.authorize_notification_worker(%s)", ("z" * 72,)), "wrong token rejected")


def cleanup():
    """Keep snapshots/audit in the report; remove only the entire owned temporary DB."""
    if admin and not admin.closed:
        # Cancel only fixtures created here through normal API; preserve audit until DB drop.
        ids = [r[0] for r in admin.execute("select id from public.orders where customer_name='Concurrency QA'").fetchall()]
        with connect("authenticated") as c:
            for oid in ids:
                state = admin.execute("select status,revision from public.orders where id=%s", (oid,)).fetchone()
                if state[0] not in ("cancelled", "completed"):
                    scalar(c, "select public.staff_change_order(%s,%s,'cancel')", (oid, state[1]))
        active = scalar(admin, "select count(*) from public.orders where customer_name='Concurrency QA' and (status not in ('cancelled','completed') or reservation_expires_at is not null)")
        check(active == 0, "all own resources released through supported API")
        evidence["cleanup"] = {"own_orders": len(ids), "active_orders_or_reservations": active,
          "notes_preserved_before_drop": scalar(admin, "select count(*) from public.order_notes"),
          "attempts_preserved_before_drop": scalar(admin, "select count(*) from public.order_delivery_attempts"),
          "order_events_preserved_before_drop": scalar(admin, "select count(*) from public.order_events")}
    for c in connections:
        if not c.closed:
            with contextlib.suppress(Exception):
                c.execute("rollback")
            c.close()
    pool.shutdown(wait=True, cancel_futures=True)
    with psycopg.connect(host=HOST, port=os.environ.get("PGPORT", "5432"), user=os.environ.get("PGUSER", "postgres"),
                        password=os.environ.get("PGPASSWORD", ""), dbname="postgres", autocommit=True) as control:
        # Fresh roles belong to this disposable cluster, not any hosted environment.
        control.execute(sql.SQL("drop database {}").format(sql.Identifier(DB)))
        control.execute("drop role anon; drop role authenticated; drop role service_role")
        check(not scalar(control, "select exists(select 1 from pg_database where datname=%s)", (DB,)), "temporary database removed")
    evidence.setdefault("cleanup", {})["database_removed"] = True
    evidence["cleanup"]["connections_closed"] = all(c.closed for c in connections)


if __name__ == "__main__":
    # Explicit sentinel protects against using an existing local developer cluster.
    if os.environ.get("BLAGOVA_DISPOSABLE_PG") != "1":
        raise SystemExit("Set BLAGOVA_DISPOSABLE_PG=1 only for a dedicated disposable PG cluster")
    with psycopg.connect(host=HOST, port=os.environ.get("PGPORT", "5432"), user=os.environ.get("PGUSER", "postgres"),
                        password=os.environ.get("PGPASSWORD", ""), dbname="postgres", autocommit=True) as control:
        check(scalar(control, "select count(*) from pg_roles where rolname in ('anon','authenticated','service_role')") == 0,
              "cluster already has Supabase roles: refusing")
        control.execute(sql.SQL("create database {}").format(sql.Identifier(DB)))
    try:
        setup()
        sql_scenarios()
        worker_scenarios()
        evidence["result"] = "passed"
    except Exception as error:
        evidence["result"] = "failed"
        evidence["failure"] = str(error)
        raise
    finally:
        try:
            cleanup()
        finally:
            REPORT.parent.mkdir(parents=True, exist_ok=True)
            REPORT.write_text(json.dumps(evidence, indent=2, default=str) + "\n")
            print("REPORT", REPORT, flush=True)
