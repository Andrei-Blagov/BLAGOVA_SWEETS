begin;
create temporary table catalog_test_ids as
select gen_random_uuid() owner_id, gen_random_uuid() manager_id, gen_random_uuid() draft_id;
grant select on catalog_test_ids to anon, authenticated, service_role;
insert into auth.users(id,email)
select owner_id,'catalog-owner@example.invalid' from catalog_test_ids
union all select manager_id,'catalog-manager@example.invalid' from catalog_test_ids;
insert into public.staff_members(user_id,role)
select owner_id,'owner' from catalog_test_ids
union all select manager_id,'manager' from catalog_test_ids;
insert into public.products(id,slug,category,name,status)
select draft_id,'catalog-rls-fixture','cake','{"ru":"Test draft"}'::jsonb,'draft' from catalog_test_ids;
insert into public.product_variants(product_id,sku,name,price_minor)
select draft_id,'catalog-rls-variant','{"ru":"Test"}'::jsonb,10000 from catalog_test_ids;
insert into public.product_images(product_id,storage_path,alt,is_primary)
select draft_id,'products/'||draft_id||'/'||gen_random_uuid()||'.webp','{"ru":"Test photo"}'::jsonb,true from catalog_test_ids;

set local role anon;
do $$ begin
  if (select count(*) from public.catalog_categories) <> 6 then raise exception 'Public categories missing'; end if;
  if (select count(*) from public.catalog_price_rules) <> 8 then raise exception 'Public builder prices missing'; end if;
  if exists(select 1 from public.products where slug='catalog-rls-fixture') then raise exception 'Draft exposed'; end if;
  if exists(select 1 from public.product_images where product_id=(select draft_id from catalog_test_ids)) then raise exception 'Draft image metadata exposed'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select manager_id::text from catalog_test_ids),true);
set local role authenticated;
do $$ declare n integer; begin
  if exists(select 1 from public.products where slug='catalog-rls-fixture') then raise exception 'Manager read draft'; end if;
  if exists(select 1 from public.product_variants where sku='catalog-rls-variant') then raise exception 'Manager read variant price'; end if;
  if exists(select 1 from public.product_images where product_id=(select draft_id from catalog_test_ids)) then raise exception 'Manager read images'; end if;
  if exists(select 1 from public.catalog_price_rules) then raise exception 'Manager read owner pricing rules'; end if;
  if exists(select 1 from public.catalog_events) then raise exception 'Manager read audit'; end if;
  update public.products set status='published' where slug='catalog-rls-fixture';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Manager published draft'; end if;
  begin
    insert into public.catalog_price_rules(rule_key,amount_minor,description) values('catalog_attack',1,'attack');
    raise exception 'Manager wrote price rule';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_primary_product_image((select draft_id from catalog_test_ids),gen_random_uuid());
    raise exception 'Manager changed primary image';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub',(select owner_id::text from catalog_test_ids),true);
set local role authenticated;
do $$ declare n integer; begin
  if not exists(select 1 from public.products where slug='catalog-rls-fixture') then raise exception 'Owner cannot read draft'; end if;
  if not exists(select 1 from public.product_images where product_id=(select draft_id from catalog_test_ids)) then raise exception 'Owner cannot read photo'; end if;
  update public.product_variants set price_minor=12000 where sku='catalog-rls-variant';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Owner cannot edit price'; end if;
  if not exists(select 1 from public.catalog_events where entity='product_variants' and action='UPDATE') then raise exception 'Price edit not audited'; end if;
  begin
    update public.products set status='published' where slug='catalog-rls-fixture';
    raise exception 'Incomplete product published';
  exception when check_violation then null; end;
  update public.products set name='{"ru":"Test","en":"Test","th":"ทดสอบ"}'::jsonb,
    description='{"ru":"Test","en":"Test","th":"ทดสอบ"}'::jsonb where slug='catalog-rls-fixture';
  update public.product_variants set active=true where sku='catalog-rls-variant';
  update public.products set status='published' where slug='catalog-rls-fixture';
  if not exists(select 1 from public.products where slug='catalog-rls-fixture' and published_at is not null) then raise exception 'Complete product not published'; end if;
end $$;
reset role;

set local role anon;
do $$ begin
  if not exists(select 1 from public.products where slug='catalog-rls-fixture') then raise exception 'Published product hidden'; end if;
  if not exists(select 1 from public.product_images where product_id=(select draft_id from catalog_test_ids)) then raise exception 'Published image hidden'; end if;
end $$;
reset role;

set local role service_role;
do $$ begin
  if (select price_minor from private.resolve_storefront_item('berry-cloud-1kg','ru','{}'::jsonb,'','')) <> 145000 then raise exception 'Standard server price changed'; end if;
  if (select price_minor from private.resolve_storefront_item('custom-gift','ru','{"size":6,"chocolate":6,"raspberry":0,"pistachio":0,"gingerbread":0,"ribbon":"wine"}'::jsonb,'','')) <> 55000 then raise exception 'Gift server price changed'; end if;
end $$;
reset role;
rollback;
select 'PASS: public/manager/owner catalog RLS, publication, price edits, audit and server pricing; fixtures rolled back' as verification;
