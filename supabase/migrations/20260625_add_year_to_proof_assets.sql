alter table if exists public.proof_assets
  add column if not exists year integer;

alter table if exists public.proof_assets
  drop constraint if exists proof_assets_year_check;

alter table if exists public.proof_assets
  add constraint proof_assets_year_check
  check (year is null or (year >= 1900 and year <= 2100));

comment on column public.proof_assets.year is 'Vehicle production year for the proof asset.';
