create table if not exists public.lead_spam_daily_inputs (
  id text primary key,
  input_date date not null,
  cs_id text not null,
  platform_id text not null,
  advertiser_id text not null,
  spam_count integer not null default 0 check (spam_count >= 0),
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_spam_daily_inputs_scope_unique unique (input_date, cs_id, platform_id, advertiser_id)
);

create index if not exists lead_spam_daily_inputs_date_idx
  on public.lead_spam_daily_inputs (input_date);

create index if not exists lead_spam_daily_inputs_cs_idx
  on public.lead_spam_daily_inputs (cs_id);

create index if not exists lead_spam_daily_inputs_platform_idx
  on public.lead_spam_daily_inputs (platform_id);

create index if not exists lead_spam_daily_inputs_advertiser_idx
  on public.lead_spam_daily_inputs (advertiser_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_lead_spam_daily_inputs_updated_at on public.lead_spam_daily_inputs;
create trigger set_lead_spam_daily_inputs_updated_at
  before update on public.lead_spam_daily_inputs
  for each row
  execute function public.set_updated_at();

grant select, insert, update, delete on public.lead_spam_daily_inputs to anon, authenticated, service_role;

alter table public.lead_spam_daily_inputs enable row level security;

drop policy if exists "Public access lead spam daily inputs" on public.lead_spam_daily_inputs;
create policy "Public access lead spam daily inputs"
  on public.lead_spam_daily_inputs
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
      and tablename = 'lead_spam_daily_inputs'
  ) then
    alter publication supabase_realtime add table public.lead_spam_daily_inputs;
  end if;
end
$$;
