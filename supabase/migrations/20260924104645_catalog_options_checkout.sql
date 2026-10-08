-- Additive, optional single-choice groups. The existing order RPC calls this function
-- for both lead-time validation and final insertion, so checkout always re-prices.
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
  chosen record;
  option_row record;
  option_amount bigint := 0;
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
  select p.id as product_id,p.name as names,v.id,v.name as variant_names,v.price_minor as catalog_price,v.lead_days,v.min_quantity
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
  -- Optional extras are resolved exclusively from the published product's active options.
  if cfg ? 'options' then
    if jsonb_typeof(cfg->'options') <> 'object' then raise exception 'invalid_configuration'; end if;
    if (select count(*) from jsonb_object_keys(cfg->'options')) > 10 then raise exception 'invalid_configuration'; end if;
    for chosen in select key,value from jsonb_each(cfg->'options') loop
      if jsonb_typeof(chosen.value) <> 'string' or length(chosen.key) > 80 or
         length(chosen.value #>> '{}') > 80 then raise exception 'invalid_configuration'; end if;
      select o.label,o.price_delta_minor into option_row from public.catalog_options o
      where o.product_id=catalog.product_id and o.active and o.option_group=chosen.key
        and o.option_key=(chosen.value #>> '{}');
      if not found then raise exception 'catalog_option_unavailable'; end if;
      option_amount := option_amount + option_row.price_delta_minor;
      variant_description := concat_ws(' · ',variant_description,
        coalesce(option_row.label->>p_locale,option_row.label->>'ru'));
    end loop;
  end if;
  if price_minor::bigint+option_amount > 100000000 then raise exception 'invalid_configuration'; end if;
  price_minor := price_minor + option_amount::integer;
  return next;
end; $$;

-- Demo-only options make the server path testable for a product and both builders.
insert into public.catalog_options(product_id,option_group,option_key,label,price_delta_minor,sort_order)
select p.id,o.option_group,o.option_key,o.label::jsonb,o.price_delta_minor,10
from public.products p join (values
  ('berry-cloud','decoration','candle','{"ru":"Свеча · демо","en":"Candle · demo","th":"เทียน · ตัวอย่าง"}',5000),
  ('custom-gift','wrapping','gift_tag','{"ru":"Подарочная бирка · демо","en":"Gift tag · demo","th":"ป้ายของขวัญ · ตัวอย่าง"}',2000),
  ('celebration-set','decoration','extra_decor','{"ru":"Дополнительный декор · демо","en":"Extra decoration · demo","th":"ตกแต่งเพิ่มเติม · ตัวอย่าง"}',10000)
) as o(slug,option_group,option_key,label,price_delta_minor) on o.slug=p.slug
on conflict(product_id,option_group,option_key) do nothing;
