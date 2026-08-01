begin;

create table if not exists public.finance_categories (
  id text primary key,
  name text not null,
  type text not null check (type in ('income', 'expense', 'cogs')),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_accounts (
  id text primary key,
  category_id text not null references public.finance_categories(id) on delete cascade,
  name text not null,
  code text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, code)
);

alter table public.finance_categories enable row level security;
alter table public.finance_accounts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'finance_categories' and policyname = 'finance_categories_select_all'
  ) then
    create policy finance_categories_select_all on public.finance_categories for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'finance_categories' and policyname = 'finance_categories_insert_all'
  ) then
    create policy finance_categories_insert_all on public.finance_categories for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'finance_categories' and policyname = 'finance_categories_update_all'
  ) then
    create policy finance_categories_update_all on public.finance_categories for update using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'finance_categories' and policyname = 'finance_categories_delete_all'
  ) then
    create policy finance_categories_delete_all on public.finance_categories for delete using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'finance_accounts' and policyname = 'finance_accounts_select_all'
  ) then
    create policy finance_accounts_select_all on public.finance_accounts for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'finance_accounts' and policyname = 'finance_accounts_insert_all'
  ) then
    create policy finance_accounts_insert_all on public.finance_accounts for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'finance_accounts' and policyname = 'finance_accounts_update_all'
  ) then
    create policy finance_accounts_update_all on public.finance_accounts for update using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'finance_accounts' and policyname = 'finance_accounts_delete_all'
  ) then
    create policy finance_accounts_delete_all on public.finance_accounts for delete using (true);
  end if;
end $$;

grant select, insert, update, delete on public.finance_categories to anon, authenticated, service_role;
grant select, insert, update, delete on public.finance_accounts to anon, authenticated, service_role;

insert into public.finance_categories (id, name, type, active, sort_order)
values
  ('cat_income_sales', 'Penjualan', 'income', true, 10),
  ('cat_income_other', 'Pendapatan Lain-lain', 'income', true, 20),
  ('cat_cogs_1', 'Harga Pokok Penjualan (HPP)', 'cogs', true, 30),
  ('cat_expense_operational', 'Beban Operasional', 'expense', true, 40),
  ('cat_expense_people', 'Gaji & SDM', 'expense', false, 50),
  ('cat_expense_marketing', 'Marketing & Iklan', 'expense', false, 60),
  ('cat_expense_admin', 'Administrasi & Umum', 'expense', false, 70),
  ('cat_expense_other', 'Pengeluaran Lain-lain', 'expense', true, 80)
on conflict (id) do update
set name = excluded.name,
    type = excluded.type,
    active = excluded.active,
    sort_order = excluded.sort_order,
    updated_at = now();

