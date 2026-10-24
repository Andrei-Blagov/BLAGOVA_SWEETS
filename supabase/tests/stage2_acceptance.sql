begin;
create function pg_temp.assert(p_value boolean,p_message text) returns void language plpgsql as $$ begin if p_value is distinct from true then raise exception 'ASSERT: %',p_message; end if; end $$;
create temp table acceptance_staff(id uuid,role text);
insert into auth.users(id,email) values(gen_random_uuid(),'acceptance-owner@example.invalid'),(gen_random_uuid(),'acceptance-manager@example.invalid');
insert into acceptance_staff select id,case when email like '%owner@%' then 'owner' else 'manager' end from auth.users where email in ('acceptance-owner@example.invalid','acceptance-manager@example.invalid');
insert into public.staff_members(user_id,role) select * from acceptance_staff;
select set_config('request.jwt.claim.sub',(select id::text from acceptance_staff where role='owner'),true);

create function pg_temp.acceptance_order(p_items jsonb,p_zone text default 'pickup') returns uuid language plpgsql as $$
declare oid uuid; start_at timestamptz:=(((clock_timestamp() at time zone 'Asia/Bangkok')::date+60)+time '09:00') at time zone 'Asia/Bangkok';
begin
 select order_id into oid from public.receive_storefront_order(gen_random_uuid(),'chat','ru','Acceptance QA','acceptance@example.invalid',case when p_zone='pickup' then 'pickup' else 'delivery' end,case when p_zone='pickup' then '' else 'Demo address' end,p_zone,start_at,start_at+interval '3 hours','',p_items,'[]',encode(gen_random_bytes(32),'hex'));
 return oid;
end $$;
create temp table acceptance_orders(id uuid,kind text);
insert into acceptance_orders values(pg_temp.acceptance_order('[]'),'unknown'),(pg_temp.acceptance_order('[{"sku":"berry-cloud-1kg","quantity":1}]'),'known'),(pg_temp.acceptance_order('[{"sku":"berry-cloud-1kg","quantity":1}]'),'confirmed');
select public.staff_confirm_order(id,(select revision from public.orders where orders.id=acceptance_orders.id)) from acceptance_orders where kind='confirmed';
-- Emulate historical fixtures only. The guard is restored before exercising RPCs.
-- All fixtures, audit and the temporary trigger change roll back together.
alter table public.orders disable trigger orders_schedule_capacity_guard;
update public.orders set scheduled_start=(((clock_timestamp() at time zone 'Asia/Bangkok')::date-1)+time '09:00') at time zone 'Asia/Bangkok',scheduled_end=(((clock_timestamp() at time zone 'Asia/Bangkok')::date-1)+time '12:00') at time zone 'Asia/Bangkok' where id in(select id from acceptance_orders);
alter table public.orders enable trigger orders_schedule_capacity_guard;

do $$ declare a uuid; rev integer; old_expiry timestamptz; role_name text; snapshot_before jsonb; begin
 for role_name in select role from acceptance_staff loop
  perform set_config('request.jwt.claim.sub',(select id::text from acceptance_staff where role=role_name),true);
  select id into a from acceptance_orders where kind='unknown';
  select revision into rev from public.orders where id=a;
  begin perform public.staff_assess_production(a,rev,'{"cake":1}','QA: agreed cake',145000);raise exception 'not_rejected';exception when others then if sqlerrm<>'invalid_schedule' then raise;end if;end;
  perform pg_temp.assert((select revision=rev and production_load is null and reservation_expires_at is null from public.orders where id=a) and not exists(select 1 from public.order_items where order_id=a),'past assessment rolls back load, custom item and reservation');
  select id into a from acceptance_orders where kind='known';
  select revision,reservation_expires_at into rev,old_expiry from public.orders where id=a;
  begin update public.orders set reservation_expires_at=clock_timestamp()+interval '60 minutes' where id=a;raise exception 'not_rejected';exception when others then if sqlerrm<>'invalid_schedule' then raise;end if;end;
  begin perform public.staff_confirm_order(a,rev);raise exception 'not_rejected';exception when others then if sqlerrm<>'invalid_schedule' then raise;end if;end;
  perform pg_temp.assert((select revision=rev and status='pending' and reservation_expires_at=old_expiry from public.orders where id=a) and not exists(select 1 from public.order_notification_deliveries where order_id=a),'late confirmation and renewal leave order unchanged');
 end loop;
 update public.orders set reservation_expires_at=clock_timestamp()-interval '1 second' where id=a;
 begin update public.orders set reservation_expires_at=clock_timestamp()+interval '60 minutes' where id=a;raise exception 'not_rejected';exception when others then if sqlerrm<>'invalid_schedule' then raise;end if;end;
 perform public.staff_change_order(a,(select revision from public.orders where id=a),'cancel');
 select id into a from acceptance_orders where kind='confirmed';
 select snapshot into snapshot_before from public.order_items where order_id=a;
 update public.orders set note='QA historical note',status='production' where id=a;
 update public.orders set status='ready' where id=a;
 update public.orders set status='completed' where id=a;
 perform pg_temp.assert((select status='completed' from public.orders where id=a) and (select snapshot=snapshot_before from public.order_items where order_id=a),'historical confirmed orders can progress without changing snapshots');
 select id into a from acceptance_orders where kind='unknown';
 perform public.staff_change_order(a,(select revision from public.orders where id=a),'reschedule',(((clock_timestamp() at time zone 'Asia/Bangkok')::date+61)+time '09:00') at time zone 'Asia/Bangkok',(((clock_timestamp() at time zone 'Asia/Bangkok')::date+61)+time '12:00') at time zone 'Asia/Bangkok');
 perform public.staff_assess_production(a,(select revision from public.orders where id=a),'{"cake":1}','QA: moved to future',145000);
 perform pg_temp.assert((select production_load=8 and reservation_expires_at>clock_timestamp()+interval '59 minutes' from public.orders where id=a),'future reschedule permits assessment and 60-minute reservation');
 perform public.staff_confirm_order(a,(select revision from public.orders where id=a));
end $$;

do $$ declare a uuid; zone text; fee integer; begin
 for zone,fee in values('pickup',0),('central',12000),('jomtien',18000) loop
  a:=pg_temp.acceptance_order('[{"sku":"berry-cloud-1kg","quantity":1}]',zone);
  perform pg_temp.assert((select delivery_minor=fee from public.orders where id=a),'selected delivery zone fee');
  perform pg_temp.assert((select sum(line_total_minor)+fee=145000+fee from public.order_items where order_id=a),'authoritative order total includes selected delivery fee');
 end loop;
end $$;
rollback;
select 'PASS: past assessment/confirmation/renewal rejected; future transfer, historical operations and three delivery zones preserved' as verification;
