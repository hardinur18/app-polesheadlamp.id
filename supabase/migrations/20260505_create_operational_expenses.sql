begin;

create extension if not exists pgcrypto;

create table if not exists public.operational_expense_categories (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  subcategory text not null,
  account_code text not null default '',
  account_type text not null default 'expense',
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_expense_categories_type_chk check (account_type in ('income', 'expense', 'cogs')),
  constraint operational_expense_categories_unique_key unique (category, subcategory)
);

alter table public.operational_expense_categories
  add column if not exists account_code text not null default '',
  add column if not exists account_type text not null default 'expense',
  add column if not exists description text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'operational_expense_categories_type_chk'
      and conrelid = 'public.operational_expense_categories'::regclass
  ) then
    alter table public.operational_expense_categories
      add constraint operational_expense_categories_type_chk
      check (account_type in ('income', 'expense', 'cogs'));
  end if;
end $$;

create table if not exists public.operational_expense_ledger (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  period_key text not null,
  branch_id text references public.branches(id) on delete set null,
  branch_name text not null default '',
  category text not null,
  subcategory text not null default '',
  vendor_name text not null default '',
  description text not null default '',
  amount numeric(15,2) not null default 0 check (amount >= 0),
  currency text not null default 'IDR',
  payment_source text not null default '',
  source_type text not null default 'manual',
  source_ref text not null default '',
  notes text not null default '',
  status text not null default 'active',
  void_reason text not null default '',
  voided_at timestamptz,
  voided_by text,
  created_by text,
  created_by_name text not null default '',
  updated_by text,
  updated_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_expense_ledger_status_chk check (status in ('active', 'void')),
  constraint operational_expense_ledger_source_type_chk check (
    source_type in ('manual', 'cash_out_forward', 'recurring', 'adjustment', 'import')
  ),
  constraint operational_expense_ledger_period_key_chk check (period_key ~ '^\d{4}-\d{2}$')
);

create index if not exists idx_operational_expense_ledger_date
  on public.operational_expense_ledger (expense_date desc);

create index if not exists idx_operational_expense_ledger_branch_date
  on public.operational_expense_ledger (branch_id, expense_date desc);

create index if not exists idx_operational_expense_ledger_category_date
  on public.operational_expense_ledger (category, expense_date desc);

create index if not exists idx_operational_expense_ledger_status_date
  on public.operational_expense_ledger (status, expense_date desc);

create or replace function public.fn_operational_expense_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_operational_expense_categories_set_updated_at
  on public.operational_expense_categories;
create trigger trg_operational_expense_categories_set_updated_at
before update on public.operational_expense_categories
for each row
execute function public.fn_operational_expense_set_updated_at();

drop trigger if exists trg_operational_expense_ledger_set_updated_at
  on public.operational_expense_ledger;
create trigger trg_operational_expense_ledger_set_updated_at
before update on public.operational_expense_ledger
for each row
execute function public.fn_operational_expense_set_updated_at();

insert into public.operational_expense_categories (category, subcategory, account_code, account_type, description, sort_order)
values
  ('Penjualan', 'Penjualan', '52187', 'income', '', 10),
  ('Penjualan', 'Return Penjualan', '95425', 'income', '', 20),
  ('Pendapatan Lain - Lain', 'Pendapatan Non Usaha', '86651', 'income', '', 30),
  ('Harga Pokok Penjualan (HPP)', 'QC / Sampling', '25327', 'expense', '', 40),
  ('Harga Pokok Penjualan (HPP)', 'Riset', '26853', 'expense', '', 50),
  ('Harga Pokok Penjualan (HPP)', 'Produksi/Maklon', '28145', 'expense', '', 60),
  ('Harga Pokok Penjualan (HPP)', 'Bahan & Material', '64437', 'expense', '', 70),
  ('Harga Pokok Penjualan (HPP)', 'Ongkir Bahan', '89861', 'expense', '', 80),
  ('Harga Pokok Penjualan (HPP)', 'Packaging', '94123', 'expense', '', 90),
  ('Beban Operasional', 'Biaya Administrasi Bank / Payment Gateway', '44150', 'expense', '', 100),
  ('Beban Operasional', 'Biaya Sewa Kantor / Cabang', '45794', 'expense', '', 110),
  ('Beban Operasional', 'Gaji & Komisi', '49286', 'expense', '(CS, Teknisi, Freelance, Ads Team)', 120),
  ('Beban Operasional', 'Biaya Marketing Lainnya', '51278', 'expense', '(spanduk, brosur, event, merchandise)', 130),
  ('Beban Operasional', 'Biaya Iklan', '62816', 'expense', 'Facebook Ads', 140),
  ('Beban Operasional', 'Biaya Endorse / Influencaer', '70705', 'expense', '', 150),
  ('Beban Operasional', 'Biaya Penyusutan', '71050', 'expense', '(Kendaraan, Peralatan)', 160),
  ('Beban Operasional', 'Biaya Utilitas', '74344', 'expense', '(Listrik, Wifi, Air, Makan, layanan platform)', 170),
  ('Beban Operasional', 'Biaya Transportasi & Perjalanan', '97923', 'expense', 'Transportasi', 180),
  ('Pengeluaran Lain - lain', 'Biaya Sosial / CSR / Sedekah', '19767', 'expense', '', 190),
  ('Pengeluaran Lain - lain', 'Lain - lain tidak Rutin', '59528', 'expense', '', 200)
on conflict (category, subcategory) do update
set account_code = excluded.account_code,
    account_type = excluded.account_type,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = true;

grant select, insert, update, delete on public.operational_expense_categories to anon, authenticated, service_role;
grant select, insert, update, delete on public.operational_expense_ledger to anon, authenticated, service_role;

alter table public.operational_expense_categories enable row level security;
alter table public.operational_expense_ledger enable row level security;

commit;
