alter table if exists public.stock_transactions
  add column if not exists branch_id text references public.branches(id) on delete set null,
  add column if not exists technician_id text;

create index if not exists stock_transactions_branch_id_idx
  on public.stock_transactions(branch_id);

create index if not exists stock_transactions_technician_id_idx
  on public.stock_transactions(technician_id);

create index if not exists stock_transactions_date_idx
  on public.stock_transactions(date);
