alter table public.ad_account_assignments
  add column if not exists notes text;

alter table public.ad_account_owner_assignments
  add column if not exists notes text;

create index if not exists ad_account_assignments_sub_channel_idx
  on public.ad_account_assignments (sub_channel_id);

create index if not exists ad_account_owner_assignments_account_status_idx
  on public.ad_account_owner_assignments (ad_account_id, status);

create index if not exists ad_account_assignments_account_status_idx
  on public.ad_account_assignments (ad_account_id, status);

comment on table public.ad_account_owner_assignments is
  'Historis advertiser owner per akun iklan. Tutup row lama dengan end_date saat akun pindah advertiser.';

comment on table public.ad_account_assignments is
  'Historis CS penanggung jawab per akun iklan. Tutup row lama dengan end_date saat akun pindah CS.';

comment on column public.ad_account_owner_assignments.notes is
  'Catatan alasan perpindahan advertiser atau konteks ownership.';

comment on column public.ad_account_assignments.notes is
  'Catatan alasan perpindahan CS atau konteks handling akun.';

notify pgrst, 'reload schema';
