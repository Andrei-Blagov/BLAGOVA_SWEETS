-- Staff assignments, filtered export and durable leased notification processing.
alter table public.orders add column assigned_to uuid references public.staff_members(user_id) on delete restrict;
create index orders_assignee_idx on public.orders(assigned_to,created_at desc,id desc);

create function private.staff_directory() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.user_id,'role',s.role,'label',coalesce(u.email,s.role||' · '||left(s.user_id::text,8))) order by s.role,u.email,s.user_id) from public.staff_members s join auth.users u on u.id=s.user_id where s.active),'[]');
end $$;
create function public.staff_directory() returns jsonb language sql stable security invoker set search_path='' as $$ select private.staff_directory(); $$;
revoke all on function private.staff_directory(),public.staff_directory() from public,anon;
grant execute on function private.staff_directory(),public.staff_directory() to authenticated;

create function private.staff_assign_order(p_order_id uuid,p_revision integer,p_assignee uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; r text;
begin
 select role into r from public.staff_members where user_id=auth.uid() and active;
 if r is null then raise exception 'Staff access required' using errcode='42501'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order not found'; end if;
 if p_revision is null then raise exception 'invalid_revision'; end if;
 if r<>'owner' and (o.assigned_to is not null and o.assigned_to<>auth.uid() or p_assignee is not null and p_assignee<>auth.uid()) then raise exception 'assignment_not_allowed' using errcode='42501'; end if;
 if p_assignee is not null and not exists(select 1 from public.staff_members where user_id=p_assignee and active) then raise exception 'assignee_inactive'; end if;
 -- Desired-state retry after a lost response does not create another revision.
 if o.assigned_to is not distinct from p_assignee then return; end if;
 if o.revision<>p_revision then raise exception 'Order changed; refresh before retrying' using errcode='40001'; end if;
 if o.status in ('completed','cancelled') then raise exception 'Order is final'; end if;
 update public.orders set assigned_to=p_assignee where id=o.id;
end $$;
create function public.staff_assign_order(p_order_id uuid,p_revision integer,p_assignee uuid) returns void language sql security invoker set search_path='' as $$ select private.staff_assign_order(p_order_id,p_revision,p_assignee); $$;
revoke all on function private.staff_assign_order(uuid,integer,uuid),public.staff_assign_order(uuid,integer,uuid) from public,anon;
grant execute on function private.staff_assign_order(uuid,integer,uuid),public.staff_assign_order(uuid,integer,uuid) to authenticated;
create function private.audit_order_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.order_events set details=details||jsonb_build_object('assigned_to',new.assigned_to,'assignee_label',(select coalesce(u.email,s.role||' · '||left(s.user_id::text,8)) from public.staff_members s join auth.users u on u.id=s.user_id where s.user_id=new.assigned_to)) where order_id=new.id and revision=new.revision;
 return new;
end $$;
revoke all on function private.audit_order_assignment() from public,anon,authenticated;
create trigger z_assignment_audit after insert or update on public.orders for each row execute function private.audit_order_assignment();

drop function public.staff_search_orders(text,text,text,text,date,date,integer,integer);
create function private.workspace_orders(p_query text,p_status text,p_source text,p_fulfillment text,p_from date,p_to date,p_assignee text)
returns setof public.orders language plpgsql stable security invoker set search_path='' as $$
declare q text:=btrim(coalesce(p_query,''));
begin
 if auth.uid() is null or not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
  if length(q)>200 or p_status is null or p_status not in ('all','active','pending','confirmed','production','ready','completed','cancelled')
    or p_source is null or p_source not in ('all','website','chat','line','admin')
    or p_fulfillment is null or p_fulfillment not in ('all','pickup','delivery')
    or p_assignee is null or (p_assignee not in ('all','mine','unassigned') and p_assignee !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    or p_from is not null and p_to is not null and p_from>p_to then raise exception 'invalid_order_filters'; end if;
  return query
    select o.* from public.orders o join private.order_search s on s.order_id=o.id
    where (p_status='all' or p_status='active' and o.status not in ('completed','cancelled') or o.status=p_status)
      and (p_source='all' or o.source=p_source) and (p_fulfillment='all' or o.fulfillment=p_fulfillment)
      and (p_from is null or o.scheduled_start >= p_from::timestamp at time zone 'Asia/Bangkok')
      and (p_to is null or o.scheduled_start < (p_to+1)::timestamp at time zone 'Asia/Bangkok')
      and (p_assignee='all' or p_assignee='mine' and o.assigned_to=auth.uid() or p_assignee='unassigned' and o.assigned_to is null or o.assigned_to::text=p_assignee)
      and (q='' or s.document @@ websearch_to_tsquery('simple',q) or strpos(lower(s.search_text),lower(q))>0)
;
end $$;
revoke all on function private.workspace_orders(text,text,text,text,date,date,text) from public,anon;
grant execute on function private.workspace_orders(text,text,text,text,date,date,text) to authenticated;
create function public.staff_search_orders(p_query text default '',p_status text default 'all',p_source text default 'all',p_fulfillment text default 'all',p_from date default null,p_to date default null,p_page integer default 0,p_size integer default 25,p_assignee text default 'all')
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
  if p_page is null or p_page not between 0 and 100000 or p_size is null or p_size not between 1 and 100 then raise exception 'invalid_order_filters'; end if;
  with matching as materialized (select * from private.workspace_orders(p_query,p_status,p_source,p_fulfillment,p_from,p_to,p_assignee)), page as (select * from matching order by created_at desc,id desc limit p_size offset p_page*p_size), rows as (
    select p.created_at,p.id,to_jsonb(p)||jsonb_build_object(
      'total_minor',p.delivery_minor+coalesce((select sum(i.line_total_minor) from public.order_items i where i.order_id=p.id),0),
      'order_items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'product_name',i.product_name,'variant_description',i.variant_description,'quantity',i.quantity,'unit_price_minor',i.unit_price_minor,'line_total_minor',i.line_total_minor) order by i.id) from public.order_items i where i.order_id=p.id),'[]'),
      'order_events','[]'::jsonb,'order_notes','[]'::jsonb,'order_notification_deliveries','[]'::jsonb,'order_change_deliveries','[]'::jsonb) as data from page p
  ) select jsonb_build_object('orders',coalesce((select jsonb_agg(data order by created_at desc,id desc) from rows),'[]'),
    'total',(select count(*) from matching),'stats',(select jsonb_build_object('pending',count(*) filter(where status='pending'),'preparing',count(*) filter(where status in ('confirmed','production')),'ready',count(*) filter(where status='ready')) from matching),
    'page',p_page,'size',p_size) into result;
  return result;
end $$;
revoke all on function public.staff_search_orders(text,text,text,text,date,date,integer,integer,text) from public,anon;
grant execute on function public.staff_search_orders(text,text,text,text,date,date,integer,integer,text) to authenticated;

create function public.staff_export_orders(p_query text default '',p_status text default 'all',p_source text default 'all',p_fulfillment text default 'all',p_from date default null,p_to date default null,p_assignee text default 'all',p_include_contacts boolean default false)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_include_contacts is null or p_include_contacts and not private.is_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
 with matching as materialized (select * from private.workspace_orders(p_query,p_status,p_source,p_fulfillment,p_from,p_to,p_assignee)), rows as (
 select o.created_at,o.id,jsonb_build_object('reference','BLG-'||upper(left(replace(o.id::text,'-',''),8)),'revision',o.revision,'status',o.status,'source',o.source,'fulfillment',o.fulfillment,'scheduled_start',to_char(o.scheduled_start at time zone 'Asia/Bangkok','YYYY-MM-DD HH24:MI'),'scheduled_end',to_char(o.scheduled_end at time zone 'Asia/Bangkok','YYYY-MM-DD HH24:MI'),'assigned_to',o.assigned_to,'production_load',o.production_load,'delivery_minor',o.delivery_minor,'total_minor',o.delivery_minor+coalesce((select sum(i.line_total_minor) from public.order_items i where i.order_id=o.id),0),'items',coalesce((select string_agg(i.product_name||' × '||i.quantity::text,', ' order by i.id) from public.order_items i where i.order_id=o.id),''),'is_demo',o.is_demo)
 ||case when p_include_contacts then jsonb_build_object('customer_name',o.customer_name,'customer_contact',o.customer_contact,'delivery_address',o.delivery_address) else '{}'::jsonb end as data from matching o order by o.created_at desc,o.id desc limit 10001
 ) select jsonb_build_object('rows',coalesce(jsonb_agg(data order by created_at desc,id desc),'[]'),'count',count(*),'includes_contacts',p_include_contacts,'timezone','Asia/Bangkok') into result from rows;
 if (result->>'count')::integer>10000 then raise exception 'export_limit_exceeded'; end if;
 return result;
end $$;
revoke all on function public.staff_export_orders(text,text,text,text,date,date,text,boolean) from public,anon;
grant execute on function public.staff_export_orders(text,text,text,text,date,date,text,boolean) to authenticated;

-- Existing tables remain readable. Older unsent deliveries are quarantined rather
-- than reconstructing possibly stale messages from the current order.
alter table public.order_notification_deliveries drop constraint order_notification_deliveries_status_check;
alter table public.order_notification_deliveries add constraint order_notification_deliveries_status_check check(status in ('pending','sending','sent','failed','manual_required','simulated'));
alter table public.order_notification_deliveries add column payload jsonb, add column lease_token uuid, add column first_attempt_at timestamptz;
update public.order_notification_deliveries set status='manual_required',locked_at=null,last_error='legacy_notification_review',updated_at=clock_timestamp() where status in ('pending','failed','sending');
alter table public.order_change_deliveries drop constraint order_change_deliveries_status_check;
alter table public.order_change_deliveries add constraint order_change_deliveries_status_check check(status in ('pending','sending','sent','failed','manual_required','simulated'));
alter table public.order_change_deliveries add column payload jsonb, add column lease_token uuid, add column first_attempt_at timestamptz;
update public.order_change_deliveries set status='manual_required',locked_at=null,last_error='legacy_notification_review',updated_at=clock_timestamp() where status in ('pending','failed','sending');
create table public.order_delivery_attempts(
 id uuid primary key default gen_random_uuid(), delivery_kind text not null check(delivery_kind in ('confirmation','change')),delivery_id uuid not null,order_id uuid not null references public.orders(id) on delete restrict,attempt integer not null,lease_token uuid not null unique,status text not null check(status in ('sending','sent','failed','manual_required','simulated','lease_expired','retry_requested')),error_code text,actor_id uuid references auth.users(id) on delete set null,created_at timestamptz not null default clock_timestamp(),finished_at timestamptz
);
alter table public.order_delivery_attempts enable row level security;
revoke all on public.order_delivery_attempts from public,anon,authenticated;
grant select on public.order_delivery_attempts to authenticated;
grant all on public.order_delivery_attempts to service_role;
create policy staff_read on public.order_delivery_attempts for select to authenticated using ((select private.is_staff()));
create policy backend_all on public.order_delivery_attempts for all to service_role using(true) with check(true);
create index delivery_attempts_order_idx on public.order_delivery_attempts(order_id,created_at,id);
create index delivery_attempts_actor_idx on public.order_delivery_attempts(actor_id);

create function private.capture_delivery_payload() returns trigger language plpgsql security definer set search_path='' as $$
declare o public.orders; locale text;
begin
 select * into o from public.orders where id=new.order_id;
 select c.locale into locale from public.customers c where c.id=o.customer_id;
 new.payload:=jsonb_build_object('order_id',o.id,'revision',o.revision,'reference','BLG-'||upper(left(replace(o.id::text,'-',''),8)),'event',new.event,'customer_name',o.customer_name,'customer_contact',o.customer_contact,'locale',locale,'fulfillment',o.fulfillment,'delivery_address',o.delivery_address,'scheduled_start',o.scheduled_start,'scheduled_end',o.scheduled_end,'is_demo',o.is_demo,'total_minor',o.delivery_minor+coalesce((select sum(i.line_total_minor) from public.order_items i where i.order_id=o.id),0),'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.product_name,'detail',i.variant_description,'quantity',i.quantity,'line_total_minor',i.line_total_minor) order by i.id) from public.order_items i where i.order_id=o.id),'[]'));
 return new;
end $$;
revoke all on function private.capture_delivery_payload() from public,anon,authenticated;
create trigger capture_delivery before insert on public.order_notification_deliveries for each row execute function private.capture_delivery_payload();
create trigger capture_delivery before insert on public.order_change_deliveries for each row execute function private.capture_delivery_payload();

-- Worker authorization is installed through Vault by the platform runbook.
-- Missing Vault/secret fails closed (also permits isolated PostgreSQL tests).
create function private.authorize_notification_worker(p_token text) returns boolean language plpgsql security definer set search_path='' as $$
declare ok boolean:=false;
begin
 if p_token is null or length(p_token) not between 32 and 256 or to_regclass('vault.decrypted_secrets') is null then return false; end if;
 execute 'select exists(select 1 from vault.decrypted_secrets where name=$1 and decrypted_secret=$2)' into ok using 'blagova_notification_worker_token',p_token;
 return coalesce(ok,false);
end $$;
create function public.authorize_notification_worker(p_token text) returns boolean language sql security invoker set search_path='' as $$ select private.authorize_notification_worker(p_token); $$;
revoke all on function private.authorize_notification_worker(text),public.authorize_notification_worker(text) from public,anon,authenticated;
grant execute on function private.authorize_notification_worker(text),public.authorize_notification_worker(text) to service_role;

create function private.claim_order_deliveries(p_limit integer default 10) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb:='[]';kind text;t text;d record;token uuid;why text;current_o public.orders;
begin
 if p_limit is null or p_limit not between 1 and 20 then raise exception 'invalid_batch_size'; end if;
 for kind,t in select * from (values('confirmation','order_notification_deliveries'),('change','order_change_deliveries')) v loop
  for d in execute format('select * from public.%I where (status in (''pending'',''failed'') and available_at<=clock_timestamp()) or (status=''sending'' and locked_at<clock_timestamp()-interval ''5 minutes'') order by available_at,id limit $1 for update skip locked',t) using p_limit-jsonb_array_length(result) loop
   why:=null;
   select * into current_o from public.orders where id=d.order_id;
   if d.status='sending' then update public.order_delivery_attempts set status='lease_expired',finished_at=clock_timestamp(),error_code='lease_expired' where lease_token=d.lease_token and status='sending'; end if;
   if d.payload is null then why:='legacy_notification_review';
   elsif d.attempts>=5 then why:='attempts_exhausted';
   elsif d.first_attempt_at<clock_timestamp()-interval '23 hours' then why:='idempotency_window_expired';
   elsif exists(select 1 from public.order_change_deliveries newer where newer.order_id=d.order_id and newer.order_revision>(d.payload->>'revision')::integer) then why:='superseded_notification';
   elsif d.event='order_cancelled' and current_o.status<>'cancelled' then why:='superseded_notification';
   elsif d.event<>'order_cancelled' and (current_o.status in ('cancelled','completed') or current_o.scheduled_start is distinct from (d.payload->>'scheduled_start')::timestamptz or current_o.scheduled_end is distinct from (d.payload->>'scheduled_end')::timestamptz) then why:='superseded_notification'; end if;
   if why is not null then
    execute format('update public.%I set status=''manual_required'',last_error=$2,locked_at=null,lease_token=null,updated_at=clock_timestamp() where id=$1',t) using d.id,why;
    insert into public.order_delivery_attempts(delivery_kind,delivery_id,order_id,attempt,lease_token,status,error_code,finished_at) values(kind,d.id,d.order_id,d.attempts,gen_random_uuid(),'manual_required',why,clock_timestamp());
    continue;
   end if;
   token:=gen_random_uuid();
   execute format('update public.%I set status=''sending'',attempts=attempts+1,locked_at=clock_timestamp(),lease_token=$2,first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),last_error=null,updated_at=clock_timestamp() where id=$1',t) using d.id,token;
   insert into public.order_delivery_attempts(delivery_kind,delivery_id,order_id,attempt,lease_token,status) values(kind,d.id,d.order_id,d.attempts+1,token,'sending');
   result:=result||jsonb_build_array(jsonb_build_object('kind',kind,'id',d.id,'lease_token',token,'attempt',d.attempts+1,'payload',d.payload));
  end loop;
 end loop;
 return result;
end $$;
create function public.claim_order_deliveries(p_limit integer default 10) returns jsonb language sql security invoker set search_path='' as $$ select private.claim_order_deliveries(p_limit); $$;

create function private.complete_order_delivery(p_kind text,p_delivery_id uuid,p_lease_token uuid,p_status text,p_provider_id text default null,p_error text default null) returns boolean language plpgsql security definer set search_path='' as $$
declare t text;n integer;
begin
 t:=case p_kind when 'confirmation' then 'order_notification_deliveries' when 'change' then 'order_change_deliveries' end;
 if t is null or p_status is null or p_status not in ('sent','failed','manual_required','simulated') or p_error is not null and p_error !~ '^[a-z0-9_]{1,80}$' then raise exception 'invalid_delivery_result'; end if;
 execute format('update public.%I set status=case when $3=''failed'' and attempts>=5 then ''manual_required'' else $3 end,provider_message_id=case when $3=''sent'' then $4 else provider_message_id end,last_error=case when $3=''failed'' and attempts>=5 then ''attempts_exhausted'' else $5 end,sent_at=case when $3=''sent'' then clock_timestamp() else sent_at end,available_at=case when $3=''failed'' then clock_timestamp()+make_interval(secs=>least(3600,60*(2^attempts)::integer)) else available_at end,locked_at=null,lease_token=null,updated_at=clock_timestamp() where id=$1 and lease_token=$2 and status=''sending''',t) using p_delivery_id,p_lease_token,p_status,p_provider_id,p_error;
 get diagnostics n=row_count;
 if n=1 then update public.order_delivery_attempts set status=case when p_status='failed' and attempt>=5 then 'manual_required' else p_status end,error_code=case when p_status='failed' and attempt>=5 then 'attempts_exhausted' else p_error end,finished_at=clock_timestamp() where lease_token=p_lease_token and status='sending'; end if;
 return n=1;
end $$;
create function public.complete_order_delivery(p_kind text,p_delivery_id uuid,p_lease_token uuid,p_status text,p_provider_id text default null,p_error text default null) returns boolean language sql security invoker set search_path='' as $$ select private.complete_order_delivery(p_kind,p_delivery_id,p_lease_token,p_status,p_provider_id,p_error); $$;
revoke all on function private.claim_order_deliveries(integer),public.claim_order_deliveries(integer),private.complete_order_delivery(text,uuid,uuid,text,text,text),public.complete_order_delivery(text,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.claim_order_deliveries(integer),public.claim_order_deliveries(integer),private.complete_order_delivery(text,uuid,uuid,text,text,text),public.complete_order_delivery(text,uuid,uuid,text,text,text) to service_role;

create function private.staff_retry_order_notification(p_kind text,p_delivery_id uuid,p_revision integer) returns text language plpgsql security definer set search_path='' as $$
declare t text;d record;o public.orders;
begin
 if auth.uid() is null or not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 t:=case p_kind when 'confirmation' then 'order_notification_deliveries' when 'change' then 'order_change_deliveries' end;
 if t is null then raise exception 'invalid_delivery_kind'; end if;
 -- Lock order before delivery, matching staff_confirm/change order lock order.
 execute format('select order_id from public.%I where id=$1',t) into d using p_delivery_id;
 if d.order_id is null then raise exception 'Delivery not found'; end if;
 select * into o from public.orders where id=d.order_id for update;
 execute format('select * from public.%I where id=$1 for update',t) into d using p_delivery_id;
 if p_revision is null or o.revision<>p_revision then raise exception 'Order changed; refresh before retrying' using errcode='40001'; end if;
 if d.status in ('sent','simulated','pending','sending') then return d.status; end if;
 if d.status<>'failed' or d.payload is null or d.attempts>=5 or d.first_attempt_at<clock_timestamp()-interval '23 hours' then raise exception 'notification_requires_manual_review'; end if;
 execute format('update public.%I set status=''pending'',available_at=clock_timestamp(),last_error=null,updated_at=clock_timestamp() where id=$1',t) using d.id;
 insert into public.order_delivery_attempts(delivery_kind,delivery_id,order_id,attempt,lease_token,status,actor_id,finished_at) values(p_kind,d.id,o.id,d.attempts,gen_random_uuid(),'retry_requested',auth.uid(),clock_timestamp());
 return 'pending';
end $$;
create function public.staff_retry_order_notification(p_kind text,p_delivery_id uuid,p_revision integer) returns text language sql security invoker set search_path='' as $$ select private.staff_retry_order_notification(p_kind,p_delivery_id,p_revision); $$;
revoke all on function private.staff_retry_order_notification(text,uuid,integer),public.staff_retry_order_notification(text,uuid,integer) from public,anon;
grant execute on function private.staff_retry_order_notification(text,uuid,integer),public.staff_retry_order_notification(text,uuid,integer) to authenticated;

-- Retire unleased legacy entry points so old clients cannot bypass the worker.
revoke all on function private.claim_order_confirmation(uuid),public.claim_order_confirmation(uuid),private.complete_order_confirmation(uuid,text,text,text),public.complete_order_confirmation(uuid,text,text,text),private.claim_order_change(uuid),public.claim_order_change(uuid),private.complete_order_change(uuid,text,text,text),public.complete_order_change(uuid,text,text,text) from service_role;
alter function public.staff_order_details(uuid) rename to staff_order_details_base;
create function public.staff_order_details(p_order_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select public.staff_order_details_base(p_order_id)||jsonb_build_object('order_delivery_attempts',coalesce((select jsonb_agg(to_jsonb(a)-'lease_token' order by a.created_at,a.id) from public.order_delivery_attempts a where a.order_id=p_order_id),'[]'));
$$;
revoke all on function public.staff_order_details(uuid) from public,anon;
grant execute on function public.staff_order_details(uuid) to authenticated;
