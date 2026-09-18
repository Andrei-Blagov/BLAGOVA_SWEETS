begin;
create temporary table api_test_ids as select gen_random_uuid() customer_id, gen_random_uuid() order_id, gen_random_uuid() thread_id, gen_random_uuid() message_id, gen_random_uuid() outsider_id, gen_random_uuid() manager_id;
grant select on api_test_ids to authenticated,anon;
insert into auth.users(id,email) select outsider_id,'rpc-test@example.invalid' from api_test_ids;
insert into auth.users(id,email) select manager_id,'rpc-manager@example.invalid' from api_test_ids;
insert into public.staff_members(user_id,role,active) select manager_id,'manager',true from api_test_ids;
insert into public.customers(id,display_name) select customer_id,'RPC test' from api_test_ids;
insert into public.conversations(id,customer_id,channel) select thread_id,customer_id,'website' from api_test_ids;
insert into public.orders(id,request_key,customer_id,source,fulfillment,scheduled_start,scheduled_end,customer_name,customer_contact)
select order_id,gen_random_uuid(),customer_id,'admin','pickup',now()+interval '5 days',now()+interval '5 days 2 hours','RPC test','test@example.invalid' from api_test_ids;
insert into public.order_items(order_id,product_name,quantity,unit_price_minor) select order_id,'Test',1,145000 from api_test_ids;
set local role anon;
do $$ begin
 begin perform public.staff_order_action((select order_id from api_test_ids),1,'status','confirmed'); raise exception 'Anon RPC allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select outsider_id::text from api_test_ids),true);
set local role authenticated;
do $$ begin
 begin perform public.staff_order_action((select order_id from api_test_ids),1,'status','confirmed'); raise exception 'Nonstaff RPC allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select manager_id::text from api_test_ids),true);
set local role authenticated;
select public.staff_order_action((select order_id from api_test_ids),1,'status','confirmed');
do $$ begin
 if (select status from public.orders where id=(select order_id from api_test_ids)) <> 'confirmed' then raise exception 'Status not saved'; end if;
 begin perform public.staff_order_action((select order_id from api_test_ids),1,'status','production'); raise exception 'Stale revision allowed'; exception when serialization_failure then null; end;
 begin perform public.staff_order_action((select order_id from api_test_ids),2,'status','completed'); raise exception using errcode='ZX001',message='Invalid transition allowed'; exception when raise_exception then null; end;
end $$;
select public.staff_order_action((select order_id from api_test_ids),2,'reschedule',null,now()+interval '6 days',now()+interval '6 days 2 hours');
select public.staff_conversation_action((select thread_id from api_test_ids),'take');
select public.staff_conversation_action((select thread_id from api_test_ids),'reply','Manager test',(select message_id from api_test_ids));
select public.staff_conversation_action((select thread_id from api_test_ids),'reply','Manager test',(select message_id from api_test_ids));
do $$ begin
 if (select count(*) from public.messages where conversation_id=(select thread_id from api_test_ids)) <> 1 then raise exception 'Message retry duplicated'; end if;
 if not exists(select 1 from public.order_events where order_id=(select order_id from api_test_ids) and revision=3 and actor_id=auth.uid()) then raise exception 'Audit actor missing'; end if;
end $$;
select public.staff_conversation_action((select thread_id from api_test_ids),'release');
do $$ begin
 begin perform public.staff_conversation_action((select thread_id from api_test_ids),'reply','Forbidden',gen_random_uuid()); raise exception using errcode='ZX001',message='Reply without takeover'; exception when raise_exception then null; end;
end $$;
reset role;
update public.staff_members set active=false where user_id=(select manager_id from api_test_ids);
set local role authenticated;
do $$ begin
 begin perform public.staff_order_action((select order_id from api_test_ids),3,'status','production'); raise exception 'Revoked staff RPC allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: RPC staff checks, anonymous/nonstaff/revoked denial, revision conflicts, status transitions, rescheduling, audit actor, conversation ownership and idempotent replies' as verification;
