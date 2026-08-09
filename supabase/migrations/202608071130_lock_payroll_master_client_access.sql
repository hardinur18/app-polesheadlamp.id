-- Payroll master data is now managed through the payroll Edge Function.
-- Browser clients read through /payroll/data and cannot bypass role permissions.

do $$
begin
  if to_regclass('public.salary_profiles') is not null then
    execute 'alter table public.salary_profiles enable row level security';
    execute 'drop policy if exists "Salary profiles readable" on public.salary_profiles';
    execute 'drop policy if exists "Salary profiles manageable" on public.salary_profiles';
    execute 'revoke all on table public.salary_profiles from anon, authenticated';
    execute 'grant select, insert, update, delete on public.salary_profiles to service_role';
  end if;

  if to_regclass('public.kpi_library') is not null then
    execute 'alter table public.kpi_library enable row level security';
    execute 'drop policy if exists "KPI library readable" on public.kpi_library';
    execute 'drop policy if exists "KPI library manageable" on public.kpi_library';
    execute 'revoke all on table public.kpi_library from anon, authenticated';
    execute 'grant select, insert, update, delete on public.kpi_library to service_role';
  end if;

  if to_regclass('public.employee_kpi_assignments') is not null then
    execute 'alter table public.employee_kpi_assignments enable row level security';
    execute 'drop policy if exists "Employee KPI assignments readable" on public.employee_kpi_assignments';
    execute 'drop policy if exists "Employee KPI assignments manageable" on public.employee_kpi_assignments';
    execute 'revoke all on table public.employee_kpi_assignments from anon, authenticated';
    execute 'grant select, insert, update, delete on public.employee_kpi_assignments to service_role';
  end if;

  if to_regclass('public.payroll_deductions') is not null then
    execute 'alter table public.payroll_deductions enable row level security';
    execute 'drop policy if exists "Payroll deductions readable" on public.payroll_deductions';
    execute 'drop policy if exists "Payroll deductions manageable" on public.payroll_deductions';
    execute 'revoke all on table public.payroll_deductions from anon, authenticated';
    execute 'grant select, insert, update, delete on public.payroll_deductions to service_role';
  end if;
end $$;

notify pgrst, 'reload schema';
