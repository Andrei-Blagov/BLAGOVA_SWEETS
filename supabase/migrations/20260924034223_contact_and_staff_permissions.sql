-- New requests must contain a reachable phone or email. Existing demo orders remain editable.
create function private.valid_order_contact(p_contact text) returns boolean
language sql immutable set search_path = '' as $$
  select p_contact is not null
    and length(btrim(p_contact)) between 1 and 120
    and (
      btrim(p_contact) ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$'
      or (btrim(p_contact) ~ '^[+]?[0-9][0-9 ()-]*$'
        and length(regexp_replace(p_contact, '[^0-9]', '', 'g')) between 7 and 15)
    );
$$;

create function private.require_order_contact() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not private.valid_order_contact(new.customer_contact) then
    raise exception 'invalid_customer_contact' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger require_order_contact before insert on public.orders
for each row execute function private.require_order_contact();

revoke all on function private.valid_order_contact(text), private.require_order_contact() from public, anon, authenticated;
grant execute on function private.valid_order_contact(text), private.require_order_contact() to service_role;

-- Operations remain available to owner and manager; unpublished content is owner-only.
alter policy staff_read on public.knowledge_documents using ((select private.is_owner()));
alter policy staff_read on public.knowledge_chunks using ((select private.is_owner()));
alter policy staff_read on public.products using ((select private.is_owner()));
alter policy staff_read on public.product_variants using ((select private.is_owner()));
alter policy staff_read on public.fillings using ((select private.is_owner()));
alter policy staff_read on public.product_fillings using ((select private.is_owner()));
