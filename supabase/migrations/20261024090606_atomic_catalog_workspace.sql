-- A4. Owner aggregate writes, optimistic concurrency and continuously enforced
-- publication invariants. No existing product/variant/order IDs or prices change.
alter table public.products add column catalog_version integer not null default 1 check(catalog_version>0);
alter table public.catalog_categories add column catalog_version integer not null default 1 check(catalog_version>0);
alter table public.catalog_price_rules add column catalog_version integer not null default 1 check(catalog_version>0);
-- The catalog_categories FK is authoritative; the foundation's fixed six-name
-- check otherwise makes owner-created categories unusable for any product.
alter table public.products drop constraint products_category_check;
revoke insert,update,delete on public.products,public.product_variants,public.catalog_options,
  public.product_images,public.production_variant_profiles,public.catalog_categories,public.catalog_price_rules from authenticated;
-- Retire the alternate metadata write API (primary selection goes through CAS).
revoke execute on function public.set_primary_product_image(uuid,uuid) from authenticated;
drop trigger guard_catalog_publication on public.products;

create function private.catalog_has_text(p_value jsonb,p_all boolean default false)
returns boolean language sql immutable set search_path='' as $$
  select coalesce(jsonb_typeof(p_value)='object' and
    (select bool_and(coalesce(jsonb_typeof(p_value->lang)='string' and length(btrim(p_value->>lang)) between 1 and 10000,false))
      from unnest(case when p_all then array['ru','en','th'] else array['ru'] end) lang),false);
$$;

