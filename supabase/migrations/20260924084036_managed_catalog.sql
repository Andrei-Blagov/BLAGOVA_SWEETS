-- Stage 1: additive catalog model. Existing products, variants and orders are preserved.
create table public.catalog_categories (
  id text primary key check (id ~ '^[a-z][a-z0-9-]*$'),
  name jsonb not null check (jsonb_typeof(name) = 'object' and length(btrim(coalesce(name->>'ru',''))) > 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.catalog_categories(id,name,sort_order) values
  ('cake','{"ru":"Торты","en":"Cakes","th":"เค้ก"}',10),
  ('cupcake','{"ru":"Капкейки","en":"Cupcakes","th":"คัพเค้ก"}',20),
  ('gingerbread','{"ru":"Пряники","en":"Gingerbread","th":"ขนมปังขิง"}',30),
  ('chocolate','{"ru":"Шоколад","en":"Chocolate","th":"ช็อกโกแลต"}',40),
  ('gift','{"ru":"Подарки","en":"Gifts","th":"ของขวัญ"}',50),
  ('cafe','{"ru":"Кофейня","en":"Café","th":"คาเฟ่"}',60)
on conflict (id) do nothing;

alter table public.products
  add column subtitle jsonb not null default '{}'::jsonb check (jsonb_typeof(subtitle) = 'object'),
  add column allergens jsonb not null default '{}'::jsonb check (jsonb_typeof(allergens) = 'object'),
  add column sort_order integer not null default 0,
  add column production_profile jsonb not null default '{"kind":"manual","work_units":0}'::jsonb
    check (jsonb_typeof(production_profile) = 'object'),
  add column published_at timestamptz;
alter table public.products add constraint products_category_fk
  foreign key (category) references public.catalog_categories(id) on update restrict on delete restrict;
alter table public.product_variants
  add column options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),
  add column sort_order integer not null default 0;

create table public.catalog_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  option_group text not null check (option_group ~ '^[a-z][a-z0-9_]*$'),
  option_key text not null check (option_key ~ '^[a-z][a-z0-9_-]*$'),
  label jsonb not null check (jsonb_typeof(label) = 'object' and length(btrim(coalesce(label->>'ru',''))) > 0),
  price_delta_minor integer not null default 0 check (price_delta_minor between 0 and 100000000),
  sort_order integer not null default 0,
  active boolean not null default true,
  unique(product_id, option_group, option_key)
);
create index catalog_options_product_idx on public.catalog_options(product_id,sort_order);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null unique check (storage_path ~ '^products/[0-9a-f-]{36}/[0-9a-f-]{36}[.](webp|png|jpg|jpeg)$'),
  alt jsonb not null check (jsonb_typeof(alt) = 'object' and length(btrim(coalesce(alt->>'ru',''))) > 0),
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index product_images_one_primary on public.product_images(product_id) where is_primary;
create index product_images_order_idx on public.product_images(product_id,sort_order,id);

create table public.catalog_price_rules (
  rule_key text primary key check (rule_key ~ '^[a-z][a-z0-9_]*$'),
  amount_minor integer not null check (amount_minor between 0 and 1000000),
  description text not null,
  updated_at timestamptz not null default now()
);
insert into public.catalog_price_rules(rule_key,amount_minor,description) values
  ('gift_box_base',10000,'Base box and card'),
  ('gift_chocolate',7500,'Chocolate bonbon'),
  ('gift_raspberry',8000,'Raspberry bonbon'),
  ('gift_pistachio',8500,'Pistachio bonbon'),
  ('gift_gingerbread',9000,'Gingerbread'),
  ('celebration_cake_kg',145000,'Cake per kilogram'),
  ('celebration_cupcake',9500,'Cupcake per guest'),
  ('celebration_cookie',14000,'Cookie per guest')
on conflict (rule_key) do nothing;

-- Newly exposed tables get explicit privileges and separate public/owner policies.
do $$ declare t text; begin
  foreach t in array array['catalog_categories','catalog_options','product_images','catalog_price_rules'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('create policy owner_read on public.%I for select to authenticated using ((select private.is_owner()))',t);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select private.is_owner()))',t);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()))',t);
    execute format('create policy owner_delete on public.%I for delete to authenticated using ((select private.is_owner()))',t);
  end loop;
