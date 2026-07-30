# RHI System Platform Overview

## Gambaran umum

Project ini adalah aplikasi operasional internal untuk Restoration Headlamp Indonesia. Di codebase, branding yang muncul adalah `RHI System`, dengan cakupan bisnis marketing, lead handling, order lapangan, teknisi, finance, payroll, stock, dan administrasi user.

App ini bukan sekadar dashboard statis. Dari struktur kodenya, aplikasi sudah memuat:

- autentikasi Supabase
- role-based access control
- data master dan data transaksi
- realtime updates untuk order, lead, dan profile user
- public booking page untuk affiliate
- upload dokumentasi pekerjaan dan pembayaran
- hybrid backend antara tabel Postgres dan KV-backed edge functions

## Role yang saat ini dipakai

Role resmi yang didefinisikan di app:

- `Owner`
- `Super Admin`
- `Admin PIC`
- `CS`
- `Advertiser`
- `Teknisi`
- `Finance`

Catatan:

- `Owner` punya akses penuh dan bisa memakai fitur `view as role`.
- Permission default per role didefinisikan di `src/app/data/permissions.ts`.
- Permission global dan custom user bisa dioverride dari edge function permission service.

## Modul utama di aplikasi

### 1. Dashboard

- Dashboard ditampilkan sesuai role.
- Owner bisa berpindah mode tampilan seperti `Owner`, `Advertiser`, `CS`, dan `Teknisi`.
- Komponen inti berada di `src/app/pages/Dashboard.tsx` dan dashboard per-role ada di folder `src/app/pages/owner`, `src/app/pages/advertiser`, `src/app/pages/cs`, dan `src/app/pages/technician`.

### 2. Marketing dan perolehan lead

- `Iklan Harian` untuk input dan evaluasi performa iklan harian.
- `Monitoring Perf.` untuk target vs realisasi marketing.
- `Affiliate` untuk pengelolaan referral/partner.
- Public booking form tersedia di route `/booking?ref=<affiliateId>`.

### 3. Prospek

- Halaman `Prospek` menangani daftar lead, filter, bulk edit, WhatsApp template, dan konversi lead ke order.
- File utama: `src/app/pages/Prospek.tsx`.
- Lead bisa datang dari input internal maupun public booking affiliate.

### 4. Pesanan dan assignment lapangan

- Halaman `Pesanan` menangani CRUD order, filter kompleks, map preview, import/export, status order, dan dokumentasi pembayaran.
- File utama: `src/app/pages/Pesanan.tsx`.
- Order menghubungkan data pelanggan, cabang, CS, advertiser, teknisi, layanan, pembayaran, lokasi, dan histori template WhatsApp.

### 5. Teknisi dan monitoring

- `TeknisiMobile` menjadi area kerja teknisi untuk melihat order yang ditugaskan dan mengunggah dokumentasi lapangan.
- `Pemantauan Lapangan` dan `Aktivitas Teknisi` dipakai untuk memonitor progres operasional.
- `Jadwal Saya` dan `Ketersediaan Teknisi` menangani konteks penjadwalan teknisi.

### 6. Keuangan

- `Pembayaran`
- `Kas Masuk/Keluar`
- `Hutang & Piutang`
- `Pengeluaran Rutin`
- `Payroll & Gaji`

Modul payroll cukup kaya karena memuat salary profile, KPI, simulasi payroll, dan pembatasan data berdasarkan role viewer.

### 7. Inventaris

- Manajemen stock dipisah menjadi data produk, transaksi/mutasi, laporan valuasi, dan pengaturan.
- File shell modul: `src/app/pages/stock/StockManagementPage.tsx`.

### 8. Administrasi

- `Master Data`
- `Pengguna & Akses`
- `Role Permission`
- `Template WhatsApp`

Halaman user management juga mengelola pembuatan akun sistem, reset password, custom permission, dan advertiser access config.