-- One validator for both the RPC and deferred guards on every related table.
create function private.validate_catalog_product(p_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare p public.products; v record;
begin
  select * into p from public.products where id=p_id;
  if not found then return; end if;
  if jsonb_typeof(p.production_profile->'kind') is distinct from 'string' or length(p.production_profile->>'kind') not between 1 and 60
    or coalesce(p.production_profile->>'work_units','') !~ '^[0-9]{1,6}$' then raise exception 'catalog_invalid_profile' using errcode='23514';end if;
  if not private.catalog_has_text(p.name,p.status='published') then raise exception 'catalog_translation_missing' using errcode='23514'; end if;
  if p.status='published' then
    -- Coordinate publication with concurrent category disable/translation edits.
    -- KEY SHARE would permit a non-key UPDATE; SHARE deliberately does not.
    perform 1 from public.catalog_categories where id=p.category for share;
    if not exists(select 1 from public.catalog_categories c where c.id=p.category and c.active and private.catalog_has_text(c.name,true)) then raise exception 'catalog_category_unavailable' using errcode='23514'; end if;
    if not private.catalog_has_text(p.description,true) then raise exception 'catalog_translation_missing' using errcode='23514'; end if;
    if not exists(select 1 from public.product_variants where product_id=p.id and active) then raise exception 'catalog_active_variant_missing' using errcode='23514'; end if;
    if exists(select 1 from public.product_images where product_id=p.id) then
      if not exists(select 1 from public.product_images where product_id=p.id and is_primary) then raise exception 'catalog_primary_image_missing' using errcode='23514'; end if;
    elsif nullif(btrim(p.image_path),'') is null then raise exception 'catalog_primary_image_missing' using errcode='23514'; end if;
  end if;
  for v in select pv.*,pp.components from public.product_variants pv left join public.production_variant_profiles pp on pp.variant_id=pv.id where pv.product_id=p.id loop
    if not private.catalog_has_text(v.name,p.status='published' and v.active) then raise exception 'catalog_variant_translation_missing' using errcode='23514'; end if;
    if v.active and v.sku not in ('custom-gift','celebration-set') then perform private.validate_production_counts(v.components); end if;
  end loop;
  if exists(select 1 from public.catalog_options o where o.product_id=p.id and not private.catalog_has_text(o.label,p.status='published' and o.active)) then raise exception 'catalog_option_translation_missing' using errcode='23514'; end if;
  if exists(select 1 from public.product_images i where i.product_id=p.id and
    (not private.catalog_has_text(i.alt,p.status='published') or i.storage_path !~ ('^products/'||p.id::text||'/[0-9a-f-]{36}[.](webp|png|jpg|jpeg)$') or
     not exists(select 1 from storage.objects o where o.bucket_id='catalog-demo' and o.name=i.storage_path)))
    then raise exception 'catalog_image_unavailable' using errcode='23514'; end if;
end; $$;

create function private.catalog_revision() returns trigger language plpgsql set search_path='' as $$
begin new.catalog_version:=old.catalog_version+1;return new;end; $$;
create trigger catalog_revision before update on public.products for each row execute function private.catalog_revision();
create trigger catalog_revision before update on public.catalog_categories for each row execute function private.catalog_revision();
create trigger catalog_revision before update on public.catalog_price_rules for each row execute function private.catalog_revision();

-- Opaque aggregate versions also advance for service-side child edits. They need
-- not be old+1 for a whole aggregate; callers always use the returned version.
create function private.touch_catalog_parent() returns trigger language plpgsql security definer set search_path='' as $$
declare a uuid; b uuid;
begin
  if tg_table_name='production_variant_profiles' then
    select product_id into a from public.product_variants where id=(to_jsonb(new)->>'variant_id')::uuid;
    select product_id into b from public.product_variants where id=(to_jsonb(old)->>'variant_id')::uuid;
  else a:=(to_jsonb(new)->>'product_id')::uuid;b:=(to_jsonb(old)->>'product_id')::uuid;end if;
  -- Stable lock order if a privileged maintenance action moves a child.
  perform 1 from public.products where id in (a,b) order by id for update;
  update public.products set updated_at=clock_timestamp() where id in (a,b);
  return coalesce(new,old);
end; $$;

create function private.check_catalog_change() returns trigger language plpgsql security definer set search_path='' as $$
declare a uuid; b uuid; item record;
begin
  if tg_table_name='products' then a:=(to_jsonb(new)->>'id')::uuid;b:=(to_jsonb(old)->>'id')::uuid;
  elsif tg_table_name='catalog_categories' then
    for item in select id from public.products where category in (to_jsonb(new)->>'id',to_jsonb(old)->>'id') loop perform private.validate_catalog_product(item.id);end loop;return null;
  elsif tg_table_name='production_variant_profiles' then
    select product_id into a from public.product_variants where id=(to_jsonb(new)->>'variant_id')::uuid;
    select product_id into b from public.product_variants where id=(to_jsonb(old)->>'variant_id')::uuid;
  else a:=(to_jsonb(new)->>'product_id')::uuid;b:=(to_jsonb(old)->>'product_id')::uuid;end if;
  perform private.validate_catalog_product(a);if b is distinct from a then perform private.validate_catalog_product(b);end if;return null;
end; $$;
do $$ declare t text;begin
  foreach t in array array['products','product_variants','catalog_options','product_images','production_variant_profiles','catalog_categories'] loop
    execute format('create constraint trigger catalog_complete after insert or update or delete on public.%I deferrable initially deferred for each row execute function private.check_catalog_change()',t);
    if t not in ('products','catalog_categories') then execute format('create trigger catalog_touch after insert or update or delete on public.%I for each row execute function private.touch_catalog_parent()',t);end if;
  end loop;
end; $$;

create function private.catalog_document(p_id uuid) returns jsonb language sql stable set search_path='' as $$
  select to_jsonb(p)||jsonb_build_object(
    'product_variants',coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object('production_variant_profiles',(select to_jsonb(pp) from public.production_variant_profiles pp where pp.variant_id=v.id)) order by v.sort_order,v.id) from public.product_variants v where v.product_id=p.id),'[]'::jsonb),
    'catalog_options',coalesce((select jsonb_agg(to_jsonb(o) order by o.sort_order,o.id) from public.catalog_options o where o.product_id=p.id),'[]'::jsonb),
    'product_images',coalesce((select jsonb_agg(to_jsonb(i) order by i.sort_order,i.id) from public.product_images i where i.product_id=p.id),'[]'::jsonb))
  from public.products p where p.id=p_id;
$$;

