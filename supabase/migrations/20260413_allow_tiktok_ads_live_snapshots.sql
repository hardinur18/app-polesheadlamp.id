alter table public.ads_live_daily_snapshots
  drop constraint if exists ads_live_daily_snapshots_platform_key_check;

alter table public.ads_live_daily_snapshots
  add constraint ads_live_daily_snapshots_platform_key_check
  check (platform_key in ('meta', 'google', 'tiktok'));
