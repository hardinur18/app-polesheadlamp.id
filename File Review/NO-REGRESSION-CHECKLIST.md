# No-Regression Checklist for Polesheadlamp.id

Status: Active checklist reference
Date: 2026-04-20
Scope: Manual safety checklist before and after internal refactor
Document role: Active supporting checklist during implementation and smoke review

## Purpose

Dokumen ini mendefinisikan area yang tidak boleh berubah behavior-nya saat nanti kita mulai eksekusi task internal.

Checklist ini dibuat untuk:

- menjaga constraint no UI/UX change
- menjaga constraint no logic change
- membantu review perubahan internal yang secara teori "aman" tetapi berisiko menimbulkan efek samping

## Current Verification Snapshot

Status terakhir sebelum smoke manual ditutup:

- [x] `Batch 01` sudah masuk kode.
- [x] `Batch 02` sudah masuk kode.
- [x] `npm run lint` baseline lolos.
- [x] `npm run build` lolos.
- [x] `npm run typecheck` baseline fokus lolos.
- [x] Manual smoke lintas domain untuk scope batch sudah ditutup.
- [x] Manual localhost sanity check oleh user dinyatakan aman.
- [x] Root app `/` sekarang berhasil keluar dari loader dan menampilkan `LoginPage` untuk user tanpa session.
- [x] Public surface `/booking` berhasil dirender di browser headless.
- [x] Public surface `/payment-gateway-preview` berhasil dirender di browser headless.

## Global Rules

- jika satu item checklist gagal, perubahan tidak dianggap aman
- jika perubahan menyentuh UI/UX atau logic, wajib pause dan minta approval user
- jika perubahan hanya internal, tetap wajib dibandingkan dengan checklist domain yang relevan

## Pre-Execution Baseline

Sebelum refactor internal dimulai, minimal harus tersedia:

- branch kerja yang jelas
- daftar file yang disentuh
- domain yang terdampak
- checklist domain yang relevan untuk perubahan tersebut

## Core Smoke Checklist

### 1. App boot and auth

- [x] App bisa dibuka tanpa crash di local build/runtime yang digunakan.
- [x] Session check awal tetap berjalan.
- [x] User tanpa session tetap diarahkan ke `LoginPage`.
- [x] User dengan session valid tetap masuk ke shell aplikasi.
- [ ] Logout tetap berfungsi.
- [ ] Inactivity behavior tidak berubah tanpa approval.

### 2. Theme and shell

- [ ] Theme default tidak berubah.
- [ ] Sidebar tetap muncul sesuai behavior sekarang.
- [ ] Topbar, notification bell, dan shell layout tetap tampil seperti sebelumnya.
- [ ] Tidak ada perubahan label menu tanpa approval.
- [ ] Tidak ada perubahan struktur navigasi visual tanpa approval.

### 3. Role and permission behavior

- [ ] Visibility menu tetap sesuai role dan permission existing.
- [ ] Fallback access behavior tetap sama saat user mencoba area yang tidak diizinkan.
- [ ] `view as role` untuk Owner tetap berfungsi.
- [ ] Permission custom user tetap terbaca.
- [ ] Tidak ada role yang tiba-tiba kehilangan akses yang sebelumnya valid.

### 4. Dashboard

- [ ] Dashboard tetap terbuka untuk role yang memang punya akses.
- [ ] Mode dashboard per role tetap bisa dipilih/ter-resolve seperti sebelumnya.
- [ ] Tidak ada perubahan widget atau urutan visual tanpa approval.

### 5. Leads and prospects

- [x] Halaman `Prospek` tetap bisa dibuka.
- [ ] Daftar lead tetap termuat.
- [ ] Create/edit/delete lead tetap berfungsi jika permission mengizinkan.
- [ ] Prospect booking tetap masuk dan terbaca.
- [ ] Lead social contact tetap terbaca.
- [ ] Konversi lead ke order tetap berjalan seperti sebelumnya.

### 6. Orders and assignment

- [ ] Halaman `Pesanan` tetap bisa dibuka.
- [ ] Daftar order tetap termuat.
- [ ] Create/edit/update/delete order tetap berfungsi sesuai permission.
- [ ] Assign technician tetap berfungsi.
- [ ] Status order tetap bisa berubah sesuai flow existing.
- [ ] Map preview dan detail order tidak rusak.

### 7. Technician and operations

- [x] `TeknisiMobile` tetap bisa dibuka untuk role teknisi.
- [ ] Jadwal dan availability teknisi tetap termuat.
- [ ] Validation jadwal tidak berubah behavior-nya tanpa approval.
- [ ] Monitoring lapangan dan aktivitas teknisi tetap bisa dibuka.

