type Role = 'Owner' | 'Super Admin' | 'Admin PIC' | 'CS' | 'Advertiser' | 'Teknisi' | 'Finance';

type PermissionDefinition = {
  key: string;
  label: string;
  group: string;
  description?: string;
};

const definePermissions = <const T extends readonly PermissionDefinition[]>(permissions: T) =>
  permissions as readonly (T[number] & { description?: string })[];

export const PERMISSIONS = definePermissions([
  // --- ORDER (PESANAN) ---
  { key: 'order.view', label: 'Lihat Tabel Pesanan', group: 'Pesanan' },
  { key: 'order.create', label: 'Buat Pesanan Baru', group: 'Pesanan' },
  { key: 'order.edit', label: 'Edit Info Pesanan', group: 'Pesanan', description: 'Edit data pesanan (kecuali jika status Selesai)' },
  { key: 'order.assign_technician', label: 'Ubah Teknisi di Tabel', group: 'Pesanan', description: 'Akses cepat ganti teknisi via dropdown di tabel' },
  { key: 'order.delete', label: 'Hapus Pesanan', group: 'Pesanan' },
  { key: 'order.view_details', label: 'Lihat Detail Modal', group: 'Pesanan' },
  { key: 'order.status.edit', label: 'Ubah Status Order', group: 'Pesanan Status' },
  { key: 'order.status.mark_done', label: 'Ubah Status ke Selesai', group: 'Pesanan Status', description: 'Izin untuk menandai pesanan sebagai Selesai/Done' },
  { key: 'order.status.edit_completed', label: 'Ubah Status (Jika Selesai)', group: 'Pesanan Status', description: 'Izin mengubah status pada pesanan yang sudah Selesai/Done' },
  { key: 'order.payment.view', label: 'Lihat Kolom Pembayaran', group: 'Pesanan Pembayaran' },
  { key: 'order.payment.edit_type', label: 'Ubah Metode Bayar', group: 'Pesanan Pembayaran', description: 'Transfer / Cash' },
  { key: 'order.payment.edit_status', label: 'Ubah Status Bayar', group: 'Pesanan Pembayaran', description: 'Paid / Unpaid (Khusus Finance)' },
  
  // --- KONTAK & PETA (PESANAN) ---
  { key: 'customer.contact.view', label: 'Lihat Kontak Pelanggan', group: 'Kontak', description: 'Tombol WhatsApp & Telepon' },
  { key: 'staff.contact.view', label: 'Lihat Kontak Staff', group: 'Kontak', description: 'Tombol WhatsApp Teknisi/CS' },
  { key: 'map.view_route', label: 'Lihat Peta Rute (Per Order)', group: 'Peta' },

  // --- DASHBOARD ---
  { key: 'dashboard.view', label: 'Akses Dashboard', group: 'Dashboard' },
  { key: 'dashboard.view_owner', label: 'Akses Data Owner', group: 'Dashboard', description: 'Izin melihat agregat lintas user pada dashboard role' },
  { key: 'dashboard.view_advertiser', label: 'Dashboard Advertiser View', group: 'Dashboard', description: 'Tampilan dashboard khusus Advertiser' },
  { key: 'dashboard.view_cs', label: 'Dashboard CS View', group: 'Dashboard', description: 'Tampilan dashboard khusus Customer Service' },
  { key: 'dashboard.view_teknisi', label: 'Dashboard Teknisi View', group: 'Dashboard', description: 'Tampilan dashboard khusus Teknisi' },
  { key: 'dashboard.view_financial', label: 'Lihat Statistik Keuangan', group: 'Dashboard', description: 'Widget Revenue/Income' },

  // --- PROSPEK (LEADS) ---
  { key: 'leads.view', label: 'Akses Menu Prospek', group: 'Prospek' },
  { key: 'leads.create', label: 'Tambah Prospek', group: 'Prospek' },
  { key: 'leads.edit', label: 'Edit Prospek', group: 'Prospek' },
  { key: 'leads.delete', label: 'Hapus Prospek', group: 'Prospek' },
  { key: 'leads.export', label: 'Export Prospek', group: 'Prospek' },

  { key: 'proof_assets.view', label: 'Akses Galeri Bukti', group: 'Galeri Bukti' },
  { key: 'proof_assets.create', label: 'Tambah Galeri Bukti', group: 'Galeri Bukti' },
  { key: 'proof_assets.edit', label: 'Edit Galeri Bukti', group: 'Galeri Bukti' },
  { key: 'proof_assets.delete', label: 'Hapus Galeri Bukti', group: 'Galeri Bukti' },

  // --- WHATSAPP ---
  { key: 'whatsapp.view', label: 'Akses Modul WhatsApp', group: 'WhatsApp', description: 'Buka dashboard, chats, kontak, analytics, dan storage WhatsApp' },
  { key: 'whatsapp.chats.reply', label: 'Balas Chat WhatsApp', group: 'WhatsApp', description: 'Kirim balasan teks dan lampiran dari inbox WhatsApp' },
  { key: 'whatsapp.broadcast.manage', label: 'Kelola Broadcast WhatsApp', group: 'WhatsApp', description: 'Buka dan mengirim broadcast template WhatsApp' },
  { key: 'whatsapp.templates.manage', label: 'Kelola Template WhatsApp', group: 'WhatsApp', description: 'Sync dan membuat template Kirimdev/Meta' },
  { key: 'whatsapp.settings.manage', label: 'Kelola Pengaturan WhatsApp', group: 'WhatsApp', description: 'Akses akun, status provider, webhook, dan sync inbox WhatsApp' },

  // --- IKLAN & AFFILIATE ---
  { key: 'ads.view_daily', label: 'Akses Iklan Harian', group: 'Iklan' },
  { key: 'ads.view_analytics', label: 'Akses Analitik Iklan', group: 'Iklan' },
  { key: 'ads.manage', label: 'Kelola Iklan (CRUD)', group: 'Iklan' },
  { key: 'monitoring.marketing.view', label: 'Akses Monitoring Marketing', group: 'Monitoring Marketing', description: 'Dashboard Target vs Real Harian' },
  { key: 'cs_okr.view', label: 'Akses OKR CS', group: 'OKR CS', description: 'Buka laporan OKR CS dan ringkasan performa CS' },
  { key: 'cs_okr.manage', label: 'Kelola Target OKR CS', group: 'OKR CS', description: 'Tambah dan ubah target bulanan OKR CS' },
  { key: 'affiliate.view', label: 'Akses Menu Affiliate', group: 'Affiliate' },
  { key: 'affiliate.manage', label: 'Kelola Affiliate', group: 'Affiliate' },

  // --- JADWAL & MONITORING ---
  { key: 'schedule.view', label: 'Akses Menu Jadwal', group: 'Operasional' },
  { key: 'technician_schedule.view', label: 'Lihat Ketersediaan Teknisi', group: 'Operasional', description: 'Akses kalender ketersediaan dan hari libur teknisi' },
  { key: 'technician_schedule.manage', label: 'Kelola Ketersediaan Teknisi', group: 'Operasional', description: 'Tambah, ubah, dan hapus status libur teknisi' },
  { key: 'monitoring.view', label: 'Akses Pemantauan Lapangan', group: 'Operasional' },
  { key: 'monitoring.activity_view', label: 'Akses Monitoring Aktivitas Teknisi', group: 'Operasional', description: 'Rekap jadwal & aktivitas teknisi (Owner/Admin)' },
  { key: 'targets.manage', label: 'Kelola Target Monitoring', group: 'Operasional', description: 'Input dan ubah database target bulanan untuk dashboard monitoring' },
  { key: 'map.view_global', label: 'Akses Peta Sebaran', group: 'Operasional' },
  { key: 'teknisi.view_mobile', label: 'Akses Halaman Teknisi', group: 'Operasional', description: 'Tampilan Mobile Khusus Teknisi' },

  // --- LAPORAN OPERASIONAL TEKNISI ---
  { key: 'daily_report.view', label: 'Lihat Laporan Operasional', group: 'Operasional Teknisi' },
  { key: 'daily_report.create', label: 'Buat Laporan Baru', group: 'Operasional Teknisi' },
  { key: 'daily_report.edit', label: 'Edit Laporan', group: 'Operasional Teknisi' },
  { key: 'daily_report.delete', label: 'Hapus Laporan', group: 'Operasional Teknisi' },

  // --- PAYROLL & GAJI ---
  { key: 'payroll.view', label: 'Akses Menu Payroll', group: 'Gaji & Payroll' },
  { key: 'payroll.manage', label: 'Kelola Payroll & Gaji', group: 'Gaji & Payroll', description: 'Edit gaji, KPI, bonus, dan update massal payroll' },

  // --- KEUANGAN ---
  { key: 'finance.view', label: 'Akses Menu Keuangan', group: 'Keuangan', description: 'Payroll, biaya operasional, hutang piutang, dan laporan' },
  { key: 'operational_expenses.view', label: 'Lihat Biaya Operasional', group: 'Keuangan - Biaya Operasional' },
  { key: 'operational_expenses.create', label: 'Tambah Biaya Operasional', group: 'Keuangan - Biaya Operasional' },
  { key: 'operational_expenses.edit', label: 'Edit Biaya Operasional', group: 'Keuangan - Biaya Operasional' },
  { key: 'operational_expenses.delete', label: 'Void Biaya Operasional', group: 'Keuangan - Biaya Operasional' },
  { key: 'debts.view', label: 'Akses Hutang & Piutang', group: 'Keuangan', description: 'Monitoring kewajiban dan settlement hutang piutang' },
  { key: 'finance_report.view', label: 'Akses Operasional Teknisi', group: 'Keuangan', description: 'Laporan operasional teknisi dari sisi keuangan' },
  { key: 'finance.manage', label: 'Kelola Transaksi Keuangan', group: 'Keuangan' },
  
  // --- PENGELUARAN RUTIN ---
  { key: 'recurring_expenses.view', label: 'Lihat Daftar Pengeluaran', group: 'Keuangan - Pengeluaran' },
  { key: 'recurring_expenses.create', label: 'Tambah Pengeluaran', group: 'Keuangan - Pengeluaran' },
  { key: 'recurring_expenses.edit', label: 'Edit Pengeluaran', group: 'Keuangan - Pengeluaran' },
  { key: 'recurring_expenses.delete', label: 'Hapus Pengeluaran', group: 'Keuangan - Pengeluaran' },
  { key: 'recurring_expenses.pay', label: 'Konfirmasi Bayar', group: 'Keuangan - Pengeluaran', description: 'Izin klik tombol Bayar (Update status lunas)' },

  // --- MANAJEMEN STOK ---
  { key: 'inventory.view', label: 'Akses Inventaris', group: 'Manajemen Stok' },
  { key: 'inventory.create', label: 'Tambah Item', group: 'Manajemen Stok' },
  { key: 'inventory.edit', label: 'Edit Item', group: 'Manajemen Stok' },
  { key: 'inventory.delete', label: 'Hapus Item', group: 'Manajemen Stok' },
  { key: 'stock.transaction.view', label: 'Lihat Transaksi Stok', group: 'Manajemen Stok' },
  { key: 'stock.transaction.create', label: 'Buat Transaksi Stok', group: 'Manajemen Stok' },
  { key: 'stock.transaction.cancel', label: 'Batalkan Transaksi Stok', group: 'Manajemen Stok', description: 'Batalkan transaksi terbaru dan kembalikan stok ke kondisi sebelumnya' },
  { key: 'stock.card.view', label: 'Lihat Kartu Stok', group: 'Manajemen Stok' },
  { key: 'stock.valuation.view', label: 'Lihat Laporan Valuasi', group: 'Manajemen Stok' },
  { key: 'stock.valuation.export', label: 'Export Laporan Valuasi', group: 'Manajemen Stok', description: 'Izin untuk mengunduh laporan ke Excel' },
  { key: 'stock.settings.manage', label: 'Kelola Pengaturan Stok', group: 'Manajemen Stok' },

  // --- ADMIN & SETTINGS ---
  { key: 'master_data.view', label: 'Akses Master Data', group: 'Admin' },
  { key: 'master_data.create', label: 'Tambah Data', group: 'Admin' },
  { key: 'master_data.edit', label: 'Edit Data', group: 'Admin' },
  { key: 'master_data.delete', label: 'Hapus Data', group: 'Admin' },

  { key: 'users.view', label: 'Akses Manajemen User', group: 'Admin' },
  { key: 'users.create', label: 'Tambah User', group: 'Admin' },
  { key: 'users.edit', label: 'Edit User', group: 'Admin' },
  { key: 'users.reset_password', label: 'Reset Password User', group: 'Admin', description: 'Mengubah password akun pengguna' },
  { key: 'users.delete', label: 'Hapus User', group: 'Admin' },

  { key: 'wa_template.view', label: 'Akses Template WA', group: 'Admin' },
  { key: 'wa_template.create', label: 'Buat Template', group: 'Admin' },
  { key: 'wa_template.edit', label: 'Edit Template', group: 'Admin' },
  { key: 'wa_template.delete', label: 'Hapus Template', group: 'Admin' },
  { key: 'audit_logs.view', label: 'Lihat Audit Log', group: 'Admin', description: 'Riwayat aktivitas dan perubahan data sistem' },
  { key: 'role_permissions.view', label: 'Akses Role Permission', group: 'Admin', description: 'Buka halaman role permission' },
  { key: 'role_permissions.manage', label: 'Kelola Role Permission', group: 'Admin', description: 'Ubah dan simpan konfigurasi permission role' },
] as const);

