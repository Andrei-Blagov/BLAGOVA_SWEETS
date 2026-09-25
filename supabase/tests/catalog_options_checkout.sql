begin;
create temporary table option_test_product as select id from public.products where slug='berry-cloud';
grant select on option_test_product to authenticated;
set local role service_role;
do $$ declare base_price integer; gift_price integer; set_price integer; begin
  select price_minor into base_price from private.resolve_storefront_item('berry-cloud-1kg','ru','{}','', '');
  if base_price <> 145000 then raise exception 'Base product price changed'; end if;
  if (select price_minor from private.resolve_storefront_item('berry-cloud-1kg','ru','{"options":{"decoration":"candle"}}','','')) <> base_price+5000 then
    raise exception 'Product option price was not server-calculated'; end if;
  if (select variant_description from private.resolve_storefront_item('berry-cloud-1kg','ru','{"options":{"decoration":"candle"}}','','')) not like '%Свеча%' then
    raise exception 'Option missing from order description'; end if;
  select price_minor into gift_price from private.resolve_storefront_item('custom-gift','ru',
    '{"size":6,"chocolate":6,"raspberry":0,"pistachio":0,"gingerbread":0,"ribbon":"wine","options":{"wrapping":"gift_tag"}}','','');
  if gift_price <> 57000 then raise exception 'Gift option price failed'; end if;
  select price_minor into set_price from private.resolve_storefront_item('celebration-set','ru',
    '{"guests":4,"occasion":"birthday","withCupcakes":false,"withCookies":false,"options":{"decoration":"extra_decor"}}','','');
  if set_price <> 155000 then raise exception 'Celebration option price failed'; end if;
  begin
    perform private.resolve_storefront_item('berry-cloud-1kg','ru','{"options":{"decoration":"extra_decor"}}','','');
    raise exception 'Cross-product option accepted';
  exception when raise_exception then
    if sqlerrm <> 'catalog_option_unavailable' then raise; end if;
  end;
  begin
    perform private.resolve_storefront_item('berry-cloud-1kg','ru','{"options":{"decoration":"candle","extra":"forged"}}','','');
    raise exception 'Forged extra accepted';
  exception when raise_exception then
    if sqlerrm <> 'catalog_option_unavailable' then raise; end if;
  end;
  begin
    perform private.resolve_storefront_item('berry-cloud-1kg','ru','{"options":{"decoration":100}}','','');
    raise exception 'Non-string option accepted';
  exception when raise_exception then
    if sqlerrm <> 'invalid_configuration' then raise; end if;
  end;
  update public.catalog_options set active=false where option_group='decoration' and option_key='candle';
  begin
    perform private.resolve_storefront_item('berry-cloud-1kg','ru','{"options":{"decoration":"candle"}}','','');
    raise exception 'Inactive option accepted';
  exception when raise_exception then
    if sqlerrm <> 'catalog_option_unavailable' then raise; end if;
  end;
  update public.catalog_options set active=true where option_group='decoration' and option_key='candle';
end $$;
reset role;
-- Anonymous users see only the three published demo extras; an unaffiliated
-- authenticated user cannot edit them or create a fourth one.
set local role anon;
do $$ begin
  if (select count(*) from public.catalog_options where active) <> 3 then raise exception 'Published options hidden'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
set local role authenticated;
do $$ declare changed integer; begin
  update public.catalog_options set price_delta_minor=1 where option_key='candle';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Unauthorized option price edit'; end if;
  begin
    insert into public.catalog_options(product_id,option_group,option_key,label,price_delta_minor)
    select id,'forged','free','{"ru":"Wrong"}',0 from option_test_product;
    raise exception 'Unauthorized option insert';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: option pricing, descriptions, builder pricing, forged and inactive options; changes rolled back' as verification;
