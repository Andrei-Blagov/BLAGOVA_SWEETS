begin;
create function pg_temp.intake(p_items jsonb,p_day integer default 30,p_key uuid default gen_random_uuid(),p_source text default 'website',p_slot text default '09:00') returns uuid
language plpgsql as $$ declare oid uuid; begin
 select order_id into oid from public.receive_storefront_order(p_key,p_source,'ru','Capacity QA','capacity-qa@example.invalid','pickup','','pickup',
 (((clock_timestamp() at time zone 'Asia/Bangkok')::date+p_day)+p_slot::time) at time zone 'Asia/Bangkok',
 (((clock_timestamp() at time zone 'Asia/Bangkok')::date+p_day)+(p_slot::time+interval '3 hours')) at time zone 'Asia/Bangkok','',p_items,'[]',encode(gen_random_bytes(32),'hex'));
 return oid;
end $$;
create function pg_temp.assert(p_value boolean,p_message text) returns void language plpgsql as $$ begin if p_value is distinct from true then raise exception 'ASSERT: %',p_message; end if; end $$;
create function pg_temp.reject_intake(p_items jsonb,p_day integer,p_error text) returns void language plpgsql as $$ begin
 begin perform pg_temp.intake(p_items,p_day); raise exception 'not_rejected';
 exception when others then if sqlerrm<>p_error then raise exception 'expected %, got %',p_error,sqlerrm; end if; end;
end $$;
create temp table qa_staff(id uuid,role text);
insert into auth.users(id,email) values(gen_random_uuid(),'capacity-owner@example.invalid'),(gen_random_uuid(),'capacity-manager@example.invalid');
insert into qa_staff select id,case when email like '%owner@%' then 'owner' else 'manager' end from auth.users where email in ('capacity-owner@example.invalid','capacity-manager@example.invalid');
insert into public.staff_members(user_id,role) select * from qa_staff;
select set_config('request.jwt.claim.sub',(select id::text from qa_staff where role='owner'),true);
-- A single cupcake fixture makes the 32-piece boundary reachable.
insert into public.product_variants(product_id,sku,name,price_minor,active,lead_days) select id,'qa-small-piece','{"ru":"1 штука","en":"1 piece","th":"1"}',1000,true,0 from public.products where slug='raspberry-kisses';
insert into public.production_variant_profiles(variant_id,components) select id,'{"small":1}' from public.product_variants where sku='qa-small-piece';