end $$;
grant select on public.catalog_categories,public.catalog_options,public.product_images to anon;
create policy public_categories on public.catalog_categories for select to anon using (active);
create policy public_options on public.catalog_options for select to anon using (
  active and exists(select 1 from public.products p where p.id=product_id and p.status='published')
);
create policy public_images on public.product_images for select to anon using (
  exists(select 1 from public.products p where p.id=product_id and p.status='published')
);
-- Price rules are backend-only for anonymous users; the storefront gets validated prices from variants.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('catalog-demo','catalog-demo',true,5242880,array['image/webp','image/png','image/jpeg'])
on conflict (id) do update set public=true,file_size_limit=5242880,
  allowed_mime_types=array['image/webp','image/png','image/jpeg'];
create policy catalog_owner_upload on storage.objects for insert to authenticated
with check (bucket_id='catalog-demo' and (select private.is_owner())
  and name ~ '^products/[0-9a-f-]{36}/[0-9a-f-]{36}[.](webp|png|jpg|jpeg)$');
create policy catalog_owner_select on storage.objects for select to authenticated
using (bucket_id='catalog-demo' and (select private.is_owner()));
create policy catalog_owner_update on storage.objects for update to authenticated
using (bucket_id='catalog-demo' and (select private.is_owner()))
with check (bucket_id='catalog-demo' and (select private.is_owner()));
-- No browser delete: detach a photo in the catalog, retain the blob for audit/recovery.

create table public.catalog_events (
  id bigint generated always as identity primary key,
  entity text not null,
  entity_id text not null,
  action text not null,
  actor_id uuid,
  previous jsonb,
  current_value jsonb,
  created_at timestamptz not null default now()
);
alter table public.catalog_events enable row level security;
revoke all on public.catalog_events from public,anon,authenticated;
grant select on public.catalog_events to authenticated;
grant all on public.catalog_events to service_role;
create policy owner_events on public.catalog_events for select to authenticated
using ((select private.is_owner()));
create function private.audit_catalog() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.catalog_events(entity,entity_id,action,actor_id,previous,current_value)
  values (tg_table_name,coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id',to_jsonb(new)->>'rule_key',to_jsonb(old)->>'rule_key'),
    tg_op,auth.uid(),case when tg_op='INSERT' then null else to_jsonb(old) end,
    case when tg_op='DELETE' then null else to_jsonb(new) end);
  return coalesce(new,old);
end $$;
revoke all on function private.audit_catalog() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['catalog_categories','products','product_variants','catalog_options','product_images','catalog_price_rules'] loop
    execute format('create trigger audit_catalog after insert or update or delete on public.%I for each row execute function private.audit_catalog()',t);
  end loop;
end $$;

