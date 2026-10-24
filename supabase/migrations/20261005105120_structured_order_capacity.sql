-- Stage 2. Additive, explicitly applied before Edge Functions and Preview.
-- Historical order rows and items are retained with unknown load (NULL), never zero.
create table public.production_rule_versions (
  version bigint generated always as identity primary key,
  config jsonb not null,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.production_rule_versions enable row level security;
revoke all on public.production_rule_versions from public,anon,authenticated;
grant select on public.production_rule_versions to authenticated;
grant all on public.production_rule_versions to service_role;
grant usage,select on sequence public.production_rule_versions_version_seq to service_role;
create policy staff_read on public.production_rule_versions for select to authenticated using ((select private.is_staff()));
insert into public.production_rule_versions(config) select jsonb_build_object(
  'budget',32,'hold_minutes',60,
  'coefficients','{"cake":8,"chocolate":4,"gingerbread":1,"small":1}'::jsonb,
  'limits','{"cake":4,"chocolate":4,"gingerbread":8,"small":32}'::jsonb,
  'gift_chocolates_per_set',6,'gingerbread_per_set',2,
  'slots',(select jsonb_agg(jsonb_build_object('weekday',iso_weekday,'start',to_char(start_time,'HH24:MI'),'end',to_char(end_time,'HH24:MI')) order by iso_weekday,start_time) from public.production_slots where active),
  'blackouts',(select coalesce(jsonb_agg(jsonb_build_object('date',blackout_date,'reason',reason)),'[]'::jsonb) from public.production_blackout_dates)
);
create table public.production_variant_profiles (
  variant_id uuid primary key references public.product_variants(id) on delete restrict,
  components jsonb not null check (jsonb_typeof(components)='object'),
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.production_variant_profiles enable row level security;
revoke all on public.production_variant_profiles from public,anon,authenticated;
grant select,insert,update on public.production_variant_profiles to authenticated;
grant all on public.production_variant_profiles to service_role;
create policy owner_read on public.production_variant_profiles for select to authenticated using ((select private.is_owner()));
create policy owner_insert on public.production_variant_profiles for insert to authenticated with check ((select private.is_owner()));
create policy owner_update on public.production_variant_profiles for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()));
-- Quantities come from the actual demo variants, not translated labels or client load.
insert into public.production_variant_profiles(variant_id,components)
select id,case
  when sku in ('berry-cloud-1kg','berry-cloud-1_5kg','berry-cloud-2kg','celebration-cake-1kg','celebration-cake-1_5kg','celebration-cake-2kg') then '{"cake":1}'::jsonb
  when sku in ('raspberry-kisses-standard','birthday-cupcakes-standard') then '{"small":6}'::jsonb
  when sku='chocolate-stories-standard' then '{"chocolate":1}'::jsonb
  when sku='gingerbread-heart-standard' then '{"gingerbread":1}'::jsonb end
from public.product_variants where sku not in ('custom-gift','celebration-set');

