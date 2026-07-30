create table if not exists public.whatsapp_conversations (
  id text primary key,
  channel_id text not null,
  source text not null default 'webhook',
  contact_id text not null,
  entry_id text,
  object_type text,
  provider text not null default 'meta',
  contact_name text,
  contact_phone text,
  last_message_at timestamptz not null,
  last_message_text text,
  last_direction text not null,
  last_status text,
  last_has_attachment boolean not null default false,
  conversation_status text,
  unread_count integer not null default 0 check (unread_count >= 0),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_conversations_source_check check (source in ('webhook', 'api')),
  constraint whatsapp_conversations_provider_check check (provider in ('meta', 'kirimdev')),
  constraint whatsapp_conversations_direction_check check (last_direction in ('inbound', 'outbound')),
  constraint whatsapp_conversations_status_check check (
    last_status is null or last_status in ('pending', 'sent', 'delivered', 'read', 'failed')
  )
);

create table if not exists public.whatsapp_messages (
  id text not null,
  conversation_id text not null,
  channel_id text not null,
  source text not null default 'webhook',
  contact_id text not null,
  entry_id text,
  object_type text,
  provider text not null default 'meta',
  direction text not null,
  event_type text not null,
  text text,
  attachments jsonb not null default '[]'::jsonb,
  media_url text,
  status text,
  timestamp timestamptz not null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, id),
  constraint whatsapp_messages_source_check check (source in ('webhook', 'api')),
  constraint whatsapp_messages_provider_check check (provider in ('meta', 'kirimdev')),
  constraint whatsapp_messages_direction_check check (direction in ('inbound', 'outbound')),
  constraint whatsapp_messages_status_check check (
    status is null or status in ('pending', 'sent', 'delivered', 'read', 'failed')
  )
);

create table if not exists public.whatsapp_contacts (
  channel_id text not null,
  contact_key text not null,
  id text not null,
  provider text not null default 'meta',
  phone_number_id text,
  phone_number text,
  name text,
  email text,
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb,
  primary key (channel_id, contact_key),
  constraint whatsapp_contacts_provider_check check (provider in ('meta', 'kirimdev'))
);

create index if not exists whatsapp_conversations_channel_last_idx
  on public.whatsapp_conversations (channel_id, last_message_at desc);

create index if not exists whatsapp_conversations_provider_last_idx
  on public.whatsapp_conversations (provider, last_message_at desc);

create index if not exists whatsapp_conversations_contact_idx
  on public.whatsapp_conversations (channel_id, contact_id);

create index if not exists whatsapp_messages_conversation_time_idx
  on public.whatsapp_messages (conversation_id, timestamp);

create index if not exists whatsapp_messages_channel_time_idx
  on public.whatsapp_messages (channel_id, timestamp desc);

create index if not exists whatsapp_messages_direction_time_idx
  on public.whatsapp_messages (direction, timestamp desc);

create index if not exists whatsapp_contacts_channel_updated_idx
  on public.whatsapp_contacts (channel_id, updated_at desc);

create index if not exists whatsapp_contacts_phone_idx
  on public.whatsapp_contacts (phone_number);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_whatsapp_conversations_updated_at on public.whatsapp_conversations;
create trigger set_whatsapp_conversations_updated_at
  before update on public.whatsapp_conversations
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_whatsapp_messages_updated_at on public.whatsapp_messages;
create trigger set_whatsapp_messages_updated_at
  before update on public.whatsapp_messages
  for each row
  execute function public.set_updated_at();

grant select, insert, update, delete
  on public.whatsapp_conversations,
     public.whatsapp_messages,
     public.whatsapp_contacts
  to anon, authenticated, service_role;

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_contacts enable row level security;

drop policy if exists "Public access whatsapp conversations" on public.whatsapp_conversations;
create policy "Public access whatsapp conversations"
  on public.whatsapp_conversations
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);

drop policy if exists "Public access whatsapp messages" on public.whatsapp_messages;
create policy "Public access whatsapp messages"
  on public.whatsapp_messages
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);

drop policy if exists "Public access whatsapp contacts" on public.whatsapp_contacts;
create policy "Public access whatsapp contacts"
  on public.whatsapp_contacts
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whatsapp_conversations'
  ) then
    alter publication supabase_realtime add table public.whatsapp_conversations;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whatsapp_messages'
  ) then
    alter publication supabase_realtime add table public.whatsapp_messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whatsapp_contacts'
  ) then
    alter publication supabase_realtime add table public.whatsapp_contacts;
  end if;
end
$$;

comment on table public.whatsapp_conversations is 'Database-backed WhatsApp inbox conversations synced from Kirimdev or Meta webhooks.';
comment on table public.whatsapp_messages is 'Database-backed WhatsApp messages used by inbox, CS performance, and Auto WA API lead capture.';
comment on table public.whatsapp_contacts is 'Database-backed WhatsApp contacts collected from Kirimdev or Meta webhook/API data.';