insert into public.finance_accounts (id, category_id, name, code, description, active)
values
  ('acc_income_sales_general', 'cat_income_sales', 'Penjualan', '40000', 'Penerimaan penjualan dari data finance lama.', true),
  ('acc_income_sales_marketplace', 'cat_income_sales', 'Penjualan Marketplace', '40001', 'Penerimaan dari marketplace.', true),
  ('acc_income_sales_website', 'cat_income_sales', 'Penjualan Website', '40002', 'Penerimaan dari website atau kanal owned.', true),
  ('acc_income_sales_offline', 'cat_income_sales', 'Penjualan Offline', '40003', 'Penerimaan dari penjualan langsung.', true),
  ('acc_income_sales_return', 'cat_income_sales', 'Return Penjualan', '40004', 'Return atau koreksi penjualan.', true),
  ('acc_income_other_refund', 'cat_income_other', 'Refund / Reimburse', '41001', 'Pengembalian dana atau reimburse.', true),
  ('acc_income_other_non_business', 'cat_income_other', 'Pendapatan Non Usaha', '41002', 'Pendapatan di luar aktivitas penjualan utama.', true),
  ('acc_income_other_misc', 'cat_income_other', 'Pendapatan Lain-lain', '41099', 'Pendapatan lain di luar penjualan utama.', true),
  ('acc_cogs_material', 'cat_cogs_1', 'Bahan & Material', '50001', 'Pembelian bahan baku dan material produksi.', true),
  ('acc_cogs_packaging', 'cat_cogs_1', 'Packaging', '50002', 'Biaya kemasan produk.', true),
  ('acc_cogs_shipping_material', 'cat_cogs_1', 'Ongkir Bahan', '50003', 'Ongkos kirim pengiriman bahan.', true),
  ('acc_cogs_production', 'cat_cogs_1', 'Produksi/Maklon', '50004', 'Biaya produksi dan maklon.', true),
  ('acc_cogs_qc', 'cat_cogs_1', 'QC / Sampling', '50005', 'Quality control dan sampling produk.', true),
  ('acc_cogs_research', 'cat_cogs_1', 'Riset', '50006', 'Biaya riset dan pengembangan.', true),
  ('acc_expense_operational_rent', 'cat_expense_operational', 'Biaya Sewa Kantor / Cabang', '60001', 'Biaya sewa kantor atau cabang.', true),
  ('acc_expense_operational_utilities', 'cat_expense_operational', 'Biaya Utilitas', '60002', 'Biaya listrik, internet, air, konsumsi, atau layanan operasional.', true),
  ('acc_expense_operational_transport', 'cat_expense_operational', 'Biaya Transportasi & Perjalanan', '60003', 'Biaya transportasi dan perjalanan operasional.', true),
  ('acc_expense_operational_ads', 'cat_expense_operational', 'Biaya Iklan', '60004', 'Biaya iklan platform digital.', true),
  ('acc_expense_operational_influencer', 'cat_expense_operational', 'Biaya Endorse / Influencer', '60005', 'Biaya endorse, influencer, atau KOL.', true),
  ('acc_expense_operational_marketing', 'cat_expense_operational', 'Biaya Marketing Lainnya', '60006', 'Biaya marketing selain iklan dan influencer.', true),
  ('acc_expense_operational_commission', 'cat_expense_operational', 'Gaji & Komisi', '60007', 'Pembayaran gaji, komisi, atau fee tim.', true),
  ('acc_expense_operational_depreciation', 'cat_expense_operational', 'Biaya Penyusutan', '60008', 'Biaya penyusutan kendaraan atau peralatan.', true),
  ('acc_expense_operational_bank_fee', 'cat_expense_operational', 'Biaya Administrasi Bank / Payment Gateway', '60009', 'Biaya administrasi bank dan payment gateway.', true),
  ('acc_expense_people_salary', 'cat_expense_people', 'Gaji Karyawan', '61001', 'Pembayaran gaji karyawan.', false),
  ('acc_expense_people_allowance', 'cat_expense_people', 'Tunjangan / Kasbon', '61002', 'Tunjangan, kasbon, atau kebutuhan SDM.', false),
  ('acc_expense_marketing_ads', 'cat_expense_marketing', 'Iklan Digital', '62001', 'Biaya iklan digital.', false),
  ('acc_expense_marketing_content', 'cat_expense_marketing', 'Konten / KOL', '62002', 'Biaya konten, KOL, dan campaign.', false),
  ('acc_expense_admin_bank', 'cat_expense_admin', 'Admin Bank / Payment Fee', '63001', 'Biaya admin bank dan payment fee.', false),
  ('acc_expense_admin_misc', 'cat_expense_admin', 'Beban Lain-lain', '63099', 'Beban umum lainnya.', false),
  ('acc_expense_other_social', 'cat_expense_other', 'Biaya Sosial / CSR / Sedekah', '64001', 'Biaya sosial, CSR, atau sedekah.', true),
  ('acc_expense_other_marketing', 'cat_expense_other', 'Biaya Marketing Lainnya', '64002', 'Biaya marketing lain yang dicatat sebagai pengeluaran lain-lain.', false),
  ('acc_expense_other_misc', 'cat_expense_other', 'Lain - lain tidak Rutin', '64099', 'Pengeluaran lain yang tidak rutin.', true)
on conflict (id) do update
set category_id = excluded.category_id,
    name = excluded.name,
    code = excluded.code,
    description = excluded.description,
    active = excluded.active,
    updated_at = now();

alter table public.operational_expense_categories
  add column if not exists finance_category_id text,
  add column if not exists finance_account_id text;

update public.operational_expense_categories
set finance_account_id = null
where finance_account_id = '';

create unique index if not exists operational_expense_categories_finance_account_uidx
  on public.operational_expense_categories (finance_account_id)
  where finance_account_id is not null and finance_account_id <> '';

create unique index if not exists operational_expense_categories_finance_account_full_uidx
  on public.operational_expense_categories (finance_account_id);

insert into public.operational_expense_categories (
  category,
  subcategory,
  account_code,
  account_type,
  description,
  sort_order,
  is_active,
  finance_category_id,
  finance_account_id
)
select
  fc.name,
  fa.name,
  fa.code,
  fc.type,
  coalesce(fa.description, ''),
  fc.sort_order * 100 + row_number() over (partition by fc.id order by fa.code, fa.name),
  fc.active and fa.active,
  fc.id,
  fa.id
from public.finance_accounts fa
join public.finance_categories fc on fc.id = fa.category_id
on conflict (finance_account_id) do update
set category = excluded.category,
    subcategory = excluded.subcategory,
    account_code = excluded.account_code,
    account_type = excluded.account_type,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    finance_category_id = excluded.finance_category_id,
    updated_at = now();

notify pgrst, 'reload schema';

commit;
