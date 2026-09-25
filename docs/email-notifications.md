# Transactional order email

`storefront-order` sends email through Resend after a new order is stored successfully.
Email delivery is best-effort and never rolls back an accepted order.

Production Edge Function secrets:

- `RESEND_API_KEY` — restricted Resend API key with send permission.
- `ORDER_EMAIL_FROM` — verified sender, for example `BLAGOVA SWEETS <orders@mail.blagovasweets.com>`.
- `ORDER_EMAIL_MANAGER_TO` — manager notification address; defaults to `blagovandrey1323@gmail.com`.

For each non-duplicate request, the manager receives a full summary. A customer confirmation
is sent only when the contact field contains a valid email address. Both messages use stable
Resend idempotency keys. Failures are logged without exposing the API key or customer data.

Use a dedicated sending subdomain such as `mail.blagovasweets.com` so email DNS records stay
separate from the website and any future mailbox provider. Never commit the API key or place it
in the browser/VPS environment.
