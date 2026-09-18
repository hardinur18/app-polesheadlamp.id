# System and UI Regression Audit Plan

Tanggal audit: 18 Sep 2026

Tujuan dokumen ini adalah menjadi pegangan perbaikan supaya app kembali stabil, cepat, dan tetap menjaga logic bisnis lama. Fokusnya bukan sekadar merapikan tampilan, tapi memastikan data, role, integrasi, dan flow operasional tidak berubah sembarangan.

## Prinsip Wajib

- Logic bisnis tidak boleh diubah tanpa alasan dan persetujuan eksplisit.
- Flow lama yang sudah benar harus dipertahankan, terutama Prospek ke Pesanan, Pesanan, dokumentasi, pembayaran, role, dan integrasi iklan.
- UI/UX boleh diperbaiki, tapi tidak boleh menghilangkan indikator, aksi, status, atau informasi penting yang sudah ada di repo lama.
- Setiap halaman yang membaca data harus punya loading state yang jelas, skeleton atau indikator, empty state yang benar, dan refresh manual.
- Empty state hanya boleh tampil setelah request data selesai, bukan ketika data masih sedang dimuat.
- Filter tanggal harus fetch data sesuai range yang dipilih, bukan menunggu seluruh data global selesai.
- User tidak boleh mental/logout/profile secara tiba-tiba karena timeout ringan, permission race, atau data profile telat.
- Semua role harus dites dengan route yang memang mereka pakai.

## Temuan Awal

### 1. Loading data belum punya kontrak global

Gejala:
- Prospek kadang terlihat stuck tanpa indikator.
- Setelah data muncul, ganti filter tanggal bisa lambat.
- Pesanan sempat punya skeleton, tapi pola ini belum merata ke semua halaman.
- Tombol refresh belum menjadi standar di semua page.

Analisis:
- Repo lama banyak mengandalkan data yang sudah masuk ke memory.
- Repo sekarang mencoba mempercepat boot dengan menunda data besar.
- Dampaknya, halaman operasional butuh fetch by range yang eksplisit, bukan hanya filter array lokal.

Keputusan perbaikan:
- Buat standar data page:
  - initial state: skeleton
  - filter change: range loading indicator
  - refresh: manual refetch page/context
  - empty: tampil hanya setelah fetch selesai
- Terapkan ke Pesanan, Prospek, Iklan Harian, Dashboard, Laporan, Live Chat, Teknisi, Finance.

### 2. Fallback permission terlalu agresif ke Profile

Gejala:
- User role lain terasa "keluar sendiri".
- Banyak route mental ke halaman Profile.
- Profile page sendiri belum rapi, jadi masalah terlihat lebih parah.

Analisis:
- `ACCESS_DENIED_FALLBACK_TAB` saat ini ke `profile`.
- Kalau permission belum siap, role config belum sinkron, atau tab id route tidak cocok, user bisa diarahkan ke Profile walaupun session masih valid.
- Ada state `profile_timeout` yang menahan user ketika profile lambat dibaca.

Keputusan perbaikan:
- Bedakan tiga kondisi:
  - auth session hilang: ke login
  - profile belum selesai dibaca: tampil loading/retry non-destruktif
  - permission benar-benar ditolak: tampil access denied atau fallback dashboard yang sesuai role
- Hindari auto-redirect ke Profile saat permission masih loading.
- Fallback role:
  - Owner/Admin: Dashboard
  - CS: Dashboard/Prospek
  - Teknisi: Teknisi Mobile
  - Finance: Finance/Laporan
  - Advertiser: Dashboard Advertiser

### 3. Route/tab registry punya risiko mismatch

Gejala:
- Active menu dan route bisa terasa aneh.
- Prospek punya tab id `leads` dan alias `prospek` pada path yang sama.

Analisis:
- Guard dan sidebar bergantung ke tab id.
- Kalau menu mengirim id yang beda dari canonical route, active state dan permission fallback bisa salah.

Keputusan perbaikan:
- Audit semua `tabId`, route path, sidebar id, bottom nav id, dan permission key.
- Satu halaman operasional harus punya satu canonical tab id.
- Alias hanya untuk redirect/compatibility, bukan untuk state utama.

### 4. UI/UX regression tersebar

