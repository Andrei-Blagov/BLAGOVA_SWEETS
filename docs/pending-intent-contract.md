# A2 — pending checkout intent contract

One request key identifies one immutable, canonical submission (schema v1).
The service computes SHA-256 over a whitelisted JSONB payload: source/locale,
customer/contact, fulfillment/address/zone, UTC schedule, note, structured items
and chat messages. Client prices/load are excluded. Existing server quote,
capacity/date locks, lead time, RLS and staff authorization remain authoritative.

An independent random 256-bit recovery token is required for the new public
intent API. Only its SHA-256 hash reaches the private receipt table. Request key
alone is never read authorization. Same key + wrong token reveals no receipt;
same key + same token + different payload conflicts before any business mutation.
Service-only invoker RPCs and explicit grants/revokes protect the private table.

The receipt is the original accepted schedule/cart/price, not a live order query.
It exposes reference, original UTC dates, fulfillment, currency, item SKU/name/
quantity/unit/line price and totals. No customer name, contact, address, note,
personalization or chat transcript is returned by recovery. Receipt summary and
fingerprint are immutable for this intent; manager changes do not rewrite them.

Browser sessionStorage stores only version, key, recovery token, payload/cart
fingerprints and created/expiry times (24 hours). Full payload is frozen only in
memory; no new customer/contact/address/message storage is introduced. On reload
the receipt is resolved before any new submit. On success/acknowledged closure,
stored capability is removed. At expiry the token is removed and an expired
identifier remains as a submission block; do not silently start a fresh intent.
Closing the browser session loses this local recovery channel; this is a stated
limit, not a promise of cross-device customer authentication.

A lookup returning unknown is not permission to mint a new key: an earlier
request may still arrive. The close operation holds the same request advisory
lock and either returns the committed receipt or durably fences the old key.
Late submissions to a fenced key are rejected. Only an acknowledged closed key
permits a new intent. If close/resolve times out, keep the pending state and retry
resolution; never guess whether the order was saved. Do not clear an edited cart
when its fingerprint differs from the accepted cart.

UI success uses only server-returned saved dates/items/prices. Inputs may change
after a timeout but remain drafts; they cannot mutate the unresolved intent.
Storage unavailability prevents sending a new intent rather than silently losing
its recovery identity. This is same-tab recovery, not deduplication of unrelated
intent keys or deliberate separate orders.

No live migration or deployment in A2. New frontend and Edge contracts require a
coordinated staging rollout; old service-only receive_storefront_order remains
for internal compatibility, not as a public fallback around the token contract.

## Дополнение независимого review 24.10.2026

Все фактические callers (checkout и chat order) владеют минимальным intent до
submit. Chat использует отдельный sessionStorage key, recovery перед Edit/confirm/
reload и canonical server receipt; implicit memory token в usePublicIntake удалён.
Реальный expiresAt проверяется перед каждым действием и cleanup timer, token
удаляется после 24h, expired identity продолжает блокировать новый submit.
Подробности: [stabilization-a2-review-20261024.md](stabilization-a2-review-20261024.md).
