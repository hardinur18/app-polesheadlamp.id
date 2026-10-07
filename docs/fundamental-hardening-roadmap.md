# Fundamental Hardening Roadmap

Terakhir update: 2026-10-07

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
- [~] Dashboard API distabilkan total.
- [~] Phase 4 data access standardization dimulai: inventory direct Supabase/API sudah dibuat.
- [ ] CRUD prospek, pesanan, payment, dan master data diaudit penuh.
- [ ] Security/RLS diaudit dan dirapikan penuh.
- [ ] Refactor file besar selesai.
- [ ] Test automation core flow lengkap.
- [ ] Final release checklist 100% pass.

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

## Phase 5 - Dashboard API & Snapshot

Tujuan: data spending, lead dashboard, match akun, dan status API stabil.

- [ ] Audit sumber data spending.
- [ ] Audit sumber data lead dashboard.
- [ ] Audit tabel snapshot API.
- [ ] Audit mapping akun iklan internal.
- [ ] Audit kasus Rahmansa 9 dan Rahmansa 10.
- [ ] Audit penyebab akun "belum match".
- [x] Tombol "Cek Belum Match API" diarahkan ke tab/section spesifik.
- [ ] UI membaca database hasil sync, bukan menunggu API eksternal terus-menerus.
- [ ] Refresh API hanya menjalankan sync snapshot.
- [ ] Cache dashboard punya TTL dan invalidation yang jelas.

Definition of done:

- Data dashboard tetap tampil dari database snapshot.
- Kalau API eksternal gagal, angka terakhir yang valid tetap terlihat dengan status jelas.
- Akun belum match bisa dilacak sumbernya.

Catatan progress 2026-10-07:

- Warning CS dashboard untuk snapshot API belum match sekarang membuka Master Data Akun Iklan langsung ke view `Belum Match API`.
- Deep link pairing API tetap membawa `action=pair-api`, `platform`, `externalAccountId`, dan search query agar dialog pairing bisa fokus ke akun yang bermasalah.
- Deep link `pair-api` tidak lagi memaksa balik ke view `Integrasi API` kalau URL sudah membawa view spesifik seperti `Belum Match API`.

## Phase 6 - Prospek CRUD

Tujuan: prospek bisa save stabil dan aturan duplicate tidak merusak flow valid.

- [x] Migration prevent exact active duplicate sudah diterapkan.
- [x] Trigger duplicate exact aktif terverifikasi.
- [ ] Test exact duplicate nama + nomor aktif ditolak.
- [ ] Test nomor sama nama beda muncul warning, bukan block.
- [ ] Test tambah prospek normal.
- [ ] Test edit prospek normal.
- [ ] Test forward prospek ke booking.
- [ ] Test forward booking ke order.
- [ ] Pastikan tidak ada false conflict untuk slot kosong.
- [ ] Pastikan error message user-friendly.

Definition of done:

- Prospek bisa save.
- Duplicate rule sesuai kebutuhan bisnis.
- Forward booking/order tidak salah conflict.

## Phase 7 - Pesanan, Jadwal, dan Assignment

Tujuan: CRUD pesanan stabil walau punya banyak side effect bisnis.

- [ ] Audit create order.
- [ ] Audit update order.
- [ ] Audit update status order.
- [ ] Audit validasi jadwal.
- [ ] Audit assignment teknisi.
- [ ] Audit conflict slot jadwal.
- [ ] Audit sync lifecycle order/prospect.
- [ ] Pisahkan side effect yang bisa async/deferred.
- [ ] Pastikan update kecil tidak menjalankan sync besar yang tidak perlu.

Definition of done:

- Input/update pesanan stabil.
- Jadwal tidak false conflict.
- Side effect terukur dan tidak membuat UI terasa macet.

## Phase 8 - Payment & Proof Assets

Tujuan: pelaporan payment, modal dokumentasi, dan upload bukti stabil di desktop/mobile.

- [ ] Audit modal dokumentasi pekerjaan.
- [ ] Audit scroll modal payment di mobile.
- [ ] Audit upload bukti pembayaran.
- [ ] Audit read proof assets.
- [ ] Audit update status bayar.
- [ ] Audit permission CS untuk payment.
- [ ] Test modal desktop.
- [ ] Test modal mobile.

