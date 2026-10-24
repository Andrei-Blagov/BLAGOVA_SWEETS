-- Keep the date-only old Preview/rollback client compatible through the same rate-limited RPC.
create or replace function public.get_storefront_cart_availability(p_date date,p_items jsonb,p_locale text,p_rate_key text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
  if p_date is null or p_date>(clock_timestamp() at time zone 'Asia/Bangkok')::date+365 or p_rate_key is null or p_rate_key !~ '^[0-9a-f]{64}$' then raise exception 'invalid_request'; end if;
  insert into private.production_availability_limits as l values(p_rate_key,clock_timestamp(),1)
  on conflict(key_hash) do update set window_started_at=case when l.window_started_at<clock_timestamp()-interval '15 minutes' then clock_timestamp() else l.window_started_at end,
    request_count=case when l.window_started_at<clock_timestamp()-interval '15 minutes' then 1 else l.request_count+1 end returning request_count into n;
  if n>120 then raise exception 'rate_limit'; end if;
  if p_items is null then return private.production_day(p_date); end if;
  return private.production_day(p_date,private.quote_production_cart(p_items,p_locale));
end $$;