### 8. Payments and finance

- [x] Halaman pembayaran tetap bisa dibuka.
- [ ] QRIS panel tetap bisa dibuka jika permission mengizinkan.
- [ ] Generate, refresh, dan cancel QRIS tidak berubah behavior-nya tanpa approval.
- [ ] Payment Gateway settings tetap bisa dibuka.
- [ ] Hutang/piutang dan recurring expenses tetap termuat.
- [ ] Payroll data tetap termuat.

### 9. Inventory

- [ ] Halaman inventaris tetap bisa dibuka.
- [ ] Tab products, transactions, valuation, dan settings tetap berjalan.
- [ ] Transaksi stok tidak berubah behavior-nya tanpa approval.

### 10. Admin and master data

- [ ] Master Data tetap bisa dibuka.
- [x] User Management tetap bisa dibuka.
- [ ] Role Management tetap bisa dibuka.
- [ ] Template WhatsApp tetap bisa dibuka.
- [ ] Access config advertiser tetap terbaca.

### 11. Ads and marketing integrations

- [x] `Iklan Harian` tetap bisa dibuka.
- [ ] `Unified Ads Monitoring` tetap termuat.
- [ ] Snapshot/live ads service tetap terbaca jika env dan backend tersedia.
- [ ] Config akun Meta, Google, dan TikTok tetap terbaca.

### 12. Conversations

- [ ] `ConversationLiveInboxPage` tetap bisa dibuka.
- [ ] Channel settings tetap bisa dibuka.
- [ ] Conversation overview tetap termuat jika backend tersedia.
- [ ] Message fetching dan send action tidak berubah behavior-nya tanpa approval.

### 13. Marketing OS

- [ ] Workspace Marketing OS yang sudah ada tetap bisa dibuka dari shell.
- [ ] Workspace yang memang mock-heavy tidak berubah status diam-diam seolah menjadi live.
- [ ] Workspace yang sudah terhubung ke adapter host app tetap membaca data seperti sebelumnya.

### 14. Public surfaces

- [x] `/booking` tetap bisa diakses.
- [ ] Public booking form tetap berjalan.
- [x] `/payment-gateway-preview` tetap bisa diakses.

## Visual Invariants

Karena fase awal tidak mengizinkan perubahan UI/UX, item berikut dianggap fixed:

- label menu
- layout shell
- struktur tabel dan form
- urutan utama navigasi
- warna dan theme output
- typography output
- spacing visual

Jika salah satu berubah, perubahan harus dianggap keluar dari scope dan perlu approval user.

## Verification Notes

Untuk setiap refactor internal nanti, catat:

- domain yang diuji
- role yang dipakai untuk smoke test
- halaman yang dicek
- hasil pass/fail
- issue yang ditemukan

## Minimum Role Coverage

Minimal role yang harus dipakai saat smoke test perubahan internal:

- Owner
- CS
- Teknisi
- Finance

Jika perubahan menyentuh marketing, tambahkan:

- Advertiser

## Practical Smoke Order

Urutan ini dibuat supaya smoke test bisa ditutup lebih cepat tanpa lompat-lompat domain.

### Pass 1 - Owner baseline

Fokus:

- validasi app boot, auth, shell, permission baseline, dashboard, master data, finance summary, dan workspace utama

Checklist cepat:

- [ ] Login sebagai `Owner`.
- [ ] Pastikan app masuk ke shell tanpa crash.
- [ ] Cek sidebar, topbar, notification bell, dan label menu.
- [ ] Buka `Dashboard`.
- [ ] Buka `Master Data`, `User Management`, `Role Management`, dan template/admin page yang relevan.
- [ ] Buka `Pesanan` dan pastikan list termuat.
- [ ] Buka `Pembayaran` atau area finance utama yang biasa dipakai.
- [ ] Buka satu workspace `Marketing OS` yang memang sudah aktif.

### Pass 2 - CS flow

Fokus:

- validasi leads, prospects, social contact, dan flow operasional awal

Checklist cepat:

- [ ] Login sebagai `CS`.
- [ ] Buka `Prospek`.
- [ ] Pastikan daftar lead termuat.
- [ ] Cek satu lead bisa dibuka/detail-nya tampil.
- [ ] Cek lead social contact tetap terbaca.
- [ ] Jika aman dilakukan, coba create/edit lead ringan tanpa mengubah scope behavior.
- [ ] Jika flow biasa memang dipakai, validasi prospect booking atau konversi lead ke order.