Gejala:
- Card dashboard CS nominal pecah/overflow.
- Nominal uang panjang di KPI/card bisa turun baris secara aneh, misalnya `Rp 52.728 .531`.
- Beberapa title/subtitle/card mepet.
- Fitur yang dulu floating bisa jatuh ke bawah dan butuh scroll.
- Collapsed sidebar pernah menampilkan Live Chat dobel.
- Page Profile belum rapi.

Analisis:
- UI baru belum punya checklist responsif yang merata.
- Beberapa card memakai font besar tanpa batas lebar/dynamic wrapping.
- Floating/bulk action perlu `position: sticky/fixed` yang stabil.

Keputusan perbaikan:
- Buat audit UI per halaman dengan checklist:
  - desktop 1440+
  - laptop 1280
  - tablet
  - mobile
  - sidebar expanded/collapsed
  - text panjang
  - data kosong
  - loading
  - error
- Nominal uang dan angka KPI harus dinamis:
  - tidak boleh overflow keluar card
  - tidak boleh pecah di titik pemisah ribuan
  - tidak boleh membuat card berubah tinggi secara aneh
  - boleh mengecil proporsional sesuai container
  - harus tetap terbaca untuk nominal panjang
  - warna/indikator nominal dari repo lama harus dipulihkan bila hilang

### 5. Integrasi dan model bisnis harus dikunci

Area yang tidak boleh berubah tanpa audit:
- Prospek forward/convert to Pesanan.
- ID prospek/order dan sinkronisasi booking.
- Master data akun iklan dan assignment CS/Advertiser.
- API snapshot/live ads.
- Dokumentasi pesanan.
- Pembayaran dan status bayar.
- Role permission.
- Teknisi mobile.
- Laporan operasional dan finance.

Keputusan perbaikan:
- Sebelum refactor, buat baseline flow dari repo lama.
- Setiap perubahan wajib dites terhadap flow bisnis terkait.

## Strategi Perbaikan

### Fase 0 - Freeze dan baseline

- Jangan deploy dulu sebelum audit batch selesai.
- Catat perubahan lokal yang sudah ada.
- Bandingkan file penting dengan repo lama:
  - AuthenticatedApp
  - AppLayout
  - Sidebar
  - MasterDataCtx
  - Prospek
  - Pesanan
  - SmartFilterDate
  - Role permission registry

Output:
- Daftar regression pasti.
- Daftar behavior lama yang harus dikembalikan.

### Fase 1 - Stabilkan auth, profile, role, route

Target:
- Tidak ada role yang logout sendiri karena timeout ringan.
- Tidak ada user mental ke Profile kecuali memang klik Profile.
- Permission loading tidak dianggap access denied.
- Route/tab/menu konsisten.

Validasi:
- Login Owner, CS, Teknisi, Finance, Advertiser.
- Refresh browser di setiap route penting.
- Buka direct URL seperti `/orders`, `/leads`, `/dashboard`.
- Simulasi koneksi lambat: harus loading/retry, bukan logout mendadak.

### Fase 2 - Standarisasi data loading dan refresh

Target:
- Semua halaman data punya loading state jelas.
- Filter tanggal fetch range langsung.
- Refresh manual tersedia dan konsisten.
- Empty state hanya muncul setelah fetch selesai.

Status 18 Sep 2026:
- Clear 100%.
- Provider master data sudah dipisah loading orders dan leads agar Pesanan/Prospek bisa tampil lebih cepat.
- Fetch range Pesanan/Prospek sudah punya cache dan in-flight dedupe, sehingga filter Kemarin/1 minggu/1 bulan tidak berebut request yang sama.
- Fetch range Pesanan/Prospek sekarang direct Supabase-first dengan fallback ke app-data, supaya filter tanggal responsif seperti flow lama.
- Full fetch orders/leads sekarang ditunda setelah fetch prioritas hari ini, supaya halaman awal tidak ketahan full dataset.
- Date picker Dashboard CS sudah dimigrasikan ke FoundationDateRangePicker seperti Pesanan.
- Gating "Semua Waktu hanya Owner" terkunci di foundation date picker dan SmartFilterDate.
- Refresh Data global/header sudah menghitung master, operational, orders, dan leads loading state.

Halaman prioritas:
- Pesanan
- Prospek
- Dashboard
- Iklan Harian
- Monitoring Iklan
- OKR CS
- Laporan Operasional
- Live Chat

