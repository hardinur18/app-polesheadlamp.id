grant select, insert, update, delete on public.ad_account_assignments to anon, authenticated, service_role;

alter table public.ad_account_assignments enable row level security;

drop policy if exists "Public access ad account assignments" on public.ad_account_assignments;
create policy "Public access ad account assignments"
  on public.ad_account_assignments
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);
