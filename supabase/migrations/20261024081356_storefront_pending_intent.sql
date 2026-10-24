-- A2: service-only durable receipt/fence. No new browser access to orders/PII.
create table private.storefront_intents (
 request_key uuid primary key,
 token_hash text not null check(token_hash ~ '^[0-9a-f]{64}$'),
 fingerprint text check(fingerprint ~ '^[0-9a-f]{64}$'),
 state text not null check(state in ('saved','closed')),
 order_id uuid unique references public.orders(id) on delete restrict,
 summary jsonb,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '24 hours',
 check((state='saved' and order_id is not null and summary is not null and fingerprint is not null)
    or (state='closed' and order_id is null and summary is null and fingerprint is null))
);
alter table private.storefront_intents enable row level security;
revoke all on private.storefront_intents from public,anon,authenticated;
grant all on private.storefront_intents to service_role;
create table private.storefront_intent_limits(key_hash text primary key,started_at timestamptz not null,n integer not null);
alter table private.storefront_intent_limits enable row level security;
revoke all on private.storefront_intent_limits from public,anon,authenticated;
grant all on private.storefront_intent_limits to service_role;

create function public.submit_storefront_intent(p_request_key uuid,p_token_hash text,p_payload jsonb,p_rate_key text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare prior private.storefront_intents; canonical jsonb; fp text; received record; receipt jsonb;
begin
 if p_request_key is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'invalid_intent'; end if;
 canonical:=jsonb_build_object('v',1,'source',p_payload->>'source','locale',p_payload->>'locale',
 'customerName',btrim(p_payload->>'customerName'),'customerContact',btrim(p_payload->>'customerContact'),
 'fulfillment',p_payload->>'fulfillment','deliveryAddress',coalesce(btrim(p_payload->>'deliveryAddress'),''),'deliveryZone',p_payload->>'deliveryZone',
 'scheduledStart',to_char((p_payload->>'scheduledStart')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
 'scheduledEnd',to_char((p_payload->>'scheduledEnd')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
 'note',coalesce(p_payload->>'note',''),'items',p_payload->'items','messages',coalesce(p_payload->'messages','[]'::jsonb));
 fp:=encode(sha256(convert_to(canonical::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('request:'||p_request_key::text,710002));
 select * into prior from private.storefront_intents where request_key=p_request_key;
 if found then
  if prior.token_hash<>p_token_hash or prior.expires_at<=clock_timestamp() then raise exception 'intent_unavailable'; end if;
  if prior.state='closed' then raise exception 'intent_closed'; end if;
  if prior.fingerprint<>fp then raise exception 'intent_payload_conflict'; end if;
  return jsonb_build_object('state','saved','duplicate',true,'summary',prior.summary,'internalOrderId',prior.order_id);
 end if;
 -- A legacy key has no recovery capability; never expose it via key alone.
 if exists(select 1 from public.orders where request_key=p_request_key) then raise exception 'intent_unavailable'; end if;
 select * into received from public.receive_storefront_order(p_request_key,canonical->>'source',canonical->>'locale',
 canonical->>'customerName',canonical->>'customerContact',canonical->>'fulfillment',canonical->>'deliveryAddress',canonical->>'deliveryZone',
 (canonical->>'scheduledStart')::timestamptz,(canonical->>'scheduledEnd')::timestamptz,canonical->>'note',canonical->'items',canonical->'messages',p_rate_key);
 select jsonb_build_object('reference',received.reference,'scheduledStart',canonical->>'scheduledStart','scheduledEnd',canonical->>'scheduledEnd',
 'fulfillment',o.fulfillment,'currency','THB','deliveryMinor',received.delivery_minor,'totalMinor',received.total_minor,
 'items',coalesce((select jsonb_agg(jsonb_build_object('sku',i.snapshot->'variant'->>'sku','name',i.product_name,
 'quantity',i.quantity,'unitPriceMinor',i.unit_price_minor,'lineTotalMinor',i.line_total_minor) order by i.created_at,i.id)
 from public.order_items i where i.order_id=o.id),'[]')) into receipt from public.orders o where o.id=received.order_id;
 insert into private.storefront_intents(request_key,token_hash,fingerprint,state,order_id,summary)
 values(p_request_key,p_token_hash,fp,'saved',received.order_id,receipt);
 return jsonb_build_object('state','saved','duplicate',false,'summary',receipt,'internalOrderId',received.order_id);
end $$;

create function public.resolve_storefront_intent(p_request_key uuid,p_token_hash text,p_close boolean,p_rate_key text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare prior private.storefront_intents; requests integer;
begin
 if p_request_key is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_close is null or p_rate_key is null or p_rate_key !~ '^[0-9a-f]{64}$' then raise exception 'invalid_intent'; end if;
 insert into private.storefront_intent_limits as l values(p_rate_key,clock_timestamp(),1)
 on conflict(key_hash) do update set started_at=case when l.started_at<clock_timestamp()-interval '15 minutes' then clock_timestamp() else l.started_at end,
 n=case when l.started_at<clock_timestamp()-interval '15 minutes' then 1 else l.n+1 end returning n into requests;
 if requests>120 then raise exception 'rate_limit'; end if;
 perform pg_advisory_xact_lock(hashtextextended('request:'||p_request_key::text,710002));
 select * into prior from private.storefront_intents where request_key=p_request_key;
 if found then
  if prior.token_hash<>p_token_hash or prior.expires_at<=clock_timestamp() then raise exception 'intent_unavailable'; end if;
  return jsonb_build_object('state',prior.state,'duplicate',true,'summary',prior.summary);
 end if;
 if exists(select 1 from public.orders where request_key=p_request_key) then raise exception 'intent_unavailable'; end if;
 if p_close then
  insert into private.storefront_intents(request_key,token_hash,state) values(p_request_key,p_token_hash,'closed');
  return jsonb_build_object('state','closed');
 end if;
 return jsonb_build_object('state','unknown');
end $$;
revoke all on function public.submit_storefront_intent(uuid,text,jsonb,text),public.resolve_storefront_intent(uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.submit_storefront_intent(uuid,text,jsonb,text),public.resolve_storefront_intent(uuid,text,boolean,text) to service_role;