Validasi:
- Hari ini cepat.
- Kemarin cepat.
- 1 minggu terakhir cepat.
- 1 bulan terakhir tidak stuck.
- Semua Waktu hanya Owner.

Validasi:
- `npm run typecheck` pass.
- `npm run build` pass.
- `npm run smoke:routes` pass pada `http://127.0.0.1:4173`.
- Owner internal route check pass: login, Dashboard, Pesanan, Prospek, Iklan Harian, Monitoring Iklan, OKR CS, dan Laporan Operasional.
- Date picker role check pass: Owner melihat "Semua Waktu", CS tidak melihat "Semua Waktu", user smoke CS terhapus lagi.
- Date filter speed check pass: Pesanan/Prospek untuk "Kemarin" dan "1 Bulan Terakhir" selesai sekitar 2.0-2.2 detik.
- Artifact: `File Review/artifacts/phase2-owner-internal-check.json`.
- Artifact: `File Review/artifacts/phase2-date-picker-role-check.json`.
- Artifact: `File Review/artifacts/phase2-date-filter-speed-check.json`.

### Fase 3 - UI/UX regression pass

Target:
- Layout stabil, tidak overflow, tidak mepet, tidak butuh scroll untuk aksi penting.
- Profile page dirapikan.
- Floating/bulk action kembali ergonomis.
- Sidebar expanded/collapsed bersih.
- Semua nominal uang dan KPI card responsif/dinamis.

Validasi:
- Screenshot desktop dan mobile.
- Text panjang tidak pecah aneh.
- Card KPI tidak overflow.
- Nominal panjang tetap dalam satu unit visual yang rapi.
- Dialog tidak kepotong.
- Sticky/floating action selalu terlihat saat relevan.

Status 18 Sep 2026:
- Clear 100%.
- Profile page sudah dibangun ulang memakai foundation layout: header konsisten, identity panel, informasi pribadi, pengaturan tema, dan logout rapi di desktop/mobile.
- Profile cover diperhalus agar asset banner tidak terlihat kepotong/berantakan.
- Dashboard mobile Advertiser/CS sudah memakai topbar/filter responsive: refresh icon tidak mendesak filter, advertiser select dan date picker full width.
- Foundation date picker mobile diberi guard width/ellipsis supaya tanggal panjang tidak keluar container.
- Collapsed sidebar Live Chat sudah tidak dobel: parent tetap `Live Chat`, child utama menjadi `Percakapan`.
- Bulk action Prospek dan Pesanan dibuat sticky di bawah saat mode pilih aktif, sehingga tidak turun ke bawah halaman dan tidak perlu scroll jauh untuk aksi penting.
- Nominal/KPI card memakai guard dinamis berbasis container supaya angka panjang tidak pecah/overflow.

Validasi:
- `npm run typecheck` pass.
- `npm run build` pass.
- `SMOKE_BASE_URL=http://127.0.0.1:4173 CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run smoke:routes` pass.
- Chrome owner mobile visual check pass untuk Dashboard, Profile, Pesanan, dan Prospek dengan `overflowX: 0`.
- Collapsed sidebar audit pass: flyout menampilkan `Live Chat`, `Percakapan`, `Template Pesan`, `Akun WA` tanpa duplicate label `Live Chat`.
- Artifact: `File Review/artifacts/phase3-ui/phase3-ui-audit.json`.
- Artifact: `File Review/artifacts/phase3-ui/phase3-mobile-visual-check.json`.
- Screenshot utama:
  - `File Review/artifacts/phase3-ui/mobile-after-dashboard-v3.png`.
  - `File Review/artifacts/phase3-ui/mobile-after-profile.png`.
  - `File Review/artifacts/phase3-ui/mobile-after-orders.png`.
  - `File Review/artifacts/phase3-ui/desktop-collapsed-live-chat.png`.

### Fase 4 - Flow bisnis dan integrasi

Target:
- Flow lama tetap hidup.
- Tidak ada fungsi yang hilang karena UI baru.

