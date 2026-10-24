begin;
create function pg_temp.assert(p_value boolean,p_message text) returns void language plpgsql as $$ begin if p_value is distinct from true then raise exception 'ASSERT: %',p_message;end if;end $$;
create temp table operations_staff(id uuid,role text);
insert into auth.users(id,email) values(gen_random_uuid(),'operations-owner@example.invalid'),(gen_random_uuid(),'operations-manager@example.invalid'),(gen_random_uuid(),'operations-other@example.invalid'),(gen_random_uuid(),'operations-outsider@example.invalid');
insert into operations_staff select id,case when email like '%owner@%' then 'owner' when email like '%manager@%' then 'manager' when email like '%other@%' then 'other' else 'outsider' end from auth.users where email like 'operations-%@example.invalid';
insert into public.staff_members(user_id,role) select id,case when role='owner' then 'owner' else 'manager' end from operations_staff where role<>'outsider';
create temp table operations_orders(id uuid,n integer);
do $$ declare i integer;a uuid;starts timestamptz:=(((clock_timestamp() at time zone 'Asia/Bangkok')::date+210)+time '09:00') at time zone 'Asia/Bangkok';begin
 for i in 1..105 loop
 select order_id into a from public.receive_storefront_order(gen_random_uuid(),'chat','ru','Operations QA '||i,'operations-qa@example.invalid','pickup','','pickup',starts+make_interval(days=>i),starts+make_interval(days=>i)+interval '3 hours','','[]','[]',encode(gen_random_bytes(32),'hex'));
 insert into operations_orders values(a,i);
 end loop;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from operations_staff where role='manager'),true);
set local role authenticated;
do $$ declare a uuid;r integer;x jsonb;begin
 a:=(public.staff_search_orders('Operations QA 1')->'orders'->0->>'id')::uuid;
 perform pg_temp.assert(jsonb_array_length(public.staff_directory())>=3,'active staff directory visible to manager');
 perform public.staff_assign_order(a,1,auth.uid());
 perform public.staff_assign_order(a,1,auth.uid());
 x:=public.staff_order_details(a);r:=(x->>'revision')::integer;
 perform pg_temp.assert(r=2 and (x->>'assigned_to')::uuid=auth.uid(),'claim and repeated desired-state assignment are idempotent');
 perform pg_temp.assert(x->'order_events'->1->'details'->>'assignee_label'='operations-manager@example.invalid','assignment audit stores historical label');
 perform pg_temp.assert((public.staff_search_orders('Operations QA',p_assignee=>'mine')->>'total')::integer=1,'my orders filter');
 perform pg_temp.assert((public.staff_search_orders('Operations QA',p_assignee=>'unassigned')->>'total')::integer=104,'unassigned filter');
 begin perform public.staff_assign_order(a,1,null);raise exception 'not_rejected';exception when serialization_failure then null;end;
 begin perform public.staff_assign_order(a,r,gen_random_uuid());raise exception 'not_rejected';exception when insufficient_privilege then null;end;
 x:=public.staff_export_orders('Operations QA');
 perform pg_temp.assert((x->>'count')::integer=105 and jsonb_array_length(x->'rows')=105,'export covers rows beyond current page and 100');
 perform pg_temp.assert(not (x->'rows'->0 ?| array['customer_name','customer_contact','delivery_address','note']),'default export excludes customer data and notes');
 begin perform public.staff_export_orders(p_include_contacts=>true);raise exception 'not_rejected';exception when insufficient_privilege then null;end;
 begin perform public.claim_order_deliveries();raise exception 'not_rejected';exception when insufficient_privilege then null;end;
 begin update public.orders set assigned_to=null where id=a;raise exception 'not_rejected';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from operations_staff where role='other'),true);
set local role authenticated;
do $$ declare a uuid;x jsonb;begin
 a:=(public.staff_search_orders('Operations QA',p_assignee=>(select user_id::text from public.staff_members where user_id=auth.uid()))->'orders'->0->>'id')::uuid;
 -- Other member has no own orders, but shared visibility remains intact.
 x:=public.staff_search_orders('Operations QA',p_assignee=>'unassigned');
 perform pg_temp.assert((x->>'total')::integer=104,'shared read visibility');
 a:=(public.staff_search_orders('Operations QA',p_assignee=>'all')->'orders'->0->>'id')::uuid;
 -- Locate the manager assignment through the server export.
 select id into a from public.orders where customer_name like 'Operations QA%' and assigned_to is not null;
 begin perform public.staff_assign_order(a,2,auth.uid());raise exception 'not_rejected';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from operations_staff where role='owner'),true);
