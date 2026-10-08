# Fundamental Hardening Roadmap

Terakhir update: 2026-10-08

Dokumen ini dipakai sebagai tracker perapihan fundamental RHI System sebelum migrasi VPS.
Targetnya bukan sekadar "bug hilang", tapi struktur app makin stabil, aman, terukur, dan mudah dirawat.

## Status Legend

- `[ ]` Belum dikerjakan
- `[~]` Sedang dikerjakan
- `[x]` Selesai dan sudah diverifikasi
- `[!]` Blocker / perlu keputusan owner

## Target Akhir

- Login stabil untuk semua role.
- CRUD inti stabil dan tidak saling merusak.
- Dashboard menampilkan data dari sumber yang benar dan cepat.
- Query database tidak boros Disk IO.
- Struktur code tidak bergantung pada file raksasa.
- Security database dan API lebih ketat.
- Test dan checklist rilis bisa mencegah regresi.
- App siap disiapkan untuk migrasi VPS setelah fondasinya kuat.

## Progress Saat Ini

- [x] Audit awal struktur app dilakukan.
- [x] Worktree dicek bersih sebelum pembuatan tracker ini.
- [x] Baseline commit dicatat: `32b236c Center login form in PWA layout`.
- [x] `npm run typecheck:full` pass pada baseline 2026-10-07.
- [x] `npm run lint` pass pada baseline 2026-10-07.
- [x] `npm run build` pass pada baseline 2026-10-07.
- [x] `npm run smoke:release` exit code pass pada baseline 2026-10-07.
- [x] `npm run dependency:health` terakhir diketahui pass.
- [x] Migration duplicate prospek sudah dijalankan manual di Supabase.
- [x] Trigger duplicate prospek terverifikasi aktif di database.
- [x] Audit query dan index database Phase 2 selesai: dashboard snapshot, orders/leads/schedule, daily ads/spam, proof assets, dan payment hot path sudah dirapikan/ditandai.
- [~] Auth/login distabilkan: bootstrap current-user dipercepat, test login semua role masih perlu credential.
- [x] Dashboard API distabilkan total untuk pola snapshot DB, manual sync, cache TTL, dan mapping API baru.
- [~] Phase 4 data access standardization dimulai: inventory direct Supabase/API sudah dibuat.
- [x] Phase 6 Prospek CRUD dirapikan: duplicate guard, warning nomor sama beda nama, error message, dan smoke coverage inti.
- [x] Phase 7 Pesanan/Jadwal dirapikan: validasi jadwal diaudit, error order dirapikan, dan side effect update kecil dijaga.
- [x] Phase 8 Payment & Proof Assets dirapikan: modal scroll-safe, upload bukti bayar lebih stabil, dan proof asset dialog aman di mobile.
- [ ] CRUD prospek, pesanan, payment, dan master data diaudit penuh.
- [~] Security/RLS diaudit dan dirapikan: anonymous access ditutup ulang lewat migration lanjutan, service-role fallback sudah dirapikan; granular RLS menunggu refactor data access.
- [x] Phase 10 refactor struktur besar selesai untuk batch fundamental: server app-data, MasterDataCtx, dashboard CS/Advertiser, pesanan, prospek, modal shared, API snapshot, dan Iklan Harian sudah dirapikan tanpa mengubah flow bisnis utama.
- [x] Phase 11 type safety flow kritis selesai: `@ts-ignore` global dibersihkan, payload app-data, sync iklan harian, Iklan Harian, dan flow pesanan utama sudah typed.
- [~] Test automation core flow lengkap: smoke contract deterministic sudah ada; login real-role dan payment upload masih perlu credential/manual.
- [~] Observability/error handling distandarkan: client error reporter, app boundary, route boundary, dan global runtime listener sudah ada.
- [~] Sisa phase lama dipetakan ulang: audit debt fundamental, strict-core gate, dan matrix CRUD inti sudah dibuat.
- [~] Final release checklist: gate lokal pass; smoke role/prospek real dan manual role masih butuh credential.

## Phase 1 - Baseline Safety

Tujuan: memastikan semua pekerjaan berikutnya punya titik ukur yang jelas dan tidak menimpa kerja agent lain.

- [x] Cek `git status` sebelum membuat tracker.
- [x] Buat checklist progress hardening.
- [x] Catat commit baseline terakhir yang dianggap stabil: `32b236c Center login form in PWA layout`.
- [x] Jalankan baseline `npm run typecheck:full`: pass.
- [x] Jalankan baseline `npm run lint`: pass.
- [x] Jalankan baseline `npm run build`: pass.
- [x] Jalankan smoke test yang tersedia: `smoke:routes` pass; `smoke:role-routes` dan `smoke:prospect-crud` skipped karena credential smoke belum disediakan.
- [x] Dokumentasikan error yang masih muncul di local/live: smoke role/prospect butuh credential; build memberi warning non-blocking Browserslist data lama.

Definition of done:

- Semua hasil command dicatat.
- Tidak ada perubahan agent lain yang ikut tersentuh.
- Ada baseline jelas sebelum refactor dimulai.