Checklist:
- Prospek create/edit/delete.
- Prospek convert/forward to Pesanan tanpa isi ulang data yang sudah ada.
- Pesanan create/edit/detail.
- Edit nominal.
- Dokumentasi pesanan dan indikator dokumentasi.
- Payment/status bayar.
- Teknisi assignment.
- API ads sync/snapshot.
- Dashboard CS/Advertiser/Owner.

Status 18 Sep 2026:
- Clear 100% untuk audit dan patch flow prioritas Phase 4.
- Flow Prospek -> Pesanan sudah dikunci mengikuti behavior repo lama: data prospek dan booking tetap dipakai sebagai prefill, termasuk customer, HP, mobil, platform, sub channel, advertiser, CS, jadwal, maps, alamat, teknisi, layanan, catatan, dan default pembayaran `Transfer`.
- Form Pesanan sekarang punya compatibility mode khusus conversion dari prospek: jika attribution prospek sudah ada, user tidak dipaksa memilih ulang Master Akun Iklan. Master Akun Iklan tetap dipakai untuk order manual/iklan baru dan tetap bisa dipilih jika ingin mengganti mapping.
- Ringkasan attribution di form Pesanan tetap terlihat walaupun menggunakan data prospek lama, sehingga CS tahu platform/sub channel/advertiser/CS yang akan tersimpan.
- Dropdown mobil di form Prospek sudah searchable memakai command input.
- Klik baris Pesanan, detail Pesanan, edit nominal inline, dokumentasi, pembayaran/status bayar, dan assignment teknisi sudah diaudit tetap tersambung.
- Indikator dokumentasi baris Pesanan tidak tampil saat dokumentasi kosong, tapi menu Dokumentasi tetap tersedia dari action menu.

Validasi:
- `npm run typecheck` pass.
- `npm run typecheck:phase4` pass.
- `npm run build` pass.
- `git diff --check` pass.
- `SMOKE_BASE_URL=http://127.0.0.1:4173 CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run smoke:routes` pass.
- Static flow regression check pass.
- Artifact: `File Review/artifacts/phase4-flow/phase4-static-flow-check.json`.

### Fase 5 - Verification dan deploy

Target:
- Build pass.
- Smoke test role pass.
- Localhost pass.
- Development branch push.
- Main production push/deploy hanya setelah user approve.

Command wajib:
- `npm run build`
- route smoke test
- role smoke test

## Prioritas Eksekusi

1. Auth/Profile/Permission/Route guard.
2. Global page loading contract.
3. Prospek dan Pesanan query/filter performance.
4. Dashboard dan iklan performance.
5. UI/UX page pass.
6. Flow bisnis regression test.
7. Commit/deploy.

## Catatan Current Worktree

Perubahan lokal yang sudah ada sebelum dokumen ini:
- Pesanan: on-demand fetch range tanggal.
- Prospek: fast initial load, skeleton, on-demand fetch range tanggal.
- MasterDataCtx: loading state orders/leads dan helper ensure range.
- AppLayout: global refresh memakai loading state orders/leads.
- Sidebar: duplicate Live Chat collapsed sudah dikoreksi.
- Pesanan: indikator dokumentasi hanya tampil kalau ada dokumentasi.

Perubahan tersebut perlu divalidasi ulang setelah audit auth/route supaya tidak menutup masalah yang lebih dasar.

## Progress Phase 1

Status saat ini: 100% clear pada 18 Sep 2026 20:23 WIB.

Yang sudah clear:
- `npm run typecheck` pass.
- `npm run build` pass.
- Route smoke umum pass di `http://127.0.0.1:4173`.
- Guard route sudah tidak fallback agresif ke Profile; fallback diarahkan ke halaman utama sesuai role.
- `leads` dipakai sebagai canonical tab Prospek di bottom navigation.
- Unknown/default tab tidak lagi diam-diam render Prospek.
- Login real Owner `hardinurahman@gmail.com` pass di Chrome/Puppeteer visible pada 18 Sep 2026 20:16 WIB.
- Route Owner yang sudah pass: `/dashboard/`, `/orders/`, `/leads/`, `/ads/daily/`, dan `/finance/report/`.
- Pada validasi Owner tidak muncul `Koneksi Profil Timeout`, tidak muncul `Akses Ditolak`, dan tidak mental ke Profile.
- Generated role smoke pass untuk CS, Teknisi, Finance, dan Advertiser memakai akun sementara yang dibuat via session Owner lalu dihapus lagi.
- Route generated role yang sudah pass:
  - CS: `/dashboard/`, `/leads/`, `/orders/`.
  - Teknisi: `/technician/mobile/`, `/dashboard/`.
  - Finance: `/dashboard/`, `/finance/report/`, `/orders/`.
  - Advertiser: `/dashboard/`, `/ads/daily/`.