create function private.validate_production_counts(p_counts jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare e record; positive boolean:=false;
begin
  if p_counts is null or jsonb_typeof(p_counts)<>'object' or p_counts='{}'::jsonb then raise exception 'production_load_required'; end if;
  for e in select * from jsonb_each_text(p_counts) loop
    if e.key not in ('cake','chocolate','gingerbread','small') or e.value !~ '^[0-9]+$' or length(e.value)>6 or e.value::integer>100000 then raise exception 'invalid_production_counts'; end if;
    positive:=positive or e.value::integer>0;
  end loop;
  if not positive then raise exception 'production_load_required'; end if;
end $$;
create function private.guard_production_profile() returns trigger language plpgsql set search_path='' as $$
begin
  perform private.validate_production_counts(new.components);
  if tg_op='UPDATE' then new.version:=old.version+1; end if;
  new.updated_at:=now(); return new;
end $$;
create trigger production_profile_guard before insert or update on public.production_variant_profiles for each row execute function private.guard_production_profile();
create function private.audit_production_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.catalog_events(entity,entity_id,action,actor_id,previous,current_value)
 values('production_variant_profiles',new.variant_id::text,tg_op,auth.uid(),case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function private.audit_production_profile() from public,anon,authenticated;
create trigger audit_catalog after insert or update on public.production_variant_profiles for each row execute function private.audit_production_profile();

alter table public.order_items
  add column snapshot jsonb,
  add column load_units integer check (load_units>0),
  add column category_counts jsonb,
  add column rules_version bigint references public.production_rule_versions(version);
alter table public.orders
  add column production_load integer check (production_load>0),
  add column category_counts jsonb,
  add column production_assessment jsonb,
  add column rules_version bigint references public.production_rule_versions(version),
  add column reservation_expires_at timestamptz;
create index orders_capacity_overlap_idx on public.orders(scheduled_start,scheduled_end)
where status in ('pending','confirmed','production','ready','completed');

create function private.quote_production_item(p_item jsonb,p_locale text,p_rules jsonb,p_version bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  q record; v record; e record; cfg jsonb:=coalesce(p_item->'configuration','{}');
  qty integer; counts jsonb; comps jsonb; chosen_options jsonb; units integer:=0; n integer;
begin
  if p_item is null or jsonb_typeof(p_item)<>'object' or coalesce(p_item->>'quantity','') !~ '^[0-9]+$' or length(p_item->>'quantity')>3 then raise exception 'invalid_item'; end if;
  if length(coalesce(p_item->>'personalization',''))>80 or length(coalesce(p_item->>'description',''))>500 then raise exception 'invalid_item'; end if;
  qty:=(p_item->>'quantity')::integer;
  if qty not between 1 and 100 then raise exception 'invalid_item'; end if;
  select * into q from private.resolve_storefront_item(p_item->>'sku',p_locale,cfg,p_item->>'personalization',p_item->>'description');
  if qty<q.min_quantity then raise exception 'catalog_item_unavailable'; end if;
  select p.id product_id,p.slug,p.name product_names,pv.name variant_names,pv.options,pv.sku,pp.components,pp.version profile_version
  into v from public.product_variants pv join public.products p on p.id=pv.product_id
  left join public.production_variant_profiles pp on pp.variant_id=pv.id where pv.id=q.variant_id;
  if v.sku='custom-gift' then
    n:=(cfg->>'chocolate')::integer+(cfg->>'raspberry')::integer+(cfg->>'pistachio')::integer;
    counts:=jsonb_build_object('chocolate',ceil(n::numeric/(p_rules->>'gift_chocolates_per_set')::integer)::integer,
      'gingerbread',ceil((cfg->>'gingerbread')::numeric/(p_rules->>'gingerbread_per_set')::integer)::integer);
    comps:=jsonb_build_object('chocolate',cfg->'chocolate','raspberry',cfg->'raspberry','pistachio',cfg->'pistachio','gingerbread',cfg->'gingerbread');
  elsif v.sku='celebration-set' then
    counts:=jsonb_build_object('cake',1,'small',case when (cfg->>'withCupcakes')::boolean then (cfg->>'guests')::integer else 0 end,
      'gingerbread',case when (cfg->>'withCookies')::boolean then ceil((cfg->>'guests')::numeric/(p_rules->>'gingerbread_per_set')::integer)::integer else 0 end);
    comps:=jsonb_build_object('cake',1,'cake_kg',ceil((cfg->>'guests')::numeric/7*2)/2,
      'cupcakes',counts->'small','gingerbread_pieces',case when (cfg->>'withCookies')::boolean then (cfg->>'guests')::integer else 0 end);
  else counts:=v.components; comps:=v.components; end if;
  perform private.validate_production_counts(counts);
  for e in select * from jsonb_each_text(counts) loop
    units:=units+e.value::integer*(p_rules->'coefficients'->>e.key)::integer;
    counts:=jsonb_set(counts,array[e.key],to_jsonb(e.value::integer*qty));
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'group',o.option_group,'key',o.option_key,'label',o.label,'price_delta_minor',o.price_delta_minor) order by o.option_group),'[]')
  into chosen_options from public.catalog_options o where o.product_id=v.product_id and o.active and cfg->'options'->>o.option_group=o.option_key;
  return jsonb_build_object('schema_version',1,'product',jsonb_build_object('id',v.product_id,'slug',v.slug,'names',v.product_names),
    'variant',jsonb_build_object('id',q.variant_id,'sku',v.sku,'names',v.variant_names,'options',v.options,'production_profile_version',v.profile_version),
    'quantity',qty,'configuration',cfg,'personalization',coalesce(p_item->>'personalization',''),
    'options',chosen_options,'components',comps,'category_counts',counts,'load_units',units*qty,'unit_load_units',units,
    'rules_version',p_version,'production_rules',p_rules-'slots'-'blackouts',
    'unit_price_minor',q.price_minor,'line_total_minor',q.price_minor::bigint*qty,'currency','THB',
    'name',q.product_name,'detail',q.variant_description,'lead_days',q.lead_days);
