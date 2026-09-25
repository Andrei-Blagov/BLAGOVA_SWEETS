-- Public storefront intake is reachable only through the Edge Function.
create table private.public_intake_limits (
  key_hash text primary key check (length(key_hash) = 64),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now()
);
alter table private.public_intake_limits enable row level security;
revoke all on private.public_intake_limits from public, anon, authenticated;
grant all on private.public_intake_limits to service_role;

create function public.receive_storefront_order(
  p_request_key uuid,
  p_source text,
  p_locale text,
  p_customer_name text,
  p_customer_contact text,
  p_fulfillment text,
  p_delivery_address text,
  p_delivery_minor integer,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz,
  p_note text,
  p_items jsonb,
  p_messages jsonb,
  p_rate_key text
) returns table(order_id uuid, reference text, duplicate boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_customer_id uuid;
  v_conversation_id uuid;
  v_count integer;
  v_item jsonb;
  v_message jsonb;
begin
  select o.id into v_order_id from public.orders o where o.request_key = p_request_key;
  if v_order_id is not null then
    return query select v_order_id, 'BLG-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 8)), true;
    return;
  end if;

  if p_rate_key !~ '^[0-9a-f]{64}$' then raise exception 'invalid_rate_key'; end if;
  insert into private.public_intake_limits as limits(key_hash, window_started_at, request_count, updated_at)
  values (p_rate_key, now(), 1, now())
  on conflict (key_hash) do update set
    window_started_at = case when limits.window_started_at < now() - interval '15 minutes' then now() else limits.window_started_at end,
    request_count = case when limits.window_started_at < now() - interval '15 minutes' then 1 else limits.request_count + 1 end,
    updated_at = now()
  returning request_count into v_count;
  if v_count > 5 then raise exception 'rate_limit'; end if;

  if p_source not in ('website','chat') or p_locale not in ('ru','en','th') then raise exception 'invalid_source'; end if;
  if length(btrim(p_customer_name)) not between 1 and 80 or length(btrim(p_customer_contact)) not between 3 and 120 then raise exception 'invalid_customer'; end if;
  if p_fulfillment not in ('pickup','delivery') then raise exception 'invalid_fulfillment'; end if;
  if (p_fulfillment = 'pickup' and p_delivery_minor <> 0) or
     (p_fulfillment = 'delivery' and (p_delivery_minor not in (12000,18000) or length(btrim(coalesce(p_delivery_address,''))) not between 1 and 200)) then
    raise exception 'invalid_delivery';
  end if;
  if p_scheduled_start < now() or p_scheduled_end <= p_scheduled_start or p_scheduled_end > p_scheduled_start + interval '4 hours' then raise exception 'invalid_schedule'; end if;
  if length(coalesce(p_note,'')) > 600 then raise exception 'invalid_note'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 25 then raise exception 'invalid_items'; end if;
  if jsonb_typeof(p_messages) <> 'array' or jsonb_array_length(p_messages) > 20 then raise exception 'invalid_messages'; end if;

  insert into public.customers(display_name, locale, is_demo)
  values (btrim(p_customer_name), p_locale, true)
  returning id into v_customer_id;

  if p_source = 'chat' then
    insert into public.conversations(customer_id, channel, external_id, mode)
    values (v_customer_id, 'website', p_request_key::text, 'bot')
    returning id into v_conversation_id;
    for v_message in select value from jsonb_array_elements(p_messages) loop
      if v_message->>'sender' not in ('customer','assistant') or length(btrim(coalesce(v_message->>'body',''))) not between 1 and 2500 then
        raise exception 'invalid_message';
      end if;
      insert into public.messages(conversation_id, sender, body, external_id)
      values (v_conversation_id, v_message->>'sender', btrim(v_message->>'body'), nullif(v_message->>'id',''));
    end loop;
  end if;

  insert into public.orders(request_key, customer_id, conversation_id, source, fulfillment, delivery_address,
    delivery_minor, scheduled_start, scheduled_end, customer_name, customer_contact, note, is_demo)
  values (p_request_key, v_customer_id, v_conversation_id, p_source, p_fulfillment,
    case when p_fulfillment = 'delivery' then btrim(p_delivery_address) else null end,
    p_delivery_minor, p_scheduled_start, p_scheduled_end, btrim(p_customer_name), btrim(p_customer_contact), coalesce(p_note,''), true)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if length(btrim(coalesce(v_item->>'name',''))) not between 1 and 250 or
       length(coalesce(v_item->>'detail','')) > 500 or
       coalesce(v_item->>'quantity','') !~ '^[0-9]+$' or (v_item->>'quantity')::integer not between 1 and 20 or
       coalesce(v_item->>'unit_price_minor','') !~ '^[0-9]+$' or (v_item->>'unit_price_minor')::integer not between 0 and 100000000 then
      raise exception 'invalid_item';
    end if;
    insert into public.order_items(order_id, product_name, variant_description, quantity, unit_price_minor)
    values (v_order_id, btrim(v_item->>'name'), coalesce(v_item->>'detail',''), (v_item->>'quantity')::integer, (v_item->>'unit_price_minor')::integer);
  end loop;

  return query select v_order_id, 'BLG-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 8)), false;
end;
$$;

revoke all on function public.receive_storefront_order(uuid,text,text,text,text,text,text,integer,timestamptz,timestamptz,text,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.receive_storefront_order(uuid,text,text,text,text,text,text,integer,timestamptz,timestamptz,text,jsonb,jsonb,text) to service_role;
