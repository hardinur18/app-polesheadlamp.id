create index if not exists whatsapp_messages_conversation_timestamp_desc_idx
  on public.whatsapp_messages (conversation_id, timestamp desc);

create index if not exists whatsapp_messages_conversation_event_timestamp_idx
  on public.whatsapp_messages (conversation_id, event_type, timestamp desc);

create index if not exists whatsapp_conversations_channel_status_last_idx
  on public.whatsapp_conversations (channel_id, conversation_status, last_message_at desc);

create or replace function public.get_whatsapp_message_counts(p_conversation_ids text[])
returns table(conversation_id text, message_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    wm.conversation_id,
    count(*)::bigint as message_count
  from public.whatsapp_messages wm
  where wm.conversation_id = any(p_conversation_ids)
    and coalesce(wm.event_type, '') not like 'whatsapp_status_%'
  group by wm.conversation_id;
$$;

grant execute on function public.get_whatsapp_message_counts(text[])
  to anon, authenticated, service_role;

comment on function public.get_whatsapp_message_counts(text[]) is
  'Fast aggregate used by WhatsApp overview so the API does not need to read full message rows just to display per-conversation counts.';
