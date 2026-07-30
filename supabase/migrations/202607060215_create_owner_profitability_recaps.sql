begin;

create extension if not exists pgcrypto;

create table if not exists public.owner_profitability_daily_recaps (
  id uuid primary key default gen_random_uuid(),
  recap_date date not null,
  period_key text not null,
  source text not null default 'owner-dashboard',
  source_version text not null default 'v1',
  status text not null default 'snapshot',
  revenue numeric(18,2) not null default 0,
  ad_cost numeric(18,2) not null default 0,
  salary_cost numeric(18,2) not null default 0,
  operational_cost numeric(18,2) not null default 0,
  other_cost numeric(18,2) not null default 0,
  total_cost numeric(18,2) not null default 0,
  profit numeric(18,2) not null default 0,
  margin numeric(10,4),
  lead_count integer not null default 0,
  order_count integer not null default 0,
  done_count integer not null default 0,
  detail_count integer not null default 0,
  generated_by text,
  generated_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint owner_profitability_daily_recaps_period_key_chk check (period_key ~ '^\d{4}-\d{2}$'),
  constraint owner_profitability_daily_recaps_status_chk check (status in ('snapshot', 'final', 'draft'))
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'owner_profitability_daily_recaps_recap_date_key'
      and conrelid = 'public.owner_profitability_daily_recaps'::regclass
  ) then
    alter table public.owner_profitability_daily_recaps
      add constraint owner_profitability_daily_recaps_recap_date_key unique (recap_date);
  end if;
end $$;

create index if not exists owner_profitability_daily_recaps_period_idx
  on public.owner_profitability_daily_recaps(period_key, recap_date desc);

create table if not exists public.owner_profitability_daily_details (
  id uuid primary key default gen_random_uuid(),
  recap_date date not null references public.owner_profitability_daily_recaps(recap_date) on delete cascade,
  detail_key text not null,
  cs_name text not null default '',
  advertiser_name text not null default '',
  platform_key text not null default 'meta',
  platform_name text not null default '',
  sub_channel_name text not null default '',
  sub_channel_names text[] not null default '{}',
  account_name text not null default '',
  source text not null default 'operational',
  spend_dashboard numeric(18,2) not null default 0,
  spend_total numeric(18,2) not null default 0,
  leads_dash integer not null default 0,
  leads_real integer not null default 0,
  orders integer not null default 0,
  done integer not null default 0,
  cancelled integer not null default 0,
  revenue numeric(18,2) not null default 0,
  conversion_rate numeric(10,4) not null default 0,
  cpl numeric(18,2) not null default 0,
  cost_per_closing numeric(18,2) not null default 0,
  salary_cost numeric(18,2) not null default 0,
  operational_cost numeric(18,2) not null default 0,
  other_cost numeric(18,2) not null default 0,
  total_cost numeric(18,2) not null default 0,
  profit numeric(18,2) not null default 0,
  margin numeric(10,4),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint owner_profitability_daily_details_source_chk check (source in ('connected', 'operational'))
);

create unique index if not exists owner_profitability_daily_details_unique_idx
  on public.owner_profitability_daily_details(recap_date, detail_key);

create index if not exists owner_profitability_daily_details_date_idx
  on public.owner_profitability_daily_details(recap_date desc);

create or replace function public.fn_owner_profitability_set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_owner_profitability_daily_recaps_updated_at
  on public.owner_profitability_daily_recaps;
create trigger trg_owner_profitability_daily_recaps_updated_at
before update on public.owner_profitability_daily_recaps
for each row
execute function public.fn_owner_profitability_set_updated_at();

drop trigger if exists trg_owner_profitability_daily_details_updated_at
  on public.owner_profitability_daily_details;
create trigger trg_owner_profitability_daily_details_updated_at
before update on public.owner_profitability_daily_details
for each row
execute function public.fn_owner_profitability_set_updated_at();

grant select on public.owner_profitability_daily_recaps to authenticated, service_role;
grant select on public.owner_profitability_daily_details to authenticated, service_role;
grant insert, update, delete on public.owner_profitability_daily_recaps to service_role;
grant insert, update, delete on public.owner_profitability_daily_details to service_role;

alter table public.owner_profitability_daily_recaps enable row level security;
alter table public.owner_profitability_daily_details enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'owner_profitability_daily_recaps'
      and policyname = 'Authenticated read owner profitability daily recaps'
  ) then
    create policy "Authenticated read owner profitability daily recaps"
      on public.owner_profitability_daily_recaps
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'owner_profitability_daily_details'
      and policyname = 'Authenticated read owner profitability daily details'
  ) then
    create policy "Authenticated read owner profitability daily details"
      on public.owner_profitability_daily_details
      for select
      to authenticated
      using (true);
  end if;

end $$;

commit;
