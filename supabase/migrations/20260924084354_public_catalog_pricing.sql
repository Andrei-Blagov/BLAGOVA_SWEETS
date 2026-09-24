-- Published demo prices must match the server's rules in the public builders.
-- Authenticated managers still have no direct catalog policy; the public client uses anon.
grant select on public.catalog_price_rules to anon;
create policy public_price_rules on public.catalog_price_rules for select to anon using (true);
