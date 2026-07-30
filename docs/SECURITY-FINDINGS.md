# Security & Quality Findings — Backlog

> Status: **NOT YET FIXED.** Audit dilakukan 2026-06-15. Temuan di bawah ini sengaja **TIDAK** dieksekusi karena setiap perbaikannya mengubah perilaku/akses sistem yang sedang berjalan. Pemilik meminta agar logic/sistem/fungsi yang ada tidak diubah. Gunakan dokumen ini untuk memutuskan & menjadwalkan perbaikan secara terpisah, satu per satu, dengan pengujian.
>
> Yang **sudah** dibereskan (aman, tanpa ubah perilaku) tercatat di bagian "Sudah dikerjakan" paling bawah.

## Cara baca severity
- **Critical** — potensi kebocoran data / ambil-alih akun. Tangani lebih dulu.
- **High** — melemahkan pertahanan secara signifikan.
- **Medium/Low** — perbaikan bertahap.

---

## CRITICAL

### C1. Edge Function lama `make-server-0cdce7b6` nyaris tanpa auth
- **Risiko:** Memakai `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS). Dari ~87 route, hanya ~24 yang mengecek auth. Route terbuka antara lain: `GET /finance/users` (dump semua user), `POST /finance/users` (buat/ubah user + set `role_id` → eskalasi privilege), `DELETE /finance/users/:id`, `POST /signup` (buat akun tanpa autentikasi).
- **Lokasi:** `supabase/functions/make-server-0cdce7b6/index.ts` (lihat `:2605`, `:2610`, `:2670`, `:1778`, `:5176-5247`).
- **Langkah aman:** (1) Pastikan apakah fungsi ini masih ter-deploy (`supabase functions list`). (2) Jika tidak dipakai klien (tidak dirujuk `src/` maupun script deploy) → undeploy + hapus sumbernya. (3) Jika masih dipakai → tambahkan cek auth di setiap route sebelum apa pun.
- **Kenapa hati-hati:** Mungkin ada integrasi eksternal yang diam-diam memakainya. Konfirmasi traffic dulu sebelum menonaktifkan.

### C2. Kebijakan RLS `using(true)` membuka tabel PII ke `anon`
- **Risiko:** Siapa pun dengan anon key publik (dikirim ke setiap browser) bisa CRUD langsung via PostgREST, melewati logika permission edge function.
- **Tabel terdampak & migrasi:**
  - `prospect_bookings` — PII pelanggan (nama, telepon, alamat) — `supabase/migrations/20260412_add_prospect_bookings.sql:39-59`
  - `ad_account_assignments` — `20260508_grant_ad_account_assignments_access.sql:6-11`
  - `ad_account_owner_assignments` — `20260601_create_ad_account_owner_assignments.sql:42-47`
  - `lead_spam_daily_inputs` — `20260511_create_lead_spam_daily_inputs.sql:47-52`
- **Langkah aman:** Buat migrasi baru yang `drop policy` permisif lalu buat ulang dengan scope `service_role` saja, atau `auth.uid()`-based. **Uji menyeluruh** apakah ada jalur klien yang membaca tabel ini langsung (bukan via edge function) sebelum mengetatkan — itu yang akan "putus" bila ada.

---

## HIGH

### H1. Webhook Meta "fail open" saat `META_APP_SECRET` kosong
- **Risiko:** `verifyWebhookSignature` mengembalikan `true` bila secret kosong → digabung deploy `--no-verify-jwt`, webhook jadi jalur tulis tak-terautentikasi ke KV store (spoof percakapan + DoS).
- **Lokasi:** `supabase/functions/server/meta_messaging.tsx:196-201`.
- **Langkah aman:** Ubah jadi fail-closed (tolak bila secret tidak ada). **Prasyarat:** pastikan `META_APP_SECRET` benar-benar ter-set di environment produksi dulu, kalau tidak webhook yang sah akan ikut tertolak.

### H2. Model auth bergantung pada cek per-handler
- **Risiko (sistemik):** Gateway Supabase hanya melihat anon key publik sebagai Bearer; JWT user asli ada di header `x-client-token` yang diverifikasi manual di tiap handler. Endpoint yang lupa memanggil helper auth = terbuka penuh.
- **Lokasi:** `src/app/services/internal/sessionClientHeaders.ts:46`, helper `requireAuthorizedRequester`/`hasEffectivePermission` di `supabase/functions/server/`.
- **Langkah aman:** Pertimbangkan verifikasi JWT user asli di level gateway, atau audit otomatis yang memastikan setiap route memanggil helper auth.

### H3. CORS `origin: "*"` pada API data
- **Lokasi:** `supabase/functions/server/index.tsx:42-51`.
- **Langkah aman:** Batasi ke domain aplikasi. Uji semua origin sah (app utama, preview Cloudflare) agar tidak memutus akses.

### H4. `xlsx@0.18.5` rentan & memparse file upload user
- **Risiko:** CVE Prototype Pollution + ReDoS; versi npm tak lagi di-maintain. Dipakai untuk parsing file impor user (input tak tepercaya): `useOrderImport`, `VehicleImportModal`, dll (6 file).
- **Langkah aman:** Pindah ke build SheetJS dari CDN resmi, atau ganti `exceljs`. **Uji** semua fitur ekspor/impor Excel setelah migrasi karena API bisa berbeda.

### H5. CI tidak punya quality gate sebelum (perbaikan ini)
- Sudah diperbaiki sebagian — lihat bagian "Sudah dikerjakan". **Sisa:** migrasi DB auto-apply ke produksi saat merge ke `main` tanpa validasi PR (`.github/workflows/supabase-migrations-delivery.yml`). Pertimbangkan langkah dry-run migrasi di PR.

### H6. `scripts/smoke-role-routes.mjs` memodifikasi PRODUKSI
- **Risiko:** Membuat & menghapus user asli di project Supabase live, dan menyimpan anon JWT produksi hardcoded.
- **Lokasi:** `scripts/smoke-role-routes.mjs:7-8`.
- **Langkah aman:** Arahkan ke project staging, atau gunakan akun test khusus yang diisolasi. Jangan dijalankan terhadap produksi.

---

## MEDIUM

### M1. Login default ke role `Owner` bila profil hilang
- **Risiko:** Jalur self-promote ke privilege tertinggi bila baris profil hilang tapi `auth.users` masih ada.
- **Lokasi:** `src/app/pages/auth/LoginPage.tsx:34-42`.
- **Langkah aman:** Default ke privilege terendah, idealnya ditentukan server-side.

### M2. Anon key + project ref hardcoded di beberapa script
- **Lokasi:** `utils/supabase/info.tsx:9-11`, `scripts/smoke-role-routes.mjs:8`, `scripts/perf-mobile-baseline.mjs:8`, `scripts/google-ads-snapshot-refresh.mjs:4`.
- **Catatan:** Anon key memang publik (Medium), tapi sebaiknya dari env, bukan fallback hardcoded.

### M3. `react-signature-canvas` versi alpha di produksi
- **Lokasi:** `package.json` (dipakai 2 file). Pertimbangkan versi stabil.

---

## LOW

- **L1.** Endpoint `expand-url` & `verify-email` pada fungsi aktif tidak terautentikasi (SSRF dibatasi allowlist domain). `supabase/functions/server/index.tsx:2204`, `:1688`.
- **L2.** KV `getByPrefix` pakai `like(prefix + '%')` tanpa escape `%`/`_` — aman selama prefix internal. `supabase/functions/server/kv_store.tsx:82`.
- **L3.** Tidak ada rate limiting pada endpoint sync (potensi amplifikasi biaya/DoS ringan).
- **L4.** Satu ErrorBoundary global saja — error render satu halaman membuat seluruh app blank. `src/main.tsx`, `src/app/components/ErrorBoundary.tsx`.
- **L5.** TypeScript `strict: false` + `noImplicitAny: false`; ESLint mematikan `no-explicit-any` & `ban-ts-comment`. Banyak `any`. Pengetatan bertahap disarankan.

---

## Sudah dikerjakan (2026-06-15, aman tanpa ubah perilaku)
- Hapus 4 dependency mati (`react-slick`, `react-dnd`, `react-dnd-html5-backend`, `terser`) — terverifikasi nol pemakaian.
- Hapus 10 file kode mati (varian `Topbar`/`KPICard` ganda, `useMediaQuery.tsx` kembar, `mockUsers.ts`, `mockAffiliates.ts`, `UserAuditLog.tsx`, `DesignSystem.tsx`, `Login.tsx` demo) — terverifikasi tidak diimpor dari mana pun.
- `.gitignore`: abaikan `File Review/artifacts/` (artefak smoke yang di-regenerate) & `docs/generated/`; lepaskan artefak dari tracking git (file tetap ada di disk).
- `package.json`: tambah `engines.node >=18`, hapus blok `pnpm.overrides` mati.
- CI (`pages-delivery.yml` job `validate`): tambah gate `typecheck:full` + `lint` pada PR.

> Catatan: `File PNG/Polesheadlamp.id (1).png` **tidak** disentuh — ternyata aset runtime (logo invoice) yang diimpor `src/app/pages/orders/orderInvoice.ts`.