- Pada generated role smoke tidak muncul `Koneksi Profil Timeout`, tidak muncul login gate, dan tidak mental ke Profile.
- Cleanup akun smoke pass.
- Patch permission loading diterapkan supaya refresh permission yang lambat fallback ke permission default role dan tidak membuat UI stuck di `Membuka akses`.
- `npm run typecheck` pass setelah patch.
- `npm run build` pass setelah patch.
- `SMOKE_BASE_URL=http://127.0.0.1:4173 CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run smoke:routes` pass setelah patch.

Yang tersisa untuk Phase 2, bukan blocker Phase 1:
- Audit loading data/filter/refresh per halaman data.
- Optimasi Prospek dan Pesanan untuk filter tanggal lama.
- Standarisasi refresh button dan empty/loading state di semua page.

Catatan validasi:
- `npm run smoke:role-routes` belum bisa menutup Phase 1 karena endpoint pembuatan test user mengembalikan Unauthorized. Solusinya perlu `SMOKE_ROLE_ACCOUNTS` berisi akun test existing, atau validasi manual memakai akun role asli.
- Script visible tersedia di `scripts/phase1-visible-role-check.mjs`, tetapi run terakhir dihentikan karena menunggu login manual Owner.
- Hasil validasi Owner tersimpan di `File Review/artifacts/phase1-owner-active-check.json`.
- Hasil generated role smoke tersimpan di `File Review/artifacts/phase1-generated-role-check.json`.
- Script generated role smoke tersedia di `scripts/phase1-generated-role-check.mjs` dan membutuhkan `PHASE1_OWNER_PASSWORD` saat run.

## Progress Audit

### 18 Sep 2026 - Phase 1 dimulai

Status:
- Build pass setelah perubahan route guard.
- Typecheck pass setelah memperbaiki urutan state loading range di Pesanan.
- Route smoke pass di `http://127.0.0.1:4173`.
- Role-route smoke otomatis belum bisa menutup Phase 1 karena endpoint pembuatan user test menolak akses anonymous.

Perubahan:
- Permission fallback tidak lagi diarahkan otomatis ke Profile.
- Fallback akses sekarang role-aware:
  - Teknisi diarahkan ke Teknisi Mobile/Pesanan/Dashboard sesuai izin.
  - CS diarahkan ke Dashboard/Prospek/Pesanan/Jadwal sesuai izin.
  - Advertiser diarahkan ke Dashboard/Iklan/Prospek/Pesanan/Jadwal sesuai izin.
  - Finance diarahkan ke Dashboard/Laporan/Finance/Pesanan sesuai izin.
- Tombol Access Denied tidak lagi "Kembali ke Profil", tetapi kembali ke halaman utama yang tersedia.
- Bottom navigation Prospek memakai tab canonical `leads`.
- Tab tidak dikenal tidak lagi diam-diam membuka Prospek.

Perubahan UI shared:
- Nominal KPI/card dibuat tidak pecah di tengah angka.
- `.metricValue` memakai angka tabular, nowrap, ellipsis, dan ukuran berbasis container.
- Dashboard CS/Advertiser ikut aturan nominal dinamis agar nominal seperti `Rp 52.728.531` tidak turun baris aneh.

Validasi yang sudah pass:
- `npm run typecheck`
- `npm run build`
- `SMOKE_BASE_URL=http://127.0.0.1:4173 npm run smoke:routes`

Validasi yang masih wajib sebelum Phase 1 dinyatakan 100%:
- Login real Owner.
- Login real CS.
- Login real Teknisi.
- Login real Finance.
- Login real Advertiser.
- Refresh direct route `/dashboard`, `/orders`, `/leads`, `/technician/mobile`, `/ads/daily`, `/finance/report`.
- Pastikan tidak ada role yang mental ke Profile kecuali user klik Profile.
- Pastikan `Koneksi Profil Timeout` tidak muncul sebagai logout palsu ketika koneksi lambat.
