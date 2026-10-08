# Core CRUD Audit Matrix

Last updated: 2026-10-08

Dokumen ini memisahkan area yang sudah punya bukti otomatis, area yang masih perlu credential/manual test, dan area yang tidak boleh diubah sembarang karena menjadi sumber data operasional.

## Prinsip

- Master Data adalah sumber rujukan internal. Perubahan schema/CRUD master data wajib minimal, typed, dan punya rollback/checklist.
- Prospek, Pesanan, Payment, dan Master Data tidak boleh dipindahkan transport-nya sekaligus dalam satu commit.
- Setiap perubahan CRUD harus mempertahankan kontrak UI yang sudah berjalan: pesan error jelas, loading tidak menggantung, dan side effect bisnis tetap sama.
- Audit ini tidak mengganti manual test role. Untuk klaim final 100%, smoke credential Owner/CS/Advertiser/Teknisi tetap wajib disediakan.

## Matrix

| Area | Status Saat Ini | Coverage Otomatis | Bukti Manual yang Masih Perlu | Catatan Risiko |
| --- | --- | --- | --- | --- |
| Prospek CRUD | Duplicate exact aktif sudah dijaga database dan UI error sudah dirapikan. | `smoke:prospect-crud` untuk create/edit/duplicate bila credential tersedia; `smoke:core-contracts` untuk helper Auto WA/latest booking. | Login CS/Owner real, tambah prospek, edit prospek, duplicate exact, nomor sama nama beda. | API WA duplicate lama tetap perlu audit data historis dan cleanup bertahap. |
| Prospek -> Booking -> Order | Conflict booking lead yang sama sudah diabaikan saat konversi ke order. | `smoke:core-contracts` memverifikasi false conflict same lead dan conflict active booking/order. | Forward dari UI dengan role CS dan slot kosong/slot bentrok. | Jangan ubah rule jadwal tanpa test slot aktif/nonaktif. |
| Pesanan CRUD | Patch edit order minimal dan validasi jadwal aktif/nonaktif sudah distandarkan. | `smoke:core-contracts` memverifikasi schedule conflict, off schedule guard, dan patch order. | Input order baru, edit order, quick status, payment status, assignment teknisi. | Update order punya side effect lifecycle/CRM; pindahkan bertahap saja. |
| Payment & Proof Assets | Modal scroll/upload sudah dirapikan pada phase sebelumnya. | Belum ada upload smoke otomatis karena butuh storage credential dan file fixture. | Upload bukti bayar dari CS/Finance, delete/replace bukti, update status bayar. | Storage policy dan direct upload/delete perlu diaudit lagi sebelum RLS granular. |
| Dashboard API Snapshot | UI membaca `daily_ads` hasil sync dan core reconcile tidak overwrite edit manual. | `smoke:core-contracts` memverifikasi provider key dan reconcile preview daily ads. | Klik sync API real Meta/Google/TikTok dan cek hasil dashboard CS/Advertiser. | External API failure harus tetap menampilkan snapshot DB valid terakhir. |
| Master Data CRUD | Masih campuran context/service/direct Supabase; Master Data tetap sumber utama. | `audit:fundamental` menandai direct access dan type debt; strict-core menjaga helper kritis. | Tambah/edit/nonaktifkan akun iklan, mapping API, cabang, layanan, teknisi, payment method. | Jangan kunci RLS granular sebelum write flow master data pindah ke service/API typed. |
| Auth/Role | Login/auth client direct masih pengecualian resmi. | `smoke:role-routes` siap tetapi skip tanpa credential. | Login semua role dan reload dashboard setelah login. | Supabase Disk IO/compute tetap faktor eksternal; app harus punya timeout dan pesan jelas. |

## Gate Baru

- `npm run typecheck:strict-core`
- `npm run audit:fundamental`
- `npm run smoke:core-contracts`

## Sisa untuk Final 100%

- Isi credential smoke role/prospek agar `smoke:role-routes` dan `smoke:prospect-crud` tidak skip.
- Tambah smoke upload payment dengan fixture file kecil dan akun role yang diizinkan.
- Pindahkan write sensitif Master Data/Payment/Stock/Finance ke service/API typed sebelum RLS granular penuh.
- Setelah transport data rapi, cabut direct `insert/update/delete` dari browser untuk tabel sensitif.