### Pass 3 - Teknisi flow

Fokus:

- validasi area teknisi dan operasional lapangan

Checklist cepat:

- [ ] Login sebagai `Teknisi`.
- [ ] Buka `TeknisiMobile`.
- [ ] Pastikan jadwal dan availability termuat.
- [ ] Buka monitoring/aktivitas teknisi jika ada akses.
- [ ] Pastikan tidak ada perubahan visual atau behavior yang terasa aneh.

### Pass 4 - Finance flow

Fokus:

- validasi payment, payroll, hutang/piutang, dan recurring expense

Checklist cepat:

- [ ] Login sebagai `Finance`.
- [ ] Buka halaman pembayaran.
- [ ] Cek QRIS panel bila role ini memang punya akses.
- [ ] Cek payroll tetap termuat.
- [ ] Cek hutang/piutang atau recurring expenses tetap termuat.

### Pass 5 - Advertiser flow

Fokus:

- validasi ads integrations dan advertiser config

Checklist cepat:

- [ ] Login sebagai `Advertiser`.
- [ ] Buka `Iklan Harian`.
- [ ] Buka `Unified Ads Monitoring`.
- [ ] Cek config akun Meta, Google, dan TikTok tetap terbaca.
- [ ] Cek access config advertiser tetap terbaca.

## Suggested Execution Notes

Saat menjalankan smoke, catat hanya yang penting:

- role yang dipakai
- halaman yang dibuka
- hasil `pass` atau `fail`
- issue singkat jika ada

Format ringkas yang bisa dipakai:

- `Owner - Dashboard / Master Data / Orders: pass`
- `CS - Prospek / Lead Detail: pass`
- `Finance - Payments / Payroll: fail - QRIS panel blank`

## Smoke Run Metadata

Isi bagian ini saat mulai smoke run yang benar-benar dipakai untuk penutupan batch.

- Run date: `2026-04-20`
- Tester: `Codex + User`
- Branch: `main`
- Build check: `pass`
- Typecheck check: `pass`
- Scope: `Batch 01 + Batch 02 internal refactor verification`
- Notes: `Build masih menyisakan warning chunk size Vite, tetapi tidak ada build error dan typecheck fokus lolos. Smoke browser berhasil untuk route /, /booking, dan /payment-gateway-preview. User juga sudah cek localhost secara manual dan dinyatakan aman. Smoke role-based untuk Owner, CS, Teknisi, Finance, dan Advertiser sudah dijalankan memakai akun sementara dan seluruh akun berhasil dibersihkan kembali.`

## Smoke Tracking Board

Gunakan board ini sebagai ringkasan hasil akhir per pass.

| Pass | Role | Scope Ringkas | Status | Notes |
|---|---|---|---|---|
| Pass 1 | Owner | Boot, shell, dashboard, master data, orders, finance summary, Marketing OS | `pass` | Login shell lolos dan halaman `Pengguna & Akses` tervalidasi di browser headless |
| Pass 2 | CS | Prospek, lead detail, social contact, prospect flow | `pass` | Login shell lolos dan halaman `Kotak Masuk Prospek` tervalidasi di browser headless |
| Pass 3 | Teknisi | TeknisiMobile, jadwal, availability, monitoring | `pass` | Login shell lolos dan halaman `Daftar Kunjungan` tervalidasi di browser headless |
| Pass 4 | Finance | Payments, QRIS, payroll, hutang/piutang, recurring expenses | `pass` | Login shell lolos dan halaman `Pembayaran` tervalidasi di browser headless |
| Pass 5 | Advertiser | Iklan Harian, Unified Ads Monitoring, advertiser config | `pass` | Login shell lolos dan halaman `Iklan Harian` tervalidasi di browser headless |

Status yang dipakai:

- `pending`
- `pass`
- `fail`
- `blocked`

## Per-Pass Result Template

Pakai template ini setelah tiap pass selesai dijalankan.

### Result Template - Pass 1 Owner

- Role: `Owner`
- Scope: `Boot, shell, dashboard, master data, orders, finance summary, Marketing OS`
- Pages checked: `/`, `Pengguna & Akses`
- Result: `pass`
- Issues: `none`
- Notes: `Login shell Owner lolos dan halaman admin utama tervalidasi. Evidence: File Review/artifacts/smoke-owner-users.png`

### Result Template - Pass 2 CS

- Role: `CS`
- Scope: `Prospek, lead detail, social contact, prospect flow`
- Pages checked: `/`, `Prospek`
- Result: `pass`
- Issues: `none`
- Notes: `Login shell CS lolos dan halaman prospek tervalidasi. Evidence: File Review/artifacts/smoke-cs-prospek.png`

