grant select, insert, update, delete
  on table public.audit_logs
  to authenticated, service_role;

grant select, insert, update, delete
  on table public.manual_debts
  to authenticated, service_role;

grant select, insert, update, delete
  on table public.permissions
  to authenticated, service_role;

grant select, insert, update, delete
  on table public.recurring_expense_payments
  to authenticated, service_role;

grant select, insert, update, delete
  on table public.role_permissions
  to authenticated, service_role;

grant select, insert, update, delete
  on table public.vendors
  to authenticated, service_role;

alter table public.audit_logs enable row level security;
alter table public.manual_debts enable row level security;
alter table public.permissions enable row level security;
alter table public.recurring_expense_payments enable row level security;
alter table public.role_permissions enable row level security;
alter table public.vendors enable row level security;

drop policy if exists "Authenticated manage audit logs" on public.audit_logs;
create policy "Authenticated manage audit logs"
  on public.audit_logs
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated manage manual debts" on public.manual_debts;
create policy "Authenticated manage manual debts"
  on public.manual_debts
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated manage permissions" on public.permissions;
create policy "Authenticated manage permissions"
  on public.permissions
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated manage recurring expense payments" on public.recurring_expense_payments;
create policy "Authenticated manage recurring expense payments"
  on public.recurring_expense_payments
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated manage role permissions" on public.role_permissions;
create policy "Authenticated manage role permissions"
  on public.role_permissions
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated manage vendors" on public.vendors;
create policy "Authenticated manage vendors"
  on public.vendors
  for all
  to authenticated
  using (true)
  with check (true);
