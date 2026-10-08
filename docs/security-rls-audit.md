# Security & RLS Audit

Tanggal audit: 2026-10-08

Dokumen ini mencatat hasil Phase 9 hardening. Target fase ini adalah memperketat akses anonim, memastikan service role tidak dipakai sebagai fallback client, dan membuat batas aman sebelum granular role permission dipindahkan ke backend/VPS.

## Ringkasan Status

- Akses `anon` ke tabel internal dicabut lewat migration `202610081130_phase9_security_rls_foundation.sql`.
- Hardening lanjutan `202610081815_lock_internal_anon_rest_access.sql` menutup sisa akses anon yang masih lolos lewat grant `PUBLIC` atau policy public/anon lama. Migration ini juga memisahkan tabel yang masih dibaca/ditulis browser authenticated, tabel snapshot read-only, dan tabel backend-only seperti payroll/payment.
- RLS dipastikan aktif untuk tabel internal utama.
- `payment_transactions` dikunci backend-only untuk `service_role`.
- Policy storage lama yang mengizinkan anonymous write ke bank logo/proof asset dihapus.
- Helper snapshot iklan sekarang wajib memakai `SUPABASE_SERVICE_ROLE_KEY`; tidak boleh fallback ke anon key.
- Auth check Google Ads, TikTok Ads, dan Meta Messaging memakai anon key lebih dulu untuk `auth.getUser`; service role hanya fallback server-side.

## Matrix Akses Saat Ini

| Area | Anon | Authenticated | Service role | Catatan |
| --- | --- | --- | --- | --- |
| `profiles` | Tidak | Read sementara | Full via server | Frontend masih perlu baca profile/current user. |
| `leads` | Tidak | CRUD sementara | Full via server | Prospek masih punya direct Supabase flow. |
| `orders` | Tidak | CRUD sementara | Full via server | Pesanan/Jadwal masih direct untuk beberapa workflow. |
| `prospect_bookings` | Tidak | CRUD sementara | Full via server | Booking prospek masih dipakai langsung oleh UI. |
| `daily_ads`, `lead_spam_daily_inputs` | Tidak | CRUD sementara | Full via server | Dashboard/input performa masih butuh direct read/write. |
| `ad_api_accounts`, `ad_account_api_mappings` | Tidak | CRUD sementara | Full via server | Perlu dipindah ke server API sebelum dikunci granular. |
| `proof_assets` | Tidak | CRUD sementara | Full via server | Upload/read proof masih ada fallback client. |
| Finance master/ledger | Tidak | CRUD sementara | Full via server | Halaman finance masih direct Supabase. |
| WhatsApp storage | Tidak | CRUD sementara | Full via server | Messaging sudah punya server flow, tapi akses lama masih perlu audit lanjutan. |
| `payment_transactions` | Tidak | Tidak | Full | Provider/payment payload backend-only. |
| Public embed form | Terbatas | Terbatas | Full | Sengaja tetap ada public policy untuk form embed. |
| Storage bank logos | Public read | Auth write | Full | Logo payment method tetap bisa ditampilkan publik. |

## Kenapa Belum Dikunci Granular Semua

Beberapa tabel masih punya policy `authenticated using (true)` karena app saat ini masih membaca/menulis langsung dari browser. Kalau policy langsung diganti menjadi role spesifik tanpa memindahkan flow ke server API atau JWT custom claim, risiko besarnya:

- login/current user bisa gagal membaca profile,
- CRUD prospek dan pesanan bisa gagal save,
- dashboard bisa kosong lagi karena query langsung ditolak RLS,
- halaman finance/master data bisa tidak bisa load.

Jadi Phase 9 mengunci lapisan yang aman dulu: anonymous access, backend-only payment transactions, storage write lama, dan service-role fallback. Granular business-role RLS perlu dilakukan setelah Phase 10/11 memindahkan CRUD sensitif ke service/API yang konsisten.

## Risiko Tersisa

- `authenticated` masih terlalu luas untuk beberapa tabel operasional.
- Beberapa flow sensitif masih direct Supabase dari frontend, terutama master data, finance, proof assets, prospek, pesanan, dan audit log.
- Bucket/file publik tetap perlu daftar eksplisit mana yang memang boleh public-read.
- Credential yang pernah dibagikan di chat harus dirotate dari dashboard penyedia sebelum dianggap production-safe.

## Verifikasi Anon REST

- Script `npm run audit:anon-rest` mengecek anon key terhadap tabel internal seperti `leads`, `orders`, `daily_ads`, `ad_accounts`, `roles`, `products`, `kv_store_f781cd00`, `payment_transactions`, dan tabel operasional lain.
- Audit ini harus dijalankan setelah migration production diterapkan. Sebelum migration `202610081815_lock_internal_anon_rest_access.sql`, anon REST masih bisa membaca minimal row dari beberapa tabel internal.
- Tabel public embed form tetap diperlakukan sebagai pengecualian terbatas; public page utama tetap memakai Edge Function, bukan direct internal-table CRUD.

## Next Hardening Untuk Nilai 10/10

1. Pindahkan write flow sensitif ke server API: leads, orders, payments, finance, ad account mapping, proof assets.
2. Tambahkan permission check server-side per role bisnis memakai permission registry yang sudah ada.
3. Setelah flow pindah, cabut `insert/update/delete` direct dari `authenticated` untuk tabel sensitif.
4. Tambahkan smoke test role-based untuk owner, CS, advertiser, dan teknisi.
5. Audit storage bucket satu per satu dan dokumentasikan public/private contract.
6. Rotate semua credential yang pernah muncul di chat atau log.
