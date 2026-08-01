grant select, insert, update, delete
  on table public.ad_api_accounts
  to anon, authenticated, service_role;

grant select, insert, update, delete
  on table public.ad_account_api_mappings
  to anon, authenticated, service_role;

alter table public.ad_api_accounts enable row level security;
alter table public.ad_account_api_mappings enable row level security;

drop policy if exists "Public access ad api accounts" on public.ad_api_accounts;
create policy "Public access ad api accounts"
  on public.ad_api_accounts
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);

drop policy if exists "Public access ad account api mappings" on public.ad_account_api_mappings;
create policy "Public access ad account api mappings"
  on public.ad_account_api_mappings
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);

notify pgrst, 'reload schema';
