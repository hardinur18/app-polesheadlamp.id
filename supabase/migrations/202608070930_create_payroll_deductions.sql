create extension if not exists pgcrypto;

create table if not exists public.payroll_deductions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  period_key text not null,
  amount numeric(15, 2) not null default 0,
  note text not null default '',
  status text not null default 'active',
  source_type text not null default 'manual',
  source_ref text not null default '',
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_deductions_amount_nonnegative check (amount >= 0),
  constraint payroll_deductions_period_key_format check (period_key ~ '^\d{4}-\d{2}$'),
  constraint payroll_deductions_status_valid check (status in ('active', 'void')),
  constraint payroll_deductions_source_type_valid check (source_type in ('manual', 'debt', 'adjustment'))
);

create index if not exists idx_payroll_deductions_period_user_status
  on public.payroll_deductions (period_key, user_id, status);

create unique index if not exists idx_payroll_deductions_active_source
  on public.payroll_deductions (user_id, period_key, source_type, source_ref)
  where status = 'active';

create or replace function public.fn_payroll_deductions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_payroll_deductions_set_updated_at on public.payroll_deductions;
create trigger trg_payroll_deductions_set_updated_at
before update on public.payroll_deductions
for each row
execute function public.fn_payroll_deductions_set_updated_at();

alter table public.payroll_deductions enable row level security;

drop policy if exists "Payroll deductions readable" on public.payroll_deductions;
create policy "Payroll deductions readable"
  on public.payroll_deductions
  for select
  to anon, authenticated, service_role
  using (true);

drop policy if exists "Payroll deductions manageable" on public.payroll_deductions;
create policy "Payroll deductions manageable"
  on public.payroll_deductions
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);

grant select, insert, update, delete on public.payroll_deductions to anon, authenticated, service_role;
