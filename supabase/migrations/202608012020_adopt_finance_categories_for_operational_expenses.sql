begin;

alter table public.operational_expense_categories
  add column if not exists finance_category_id text,
  add column if not exists finance_account_id text;

create unique index if not exists operational_expense_categories_finance_account_uidx
  on public.operational_expense_categories (finance_account_id)
  where finance_account_id is not null and finance_account_id <> '';

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
values
  ('Penjualan', 'Penjualan', '40000', 'income', 'Penerimaan penjualan dari data finance lama.', 10, true, 'cat_income_sales', 'acc_income_sales_general'),
  ('Penjualan', 'Penjualan Marketplace', '40001', 'income', 'Penerimaan dari marketplace.', 20, true, 'cat_income_sales', 'acc_income_sales_marketplace'),
  ('Penjualan', 'Penjualan Website', '40002', 'income', 'Penerimaan dari website atau kanal owned.', 30, true, 'cat_income_sales', 'acc_income_sales_website'),
  ('Penjualan', 'Penjualan Offline', '40003', 'income', 'Penerimaan dari penjualan langsung.', 40, true, 'cat_income_sales', 'acc_income_sales_offline'),
  ('Penjualan', 'Return Penjualan', '40004', 'income', 'Return atau koreksi penjualan.', 50, true, 'cat_income_sales', 'acc_income_sales_return'),
  ('Pendapatan Lain-lain', 'Refund / Reimburse', '41001', 'income', 'Pengembalian dana atau reimburse.', 60, true, 'cat_income_other', 'acc_income_other_refund'),
  ('Pendapatan Lain-lain', 'Pendapatan Non Usaha', '41002', 'income', 'Pendapatan di luar aktivitas penjualan utama.', 70, true, 'cat_income_other', 'acc_income_other_non_business'),
  ('Pendapatan Lain-lain', 'Pendapatan Lain-lain', '41099', 'income', 'Pendapatan lain di luar penjualan utama.', 80, true, 'cat_income_other', 'acc_income_other_misc'),
  ('Harga Pokok Penjualan (HPP)', 'Bahan & Material', '50001', 'cogs', 'Pembelian bahan baku dan material produksi.', 90, true, 'cat_cogs_1', 'acc_cogs_material'),
  ('Harga Pokok Penjualan (HPP)', 'Packaging', '50002', 'cogs', 'Biaya kemasan produk.', 100, true, 'cat_cogs_1', 'acc_cogs_packaging'),
  ('Harga Pokok Penjualan (HPP)', 'Ongkir Bahan', '50003', 'cogs', 'Ongkos kirim pengiriman bahan.', 110, true, 'cat_cogs_1', 'acc_cogs_shipping_material'),
  ('Harga Pokok Penjualan (HPP)', 'Produksi/Maklon', '50004', 'cogs', 'Biaya produksi dan maklon.', 120, true, 'cat_cogs_1', 'acc_cogs_production'),
  ('Harga Pokok Penjualan (HPP)', 'QC / Sampling', '50005', 'cogs', 'Quality control dan sampling produk.', 130, true, 'cat_cogs_1', 'acc_cogs_qc'),
  ('Harga Pokok Penjualan (HPP)', 'Riset', '50006', 'cogs', 'Biaya riset dan pengembangan.', 140, true, 'cat_cogs_1', 'acc_cogs_research'),
  ('Beban Operasional', 'Biaya Sewa Kantor / Cabang', '60001', 'expense', 'Biaya sewa kantor atau cabang.', 150, true, 'cat_expense_operational', 'acc_expense_operational_rent'),
  ('Beban Operasional', 'Biaya Utilitas', '60002', 'expense', 'Biaya listrik, internet, air, konsumsi, atau layanan operasional.', 160, true, 'cat_expense_operational', 'acc_expense_operational_utilities'),
  ('Beban Operasional', 'Biaya Transportasi & Perjalanan', '60003', 'expense', 'Biaya transportasi dan perjalanan operasional.', 170, true, 'cat_expense_operational', 'acc_expense_operational_transport'),
  ('Beban Operasional', 'Biaya Iklan', '60004', 'expense', 'Biaya iklan platform digital.', 180, true, 'cat_expense_operational', 'acc_expense_operational_ads'),
  ('Beban Operasional', 'Biaya Endorse / Influencer', '60005', 'expense', 'Biaya endorse, influencer, atau KOL.', 190, true, 'cat_expense_operational', 'acc_expense_operational_influencer'),
  ('Beban Operasional', 'Biaya Marketing Lainnya', '60006', 'expense', 'Biaya marketing selain iklan dan influencer.', 200, true, 'cat_expense_operational', 'acc_expense_operational_marketing'),
  ('Beban Operasional', 'Gaji & Komisi', '60007', 'expense', 'Pembayaran gaji, komisi, atau fee tim.', 210, true, 'cat_expense_operational', 'acc_expense_operational_commission'),
  ('Beban Operasional', 'Biaya Penyusutan', '60008', 'expense', 'Biaya penyusutan kendaraan atau peralatan.', 220, true, 'cat_expense_operational', 'acc_expense_operational_depreciation'),
  ('Beban Operasional', 'Biaya Administrasi Bank / Payment Gateway', '60009', 'expense', 'Biaya administrasi bank dan payment gateway.', 230, true, 'cat_expense_operational', 'acc_expense_operational_bank_fee'),
  ('Gaji & SDM', 'Gaji Karyawan', '61001', 'expense', 'Pembayaran gaji karyawan.', 240, false, 'cat_expense_people', 'acc_expense_people_salary'),
  ('Gaji & SDM', 'Tunjangan / Kasbon', '61002', 'expense', 'Tunjangan, kasbon, atau kebutuhan SDM.', 250, false, 'cat_expense_people', 'acc_expense_people_allowance'),
  ('Marketing & Iklan', 'Iklan Digital', '62001', 'expense', 'Biaya iklan digital.', 260, false, 'cat_expense_marketing', 'acc_expense_marketing_ads'),
  ('Marketing & Iklan', 'Konten / KOL', '62002', 'expense', 'Biaya konten, KOL, dan campaign.', 270, false, 'cat_expense_marketing', 'acc_expense_marketing_content'),
  ('Administrasi & Umum', 'Admin Bank / Payment Fee', '63001', 'expense', 'Biaya admin bank dan payment fee.', 280, false, 'cat_expense_admin', 'acc_expense_admin_bank'),
  ('Administrasi & Umum', 'Beban Lain-lain', '63099', 'expense', 'Beban umum lainnya.', 290, false, 'cat_expense_admin', 'acc_expense_admin_misc'),
  ('Pengeluaran Lain-lain', 'Biaya Sosial / CSR / Sedekah', '64001', 'expense', 'Biaya sosial, CSR, atau sedekah.', 300, true, 'cat_expense_other', 'acc_expense_other_social'),
  ('Pengeluaran Lain-lain', 'Biaya Marketing Lainnya', '64002', 'expense', 'Biaya marketing lain yang dicatat sebagai pengeluaran lain-lain.', 310, false, 'cat_expense_other', 'acc_expense_other_marketing'),
  ('Pengeluaran Lain-lain', 'Lain - lain tidak Rutin', '64099', 'expense', 'Pengeluaran lain yang tidak rutin.', 320, true, 'cat_expense_other', 'acc_expense_other_misc')
on conflict (category, subcategory) do update
set
  account_code = excluded.account_code,
  account_type = excluded.account_type,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  finance_category_id = excluded.finance_category_id,
  finance_account_id = excluded.finance_account_id,
  updated_at = now();

update public.operational_expense_categories
set
  is_active = false,
  updated_at = now()
where subcategory = 'Biaya Endorse / Influencaer'
  and category = 'Beban Operasional';

delete from public.operational_expense_categories
where coalesce(finance_account_id, '') = ''
  and (
    (category = 'Pendapatan Lain - Lain' and subcategory = 'Pendapatan Non Usaha')
    or (category = 'Pengeluaran Lain - lain' and subcategory in ('Biaya Sosial / CSR / Sedekah', 'Lain - lain tidak Rutin'))
    or (category = 'Beban Operasional' and subcategory = 'Biaya Endorse / Influencaer')
  );

notify pgrst, 'reload schema';

commit;