-- Import the six existing storefront products without replacing product or variant IDs.
update public.products set subtitle='{"ru":"Ваниль · малина · нежный крем","en":"Vanilla · raspberry · light cream","th":"วานิลลา · ราสป์เบอร์รี · ครีม"}'::jsonb,description='{"ru":"Воздушный ванильный бисквит, ягодная прослойка и мягкий сливочный крем. Небольшой повод собраться за одним столом.","en":"Soft vanilla sponge, a bright berry centre and delicate cream. A little reason to gather around the same table.","th":"เค้กวานิลลาเนื้อนุ่ม สอดไส้เบอร์รีและครีมละมุน สำหรับช่วงเวลาพิเศษร่วมกัน"}'::jsonb,allergens='{"ru":"Пшеница, молоко, яйца. Возможны следы орехов.","en":"Wheat, milk, eggs. May contain traces of nuts.","th":"มีข้าวสาลี นม ไข่ และอาจมีถั่วปนเปื้อน"}'::jsonb,sort_order=10,production_profile='{"kind":"cake","work_units":8}'::jsonb,published_at=coalesce(published_at,now()) where slug='berry-cloud';
update public.products set subtitle='{"ru":"Капкейки с ягодным сердцем","en":"Cupcakes with a berry heart","th":"คัพเค้กไส้เบอร์รี"}'::jsonb,description='{"ru":"Шесть маленьких десертов с ванильным бисквитом и малиновой начинкой. Для подарка, чаепития или просто хорошего дня.","en":"Six little vanilla cakes with a raspberry centre. Made for a thoughtful gift, afternoon coffee or an ordinary lovely day.","th":"คัพเค้กวานิลลาหกชิ้น ไส้ราสป์เบอร์รี เหมาะเป็นของขวัญหรือทานคู่กาแฟ"}'::jsonb,allergens='{"ru":"Пшеница, молоко, яйца.","en":"Wheat, milk, eggs.","th":"มีข้าวสาลี นม และไข่"}'::jsonb,sort_order=20,production_profile='{"kind":"cupcake","work_units":6}'::jsonb,published_at=coalesce(published_at,now()) where slug='raspberry-kisses';
update public.products set subtitle='{"ru":"Авторские конфеты ручной работы","en":"Handcrafted chocolate bonbons","th":"ช็อกโกแลตบงบงทำมือ"}'::jsonb,description='{"ru":"Шесть конфет: тёмный шоколад, малина и фисташка. Тонкая оболочка и мягкая начинка, которую хочется распробовать.","en":"Six handmade bonbons: dark chocolate, raspberry and pistachio. A delicate shell with a soft, rich centre.","th":"บงบงหกชิ้น รสดาร์กช็อกโกแลต ราสป์เบอร์รี และพิสตาชิโอ เปลือกบาง ไส้นุ่ม"}'::jsonb,allergens='{"ru":"Молоко, фисташки, соя. Возможны следы других орехов.","en":"Milk, pistachios, soy. May contain other nuts.","th":"มีนม พิสตาชิโอ ถั่วเหลือง และอาจมีถั่วชนิดอื่น"}'::jsonb,sort_order=30,production_profile='{"kind":"chocolate","work_units":4}'::jsonb,published_at=coalesce(published_at,now()) where slug='chocolate-stories';
update public.products set subtitle='{"ru":"Имбирные пряники с вашей надписью","en":"Personalised gingerbread cookies","th":"คุกกี้ขนมปังขิงพร้อมข้อความ"}'::jsonb,description='{"ru":"Пряники с тёплыми специями, нежной глазурью и вашим пожеланием. Добавьте имя или короткую фразу — и подарок станет личным.","en":"Gingerbread cookies with warm spices, delicate icing and a message of your own. A name or a little wish makes it personal.","th":"คุกกี้ขนมปังขิงหอมเครื่องเทศ แต่งไอซิงและข้อความส่วนตัว เพื่อของขวัญที่พิเศษ"}'::jsonb,allergens='{"ru":"Пшеница, молоко, яйца.","en":"Wheat, milk, eggs.","th":"มีข้าวสาลี นม และไข่"}'::jsonb,sort_order=40,production_profile='{"kind":"gingerbread","work_units":1}'::jsonb,published_at=coalesce(published_at,now()) where slug='gingerbread-heart';
update public.products set subtitle='{"ru":"Капкейки в цветах вашего события","en":"Cupcakes in your celebration colours","th":"คัพเค้กในสีสันที่คุณเลือก"}'::jsonb,description='{"ru":"Тематический набор капкейков. Выберите надпись и настроение: детали оформления согласовываются отдельно.","en":"A themed cupcake set with your own message and mood. Final design details are agreed with the pastry chef.","th":"ชุดคัพเค้กตามธีม พร้อมข้อความของคุณ รายละเอียดการตกแต่งต้องยืนยันกับเชฟ"}'::jsonb,allergens='{"ru":"Пшеница, молоко, яйца.","en":"Wheat, milk, eggs.","th":"มีข้าวสาลี นม และไข่"}'::jsonb,sort_order=50,production_profile='{"kind":"cupcake","work_units":6}'::jsonb,published_at=coalesce(published_at,now()) where slug='birthday-cupcakes';
update public.products set subtitle='{"ru":"Торт с персональной надписью","en":"A cake with your own message","th":"เค้กพร้อมข้อความส่วนตัว"}'::jsonb,description='{"ru":"Ванильно-ягодный торт к вашему событию. Добавьте короткую надпись и выберите вес. Фото показывает концепцию оформления.","en":"A vanilla and berry cake for your celebration. Add a short message and choose a size. The photo is a design concept.","th":"เค้กวานิลลาเบอร์รีสำหรับงานพิเศษ เพิ่มข้อความและเลือกขนาด ภาพเป็นแนวคิดการตกแต่ง"}'::jsonb,allergens='{"ru":"Пшеница, молоко, яйца. Возможны следы орехов.","en":"Wheat, milk, eggs. May contain traces of nuts.","th":"มีข้าวสาลี นม ไข่ และอาจมีถั่วปนเปื้อน"}'::jsonb,sort_order=60,production_profile='{"kind":"cake","work_units":8}'::jsonb,published_at=coalesce(published_at,now()) where slug='celebration-cake';

