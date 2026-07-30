# Current Architecture Map for Polesheadlamp.id

Status: Reference detail  
Date: 2026-04-20  
Scope: Current-state documentation only  
Document role: Supporting reference for current architecture analysis  
Change policy: No UI/UX changes and no logic changes are included in this document

## Purpose

Dokumen ini memetakan arsitektur repo `Polesheadlamp.id` sebagaimana adanya saat ini.

Fokusnya adalah:

- menjelaskan jalur boot aplikasi dari browser sampai shell utama
- menjelaskan pola navigasi, auth, data access, dan backend boundary
- menandai domain utama dan file pusatnya
- menandai titik coupling dan hotspot yang perlu diwaspadai di fase berikutnya

Dokumen ini tidak mengusulkan perubahan runtime. Ini hanya peta kondisi sekarang.

## Sources Used

Pemetaan ini disusun dari:

- `README.md`
- `APP_OVERVIEW.md`
- `PLATFORM_OVERVIEW.md`
- inspeksi file utama di `src/`
- inspeksi file utama di `supabase/functions/`
- inspeksi file dokumentasi di `File Review/`

## High-Level Topology

Arsitektur app saat ini dapat diringkas seperti ini:

1. Browser membuka aplikasi Vite SPA.
2. `src/main.tsx` memuat global CSS, Marketing OS theme, dan me-render `App`.
3. `src/app/App.tsx` membungkus aplikasi dengan `ThemeProvider` dan `RouterProvider`.
4. Router browser sangat tipis:
   - `/` -> `AuthenticatedApp`
   - `/booking` -> `PublicBookingPage`
   - `/payment-gateway-preview` -> `PaymentGatewayPreviewPage`
   - `*` -> `AuthenticatedApp`
5. `AuthenticatedApp` memeriksa session Supabase.
6. Jika belum login, app me-render `LoginPage`.
7. Jika sudah login, app membungkus shell dengan:
   - `MasterDataProvider`
   - `PermissionsProvider`
   - `AppLayout`
8. `AppLayout` menjadi shell utama yang mengontrol mayoritas navigasi internal menggunakan state `activeTab`.
9. Data utama datang dari tiga jalur:
   - query langsung ke Supabase Postgres via `supabase-js`
   - request ke Supabase Edge Functions berbasis Hono
   - service/adapters khusus untuk live integration dan workspace Marketing OS

## Runtime Boot Flow

### 1. Frontend entrypoint

File utama:

- `src/main.tsx`
- `src/app/App.tsx`

Tanggung jawab `src/main.tsx`:

- mount React app ke `#root`
- membungkus app dengan `ErrorBoundary`
- memuat CSS global app
- memuat CSS foundation `marketing-os`
- melakukan reset tertentu untuk local dev:
  - unregister service worker
  - clear cache browser
  - reset theme marker di localStorage

Tanggung jawab `src/app/App.tsx`:

- memasang `ThemeProvider`
- bridge class `dark` dan `data-theme` ke DOM
- memasang `RouterProvider`

### 2. Browser route layer

File utama:

- `src/app/routes.ts`

Kondisi sekarang:

- route browser masih sangat tipis
- tidak ada pemetaan URL terpisah untuk mayoritas modul internal
- import `LoginPage` ada, tetapi route `/login` belum dipakai sebagai route browser terpisah

Implikasi:

- mayoritas pengalaman aplikasi internal bukan route-driven
- state navigasi utama hidup di shell app, bukan di URL browser

### 3. Auth gate

File utama:

- `src/app/AuthenticatedApp.tsx`

Tanggung jawab:

- cek session Supabase saat startup
- subscribe ke perubahan auth state
- menampilkan loading screen saat session check
- me-render `LoginPage` jika belum ada session
- memasang `MasterDataProvider` dan `PermissionsProvider` jika session valid
- menerapkan auto logout setelah 24 jam inactivity berbasis `localStorage`

## Navigation Model

### Current navigation pattern

File utama:

- `src/app/components/layout/AppLayout.tsx`
- `src/app/components/Sidebar.tsx`

Kondisi sekarang:

- navigasi internal utama dikendalikan oleh state `activeTab`
- `Sidebar` membentuk menu berdasarkan permission aktif
- `AppLayout` memetakan `activeTab` ke komponen halaman lewat `switch`
- redirect internal juga banyak dilakukan lewat perubahan `activeTab`

Konsekuensi arsitektural:

