-- Publication is a database transition, never just a client-side checkbox.
create function private.guard_catalog_publication() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare lang text;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    foreach lang in array array['ru','en','th'] loop
      if length(btrim(coalesce(new.name->>lang,''))) = 0 or
         length(btrim(coalesce(new.description->>lang,''))) = 0 then
        raise exception 'catalog_translation_missing' using errcode='23514';
      end if;
    end loop;
    if not exists(select 1 from public.product_variants v where v.product_id=new.id and v.active) then
      raise exception 'catalog_active_variant_missing' using errcode='23514';
    end if;
    if new.image_path is null and not exists(
      select 1 from public.product_images i where i.product_id=new.id and i.is_primary
    ) then raise exception 'catalog_primary_image_missing' using errcode='23514'; end if;
    new.published_at := now();
  end if;
  return new;
end $$;
revoke all on function private.guard_catalog_publication() from public,anon,authenticated;
create trigger guard_catalog_publication before insert or update of status on public.products
for each row execute function private.guard_catalog_publication();

-- One transaction changes the primary image; a failed selection restores the original.
create function public.set_primary_product_image(p_product_id uuid,p_image_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not (select private.is_owner()) then raise exception 'Owner access required' using errcode='42501'; end if;
  if not exists(select 1 from public.product_images where id=p_image_id and product_id=p_product_id) then
    raise exception 'Image not found' using errcode='P0002';
  end if;
  update public.product_images set is_primary=false where product_id=p_product_id and is_primary;
  update public.product_images set is_primary=true where id=p_image_id and product_id=p_product_id;
end $$;
revoke all on function public.set_primary_product_image(uuid,uuid) from public,anon;
grant execute on function public.set_primary_product_image(uuid,uuid) to authenticated;

-- Rule removal would make an existing gift/celebration SKU unorderable.
revoke delete on public.catalog_price_rules from authenticated;
drop policy owner_delete on public.catalog_price_rules;
