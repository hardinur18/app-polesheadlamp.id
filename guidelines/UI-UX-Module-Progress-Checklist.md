# UI/UX Module Progress Checklist

Checklist ini dipakai untuk melacak fitur yang sudah distandarkan ke framework UI/UX operational app.

## Status Legend

- `todo`: belum mulai
- `audit`: sedang diaudit
- `in-progress`: sedang dikerjakan
- `review`: siap dicek visual/QA
- `done`: sudah lolos typecheck/build dan sesuai standar

## Global Foundation

- [x] UI/UX standardization markdown dibuat.
- [x] Komponen operational foundation dibuat.
- [x] Checklist modul dibuat.
- [x] Operational Module Framework markdown dibuat.
- [x] Scaffold generator fitur baru dibuat.
- [x] Sidebar spacing framework distandarkan untuk foundation dan Pesanan.
- [x] Collapsed sidebar flyout distandarkan untuk menu parent.
- [x] Skeleton loading pattern masuk Operational UI Foundation.
- [ ] Pesanan dijadikan golden module.
- [ ] Mobile/PWA smoke automation dibuat.
- [ ] Pattern Pesanan diterapkan ke modul lain.

## New Module Rule

- [x] Fitur baru wajib mulai dari `npm run module:new -- NamaModul`.
- [x] Fitur baru wajib memakai Operational Module Framework.
- [x] Fitur baru wajib mengikuti Golden Module Pattern Pesanan.
- [x] Modul UI Foundation berarti full scope: page, KPI/card, filter, table/list, form, dialog/sheet, mobile/PWA behavior, dan checklist verifikasi.
- [x] Loading state wajib membedakan initial load, refresh, empty, error, dan ready.

## Golden Module: Pesanan

Status: `review`

Tujuan: menjadikan fitur Pesanan sebagai default pattern untuk page, filter, table, form, sidebar spacing, dan mobile/PWA behavior.

### Audit

- [x] Audit page header Pesanan.
- [x] Audit KPI cards Pesanan.
- [x] Audit filter/search Pesanan.
- [x] Audit table desktop Pesanan.
- [x] Audit mobile/tablet Pesanan.
- [x] Audit create/edit order form.
- [x] Audit detail/payment dialog.
- [x] Audit empty/loading/error/access-denied state.
- [x] Audit sidebar spacing saat expanded/collapsed.
- [x] Audit collapsed sidebar flyout behavior.

### Framework Decisions

- [x] Tetapkan default page shell untuk Pesanan.
- [x] Tetapkan default toolbar/filter pattern.
- [x] Tetapkan default data table pattern.
- [x] Tetapkan default order form dialog/drawer pattern.
- [ ] Tetapkan default mobile card/list pattern.
- [x] Tetapkan default sticky action footer mobile.
- [ ] Tetapkan default status badge set.
- [x] Tetapkan default empty/loading/error states.
- [x] Tetapkan default skeleton loading untuk KPI, card, dan table.

### Implementation

- [x] Standarkan AppLayout content spacing untuk Pesanan.
- [x] Standarkan Sidebar collapsed/expanded spacing.
- [x] Buat collapsed sidebar flyout untuk menu parent.
- [x] Apply `OperationalPageShell` ke Pesanan.
- [x] Apply `OperationalPageHeader` ke Pesanan.
- [x] Apply KPI standard ke Pesanan.
- [x] Apply filter panel standard ke Pesanan.
- [x] Apply table card standard ke Pesanan.
- [x] Apply form required marker ke OrderForm.
- [x] Apply form section/grid standard ke OrderForm.
- [x] Apply mobile/PWA form behavior.
- [x] Apply detail dialog standard ke OrderDetailDialog.
- [x] Apply payment dialog standard ke OrderPaymentDialog dan QRIS panel.
- [x] Standarkan typography sidebar untuk baseline Pesanan.
- [x] Pastikan tidak ada logic order berubah.

### Verification

- [x] `npm run typecheck` sukses.
- [x] `npm run build` sukses.
- [x] Desktop Chrome visual check dibuka di `/orders`.
- [ ] Mobile viewport visual check.
- [ ] Protected route `/orders` redirect ke `/login` saat belum login.
- [ ] Setelah login redirect balik ke `/orders`.
- [ ] Tambah/edit form bisa dibuka.
- [ ] Tidak ada horizontal overflow yang tidak perlu.

## Completed Modules

### Prospek

Status: `review`

- [x] Header standar.
- [x] KPI standar.
- [x] Filter panel standar.
- [x] Table card standar.
- [x] Empty state standar.
- [x] Add/edit sheet surface mengikuti framework.
- [x] Booking sheet surface mengikuti framework.
- [x] Tidak mengubah logic prospek.
- [x] `npm run typecheck` sukses.
- [x] `npm run build` sukses.
- [x] Desktop Chrome visual check.
- [x] Mobile viewport visual check.

### Affiliate

Status: `review`