## Phase 2 - Database Stability

Tujuan: mengurangi timeout, Disk IO spike, query lambat, dan data yang terasa "hilang".

- [x] Audit tabel besar dan query paling sering dipakai.
- [~] Audit query login/session/profile/role: bootstrap current user sudah dipangkas dan fallback cache/profil sudah ada; perlu manual test credential.
- [~] Audit query dashboard CS/Advertiser/Teknisi: query snapshot iklan Meta/Google/TikTok sudah difilter di level database.
- [~] Audit query prospek: range `leads.created_at` dan duplicate trigger sudah dicek; perlu smoke credential untuk CRUD end-to-end.
- [~] Audit query pesanan dan jadwal: range `orders.service_date`, `orders.lead_date`, `prospect_bookings.schedule_date`, dan schedule lookup sudah dicek.
- [x] Audit query payment dan proof assets.
- [x] Tambah index yang benar-benar dibutuhkan: migration `202610071720_optimize_ads_snapshot_reads.sql` disiapkan untuk snapshot iklan dan `202610071735_optimize_operational_hot_reads.sql` disiapkan untuk orders/leads/schedule/daily ads/spam.
- [x] Hapus atau kurangi query duplikat: server snapshot tidak lagi fetch semua akun lalu filter di memory untuk request scoped; daily ads/spam dashboard tidak lagi full history bootstrap.
- [x] Pastikan scheduler/API snapshot tidak membanjiri database.
- [x] Buat catatan query yang masih mahal dan butuh refactor lanjutan.

Definition of done:

- Query inti punya index yang sesuai.
- Load dashboard/login tidak memicu query berulang berlebihan.
- Tidak ada query berat yang jalan otomatis tanpa alasan kuat.

Catatan progress 2026-10-07:

- `fetchAdsDailySnapshots` sekarang menerima filter `externalAccountIds` dan `externalGroupId`.
- Endpoint snapshot Meta, Google, dan TikTok memakai filter database untuk request akun/group spesifik.
- Matching Meta account ID dibuat lebih tahan beda format `act_...` vs tanpa prefix.
- Fallback latest-known snapshot diturunkan dari 5000 row ke 1000 row di client dan server.
- Migration index snapshot ditambahkan untuk pola read by account/group/latest synced.
- Migration index operational hot path ditambahkan untuk `orders.service_date`, `orders.lead_date`, `leads.created_at`, `technician_schedules.date`, `daily_ads.date/account/cs/advertiser`, dan `lead_spam_daily_inputs.input_date/scope`; `prospect_bookings.schedule_date` sudah punya index lama.
- Server `app-data` sekarang punya whitelist filter/order untuk hot table (`leads`, `prospect_bookings`, `orders`, `daily_ads`, `lead_spam_daily_inputs`, `technician_schedules`, `audit_logs`, dan `proof_assets`) sehingga fallback range tidak diam-diam berubah menjadi full-ish fetch.
- Dashboard CS/Advertiser sekarang meminta `daily_ads` dan `lead_spam_daily_inputs` berdasarkan periode aktif, bukan menunggu bootstrap historis.
- Bootstrap dashboard/ads/reports hanya prefetch input performa bulan berjalan; range lain dimuat on demand.
- Auto-refresh snapshot dashboard diturunkan dari 60 detik ke 5 menit dan tetap tidak menjalankan sync API kecuali tombol manual `Muat Ulang API`.
- Proof assets sudah memakai `app-data` limit 500 + index `is_active, created_at desc`; payment transaction punya index `order_id`, `payment_request_id`, dan `reference_id`. Payment status operasional tetap ikut hot path `orders`.
- Query yang masih mahal untuk phase lanjutan: full-history `orders/leads` di halaman reports/finance, beberapa direct Supabase query lama di halaman finance/stock/report, dan file server/index yang masih terlalu besar.
- Verifikasi terakhir setelah Phase 2: `npm run typecheck:full`, `npm run lint`, `npm run build`, `npm run smoke:release`, dan `npm run dependency:health` pass pada 2026-10-07. `smoke:routes` pass penuh; `smoke:role-routes` dan `smoke:prospect-crud` exit pass tetapi statusnya skip karena credential smoke belum tersedia/unauthorized untuk create user temporary.

## Phase 3 - Auth & Session Stability

Tujuan: login tidak stuck, role cepat kebaca, dan user tidak terjebak loading.

- [~] Audit flow login Supabase: login direct auth dan cached session sudah ada; perlu test role credential.
- [~] Audit session restore saat reload: cached session/current user sudah ada; perlu manual test login asli.
- [~] Audit loading dashboard setelah login: timeout profile direct/fallback dipangkas.
- [x] Pastikan timeout auth punya pesan jelas.
- [x] Pastikan gagal auth tidak dianggap password salah kalau server timeout.
- [ ] Test login owner.
- [ ] Test login CS.
- [ ] Test login advertiser.
- [ ] Test login teknisi.
- [ ] Test reload halaman dashboard setelah login.

