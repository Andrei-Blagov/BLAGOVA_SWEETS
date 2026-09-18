begin;
select set_config('request.jwt.claim.sub','',true);
update private.owner_bootstrap set email = 'owner@bootstrap-test.invalid', claimed_by=null, claimed_at=null;
create temporary table bootstrap_ids as select gen_random_uuid() owner_id, gen_random_uuid() other_id;
insert into auth.users(id,email,email_confirmed_at,is_anonymous)
select other_id,'other@bootstrap-test.invalid',now(),false from bootstrap_ids;
insert into auth.users(id,email,is_anonymous)
select owner_id,'owner@bootstrap-test.invalid',false from bootstrap_ids;
do $$ begin
 if exists(select 1 from public.staff_members where user_id in (select owner_id from bootstrap_ids union all select other_id from bootstrap_ids)) then raise exception 'Unverified or unrelated user granted owner'; end if;
end $$;
update auth.users set email_confirmed_at=now() where id=(select owner_id from bootstrap_ids);
do $$ begin
 if not exists(select 1 from public.staff_members where user_id=(select owner_id from bootstrap_ids) and role='owner' and active) then raise exception 'Verified owner not granted'; end if;
 if not exists(select 1 from private.owner_bootstrap where claimed_by=(select owner_id from bootstrap_ids) and claimed_at is not null) then raise exception 'Bootstrap not consumed'; end if;
end $$;
update public.staff_members set active=false where user_id=(select owner_id from bootstrap_ids);
update auth.users set email_confirmed_at=now() where id=(select owner_id from bootstrap_ids);
do $$ begin if exists(select 1 from public.staff_members where user_id=(select owner_id from bootstrap_ids) and active) then raise exception 'Revoked owner reactivated'; end if; end $$;
set local role authenticated;
do $$ begin
 begin perform * from private.owner_bootstrap; raise exception 'Client read bootstrap'; exception when insufficient_privilege then null; end;
 begin perform private.assign_verified_owner(); raise exception 'Client invoked bootstrap trigger'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: only verified configured email receives owner, claim is consumed, revocation persists, client access denied; fixtures rolled back' as verification;