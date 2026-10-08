begin;
do $$
declare
  v_customer uuid;
  v_order uuid;
  v_date date := (now() at time zone 'Asia/Bangkok')::date + 30;
  v_start timestamptz := (((now() at time zone 'Asia/Bangkok')::date + 30) + time '09:00') at time zone 'Asia/Bangkok';
  v_end timestamptz := (((now() at time zone 'Asia/Bangkok')::date + 30) + time '12:00') at time zone 'Asia/Bangkok';
  v_rejected boolean := false;
begin
  insert into public.customers(display_name,locale,is_demo) values('Capacity QA','ru',true) returning id into v_customer;
  for i in 1..4 loop
    insert into public.orders(request_key,customer_id,source,fulfillment,scheduled_start,scheduled_end,customer_name,customer_contact,is_demo)
    values(gen_random_uuid(),v_customer,'website','pickup',v_start,v_end,'Capacity QA','qa@example.invalid',true) returning id into v_order;
    insert into public.order_items(order_id,product_name,quantity,unit_price_minor) values(v_order,'QA cake',1,10000);
    update public.orders set status='confirmed' where id=v_order;
  end loop;
  if (private.production_slot_state(v_date,time '09:00',time '12:00',null)->>'available')::boolean then
    raise exception 'capacity_should_be_full';
  end if;
  begin
    insert into public.orders(request_key,customer_id,source,fulfillment,scheduled_start,scheduled_end,customer_name,customer_contact,is_demo)
    values(gen_random_uuid(),v_customer,'website','pickup',v_start,v_end,'Capacity QA','qa@example.invalid',true);
  exception when others then
    if sqlerrm='slot_capacity_full' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'fifth_request_was_not_rejected'; end if;
end $$;
rollback;
select 'PASS: four confirmed orders allowed; fifth request rejected' as verification;
