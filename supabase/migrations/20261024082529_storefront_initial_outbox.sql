-- A2: reuse the existing leased notification queue; no broker/provider call.
alter table public.order_notification_deliveries drop constraint order_notification_deliveries_event_check;
alter table public.order_notification_deliveries add constraint order_notification_deliveries_event_check
 check(event in ('order_confirmed','order_received_manager','order_received_customer'));
alter table public.order_notification_deliveries add column provider_request_hash text
 check(provider_request_hash is null or provider_request_hash ~ '^[0-9a-f]{64}$');

-- First live receipt attempt binds the exact provider body (including configured
-- manager address/from/reply-to). Changed config must not reuse a key with a
-- different body after an ambiguous provider result.
create function public.bind_receipt_delivery(p_delivery_id uuid,p_lease_token uuid,p_request_hash text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_delivery_hash'; end if;
 update public.order_notification_deliveries set provider_request_hash=coalesce(provider_request_hash,p_request_hash)
 where id=p_delivery_id and lease_token=p_lease_token and status='sending'
 and event in ('order_received_manager','order_received_customer')
 and (provider_request_hash is null or provider_request_hash=p_request_hash);
 get diagnostics n=row_count;return n=1;
end $$;
revoke all on function public.bind_receipt_delivery(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.bind_receipt_delivery(uuid,uuid,text) to service_role;

create or replace function private.capture_delivery_payload() returns trigger language plpgsql security definer set search_path='' as $$
declare o public.orders; locale text;
begin
 select * into o from public.orders where id=new.order_id;
 select c.locale into locale from public.customers c where c.id=o.customer_id;
 new.payload:=jsonb_build_object('order_id',o.id,'revision',o.revision,'reference','BLG-'||upper(left(replace(o.id::text,'-',''),8)),'event',new.event,'customer_name',o.customer_name,'customer_contact',o.customer_contact,'locale',locale,'fulfillment',o.fulfillment,'delivery_address',o.delivery_address,'scheduled_start',o.scheduled_start,'scheduled_end',o.scheduled_end,'is_demo',o.is_demo,'note',o.note,'total_minor',o.delivery_minor+coalesce((select sum(i.line_total_minor) from public.order_items i where i.order_id=o.id),0),'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.product_name,'detail',i.variant_description,'quantity',i.quantity,'line_total_minor',i.line_total_minor) order by i.id) from public.order_items i where i.order_id=o.id),'[]'));
 return new;
end $$;

create function private.enqueue_storefront_receipt() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 insert into public.order_notification_deliveries(order_id,event)
 values(new.order_id,'order_received_manager'),(new.order_id,'order_received_customer');
 return new;
end $$;
revoke all on function private.enqueue_storefront_receipt() from public,anon,authenticated;
grant execute on function private.enqueue_storefront_receipt() to service_role;
-- Receipt is inserted only after items/snapshots exist, in the same TX as intake.
-- Duplicate submit/resolve/close never inserts a second saved intent.
create trigger enqueue_storefront_receipt after insert on private.storefront_intents
for each row when(new.state='saved') execute function private.enqueue_storefront_receipt();