do $$ declare r public.production_rule_versions; q jsonb; a uuid; b uuid; k uuid:=gen_random_uuid(); snap jsonb; cfg jsonb; rev integer; expires timestamptz; rejected boolean;
begin
 select * into r from public.production_rule_versions order by version desc limit 1;
 q:=private.quote_production_cart('[{"sku":"berry-cloud-1_5kg","quantity":1,"price_minor":1,"load_units":0,"configuration":{"options":{"decoration":"candle"}}}]','ru');
 perform pg_temp.assert((q->>'load_units')::integer=8 and (q->'items'->0->>'unit_price_minor')::integer=222500,'server price and cake variant load, ignore forged values');
 q:=private.quote_production_cart('[{"sku":"berry-cloud-1kg","quantity":2},{"sku":"chocolate-stories-standard","quantity":2},{"sku":"gingerbread-heart-standard","quantity":1}]','ru');
 perform pg_temp.assert((q->>'load_units')::integer=25,'mixed order load');
 q:=private.quote_production_cart('[{"sku":"raspberry-kisses-standard","quantity":2}]','ru');
 perform pg_temp.assert((q->>'load_units')::integer=12 and (q->'category_counts'->>'small')::integer=12,'six-piece variant load');
 q:=private.quote_production_cart('[{"sku":"custom-gift","quantity":1,"configuration":{"size":6,"chocolate":4,"raspberry":0,"pistachio":0,"gingerbread":2,"ribbon":"wine"}}]','ru');
 perform pg_temp.assert((q->>'load_units')::integer=5,'gift per-category ceil');
 q:=private.quote_production_cart('[{"sku":"custom-gift","quantity":2,"configuration":{"size":9,"chocolate":9,"raspberry":0,"pistachio":0,"gingerbread":0,"ribbon":"wine"}}]','ru');
 perform pg_temp.assert((q->>'load_units')::integer=16,'round each box before multiplying quantity');
 q:=private.quote_production_cart('[{"sku":"celebration-set","quantity":1,"configuration":{"guests":7,"occasion":"birthday","withCupcakes":true,"withCookies":true}}]','ru');
 perform pg_temp.assert((q->>'load_units')::integer=19,'celebration components');
 a:=pg_temp.intake('[{"sku":"berry-cloud-1kg","quantity":4}]',30,k);
 select reservation_expires_at into expires from public.orders where id=a;
 perform pg_temp.assert(expires>clock_timestamp()+interval '59 minutes' and expires<clock_timestamp()+interval '61 minutes','60 minute reservation');
 b:=pg_temp.intake('[{"sku":"berry-cloud-1kg","quantity":4}]',30,k);
 perform pg_temp.assert(a=b and (select count(*)=1 from public.orders where request_key=k) and (select reservation_expires_at=expires from public.orders where id=a),'idempotent retry does not refresh or duplicate reservation');
 perform pg_temp.reject_intake('[{"sku":"berry-cloud-1kg","quantity":1}]',30,'slot_capacity_full');
 update public.orders set status='cancelled' where id=a;
 a:=pg_temp.intake('[{"sku":"berry-cloud-1kg","quantity":1}]',30);
 perform pg_temp.assert((select production_load=8 from public.orders where id=a),'cancel releases capacity');
 select snapshot into snap from public.order_items where order_id=a;
 begin update public.order_items set quantity=2 where order_id=a; raise exception 'not_rejected'; exception when others then if sqlerrm<>'order_item_is_immutable' then raise; end if; end;
 perform public.staff_confirm_order(a,1);perform public.staff_confirm_order(a,1);
 perform pg_temp.assert((select count(*)=1 from public.order_notification_deliveries where order_id=a),'double confirmation creates one notification');
 cfg:=r.config; cfg:=jsonb_set(cfg,'{coefficients,cake}','16');perform public.save_production_rules(cfg,r.version);
 perform pg_temp.assert((select snapshot=snap from public.order_items where order_id=a) and (select production_load=8 from public.orders where id=a),'rule change does not recalculate confirmed snapshot');
 perform public.save_production_rules(r.config,(select max(version) from public.production_rule_versions));
 b:=pg_temp.intake('[{"sku":"berry-cloud-1kg","quantity":4}]',31);
 select revision into rev from public.orders where id=a;
 begin perform public.staff_change_order(a,rev,'reschedule',(((clock_timestamp() at time zone 'Asia/Bangkok')::date+31)+time '09:00') at time zone 'Asia/Bangkok',(((clock_timestamp() at time zone 'Asia/Bangkok')::date+31)+time '12:00') at time zone 'Asia/Bangkok');raise exception 'not_rejected';exception when others then if sqlerrm<>'slot_capacity_full' then raise; end if;end;
 perform pg_temp.assert((select (scheduled_start at time zone 'Asia/Bangkok')::date=(clock_timestamp() at time zone 'Asia/Bangkok')::date+30 from public.orders where id=a),'failed transfer preserves old slot');
 perform public.staff_change_order(a,rev,'reschedule',(((clock_timestamp() at time zone 'Asia/Bangkok')::date+32)+time '09:00') at time zone 'Asia/Bangkok',(((clock_timestamp() at time zone 'Asia/Bangkok')::date+32)+time '12:00') at time zone 'Asia/Bangkok');
 perform pg_temp.assert((private.production_capacity((((clock_timestamp() at time zone 'Asia/Bangkok')::date+30)+time '09:00') at time zone 'Asia/Bangkok',(((clock_timestamp() at time zone 'Asia/Bangkok')::date+30)+time '12:00') at time zone 'Asia/Bangkok',0,'{}')->>'used')::integer=0,'successful transfer releases old slot');
 a:=pg_temp.intake('[{"sku":"berry-cloud-1kg","quantity":1}]',33);
 update public.orders set reservation_expires_at=clock_timestamp()-interval '1 second' where id=a;
 perform pg_temp.assert((select status='pending' from public.orders where id=a),'expiry does not change status');
 b:=pg_temp.intake('[{"sku":"berry-cloud-1kg","quantity":4}]',33);
 select revision into rev from public.orders where id=a;
 begin perform public.staff_confirm_order(a,rev);raise exception 'not_rejected';exception when others then if sqlerrm<>'slot_capacity_full' then raise;end if;end;
 update public.orders set status='cancelled' where id=b;
 perform public.staff_confirm_order(a,rev);
 -- Category limits must reject even when total budget would allow more.
 a:=pg_temp.intake('[{"sku":"chocolate-stories-standard","quantity":4}]',34);
 perform pg_temp.reject_intake('[{"sku":"chocolate-stories-standard","quantity":1}]',34,'slot_capacity_full');
 a:=pg_temp.intake('[{"sku":"gingerbread-heart-standard","quantity":8}]',35);
 perform pg_temp.reject_intake('[{"sku":"gingerbread-heart-standard","quantity":1}]',35,'slot_capacity_full');
 a:=pg_temp.intake('[{"sku":"qa-small-piece","quantity":32}]',36);
 perform pg_temp.reject_intake('[{"sku":"qa-small-piece","quantity":1}]',36,'slot_capacity_full');
 a:=pg_temp.intake('[]',37,gen_random_uuid(),'chat');
 perform pg_temp.assert((select production_load is null and reservation_expires_at is null from public.orders where id=a),'incomplete chat does not get a zero-load reservation');
 begin perform public.staff_confirm_order(a,1);raise exception 'not_rejected';exception when others then if sqlerrm not in ('Cannot confirm an empty order','production_load_required') then raise;end if;end;
 perform public.staff_assess_production(a,1,'{"cake":1}','QA: customer agreed cake',145000);
 perform public.staff_confirm_order(a,(select revision from public.orders where id=a));
 perform pg_temp.assert((select production_load=8 and status='confirmed' from public.orders where id=a),'manual chat assessment and confirmation');
 begin perform private.quote_production_cart('[{"sku":"celebration-set","quantity":1,"configuration":{}}]','ru');raise exception 'not_rejected';exception when others then if sqlerrm<>'invalid_configuration' then raise;end if;end;
end $$;
-- Real SQL roles: manager can read calendar, cannot edit rules or profiles.
select set_config('request.jwt.claim.sub',(select id::text from qa_staff where role='manager'),true);
set local role authenticated;
do $$ begin
 perform public.staff_production_day((clock_timestamp() at time zone 'Asia/Bangkok')::date+30);
 begin perform public.save_production_rules('{}',1);raise exception 'not_rejected';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.production_variant_profiles) then raise exception 'manager_saw_profiles'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.get_storefront_cart_availability(current_date,'[]','ru',repeat('a',64));raise exception 'not_rejected';exception when insufficient_privilege then null;end;
 begin perform public.receive_storefront_order(gen_random_uuid(),'chat','ru','QA','qa@example.invalid','pickup','','pickup',now()+interval '30 days',now()+interval '30 days 3 hours','','[]','[]',repeat('a',64));raise exception 'not_rejected';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: structured snapshots, mixed/builder quotes, limits, expiry, confirmation, transfer, cancellation, rules and RLS' as verification;