Definition of done:

- Semua role bisa login.
- Reload tidak stuck di loading panjang.
- Error login membedakan password salah, network error, dan server timeout.

Catatan progress 2026-10-07:

- Timeout direct current-user profile dikurangi dari 5 detik ke 4 detik.
- Fallback app-data current-user dibatasi 2,5 detik dan 1 page karena query sudah `eq id`.
- Tujuannya memangkas worst-case loading setelah login/reload saat Supabase sedang lambat.
- Verifikasi setelah patch: `npm run typecheck:full`, `npm run lint`, `npm run build`, dan `npm run smoke:release` pass. Smoke role/prospect masih skip karena credential smoke belum tersedia.

## Phase 4 - Data Access Standardization

Tujuan: akses data lebih konsisten dan siap dipindahkan ke backend/VPS nanti.

- [x] Petakan semua direct Supabase call dari frontend.
- [x] Petakan semua endpoint Edge Function/API yang aktif.
- [~] Tandai CRUD yang wajib lewat server/API.
- [~] Tandai read-only query yang masih boleh langsung ke Supabase sementara.
- [~] Standarkan pola `service -> API -> database` untuk flow kritis.
- [ ] Kurangi logic bisnis di component/page.
- [x] Buat dokumentasi data flow utama: `docs/data-access-inventory.md`.

Definition of done:

- Flow kritis tidak tersebar random di component.
- Ada aturan jelas kapan pakai API dan kapan boleh direct Supabase.

Catatan progress 2026-10-07:

- Inventory data access dibuat di `docs/data-access-inventory.md`.
- Audit menemukan sekitar 323 match akses Supabase langsung di frontend, sekitar 89 penggunaan helper API `buildMakeServerUrl`, dan sekitar 144 route handler Edge Function.
- Aturan target sudah ditulis: auth client boleh direct, write kritis wajib lewat server/API, read-only sementara boleh direct hanya kalau scoped/indexed/non-sensitive.
- Fondasi API client standar ditambahkan di `src/app/services/internal/apiClient.ts` untuk request Edge Function dengan timeout, session/public headers, query builder, JSON parsing, dan error envelope yang konsisten. Belum ada domain aktif yang direfactor memakai helper ini agar tidak konflik dengan agent lain.
- Verifikasi Phase 4 sementara: `npm run typecheck:full` dan `npm run lint` pass setelah penambahan dokumentasi dan API client.
- Hotspot refactor berikutnya: stock, finance/payment, prospek, pesanan, dashboard snapshot, proof assets, dan audit log.
- Catatan 2026-10-08: script `npm run audit:fundamental` ditambahkan untuk menghitung direct Supabase access, storage access, explicit `any`, TypeScript suppression, dan `console.log` mentah. Baseline audit terakhir: 314 file discan; direct table access 55, direct storage access 25, explicit any 714, TypeScript suppression 0, console.log 118.

## Phase 5 - Dashboard API & Snapshot

Tujuan: data spending, lead dashboard, match akun, dan status API stabil.

- [x] Audit sumber data spending.
- [x] Audit sumber data lead dashboard.
- [x] Audit tabel snapshot API.
- [x] Audit mapping akun iklan internal.
- [x] Audit kasus Rahmansa 9 dan Rahmansa 10.
- [x] Audit penyebab akun "belum match".
- [x] Tombol "Cek Belum Match API" diarahkan ke tab/section spesifik.
- [x] UI membaca database hasil sync, bukan menunggu API eksternal terus-menerus.
- [x] Refresh API hanya menjalankan sync snapshot.
- [x] Cache dashboard punya TTL dan invalidation yang jelas.

Definition of done:

- Data dashboard tetap tampil dari database snapshot.
- Kalau API eksternal gagal, angka terakhir yang valid tetap terlihat dengan status jelas.
- Akun belum match bisa dilacak sumbernya.

Catatan progress 2026-10-07:

- Warning CS dashboard untuk snapshot API belum match sekarang membuka Master Data Akun Iklan langsung ke view `Belum Match API`.
- Deep link pairing API tetap membawa `action=pair-api`, `platform`, `externalAccountId`, dan search query agar dialog pairing bisa fokus ke akun yang bermasalah.
- Deep link `pair-api` tidak lagi memaksa balik ke view `Integrasi API` kalau URL sudah membawa view spesifik seperti `Belum Match API`.

Catatan progress 2026-10-08:

- CS Dashboard dan Advertiser Dashboard sekarang ikut membaca mapping dari `ad_account_api_mappings`, bukan hanya config legacy Meta/Google/TikTok. Ini menutup kasus akun seperti Rahmansa 9/10 yang sudah dipair dari view `Belum Match API` tetapi belum ikut terhitung di dashboard.
- Source operasional spending dan Lead Dashboard distandarkan ke `daily_ads`. `ads_live_daily_snapshots` tetap dipakai sebagai raw staging/audit dari provider eksternal, lalu tombol `Sinkron API` meng-commit snapshot terpetakan ke `daily_ads`.
- Cache dataset snapshot localStorage diberi TTL 24 jam dan entry stale otomatis dihapus, sehingga angka valid terakhir masih bisa tampil saat API eksternal gagal tanpa membuat data basi menetap terlalu lama.
- Advertiser Dashboard sekarang juga menandai status `Perlu mapping` saat ada snapshot spend/lead yang belum cocok ke akun internal, dan tombolnya deep link ke `master-data?tab=ad-accounts&view=unmatched&action=pair-api`.
- Verifikasi Phase 5: `npm run typecheck:full`, `npm run lint`, `npm run build`, dan `npm run smoke:routes` pass.

## Phase 6 - Prospek CRUD

Tujuan: prospek bisa save stabil dan aturan duplicate tidak merusak flow valid.

- [x] Migration prevent exact active duplicate sudah diterapkan.
- [x] Trigger duplicate exact aktif terverifikasi.
- [x] Test exact duplicate nama + nomor aktif ditolak disiapkan di `smoke:prospect-crud`.
- [x] Test nomor sama nama beda tidak diblok disiapkan di `smoke:prospect-crud`; warning UI tetap ada di `LeadForm`.
- [x] Test tambah prospek normal disiapkan di `smoke:prospect-crud`.
- [x] Test edit prospek normal disiapkan di `smoke:prospect-crud`.
- [x] Forward prospek ke booking diaudit: save booking melewati validasi jadwal fresh DB dan error user-friendly.
- [x] Forward booking ke order diaudit: booking dengan `leadId` yang sama diabaikan dari conflict agar konversi tidak false conflict.
- [x] Pastikan tidak ada false conflict untuk slot kosong: local dan fresh DB validator sudah memakai ignored booking lead id.
- [x] Pastikan error message user-friendly: error duplicate, permission, timeout, constraint, dan jadwal diterjemahkan untuk UI Prospek.

Definition of done:

- Prospek bisa save.
- Duplicate rule sesuai kebutuhan bisnis.
- Forward booking/order tidak salah conflict.

Catatan progress 2026-10-08:

- UI Prospek sekarang memakai helper pesan error `prospectCrudErrors` agar error Supabase/Postgres tidak tampil mentah ke user.
- `smoke:prospect-crud` diperluas dari create-update-delete menjadi create, exact duplicate rejected, same phone different name allowed, update, dan cleanup.
- Auto WA API lead capture diperkuat: normalisasi nomor WhatsApp menangani format `620...`, error unique duplicate tidak lagi dianggap webhook fatal, dan migration `202610081430_guard_auto_wa_lead_duplicates.sql` menambahkan unique guard untuk exact duplicate aktif baru plus view audit `active_lead_exact_duplicate_audit` untuk duplicate lama.
- Verifikasi code Phase 6: `npm run typecheck:full`, `npm run lint`, dan `npm run build` pass.
- Verifikasi API real `smoke:prospect-crud` exit pass tetapi statusnya skip karena credential smoke belum tersedia di env. Saat credential smoke diisi, skenario duplicate dan add/edit akan jalan otomatis.

## Phase 7 - Pesanan, Jadwal, dan Assignment

Tujuan: CRUD pesanan stabil walau punya banyak side effect bisnis.

- [x] Audit create order: create tetap validasi local + fresh DB, lalu sync CRM/lifecycle async setelah order tersimpan.
- [x] Audit update order: update form memakai patch minimal dan skip fresh validation kedua setelah fresh validation form sukses.
- [x] Audit update status order: status aktif/nonaktif tetap memicu lifecycle sync hanya saat field lifecycle benar-benar berubah.
- [x] Audit validasi jadwal: validasi hanya berjalan untuk order aktif dengan teknisi + tanggal + jam lengkap.
- [x] Audit assignment teknisi: perubahan teknisi/cabang/tanggal/jam tetap memicu local dan fresh DB schedule validation.
- [x] Audit conflict slot jadwal: order aktif dan booking prospek aktif dicek; cancelled/reschedule dan booking lead yang sedang dikonversi diabaikan.
- [x] Audit sync lifecycle order/prospect: booking/lead sync tetap ada, berjalan background dengan retry ringan.
- [x] Pisahkan side effect yang bisa async/deferred: CRM snapshot dan lifecycle order sudah queued/non-blocking.
- [x] Pastikan update kecil tidak menjalankan sync besar yang tidak perlu: update foto/payment/koordinat tidak lagi memicu CRM/lifecycle jika field relevan tidak berubah.

Definition of done:

- Input/update pesanan stabil.
- Jadwal tidak false conflict.
- Side effect terukur dan tidak membuat UI terasa macet.

Catatan progress 2026-10-08:

- `updateOrder` sekarang hanya menjalankan CRM sync bila field kontak/alamat berubah, dan hanya menjalankan lifecycle sync bila field lead/status/jadwal/assignment berubah.
- `updateOrderPatch` juga membandingkan nilai lama vs nilai baru, bukan sekadar melihat nama field patch, sehingga patch no-op tidak memicu sync tambahan.
- Error pesanan distandarkan lewat `orderCrudErrors`: jadwal bentrok tetap tampil spesifik, permission/timeout/constraint diterjemahkan ke pesan yang lebih jelas.
- Error handling dipasang ke `OrderForm`, quick status, bulk update, dan inline order patch di `Pesanan`.
- Verifikasi Phase 7: `npm run typecheck:full`, `npm run lint`, `npm run build`, dan `npm run smoke:routes` pass.

## Phase 8 - Payment & Proof Assets

Tujuan: pelaporan payment, modal dokumentasi, dan upload bukti stabil di desktop/mobile.

- [x] Audit modal dokumentasi pekerjaan.
- [x] Audit scroll modal payment di mobile.
- [x] Audit upload bukti pembayaran.
- [x] Audit read proof assets.
- [x] Audit update status bayar.
- [x] Audit permission CS untuk payment.
- [x] Test modal desktop via build/smoke route.
- [x] Test modal mobile via responsive CSS guard; manual data-login test masih perlu credential role.

Definition of done:

- Modal bisa scroll normal.
- Upload/read bukti stabil.
- Footer modal tidak mepet atau ketutup.

Catatan progress 2026-10-08:

- Modal global sekarang punya guard `min-height`, body scroll, overscroll containment, dan safe-area footer agar dialog tidak mentok di viewport kecil/mobile.
- Modal Dokumentasi Pekerjaan diperkuat: tab/content tetap punya ruang scroll, area upload bukti pembayaran tidak mepet bawah, dan layout mobile tidak mengunci tinggi secara salah.
- Upload bukti pembayaran memakai nama file unik berbasis timestamp + random UUID, mengirim `contentType`, dan otomatis membersihkan flag `paymentDeleted` saat bukti baru berhasil diupload.
- Dialog Pembayaran Pesanan dirapikan agar kartu ringkasan, QRIS, dan footer aman di mobile.
- Proof Asset Library dialog diberi max-height, momentum scroll, dan padding safe-area pada form/detail/forward actions.
- Permission CS untuk upload bukti tetap dipertahankan sesuai flow yang ada; update status bayar tetap dibatasi permission `order.payment.edit_status`.
- Verifikasi Phase 8: `npm run typecheck:full`, `npm run lint`, `npm run build`, dan `npm run smoke:routes` pass. Manual upload/read dengan akun CS asli belum dijalankan karena credential role tidak tersedia di env lokal.

## Phase 9 - Security & RLS

Tujuan: akses database tidak terlalu longgar dan role user benar-benar dibatasi.

- [x] Audit semua grant `anon`.
- [x] Audit semua policy `using (true)`.
- [x] Audit semua policy `with check (true)`.
- [~] Audit akses `authenticated` yang terlalu luas: sudah dipetakan, tapi belum semua bisa dicabut karena beberapa flow frontend masih direct Supabase.
- [x] Audit tabel sensitif: users, profiles, leads, orders, payments, finance.
- [~] Cabut akses yang tidak perlu: anon dicabut untuk tabel internal dan `payment_transactions` dikunci backend-only; migration lanjutan menutup grant `PUBLIC`/policy public yang masih bocor; akses `authenticated` granular menunggu refactor data access.
- [x] Pastikan service role hanya dipakai di server.
- [!] Rotate credential yang pernah dibagikan di chat.
- [x] Dokumentasikan matrix role permission: `docs/security-rls-audit.md`.

Definition of done:

- Role user sesuai batas bisnis.
- Secret tidak terekspos di frontend/repo.
- RLS tidak lagi terlalu permisif untuk tabel kritis.

Catatan progress 2026-10-08:

- Migration `202610081130_phase9_security_rls_foundation.sql` ditambahkan untuk memastikan RLS aktif, mencabut akses `anon` dari tabel internal, mengunci `payment_transactions` hanya untuk `service_role`, dan menghapus anonymous storage write policy lama.
- Migration `202610081815_lock_internal_anon_rest_access.sql` ditambahkan karena audit live menemukan beberapa tabel internal masih bisa dibaca anon lewat grant `PUBLIC` atau policy public/anon lama. Migration ini mencabut `PUBLIC/anon`, drop policy public/anon internal, memisahkan tabel browser-authenticated, read-only snapshot, dan service-role-only payroll/payment, lalu membuat ulang policy minimal agar app tidak patah.
- `ads_snapshot_store` sekarang wajib memakai `SUPABASE_SERVICE_ROLE_KEY`; tidak lagi fallback ke anon key.
- Auth check Google Ads, TikTok Ads, dan Meta Messaging memakai anon key lebih dulu untuk `auth.getUser`, dengan service role hanya sebagai fallback server-side.
- Granular RLS per role bisnis belum dipaksakan penuh karena frontend masih punya direct Supabase access untuk beberapa CRUD inti. Kalau langsung dicabut, risiko login, prospek, pesanan, dashboard, finance, dan master data patah.
- Detail audit dan matrix akses ada di `docs/security-rls-audit.md`.