end $$;

create function private.quote_production_cart(p_items jsonb,p_locale text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.production_rule_versions; item jsonb; quoted jsonb; lines jsonb:='[]'; counts jsonb:='{"cake":0,"chocolate":0,"gingerbread":0,"small":0}'; e record; load integer:=0; lead integer:=0;
begin
  if p_locale is null or p_locale not in ('ru','en','th') or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 25 then raise exception 'invalid_items'; end if;
  perform pg_advisory_xact_lock_shared(710002,1);
  -- Freeze all price/profile rows for this quote and order transaction.
  lock table public.products,public.product_variants,public.catalog_options,public.catalog_price_rules,public.production_variant_profiles in share mode;
  select * into strict r from public.production_rule_versions order by version desc limit 1;
  for item in select value from jsonb_array_elements(p_items) loop
    quoted:=private.quote_production_item(item,p_locale,r.config,r.version);
    lines:=lines||jsonb_build_array(quoted); load:=load+(quoted->>'load_units')::integer; lead:=greatest(lead,(quoted->>'lead_days')::integer);
    for e in select * from jsonb_each_text(quoted->'category_counts') loop counts:=jsonb_set(counts,array[e.key],to_jsonb((counts->>e.key)::integer+e.value::integer)); end loop;
  end loop;
  return jsonb_build_object('items',lines,'load_units',load,'category_counts',counts,'rules_version',r.version,'lead_days',lead);
end $$;

create function private.production_capacity(p_start timestamptz,p_end timestamptz,p_load integer,p_counts jsonb,p_exclude uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r jsonb; used integer; counts jsonb:='{"cake":0,"chocolate":0,"gingerbread":0,"small":0}'; o record; e record; unknown integer:=0; fits boolean; day date:=(p_start at time zone 'Asia/Bangkok')::date;
begin
  select config into r from public.production_rule_versions order by version desc limit 1;
  if p_start is null or p_end is null or (p_end at time zone 'Asia/Bangkok')::date<>day or not exists(
    select 1 from jsonb_array_elements(r->'slots') s where (s->>'weekday')::integer=extract(isodow from day)::integer
    and (s->>'start')::time=(p_start at time zone 'Asia/Bangkok')::time and (s->>'end')::time=(p_end at time zone 'Asia/Bangkok')::time
  ) then raise exception 'slot_unavailable'; end if;
  used:=0;
  for o in select production_load,category_counts from public.orders
    where id is distinct from p_exclude and scheduled_start<p_end and scheduled_end>p_start
      and (status in ('confirmed','production','ready','completed') or status='pending' and reservation_expires_at>clock_timestamp()) loop
    if o.production_load is null or o.category_counts is null then unknown:=unknown+1; continue; end if;
    used:=used+o.production_load;
    for e in select * from jsonb_each_text(o.category_counts) loop counts:=jsonb_set(counts,array[e.key],to_jsonb((counts->>e.key)::integer+e.value::integer)); end loop;
  end loop;
  fits:=unknown=0 and used+coalesce(p_load,0)<=(r->>'budget')::integer and not exists(select 1 from jsonb_array_elements(r->'blackouts') b where (b->>'date')::date=day);
  for e in select * from jsonb_each_text(r->'limits') loop fits:=fits and (counts->>e.key)::integer+coalesce((p_counts->>e.key)::integer,0)<=e.value::integer; end loop;
  return jsonb_build_object('capacity',(r->>'budget')::integer,'used',used,'available',fits,'category_used',counts,'category_limits',r->'limits','unknown_orders',unknown,'requested_load',p_load);
end $$;

create or replace function private.enforce_order_schedule_capacity() returns trigger
language plpgsql security definer set search_path='' as $$
declare changed boolean; entering boolean; target boolean; k bigint; old_day date; new_day date; r jsonb; state jsonb;
begin
  perform pg_advisory_xact_lock_shared(710002,1);
  changed:=tg_op='INSERT' or new.scheduled_start is distinct from old.scheduled_start or new.scheduled_end is distinct from old.scheduled_end;
  entering:=new.status in ('confirmed','production','ready','completed') and (tg_op='INSERT' or old.status='pending');
  if changed and new.scheduled_start<=clock_timestamp() then raise exception 'invalid_schedule'; end if;
  if tg_op='UPDATE' and old.status in ('confirmed','production','ready','completed') and
    (new.production_load,new.category_counts,new.production_assessment,new.rules_version) is distinct from (old.production_load,old.category_counts,old.production_assessment,old.rules_version) then raise exception 'confirmed_production_is_immutable'; end if;
  if new.status='cancelled' or new.status in ('confirmed','production','ready','completed') then new.reservation_expires_at:=null;
  elsif changed and new.production_load is not null then
    select config into r from public.production_rule_versions order by version desc limit 1;
    new.reservation_expires_at:=clock_timestamp()+make_interval(mins=>(r->>'hold_minutes')::integer);
  end if;
  target:=new.status in ('confirmed','production','ready','completed') or new.status='pending' and new.reservation_expires_at>clock_timestamp();
  -- Lock dates, a deliberately broader lock than one interval: overlapping intervals
  -- and opposite-direction transfers cannot evade capacity or deadlock on slot order.
  if target or tg_op='UPDATE' and old.reservation_expires_at is not null then
    new_day:=(new.scheduled_start at time zone 'Asia/Bangkok')::date;
    old_day:=case when tg_op='UPDATE' then (old.scheduled_start at time zone 'Asia/Bangkok')::date else new_day end;
    for k in select distinct hashtextextended('production-date:'||d::text,710002) from unnest(array[old_day,new_day]) d order by 1 loop perform pg_advisory_xact_lock(k); end loop;
  end if;
  if target and (changed or entering or tg_op='UPDATE' and (new.production_load,new.category_counts,new.reservation_expires_at) is distinct from (old.production_load,old.category_counts,old.reservation_expires_at)) then
    if new.production_load is null then raise exception 'production_load_required'; end if;
    perform private.validate_production_counts(new.category_counts);
    state:=private.production_capacity(new.scheduled_start,new.scheduled_end,new.production_load,new.category_counts,case when tg_op='UPDATE' then new.id else null end);
    if not (state->>'available')::boolean then raise exception 'slot_capacity_full'; end if;
  elsif changed then
    perform private.production_capacity(new.scheduled_start,new.scheduled_end,0,'{}',null);
  end if;
  return new;
end $$;
drop trigger orders_schedule_capacity_guard on public.orders;
create trigger orders_schedule_capacity_guard before insert or update on public.orders for each row execute function private.enforce_order_schedule_capacity();

create function private.guard_item_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op in ('UPDATE','DELETE') and (old.snapshot is not null or exists(select 1 from public.orders where id=old.order_id and status<>'pending')) then raise exception 'order_item_is_immutable'; end if;
  if tg_op='DELETE' then return old; end if;
  if new.snapshot is not null and (new.snapshot->>'quantity')::integer<>new.quantity then raise exception 'snapshot_quantity_mismatch'; end if;
  return new;
end $$;
create trigger order_item_snapshot_guard before insert or update or delete on public.order_items for each row execute function private.guard_item_snapshot();

create or replace function public.receive_storefront_order(
  p_request_key uuid,
  p_source text,
  p_locale text,
  p_customer_name text,
  p_customer_contact text,
  p_fulfillment text,
  p_delivery_address text,
  p_delivery_zone text,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz,
  p_note text,
  p_items jsonb,
  p_messages jsonb,
  p_rate_key text
) returns table(order_id uuid, reference text, duplicate boolean, delivery_minor integer, items jsonb, total_minor bigint)
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
  v_catalog record;
  v_delivery_minor integer;
  v_max_lead integer := 0;
  v_items jsonb;
  v_total bigint;
  v_quote jsonb;
  v_snapshot jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('request:'||p_request_key::text,710002));
  select o.id into v_order_id from public.orders o where o.request_key=p_request_key;
  if v_order_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'name',oi.product_name,'detail',oi.variant_description,'quantity',oi.quantity,'unit_price_minor',oi.unit_price_minor
    ) order by oi.created_at,oi.id) filter (where oi.id is not null),'[]'::jsonb),
      coalesce(sum(oi.line_total_minor),0) + o.delivery_minor
    into v_items,v_total
    from public.orders o left join public.order_items oi on oi.order_id=o.id
    where o.id=v_order_id group by o.delivery_minor;
    return query select v_order_id,'BLG-' || upper(substr(replace(v_order_id::text,'-',''),1,8)),true,
      (select o.delivery_minor from public.orders o where o.id=v_order_id),v_items,v_total;
    return;
  end if;

  if p_rate_key !~ '^[0-9a-f]{64}$' then raise exception 'invalid_rate_key'; end if;
  insert into private.public_intake_limits as limits(key_hash,window_started_at,request_count,updated_at)
  values(p_rate_key,now(),1,now())
  on conflict (key_hash) do update set
    window_started_at=case when limits.window_started_at < now()-interval '15 minutes' then now() else limits.window_started_at end,
    request_count=case when limits.window_started_at < now()-interval '15 minutes' then 1 else limits.request_count+1 end,
    updated_at=now()
  returning request_count into v_count;
  if v_count > 5 then raise exception 'rate_limit'; end if;

  if p_source not in ('website','chat') or p_locale not in ('ru','en','th') then raise exception 'invalid_source'; end if;
  if length(btrim(p_customer_name)) not between 1 and 80 or length(btrim(p_customer_contact)) not between 3 and 120 then raise exception 'invalid_customer'; end if;
  if p_fulfillment not in ('pickup','delivery') then raise exception 'invalid_fulfillment'; end if;
  if p_fulfillment='pickup' then
    if p_delivery_zone <> 'pickup' then raise exception 'invalid_delivery'; end if;
    v_delivery_minor := 0;
  else
    if p_delivery_zone not in ('central','jomtien') or length(btrim(coalesce(p_delivery_address,''))) not between 1 and 200 then raise exception 'invalid_delivery'; end if;
    v_delivery_minor := case p_delivery_zone when 'central' then 12000 else 18000 end;
  end if;
  if p_scheduled_start < now() or p_scheduled_end <= p_scheduled_start or p_scheduled_end > p_scheduled_start+interval '4 hours' then raise exception 'invalid_schedule'; end if;
  if length(coalesce(p_note,'')) > 600 then raise exception 'invalid_note'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 0 and 25 or (jsonb_array_length(p_items)=0 and p_source<>'chat') then raise exception 'invalid_items'; end if;
  if jsonb_typeof(p_messages) <> 'array' or jsonb_array_length(p_messages) > 20 then raise exception 'invalid_messages'; end if;

  if jsonb_array_length(p_items)>0 then v_quote:=private.quote_production_cart(p_items,p_locale); end if;
  v_max_lead:=coalesce((v_quote->>'lead_days')::integer,0);

  if (p_scheduled_start at time zone 'Asia/Bangkok')::date <
     (now() at time zone 'Asia/Bangkok')::date + greatest(1,v_max_lead) then raise exception 'lead_time_unavailable'; end if;

  insert into public.customers(display_name,email,locale,is_demo)
  values(btrim(p_customer_name),nullif(substring(btrim(p_customer_contact) from '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'),''),p_locale,true)
  returning id into v_customer_id;

  if p_source='chat' then
    insert into public.conversations(customer_id,channel,external_id,mode)
    values(v_customer_id,'website',p_request_key::text,'bot') returning id into v_conversation_id;
    for v_message in select value from jsonb_array_elements(p_messages) loop
      if v_message->>'sender' not in ('customer','assistant') or length(btrim(coalesce(v_message->>'body',''))) not between 1 and 2500 then raise exception 'invalid_message'; end if;
      insert into public.messages(conversation_id,sender,body,external_id)
      values(v_conversation_id,v_message->>'sender',btrim(v_message->>'body'),nullif(v_message->>'id',''));
    end loop;
  end if;

  insert into public.orders(request_key,customer_id,conversation_id,source,fulfillment,delivery_address,
    delivery_minor,scheduled_start,scheduled_end,customer_name,customer_contact,note,is_demo,production_load,category_counts,rules_version)
  values(p_request_key,v_customer_id,v_conversation_id,p_source,p_fulfillment,
    case when p_fulfillment='delivery' then btrim(p_delivery_address) else null end,
    v_delivery_minor,p_scheduled_start,p_scheduled_end,btrim(p_customer_name),btrim(p_customer_contact),coalesce(p_note,''),true,(v_quote->>'load_units')::integer,v_quote->'category_counts',(v_quote->>'rules_version')::bigint)
  returning id into v_order_id;

  for v_snapshot in select value from jsonb_array_elements(v_quote->'items') loop
    insert into public.order_items(order_id,variant_id,product_name,variant_description,quantity,unit_price_minor,snapshot,load_units,category_counts,rules_version)
    values(v_order_id,(v_snapshot->'variant'->>'id')::uuid,v_snapshot->>'name',v_snapshot->>'detail',
      (v_snapshot->>'quantity')::integer,(v_snapshot->>'unit_price_minor')::integer,v_snapshot,
      (v_snapshot->>'load_units')::integer,v_snapshot->'category_counts',(v_snapshot->>'rules_version')::bigint);
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'name',oi.product_name,'detail',oi.variant_description,'quantity',oi.quantity,'unit_price_minor',oi.unit_price_minor
  ) order by oi.created_at,oi.id),'[]'::jsonb),coalesce(sum(oi.line_total_minor),0)+v_delivery_minor
  into v_items,v_total from public.order_items oi where oi.order_id=v_order_id;

  return query select v_order_id,'BLG-' || upper(substr(replace(v_order_id::text,'-',''),1,8)),false,v_delivery_minor,v_items,v_total;