- [x] Header standar.
- [x] KPI standar.
- [x] Filter panel standar.
- [x] Table card standar.
- [x] Empty/loading/access denied state standar.
- [x] Add/edit sheet surface mengikuti framework.
- [x] Form wajib pakai marker `*`.
- [x] Dialog form responsif untuk mobile/PWA.
- [x] Tidak mengubah logic affiliate.
- [x] `npm run typecheck` sukses.
- [x] `npm run build` sukses.
- [x] Desktop Chrome visual check.
- [x] Mobile viewport visual check.

### Monitoring Performance

Status: `review`

- [x] Header standar.
- [x] KPI standar.
- [x] Filter panel standar.
- [x] Main monitoring list card standar.
- [x] Empty/access denied state standar.
- [x] Target console tetap memakai flow existing.
- [x] Tidak mengubah logic monitoring performance.
- [x] `npm run typecheck` sukses.
- [x] `npm run build` sukses.
- [x] Desktop Chrome visual check.
- [x] Mobile viewport visual check.

### Iklan Harian

Status: `review`

- [x] Header standar.
- [x] KPI standar.
- [x] Filter panel standar.
- [x] Table card standar.
- [x] Empty state standar.
- [x] Mobile card/list dirapikan.
- [x] Add/edit sheet surface mengikuti framework.
- [x] Form wajib pakai marker `*`.
- [x] Import/bulk dialog tetap memakai flow existing.
- [x] Tidak mengubah logic iklan harian.
- [x] `npm run typecheck` sukses.
- [x] `npm run build` sukses.
- [ ] Desktop Chrome visual check.
- [ ] Mobile viewport visual check.

### Laporan Operasional

Status: `review`

- [x] Header standar.
- [x] KPI standar.
- [x] View switcher standar.
- [x] Tab transaksi operasional ditambahkan.
- [x] Tab transaksi membaca rekap dari tombol Salin WA, Finance, dan Req Trf.
- [x] Daily report table card standar.
- [x] Rekap teknisi table card standar.
- [x] Rekap transaksi table card standar.
- [x] Validasi setoran dan pembayaran finance tersedia dari tab transaksi.
- [x] Forward transaksi keluar ke form Biaya Operasional dengan draft prefill.
- [x] Empty state standar.
- [x] Form wajib pakai marker `*`.
- [x] Tidak mengubah logic laporan operasional.
- [x] `npm run typecheck` sukses.
- [x] `npm run build` sukses.
- [ ] Desktop Chrome visual check.
- [ ] Mobile viewport visual check.

### Dashboard Owner > Owner View

Status: `review`

- [x] Header standar.
- [x] KPI standar.
- [x] Main chart cards standar.
- [x] Performance ranking cards standar.
- [x] Recent orders table card standar.
- [x] Tidak mengubah logic dashboard owner.
- [x] `npm run typecheck` sukses.
- [x] `npm run build` sukses.
- [ ] Desktop Chrome visual check.
- [ ] Mobile viewport visual check.

### Dashboard > Advertiser View

Status: `review`

- [x] Header standar.
- [x] KPI standar.
- [x] Filter panel standar.
- [x] Chart cards standar.
- [x] Detail table card standar.
- [x] Empty state standar.
- [x] Tidak mengubah logic advertiser dashboard.
- [x] `npm run typecheck` sukses.
- [x] `npm run build` sukses.
- [ ] Desktop Chrome visual check.
- [ ] Mobile viewport visual check.

### Dashboard > CS View

Status: `review`

- [x] Header standar.
- [x] KPI standar.
- [x] Chart card standar.
- [x] Detail table card standar.
- [x] Empty state standar.
- [x] Tidak mengubah logic CS dashboard.
- [x] `npm run typecheck` sukses.
- [x] `npm run build` sukses.
- [ ] Desktop Chrome visual check.
- [ ] Mobile viewport visual check.

### Dashboard > Teknisi View

Status: `review`

- [x] Header standar.
- [x] KPI standar.
- [x] Chart cards standar.
- [x] Detail table card standar.
- [x] Empty state standar.
- [x] Pagination footer standar.
- [x] Tidak mengubah logic teknisi dashboard.
- [x] `npm run typecheck` sukses.
- [x] `npm run build` sukses.
- [ ] Desktop Chrome visual check.
- [ ] Mobile viewport visual check.

### Master Data > Kategori Biaya

Status: `done`

- [x] Header standar.
- [x] KPI standar.
- [x] Filter panel standar.
- [x] Table card standar.
- [x] Table satu kolom group, bukan table terpisah per kategori.
- [x] Form wajib pakai marker `*`.
- [x] Kode akun valid 5 digit angka.
- [x] Empty/error state standar.
- [x] `npm run typecheck` sukses.
- [x] `npm run build` sukses.

## Module Backlog

- [ ] Biaya Operasional
- [ ] Master Data tab lain
- [ ] Finance pages
- [x] Prospek
- [ ] Schedule
- [ ] Monitoring Teknisi
- [x] Ads Monitoring
- [x] Iklan Harian
- [x] Affiliate
- [ ] Dashboard Owner
- [ ] Settings
- [ ] Users
- [ ] Role Permission
- [ ] Audit Log
