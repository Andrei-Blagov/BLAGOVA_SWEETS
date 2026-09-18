begin;
create temporary table test_ids as select gen_random_uuid() owner_id, gen_random_uuid() manager_id, gen_random_uuid() outsider_id, gen_random_uuid() customer_id, gen_random_uuid() order_id, gen_random_uuid() product_id, gen_random_uuid() draft_id, gen_random_uuid() variant_id, gen_random_uuid() knowledge_id;
grant select on test_ids to anon, authenticated, service_role;
insert into auth.users(id,email) select owner_id,'owner@blagova-test.invalid' from test_ids union all select manager_id,'manager@blagova-test.invalid' from test_ids union all select outsider_id,'visitor@blagova-test.invalid' from test_ids;
insert into public.staff_members(user_id,role) select owner_id,'owner' from test_ids union all select manager_id,'manager' from test_ids;
insert into public.products(id,slug,category,name,status) select product_id,'qa-published','cake','{"ru":"Тест"}'::jsonb,'published' from test_ids union all select draft_id,'qa-draft','cake','{"ru":"Черновик"}'::jsonb,'draft' from test_ids;
insert into public.product_variants(id,product_id,sku,name,price_minor,active) select variant_id,product_id,'QA-001','{"ru":"1 кг"}',145000,true from test_ids;
insert into public.customers(id,display_name) select customer_id,'QA customer' from test_ids;
insert into public.orders(id,request_key,customer_id,source,fulfillment,scheduled_start,scheduled_end,customer_name,customer_contact)
select order_id,gen_random_uuid(),customer_id,'website','pickup',now()+interval '3 days',now()+interval '3 days 2 hours','QA customer','test@example.invalid' from test_ids;
insert into public.order_items(order_id,variant_id,product_name,quantity,unit_price_minor) select order_id,variant_id,'QA cake',2,145000 from test_ids;
insert into public.knowledge_documents(id,slug,title,locale,body) select knowledge_id,'qa-knowledge','QA','ru','Draft answer' from test_ids;

set local role anon;
do $$ begin
  if (select count(*) from public.products) <> 1 then raise exception 'Anon sees unpublished products'; end if;
  if (select count(*) from public.product_variants) <> 1 then raise exception 'Anon cannot read active variant'; end if;
  begin perform * from public.orders; raise exception 'Anon read orders'; exception when insufficient_privilege then null; end;
  begin perform * from public.customers; raise exception 'Anon read contacts'; exception when insufficient_privilege then null; end;
  begin perform * from public.messages; raise exception 'Anon read messages'; exception when insufficient_privilege then null; end;
  begin perform * from public.knowledge_documents; raise exception 'Anon read knowledge drafts'; exception when insufficient_privilege then null; end;
  begin perform * from private.integration_jobs; raise exception 'Anon read integration jobs'; exception when insufficient_privilege then null; end;
  begin insert into public.products(slug,category,name) values('attack','cake','{"ru":"Attack"}'); raise exception 'Anon wrote product'; exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select outsider_id::text from test_ids),true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.orders) <> 0 then raise exception 'Nonstaff read orders'; end if;
  if (select count(*) from public.customers) <> 0 then raise exception 'Nonstaff read customers'; end if;
  if (select count(*) from public.knowledge_documents) <> 0 then raise exception 'Nonstaff read drafts'; end if;
  if (select count(*) from public.staff_members) <> 0 then raise exception 'Nonstaff read staff'; end if;
  begin insert into public.staff_members(user_id,role) values(auth.uid(),'owner'); raise exception 'Self promotion allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.products(slug,category,name) values('attack','cake','{"ru":"Attack"}'); raise exception 'Nonstaff wrote product'; exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select manager_id::text from test_ids),true);
set local role authenticated;
do $$ declare n integer; begin
  if (select count(*) from public.orders) <> 1 then raise exception 'Manager cannot read orders'; end if;
  if (select count(*) from public.products) <> 2 then raise exception 'Manager cannot read drafts'; end if;
  if (select count(*) from public.staff_members) <> 1 then raise exception 'Membership isolation failed'; end if;
  update public.products set name='{"ru":"Attack"}' where slug='qa-draft'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'Manager edited catalog'; end if;
  begin update public.staff_members set role='owner' where user_id=auth.uid(); raise exception 'Manager self promotion allowed'; exception when insufficient_privilege then null; end;
  begin update public.orders set status='confirmed'; raise exception 'Direct browser order write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select owner_id::text from test_ids),true);
set local role authenticated;
do $$ declare n integer; begin
  update public.products set name='{"ru":"Updated"}' where slug='qa-draft'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'Owner cannot edit catalog'; end if;
  update public.knowledge_documents set approved_by=auth.uid(), approved_at=now(),status='published' where slug='qa-knowledge';
  update public.knowledge_documents set body='Changed answer' where slug='qa-knowledge';
  if not exists(select 1 from public.knowledge_documents where slug='qa-knowledge' and status='draft' and version=2 and approved_by is null) then raise exception 'Changed knowledge remains approved'; end if;
  begin delete from public.staff_members where user_id=auth.uid(); raise exception 'Browser membership deletion allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.staff_members set active=false where user_id=(select manager_id from test_ids);
select set_config('request.jwt.claim.sub',(select manager_id::text from test_ids),true);
set local role authenticated;
do $$ begin if exists(select 1 from public.orders) then raise exception 'Inactive manager still has access'; end if; end $$;
reset role;

select set_config('request.jwt.claim.sub','',true);
set local role service_role;
do $$ declare oid uuid; n integer; begin
  select order_id into oid from test_ids;
  if (select sum(line_total_minor) from public.order_items where order_id=oid) <> 290000 then raise exception 'Incorrect monetary calculation'; end if;
  begin
    insert into public.order_items(order_id,product_name,quantity,unit_price_minor) values(oid,'Negative',1,-1);
    raise exception 'Negative price accepted';
  exception when check_violation then null; end;
  begin
    insert into public.orders(request_key,customer_id,source,fulfillment,scheduled_start,scheduled_end,customer_name,customer_contact)
    select request_key,customer_id,source,fulfillment,scheduled_start,scheduled_end,customer_name,customer_contact from public.orders where id=oid;
    raise exception 'Duplicate request accepted';
  exception when unique_violation then null; end;
  begin
    update public.orders set status='completed' where id=oid;
    raise exception using errcode='ZX001',message='Invalid transition accepted';
  exception when raise_exception then null; end;
  update public.orders set status='confirmed' where id=oid;
  if (select count(*) from public.order_events where order_id=oid) <> 2 then raise exception 'Audit history missing'; end if;
  if (select count(*) from private.integration_jobs where order_id=oid and status='held') <> 2 then raise exception 'Held jobs missing'; end if;
  update public.orders set scheduled_start=scheduled_start+interval '1 day',scheduled_end=scheduled_end+interval '1 day' where id=oid;
  if (select count(*) from private.integration_jobs where order_id=oid) <> 4 then raise exception 'Reschedule jobs missing'; end if;
  update public.orders set status='cancelled' where id=oid;
  if (select count(*) from private.integration_jobs where order_id=oid) <> 6 then raise exception 'Cancellation jobs missing'; end if;
  begin
    update public.orders set status='pending' where id=oid;
    raise exception using errcode='ZX001',message='Terminal order mutated';
  exception when raise_exception then null; end;
end $$;
reset role;
rollback;
select 'PASS: public/private access, owner/manager roles, revocation, knowledge draft reset, totals, idempotency, status transitions, audit and held integration jobs; fixtures rolled back' as verification;