## Alur bisnis yang tercermin di codebase

Alur utama yang terlihat dari implementasi:

1. Lead masuk dari marketing internal atau dari public booking affiliate.
2. CS melakukan follow up, update status, dan bisa mengirim template WhatsApp.
3. Lead dikonversi menjadi order dari halaman Prospek atau dibuat langsung dari modul Pesanan.
4. Order dijadwalkan, diberi cabang, layanan, metode pembayaran, dan teknisi.
5. Teknisi menjalankan order, mengunggah foto sebelum/sesudah, lalu status bergerak sesuai progres lapangan.
6. Pembayaran, cashflow, laporan operasional, payroll, dan stock ikut membaca data transaksi yang sama atau turunannya.

## Arsitektur frontend

### Bootstrapping

- `src/main.tsx` merender `App` di dalam `ErrorBoundary`.
- `src/app/App.tsx` memasang `ThemeProvider` dan `RouterProvider`.

### Routing

Routing browser saat ini sangat tipis:

- `/` -> `AuthenticatedApp`
- `/booking` -> `PublicBookingPage`
- `*` -> fallback ke `AuthenticatedApp`

Artinya, mayoritas navigasi dalam aplikasi tidak memakai route URL terpisah. Tab internal dipilih memakai state `activeTab` di `AppLayout`.

### Auth gate

`src/app/AuthenticatedApp.tsx` bertanggung jawab untuk:

- cek session Supabase
- subscribe ke perubahan auth state
- auto logout setelah 24 jam inactivity
- membungkus app dengan `MasterDataProvider` dan `PermissionsProvider`

### Shell UI

`src/app/components/layout/AppLayout.tsx` adalah shell utama yang menangani:

- sidebar
- topbar
- active tab
- access check per tab
- redirect ke halaman aman jika permission tidak cukup

`src/app/components/Sidebar.tsx` membangun menu berdasarkan permission aktif.

### Shared context

`src/app/pages/master-data/context/MasterDataCtx.tsx` adalah pusat data client-side. Context ini:

- memuat master data
- memuat data transaksi
- menyediakan helper CRUD
- menyinkronkan profile user dari session
- mengatur realtime subscription
- menjadi sumber `currentUser` dan `currentRole`

### Permission layer

`src/app/hooks/usePermissions.tsx` menggabungkan:

- permission default per role dari `src/app/data/permissions.ts`
- global override dari edge function
- custom permission per user
- fitur `view as role` untuk Owner

## Arsitektur data dan backend

### 1. Supabase client

Client dibuat di `src/lib/supabaseClient.ts` menggunakan:

- `projectId`
- `publicAnonKey`

Keduanya diambil dari file autogen `utils/supabase/info.tsx`.

### 2. Data yang dibaca langsung dari Postgres

Dari `MasterDataCtx`, tabel utama yang dibaca langsung dari Supabase antara lain:

- `profiles`
- `branches`
- `areas`
- `services`
- `vehicle_types`
- `ad_platforms`
- `ad_sub_channels`
- `ad_accounts`
- `ad_sources`
- `payment_methods`
- `roles`
- `affiliates`
- `vendors`
- `cancel_reasons`
- `leads`
- `orders`
- `wa_templates`
- `daily_ads`
- `technician_schedules`
- `audit_logs`

Payroll juga membaca tabel tambahan seperti:

- `salary_profiles`
- `kpi_library`
- `employee_kpi_assignments`
- `recurring_expenses`
- `technician_daily_reports`

### 3. Realtime

Realtime subscription aktif untuk:

- `orders`
- `leads`
- `profiles`

Efek praktisnya:

- order baru bisa memunculkan toast dan notification
- perubahan lead/order lebih cepat sinkron di UI
- perubahan profile user ikut menyegarkan daftar user

### 4. Edge functions

Server-side logic utama berada di `supabase/functions/server`.