create function private.save_catalog_product(p_product_id uuid,p_expected_version integer,p_document jsonb,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old_product public.products; e jsonb; v_id uuid; row_id uuid; seen uuid[]:='{}'; t text; v_missing boolean;
begin
  if auth.uid() is null or not private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
  if p_product_id is null or p_expected_version is null or p_expected_version<0 or p_status is null or p_status not in ('draft','published','archived') or jsonb_typeof(p_document) is distinct from 'object' or octet_length(p_document::text)>150000 then raise exception 'catalog_invalid_document';end if;
  foreach t in array array['product_variants','catalog_options','product_images'] loop
    if jsonb_typeof(p_document->t) is distinct from 'array' then raise exception 'catalog_invalid_document';end if;
    if jsonb_array_length(p_document->t)>(case t when 'product_variants' then 50 when 'catalog_options' then 100 else 20 end) then raise exception 'catalog_document_too_large';end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended('catalog:'||p_product_id::text,0));
  select * into old_product from public.products where id=p_product_id for update;
  if (found and old_product.catalog_version<>p_expected_version) or (not found and p_expected_version<>0) then raise exception 'catalog_conflict' using errcode='40001';end if;
  if old_product.id is not null and old_product.slug is distinct from p_document->>'slug' then raise exception 'catalog_slug_immutable';end if;
  -- Full arrays must retain existing identities. Deactivate variants/options;
  -- never delete IDs referenced by orders or silently omit stale children.
  foreach t in array array['product_variants','catalog_options','product_images'] loop
    execute format('select exists(select 1 from public.%I x where x.product_id=$1 and not exists(select 1 from jsonb_array_elements($2) e where e->>''id''=x.id::text))',t) into v_missing using p_product_id,p_document->t;
    if v_missing then raise exception 'catalog_existing_child_missing';end if;
  end loop;
  if old_product.id is null then
    insert into public.products(id,slug,category,name,status,is_demo) values(p_product_id,p_document->>'slug',p_document->>'category',p_document->'name','draft',true);
  end if;
  update public.products set category=p_document->>'category',name=p_document->'name',subtitle=p_document->'subtitle',description=p_document->'description',allergens=p_document->'allergens',
    sort_order=(p_document->>'sort_order')::integer,production_profile=p_document->'production_profile',status='draft',updated_at=clock_timestamp() where id=p_product_id;
  for e in select value from jsonb_array_elements(p_document->'product_variants') loop
    v_id:=coalesce(nullif(e->>'id','')::uuid,gen_random_uuid());
    if v_id=any(seen) then raise exception 'catalog_duplicate_child';end if;seen:=array_append(seen,v_id);
    if exists(select 1 from public.product_variants where id=v_id and (product_id<>p_product_id or sku is distinct from e->>'sku')) then raise exception 'catalog_variant_identity_conflict';end if;
    if e->>'sku' !~ '^[a-z0-9][a-z0-9_-]{2,99}$' or (e->>'min_quantity')::integer not between 1 and 100 then raise exception 'catalog_invalid_variant';end if;
    insert into public.product_variants(id,product_id,sku,name,price_minor,lead_days,min_quantity,active,sort_order)
    values(v_id,p_product_id,e->>'sku',e->'name',(e->>'price_minor')::integer,(e->>'lead_days')::integer,(e->>'min_quantity')::integer,(e->>'active')::boolean,(e->>'sort_order')::integer)
    on conflict(id) do update set name=excluded.name,price_minor=excluded.price_minor,lead_days=excluded.lead_days,min_quantity=excluded.min_quantity,active=excluded.active,sort_order=excluded.sort_order,updated_at=clock_timestamp();
    if jsonb_typeof(e->'production_variant_profiles')='object' then
      insert into public.production_variant_profiles(variant_id,components) values(v_id,e->'production_variant_profiles'->'components')
      on conflict(variant_id) do update set components=excluded.components;
    elsif exists(select 1 from public.production_variant_profiles where variant_id=v_id) then raise exception 'catalog_profile_missing';end if;
  end loop;
  seen:='{}';
  for e in select value from jsonb_array_elements(p_document->'catalog_options') loop
    row_id:=coalesce(nullif(e->>'id','')::uuid,gen_random_uuid());
    if row_id=any(seen) then raise exception 'catalog_duplicate_child';end if;seen:=array_append(seen,row_id);
    if exists(select 1 from public.catalog_options where id=row_id and product_id<>p_product_id) then raise exception 'catalog_child_identity_conflict';end if;
    insert into public.catalog_options(id,product_id,option_group,option_key,label,price_delta_minor,sort_order,active)
    values(row_id,p_product_id,e->>'option_group',e->>'option_key',e->'label',(e->>'price_delta_minor')::integer,(e->>'sort_order')::integer,(e->>'active')::boolean)
    on conflict(id) do update set option_group=excluded.option_group,option_key=excluded.option_key,label=excluded.label,price_delta_minor=excluded.price_delta_minor,sort_order=excluded.sort_order,active=excluded.active;
  end loop;
  -- Only metadata changes. Storage bytes are uploaded earlier and never deleted.
  update public.product_images set is_primary=false where product_id=p_product_id and is_primary;
  seen:='{}';
  for e in select value from jsonb_array_elements(p_document->'product_images') loop
    row_id:=coalesce(nullif(e->>'id','')::uuid,gen_random_uuid());
    if row_id=any(seen) then raise exception 'catalog_duplicate_child';end if;seen:=array_append(seen,row_id);
    if exists(select 1 from public.product_images where id=row_id and (product_id<>p_product_id or storage_path is distinct from e->>'storage_path')) then raise exception 'catalog_image_identity_conflict';end if;
    insert into public.product_images(id,product_id,storage_path,alt,sort_order,is_primary)
    values(row_id,p_product_id,e->>'storage_path',e->'alt',(e->>'sort_order')::integer,(e->>'is_primary')::boolean)
    on conflict(id) do update set alt=excluded.alt,sort_order=excluded.sort_order,is_primary=excluded.is_primary;
  end loop;
  update public.products set status=p_status,published_at=case when p_status='published' and old_product.status is distinct from 'published' then clock_timestamp() else published_at end where id=p_product_id;
  perform private.validate_catalog_product(p_product_id);
  return private.catalog_document(p_product_id);