export type PermissionKey = typeof PERMISSIONS[number]['key'];

export const DASHBOARD_VIEW_PERMISSION_MAP = {
  Advertiser: 'dashboard.view_advertiser',
  CS: 'dashboard.view_cs',
  Teknisi: 'dashboard.view_teknisi',
} as const satisfies Record<string, PermissionKey>;

export type DashboardViewMode = keyof typeof DASHBOARD_VIEW_PERMISSION_MAP;

export const DEFAULT_DASHBOARD_VIEW_BY_ROLE: Record<Role, DashboardViewMode> = {
  'Owner': 'Advertiser',
  'Super Admin': 'Advertiser',
  'Admin PIC': 'Advertiser',
  'Finance': 'Advertiser',
  'CS': 'CS',
  'Advertiser': 'Advertiser',
  'Teknisi': 'Teknisi',
};

const ALL_PERMISSIONS = PERMISSIONS.map(p => p.key);

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  'Owner': [...ALL_PERMISSIONS],
  'Super Admin': [...ALL_PERMISSIONS],
  
  'Admin PIC': [
    'dashboard.view', 'dashboard.view_owner', 'dashboard.view_advertiser', 'dashboard.view_financial',
    'leads.view', 'leads.create', 'leads.edit', 'leads.export',
    'proof_assets.view', 'proof_assets.create', 'proof_assets.edit', 'proof_assets.delete',
    'order.view', 'order.create', 'order.edit', 'order.assign_technician', 'order.view_details', 'order.status.edit', 'order.status.mark_done', 'order.payment.view', 'order.payment.edit_type', 'customer.contact.view', 'staff.contact.view', 'map.view_route',
    'schedule.view',
    'audit_logs.view',
    'monitoring.view', 'monitoring.activity_view', 'targets.manage',
    'monitoring.marketing.view', 'cs_okr.view', 'cs_okr.manage',
    'daily_report.view', 'daily_report.create', 'daily_report.edit', 'daily_report.delete',
    'affiliate.view', 'affiliate.manage',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete',
    'stock.transaction.view', 'stock.transaction.create', 'stock.transaction.cancel', 'stock.card.view', 'stock.valuation.view', 'stock.valuation.export',
    'wa_template.view', 'wa_template.create', 'wa_template.edit', 'wa_template.delete'
  ],

  'Finance': [
    'dashboard.view', 'dashboard.view_owner', 'dashboard.view_advertiser', 'dashboard.view_financial',
    'audit_logs.view',
    'leads.view',
    'order.view', 'order.view_details', 'order.payment.view', 'order.payment.edit_status', 'order.payment.edit_type', 'order.status.edit', 'order.status.mark_done', 'map.view_route', 'customer.contact.view', 'staff.contact.view',
    'daily_report.view',
    'payroll.view', 'payroll.manage',
    'finance.view', 'operational_expenses.view', 'operational_expenses.create', 'operational_expenses.edit', 'operational_expenses.delete', 'debts.view', 'finance_report.view', 'finance.manage',
    'stock.valuation.view', 'stock.valuation.export',
    'recurring_expenses.view', 'recurring_expenses.create', 'recurring_expenses.edit', 'recurring_expenses.delete', 'recurring_expenses.pay',
    'monitoring.marketing.view', 'cs_okr.view', 'cs_okr.manage', 'targets.manage'
  ],

  'CS': [
    'dashboard.view', 'dashboard.view_cs',
    'audit_logs.view',
    'leads.view', 'leads.create', 'leads.edit',
    'proof_assets.view',
    'order.view', 'order.create', 'order.edit', 'order.view_details', 'order.status.edit', 'order.payment.view', 'order.payment.edit_type', 'customer.contact.view', 'staff.contact.view', 'map.view_route',
    'schedule.view',
    'monitoring.view',
    'monitoring.marketing.view', 'cs_okr.view'
  ],

  'Teknisi': [
    'dashboard.view', 'dashboard.view_teknisi',
    'audit_logs.view',
    'teknisi.view_mobile',
    'order.view', 'order.view_details',
    'customer.contact.view', 'map.view_route'
  ],

  'Advertiser': [
    'dashboard.view', 'dashboard.view_advertiser',
    'audit_logs.view',
    'ads.view_daily', 'ads.view_analytics', 'ads.manage',
    'order.view', 'order.view_details',
    'leads.view', 'leads.create', 'leads.edit',
    'schedule.view',
    'monitoring.marketing.view', 'cs_okr.view'
  ]
};
