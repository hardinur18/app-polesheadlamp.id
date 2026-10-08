begin;

do $$
begin
  if to_regclass('public.daily_ads') is not null then
    alter table public.daily_ads
      add column if not exists edit_count integer not null default 0;

    create table if not exists public.daily_ads_duplicate_archive (
      archived_at timestamptz not null default now(),
      archive_reason text not null,
      original_row jsonb not null
    );

    with ranked_daily_ads as (
      select
        *,
        row_number() over (
          partition by date, ad_account_id
          order by edit_count desc, created_at desc nulls last, id desc
        ) as duplicate_rank
      from public.daily_ads
      where date is not null
        and ad_account_id is not null
    ),
    archived_duplicates as (
      insert into public.daily_ads_duplicate_archive (archive_reason, original_row)
      select
        'duplicate date/ad_account_id before daily_ads sync history guard',
        to_jsonb(ranked_daily_ads) - 'duplicate_rank'
      from ranked_daily_ads
      where duplicate_rank > 1
      returning 1
    )
    delete from public.daily_ads
    using ranked_daily_ads
    where public.daily_ads.id = ranked_daily_ads.id
      and ranked_daily_ads.duplicate_rank > 1;

    create unique index if not exists daily_ads_date_ad_account_unique_idx
      on public.daily_ads(date, ad_account_id)
      where date is not null
        and ad_account_id is not null;
  end if;
end $$;

create table if not exists public.daily_ads_sync_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  run_kind text not null check (run_kind in ('preview', 'commit')),
  actor_id text,
  actor_name text,
  actor_role text,
  range_from date not null,
  range_to date not null,
  platform_id text,
  advertiser_id text,
  cs_id text,
  mode text,
  preserve_edited boolean,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  new_count integer not null default 0,
  update_count integer not null default 0,
  skipped_count integer not null default 0,
  unmapped_count integer not null default 0,
  spend numeric not null default 0,
  provider_statuses jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb
);

create index if not exists daily_ads_sync_runs_created_at_idx
  on public.daily_ads_sync_runs(created_at desc);

create index if not exists daily_ads_sync_runs_range_idx
  on public.daily_ads_sync_runs(range_from, range_to, created_at desc);

alter table public.daily_ads_sync_runs enable row level security;

grant select, insert on table public.daily_ads_sync_runs to authenticated, service_role;

drop policy if exists "Authenticated read daily ads sync runs" on public.daily_ads_sync_runs;
create policy "Authenticated read daily ads sync runs"
  on public.daily_ads_sync_runs
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated create daily ads sync runs" on public.daily_ads_sync_runs;
create policy "Authenticated create daily ads sync runs"
  on public.daily_ads_sync_runs
  for insert
  to authenticated
  with check (true);

notify pgrst, 'reload schema';

commit;
