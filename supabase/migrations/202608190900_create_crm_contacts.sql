create extension if not exists pgcrypto;

create or replace function public.normalize_contact_phone(raw_phone text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g');

  if digits = '' then
    return null;
  end if;

  if digits like '00%' then
    digits := regexp_replace(digits, '^00+', '');
  end if;

  if left(digits, 1) = '0' then
    return '62' || substring(digits from 2);
  end if;

  if left(digits, 1) = '8' then
    return '62' || digits;
  end if;

  return digits;
end;
$$;

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  phone_raw text,
  phone_normalized text,
  whatsapp_name text,
  email text,
  contact_type text not null default 'other',
  status text not null default 'active',
  source_module text,
  source_ref_id text,
  last_interaction_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_contacts_contact_type_check check (
    contact_type in ('prospect', 'customer', 'vendor', 'staff', 'technician', 'other')
  ),
  constraint crm_contacts_status_check check (
    status in ('active', 'archived', 'blocked')
  )
);

create unique index if not exists crm_contacts_phone_normalized_uidx
  on public.crm_contacts (phone_normalized)
  where phone_normalized is not null and phone_normalized <> '';

create index if not exists crm_contacts_display_name_idx
  on public.crm_contacts (lower(display_name));

create index if not exists crm_contacts_type_status_idx
  on public.crm_contacts (contact_type, status);

create index if not exists crm_contacts_last_interaction_idx
  on public.crm_contacts (last_interaction_at desc nulls last);

create index if not exists crm_contacts_metadata_idx
  on public.crm_contacts using gin (metadata);

create table if not exists public.crm_contact_links (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  module text not null,
  ref_id text not null,
  label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_contact_links_contact_module_ref_key unique (contact_id, module, ref_id),
  constraint crm_contact_links_module_ref_key unique (module, ref_id)
);

create index if not exists crm_contact_links_module_ref_idx
  on public.crm_contact_links (module, ref_id);

create index if not exists crm_contact_links_contact_idx
  on public.crm_contact_links (contact_id);

create or replace function public.fn_crm_contacts_before_write()
returns trigger as $$
begin
  new.phone_normalized = public.normalize_contact_phone(new.phone_raw);
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_crm_contacts_before_write on public.crm_contacts;
create trigger trg_crm_contacts_before_write
  before insert or update on public.crm_contacts
  for each row
  execute function public.fn_crm_contacts_before_write();

create or replace function public.fn_crm_contact_links_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_crm_contact_links_set_updated_at on public.crm_contact_links;
create trigger trg_crm_contact_links_set_updated_at
  before update on public.crm_contact_links
  for each row
  execute function public.fn_crm_contact_links_set_updated_at();

grant execute on function public.normalize_contact_phone(text) to anon, authenticated, service_role;

grant select, insert, update, delete
  on public.crm_contacts,
     public.crm_contact_links
  to anon, authenticated, service_role;

alter table public.crm_contacts enable row level security;
alter table public.crm_contact_links enable row level security;

drop policy if exists "Public access crm contacts" on public.crm_contacts;
create policy "Public access crm contacts"
  on public.crm_contacts
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);

drop policy if exists "Public access crm contact links" on public.crm_contact_links;
create policy "Public access crm contact links"
  on public.crm_contact_links
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'crm_contacts'
    ) then
      alter publication supabase_realtime add table public.crm_contacts;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'crm_contact_links'
    ) then
      alter publication supabase_realtime add table public.crm_contact_links;
    end if;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.whatsapp_contacts') is not null then
    insert into public.crm_contacts (
      display_name,
      phone_raw,
      phone_normalized,
      whatsapp_name,
      email,
      contact_type,
      status,
      source_module,
      source_ref_id,
      last_interaction_at,
      metadata,
      created_at,
      updated_at
    )
    select
      coalesce(nullif(deduped.name, ''), nullif(deduped.phone_number, ''), 'Kontak WhatsApp'),
      deduped.phone_number,
      deduped.phone_normalized,
      nullif(deduped.name, ''),
      nullif(deduped.email, ''),
      'prospect',
      'active',
      'live_chat',
      deduped.channel_id || ':' || deduped.contact_key,
      deduped.updated_at,
      jsonb_build_object(
        'snapshot_source', 'whatsapp_contacts',
        'channel_id', deduped.channel_id,
        'contact_key', deduped.contact_key,
        'whatsapp_contact_id', deduped.id,
        'provider', deduped.provider,
        'phone_number_id', deduped.phone_number_id,
        'raw', coalesce(deduped.raw, '{}'::jsonb)
      ),
      coalesce(deduped.created_at, now()),
      coalesce(deduped.updated_at, now())
    from (
      select distinct on (public.normalize_contact_phone(wc.phone_number))
        wc.*,
        public.normalize_contact_phone(wc.phone_number) as phone_normalized
      from public.whatsapp_contacts wc
      where public.normalize_contact_phone(wc.phone_number) is not null
      order by
        public.normalize_contact_phone(wc.phone_number),
        wc.updated_at desc nulls last,
        wc.created_at desc nulls last,
        wc.id desc
    ) deduped
    on conflict (phone_normalized)
      where phone_normalized is not null and phone_normalized <> ''
    do update set
      display_name = coalesce(nullif(excluded.display_name, ''), public.crm_contacts.display_name),
      phone_raw = coalesce(excluded.phone_raw, public.crm_contacts.phone_raw),
      whatsapp_name = coalesce(excluded.whatsapp_name, public.crm_contacts.whatsapp_name),
      email = coalesce(excluded.email, public.crm_contacts.email),
      contact_type = case
        when public.crm_contacts.contact_type = 'other' then excluded.contact_type
        else public.crm_contacts.contact_type
      end,
      source_module = coalesce(public.crm_contacts.source_module, excluded.source_module),
      source_ref_id = coalesce(public.crm_contacts.source_ref_id, excluded.source_ref_id),
      last_interaction_at = greatest(
        coalesce(public.crm_contacts.last_interaction_at, '-infinity'::timestamptz),
        coalesce(excluded.last_interaction_at, '-infinity'::timestamptz)
      ),
      metadata = public.crm_contacts.metadata || excluded.metadata,
      updated_at = now();

    insert into public.crm_contact_links (
      contact_id,
      module,
      ref_id,
      label,
      metadata
    )
    select
      cc.id,
      'live_chat',
      deduped.channel_id || ':' || deduped.contact_key,
      'WhatsApp Contact',
      jsonb_build_object(
        'channel_id', deduped.channel_id,
        'contact_key', deduped.contact_key,
        'provider', deduped.provider,
        'phone_number_id', deduped.phone_number_id
      )
    from (
      select distinct on (wc.channel_id, wc.contact_key)
        wc.*,
        public.normalize_contact_phone(wc.phone_number) as phone_normalized
      from public.whatsapp_contacts wc
      where public.normalize_contact_phone(wc.phone_number) is not null
      order by
        wc.channel_id,
        wc.contact_key,
        wc.updated_at desc nulls last,
        wc.created_at desc nulls last,
        wc.id desc
    ) deduped
    join public.crm_contacts cc
      on cc.phone_normalized = deduped.phone_normalized
    on conflict on constraint crm_contact_links_module_ref_key
    do update set
      contact_id = excluded.contact_id,
      label = excluded.label,
      metadata = public.crm_contact_links.metadata || excluded.metadata,
      updated_at = now();
  end if;
end $$;
