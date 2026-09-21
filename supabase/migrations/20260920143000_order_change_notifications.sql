create table public.order_change_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  order_revision integer not null check (order_revision > 0),
  event text not null check (event in ('order_rescheduled','order_cancelled')),
  channel text not null default 'email' check (channel = 'email'),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','manual_required')),
  attempts integer not null default 0 check (attempts >= 0),
  provider_message_id text,
  last_error text,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, order_revision, event, channel)
);

create index order_change_delivery_retry_idx
on public.order_change_deliveries(status, available_at)
where status in ('pending','failed');

alter table public.order_change_deliveries enable row level security;
revoke all on public.order_change_deliveries from public, anon, authenticated;
grant select on public.order_change_deliveries to authenticated;
grant all on public.order_change_deliveries to service_role;
create policy staff_read on public.order_change_deliveries for select to authenticated
using ((select private.is_staff()));
create policy backend_delivery on public.order_change_deliveries for all to service_role
using (true) with check (true);

create function private.staff_change_order(
  p_order_id uuid,
  p_revision integer,
  p_action text,
  p_start timestamptz default null,
  p_end timestamptz default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_order public.orders;
  delivery public.order_change_deliveries;
  event_name text;
  result jsonb;
begin
  if auth.uid() is null or not exists(
    select 1 from public.staff_members
    where user_id=auth.uid() and active and role in ('owner','manager')
  ) then raise exception 'Staff access required' using errcode='42501'; end if;

  select * into current_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if current_order.revision <> p_revision then
    raise exception 'Order changed; refresh before retrying' using errcode='40001';
  end if;
  if current_order.status in ('completed','cancelled') then raise exception 'Order is final'; end if;

  if p_action='reschedule' then
    if p_start is null or p_end is null or p_start <= now() or p_end <= p_start then
      raise exception 'Invalid schedule';
    end if;
    update public.orders set scheduled_start=p_start,scheduled_end=p_end
    where id=p_order_id returning * into current_order;
    event_name := 'order_rescheduled';
  elsif p_action='cancel' then
    update public.orders set status='cancelled'
    where id=p_order_id returning * into current_order;
    event_name := 'order_cancelled';
  else raise exception 'Unsupported action'; end if;

  insert into public.order_change_deliveries(order_id,order_revision,event,channel)
  values(current_order.id,current_order.revision,event_name,'email')
  returning * into delivery;

  select jsonb_build_object(
    'order_id',current_order.id,
    'reference','BLG-' || upper(substr(replace(current_order.id::text,'-',''),1,8)),
    'revision',current_order.revision,
    'status',current_order.status,
    'customer_name',current_order.customer_name,
    'customer_contact',current_order.customer_contact,
    'locale',customer.locale,
    'scheduled_start',current_order.scheduled_start,
    'scheduled_end',current_order.scheduled_end,
    'event',delivery.event,
    'delivery_id',delivery.id,
    'notification_status',delivery.status
  ) into result
  from public.customers customer where customer.id=current_order.customer_id;
  return result;
end; $$;

create function public.staff_change_order(
  p_order_id uuid,
  p_revision integer,
  p_action text,
  p_start timestamptz default null,
  p_end timestamptz default null
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.staff_change_order(p_order_id,p_revision,p_action,p_start,p_end);
$$;

create function private.claim_order_change(p_delivery_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed boolean;
begin
  update public.order_change_deliveries
  set status='sending',attempts=attempts+1,locked_at=now(),updated_at=now(),last_error=null
  where id=p_delivery_id and (
    (status in ('pending','failed') and available_at <= now())
    or (status='sending' and locked_at < now() - interval '5 minutes')
  ) returning true into claimed;
  return coalesce(claimed,false);
end; $$;

create function public.claim_order_change(p_delivery_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select private.claim_order_change(p_delivery_id);
$$;

create function private.complete_order_change(
  p_delivery_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_error text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('sent','failed','manual_required') then raise exception 'Invalid delivery status'; end if;
  update public.order_change_deliveries
  set status=p_status,
      provider_message_id=case when p_status='sent' then p_provider_message_id else provider_message_id end,
      last_error=left(p_error,500),
      sent_at=case when p_status='sent' then now() else sent_at end,
      available_at=case when p_status='failed' then now()+interval '2 minutes' else available_at end,
      locked_at=null,
      updated_at=now()
  where id=p_delivery_id;
end; $$;

create function public.complete_order_change(
  p_delivery_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_error text default null
) returns void language sql security invoker set search_path = '' as $$
  select private.complete_order_change(p_delivery_id,p_status,p_provider_message_id,p_error);
$$;

revoke all on function private.staff_change_order(uuid,integer,text,timestamptz,timestamptz),
  public.staff_change_order(uuid,integer,text,timestamptz,timestamptz) from public,anon;
grant execute on function private.staff_change_order(uuid,integer,text,timestamptz,timestamptz),
  public.staff_change_order(uuid,integer,text,timestamptz,timestamptz) to authenticated;

revoke all on function private.claim_order_change(uuid),public.claim_order_change(uuid),
  private.complete_order_change(uuid,text,text,text),public.complete_order_change(uuid,text,text,text)
from public,anon,authenticated;
grant execute on function private.claim_order_change(uuid),public.claim_order_change(uuid),
  private.complete_order_change(uuid,text,text,text),public.complete_order_change(uuid,text,text,text)
to service_role;