-- The server continues to price every order; configurable gift and celebration rates live in the database.
create or replace function private.resolve_storefront_item(
  p_sku text,
  p_locale text,
  p_configuration jsonb,
  p_personalization text,
  p_description text
) returns table(product_name text,variant_description text,variant_id uuid,price_minor integer,lead_days integer,min_quantity integer)
language plpgsql security invoker set search_path = '' as $$
declare
  catalog record;
  cfg jsonb := coalesce(p_configuration,'{}'::jsonb);
  box_size integer;
  chocolate integer;
  raspberry integer;
  pistachio integer;
  gingerbread integer;
  guests integer;
  cupcakes boolean;
  cookies boolean;
  price_rules jsonb;
begin
  select p.name as names,v.id,v.name as variant_names,v.price_minor as catalog_price,v.lead_days,v.min_quantity
  into catalog
  from public.product_variants v join public.products p on p.id=v.product_id
  where v.sku=p_sku and v.active and p.status='published';
  if not found then raise exception 'catalog_item_unavailable'; end if;
  if jsonb_typeof(cfg) <> 'object' then raise exception 'invalid_configuration'; end if;

  product_name := coalesce(catalog.names->>p_locale,catalog.names->>'ru');
  variant_id := catalog.id;
  lead_days := catalog.lead_days;
  min_quantity := catalog.min_quantity;
  price_minor := catalog.catalog_price;
  variant_description := concat_ws(' · ',coalesce(catalog.variant_names->>p_locale,catalog.variant_names->>'ru'),nullif(btrim(p_personalization),''));

  if p_sku='custom-gift' then
    if coalesce(cfg->>'size','') !~ '^(6|9)$' or coalesce(cfg->>'chocolate','') !~ '^[0-9]+$' or
       coalesce(cfg->>'raspberry','') !~ '^[0-9]+$' or coalesce(cfg->>'pistachio','') !~ '^[0-9]+$' or
       coalesce(cfg->>'gingerbread','') !~ '^[0-9]+$' or coalesce(cfg->>'ribbon','') not in ('wine','olive') then
      raise exception 'invalid_configuration';
    end if;
    box_size := (cfg->>'size')::integer;
    chocolate := (cfg->>'chocolate')::integer;
    raspberry := (cfg->>'raspberry')::integer;
    pistachio := (cfg->>'pistachio')::integer;
    gingerbread := (cfg->>'gingerbread')::integer;
    if chocolate+raspberry+pistachio+gingerbread <> box_size then raise exception 'invalid_configuration'; end if;
    select jsonb_object_agg(rule_key,amount_minor) into price_rules from public.catalog_price_rules;
    if price_rules is null or not (price_rules ?& array['gift_box_base','gift_chocolate','gift_raspberry','gift_pistachio','gift_gingerbread']) then raise exception 'catalog_price_rule_missing'; end if;
    price_minor := (price_rules->>'gift_box_base')::integer+chocolate*(price_rules->>'gift_chocolate')::integer+raspberry*(price_rules->>'gift_raspberry')::integer+pistachio*(price_rules->>'gift_pistachio')::integer+gingerbread*(price_rules->>'gift_gingerbread')::integer;
    variant_description := concat_ws(' · ',coalesce(catalog.variant_names->>p_locale,catalog.variant_names->>'ru'),nullif(btrim(p_description),''));
  elsif p_sku='celebration-set' then
    if coalesce(cfg->>'guests','') !~ '^[0-9]+$' or (cfg->>'guests')::integer not between 4 and 30 or
       coalesce(cfg->>'occasion','') not in ('birthday','children','anniversary') or
       coalesce(cfg->>'withCupcakes','') not in ('true','false') or coalesce(cfg->>'withCookies','') not in ('true','false') then
      raise exception 'invalid_configuration';
    end if;
    guests := (cfg->>'guests')::integer;
    cupcakes := (cfg->>'withCupcakes')::boolean;
    cookies := (cfg->>'withCookies')::boolean;
    select jsonb_object_agg(rule_key,amount_minor) into price_rules from public.catalog_price_rules;
    if price_rules is null or not (price_rules ?& array['celebration_cake_kg','celebration_cupcake','celebration_cookie']) then raise exception 'catalog_price_rule_missing'; end if;
    price_minor := ((ceil(guests::numeric/7*2)/2)*(price_rules->>'celebration_cake_kg')::integer + case when cupcakes then guests*(price_rules->>'celebration_cupcake')::integer else 0 end + case when cookies then guests*(price_rules->>'celebration_cookie')::integer else 0 end)::integer;
    variant_description := concat_ws(' · ',coalesce(catalog.variant_names->>p_locale,catalog.variant_names->>'ru'),nullif(btrim(p_description),''));
  end if;
  return next;
end; $$;