## Phase 10 - Refactor Struktur Besar

Tujuan: mengurangi risiko perubahan kecil bikin error besar.

- [x] Pecah `MasterDataCtx.tsx`.
- [x] Pecah `supabase/functions/server/index.tsx`.
- [x] Pecah `supabase/functions/server/meta_messaging.tsx`.
- [x] Pecah dashboard CS logic.
- [x] Pecah dashboard Advertiser logic.
- [x] Pecah pesanan logic.
- [x] Pecah prospek logic bila masih terlalu padat.
- [x] Pindahkan logic bisnis ke service/helper yang bisa dites.
- [x] Pastikan refactor tidak mengubah perilaku bisnis.

Definition of done:

- File besar turun ukuran dan tanggung jawabnya jelas.
- Component lebih fokus ke UI.
- Service lebih fokus ke data/business logic.

Catatan progress 2026-10-08:

- Permission matrix dan config generic `app-data` dipindah dari `supabase/functions/server/index.tsx` ke `supabase/functions/server/app_data_access.ts`.
- Handler generic `/make-server-f781cd00/app-data/:type` dipindah ke `supabase/functions/server/app_data_routes.tsx`.
- Route path, permission check, duplicate guard leads, audit log, schema fallback, dan response shape tetap dipertahankan lewat dependency dari `index.tsx`.
- `server/index.tsx` turun dari sekitar 5.293 baris menjadi sekitar 4.693 baris setelah ekstraksi awal.
- Verifikasi setelah ekstraksi: `npm run typecheck:full`, `npm run lint`, `npm run build`, `npm run smoke:routes`, dan `git diff --check` pass.
- Helper cache/range/bootstrap `MasterDataCtx` dipisah ke `masterDataCache.ts`, `currentUserBootstrap.ts`, `masterDataBootstrapPlan.ts`, dan `masterDataRangeUtils.ts`.
- Helper pemicu side-effect order CRUD dipisah ke `orderSideEffectGuards.ts`; pemanggilan `addOrder`, `updateOrder`, dan `updateOrderPatch` tetap memakai kontrak yang sama.
- Verifikasi setelah ekstraksi helper `MasterDataCtx`: `npm run typecheck:full`, `npm run lint`, dan `git diff --check` pass.
- Helper KPI/formatter/presentational table `CSDashboard` dipindah ke `src/app/pages/cs/internal/csDashboardKpiHelpers.tsx`; logic API snapshot, mapping akun, CRUD spam input, dan kalkulasi data tetap di `CSDashboard.tsx`.
- Verifikasi setelah ekstraksi helper dashboard CS: `npm run typecheck:full`, `npm run lint`, dan `git diff --check` pass.
- Konstanta env/config Meta-Kirimdev-WhatsApp dipindah ke `supabase/functions/server/meta_messaging_config.ts`.
- Type domain Meta Messaging dipindah ke `supabase/functions/server/meta_messaging_types.ts`.
- Helper storage key, util umum, signature/webhook verification, HTTP client Meta/Kirimdev, access guard, dan validasi media dipisah ke file helper khusus.
- Route path, exported webhook handler, permission behavior, signature behavior, response shape, dan flow kirim/broadcast/webhook tetap dipertahankan.
- Verifikasi setelah ekstraksi helper Meta Messaging: `npm run typecheck:full`, `npm run lint`, `npm run build`, `npm run smoke:routes`, dan `git diff --check` pass.
- Helper dokumentasi foto pesanan dipindah ke `src/app/pages/orders/orderDocumentation.tsx`.
- UI modal dokumentasi pekerjaan dipindah ke `src/app/pages/orders/OrderPhotoViewerDialog.tsx`; state upload, tab aktif, dan handler save tetap dikontrol dari `Pesanan.tsx`.
- Helper model form order dipindah ke `src/app/pages/orders/orderFormModel.ts`, termasuk normalisasi nomor, mode sumber order, dedupe by id, dan patch builder edit order.
- Helper UI kecil halaman pesanan dipindah ke `src/app/pages/orders/orderPageUi.tsx`, termasuk action button dan skeleton table/mobile.
- Refactor Pesanan ini tidak mengubah kontrak `addOrder`, `updateOrder`, `updateOrderPatch`, validasi jadwal, payment status, atau flow booking/order.
- Helper pure halaman Prospek dipindah ke `src/app/pages/leads/prospectModel.ts`, termasuk konstanta filter/page size, deteksi Auto WA API, sort template WA, map booking terbaru/aktif, formatter booking/status, dan preview catatan.
- UI kecil halaman Prospek dipindah ke `src/app/pages/leads/prospectPageUi.tsx`, termasuk ikon WhatsApp, badge Auto WA API, dan skeleton table/mobile.
- Schema/helper form Prospek dipindah ke `src/app/pages/leads/leadFormModel.ts`; kontrak `LeadForm`, duplicate warning, submit add/edit, assignment advertiser/platform/subchannel/CS, dan flow booking/order tetap dipertahankan.
- Verifikasi setelah ekstraksi Prospek: `npm run typecheck:full` dan `npm run lint` pass.
- Helper UI/formatter dashboard Advertiser dipindah ke `src/app/pages/advertiser/internal/advertiserDashboardUi.tsx`, termasuk format currency/number/percent, badge cost/volume/ROAS, status class API, dan skeleton KPI.
- Refactor dashboard Advertiser ini hanya memindahkan presentational helper; flow sync API, cache snapshot, mapping akun, filter CS/advertiser, dan kalkulasi data tetap di `AdvertiserDashboard.tsx`.
- Verifikasi setelah ekstraksi helper dashboard Advertiser: `npm run typecheck:full`, `npm run lint`, dan `git diff --check` pass.
- Dashboard CS dibersihkan lagi: type status API, label/class status, dan skeleton KPI dipindah ke `src/app/pages/cs/internal/csDashboardKpiHelpers.tsx`; page tetap memegang flow data, filter, dan CRUD spam input.
- Modal shared diperkuat dengan body scroll lock berbasis counter supaya nested/stacked modal tidak saling merusak scroll halaman.
- Iklan Harian dibersihkan dari preview API lama yang fetch provider langsung di page. Preview/commit rekap API sekarang satu pintu lewat `adsDailySyncService`, sedangkan import spreadsheet/manual CRUD tetap memakai flow lama yang sama.
- Merge snapshot API diperkuat: bila provider tidak mengirim external account id, key merge fallback ke internal account id atau nama akun/grup sehingga akun berbeda di tanggal sama tidak saling menimpa.
- Service sync iklan tetap memakai pola database hasil sync sebagai sumber UI; snapshot provider eksternal hanya staging/audit sebelum commit ke `daily_ads`.
- Verifikasi final Phase 10: `npm run typecheck:full`, `npm run lint`, `npm run build`, `npm run smoke:routes`, dan `git diff --check` pass pada 2026-10-08. Build masih menampilkan warning non-blocking Browserslist data lama.

