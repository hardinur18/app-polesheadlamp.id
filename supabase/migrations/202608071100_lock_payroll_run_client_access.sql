-- Payroll period snapshots are managed through the payroll Edge Function.
-- This keeps view-only roles safe and prevents browser-side writes to posted payroll archives.

alter table public.payroll_runs enable row level security;
alter table public.payroll_run_items enable row level security;

drop policy if exists "Payroll runs readable" on public.payroll_runs;
drop policy if exists "Payroll runs manageable" on public.payroll_runs;
drop policy if exists "Payroll run items readable" on public.payroll_run_items;
drop policy if exists "Payroll run items manageable" on public.payroll_run_items;

revoke all on table public.payroll_runs from anon, authenticated;
revoke all on table public.payroll_run_items from anon, authenticated;

grant select, insert, update, delete on public.payroll_runs to service_role;
grant select, insert, update, delete on public.payroll_run_items to service_role;

notify pgrst, 'reload schema';
