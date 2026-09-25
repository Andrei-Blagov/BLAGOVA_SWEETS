create table public.production_slots (
  id uuid primary key default gen_random_uuid(),
  iso_weekday smallint not null check (iso_weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  capacity integer not null default 4 check (capacity between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  unique (iso_weekday, start_time, end_time)
);

create table public.production_blackout_dates (
  blackout_date date primary key,
  reason text not null default '',
  created_at timestamptz not null default now()
);

insert into public.production_slots(iso_weekday,start_time,end_time,capacity)
select day_number, slot_start, slot_end, 4
from generate_series(1,7) day_number
cross join (values
  (time '09:00',time '12:00'),
  (time '12:00',time '15:00'),
  (time '15:00',time '18:00')
) schedule(slot_start,slot_end)
on conflict (iso_weekday,start_time,end_time) do update
set capacity=excluded.capacity,active=true,updated_at=now();

alter table public.production_slots enable row level security;
alter table public.production_blackout_dates enable row level security;
revoke all on public.production_slots,public.production_blackout_dates from public,anon,authenticated;
grant select,insert,update,delete on public.production_slots,public.production_blackout_dates to service_role;

create or replace function private.production_slot_state(
  p_date date,
  p_start time,
  p_end time,
  p_exclude_order uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_capacity integer;
  v_used integer;
begin
  if exists(select 1 from public.production_blackout_dates where blackout_date=p_date) then
    raise exception 'slot_unavailable';
  end if;

  select capacity into v_capacity
  from public.production_slots
  where iso_weekday=extract(isodow from p_date)::smallint
    and start_time=p_start and end_time=p_end and active;
  if not found then raise exception 'slot_unavailable'; end if;

  select count(*)::integer into v_used
  from public.orders
  where status in ('confirmed','production','ready','completed')
    and (scheduled_start at time zone 'Asia/Bangkok')::date=p_date
    and (scheduled_start at time zone 'Asia/Bangkok')::time=p_start
    and (scheduled_end at time zone 'Asia/Bangkok')::time=p_end
    and (p_exclude_order is null or id<>p_exclude_order);

  return jsonb_build_object('capacity',v_capacity,'used',v_used,'available',v_used<v_capacity);
end; $$;

revoke all on function private.production_slot_state(date,time,time,uuid) from public,anon,authenticated;
grant execute on function private.production_slot_state(date,time,time,uuid) to service_role;

create or replace function public.get_storefront_availability(p_date date)
returns table(start_time time,end_time time,label text,capacity integer,used integer,available boolean)
language sql security definer set search_path = '' as $$
  select s.start_time,s.end_time,
    to_char(s.start_time,'HH24:MI') || '–' || to_char(s.end_time,'HH24:MI'),
    s.capacity,
    count(o.id)::integer,
    count(o.id) < s.capacity and b.blackout_date is null
  from public.production_slots s
  left join public.production_blackout_dates b on b.blackout_date=p_date
  left join public.orders o on o.status in ('confirmed','production','ready','completed')
    and (o.scheduled_start at time zone 'Asia/Bangkok')::date=p_date
    and (o.scheduled_start at time zone 'Asia/Bangkok')::time=s.start_time
    and (o.scheduled_end at time zone 'Asia/Bangkok')::time=s.end_time
  where s.iso_weekday=extract(isodow from p_date)::smallint and s.active
  group by s.start_time,s.end_time,s.capacity,b.blackout_date
  order by s.start_time;
$$;

revoke all on function public.get_storefront_availability(date) from public,anon,authenticated;
grant execute on function public.get_storefront_availability(date) to service_role;

create or replace function private.enforce_order_schedule_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_date date := (new.scheduled_start at time zone 'Asia/Bangkok')::date;
  v_start time := (new.scheduled_start at time zone 'Asia/Bangkok')::time;
  v_end time := (new.scheduled_end at time zone 'Asia/Bangkok')::time;
  v_state jsonb;
  v_is_capacity_status boolean := new.status in ('confirmed','production','ready','completed');
  v_schedule_changed boolean := tg_op='INSERT' or
    new.scheduled_start is distinct from old.scheduled_start or
    new.scheduled_end is distinct from old.scheduled_end;
  v_became_capacity_status boolean := tg_op='INSERT' and v_is_capacity_status or
    tg_op='UPDATE' and v_is_capacity_status and old.status not in ('confirmed','production','ready','completed');
begin
  if v_schedule_changed and new.scheduled_start <= now() then raise exception 'invalid_schedule'; end if;

  if v_is_capacity_status and (v_schedule_changed or v_became_capacity_status) then
    perform pg_advisory_xact_lock(hashtextextended(v_date::text || '|' || v_start::text || '|' || v_end::text,0));
  end if;

  if v_schedule_changed or v_became_capacity_status then
    v_state := private.production_slot_state(v_date,v_start,v_end,case when tg_op='UPDATE' then new.id else null end);
    if not (v_state->>'available')::boolean then raise exception 'slot_capacity_full'; end if;
  end if;
  return new;
end; $$;

revoke all on function private.enforce_order_schedule_capacity() from public,anon,authenticated;

drop trigger if exists orders_schedule_capacity_guard on public.orders;
create trigger orders_schedule_capacity_guard
before insert or update of scheduled_start,scheduled_end,status on public.orders
for each row execute function private.enforce_order_schedule_capacity();
