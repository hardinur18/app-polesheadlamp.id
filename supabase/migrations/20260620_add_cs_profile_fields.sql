-- Adds CS profile metadata used by the user CRUD and future chat performance tracking.

alter table if exists public.profiles
  add column if not exists join_date date,
  add column if not exists bank_name text,
  add column if not exists bank_account_number text,
  add column if not exists emergency_phone text,
  add column if not exists cs_whatsapp_number text,
  add column if not exists cs_display_name text,
  add column if not exists cs_assignment_status text not null default 'available',
  add column if not exists cs_max_active_chats integer not null default 25,
  add column if not exists cs_notes text;

alter table if exists public.profiles
  drop constraint if exists profiles_cs_assignment_status_check;

alter table if exists public.profiles
  add constraint profiles_cs_assignment_status_check
  check (cs_assignment_status in ('available', 'busy', 'offline'));

alter table if exists public.profiles
  drop constraint if exists profiles_cs_max_active_chats_check;

alter table if exists public.profiles
  add constraint profiles_cs_max_active_chats_check
  check (cs_max_active_chats between 0 and 500);

comment on column public.profiles.cs_whatsapp_number is
  'Office WhatsApp number assigned to a CS user for shared inbox handling.';

comment on column public.profiles.cs_assignment_status is
  'CS chat assignment state: available, busy, or offline.';

comment on column public.profiles.cs_max_active_chats is
  'Maximum active conversations that can be assigned to this CS user.';