Untuk deployment production, function Supabase yang dipanggil frontend bernama `make-server-f781cd00` dan entrypoint wrapper-nya berada di `supabase/functions/make-server-f781cd00/index.ts`.

Root service menggunakan Hono dan diekspos lewat path:

- `/functions/v1/make-server-f781cd00/*`

Kemampuan penting yang ada di sana:

- create/delete user
- reset password
- verify email
- public API untuk lead/order/affiliate tertentu
- permission service
- payroll service
- advertiser access config
- manual debts
- reports
- targets
- stock settings, products, dan transactions
- short URL expansion untuk Google Maps

### 5. KV store

Sebagian fitur masih memakai KV store `kv_store_f781cd00` sebagai backend ringan. Ini membuat arsitekturnya bersifat hybrid:

- sebagian data langsung ke tabel Postgres
- sebagian fitur dibungkus edge function dan disimpan ke KV

Pola ini dipakai terutama untuk:

- permission override
- advertiser access config
- stock helper data
- manual debts
- reports
- targets
- beberapa endpoint legacy untuk lead/order/affiliate

### 6. Storage

Frontend saat ini memakai bucket storage:

- `orders` untuk dokumentasi order
- `avatars` untuk avatar user

Catatan teknis:

- bootstrap server masih memiliki logic `ensureBucket("make-f781cd00")`
- jadi provisioning bucket di client dan server masih belum sepenuhnya satu pola

## Public booking affiliate

Route publik ada di `src/app/pages/affiliates/PublicBookingPage.tsx`.

Flow-nya:

- membaca query param `ref`
- mencoba validasi affiliate langsung ke tabel `affiliates`
- jika gagal atau terhalang RLS, fallback ke edge function affiliate endpoint
- mengirim lead baru ke edge function server

Ini berarti public booking sudah didesain untuk tetap jalan walau akses tabel langsung tidak selalu tersedia.

## Struktur folder penting

```text
.
|-- src
|   |-- app
|   |   |-- App.tsx
|   |   |-- AuthenticatedApp.tsx
|   |   |-- routes.ts
|   |   |-- components
|   |   |-- data
|   |   |-- hooks
|   |   |-- pages
|   |   |   |-- auth
|   |   |   |-- affiliates
|   |   |   |-- finance
|   |   |   |-- stock
|   |   |   |-- users
|   |   |   `-- master-data
|   |   `-- services
|   |-- lib
|   |-- styles
|   `-- utils
|-- supabase
|   `-- functions
|       |-- make-server-f781cd00
|       `-- server
|-- utils
|   `-- supabase
|       `-- info.tsx
|-- README.md
`-- APP_OVERVIEW.md
```

## File yang paling penting untuk dipelajari dulu

Kalau ingin onboarding cepat ke project ini, urutan baca yang paling efektif:

1. `README.md`
2. `src/app/AuthenticatedApp.tsx`
3. `src/app/components/layout/AppLayout.tsx`
4. `src/app/hooks/usePermissions.tsx`
5. `src/app/pages/master-data/context/MasterDataCtx.tsx`
6. `src/app/pages/Prospek.tsx`
7. `src/app/pages/Pesanan.tsx`
8. `supabase/functions/server/index.tsx`

## Catatan development lokal

- Script yang tersedia saat ini hanya `npm run dev` dan `npm run build`.
- Belum ada script test otomatis di `package.json`.
- Repo ini belum menyertakan `node_modules`, jadi dependency harus di-install dulu.
- Auth login menggunakan email/password Supabase.
- Aksi "daftar" di halaman login belum membuat akun langsung; tombolnya mengarah ke WhatsApp admin.

## Ringkasan teknis

Kalau diringkas dalam satu kalimat: project ini adalah web app operasional multi-role dengan frontend React yang cukup tebal, state sharing lewat context, permission yang fleksibel, dan backend Supabase hybrid antara tabel langsung, realtime, storage, dan edge functions berbasis KV.