end; $$;
create function public.save_catalog_product(p_product_id uuid,p_expected_version integer,p_document jsonb,p_status text)
returns jsonb language sql security invoker set search_path='' as $$select private.save_catalog_product(p_product_id,p_expected_version,p_document,p_status);$$;

-- Category and builder-price controls use small CAS operations too, so the
-- remaining owner editor controls cannot silently overwrite another tab.
create function private.save_catalog_setting(p_kind text,p_key text,p_expected_version integer,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_version integer; result jsonb;
begin
  if auth.uid() is null or not private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
  if p_expected_version is null or p_expected_version<0 or jsonb_typeof(p_value) is distinct from 'object' or octet_length(p_value::text)>10000 then raise exception 'catalog_invalid_document';end if;
  if p_kind='category' then
    perform pg_advisory_xact_lock(hashtextextended('catalog-category:'||p_key,0));
    select catalog_version into v_version from public.catalog_categories where id=p_key for update;
    if coalesce(v_version,0)<>p_expected_version then raise exception 'catalog_conflict' using errcode='40001';end if;
    if not private.catalog_has_text(p_value->'name',false) then raise exception 'catalog_translation_missing';end if;
    insert into public.catalog_categories(id,name,active,sort_order) values(p_key,p_value->'name',(p_value->>'active')::boolean,(p_value->>'sort_order')::integer)
    on conflict(id) do update set name=excluded.name,active=excluded.active,sort_order=excluded.sort_order;
    select to_jsonb(c) into result from public.catalog_categories c where id=p_key;
  elsif p_kind='price_rule' then
    select catalog_version into v_version from public.catalog_price_rules where rule_key=p_key for update;
    if v_version is null or v_version<>p_expected_version then raise exception 'catalog_conflict' using errcode='40001';end if;
    update public.catalog_price_rules set amount_minor=(p_value->>'amount_minor')::integer,updated_at=clock_timestamp() where rule_key=p_key;
    select to_jsonb(r) into result from public.catalog_price_rules r where rule_key=p_key;
  else raise exception 'catalog_invalid_setting';end if;
  return result;
end; $$;
create function public.save_catalog_setting(p_kind text,p_key text,p_expected_version integer,p_value jsonb)
returns jsonb language sql security invoker set search_path='' as $$select private.save_catalog_setting(p_kind,p_key,p_expected_version,p_value);$$;

revoke all on function private.catalog_has_text(jsonb,boolean),private.validate_catalog_product(uuid),private.catalog_revision(),private.touch_catalog_parent(),private.check_catalog_change(),private.catalog_document(uuid),
 private.save_catalog_product(uuid,integer,jsonb,text),public.save_catalog_product(uuid,integer,jsonb,text),private.save_catalog_setting(text,text,integer,jsonb),public.save_catalog_setting(text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function private.save_catalog_product(uuid,integer,jsonb,text),public.save_catalog_product(uuid,integer,jsonb,text),private.save_catalog_setting(text,text,integer,jsonb),public.save_catalog_setting(text,text,integer,jsonb) to authenticated;
