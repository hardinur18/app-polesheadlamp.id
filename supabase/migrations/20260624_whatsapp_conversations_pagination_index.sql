-- Indexes that make the WhatsApp inbox load instantly via keyset pagination.
-- Inbox query: ORDER BY last_message_at DESC, optional channel_id IN (...) and
-- date range on last_message_at, with a small LIMIT (no full-table load).

create index if not exists idx_whatsapp_conversations_last_message_at
  on public.whatsapp_conversations (last_message_at desc);

create index if not exists idx_whatsapp_conversations_channel_last_message_at
  on public.whatsapp_conversations (channel_id, last_message_at desc);

-- Partial index keeps the "unread" counter aggregate cheap.
create index if not exists idx_whatsapp_conversations_unread
  on public.whatsapp_conversations (last_message_at desc)
  where unread_count > 0;
