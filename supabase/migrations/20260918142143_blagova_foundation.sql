-- BLAGOVA SWEETS: database foundation. No live integrations or customer data.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create table public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.staff_members enable row level security;
revoke all on public.staff_members from public, anon, authenticated;
grant select on public.staff_members to authenticated;
grant all on public.staff_members to service_role;
create policy staff_self_read on public.staff_members for select to authenticated
using (user_id = (select auth.uid()));

-- Invoker functions query only the caller's own RLS-protected membership.
create function private.is_staff() returns boolean language sql stable security invoker
set search_path = '' as $$
  select exists(select 1 from public.staff_members where user_id = (select auth.uid()) and active);
$$;
create function private.is_owner() returns boolean language sql stable security invoker
set search_path = '' as $$
  select exists(select 1 from public.staff_members where user_id = (select auth.uid()) and active and role = 'owner');
$$;
revoke all on function private.is_staff(), private.is_owner() from public, anon;
grant execute on function private.is_staff(), private.is_owner() to authenticated, service_role;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category text not null check (category in ('cake','cupcake','gingerbread','chocolate','gift','cafe')),
  name jsonb not null check (jsonb_typeof(name) = 'object' and coalesce(length(btrim(name->>'ru')),0) > 0),
  description jsonb not null default '{}'::jsonb check (jsonb_typeof(description) = 'object'),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  is_demo boolean not null default true,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  sku text not null unique,
  name jsonb not null check (jsonb_typeof(name) = 'object'),
  price_minor integer not null check (price_minor between 0 and 100000000),
  currency text not null default 'THB' check (currency = 'THB'),
  lead_days integer not null default 2 check (lead_days between 0 and 365),
  min_quantity integer not null default 1 check (min_quantity > 0),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants(product_id);
