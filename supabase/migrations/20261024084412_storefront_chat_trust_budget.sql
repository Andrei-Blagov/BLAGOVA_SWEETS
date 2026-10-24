-- A3: deterministic server handoff only. This is not published knowledge retrieval.
-- All budgets are DB-wide across Edge instances and survive token/header rotation.
alter table public.messages add column assistant_policy text
  check (assistant_policy is null or assistant_policy = 'handoff-v1');
-- Timestamp precision can tie (including within one transaction). Stable insert
-- order prevents a random assistant UUID from sorting before its customer.
alter table public.messages add column chat_sequence bigint generated always as identity;
grant usage on sequence public.messages_chat_sequence_seq to service_role;

create function private.consume_chat_budget(p_key text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_count integer; v_now timestamptz:=clock_timestamp();
begin
  insert into private.storefront_chat_limits(rate_key,window_started_at,message_count)
  values(p_key,v_now,1)
  on conflict(rate_key) do update set
    window_started_at=case when private.storefront_chat_limits.window_started_at <= v_now-make_interval(secs=>p_seconds) then v_now else private.storefront_chat_limits.window_started_at end,
    message_count=case when private.storefront_chat_limits.window_started_at <= v_now-make_interval(secs=>p_seconds) then 1 else least(private.storefront_chat_limits.message_count+1,p_limit+1) end
  returning message_count into v_count;
  return v_count<=p_limit;
end; $$;
revoke all on function private.consume_chat_budget(text,integer,integer) from public,anon,authenticated;
grant execute on function private.consume_chat_budget(text,integer,integer) to service_role;

-- Remove the obsolete API so neither the gateway nor a service caller can use
-- the old assistant body/source arguments. Applied migrations remain untouched.
drop function public.storefront_chat_action(text,text,text,text,uuid,text,uuid,text,text,boolean);
create function public.storefront_chat_action(
  p_action text,p_token_hash text,p_locale text default 'ru',
  p_customer_message_id uuid default null,p_customer_body text default null,
  p_request_manager boolean default false
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_session private.storefront_chat_sessions;
  v_conversation_id uuid; v_mode text; v_messages jsonb;
  v_body text:=btrim(coalesce(p_customer_body,''));
  v_handoff boolean; v_reply text; v_global_limit integer;
begin
  if p_action is null or p_action not in ('start','poll','send') or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_locale is null or p_locale not in ('ru','en','th') or p_request_manager is null
    then return jsonb_build_object('error','invalid_request'); end if;
  if p_action='send' and (p_customer_message_id is null or length(v_body)>2500 or (v_body='' and not p_request_manager))
    then return jsonb_build_object('error','invalid_request'); end if;
  if p_action<>'send' and (p_customer_message_id is not null or p_customer_body is not null or p_request_manager)
    then return jsonb_build_object('error','invalid_request'); end if;

  v_global_limit:=case p_action when 'start' then 60 when 'poll' then 1200 else 240 end;
  if not private.consume_chat_budget('chat-global-v1-'||p_action||repeat('_',32),v_global_limit,60)
    then return jsonb_build_object('error','rate_limit','retryAfterSeconds',60); end if;
  -- The global charge commits even for unknown/closed sessions or conflicts.
  -- Returning an error value (rather than raising) prevents rollback of budgets.
  perform pg_advisory_xact_lock(hashtextextended('chat:'||p_token_hash,0));
  select * into v_session from private.storefront_chat_sessions where token_hash=p_token_hash;
  if found and v_session.expires_at<=clock_timestamp() then return jsonb_build_object('error','session_expired'); end if;
  if v_session.conversation_id is null and p_action<>'start' then return jsonb_build_object('error','session_expired'); end if;
  if not private.consume_chat_budget('chat-token-'||p_action||'-'||p_token_hash,
      case p_action when 'start' then 6 when 'poll' then 30 else 60 end,
      case p_action when 'send' then 3600 else 60 end)
    then return jsonb_build_object('error','rate_limit','retryAfterSeconds',case p_action when 'send' then 3600 else 60 end); end if;

  v_conversation_id:=v_session.conversation_id;
  if v_conversation_id is null then
    insert into public.conversations(channel,external_id,mode)
    values('website','chat:'||substr(p_token_hash,1,32),'bot') returning id into v_conversation_id;
    insert into private.storefront_chat_sessions(conversation_id,token_hash,locale) values(v_conversation_id,p_token_hash,p_locale);
    -- Bounded housekeeping only on session creation, never on every poll.
    delete from private.storefront_chat_limits where rate_key in
      (select rate_key from private.storefront_chat_limits where window_started_at<clock_timestamp()-interval '2 days' limit 200);
  else
    update private.storefront_chat_sessions set last_seen_at=clock_timestamp(),expires_at=clock_timestamp()+interval '30 days',locale=p_locale where conversation_id=v_conversation_id;
  end if;

  if p_action='send' then
    select mode into v_mode from public.conversations where id=v_conversation_id for update;
    if v_mode='closed' then return jsonb_build_object('error','conversation_closed'); end if;
    v_handoff:=p_request_manager or v_body ~* 'менеджер|человек|manager|human|พนักงาน|ผู้จัดการ';
    if v_body='' then v_body:=case p_locale when 'en' then 'Please invite a manager.' when 'th' then 'กรุณาเชิญผู้จัดการ' else 'Пригласите менеджера.' end; end if;
    if exists(select 1 from public.messages where id=p_customer_message_id) then
      if not exists(select 1 from public.messages where id=p_customer_message_id and conversation_id=v_conversation_id and sender='customer' and body=v_body)
        then return jsonb_build_object('error','message_conflict'); end if;
      -- Same customer message replay: no second assistant reply or handoff.
    else
      insert into public.messages(id,conversation_id,sender,body,created_at)
      values(p_customer_message_id,v_conversation_id,'customer',v_body,clock_timestamp());
      if v_mode='bot' then
        v_reply:=case when v_handoff then
          case p_locale when 'en' then 'Your request has been sent to a manager. The reply will appear here when a team member joins.'
            when 'th' then 'ส่งคำขอถึงผู้จัดการแล้ว คำตอบจะแสดงที่นี่เมื่อพนักงานเข้าร่วม'
            else 'Запрос передан менеджеру. Ответ появится здесь, когда сотрудник подключится к диалогу.' end
          else case p_locale when 'en' then 'An approved knowledge answer is not available yet. Use Build an order or invite a manager.'
            when 'th' then 'ยังไม่มีคำตอบจากข้อมูลที่ยืนยันแล้ว กรุณาเลือกสร้างคำสั่งซื้อหรือเชิญผู้จัดการ'
            else 'Утверждённый ответ из базы знаний пока недоступен. Нажмите «Собрать заказ» или пригласите менеджера.' end end;
        insert into public.messages(conversation_id,sender,body,assistant_policy,created_at)
        values(v_conversation_id,'assistant',v_reply,'handoff-v1',clock_timestamp());
      end if;
      update public.conversations set mode=case when v_handoff and v_mode='bot' then 'requested' else mode end,updated_at=clock_timestamp() where id=v_conversation_id;
    end if;
  end if;
  select mode into v_mode from public.conversations where id=v_conversation_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'role',case when m.sender='system' then 'assistant' else m.sender end,
    'text',m.body,'at',m.created_at,'source',case when m.sender in ('assistant','system') then null else m.source end,
    'unverified',m.sender in ('assistant','system') and m.assistant_policy is null) order by m.created_at,m.chat_sequence),'[]'::jsonb)
    into v_messages from (select id,sender,body,created_at,source,assistant_policy,chat_sequence from public.messages where conversation_id=v_conversation_id order by created_at desc,chat_sequence desc limit 100) m;
  return jsonb_build_object('conversationId',v_conversation_id,'mode',v_mode,'messages',v_messages);
end; $$;
revoke all on function public.storefront_chat_action(text,text,text,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.storefront_chat_action(text,text,text,uuid,text,boolean) to service_role;

-- Close the alternative public intake import path as well. Preserve the A2
-- implementation privately (including price/capacity/outbox), with a narrow
-- service-only public facade. Browser submissions may not import chat history.
alter function public.submit_storefront_intent(uuid,text,jsonb,text) set schema private;
create function public.submit_storefront_intent(p_request_key uuid,p_token_hash text,p_payload jsonb,p_rate_key text)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  if p_payload ? 'messages' and p_payload->'messages' is distinct from '[]'::jsonb
    then raise exception 'client_chat_history_forbidden'; end if;
  return private.submit_storefront_intent(p_request_key,p_token_hash,p_payload,p_rate_key);
end; $$;
revoke all on function public.submit_storefront_intent(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.submit_storefront_intent(uuid,text,jsonb,text) to service_role;