Definition of done:

- Modal bisa scroll normal.
- Upload/read bukti stabil.
- Footer modal tidak mepet atau ketutup.

## Phase 9 - Security & RLS

Tujuan: akses database tidak terlalu longgar dan role user benar-benar dibatasi.

- [ ] Audit semua grant `anon`.
- [ ] Audit semua policy `using (true)`.
- [ ] Audit semua policy `with check (true)`.
- [ ] Audit akses `authenticated` yang terlalu luas.
- [ ] Audit tabel sensitif: users, profiles, leads, orders, payments, finance.
- [ ] Cabut akses yang tidak perlu.
- [ ] Pastikan service role hanya dipakai di server.
- [ ] Rotate credential yang pernah dibagikan di chat.
- [ ] Dokumentasikan matrix role permission.

Definition of done:

- Role user sesuai batas bisnis.
- Secret tidak terekspos di frontend/repo.
- RLS tidak lagi terlalu permisif untuk tabel kritis.

## Phase 10 - Refactor Struktur Besar

Tujuan: mengurangi risiko perubahan kecil bikin error besar.

- [ ] Pecah `MasterDataCtx.tsx`.
- [ ] Pecah `supabase/functions/server/index.tsx`.
- [ ] Pecah `supabase/functions/server/meta_messaging.tsx`.
- [ ] Pecah dashboard CS logic.
- [ ] Pecah pesanan logic.
- [ ] Pecah prospek logic bila masih terlalu padat.
- [ ] Pindahkan logic bisnis ke service/helper yang bisa dites.
- [ ] Pastikan refactor tidak mengubah perilaku bisnis.

Definition of done:

- File besar turun ukuran dan tanggung jawabnya jelas.
- Component lebih fokus ke UI.
- Service lebih fokus ke data/business logic.

## Phase 11 - Type Safety

Tujuan: mengurangi bug akibat data shape tidak jelas.

- [ ] Audit `as any`.
- [ ] Audit `@ts-ignore`.
- [ ] Buat type untuk payload API utama.
- [ ] Buat type untuk dashboard snapshot.
- [ ] Buat type untuk prospek/order/payment.
- [ ] Aktifkan strict mode bertahap per area.
- [ ] Hilangkan `any` di flow kritis.

Definition of done:

- Flow kritis punya type yang jelas.
- TypeScript mulai benar-benar membantu cegah bug.

## Phase 12 - Test Automation

Tujuan: bug besar bisa ketangkap sebelum push/live.

- [ ] Test login/session.
- [ ] Test permission role.
- [ ] Test prospek duplicate.
- [ ] Test forward booking/order.
- [ ] Test pesanan jadwal conflict.
- [ ] Test dashboard snapshot.
- [ ] Test payment modal/upload.
- [ ] Test master data mapping akun API.
- [ ] Tambah release checklist yang wajib pass sebelum deploy.

Definition of done:

- Core flow punya test otomatis.
- Deploy tidak hanya mengandalkan manual feeling.

## Phase 13 - Observability & Error Handling

Tujuan: kalau ada error live, sumbernya cepat ketemu.

- [ ] Audit semua `console.log` liar.
- [ ] Standarkan error message user-facing.
- [ ] Standarkan error logging developer-facing.
- [ ] Tambah error boundary untuk area rawan.
- [ ] Tambah log context untuk API critical path.
- [ ] Siapkan opsi error monitoring eksternal.

Definition of done:

- Error user jelas.
- Error developer bisa dilacak.
- Tidak ada spam log yang bikin diagnosis makin susah.

## Phase 14 - Final Verification

Tujuan: memastikan app sudah layak dianggap fundamental kuat.

- [ ] `npm run typecheck:full` pass.
- [ ] `npm run lint` pass.
- [ ] `npm run build` pass.
- [ ] Smoke routes pass.
- [ ] Smoke role routes pass.
- [ ] Smoke prospek CRUD pass.
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