create table public.fillings (
  id uuid primary key default gen_random_uuid(),
  name jsonb not null check (jsonb_typeof(name) = 'object'),
  description jsonb not null default '{}'::jsonb,
  allergens text[] not null default '{}',
  composition_verified boolean not null default false,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.product_fillings (
  product_id uuid not null references public.products(id) on delete cascade,
  filling_id uuid not null references public.fillings(id) on delete restrict,
  surcharge_minor integer not null default 0 check (surcharge_minor between 0 and 100000000),
  primary key(product_id, filling_id)
);
create index product_fillings_filling_idx on public.product_fillings(filling_id);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  email text,
  phone text,
  line_user_id text unique,
  locale text not null default 'ru' check (locale in ('ru','en','th')),
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete restrict,
  channel text not null check (channel in ('website','line')),
  external_id text,
  mode text not null default 'bot' check (mode in ('bot','requested','manager','closed')),
  assigned_to uuid references public.staff_members(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(channel, external_id)
);
create index conversations_customer_idx on public.conversations(customer_id);
create index conversations_assignee_idx on public.conversations(assigned_to);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  sender text not null check (sender in ('customer','assistant','manager','system')),
  body text not null check (length(btrim(body)) between 1 and 10000),
  external_id text,
  created_at timestamptz not null default now(),
  unique(conversation_id, external_id)
);
create index messages_thread_time_idx on public.messages(conversation_id, created_at, id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  conversation_id uuid references public.conversations(id) on delete restrict,
  source text not null check (source in ('website','chat','line','admin')),
  status text not null default 'pending' check (status in ('pending','confirmed','production','ready','completed','cancelled')),
  currency text not null default 'THB' check (currency = 'THB'),
  fulfillment text not null check (fulfillment in ('pickup','delivery')),
  delivery_address text,
  delivery_minor integer not null default 0 check (delivery_minor between 0 and 100000000),
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  timezone text not null default 'Asia/Bangkok' check (timezone = 'Asia/Bangkok'),
  customer_name text not null check (length(btrim(customer_name)) between 1 and 120),
  customer_contact text not null check (length(btrim(customer_contact)) between 1 and 250),
  note text not null default '' check (length(note) <= 2000),
  is_demo boolean not null default true,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end > scheduled_start),
  check (fulfillment <> 'delivery' or coalesce(length(btrim(delivery_address)),0) > 0),
  check (fulfillment <> 'pickup' or delivery_minor = 0)
);
create index orders_customer_idx on public.orders(customer_id);
create index orders_conversation_idx on public.orders(conversation_id);
create index orders_schedule_idx on public.orders(scheduled_start) where status not in ('cancelled','completed');
create index orders_status_created_idx on public.orders(status, created_at desc);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  filling_id uuid references public.fillings(id) on delete restrict,
  product_name text not null check (length(btrim(product_name)) between 1 and 250),
  variant_description text not null default '',
  quantity integer not null check (quantity between 1 and 1000),
  unit_price_minor integer not null check (unit_price_minor between 0 and 100000000),
  line_total_minor bigint generated always as (quantity::bigint * unit_price_minor) stored,
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items(order_id);
create index order_items_variant_idx on public.order_items(variant_id);
create index order_items_filling_idx on public.order_items(filling_id);
-- Order total is SUM(line_total_minor) + delivery_minor; no second mutable total.
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  revision integer not null,
  kind text not null check (kind in ('created','updated')),
  old_status text,
  new_status text not null,
  actor_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(order_id, revision)
);
create index order_events_actor_idx on public.order_events(actor_id);

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (length(btrim(title)) between 1 and 250),
  locale text not null check (locale in ('ru','en','th')),
  body text not null check (length(btrim(body)) between 1 and 100000),
  visibility text not null default 'internal' check (visibility in ('public','internal')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  version integer not null default 1 check (version > 0),
  approved_by uuid references public.staff_members(user_id) on delete restrict,
  approved_at timestamptz,
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or (approved_by is not null and approved_at is not null))
);
create index knowledge_documents_approver_idx on public.knowledge_documents(approved_by);
create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  document_version integer not null check (document_version > 0),
  position integer not null check (position >= 0),
  content text not null check (length(btrim(content)) between 1 and 20000),
  created_at timestamptz not null default now(),
  unique(document_id, document_version, position)
);
-- Embeddings and retrieval will be added after choosing the model and dimension.
create table private.integration_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  order_revision integer not null,
  provider text not null check (provider in ('google_calendar','line')),
  status text not null default 'held' check (status in ('held','queued','running','succeeded','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  external_id text,
  last_error text,
  created_at timestamptz not null default now(),
  unique(order_id, order_revision, provider)
);
create index integration_jobs_poll_idx on private.integration_jobs(status, available_at) where status in ('queued','failed');
alter table private.integration_jobs enable row level security;
revoke all on private.integration_jobs from public, anon, authenticated;
grant all on private.integration_jobs to service_role;

-- Timestamp and knowledge-version maintenance.
create function private.touch_updated_at() returns trigger language plpgsql security invoker
set search_path = '' as $$ begin new.updated_at := now(); return new; end; $$;
create function private.version_knowledge() returns trigger language plpgsql security invoker
set search_path = '' as $$
begin
  new.version := old.version;
  if (new.body, new.locale, new.title) is distinct from (old.body, old.locale, old.title) then
    new.version := old.version + 1;
    new.status := 'draft'; new.approved_by := null; new.approved_at := null;
  end if;
  return new;
end; $$;
create trigger knowledge_version before update on public.knowledge_documents
for each row execute function private.version_knowledge();

create function private.guard_order() returns trigger language plpgsql security invoker
set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then raise exception 'New orders must be pending'; end if;
    new.revision := 1;
  else
    if new.id <> old.id or new.request_key <> old.request_key or new.created_at <> old.created_at then
      raise exception 'Order identity is immutable';
    end if;
    if old.status in ('completed','cancelled') then raise exception 'Terminal order is immutable'; end if;
    if new.status <> old.status and not (
      (old.status = 'pending' and new.status in ('confirmed','cancelled')) or
      (old.status = 'confirmed' and new.status in ('production','cancelled')) or
      (old.status = 'production' and new.status in ('ready','cancelled')) or
      (old.status = 'ready' and new.status in ('completed','cancelled'))
    ) then raise exception 'Invalid order status transition'; end if;
    new.revision := old.revision + 1;
  end if;
  if new.status = 'confirmed' and not exists(select 1 from public.order_items where order_id = new.id) then
    raise exception 'Cannot confirm an empty order';
  end if;
  if new.conversation_id is not null and not exists(select 1 from public.conversations where id=new.conversation_id and customer_id=new.customer_id) then
    raise exception 'Conversation does not belong to customer';
  end if;
  new.updated_at := now(); return new;
end; $$;
create trigger guard_order before insert or update on public.orders
for each row execute function private.guard_order();
create function private.record_order_event() returns trigger language plpgsql security invoker
set search_path = '' as $$
begin
  insert into public.order_events(order_id,revision,kind,old_status,new_status,actor_id,details)
  values (new.id,new.revision,case when tg_op='INSERT' then 'created' else 'updated' end,
    case when tg_op='UPDATE' then old.status else null end,new.status,auth.uid(),
    jsonb_build_object('scheduled_start',new.scheduled_start,'scheduled_end',new.scheduled_end,'is_demo',new.is_demo));
  -- Pending applications do not reserve a production slot or trigger external delivery.
  if new.status <> 'pending' then
    insert into private.integration_jobs(order_id,order_revision,provider)
    values (new.id,new.revision,'google_calendar'),(new.id,new.revision,'line');
  end if;
  return new;
end; $$;
create trigger record_order_event after insert or update on public.orders
for each row execute function private.record_order_event();

-- No browser writes to customer data, orders, membership or integration queues.
-- A later server API must validate identity, prices and complete order transactions.
do $$ declare t text; begin
  foreach t in array array['products','product_variants','fillings','product_fillings','customers','conversations','messages','orders','order_items','order_events','knowledge_documents','knowledge_chunks'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('create policy staff_read on public.%I for select to authenticated using ((select private.is_staff()))',t);
  end loop;
  foreach t in array array['products','product_variants','fillings','product_fillings','knowledge_documents'] loop
    execute format('grant insert, update, delete on public.%I to authenticated',t);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select private.is_owner()))',t);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()))',t);
    execute format('create policy owner_delete on public.%I for delete to authenticated using ((select private.is_owner()))',t);
  end loop;
  foreach t in array array['products','product_variants','customers','conversations','knowledge_documents'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()',t);
  end loop;
end; $$;
grant select on public.products, public.product_variants, public.fillings, public.product_fillings to anon;
create policy published_products on public.products for select to anon, authenticated
using (status = 'published');
create policy published_variants on public.product_variants for select to anon, authenticated
using (active and exists(select 1 from public.products p where p.id = product_id and p.status = 'published'));
create policy verified_fillings on public.fillings for select to anon, authenticated
using (active and composition_verified);
create policy published_product_fillings on public.product_fillings for select to anon, authenticated
using (exists(select 1 from public.products p where p.id=product_id and p.status='published')
  and exists(select 1 from public.fillings f where f.id=filling_id and f.active and f.composition_verified));
revoke all on function private.touch_updated_at(), private.version_knowledge(), private.guard_order(), private.record_order_event() from public, anon, authenticated;
grant execute on function private.touch_updated_at(), private.version_knowledge(), private.guard_order(), private.record_order_event() to service_role;
