-- Reject new reservations and first confirmation on intervals that have started.
-- Existing snapshots, RPC signatures and grants are preserved.
create or replace function private.enforce_order_schedule_capacity() returns trigger
language plpgsql security definer set search_path='' as $$
declare changed boolean; entering boolean; target boolean; k bigint; old_day date; new_day date; r jsonb; state jsonb;
begin
  perform pg_advisory_xact_lock_shared(710002,1);
  changed:=tg_op='INSERT' or new.scheduled_start is distinct from old.scheduled_start or new.scheduled_end is distinct from old.scheduled_end;
  entering:=new.status in ('confirmed','production','ready','completed') and (tg_op='INSERT' or old.status='pending');
  if changed and new.scheduled_start<=clock_timestamp() then raise exception 'invalid_schedule'; end if;
  if tg_op='UPDATE' and old.status in ('confirmed','production','ready','completed') and
    (new.production_load,new.category_counts,new.production_assessment,new.rules_version) is distinct from (old.production_load,old.category_counts,old.production_assessment,old.rules_version) then raise exception 'confirmed_production_is_immutable'; end if;
  if new.status='cancelled' or new.status in ('confirmed','production','ready','completed') then new.reservation_expires_at:=null;
  elsif changed and new.production_load is not null then
    select config into r from public.production_rule_versions order by version desc limit 1;
    new.reservation_expires_at:=clock_timestamp()+make_interval(mins=>(r->>'hold_minutes')::integer);
  end if;
  target:=new.status in ('confirmed','production','ready','completed') or new.status='pending' and new.reservation_expires_at>clock_timestamp();
  -- Lock dates, a deliberately broader lock than one interval: overlapping intervals
  -- and opposite-direction transfers cannot evade capacity or deadlock on slot order.
  if target or tg_op='UPDATE' and old.reservation_expires_at is not null then
    new_day:=(new.scheduled_start at time zone 'Asia/Bangkok')::date;
    old_day:=case when tg_op='UPDATE' then (old.scheduled_start at time zone 'Asia/Bangkok')::date else new_day end;
    for k in select distinct hashtextextended('production-date:'||d::text,710002) from unnest(array[old_day,new_day]) d order by 1 loop perform pg_advisory_xact_lock(k); end loop;
  end if;
  -- Recheck wall-clock time after any lock wait. Acquiring or renewing a pending
  -- reservation and first confirmation require a future interval. Historical
  -- notes, cancellation and progress of already confirmed orders remain allowed.
  if new.scheduled_start<=clock_timestamp() and (changed or entering or
    new.status='pending' and new.reservation_expires_at>clock_timestamp() and
    (tg_op='INSERT' or (new.production_load,new.category_counts,new.reservation_expires_at)
      is distinct from (old.production_load,old.category_counts,old.reservation_expires_at))) then
    raise exception 'invalid_schedule';
  end if;
  if target and (changed or entering or tg_op='UPDATE' and (new.production_load,new.category_counts,new.reservation_expires_at) is distinct from (old.production_load,old.category_counts,old.reservation_expires_at)) then
    if new.production_load is null then raise exception 'production_load_required'; end if;
    perform private.validate_production_counts(new.category_counts);
    state:=private.production_capacity(new.scheduled_start,new.scheduled_end,new.production_load,new.category_counts,case when tg_op='UPDATE' then new.id else null end);
    if not (state->>'available')::boolean then raise exception 'slot_capacity_full'; end if;
  elsif changed then
    perform private.production_capacity(new.scheduled_start,new.scheduled_end,0,'{}',null);
  end if;
  return new;
end $$;
