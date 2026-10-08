-- One-time owner bootstrap. Email is configured separately, not in source.
create table private.owner_bootstrap (
  singleton boolean primary key default true check (singleton),
  email text not null check (email = lower(btrim(email)) and position('@' in email) > 1),
  claimed_by uuid unique references auth.users(id) on delete restrict,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((claimed_by is null) = (claimed_at is null))
);
alter table private.owner_bootstrap enable row level security;
revoke all on private.owner_bootstrap from public, anon, authenticated;
grant all on private.owner_bootstrap to service_role;
create policy backend_bootstrap on private.owner_bootstrap for all to service_role using (true) with check (true);

-- Auth owns user verification; the client cannot mutate auth.users or invoke this trigger.
create function private.assign_verified_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target_email text; target_user uuid;
begin
  if new.email_confirmed_at is null or new.email is null or new.is_anonymous then return new; end if;
  if auth.uid() is not null and auth.uid() <> new.id then
    raise exception 'Owner bootstrap identity mismatch';
  end if;
  select email, claimed_by into target_email, target_user
    from private.owner_bootstrap where singleton = true for update;
  if target_email is null or target_user is not null or lower(new.email) <> target_email then return new; end if;
  -- Never overwrite an existing role or reactivate a revoked account.
  if exists(select 1 from public.staff_members where user_id = new.id) then return new; end if;
  insert into public.staff_members(user_id, role, active) values (new.id, 'owner', true);
  update private.owner_bootstrap set claimed_by = new.id, claimed_at = now() where singleton = true;
  return new;
end; $$;
revoke all on function private.assign_verified_owner() from public, anon, authenticated, service_role;
create trigger blagova_verified_owner after insert or update of email_confirmed_at, email on auth.users
for each row execute function private.assign_verified_owner();
