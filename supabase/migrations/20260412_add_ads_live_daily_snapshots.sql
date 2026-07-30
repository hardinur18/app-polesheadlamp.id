create extension if not exists pgcrypto;

create table if not exists public.ads_live_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  platform_key text not null,
  snapshot_date date not null,
  internal_ad_account_id text,
  advertiser_id text,
  platform_id text,
  external_account_id text not null,
  external_account_name text not null,
  external_group_id text,
  external_group_name text,
  external_account_status text,
  currency_code text,
  spend numeric(18,2) not null default 0,
  clicks bigint not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  conversions numeric(18,2) not null default 0,
  ctr numeric(18,4),
  cpc numeric(18,4),
  cpm numeric(18,4),
  cost_per_conversion numeric(18,4),
  error text,
  synced_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint ads_live_daily_snapshots_platform_key_check
    check (platform_key in ('meta', 'google'))
);

create unique index if not exists ads_live_daily_snapshots_unique_provider_day_account_idx
  on public.ads_live_daily_snapshots(platform_key, snapshot_date, external_account_id);

create index if not exists ads_live_daily_snapshots_platform_date_idx
  on public.ads_live_daily_snapshots(platform_key, snapshot_date desc);

create index if not exists ads_live_daily_snapshots_internal_account_idx
  on public.ads_live_daily_snapshots(internal_ad_account_id, snapshot_date desc);

create index if not exists ads_live_daily_snapshots_group_idx
  on public.ads_live_daily_snapshots(external_group_id, snapshot_date desc);

grant select
  on table public.ads_live_daily_snapshots
  to authenticated, service_role;

grant insert, update, delete
  on table public.ads_live_daily_snapshots
  to service_role;

alter table public.ads_live_daily_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ads_live_daily_snapshots'
      and policyname = 'Authenticated read ads live daily snapshots'
  ) then
    create policy "Authenticated read ads live daily snapshots"
      on public.ads_live_daily_snapshots
      for select
      to authenticated
      using (true);
  end if;
end
$$;
