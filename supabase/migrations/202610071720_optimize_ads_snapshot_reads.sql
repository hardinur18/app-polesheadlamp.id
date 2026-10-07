create index if not exists ads_live_daily_snapshots_platform_account_date_updated_idx
  on public.ads_live_daily_snapshots(platform_key, external_account_id, snapshot_date desc, updated_at desc);

create index if not exists ads_live_daily_snapshots_platform_group_date_account_idx
  on public.ads_live_daily_snapshots(platform_key, external_group_id, snapshot_date desc, external_account_id)
  where external_group_id is not null;

create index if not exists ads_live_daily_snapshots_platform_synced_at_idx
  on public.ads_live_daily_snapshots(platform_key, synced_at desc, snapshot_date desc);
