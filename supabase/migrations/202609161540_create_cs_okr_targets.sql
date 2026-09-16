-- Stores monthly CS OKR targets in a relational table instead of a single KV JSON payload.
-- The app reads/writes this table through the make-server API so permission checks stay centralized.

create table if not exists public.cs_okr_targets (
  id uuid primary key default gen_random_uuid(),
  month_key text not null,
  cs_id uuid not null,
  platform_id text,
  leads_target integer not null default 0,
  order_target integer not null default 0,
  revenue_target numeric(14, 0) not null default 0,
  conversion_target_percent numeric(5, 2) not null default 20,
  response_target_seconds integer not null default 600,
  sla_target_percent numeric(5, 2) not null default 85,
  spam_target_percent numeric(5, 2) not null default 10,
  notes text not null default '',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cs_okr_targets_month_key_check check (month_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  constraint cs_okr_targets_numbers_check check (
    leads_target >= 0
    and order_target >= 0
    and revenue_target >= 0
    and conversion_target_percent between 0 and 100
    and response_target_seconds between 1 and 86400
    and sla_target_percent between 0 and 100
    and spam_target_percent between 0 and 100
  )
);

create unique index if not exists cs_okr_targets_scope_unique
  on public.cs_okr_targets (month_key, cs_id, coalesce(platform_id, '__all__'));

create index if not exists cs_okr_targets_month_idx
  on public.cs_okr_targets (month_key);

create index if not exists cs_okr_targets_cs_idx
  on public.cs_okr_targets (cs_id);

alter table public.cs_okr_targets enable row level security;

revoke all on public.cs_okr_targets from anon, authenticated;
grant select, insert, update, delete on public.cs_okr_targets to service_role;

drop policy if exists "Service role manages CS OKR targets" on public.cs_okr_targets;
create policy "Service role manages CS OKR targets"
  on public.cs_okr_targets
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.cs_okr_targets is
  'Monthly CS OKR target definitions by CS and optional ad platform.';