## Phase 11 - Type Safety

Tujuan: mengurangi bug akibat data shape tidak jelas.

- [x] Audit `as any` di flow kritis: pesanan utama, order form/import/export/filter, Iklan Harian, ads daily sync, dan app-data route.
- [x] Audit `@ts-ignore`: tidak ada lagi `@ts-ignore/@ts-expect-error` di `src`, `supabase/functions`, dan `scripts`.
- [x] Buat type untuk payload API utama: app-data route sudah memakai typed payload/query/error response.
- [x] Buat type untuk dashboard snapshot iklan: mapper sync iklan harian dan row hasil database sudah typed.
- [x] Buat type untuk order/payment kritis: order photos, payment deletion metadata, shadow status, import, bulk action, filter, export, dan form enum guard sudah typed.
- [~] Aktifkan strict mode bertahap per area: `npm run typecheck:strict-core` sudah tersedia dan pass untuk helper kritis.
- [x] Hilangkan `any` di flow kritis Phase 11.
- [~] Sisa debt global non-kritis: repo masih punya `any` di area legacy/lower-risk di luar scope Phase 11 ini dan perlu dibersihkan bertahap agar tidak menimbulkan refactor besar sekaligus.

Definition of done:

- Flow kritis punya type yang jelas.
- TypeScript mulai benar-benar membantu cegah bug.
- Verifikasi Phase 11: `npm run typecheck:full`, `npm run lint`, `npm run build`, `npm run smoke:routes`, dan `git diff --check` pass pada 2026-10-08. Build masih menampilkan warning non-blocking Browserslist data lama.
- Catatan 2026-10-08: `tsconfig.strict-core.json` ditambahkan untuk strict checking bertahap pada recoverable errors, error telemetry, internal service helpers, schedule validation, social contact helper, prospect model, order form model, dan order side-effect guards. Strict-core pass setelah null-safety guard kecil di helper social handle dan off-schedule validator.

## Phase 12 - Test Automation

Tujuan: bug besar bisa ketangkap sebelum push/live.

- [ ] Test login/session.
- [ ] Test permission role.
- [~] Test prospek duplicate: skenario sudah ada di `smoke:prospect-crud`, eksekusi real masih butuh credential smoke.
- [x] Test forward booking/order.
- [x] Test pesanan jadwal conflict.
- [x] Test dashboard snapshot.
- [ ] Test payment modal/upload.
- [~] Test master data mapping akun API: provider key dan reconcile snapshot sudah otomatis; pairing UI masih perlu browser/manual.
- [x] Tambah release checklist yang wajib pass sebelum deploy.

Definition of done:

- Core flow punya test otomatis.
- Deploy tidak hanya mengandalkan manual feeling.

Catatan progress 2026-10-08:

