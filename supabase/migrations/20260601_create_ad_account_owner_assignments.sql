create table if not exists public.ad_account_owner_assignments (
  id uuid primary key default gen_random_uuid(),
  ad_account_id text not null,
  advertiser_id text not null,
  start_date date not null,
  end_date date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_account_owner_assignments_date_range check (end_date is null or end_date >= start_date)
);

create index if not exists ad_account_owner_assignments_account_date_idx
  on public.ad_account_owner_assignments (ad_account_id, start_date, end_date);

create index if not exists ad_account_owner_assignments_advertiser_idx
  on public.ad_account_owner_assignments (advertiser_id);

create index if not exists ad_account_owner_assignments_active_idx
  on public.ad_account_owner_assignments (ad_account_id)
  where status = 'active' and end_date is null;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_ad_account_owner_assignments_updated_at on public.ad_account_owner_assignments;
create trigger set_ad_account_owner_assignments_updated_at
  before update on public.ad_account_owner_assignments
  for each row
  execute function public.set_updated_at();

grant select, insert, update, delete on public.ad_account_owner_assignments to anon, authenticated, service_role;

alter table public.ad_account_owner_assignments enable row level security;

drop policy if exists "Public access ad account owner assignments" on public.ad_account_owner_assignments;
create policy "Public access ad account owner assignments"
  on public.ad_account_owner_assignments
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);
