create table private.storefront_chat_sessions (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  locale text not null default 'ru' check (locale in ('ru','en','th')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create table private.storefront_chat_limits (
  rate_key text primary key check (length(rate_key) between 32 and 160),
  window_started_at timestamptz not null default now(),
  message_count integer not null default 0 check (message_count >= 0)
);

alter table private.storefront_chat_sessions enable row level security;
alter table private.storefront_chat_limits enable row level security;
revoke all on private.storefront_chat_sessions, private.storefront_chat_limits from public, anon, authenticated;
grant all on private.storefront_chat_sessions, private.storefront_chat_limits to service_role;
create policy service_role_chat_sessions on private.storefront_chat_sessions for all to service_role using (true) with check (true);
create policy service_role_chat_limits on private.storefront_chat_limits for all to service_role using (true) with check (true);

alter table public.messages add column source text check (source is null or length(source) <= 250);
alter table public.messages drop constraint messages_sender_check;
alter table public.messages add constraint messages_sender_check check (sender in ('customer','assistant','manager','owner','system'));

create or replace function private.staff_conversation_action(p_conversation_id uuid,p_action text,p_body text default null,p_message_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  thread public.conversations;
  v_sender text;
begin
  select role into v_sender from public.staff_members where user_id=auth.uid() and active and role in ('owner','manager');
  if auth.uid() is null or v_sender is null then raise exception 'Staff access required' using errcode='42501'; end if;
  select * into thread from public.conversations where id=p_conversation_id for update;
  if not found then raise exception 'Conversation not found'; end if;
  if thread.channel <> 'website' then raise exception 'LINE is not connected'; end if;
  if thread.mode='closed' then raise exception 'Conversation closed'; end if;
  if thread.assigned_to is not null and thread.assigned_to <> auth.uid() then raise exception 'Another staff member owns this conversation'; end if;
  if p_action='take' then
    update public.conversations set mode='manager',assigned_to=auth.uid() where id=p_conversation_id;
  elsif p_action='release' then
    update public.conversations set mode='bot',assigned_to=null where id=p_conversation_id;
  elsif p_action='reply' then
    if thread.mode <> 'manager' or thread.assigned_to is distinct from auth.uid() then raise exception 'Take conversation first'; end if;
    if p_body is null or length(btrim(p_body)) not between 1 and 5000 or p_message_id is null then raise exception 'Invalid reply'; end if;
    if exists(select 1 from public.messages where id=p_message_id) then
      if exists(select 1 from public.messages where id=p_message_id and conversation_id=p_conversation_id and sender=v_sender and body=btrim(p_body)) then return; end if;
      raise exception 'Message id conflict';
    end if;
    insert into public.messages(id,conversation_id,sender,body) values(p_message_id,p_conversation_id,v_sender,btrim(p_body));
    update public.conversations set updated_at=now() where id=p_conversation_id;
  else raise exception 'Unsupported action'; end if;
end; $$;

create function public.storefront_chat_action(
  p_action text,
  p_token_hash text,
  p_locale text default 'ru',
  p_rate_key text default null,
  p_customer_message_id uuid default null,
  p_customer_body text default null,
  p_assistant_message_id uuid default null,
  p_assistant_body text default null,
  p_assistant_source text default null,
  p_request_manager boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_conversation_id uuid;
  v_mode text;
  v_count integer;
  v_messages jsonb;
begin
  if p_action not in ('start','poll','send') or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_request';
  end if;
  if p_locale not in ('ru','en','th') then raise exception 'invalid_locale'; end if;

  select s.conversation_id into v_conversation_id
  from private.storefront_chat_sessions s
  where s.token_hash=p_token_hash and s.expires_at > now();

  if v_conversation_id is null then
    if p_action <> 'start' then raise exception 'chat_session_missing'; end if;
    insert into public.conversations(channel,external_id,mode)
    values ('website','chat:' || substr(p_token_hash,1,32),'bot')
    returning id into v_conversation_id;
    insert into private.storefront_chat_sessions(conversation_id,token_hash,locale)
    values (v_conversation_id,p_token_hash,p_locale);
  else
    update private.storefront_chat_sessions
    set last_seen_at=now(),expires_at=now()+interval '30 days',locale=p_locale
    where conversation_id=v_conversation_id;
  end if;

  if p_action='send' then
    if p_rate_key is null or length(p_rate_key) not between 32 and 160 then raise exception 'invalid_rate_key'; end if;
    insert into private.storefront_chat_limits(rate_key,window_started_at,message_count)
    values (p_rate_key,now(),1)
    on conflict (rate_key) do update set
      window_started_at=case when private.storefront_chat_limits.window_started_at < now()-interval '1 hour' then now() else private.storefront_chat_limits.window_started_at end,
      message_count=case when private.storefront_chat_limits.window_started_at < now()-interval '1 hour' then 1 else private.storefront_chat_limits.message_count+1 end
    returning message_count into v_count;
    if v_count > 60 then raise exception 'rate_limit'; end if;

    select mode into v_mode from public.conversations where id=v_conversation_id for update;
    if v_mode='closed' then raise exception 'conversation_closed'; end if;

    if p_customer_body is not null then
      if p_customer_message_id is null or length(btrim(p_customer_body)) not between 1 and 2500 then raise exception 'invalid_customer_message'; end if;
      insert into public.messages(id,conversation_id,sender,body)
      values (p_customer_message_id,v_conversation_id,'customer',btrim(p_customer_body))
      on conflict (id) do nothing;
    end if;

    if p_assistant_body is not null and v_mode='bot' then
      if p_assistant_message_id is null or length(btrim(p_assistant_body)) not between 1 and 2500 then raise exception 'invalid_assistant_message'; end if;
      insert into public.messages(id,conversation_id,sender,body,source)
      values (p_assistant_message_id,v_conversation_id,'assistant',btrim(p_assistant_body),nullif(btrim(p_assistant_source),''))
      on conflict (id) do nothing;
    end if;

    if p_request_manager and v_mode='bot' then
      update public.conversations set mode='requested',updated_at=now() where id=v_conversation_id;
    else
      update public.conversations set updated_at=now() where id=v_conversation_id;
    end if;
  end if;

  select c.mode into v_mode from public.conversations c where c.id=v_conversation_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'role',case when m.sender='system' then 'assistant' else m.sender end,
    'text',m.body,'at',m.created_at,'source',m.source
  ) order by m.created_at,m.id),'[]'::jsonb)
  into v_messages
  from (
    select id,sender,body,created_at,source
    from public.messages where conversation_id=v_conversation_id
    order by created_at desc,id desc limit 100
  ) m;

  delete from private.storefront_chat_limits where window_started_at < now()-interval '1 day';
  return jsonb_build_object('conversationId',v_conversation_id,'mode',v_mode,'messages',v_messages);
end;
$$;

create function public.attach_storefront_order_chat(p_order_id uuid,p_token_hash text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare v_conversation_id uuid;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_token'; end if;
  select conversation_id into v_conversation_id from private.storefront_chat_sessions
  where token_hash=p_token_hash and expires_at > now();
  if v_conversation_id is null then raise exception 'chat_session_missing'; end if;
  update public.orders set conversation_id=v_conversation_id where id=p_order_id;
  if not found then raise exception 'order_not_found'; end if;
end;
$$;

revoke all on function public.storefront_chat_action(text,text,text,text,uuid,text,uuid,text,text,boolean), public.attach_storefront_order_chat(uuid,text) from public,anon,authenticated;
grant execute on function public.storefront_chat_action(text,text,text,text,uuid,text,uuid,text,text,boolean), public.attach_storefront_order_chat(uuid,text) to service_role;
