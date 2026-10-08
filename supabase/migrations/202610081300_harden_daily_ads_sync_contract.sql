do $$
begin
  if to_regclass('public.daily_ads') is null then
    return;
  end if;

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
      'duplicate date/ad_account_id before daily_ads unique guard',
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

  create index if not exists daily_ads_date_idx
    on public.daily_ads(date desc)
    where date is not null;

  create index if not exists daily_ads_ad_account_date_idx
    on public.daily_ads(ad_account_id, date desc)
    where ad_account_id is not null
      and date is not null;
end $$;
