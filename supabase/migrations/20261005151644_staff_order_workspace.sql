-- Stage 3: staff-only searchable projection, order detail and append-only notes.
create table private.order_search (
  order_id uuid primary key references public.orders(id) on delete cascade,
  search_text text not null,
  document tsvector generated always as (to_tsvector('simple',search_text)) stored
);
alter table private.order_search enable row level security;
revoke all on private.order_search from public,anon,authenticated;
grant select on private.order_search to authenticated;
grant all on private.order_search to service_role;
create policy staff_read on private.order_search for select to authenticated using ((select private.is_staff()));
create policy backend_all on private.order_search for all to service_role using(true) with check(true);
create index order_search_document_idx on private.order_search using gin(document);
create index orders_created_page_idx on public.orders(created_at desc,id desc);
create index orders_workspace_date_idx on public.orders(scheduled_start,id);

create function private.refresh_order_search(p_id uuid) returns void language sql security definer set search_path='' as $$
  insert into private.order_search(order_id,search_text)
  select o.id,'BLG-'||upper(left(replace(o.id::text,'-',''),8))||' '||replace(o.id::text,'-','')||' '||o.customer_name||' '||o.customer_contact||' '||o.note||' '||
    coalesce((select string_agg(i.product_name||' '||i.variant_description||' '||coalesce(i.snapshot->>'personalization',''),' ' order by i.id) from public.order_items i where i.order_id=o.id),'')
  from public.orders o where o.id=p_id
  on conflict(order_id) do update set search_text=excluded.search_text;
$$;
revoke all on function private.refresh_order_search(uuid) from public,anon,authenticated;
create function private.refresh_order_search_trigger() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='orders' then perform private.refresh_order_search(new.id);
  else perform private.refresh_order_search(case when tg_op='DELETE' then old.order_id else new.order_id end); end if;
  return coalesce(new,old);
end $$;
revoke all on function private.refresh_order_search_trigger() from public,anon,authenticated;
create trigger zz_order_search after insert or update on public.orders for each row execute function private.refresh_order_search_trigger();
create trigger zz_item_search after insert or update or delete on public.order_items for each row execute function private.refresh_order_search_trigger();
select private.refresh_order_search(id) from public.orders;