- shell memegang tanggung jawab besar: permission, fallback redirect, title page, dan pemilihan konten
- URL browser belum menjadi sumber kebenaran utama untuk internal app state
- beberapa domain besar masih berbagi shell yang sama dan dipindah lewat state

### Special sub-navigation

Ada beberapa area yang membangun "route semantics" internal meski belum menjadi browser routes utama:

- Ads Monitoring workspace
- Conversation workspace
- Marketing OS workspace
- Inventory sub-tabs
- Dashboard per role/view mode

## Theme and Design Layer

File utama:

- `src/styles/theme.css`
- `src/styles/globals.css`
- `src/marketing-os/foundation/theme.css`

Kondisi sekarang:

- main app memiliki token dan theme CSS sendiri
- `marketing-os` juga memiliki foundation/theme sendiri
- kedua stylesheet dimuat bersamaan di entrypoint

Implikasi:

- ada dua lapisan visual system yang hidup dalam satu runtime
- `marketing-os` bukan proyek terpisah penuh, tetapi sub-area dengan design language sendiri di dalam host app

## Core State and Data Layer

### 1. Supabase client

File utama:

- `src/lib/supabaseClient.ts`
- `utils/supabase/info.tsx`

Kondisi sekarang:

- satu client Supabase dipakai lintas aplikasi
- runtime bisa membaca konfigurasi dari env Vite
- jika env tidak tersedia, app memakai fallback default project id dan anon key

### 2. MasterDataProvider as central data hub

File utama:

- `src/app/pages/master-data/context/MasterDataCtx.tsx`

Ini adalah pusat data client-side paling penting di repo saat ini.

Tanggung jawab utamanya:

- memuat banyak master table
- memuat banyak transactional table
- menyediakan generic CRUD helper
- menyinkronkan `currentUser` dari session Supabase
- memuat advertiser config dari Edge Function
- memuat lead social contact dari Edge Function
- memasang realtime subscription untuk tabel tertentu
- menyediakan `currentRole`, `currentUser`, notification helper, dan refresh trigger

Table yang dimuat pada initial fetch di context ini:

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
- `profiles`
- `leads`
- `prospect_bookings`
- `orders`
- `wa_templates`
- `daily_ads`
- `technician_schedules`
- `audit_logs`

Data tambahan yang tidak dibaca langsung dari tabel biasa:

- `lead_social_contacts` lewat endpoint master data Edge Function
- `access-configs` advertiser lewat Edge Function

Realtime subscription yang aktif di `MasterDataCtx`:

- `orders`
- `leads`
- `prospect_bookings`
- `profiles`

Kesimpulan:

`MasterDataCtx` saat ini adalah pusat coupling terbesar di sisi frontend.

### 3. PermissionsProvider as overlay layer

File utama:

- `src/app/hooks/usePermissions.tsx`
- `src/app/data/permissions.ts`

Tanggung jawab:

- memuat default permission per role dari local source
- mengambil global role permission dari Edge Function
- mengambil role settings dari Edge Function
- mengambil custom permission per user dari Edge Function
- menyediakan helper `hasPermission`
- menyediakan feature `view as role`
- melakukan backfill permission tertentu untuk kompatibilitas behavior yang sudah ada

Kesimpulan:

Permission di repo ini bukan hanya static config. Ia adalah gabungan:

- default local permission matrix
- global override dari server
- custom override per user
- view-as behavior untuk owner

## Data Access Patterns in Practice

Saat ini repo memakai beberapa pola akses data sekaligus.

### Pattern A - Direct Supabase table access

Dipakai luas di:

- `MasterDataCtx`
- banyak halaman besar di `src/app/pages/**`
- beberapa form dan tab admin

Contoh area:

- leads
- orders
- daily ads
- technician schedules
- recurring expenses
- payroll support tables
- technician daily reports

### Pattern B - Edge Function fetch with public anon key + session token

Dipakai saat frontend perlu memanggil server logic yang tidak cukup aman atau tidak cukup praktis dilakukan langsung dari browser.

Pattern header yang umum:

- `Authorization: Bearer {publicAnonKey}`
- `x-client-token: {supabase session access token}`

Dipakai di area:

- permissions
- payroll
- payments / QRIS
- conversation center
- Google Ads
- TikTok Ads
- Meta live integrations
- advertiser access config
- lead social master data

### Pattern C - Hybrid direct query + service wrapper

Beberapa domain tidak murni memakai satu pola saja.

Contoh:

- payroll: ada fetch server-side ke `/payroll/data`, tetapi juga ada direct `supabase.from(...)` di halaman
- ads monitoring: live integration lewat services, tetapi internal attribution dan account mapping tetap membaca data host app
- conversations: inbox live memakai service wrapper ke `/meta/messaging/*`, tetapi workspace Marketing OS membungkus domain ini dengan layer lain

### Pattern D - Mock/static workspace data

Terlihat terutama di bagian `marketing-os`.

Beberapa workspace sudah terhubung ke adapter/service nyata, sementara beberapa lainnya masih memakai mock/static dataset sebagai shell produk atau prototype operasional.

## Backend and Function Boundary

### 1. Primary production function

File utama:

- `supabase/functions/make-server-f781cd00/index.ts`
- `supabase/functions/server/index.tsx`

Kondisi sekarang:

- wrapper `make-server-f781cd00/index.ts` hanya mengimpor `../server/index.tsx`
- source utama runtime production hidup di `supabase/functions/server/index.tsx`

### 2. Main server responsibilities

`supabase/functions/server/index.tsx` berfungsi sebagai gateway Hono utama untuk banyak domain sekaligus.

Mounted subroutes:

- `/make-server-f781cd00/permissions`
- `/make-server-f781cd00/payroll`
- `/make-server-f781cd00/payments`
- `/make-server-f781cd00/telegram`
- `/make-server-f781cd00/meta/messaging`
- `/make-server-f781cd00/google`
- `/make-server-f781cd00/tiktok`

Inline routes tambahan di file utama mencakup:

- health
- meta live breakdown dan snapshot sync
- users
- leads
- orders
- affiliates
- audit logs
- URL expansion
- shifts
- mobile technician orders
- master data generic endpoints
- manual debts
- access config
- reports
- targets
- stock settings, products, transactions

### 3. Secondary/public function

File utama:

- `supabase/functions/meta-messaging-webhook/index.ts`

Kondisi sekarang:

- webhook Meta dipisahkan menjadi function publik terpisah
- alasannya: webhook tidak bisa mengikuti auth contract internal function utama

### 4. Legacy / parallel function surface

File utama:

- `supabase/functions/make-server-0cdce7b6/index.ts`

Catatan:

- masih ada function legacy/parallel berukuran besar di repo
- dari isi route-nya, function ini memuat banyak area finance, marketplace, auth utility, dan upload flow
- ini menunjukkan ada lapisan backend yang tumbuh bertahap, bukan satu surface tunggal yang sepenuhnya bersih

## Domain Map

### 1. App shell and platform core

Primary files:

- `src/main.tsx`
- `src/app/App.tsx`
- `src/app/routes.ts`
- `src/app/AuthenticatedApp.tsx`
- `src/app/components/layout/AppLayout.tsx`
- `src/app/components/Sidebar.tsx`

Primary concerns:

- boot app
- theme
- auth gate
- route shell
- internal navigation
- global layout

### 2. Leads and prospects

Primary files:

- `src/app/pages/Prospek.tsx`
- `src/app/pages/prospects/ProspectList.tsx`
- `src/app/pages/leads/LeadForm.tsx`
- `src/app/pages/leads/ProspectBookingForm.tsx`
- `src/app/pages/leads/WATemplatesDialog.tsx`

Primary data sources:

- `leads`
- `prospect_bookings`
- `wa_templates`
- `lead_social_contacts` via Edge Function

Notes:

- lead domain hidup dekat dengan CS workflow, affiliate booking, dan order conversion

### 3. Orders and field assignment

Primary files:

- `src/app/pages/Pesanan.tsx`
- `src/app/pages/orders/OrderForm.tsx`
- `src/app/pages/orders/OrderDetailDialog.tsx`
- `src/app/pages/orders/OrderPaymentDialog.tsx`
- `src/app/pages/orders/OrderQrisPanel.tsx`
- `src/app/services/orderPaymentService.ts`
- `src/app/services/orderScheduleValidation.ts`

Primary data sources:

- `orders`
- `branches`
- `services`
- `vehicle_types`
- `cancel_reasons`
- `payment_methods`
- payment endpoints in `/payments/*`

Notes:

- order domain beririsan kuat dengan lead, technician, payment, map, dan finance

### 4. Technician operations and monitoring

Primary files:

- `src/app/pages/Schedule.tsx`
- `src/app/pages/TeknisiMobile.tsx`
- `src/app/pages/Pemantauan.tsx`
- `src/app/pages/MonitoringPage.tsx`
- `src/app/pages/technician/TechnicianSchedulePage.tsx`

