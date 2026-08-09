-- Payroll period archive and operational expense posting support.
alter table public.operational_expense_ledger
  drop constraint if exists operational_expense_ledger_source_type_chk;

alter table public.operational_expense_ledger
  add constraint operational_expense_ledger_source_type_chk check (
    source_type in ('manual', 'cash_out_forward', 'recurring', 'adjustment', 'import', 'payroll')
  );

create unique index if not exists idx_operational_expense_ledger_payroll_source_ref_active
  on public.operational_expense_ledger (source_ref)
  where source_type = 'payroll' and status = 'active' and source_ref <> '';

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_key text not null unique,
  period_label text not null default '',
  cutoff_start date not null,
  cutoff_end date not null,
  employee_count integer not null default 0,
  fixed_cost numeric(15,2) not null default 0,
  bonus_total numeric(15,2) not null default 0,
  fixed_deductions_total numeric(15,2) not null default 0,
  period_deductions_total numeric(15,2) not null default 0,
  recurring_expense_total numeric(15,2) not null default 0,
  take_home_total numeric(15,2) not null default 0,
  grand_total numeric(15,2) not null default 0,
  status text not null default 'locked',
  operational_expense_id uuid references public.operational_expense_ledger(id) on delete set null,
  locked_at timestamptz,
  locked_by uuid,
  locked_by_name text not null default '',
  posted_at timestamptz,
  posted_by uuid,
  posted_by_name text not null default '',
  notes text not null default '',
  created_by uuid,
  created_by_name text not null default '',
  updated_by uuid,
  updated_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_runs_period_key_format check (period_key ~ '^\d{4}-\d{2}$'),
  constraint payroll_runs_status_valid check (status in ('locked', 'posted', 'void'))
);

create table if not exists public.payroll_run_items (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  user_id text not null,
  employee_name text not null default '',
  employee_role text not null default '',
  basic_salary numeric(15,2) not null default 0,
  allowance_fixed numeric(15,2) not null default 0,
  tool_allowance numeric(15,2) not null default 0,
  quota numeric(15,2) not null default 0,
  fixed_deductions numeric(15,2) not null default 0,
  period_deductions numeric(15,2) not null default 0,
  bonus numeric(15,2) not null default 0,
  take_home_pay numeric(15,2) not null default 0,
  order_count integer not null default 0,
  unit_count integer not null default 0,
  kpi_period_label text not null default '',
  kpi_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint payroll_run_items_unique_user unique (payroll_run_id, user_id)
);

create index if not exists idx_payroll_runs_period_status
  on public.payroll_runs (period_key desc, status);

create index if not exists idx_payroll_run_items_run_user
  on public.payroll_run_items (payroll_run_id, user_id);

create or replace function public.fn_payroll_runs_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_payroll_runs_set_updated_at on public.payroll_runs;
create trigger trg_payroll_runs_set_updated_at
before update on public.payroll_runs
for each row
execute function public.fn_payroll_runs_set_updated_at();

alter table public.payroll_runs enable row level security;
alter table public.payroll_run_items enable row level security;

drop policy if exists "Payroll runs readable" on public.payroll_runs;
create policy "Payroll runs readable"
  on public.payroll_runs
  for select
  using (true);

drop policy if exists "Payroll runs manageable" on public.payroll_runs;
create policy "Payroll runs manageable"
  on public.payroll_runs
  for all
  using (true)
  with check (true);

drop policy if exists "Payroll run items readable" on public.payroll_run_items;
create policy "Payroll run items readable"
  on public.payroll_run_items
  for select
  using (true);

drop policy if exists "Payroll run items manageable" on public.payroll_run_items;
create policy "Payroll run items manageable"
  on public.payroll_run_items
  for all
  using (true)
  with check (true);

grant select, insert, update, delete on public.payroll_runs to anon, authenticated, service_role;
grant select, insert, update, delete on public.payroll_run_items to anon, authenticated, service_role;

notify pgrst, 'reload schema';
