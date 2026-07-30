export type OperationalExpenseAccountType = 'income' | 'expense' | 'cogs';

export type OperationalExpenseAccountSeed = {
  id: string;
  category: string;
  subcategory: string;
  account_code: string;
  account_type: OperationalExpenseAccountType;
  description: string;
  sort_order: number;
  is_active: boolean;
};

export const DEFAULT_OPERATIONAL_EXPENSE_ACCOUNTS: OperationalExpenseAccountSeed[] = [
  { id: 'seed-coa-001', category: 'Penjualan', subcategory: 'Penjualan', account_code: '52187', account_type: 'income', description: '', sort_order: 10, is_active: true },
  { id: 'seed-coa-002', category: 'Penjualan', subcategory: 'Return Penjualan', account_code: '95425', account_type: 'income', description: '', sort_order: 20, is_active: true },
  { id: 'seed-coa-003', category: 'Pendapatan Lain - Lain', subcategory: 'Pendapatan Non Usaha', account_code: '86651', account_type: 'income', description: '', sort_order: 30, is_active: true },
  { id: 'seed-coa-004', category: 'Harga Pokok Penjualan (HPP)', subcategory: 'QC / Sampling', account_code: '25327', account_type: 'expense', description: '', sort_order: 40, is_active: true },
  { id: 'seed-coa-005', category: 'Harga Pokok Penjualan (HPP)', subcategory: 'Riset', account_code: '26853', account_type: 'expense', description: '', sort_order: 50, is_active: true },
  { id: 'seed-coa-006', category: 'Harga Pokok Penjualan (HPP)', subcategory: 'Produksi/Maklon', account_code: '28145', account_type: 'expense', description: '', sort_order: 60, is_active: true },
  { id: 'seed-coa-007', category: 'Harga Pokok Penjualan (HPP)', subcategory: 'Bahan & Material', account_code: '64437', account_type: 'expense', description: '', sort_order: 70, is_active: true },
  { id: 'seed-coa-008', category: 'Harga Pokok Penjualan (HPP)', subcategory: 'Ongkir Bahan', account_code: '89861', account_type: 'expense', description: '', sort_order: 80, is_active: true },
  { id: 'seed-coa-009', category: 'Harga Pokok Penjualan (HPP)', subcategory: 'Packaging', account_code: '94123', account_type: 'expense', description: '', sort_order: 90, is_active: true },
  { id: 'seed-coa-010', category: 'Beban Operasional', subcategory: 'Biaya Administrasi Bank / Payment Gateway', account_code: '44150', account_type: 'expense', description: '', sort_order: 100, is_active: true },
  { id: 'seed-coa-011', category: 'Beban Operasional', subcategory: 'Biaya Sewa Kantor / Cabang', account_code: '45794', account_type: 'expense', description: '', sort_order: 110, is_active: true },
  { id: 'seed-coa-012', category: 'Beban Operasional', subcategory: 'Gaji & Komisi', account_code: '49286', account_type: 'expense', description: '(CS, Teknisi, Freelance, Ads Team)', sort_order: 120, is_active: true },
  { id: 'seed-coa-013', category: 'Beban Operasional', subcategory: 'Biaya Marketing Lainnya', account_code: '51278', account_type: 'expense', description: '(spanduk, brosur, event, merchandise)', sort_order: 130, is_active: true },
  { id: 'seed-coa-014', category: 'Beban Operasional', subcategory: 'Biaya Iklan', account_code: '62816', account_type: 'expense', description: 'Facebook Ads', sort_order: 140, is_active: true },
  { id: 'seed-coa-015', category: 'Beban Operasional', subcategory: 'Biaya Endorse / Influencaer', account_code: '70705', account_type: 'expense', description: '', sort_order: 150, is_active: true },
  { id: 'seed-coa-016', category: 'Beban Operasional', subcategory: 'Biaya Penyusutan', account_code: '71050', account_type: 'expense', description: '(Kendaraan, Peralatan)', sort_order: 160, is_active: true },
  { id: 'seed-coa-017', category: 'Beban Operasional', subcategory: 'Biaya Utilitas', account_code: '74344', account_type: 'expense', description: '(Listrik, Wifi, Air, Makan, layanan platform)', sort_order: 170, is_active: true },
  { id: 'seed-coa-018', category: 'Beban Operasional', subcategory: 'Biaya Transportasi & Perjalanan', account_code: '97923', account_type: 'expense', description: 'Transportasi', sort_order: 180, is_active: true },
  { id: 'seed-coa-019', category: 'Pengeluaran Lain - lain', subcategory: 'Biaya Sosial / CSR / Sedekah', account_code: '19767', account_type: 'expense', description: '', sort_order: 190, is_active: true },
  { id: 'seed-coa-020', category: 'Pengeluaran Lain - lain', subcategory: 'Lain - lain tidak Rutin', account_code: '59528', account_type: 'expense', description: '', sort_order: 200, is_active: true },
];

export const DEFAULT_OPERATIONAL_EXPENSE_ONLY_ACCOUNTS = DEFAULT_OPERATIONAL_EXPENSE_ACCOUNTS.filter(
  (account) => account.account_type === 'expense' && account.is_active,
);