Primary data sources:

- `orders`
- `technician_schedules`
- `technician_daily_reports`
- shift endpoints
- mobile technician endpoints

Notes:

- operational monitoring bersandar pada order, schedule, technician availability, dan laporan harian

### 5. Finance and payroll

Primary files:

- `src/app/pages/finance/PaymentsPage.tsx`
- `src/app/pages/finance/DebtsPage.tsx`
- `src/app/pages/finance/PayrollPage.tsx`
- `src/app/pages/finance/PaymentGatewaySettings.tsx`
- `src/app/pages/master-data/tabs/RecurringExpensesTab.tsx`

Primary data sources:

- `payment_transactions`
- `recurring_expenses`
- `salary_profiles`
- `kpi_library`
- `employee_kpi_assignments`
- `technician_daily_reports`
- `/payroll/data`
- `/payments/*`
- manual debt endpoints

Notes:

- payroll adalah domain hybrid: sebagian data diambil lewat endpoint server, sebagian update masih direct ke Supabase

### 6. Inventory

Primary files:

- `src/app/pages/stock/StockManagementPage.tsx`
- `src/app/pages/stock/components/*`

Primary data sources:

- stock endpoints di `/stock/settings`
- `/stock/products`
- `/stock/transactions`

Notes:

- inventory saat ini tampak lebih server-oriented dibanding beberapa domain lama lain

### 7. Ads and marketing

Primary files:

- `src/app/pages/IklanHarian.tsx`
- `src/app/pages/ads/UnifiedAdsMonitoringPage.tsx`
- `src/app/pages/ads/MarketingMonitoringPage.tsx`
- `src/app/services/liveAdsService.ts`
- `src/app/services/googleAdsLiveService.ts`
- `src/app/services/tiktokAdsLiveService.ts`

Primary data sources:

- `daily_ads`
- `ad_platforms`
- `ad_sub_channels`
- `ad_accounts`
- `ad_sources`
- meta live endpoints
- google live endpoints
- tiktok live endpoints
- `ads_live_daily_snapshots`

Notes:

- domain ini memakai kombinasi live API, snapshot cache, integration config, dan read model internal

### 8. Conversations

Primary files:

- `src/app/pages/conversations/ConversationLiveInboxPage.tsx`
- `src/app/pages/conversations/ConversationChannelSettingsPage.tsx`
- `src/app/services/conversationCenterService.ts`

Primary data sources:

- `/meta/messaging/readiness`
- `/meta/messaging/assets/sync`
- `/meta/messaging/inbox/overview`
- `/meta/messaging/inbox/daily-stats`
- `/meta/messaging/inbox/messages`
- `/meta/messaging/send`

Notes:

- percakapan sudah punya service layer khusus sendiri
- domain ini juga mulai diangkat lagi ke `marketing-os`

### 9. Admin, master data, users, permissions

Primary files:

- `src/app/pages/master-data/MasterDataPage.tsx`
- `src/app/pages/users/UserManagementPage.tsx`
- `src/app/pages/settings/RoleManagement.tsx`
- `src/app/pages/WATemplatesPage.tsx`
- `src/app/hooks/usePermissions.tsx`

Primary data sources:

- `profiles`
- `roles`
- `branches`
- `areas`
- `services`
- `payment_methods`
- `vendors`
- `affiliates`
- `ad_accounts`
- access config endpoints
- permissions endpoints
- user management endpoints

Notes:

- admin domain adalah domain lintas sistem karena mempengaruhi menu, permission, dan assignment hampir di semua modul

### 10. Marketing OS

Primary files:

- `src/marketing-os/app-shell/*`
- `src/marketing-os/routes/index.ts`
- `src/marketing-os/modules/*`
- `src/marketing-os/shared/*`
- `src/marketing-os/foundation/*`

Workspace yang terdaftar:

- command-center
- ads-monitoring
- conversation-hub
- lead-intelligence
- order-automation
- creative-content
- ai-action-center

Current maturity on inspection:

- `ads-monitoring` sudah terhubung ke adapter/service host app
- `conversation-hub` membawa niat integrasi nyata, tetapi file halamannya masih memuat mock dataset
- `lead-intelligence` masih mock-heavy
- `command-center` masih mock-heavy
- workspace lain lebih dekat ke prototype/workspace shell daripada modul host yang sepenuhnya live

Notes:

- `marketing-os` saat ini adalah sub-platform di dalam host app, bukan aplikasi terpisah penuh
- ada overlap domain dengan halaman klasik seperti ads monitoring dan conversation center

## Current Integration Boundaries

### Meta

Frontend memakai:

- `liveAdsService.ts`
- conversation service
- payment and webhook docs di README

Backend memakai:

- meta live breakdown route di main server
- `meta_messaging.tsx`
- public webhook function

### Google Ads

Frontend memakai:

- `googleAdsLiveService.ts`

Backend memakai:

- `google_ads.tsx`

### TikTok Ads

Frontend memakai:

- `tiktokAdsLiveService.ts`

Backend memakai:

- `tiktok_ads.tsx`

### Payments / QRIS

Frontend memakai:

- `orderPaymentService.ts`
- payment gateway settings UI

Backend memakai:

- `payments.tsx`

## Coupling Hotspots

Area berikut adalah hotspot utama berdasarkan inspeksi struktur dan ukuran file.

### 1. `AppLayout.tsx`

Kenapa penting:

- memegang navigasi internal
- memegang permission mapping per tab
- memegang render switch untuk banyak domain
- menjadi titik temu halaman klasik, conversation, dan Marketing OS

### 2. `MasterDataCtx.tsx`

Kenapa penting:

- memegang banyak state lintas domain
- memegang fetch master + transaksi + config + realtime
- memegang generic CRUD helper
- memegang current user sync

### 3. `usePermissions.tsx`

Kenapa penting:

- menggabungkan default permission, global server permission, custom permission, dan view-as
- memengaruhi visibility menu dan akses halaman

### 4. Large page modules

Beberapa file besar yang menandakan beban domain tinggi:

- `src/app/pages/Pesanan.tsx`
- `src/app/pages/Schedule.tsx`
- `src/app/pages/Laporan.tsx`
- `src/app/pages/IklanHarian.tsx`
- `src/app/pages/Prospek.tsx`
- `src/app/pages/finance/PayrollPage.tsx`

### 5. Main function gateway

File:

- `supabase/functions/server/index.tsx`

Kenapa penting:

- menampung banyak domain dalam satu gateway besar
- mencampur mounted subroute dan inline route

### 6. Legacy backend surface

File:

- `supabase/functions/make-server-0cdce7b6/index.ts`

Kenapa penting:

- menunjukkan adanya domain lama/paralel yang masih hidup di repo
- berpotensi membingungkan boundary backend jika tidak didokumentasikan

### 7. Overlapping product surfaces

Overlap yang terlihat saat ini:

- Ads Monitoring klasik vs Marketing OS Ads Monitoring
- Conversation Center klasik vs Marketing OS Conversation Hub
- host app shell vs Marketing OS shell

Ini bukan berarti salah, tetapi penting dicatat sebagai titik potensi duplikasi tanggung jawab.

## Architecture Characteristics Today

Jika diringkas, repo ini punya karakter seperti berikut:

- SPA-first, bukan route-first
- client-heavy di shell utama
- hybrid data access
- hybrid backend surface
- domain bisnis cukup kaya dan saling terhubung
- beberapa area sudah matang operasional
- beberapa area baru masih berupa workspace/prototype

## What This Map Suggests

Tanpa mengusulkan perubahan runtime, peta ini menunjukkan beberapa fakta penting:

1. Repo ini sudah lebih dekat ke platform operasional hidup daripada template arsitektur bersih.
2. Boundary domain ada, tetapi banyak yang masih bertemu di file sentral.
3. Perubahan struktural nanti harus berhati-hati karena auth, permission, realtime, dan navigation saling terkait.
4. `marketing-os` perlu dibaca sebagai extension layer di atas host app, bukan sebagai app terpisah yang sudah matang sepenuhnya.
5. Refactor masa depan paling aman bila dimulai dari dokumentasi, contract, dan internal boundary, bukan dari perubahan UI atau logic.

## Suggested Follow-Up Documents

Urutan dokumen berikut yang paling masuk akal setelah file ini:

1. `BLUEPRINT-SECTION-MATRIX.md`
   Menandai tiap section di `BLUEPRINT.md` sebagai `adopt`, `adapt`, `defer`, atau `ignore`.

2. `TARGET-TECHNICAL-CONVENTIONS.md`
   Menetapkan aturan target untuk boundary komponen, data access, API contract, logging, migration, dan permission.

3. `NO-REGRESSION-CHECKLIST.md`
   Mendefinisikan area yang tidak boleh berubah behavior-nya saat refactor internal dimulai.