set local role authenticated;
do $$ declare a uuid;d uuid;o jsonb;x jsonb;rev integer;begin
 select id into a from public.orders where customer_name like 'Operations QA%' and assigned_to is not null;
 perform public.staff_assign_order(a,2,auth.uid());
 o:=public.staff_order_details(a);rev:=(o->>'revision')::integer;
 perform pg_temp.assert(rev=3,'owner can reassign another manager order');
 x:=public.staff_export_orders('Operations QA',p_include_contacts=>true);
 perform pg_temp.assert(x->'rows'->0 ? 'customer_contact','owner opt-in contacts are supported');
 begin perform public.staff_assign_order(a,rev,gen_random_uuid());raise exception 'not_rejected';exception when others then if sqlerrm<>'assignee_inactive' then raise;end if;end;
 perform public.staff_assess_production(a,rev,'{"cake":1,"chocolate":0,"gingerbread":0,"small":0}','Operations SQL cake',145000);
 rev:=(public.staff_order_details(a)->>'revision')::integer;
 o:=public.staff_confirm_order(a,rev);
 d:=(public.staff_order_details(a)->'order_notification_deliveries'->0->>'id')::uuid;
 perform pg_temp.assert((select payload->>'customer_contact'='operations-qa@example.invalid' and payload->>'event'='order_confirmed' from public.order_notification_deliveries where id=d),'confirmation freezes payload');
 perform public.staff_assign_order(a,(public.staff_order_details(a)->>'revision')::integer,null);
 perform pg_temp.assert((select (payload->>'revision')::integer<(select revision from public.orders where id=a) from public.order_notification_deliveries where id=d),'assignment leaves frozen message unchanged');
