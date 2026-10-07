do $$
begin
  if to_regclass('public.daily_ads') is null then
    return;
  end if;

  if exists (
    select 1
    from public.daily_ads
    where date is not null
      and ad_account_id is not null
    group by date, ad_account_id
    having count(*) > 1
  ) then
    raise notice 'Skipped daily_ads unique guard because duplicate date/ad_account_id rows still exist.';
    return;
  end if;

  create unique index if not exists daily_ads_date_ad_account_unique_idx
    on public.daily_ads(date, ad_account_id)
    where date is not null
      and ad_account_id is not null;
end $$;
