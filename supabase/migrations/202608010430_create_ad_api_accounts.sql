create extension if not exists pgcrypto;

create table if not exists public.ad_api_accounts (
  id uuid primary key default gen_random_uuid(),
  platform_key text not null,
  external_account_id text not null,
  external_account_name text not null,
  external_group_id text,
  external_group_name text,
  external_account_status text,
  currency_code text,
  raw jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint ad_api_accounts_platform_key_check
    check (platform_key in ('meta', 'google', 'tiktok')),
  constraint ad_api_accounts_unique_external
    unique (platform_key, external_account_id)
);

create index if not exists ad_api_accounts_platform_idx
  on public.ad_api_accounts(platform_key, external_account_name);

create table if not exists public.ad_account_api_mappings (
  id uuid primary key default gen_random_uuid(),
  internal_ad_account_id text not null,
  api_account_id uuid references public.ad_api_accounts(id) on delete cascade,
  platform_key text not null,
  external_account_id text not null,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint ad_account_api_mappings_platform_key_check
    check (platform_key in ('meta', 'google', 'tiktok')),
  constraint ad_account_api_mappings_status_check
    check (status in ('active', 'inactive'))
);

create unique index if not exists ad_account_api_mappings_one_active_internal_idx
  on public.ad_account_api_mappings(internal_ad_account_id)
  where status = 'active';

create unique index if not exists ad_account_api_mappings_one_active_external_idx
  on public.ad_account_api_mappings(platform_key, external_account_id)
  where status = 'active';

create index if not exists ad_account_api_mappings_api_account_idx
  on public.ad_account_api_mappings(api_account_id);

grant select, insert, update, delete
  on table public.ad_api_accounts
  to authenticated, service_role;

grant select, insert, update, delete
  on table public.ad_account_api_mappings
  to authenticated, service_role;

alter table public.ad_api_accounts enable row level security;
alter table public.ad_account_api_mappings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ad_api_accounts'
      and policyname = 'Authenticated manage ad api accounts'
  ) then
    create policy "Authenticated manage ad api accounts"
      on public.ad_api_accounts
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ad_account_api_mappings'
      and policyname = 'Authenticated manage ad account api mappings'
  ) then
    create policy "Authenticated manage ad account api mappings"
      on public.ad_account_api_mappings
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end
$$;

comment on table public.ad_api_accounts is
  'Registry akun iklan live dari Meta, Google Ads, dan TikTok Ads hasil sync API.';

comment on table public.ad_account_api_mappings is
  'Pairing aktif antara master ad_accounts internal dan akun live API Ads.';