end $$;
reset role;
-- Claim, crash/reclaim, CAS completion, backoff, retry and terminal safety.
do $$ declare jobs jsonb;j jsonb;j2 jsonb;d uuid;a uuid;token uuid;rev integer;begin
 jobs:=public.claim_order_deliveries(5);j:=jobs->0;
 perform pg_temp.assert(jsonb_array_length(jobs)=1,'one confirmation claimed');d:=(j->>'id')::uuid;a:=(j->'payload'->>'order_id')::uuid;token:=(j->>'lease_token')::uuid;
 perform pg_temp.assert(jsonb_array_length(public.claim_order_deliveries(5))=0,'leased job cannot be claimed twice');
 perform pg_temp.assert(not public.complete_order_delivery('confirmation',d,gen_random_uuid(),'sent','forged'),'wrong lease cannot complete job');
 update public.order_notification_deliveries set locked_at=clock_timestamp()-interval '6 minutes' where id=d;
 j2:=public.claim_order_deliveries(5)->0;
 perform pg_temp.assert(j2->>'lease_token'<>j->>'lease_token' and (j2->>'attempt')::integer=2,'expired lease is reclaimed with new token');
 perform pg_temp.assert(not public.complete_order_delivery('confirmation',d,token,'sent','stale'),'old worker cannot overwrite new attempt');
 perform pg_temp.assert(public.complete_order_delivery('confirmation',d,(j2->>'lease_token')::uuid,'failed',null,'provider_429'),'new lease completion works');
 perform pg_temp.assert((select available_at>clock_timestamp() and status='failed' from public.order_notification_deliveries where id=d),'failure uses future backoff');
 perform pg_temp.assert(jsonb_array_length(public.claim_order_deliveries(5))=0,'backoff prevents early auto retry');
 perform set_config('request.jwt.claim.sub',(select id::text from operations_staff where role='owner'),true);
 rev:=(select revision from public.orders where id=a);
 perform public.staff_retry_order_notification('confirmation',d,rev);
 perform public.staff_retry_order_notification('confirmation',d,rev);
 perform pg_temp.assert((select count(*)=1 from public.order_delivery_attempts where delivery_id=d and status='retry_requested'),'double manual retry adds one audit entry');
 j2:=public.claim_order_deliveries(5)->0;
 perform public.complete_order_delivery('confirmation',d,(j2->>'lease_token')::uuid,'simulated');
 perform pg_temp.assert(jsonb_array_length(public.claim_order_deliveries())=0 and (select sent_at is null from public.order_notification_deliveries where id=d),'simulated success never pretends email was sent');
 perform pg_temp.assert(public.staff_retry_order_notification('confirmation',d,rev)='simulated','success cannot be resent');
 -- Two transfers produce frozen snapshots; the older transfer is suppressed.
 perform public.staff_change_order(a,rev,'reschedule',(select scheduled_start+interval '1 day' from public.orders where id=a),(select scheduled_end+interval '1 day' from public.orders where id=a));
 rev:=(select revision from public.orders where id=a);
 perform public.staff_change_order(a,rev,'reschedule',(select scheduled_start+interval '1 day' from public.orders where id=a),(select scheduled_end+interval '1 day' from public.orders where id=a));
 jobs:=public.claim_order_deliveries(5);
 perform pg_temp.assert(jsonb_array_length(jobs)=1,'old transfer suppressed, only latest claimed');j:=jobs->0;
 perform pg_temp.assert((select count(*)=1 from public.order_change_deliveries where order_id=a and status='manual_required' and last_error='superseded_notification'),'superseded attempt recorded');
 perform public.complete_order_delivery('change',(j->>'id')::uuid,(j->>'lease_token')::uuid,'failed',null,'transport_or_render_failed');
 update public.order_change_deliveries set attempts=5,available_at=clock_timestamp() where id=(j->>'id')::uuid;
 jobs:=public.claim_order_deliveries(5);
 perform pg_temp.assert(jsonb_array_length(jobs)=0 and (select last_error='attempts_exhausted' from public.order_change_deliveries where id=(j->>'id')::uuid),'five attempts stop automatic retry');
 rev:=(select revision from public.orders where id=a);perform public.staff_change_order(a,rev,'cancel');
 j:=public.claim_order_deliveries(5)->0;
 perform pg_temp.assert(j->'payload'->>'event'='order_cancelled','cancellation remains deliverable on terminal order');
 perform public.complete_order_delivery('change',(j->>'id')::uuid,(j->>'lease_token')::uuid,'failed',null,'provider_500');
 update public.order_change_deliveries set first_attempt_at=clock_timestamp()-interval '24 hours',available_at=clock_timestamp() where id=(j->>'id')::uuid;
 jobs:=public.claim_order_deliveries();
 perform pg_temp.assert(jsonb_array_length(jobs)=0 and (select last_error='idempotency_window_expired' from public.order_change_deliveries where id=(j->>'id')::uuid),'no unsafe retry after provider idempotency window');
 perform pg_temp.assert(public.authorize_notification_worker(repeat('x',72))=false,'incorrect scheduler token rejected');
end $$;
update public.staff_members set active=false where user_id=(select id from operations_staff where role='manager');
select set_config('request.jwt.claim.sub',(select id::text from operations_staff where role='manager'),true);
set local role authenticated;
do $$ begin
 begin perform public.staff_directory();raise exception 'not_rejected';exception when insufficient_privilege then null;end;
 begin perform public.staff_export_orders();raise exception 'not_rejected';exception when insufficient_privilege then null;end;
 begin perform public.staff_assign_order(gen_random_uuid(),1,null);raise exception 'not_rejected';exception when insufficient_privilege then null;end;
 begin perform public.staff_retry_order_notification('change',gen_random_uuid(),1);raise exception 'not_rejected';exception when insufficient_privilege then null;end;
 perform pg_temp.assert(not exists(select 1 from public.order_delivery_attempts),'revoked user cannot read attempts');
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.staff_export_orders();raise exception 'not_rejected';exception when insufficient_privilege then null;end;
 begin perform public.authorize_notification_worker(repeat('x',72));raise exception 'not_rejected';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: assignment authorization/revision/idempotency/audit, filtered export/privacy, frozen delivery leases/reclaim/CAS/backoff/retry/supersession/limits/RLS' as verification;
