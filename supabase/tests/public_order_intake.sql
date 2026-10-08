begin;
create temporary table intake_test_ids as
select gen_random_uuid() request_key, encode(gen_random_bytes(32), 'hex') rate_key;
grant select on intake_test_ids to anon, service_role;

set local role anon;
do $$ begin
  begin
    perform public.receive_storefront_order(
      (select request_key from intake_test_ids),'website','ru','QA','qa@example.invalid','pickup','','pickup',
      (((now() at time zone 'Asia/Bangkok')::date+5)+time '09:00') at time zone 'Asia/Bangkok',
      (((now() at time zone 'Asia/Bangkok')::date+5)+time '12:00') at time zone 'Asia/Bangkok','',
      '[{"sku":"berry-cloud-1kg","personalization":"QA","quantity":1}]'::jsonb,
      '[]'::jsonb,(select rate_key from intake_test_ids));
    raise exception 'Anonymous direct RPC was allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role service_role;
select * from public.receive_storefront_order(
  (select request_key from intake_test_ids),'chat','ru','QA','qa@example.invalid','pickup','','pickup',
  (((now() at time zone 'Asia/Bangkok')::date+5)+time '09:00') at time zone 'Asia/Bangkok',
  (((now() at time zone 'Asia/Bangkok')::date+5)+time '12:00') at time zone 'Asia/Bangkok','QA',
  '[{"sku":"berry-cloud-1kg","personalization":"QA","quantity":1}]'::jsonb,
  '[{"id":"qa-1","sender":"customer","body":"QA message"}]'::jsonb,
  (select rate_key from intake_test_ids));

do $$ begin
  if (select count(*) from public.orders where request_key=(select request_key from intake_test_ids)) <> 1 then raise exception 'Order missing'; end if;
  if (select count(*) from public.order_items oi join public.orders o on o.id=oi.order_id where o.request_key=(select request_key from intake_test_ids)) <> 1 then raise exception 'Item missing'; end if;
  if (select oi.unit_price_minor from public.order_items oi join public.orders o on o.id=oi.order_id where o.request_key=(select request_key from intake_test_ids)) <> 145000 then raise exception 'Catalog price not used'; end if;
  if (select o.delivery_minor from public.orders o where o.request_key=(select request_key from intake_test_ids)) <> 0 then raise exception 'Server delivery price not used'; end if;
  if (select count(*) from public.messages m join public.conversations c on c.id=m.conversation_id join public.orders o on o.conversation_id=c.id where o.request_key=(select request_key from intake_test_ids)) <> 1 then raise exception 'Conversation missing'; end if;
  if not exists(select 1 from public.order_events e join public.orders o on o.id=e.order_id where o.request_key=(select request_key from intake_test_ids) and e.kind='created') then raise exception 'Audit missing'; end if;
end $$;

do $$ declare v_duplicate boolean; begin
  select duplicate into v_duplicate from public.receive_storefront_order(
    (select request_key from intake_test_ids),'chat','ru','QA','qa@example.invalid','pickup','','pickup',
    (((now() at time zone 'Asia/Bangkok')::date+5)+time '09:00') at time zone 'Asia/Bangkok',
    (((now() at time zone 'Asia/Bangkok')::date+5)+time '12:00') at time zone 'Asia/Bangkok','QA',
    '[{"sku":"berry-cloud-1kg","personalization":"QA","quantity":1}]'::jsonb,
    '[]'::jsonb,(select rate_key from intake_test_ids));
  if not v_duplicate then raise exception 'Idempotent retry not detected'; end if;
end $$;
reset role;
rollback;
select 'PASS: public intake permissions, atomic order, conversation, audit and idempotency' as verification;