create table public.order_notes (
  id uuid primary key,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_revision integer not null check(order_revision>0),
  actor_id uuid not null references auth.users(id) on delete restrict,
  body text not null check(length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default clock_timestamp()
);
alter table public.order_notes enable row level security;
revoke all on public.order_notes from public,anon,authenticated;
grant select on public.order_notes to authenticated;
grant all on public.order_notes to service_role;
create policy staff_read on public.order_notes for select to authenticated using ((select private.is_staff()));
create policy backend_all on public.order_notes for all to service_role using(true) with check(true);
create index order_notes_order_time_idx on public.order_notes(order_id,created_at,id);
create index order_notes_actor_idx on public.order_notes(actor_id);

create function public.staff_search_orders(p_query text default '',p_status text default 'all',p_source text default 'all',p_fulfillment text default 'all',p_from date default null,p_to date default null,p_page integer default 0,p_size integer default 25)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare q text:=btrim(coalesce(p_query,'')); result jsonb;
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
  if length(q)>200 or p_status is null or p_status not in ('all','active','pending','confirmed','production','ready','completed','cancelled')
    or p_source is null or p_source not in ('all','website','chat','line','admin')
    or p_fulfillment is null or p_fulfillment not in ('all','pickup','delivery')
    or p_page is null or p_page not between 0 and 100000 or p_size is null or p_size not between 1 and 100
    or p_from is not null and p_to is not null and p_from>p_to then raise exception 'invalid_order_filters'; end if;
  with matching as materialized (
    select o.* from public.orders o join private.order_search s on s.order_id=o.id
    where (p_status='all' or p_status='active' and o.status not in ('completed','cancelled') or o.status=p_status)
      and (p_source='all' or o.source=p_source) and (p_fulfillment='all' or o.fulfillment=p_fulfillment)
      and (p_from is null or o.scheduled_start >= p_from::timestamp at time zone 'Asia/Bangkok')
      and (p_to is null or o.scheduled_start < (p_to+1)::timestamp at time zone 'Asia/Bangkok')
      and (q='' or s.document @@ websearch_to_tsquery('simple',q) or strpos(lower(s.search_text),lower(q))>0)
  ), page as (select * from matching order by created_at desc,id desc limit p_size offset p_page*p_size), rows as (
    select p.created_at,p.id,to_jsonb(p)||jsonb_build_object(
      'total_minor',p.delivery_minor+coalesce((select sum(i.line_total_minor) from public.order_items i where i.order_id=p.id),0),
      'order_items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'product_name',i.product_name,'variant_description',i.variant_description,'quantity',i.quantity,'unit_price_minor',i.unit_price_minor,'line_total_minor',i.line_total_minor) order by i.id) from public.order_items i where i.order_id=p.id),'[]'),
      'order_events','[]'::jsonb,'order_notes','[]'::jsonb,'order_notification_deliveries','[]'::jsonb,'order_change_deliveries','[]'::jsonb) as data from page p
  ) select jsonb_build_object('orders',coalesce((select jsonb_agg(data order by created_at desc,id desc) from rows),'[]'),
    'total',(select count(*) from matching),'stats',(select jsonb_build_object('pending',count(*) filter(where status='pending'),'preparing',count(*) filter(where status in ('confirmed','production')),'ready',count(*) filter(where status='ready')) from matching),
    'page',p_page,'size',p_size) into result;
  return result;
end $$;
revoke all on function public.staff_search_orders(text,text,text,text,date,date,integer,integer) from public,anon;
grant execute on function public.staff_search_orders(text,text,text,text,date,date,integer,integer) to authenticated;

create function public.staff_order_details(p_order_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
  select to_jsonb(o)||jsonb_build_object(
    'total_minor',o.delivery_minor+coalesce((select sum(i.line_total_minor) from public.order_items i where i.order_id=o.id),0),
    'order_items',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.order_items i where i.order_id=o.id),'[]'),
    'order_events',coalesce((select jsonb_agg(to_jsonb(e) order by e.revision,e.id) from public.order_events e where e.order_id=o.id),'[]'),
    'order_notes',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at,n.id) from public.order_notes n where n.order_id=o.id),'[]'),
    'order_notification_deliveries',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at,d.id) from public.order_notification_deliveries d where d.order_id=o.id),'[]'),
    'order_change_deliveries',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at,d.id) from public.order_change_deliveries d where d.order_id=o.id),'[]'))
  into result from public.orders o where o.id=p_order_id;
  if result is null then raise exception 'Order not found' using errcode='P0002'; end if;
  return result;
end $$;
revoke all on function public.staff_order_details(uuid) from public,anon;
grant execute on function public.staff_order_details(uuid) to authenticated;

create function private.staff_add_order_note(p_order_id uuid,p_revision integer,p_note_id uuid,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare current_order public.orders; saved public.order_notes; content text:=btrim(p_body);
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
  if p_note_id is null or content is null or length(content) not between 1 and 2000 then raise exception 'invalid_order_note'; end if;
  select * into current_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found' using errcode='P0002'; end if;
  -- Append-only notes do not change price, capacity, status or revision. A retry
  -- of the same staff request succeeds even if the order has changed meanwhile.
  select * into saved from public.order_notes where id=p_note_id;
  if found then
    if (saved.order_id,saved.actor_id,saved.body) is not distinct from (p_order_id,auth.uid(),content) then return saved.id; end if;
    raise exception 'order_note_id_conflict';
  end if;
  if p_revision is distinct from current_order.revision then raise exception 'Order changed; refresh before retrying' using errcode='40001'; end if;
  insert into public.order_notes(id,order_id,order_revision,actor_id,body) values(p_note_id,p_order_id,current_order.revision,auth.uid(),content);
  return p_note_id;
end $$;
revoke all on function private.staff_add_order_note(uuid,integer,uuid,text) from public,anon;
grant execute on function private.staff_add_order_note(uuid,integer,uuid,text) to authenticated;
create function public.staff_add_order_note(p_order_id uuid,p_revision integer,p_note_id uuid,p_body text) returns uuid language sql security invoker set search_path='' as $$
  select private.staff_add_order_note(p_order_id,p_revision,p_note_id,p_body);
$$;
revoke all on function public.staff_add_order_note(uuid,integer,uuid,text) from public,anon;
grant execute on function public.staff_add_order_note(uuid,integer,uuid,text) to authenticated;