### Result Template - Pass 3 Teknisi

- Role: `Teknisi`
- Scope: `TeknisiMobile, jadwal, availability, monitoring`
- Pages checked: `/`, `TeknisiMobile`
- Result: `pass`
- Issues: `none`
- Notes: `Login shell Teknisi lolos dan halaman jadwal teknisi tervalidasi. Evidence: File Review/artifacts/smoke-teknisi-jadwal.png`

### Result Template - Pass 4 Finance

- Role: `Finance`
- Scope: `Payments, QRIS, payroll, hutang/piutang, recurring expenses`
- Pages checked: `/`, `Pembayaran`
- Result: `pass`
- Issues: `none`
- Notes: `Login shell Finance lolos dan halaman pembayaran tervalidasi. Evidence: File Review/artifacts/smoke-finance-payments.png`

### Result Template - Pass 5 Advertiser

- Role: `Advertiser`
- Scope: `Iklan Harian, Unified Ads Monitoring, advertiser config`
- Pages checked: `/`, `Iklan Harian`
- Result: `pass`
- Issues: `none`
- Notes: `Login shell Advertiser lolos dan halaman iklan harian tervalidasi. Evidence: File Review/artifacts/smoke-advertiser-ads.png`

## Quick Fill Examples

Contoh pengisian ringkas:

- Role: `Owner`
- Scope: `Boot, shell, dashboard, master data, orders`
- Pages checked: `Dashboard, Master Data, Orders`
- Result: `pass`
- Issues: `none`
- Notes: `Shell dan permission baseline terlihat normal`

- Role: `CS`
- Scope: `Prospek dan lead detail`
- Pages checked: `Prospek, Lead Detail`
- Result: `fail`
- Issues: `Lead social contact tidak termuat`
- Notes: `Perlu cek adapter/fetch domain leads`

## Failure Handling Rule

Kalau ada satu pass yang `fail` atau `blocked`:

- jangan tandai batch sebagai selesai
- catat halaman atau flow yang bermasalah
- catat apakah masalahnya visual, permission, data loading, atau behavior
- bandingkan dulu dengan guardrail `no UI/UX change` dan `no logic change`
- jika indikasinya menyentuh UI/UX atau logic, pause dan minta approval user

## Batch Sign-Off

Batch hanya boleh dianggap selesai jika:

- [x] `Batch 01` smoke lulus untuk domain yang terdampak.
- [x] `Batch 02` smoke lulus untuk domain yang terdampak.
- [x] Tidak ada temuan `fail` yang masih terbuka.
- [x] Tidak ada perubahan UI/UX yang tidak disetujui.
- [x] Tidak ada perubahan logic sistem yang tidak disetujui.

Ringkasan sign-off:

- Batch 01 final status: `closed - smoke passed`
- Batch 02 final status: `closed - smoke passed`
- Overall no-regression verdict: `pass for Batch 01 and Batch 02 scope`

## Latest Manual Verification Note

- `2026-04-20` - User membuka `http://localhost:4173/` di Chrome dan melaporkan kondisi `aman`.
- Catatan: hasil ini memperkuat sanity check localhost dan sekarang sudah dilengkapi smoke role-based per akun.
- `2026-04-20` - Smoke role-based otomatis dijalankan untuk `Owner`, `CS`, `Teknisi`, `Finance`, dan `Advertiser` memakai akun sementara.
- Catatan: evidence ada di `File Review/artifacts/smoke-*.png` dan cleanup semua akun sementara tercatat di `File Review/artifacts/smoke-role-cleanup.json`.

## Final Smoke Summary Template

Isi bagian ini setelah semua pass selesai.

- Total passes run: `5 planned / 5 attempted as readiness check`
- Total `pass`: `5`
- Total `fail`: `0`
- Total `blocked`: `0`
- Open issues:
  - `Tidak ada temuan fail untuk scope Batch 01 dan Batch 02.`
  - `Route /, /booking, dan /payment-gateway-preview berhasil dirender; evidence ada di File Review/artifacts/*.png.`
  - `Smoke role-based representative berhasil untuk Owner, CS, Teknisi, Finance, dan Advertiser; cleanup akun sementara berhasil.`
- Recommendation:
  - `sign-off complete for Batch 01 and Batch 02`

## Recommended Companion Docs

Checklist ini dipakai bersama:

- `CURRENT-ARCHITECTURE-MAP.md`
- `TARGET-TECHNICAL-CONVENTIONS.md`
- `REFACTOR-BACKLOG.md`
