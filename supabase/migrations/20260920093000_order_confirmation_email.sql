-- Idempotent confirmation delivery, created in the same transaction as confirmation.
create table public.order_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  event text not null check (event in ('order_confirmed')),
  channel text not null default 'email' check (channel in ('email')),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','manual_required')),
  attempts integer not null default 0 check (attempts >= 0),
  provider_message_id text,
  last_error text,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, event, channel)
);

create index order_notification_delivery_retry_idx
on public.order_notification_deliveries(status, available_at)
where status in ('pending','failed');

alter table public.order_notification_deliveries enable row level security;
revoke all on public.order_notification_deliveries from public, anon, authenticated;
grant select on public.order_notification_deliveries to authenticated;
grant all on public.order_notification_deliveries to service_role;
create policy staff_read on public.order_notification_deliveries for select to authenticated
using ((select private.is_staff()));
create policy backend_delivery on public.order_notification_deliveries for all to service_role
using (true) with check (true);

create function private.staff_confirm_order(p_order_id uuid, p_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_order public.orders;
  delivery public.order_notification_deliveries;
  result jsonb;
begin
  if auth.uid() is null or not exists(
    select 1 from public.staff_members
    where user_id=auth.uid() and active and role in ('owner','manager')
  ) then
    raise exception 'Staff access required' using errcode='42501';
  end if;

  select * into current_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if current_order.status not in ('pending','confirmed') then raise exception 'Order cannot be confirmed'; end if;

  if current_order.status = 'pending' then
    if current_order.revision <> p_revision then
      raise exception 'Order changed; refresh before retrying' using errcode='40001';
    end if;
    update public.orders set status='confirmed' where id=p_order_id returning * into current_order;
  end if;

  insert into public.order_notification_deliveries(order_id,event,channel)
  values (p_order_id,'order_confirmed','email')
  on conflict (order_id,event,channel) do nothing;

  select * into delivery from public.order_notification_deliveries
  where order_id=p_order_id and event='order_confirmed' and channel='email';

  select jsonb_build_object(
    'order_id', current_order.id,
    'reference', 'BLG-' || upper(substr(replace(current_order.id::text, '-', ''), 1, 8)),
    'revision', current_order.revision,
    'status', current_order.status,
    'customer_name', current_order.customer_name,
    'customer_contact', current_order.customer_contact,
    'locale', customer.locale,
    'fulfillment', current_order.fulfillment,
    'delivery_address', current_order.delivery_address,
    'delivery_minor', current_order.delivery_minor,
    'scheduled_start', current_order.scheduled_start,
    'scheduled_end', current_order.scheduled_end,
    'notification_status', delivery.status,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', item.product_name,
        'detail', item.variant_description,
        'quantity', item.quantity,
        'unit_price_minor', item.unit_price_minor
      ) order by item.created_at, item.id)
      from public.order_items item where item.order_id=current_order.id
    ), '[]'::jsonb)
  ) into result
  from public.customers customer where customer.id=current_order.customer_id;

  return result;
end; $$;

create function public.staff_confirm_order(p_order_id uuid, p_revision integer)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.staff_confirm_order(p_order_id,p_revision);
$$;

create function private.claim_order_confirmation(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed boolean;
begin
  update public.order_notification_deliveries
  set status='sending', attempts=attempts+1, locked_at=now(), updated_at=now(), last_error=null
  where order_id=p_order_id and event='order_confirmed' and channel='email'
    and (
      (status in ('pending','failed') and available_at <= now())
      or (status='sending' and locked_at < now() - interval '5 minutes')
    )
  returning true into claimed;
  return coalesce(claimed,false);
end; $$;

create function public.claim_order_confirmation(p_order_id uuid)
returns boolean language sql security invoker set search_path = '' as $$
  select private.claim_order_confirmation(p_order_id);
$$;

create function private.complete_order_confirmation(
  p_order_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_error text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('sent','failed','manual_required') then raise exception 'Invalid delivery status'; end if;
  update public.order_notification_deliveries
  set status=p_status,
      provider_message_id=case when p_status='sent' then p_provider_message_id else provider_message_id end,
      last_error=left(p_error,500),
      sent_at=case when p_status='sent' then now() else sent_at end,
      available_at=case when p_status='failed' then now() + interval '2 minutes' else available_at end,
      locked_at=null,
      updated_at=now()
  where order_id=p_order_id and event='order_confirmed' and channel='email';
end; $$;

create function public.complete_order_confirmation(
  p_order_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_error text default null
) returns void language sql security invoker set search_path = '' as $$
  select private.complete_order_confirmation(p_order_id,p_status,p_provider_message_id,p_error);
$$;

revoke all on function private.staff_confirm_order(uuid,integer), public.staff_confirm_order(uuid,integer) from public,anon;
grant execute on function private.staff_confirm_order(uuid,integer), public.staff_confirm_order(uuid,integer) to authenticated;

revoke all on function private.claim_order_confirmation(uuid), public.claim_order_confirmation(uuid),
  private.complete_order_confirmation(uuid,text,text,text), public.complete_order_confirmation(uuid,text,text,text)
from public,anon,authenticated;
grant execute on function private.claim_order_confirmation(uuid), public.claim_order_confirmation(uuid),
  private.complete_order_confirmation(uuid,text,text,text), public.complete_order_confirmation(uuid,text,text,text)
to service_role;