end;
$$;

revoke all on function public.receive_storefront_order(uuid,text,text,text,text,text,text,text,timestamptz,timestamptz,text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.receive_storefront_order(uuid,text,text,text,text,text,text,text,timestamptz,timestamptz,text,jsonb,jsonb,text) to service_role;

create function private.production_day(p_date date,p_quote jsonb default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r jsonb; s jsonb; state jsonb; result jsonb:='[]'; start_at timestamptz; end_at timestamptz;
begin
  perform pg_advisory_xact_lock_shared(710002,1);
  select config into r from public.production_rule_versions order by version desc limit 1;
  for s in select value from jsonb_array_elements(r->'slots') where (value->>'weekday')::integer=extract(isodow from p_date)::integer order by value->>'start' loop
    start_at:=(p_date+(s->>'start')::time) at time zone 'Asia/Bangkok';
    end_at:=(p_date+(s->>'end')::time) at time zone 'Asia/Bangkok';
    begin state:=private.production_capacity(start_at,end_at,(p_quote->>'load_units')::integer,p_quote->'category_counts');
    exception when others then if sqlerrm<>'slot_unavailable' then raise; end if;
      state:=jsonb_build_object('capacity',(r->>'budget')::integer,'used',0,'available',false,'category_used','{}'::jsonb,'category_limits',r->'limits','unknown_orders',0); end;
    if p_date<(clock_timestamp() at time zone 'Asia/Bangkok')::date+greatest(1,coalesce((p_quote->>'lead_days')::integer,0)) then state:=jsonb_set(state,'{available}','false'); end if;
    result:=result||jsonb_build_array(state||jsonb_build_object('start_time',s->>'start','end_time',s->>'end','label',(s->>'start')||'–'||(s->>'end')));
  end loop;
  return result;
end $$;
-- Compatibility for an application rollback: generic display, authoritative intake
-- still quotes the cart and enforces reservations. No second capacity model.
create or replace function public.get_storefront_availability(p_date date)
returns table(start_time time,end_time time,label text,capacity integer,used integer,available boolean)
language sql security invoker set search_path='' as $$
  select (s->>'start_time')::time,(s->>'end_time')::time,s->>'label',(s->>'capacity')::integer,(s->>'used')::integer,(s->>'available')::boolean
  from jsonb_array_elements(private.production_day(p_date)) s;
$$;
create table private.production_availability_limits (
  key_hash text primary key,
  window_started_at timestamptz not null,
  request_count integer not null
);
alter table private.production_availability_limits enable row level security;
revoke all on private.production_availability_limits from public,anon,authenticated;
grant all on private.production_availability_limits to service_role;
create function public.get_storefront_cart_availability(p_date date,p_items jsonb,p_locale text,p_rate_key text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
  if p_date is null or p_date>(clock_timestamp() at time zone 'Asia/Bangkok')::date+365 or p_rate_key is null or p_rate_key !~ '^[0-9a-f]{64}$' then raise exception 'invalid_request'; end if;
  insert into private.production_availability_limits as l values(p_rate_key,clock_timestamp(),1)
  on conflict(key_hash) do update set window_started_at=case when l.window_started_at<clock_timestamp()-interval '15 minutes' then clock_timestamp() else l.window_started_at end,
    request_count=case when l.window_started_at<clock_timestamp()-interval '15 minutes' then 1 else l.request_count+1 end returning request_count into n;
  if n>120 then raise exception 'rate_limit'; end if;
  return private.production_day(p_date,private.quote_production_cart(p_items,p_locale));
end $$;
create function private.staff_production_day(p_date date) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
  return private.production_day(p_date);
end $$;
create function public.staff_production_day(p_date date) returns jsonb language sql security invoker set search_path='' as $$ select private.staff_production_day(p_date); $$;

create function private.save_production_rules(p_config jsonb,p_expected_version bigint) returns bigint
language plpgsql security definer set search_path='' as $$
declare v bigint; e record; s jsonb; b jsonb; other jsonb;
begin
  if not private.is_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(710002,1);
  select version into v from public.production_rule_versions order by version desc limit 1;
  if v is distinct from p_expected_version then raise exception 'rules_changed' using errcode='40001'; end if;
  if jsonb_typeof(p_config) is distinct from 'object' or length(p_config::text)>30000 then raise exception 'invalid_rules'; end if;
  for e in select * from jsonb_each_text(p_config) where key in ('budget','hold_minutes','gift_chocolates_per_set','gingerbread_per_set') loop
    if e.value !~ '^[0-9]+$' or length(e.value)>5 or e.value::integer not between 1 and 10000 then raise exception 'invalid_rules'; end if;
  end loop;
  if not (p_config ?& array['budget','hold_minutes','coefficients','limits','slots','blackouts','gift_chocolates_per_set','gingerbread_per_set']) or (p_config->>'hold_minutes')::integer>1440 then raise exception 'invalid_rules'; end if;
  perform private.validate_production_counts(p_config->'coefficients');
  perform private.validate_production_counts(p_config->'limits');
  for e in select key from jsonb_each(p_config->'coefficients') union select key from jsonb_each(p_config->'limits') loop
    if not (p_config->'coefficients' ? e.key and p_config->'limits' ? e.key) or (p_config->'coefficients'->>e.key)::integer<1 or (p_config->'limits'->>e.key)::integer<1 then raise exception 'invalid_rules'; end if;
  end loop;
  if not (p_config->'coefficients' ?& array['cake','chocolate','gingerbread','small']) or not (p_config->'limits' ?& array['cake','chocolate','gingerbread','small']) or jsonb_typeof(p_config->'slots') is distinct from 'array' or jsonb_array_length(p_config->'slots') not between 1 and 100 or jsonb_typeof(p_config->'blackouts') is distinct from 'array' or jsonb_array_length(p_config->'blackouts')>366 then raise exception 'invalid_rules'; end if;
  for s in select value from jsonb_array_elements(p_config->'slots') loop
    if coalesce(s->>'weekday','') !~ '^[1-7]$' or coalesce(s->>'start','') !~ '^[0-2][0-9]:[0-5][0-9]$' or coalesce(s->>'end','') !~ '^[0-2][0-9]:[0-5][0-9]$' or (s->>'end')::time<=(s->>'start')::time then raise exception 'invalid_rules'; end if;
    for other in select value from jsonb_array_elements(p_config->'slots') loop
      if other is distinct from s and other->>'weekday'=s->>'weekday' and (other->>'start')::time<(s->>'end')::time and (other->>'end')::time>(s->>'start')::time then raise exception 'overlapping_slots'; end if;
    end loop;
  end loop;
  if (select count(*) from jsonb_array_elements(p_config->'slots'))<>(select count(distinct value) from jsonb_array_elements(p_config->'slots')) then raise exception 'duplicate_slots'; end if;
  for b in select value from jsonb_array_elements(p_config->'blackouts') loop
    if coalesce(b->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or length(coalesce(b->>'reason',''))>250 then raise exception 'invalid_rules'; end if;
    perform (b->>'date')::date;
  end loop;
  insert into public.production_rule_versions(config,actor_id) values(p_config,auth.uid()) returning version into v;
  return v;
end $$;
create function public.save_production_rules(p_config jsonb,p_expected_version bigint) returns bigint language sql security invoker set search_path='' as $$ select private.save_production_rules(p_config,p_expected_version); $$;

create function private.staff_assess_production(p_order_id uuid,p_revision integer,p_counts jsonb,p_reason text,p_manual_price_minor integer default null)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; r public.production_rule_versions; e record; load integer:=0; assessment jsonb;
begin
  if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock_shared(710002,1);
  select * into o from public.orders where id=p_order_id for update;
  if not found or o.status<>'pending' or o.revision<>p_revision then raise exception 'order_changed' using errcode='40001'; end if;
  if o.production_load is not null and o.production_assessment is null then raise exception 'catalog_load_is_authoritative'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 3 and 500 then raise exception 'assessment_reason_required'; end if;
  perform private.validate_production_counts(p_counts);
  select * into r from public.production_rule_versions order by version desc limit 1;
  for e in select * from jsonb_each_text(p_counts) loop load:=load+e.value::integer*(r.config->'coefficients'->>e.key)::integer; end loop;
  assessment:=jsonb_build_object('source','staff_assessment','actor_id',auth.uid(),'reason',btrim(p_reason),'category_counts',p_counts,'load_units',load,'rules_version',r.version,'rules',r.config-'slots'-'blackouts','at',clock_timestamp());
  if not exists(select 1 from public.order_items where order_id=o.id) then
    if p_manual_price_minor is null or p_manual_price_minor not between 0 and 100000000 then raise exception 'manual_price_required'; end if;
    insert into public.order_items(order_id,product_name,quantity,unit_price_minor,snapshot,load_units,category_counts,rules_version)
    values(o.id,'Нестандартный заказ',1,p_manual_price_minor,assessment||jsonb_build_object('schema_version',1,'quantity',1,'unit_price_minor',p_manual_price_minor,'currency','THB'),load,p_counts,r.version);
  end if;
  update public.orders set production_load=load,category_counts=p_counts,rules_version=r.version,production_assessment=assessment,
    reservation_expires_at=clock_timestamp()+make_interval(mins=>(r.config->>'hold_minutes')::integer) where id=o.id;
end $$;
create function public.staff_assess_production(p_order_id uuid,p_revision integer,p_counts jsonb,p_reason text,p_manual_price_minor integer default null)
returns void language sql security invoker set search_path='' as $$ select private.staff_assess_production(p_order_id,p_revision,p_counts,p_reason,p_manual_price_minor); $$;

-- Audit snapshot of production changes accompanies the existing revision/status log.
create function private.audit_production_order() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.order_events set details=details||jsonb_build_object('production_load',new.production_load,'category_counts',new.category_counts,'rules_version',new.rules_version,'reservation_expires_at',new.reservation_expires_at,'production_assessment',new.production_assessment)
  where order_id=new.id and revision=new.revision;
  return new;
end $$;
-- Alphabetical order ensures the original record_order_event has inserted the row.
create trigger z_production_order_audit after insert or update on public.orders for each row execute function private.audit_production_order();

-- Revoke PostgreSQL's implicit PUBLIC EXECUTE on every new private/public RPC.
revoke all on function private.validate_production_counts(jsonb),private.guard_production_profile(),private.quote_production_item(jsonb,text,jsonb,bigint),private.quote_production_cart(jsonb,text),private.production_capacity(timestamptz,timestamptz,integer,jsonb,uuid),private.guard_item_snapshot(),private.production_day(date,jsonb),private.audit_production_order() from public,anon,authenticated;
grant execute on function private.validate_production_counts(jsonb) to authenticated,service_role;
grant execute on function private.guard_production_profile(),private.quote_production_item(jsonb,text,jsonb,bigint),private.quote_production_cart(jsonb,text),private.production_capacity(timestamptz,timestamptz,integer,jsonb,uuid),private.guard_item_snapshot(),private.production_day(date,jsonb),private.audit_production_order() to service_role;
revoke all on function public.get_storefront_cart_availability(date,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.get_storefront_cart_availability(date,jsonb,text,text) to service_role;
revoke all on function private.staff_production_day(date),public.staff_production_day(date),private.save_production_rules(jsonb,bigint),public.save_production_rules(jsonb,bigint),private.staff_assess_production(uuid,integer,jsonb,text,integer),public.staff_assess_production(uuid,integer,jsonb,text,integer) from public,anon;
grant execute on function private.staff_production_day(date),public.staff_production_day(date),private.save_production_rules(jsonb,bigint),public.save_production_rules(jsonb,bigint),private.staff_assess_production(uuid,integer,jsonb,text,integer),public.staff_assess_production(uuid,integer,jsonb,text,integer) to authenticated;

create or replace function private.production_slot_state(p_date date,p_start time,p_end time,p_exclude_order uuid default null)
returns jsonb language sql security definer set search_path='' as $$
 select private.production_capacity((p_date+p_start) at time zone 'Asia/Bangkok',(p_date+p_end) at time zone 'Asia/Bangkok',0,'{}',p_exclude_order);
$$;

create index production_rules_actor_idx on public.production_rule_versions(actor_id);
create index order_items_rules_version_idx on public.order_items(rules_version);
create index orders_rules_version_idx on public.orders(rules_version);