- Script `npm run smoke:core-contracts` ditambahkan untuk test deterministic tanpa credential dan tanpa koneksi live.
- Coverage smoke contract mencakup conflict jadwal order/booking, false conflict saat booking lead yang sama dikonversi ke order, validasi slot aktif/nonaktif, normalisasi nomor order, patch minimal order, helper Prospek Auto WA/latest booking, provider key iklan, dan reconcile preview daily ads agar edit manual tidak tertimpa.
- `smoke:release` sekarang menjalankan `smoke:core-contracts` sebelum smoke role/prospek, sehingga regresi contract inti bisa tertangkap lebih awal meskipun credential smoke live belum tersedia.
- Verifikasi Phase 12 sementara: `npm run smoke:core-contracts` pass pada 2026-10-08.

## Phase 13 - Observability & Error Handling

Tujuan: kalau ada error live, sumbernya cepat ketemu.

- [~] Audit semua `console.log` liar.
- [~] Standarkan error message user-facing.
- [~] Standarkan error logging developer-facing.
- [x] Tambah error boundary untuk area rawan.
- [ ] Tambah log context untuk API critical path.
- [ ] Siapkan opsi error monitoring eksternal.

Definition of done:

- Error user jelas.
- Error developer bisa dilacak.
- Tidak ada spam log yang bikin diagnosis makin susah.

Catatan progress 2026-10-08:

- Utility `errorTelemetry` ditambahkan untuk normalisasi error, friendly message, incident id, dedupe log 10 detik, dan rolling error report di `sessionStorage`.
- `ErrorBoundary` app-level dan `RouteErrorBoundary` sekarang melaporkan error lewat reporter yang sama, menampilkan reference id, dan menyembunyikan detail mentah di production.
- Global `window.error` dan `unhandledrejection` listener ditambahkan di entrypoint, dengan ignore khusus untuk stale chunk/DOM removal yang sudah punya auto-reload recovery.
- Verifikasi Phase 13 foundation: `npm run typecheck:full` dan `npm run lint` pass pada 2026-10-08.

## Phase 14 - Final Verification

Tujuan: memastikan app sudah layak dianggap fundamental kuat.

- [x] `npm run typecheck:full` pass.
- [x] `npm run typecheck:strict-core` pass.
- [x] `npm run lint` pass.
- [x] `npm run build` pass.
- [x] `npm run audit:fundamental` pass.
- [~] `npm run audit:anon-rest` tersedia; harus pass setelah migration anon REST diterapkan ke Supabase production.
- [x] Smoke routes pass.
- [~] Smoke role routes pass: script exit pass, tetapi skenario real skip karena credential smoke belum tersedia.
- [~] Smoke prospek CRUD pass: script exit pass, tetapi skenario real skip karena credential smoke belum tersedia.
- [ ] Manual login semua role pass.
- [ ] Manual dashboard CS/Advertiser/Teknisi pass.
- [ ] Manual prospek pass.
- [ ] Manual pesanan pass.
- [ ] Manual payment pass.
- [ ] Final audit security pass.
- [ ] Final commit dibuat.
- [ ] Push ke remote.
- [ ] Deploy live terverifikasi.

Definition of done:

- Tidak ada blocker utama.
- Semua flow inti lolos.
- Dokumentasi progress terupdate.

Catatan progress 2026-10-08:

- Final gate lokal yang sudah pass: `npm run typecheck:full`, `npm run typecheck:strict-core`, `npm run lint`, `npm run build`, `npm run audit:fundamental`, dan `npm run smoke:release`.
- `smoke:release` menjalankan route smoke dan core contract smoke penuh. `smoke:role-routes` serta `smoke:prospect-crud` exit pass tetapi status internalnya `skipped` karena belum ada credential smoke Owner/CS untuk test real login/CRUD.
- `smoke:role-routes` dan `smoke:prospect-crud` sekarang mendukung `SMOKE_SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` sebagai opsi runtime-only untuk membuat akun smoke sementara dan cleanup tanpa menyimpan credential di repo.
- Audit non-destruktif live sebelum migration `202610081815_lock_internal_anon_rest_access.sql` menemukan anon REST masih bisa membaca beberapa tabel internal/master data seperti `branches`, `services`, `leads`, `orders`, `daily_ads`, `ad_accounts`, `roles`, `products`, dan `kv_store_f781cd00`. Ini ditutup lewat migration baru dan perlu diverifikasi ulang setelah migration diterapkan.

## Catatan Prioritas

Urutan kerja yang direkomendasikan:

1. Baseline safety.
2. Database stability.
3. Auth/session stability.
4. Dashboard API snapshot.
5. Prospek CRUD.
6. Pesanan CRUD.
7. Payment/proof assets.
8. Security/RLS.
9. Refactor struktur besar.
10. Type safety.
11. Test automation.
12. Observability.
13. Final verification.

## Catatan Penting

- VPS migration ditahan dulu sampai roadmap fundamental ini stabil.
- Setiap perubahan besar harus melalui verifikasi lokal sebelum commit.
- Jangan deploy perubahan yang ikut membawa kerja agent lain tanpa review.
- Setiap credential yang pernah muncul di chat harus dianggap bocor dan perlu rotate.
