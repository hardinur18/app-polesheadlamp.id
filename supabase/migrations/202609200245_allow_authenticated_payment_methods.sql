grant select, insert, update, delete
  on table public.payment_methods
  to authenticated, service_role;

alter table public.payment_methods enable row level security;

drop policy if exists "Authenticated access payment methods" on public.payment_methods;
create policy "Authenticated access payment methods"
  on public.payment_methods
  for all
  to authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';
