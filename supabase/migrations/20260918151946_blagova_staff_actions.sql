-- Narrow API: public invoker wrappers, private definer implementations.
create function private.staff_order_action(p_order_id uuid, p_revision integer, p_action text, p_status text default null, p_start timestamptz default null, p_end timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
declare current_order public.orders;
begin
  if auth.uid() is null or not exists(select 1 from public.staff_members where user_id=auth.uid() and active and role in ('owner','manager')) then raise exception 'Staff access required' using errcode='42501'; end if;
  select * into current_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if current_order.revision <> p_revision then raise exception 'Order changed; refresh before retrying' using errcode='40001'; end if;
  if p_action = 'status' then
    update public.orders set status=p_status where id=p_order_id;
  elsif p_action = 'reschedule' then
    if p_start is null or p_end is null or p_start <= now() or p_end <= p_start or p_end > p_start + interval '12 hours' then raise exception 'Invalid schedule'; end if;
    update public.orders set scheduled_start=p_start, scheduled_end=p_end where id=p_order_id;
  else raise exception 'Unsupported action'; end if;
end; $$;
create function public.staff_order_action(p_order_id uuid, p_revision integer, p_action text, p_status text default null, p_start timestamptz default null, p_end timestamptz default null)
returns void language sql security invoker set search_path = '' as $$
select private.staff_order_action(p_order_id,p_revision,p_action,p_status,p_start,p_end);
$$;
revoke all on function private.staff_order_action(uuid,integer,text,text,timestamptz,timestamptz), public.staff_order_action(uuid,integer,text,text,timestamptz,timestamptz) from public, anon;
grant execute on function private.staff_order_action(uuid,integer,text,text,timestamptz,timestamptz), public.staff_order_action(uuid,integer,text,text,timestamptz,timestamptz) to authenticated;

create function private.staff_conversation_action(p_conversation_id uuid,p_action text,p_body text default null,p_message_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare thread public.conversations;
begin
  if auth.uid() is null or not exists(select 1 from public.staff_members where user_id=auth.uid() and active and role in ('owner','manager')) then raise exception 'Staff access required' using errcode='42501'; end if;
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
      if exists(select 1 from public.messages where id=p_message_id and conversation_id=p_conversation_id and sender='manager' and body=btrim(p_body)) then return; end if;
      raise exception 'Message id conflict';
    end if;
    insert into public.messages(id,conversation_id,sender,body) values(p_message_id,p_conversation_id,'manager',btrim(p_body));
    update public.conversations set updated_at=now() where id=p_conversation_id;
  else raise exception 'Unsupported action'; end if;
end; $$;
create function public.staff_conversation_action(p_conversation_id uuid,p_action text,p_body text default null,p_message_id uuid default null)
returns void language sql security invoker set search_path = '' as $$
select private.staff_conversation_action(p_conversation_id,p_action,p_body,p_message_id);
$$;
revoke all on function private.staff_conversation_action(uuid,text,text,uuid), public.staff_conversation_action(uuid,text,text,uuid) from public,anon;
grant execute on function private.staff_conversation_action(uuid,text,text,uuid), public.staff_conversation_action(uuid,text,text,uuid) to authenticated;

