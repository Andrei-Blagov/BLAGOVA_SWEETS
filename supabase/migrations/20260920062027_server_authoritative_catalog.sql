-- The storefront may display prices, but only this catalog is authoritative for orders.
insert into public.products(slug,category,name,description,status,is_demo,image_path)
values
  ('berry-cloud','cake','{"ru":"Ягодное облако","en":"Berry cloud","th":"เค้กเบอร์รีคลาวด์"}'::jsonb,'{}','published',true,'/prototype/cake.webp'),
  ('raspberry-kisses','cupcake','{"ru":"Малиновые поцелуи","en":"Raspberry kisses","th":"ราสป์เบอร์รีคิสเซส"}'::jsonb,'{}','published',true,'/prototype/cupcakes.webp'),
  ('chocolate-stories','chocolate','{"ru":"Шоколадные истории","en":"Chocolate stories","th":"ช็อกโกแลตสตอรีส์"}'::jsonb,'{}','published',true,'/prototype/gift.webp'),
  ('gingerbread-heart','gingerbread','{"ru":"Тёплые слова","en":"Sweet little words","th":"คำหวานจากใจ"}'::jsonb,'{}','published',true,'/photos_of_products/gingerbread-heart.webp'),
  ('birthday-cupcakes','cupcake','{"ru":"Маленький праздник","en":"Little celebration","th":"งานฉลองเล็ก ๆ"}'::jsonb,'{}','published',true,'/prototype/cupcakes.webp'),
  ('celebration-cake','cake','{"ru":"Ваш особенный день","en":"Your special day","th":"วันพิเศษของคุณ"}'::jsonb,'{}','published',true,'/prototype/cake.webp'),
  ('custom-gift','gift','{"ru":"Мой сладкий подарок","en":"My sweet gift box","th":"กล่องของขวัญของฉัน"}'::jsonb,'{}','published',true,'/prototype/gift.webp'),
  ('celebration-set','cake','{"ru":"Мой праздничный комплект","en":"My celebration set","th":"ชุดงานฉลองของฉัน"}'::jsonb,'{}','published',true,'/prototype/cake.webp')
on conflict (slug) do update set
  category=excluded.category,name=excluded.name,description=excluded.description,status=excluded.status,
  is_demo=excluded.is_demo,image_path=excluded.image_path,updated_at=now();

insert into public.product_variants(product_id,sku,name,price_minor,currency,lead_days,min_quantity,active)
select p.id,v.sku,v.name,v.price_minor,'THB',v.lead_days,1,true
from public.products p
join (values
  ('berry-cloud','berry-cloud-1kg','{"ru":"1 кг","en":"1 kg","th":"1 กก."}'::jsonb,145000,2),
  ('berry-cloud','berry-cloud-1_5kg','{"ru":"1,5 кг","en":"1.5 kg","th":"1.5 กก."}'::jsonb,217500,2),
  ('berry-cloud','berry-cloud-2kg','{"ru":"2 кг","en":"2 kg","th":"2 กก."}'::jsonb,290000,2),
  ('raspberry-kisses','raspberry-kisses-standard','{"ru":"набор 6 шт.","en":"box of 6","th":"กล่อง 6 ชิ้น"}'::jsonb,59000,1),
  ('chocolate-stories','chocolate-stories-standard','{"ru":"набор 6 шт.","en":"box of 6","th":"กล่อง 6 ชิ้น"}'::jsonb,49000,0),
  ('gingerbread-heart','gingerbread-heart-standard','{"ru":"набор 2 шт.","en":"set of 2","th":"ชุด 2 ชิ้น"}'::jsonb,28000,2),
  ('birthday-cupcakes','birthday-cupcakes-standard','{"ru":"набор 6 шт.","en":"box of 6","th":"กล่อง 6 ชิ้น"}'::jsonb,69000,2),
  ('celebration-cake','celebration-cake-1kg','{"ru":"1 кг","en":"1 kg","th":"1 กก."}'::jsonb,165000,3),
  ('celebration-cake','celebration-cake-1_5kg','{"ru":"1,5 кг","en":"1.5 kg","th":"1.5 กก."}'::jsonb,247500,3),
  ('celebration-cake','celebration-cake-2kg','{"ru":"2 кг","en":"2 kg","th":"2 กก."}'::jsonb,330000,3),
  ('custom-gift','custom-gift','{"ru":"индивидуальный набор","en":"custom box","th":"กล่องที่กำหนดเอง"}'::jsonb,10000,2),
  ('celebration-set','celebration-set','{"ru":"индивидуальный комплект","en":"custom set","th":"ชุดที่กำหนดเอง"}'::jsonb,0,3)
) as v(slug,sku,name,price_minor,lead_days) on v.slug=p.slug
on conflict (sku) do update set
  product_id=excluded.product_id,name=excluded.name,price_minor=excluded.price_minor,currency=excluded.currency,
  lead_days=excluded.lead_days,min_quantity=excluded.min_quantity,active=excluded.active,updated_at=now();

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
    price_minor := 10000+chocolate*7500+raspberry*8000+pistachio*8500+gingerbread*9000;
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
    price_minor := ((ceil(guests::numeric/7*2)/2)*145000 + case when cupcakes then guests*9500 else 0 end + case when cookies then guests*14000 else 0 end)::integer;
    variant_description := concat_ws(' · ',coalesce(catalog.variant_names->>p_locale,catalog.variant_names->>'ru'),nullif(btrim(p_description),''));
  end if;
  return next;
end; $$;

revoke all on function private.resolve_storefront_item(text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function private.resolve_storefront_item(text,text,jsonb,text,text) to service_role;

drop function if exists public.receive_storefront_order(uuid,text,text,text,text,text,text,integer,timestamptz,timestamptz,text,jsonb,jsonb,text);

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
begin
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
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 25 then raise exception 'invalid_items'; end if;
  if jsonb_typeof(p_messages) <> 'array' or jsonb_array_length(p_messages) > 20 then raise exception 'invalid_messages'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'quantity','') !~ '^[0-9]+$' or (v_item->>'quantity')::integer not between 1 and 20 or
       length(coalesce(v_item->>'personalization','')) > 80 or length(coalesce(v_item->>'description','')) > 500 then raise exception 'invalid_item'; end if;
    select * into v_catalog from private.resolve_storefront_item(
      v_item->>'sku',p_locale,coalesce(v_item->'configuration','{}'::jsonb),v_item->>'personalization',v_item->>'description'
    );
    if (v_item->>'quantity')::integer < v_catalog.min_quantity then raise exception 'catalog_item_unavailable'; end if;
    v_max_lead := greatest(v_max_lead,v_catalog.lead_days);
  end loop;

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
    delivery_minor,scheduled_start,scheduled_end,customer_name,customer_contact,note,is_demo)
  values(p_request_key,v_customer_id,v_conversation_id,p_source,p_fulfillment,
    case when p_fulfillment='delivery' then btrim(p_delivery_address) else null end,
    v_delivery_minor,p_scheduled_start,p_scheduled_end,btrim(p_customer_name),btrim(p_customer_contact),coalesce(p_note,''),true)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_catalog from private.resolve_storefront_item(
      v_item->>'sku',p_locale,coalesce(v_item->'configuration','{}'::jsonb),v_item->>'personalization',v_item->>'description'
    );
    insert into public.order_items(order_id,variant_id,product_name,variant_description,quantity,unit_price_minor)
    values(v_order_id,v_catalog.variant_id,v_catalog.product_name,v_catalog.variant_description,
      (v_item->>'quantity')::integer,v_catalog.price_minor);
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
