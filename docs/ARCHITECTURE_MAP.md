# RHI System — Peta Arsitektur Lengkap

> Dokumen ini hasil penelusuran menyeluruh codebase (~124k baris, 293 file TS/TSX).
> Melengkapi `APP_OVERVIEW.md` dengan detail per-modul, inventory endpoint, integrasi eksternal, skema DB, dan catatan risiko.
> Branding: **RHI System** (Restoration Headlamp Indonesia). Domain produksi: `polesheadlamp.id` / `polesheadlamp-id.pages.dev`.

---

## 1. Ringkasan & Stack

Web app operasional internal multi-role (marketing → lead → order → teknisi → finance → payroll → stock → admin).

- **Frontend:** React 18 + Vite 6 + TypeScript + Tailwind 4 + Radix/shadcn + MUI + Recharts + Leaflet. PWA (vite-plugin-pwa).
- **Backend:** Supabase — Postgres + Auth + Storage + Edge Functions (Deno + Hono).
- **Proyek Supabase (default hardcoded):** `dhnxwrteolnjdrxlmgwi.supabase.co` (di `utils/supabase/info.tsx`). Tanpa `.env`, app lokal menembak **Supabase produksi**.
- **Integrasi eksternal (semua server-side):** Meta Graph (FB/IG/WA), Kirimdev (WA), Google Ads, TikTok Ads, Xendit (pembayaran), Telegram (notifikasi), OpenStreetMap/Google Maps.

### Diagram tingkat tinggi
```
Browser (React SPA)
  ├── Supabase JS client ──► Postgres (RLS) + Auth + Storage + Realtime
  └── fetch ──► Edge Function "make-server-f781cd00" (Hono)
                   ├── /permissions /payroll /payments /telegram
                   ├── /meta/messaging  ──► Meta Graph + Kirimdev   (+ webhook in/out)
                   ├── /google          ──► Google Ads API (OAuth refresh)
                   └── /tiktok          ──► TikTok Business API (OAuth)
Webhook masuk: meta-messaging-webhook, kirimdev-messaging-webhook (fungsi terpisah)
CI/CD: GitHub Actions ──► Cloudflare Pages + Supabase (functions/migrations)
```

---

## 2. Shell Frontend, Routing, Auth, Permission, State Global

### Bootstrapping & routing
- `src/main.tsx` → `App` (dalam `ErrorBoundary`+`StrictMode`); `App.tsx` pasang `ThemeProvider` (paksa `light`) + `RouterProvider`.
- `src/app/routes.ts`: `createBrowserRouter`. **Hampir semua path render komponen yang sama `AuthenticatedApp`**. Hanya 3 halaman publik standalone (lazy): `/booking`, `/embed/form/:identifier`, `/payment-gateway-preview`.
- Katalog rute kanonik: `src/app/routing/appRouteRegistry.ts` (~80 definisi). Navigasi dalam app **berbasis tab** (`activeTab`), bukan nested `<Routes>`.
- `AppLayout.tsx` memilih halaman lewat `switch(activeTab)` atas ~60 komponen `React.lazy`. Ada fallback `window.location.assign` 180ms (workaround navigasi SPA yang dulu flaky) dan logout "FORCE SUCCESS" via hard-redirect.

### Auth
- Client: `src/lib/supabaseClient.ts` (`createClient`, tanpa opsi auth custom).
- Login `pages/auth/LoginPage.tsx`: `signInWithPassword`. ⚠️ Jika login sukses tapi belum ada baris `profiles`, **auto-upsert profil dengan `role: 'Owner'`, `branch_id: 'B1'`** — risiko privilege escalation.
- Gate `AuthenticatedApp.tsx`: cek session, `onAuthStateChange`, idle-logout 24 jam (`localStorage.app_last_active`), bungkus `MasterDataProvider` → `PermissionsProvider` → `AppLayout`.

### Permission / RBAC
- Role: `Owner | Super Admin | Admin PIC | CS | Advertiser | Teknisi | Finance`.
- Definisi: `src/app/data/permissions.ts` (~150 key), default per role + backfill (`permissionBackfill.ts`).
- Provider `hooks/usePermissions.tsx`: gabung default role + global override (edge fn) + custom per-user; fitur **"view as role"** (Owner). Owner di-short-circuit jadi semua-izin di client.
- Enforcement 2 lapis: `APP_LAYOUT_TAB_PERMISSIONS` (per tab) + Sidebar filter. Teknisi dibatasi ke `TEKNISI_ALLOWED_TABS`.
- Header pola: `Authorization: Bearer <anonKey>` + `x-client-token: <JWT user>` (`services/internal/sessionClientHeaders.ts`).

### State global — `MasterDataCtx.tsx` (~2050 baris)
- Sumber data client-side utama (`useMasterData()`).
- Baca langsung dari Postgres (paginasi 1000/hal, cap 50k): `branches, areas, services, vehicle_types, ad_platforms, ad_sub_channels, ad_accounts, ad_account_assignments, ad_account_owner_assignments, ad_sources, payment_methods, roles, affiliates, vendors, cancel_reasons, leads, prospect_bookings, orders, wa_templates, daily_ads, lead_spam_daily_inputs, technician_schedules, audit_logs, profiles`.
- **Realtime** channel `realtime_master_data`: `orders, leads, prospect_bookings, lead_spam_daily_inputs, technician_schedules, profiles` (order baru → suara + toast + notif).
- CRUD helper generik (`addItem/updateItem/deleteItem`) untuk ~18 entitas; user lewat edge fn, bukan tabel langsung.

---

## 3. Modul Frontend (per area)

### Akuisisi & sales
- **Orders (`Pesanan.tsx`, ~166KB)** — lifecycle order: CRUD, assign teknisi, jadwal (validasi konflik `orderScheduleValidation`), status, pembayaran QRIS (`OrderQrisPanel` → Xendit), invoice/garansi, import/export (CSV/XLSX/PDF), WA & Maps. Hooks di `orders/hooks/`. Tabel `orders` (+ baca `leads`, `prospect_bookings`, `technician_schedules`); storage bucket `orders`.
- **Prospek/Leads (`Prospek.tsx`, ~111KB)** — lifecycle lead, atribusi multi-channel, booking, template WA, **konversi lead→order**. Tabel `leads`, `prospect_bookings`, `wa_templates`, `lead_social_contacts`. Embed form manager: `leads/EmbedLeadFormManagerPage.tsx`.
- **Embed (`embed/PublicEmbedLeadFormPage.tsx`)** — form lead publik (slug/token), field dinamis, UTM + pixel (Meta/TikTok/Google), routing CS. Service `services/embedLeadForms.ts`.
- **Affiliates (`affiliates/`)** — CRUD partner + komisi; `PublicBookingPage.tsx` (form publik `?ref=`).

### Komunikasi (Meta + Kirimdev, semua via backend)
- **WhatsApp (`pages/whatsapp/`)** — inbox khusus WA, kontak, template, broadcast, akun, performa/SLA per-CS. Service `whatsappModuleService.ts` (semua di `/meta/messaging/whatsapp/*` + `/kirimdev/*`).
- **Conversations (`pages/conversations/`)** — inbox omnichannel (WA + IG DM + Messenger). Service `conversationCenterService.ts` (`/meta/messaging/inbox/*`, `/readiness`, `/send`, `/assets/sync`).
- **CS Dashboard (`cs/CSDashboard.tsx`, ~143KB)** — analitik performa CS (spend↔lead↔spam↔closing), KPI harian, input spam (`lead_spam_daily_inputs`).

### Operasional lapangan
- **TeknisiMobile (`TeknisiMobile.tsx`, ~100KB)** — app mobile teknisi: shift+GPS, daftar job, status (`pending→otw→working→qc→done`), upload foto/ttd (bucket `orders`). Edge: `/shifts/*`, `/mobile/technician-orders/*`.
- **Technician (`technician/`)** — dashboard role teknisi dan jadwal (`technician_schedules`).

### Finance & inventory
- **Finance (`pages/finance/`)** — `PayrollPage.tsx` (~2001 baris, engine bonus KPI bertingkat, periode cutoff 28→27), `DebtsPage.tsx` (hutang/piutang dari `technician_daily_reports` + manual KV), `PaymentGatewaySettings.tsx` (Xendit), `PaymentsPage.tsx`, `Kas.tsx` (operational expenses).
- **Stock (`pages/stock/`)** — ledger **weighted-average cost** (`utils/stockLedger.ts`) dengan rekonsiliasi self-healing; produk, transaksi IN/OUT/ADJUST, valuasi (export xlsx), settings. Tabel `products`, `stock_transactions`, `stock_units`.

### Admin & dashboard
- **Master Data (`pages/master-data/`)** — referensi: cabang, area, layanan, kendaraan, platform/sub-channel iklan, akun iklan (assign CS/owner berbasis tanggal), metode bayar, role, vendor, kategori opex, recurring expenses, akses advertiser.
- **Users (`pages/users/`)** — lifecycle staff + RBAC; semua mutasi via edge fn (`/users*`, `/verify-email`); avatar bucket `avatars`.
- **Monitoring (`monitoring/TargetManager.tsx`)** — target bulanan via `/targets/:month`.
- **Settings (`settings/`)** — `RoleManagement.tsx` (matriks izin) + `UsageControlPage.tsx` (interval refresh, Owner-only, KV `app:usage-control-settings`).
- **Dashboards** — `Dashboard.tsx` (router view role aktif), `AdvertiserDashboard.tsx`, `cs/CSDashboard.tsx`, dan `technician/TechnicianDashboard.tsx`. Dashboard profitabilitas owner dan analytics owner lama sudah dihapus dari v2.

### Ads / Marketing-OS (`pages/ads/`)
- **`UnifiedAdsMonitoringPage.tsx` (~2711 baris)** — satu-satunya halaman yang panggil service live (Meta/Google/TikTok), gabung snapshot + "today-live" + data internal, atribusi proporsional.
- **OpenClaw foundation (`ads/openclaw-foundation/`)** — engine keputusan murni client-side (atribusi, read-model, diagnostics, rekomendasi, sandbox). Mode "Assisted" (read-only, belum auto-write).

---

## 4. Lapisan Service Frontend (`src/app/services/`)

Semua lewat `buildMakeServerUrl()` (`internal/functionsBaseUrl.ts`) ke fungsi `make-server-f781cd00`. Header publik vs session di `internal/sessionClientHeaders.ts`.

| Service | Fungsi | Endpoint / eksternal |
|---|---|---|
| `auditService.ts` | `logActivity()` → tabel `audit_logs` + `POST /telegram/notify` | Telegram |
| `conversationCenterService.ts` | inbox omnichannel | `/meta/messaging/{readiness,inbox/*,send,assets/sync}` → Meta+Kirimdev |
| `whatsappModuleService.ts` | modul WA | `/meta/messaging/{whatsapp/*,kirimdev/*}` → Meta WA + Kirimdev |
| `liveAdsService.ts` | Meta Ads (cache localStorage, fallback) | `/meta/*`; opsi direct Graph (localhost) |
| `googleAdsLiveService.ts` | Google Ads | `/google/*` → Google Ads API |
| `tiktokAdsLiveService.ts` | TikTok Ads | `/tiktok/*` → TikTok Business API |
| `orderPaymentService.ts` | QRIS/gateway | `/payments/*` → Xendit |
| `orderScheduleValidation.ts` | cek konflik jadwal | Supabase langsung |
| `embedLeadForms.ts` | form lead embed | Supabase + `/master/*`; pixel marketing |
| `masterDataService.ts` | CRUD master generik | `/master/:type` |
| `usageControlSettings.ts` | interval refresh | KV `kv_store_f781cd00` + `/permissions/settings` |
| `orderTime.ts` | normalisasi jam (murni) | — |

Pola: 3 service ads = sibling near-identik (server fetch → cache localStorage → stale fallback).

---

## 5. Backend Edge Functions

### Topologi fungsi (`supabase/functions/`)
| Folder | Status |
|---|---|
| `server/` (entry `index.tsx`, ~3155 baris) | **Monolith aktif** — Hono, base `/make-server-f781cd00/...`, mount `permissions, payroll, payments, telegram, meta/messaging, google, tiktok`. |
| `make-server-f781cd00/` | Alias tipis (`import "../server/index.tsx"`). |
| `make-server-0cdce7b6/` | **Monolith lama** (~283KB, KV sendiri `kv_store_0cdce7b6`). Masih ada, generasi sebelumnya. |
| `meta-messaging-webhook/` | Receiver webhook Meta (handler dari `meta_messaging.tsx`). |
| `kirimdev-messaging-webhook/` | Receiver webhook Kirimdev. |

### Model penyimpanan: HYBRID
- **Postgres** (service-role): `profiles, orders, branches, vehicle_types, operational_expense_*, salary_profiles, kpi_library, employee_kpi_assignments, recurring_expenses, technician_daily_reports, payment_transactions, ads_live_daily_snapshots, whatsapp_*`, dll.
- **KV** `kv_store_f781cd00 (key, value jsonb)` via `kv_store.tsx` — namespace: `lead:`, `order:`, `affiliate:`, `debt:`, `audit:`, `shift:`, `report:`, `targets:`, `permission:`, `user_perms:`, `advertiser_config:`, `stock_*`, `*_integration_config:`, `payment_*`, `meta_messaging_*`, `kirimdev_messaging_*`, `whatsapp_*`.
- ⚠️ **orders & leads ada di DUA dunia** (KV `order:`/`lead:` CRUD vs Postgres `orders`). Tidak ada sinkronisasi — risiko divergensi.

### Inventory endpoint (ringkas, `index.tsx`)
- **Finance opex:** `/finance/operational-expense-categories` (CRUD, perm), `/finance/operational-expenses` (+`/summary`, CRUD, perm).
- **Meta core:** `/health`, `/meta/{live-breakdown,snapshots,sync-snapshots,token-health,integration-configs}` (login).
- **Users:** `/verify-email` (none), `/users` POST/PUT/DELETE, `/users/:id/password` (perm).
- **KV CRUD:** `/leads`, `/orders`, `/affiliates`, `/manual-debts`, `/master/:type`, `/reports`, `/logs`, `/permissions` (+`/user/:id`) — ⚠️ **tanpa auth** (lihat §7).
- **Teknisi:** `/shifts/*`, `/mobile/technician-orders/:id` (perm own/manage).
- **Advertiser akses:** `/access-config/:id`, `/access-configs` (login/perm).
- **Targets:** `/targets/:month` (perm).
- **Stock:** `/stock/{settings,products,transactions}` (perm) — IN hitung weighted-avg cost.
- **Sub-router ber-RBAC:** `permissions.tsx` (`/me,/global,/settings,/user/:id`), `payroll.tsx` (`/data` read-aggregator role-scoped), `payments.tsx` (lihat §6), `telegram.tsx` (`/notify`).

---

## 6. Integrasi Eksternal

| Layanan | Endpoint/versi | Webhook masuk | Secrets utama | Simpan ke |
|---|---|---|---|---|
| **Meta Graph (FB/IG/WA)** | `graph.facebook.com/v25.0`, `graph.instagram.com` | `GET/POST /webhook` — verify token + HMAC `X-Hub-Signature-256` (`META_APP_SECRET`). ⚠️ **fail-open jika secret kosong** | `META_APP_*`, `META_ACCESS_TOKEN`, `META_IG_*`, `META_DM_*`, `META_MESSAGING_VERIFY_TOKEN` | tabel `whatsapp_*`, `leads`, KV; bucket `whatsapp-media` |
| **Kirimdev (WA)** | `api.kirimdev.com/v1` (Bearer) | `GET/POST /webhook/kirimdev` — HMAC `X-Kirim-Signature` (`t.body`), **fail-closed**, replay window 300s, idempotensi | `KIRIMDEV_API_KEY`, `KIRIMDEV_PHONE_NUMBER_ID`, `KIRIMDEV_WEBHOOK_SECRET` | tabel `whatsapp_*`, KV |
| **Google Ads** | `googleads.googleapis.com/v22` + `oauth2.googleapis.com` | — (read-only) | `GOOGLE_ADS_{DEVELOPER_TOKEN,CLIENT_ID,CLIENT_SECRET,REFRESH_TOKEN,LOGIN_CUSTOMER_ID}` | `ads_live_daily_snapshots`, KV config |
| **TikTok Ads** | `business-api.tiktok.com/open_api/v1.3` | — (OAuth code exchange manual) | `TIKTOK_{APP_ID,APP_SECRET,REDIRECT_URI}` | `ads_live_daily_snapshots`, KV token. ⚠️ **tak ada refresh path** |
| **Xendit** | `api.xendit.co` (QRIS v3) | `POST /payments/webhook/xendit` — `x-callback-token` | `XENDIT_SECRET_KEY`, `XENDIT_WEBHOOK_TOKEN` ⚠️ **tak ada di `.env.example`** | `payment_transactions`, `orders`, KV. ⚠️ fallback **mock** jika key kosong |
| **Telegram** | `api.telegram.org` | — (outbound) | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` ⚠️ tak terdokumentasi | — |

---

## 7. Skema Database (ringkas)

> ⚠️ `20260402..._remote_baseline_placeholder.sql` kosong — **baseline diterapkan langsung di remote**, bukan via migrasi. Tabel inti (leads, orders, branches, products, profiles, ad_accounts, dst.) sudah ada; migrasi lokal hanya meng-*alter*.

- **Master:** `profiles` (+field CS), `products`/`stock_transactions` (+scope branch/technician), `ad_accounts` (unik platform+name+advertiser).
- **Leads/Orders:** `leads` (+social, +origin Auto-WA, +embed/UTM), `prospect_bookings` (slot, RLS public-all).
- **Embed:** `embed_lead_forms` + `_fields` + `_cs_routes` + `_submissions` (RLS public-all, realtime).
- **Finance:** `payment_transactions` (RLS service-role only), `operational_expense_categories` + `_ledger` (anti-dup `source_ref`), `recurring_expense_payments` (RPC `pay_recurring_expense` SECURITY DEFINER).
- **Ads:** `ads_live_daily_snapshots` (key `platform_key` meta/google/tiktok, RLS read-only auth), `ad_account_assignments` + `ad_account_owner_assignments` (berbasis tanggal), `lead_spam_daily_inputs`.
- **Messaging:** `whatsapp_conversations` / `_messages` / `_contacts` (RLS public-all, realtime, RPC `get_whatsapp_message_counts`).
- **Trigger penting:** anti-dobel slot jadwal (`prevent_duplicate_active_*_slot`, kunci teknisi+tanggal+jam), `link_matching_prospect_booking_to_order`, `sync_order_prospect_lifecycle` (status order → lead/booking).
- **Pola RLS:** mayoritas tabel baru **"public-all"** (kontrol akses dipindah ke layer aplikasi/edge), sebagian restriktif (snapshots, payments, recurring payments).

---

## 8. Catatan / Risiko Penting

1. 🔴 **Banyak endpoint KV tanpa auth** (`/leads`, `/orders`, `/affiliates`, `/manual-debts`, `/master/:type`, `/reports`, `/logs`, dan **`/permissions` legacy**). Dengan CORS `origin:"*"`, siapa pun ber-anon-key bisa CRUD — termasuk **menulis ulang permission role**. Permukaan risiko terbesar.
2. 🔴 **Dua sistem permission** — `permissions.tsx` (ber-RBAC, KV `user_perms:`) vs rute `/permissions` legacy di `index.tsx` (tanpa auth, KV `user_permission:`). `requester_access.ts` fallback baca key legacy → penulis legacy bisa pengaruhi izin efektif.
3. 🟠 **Login auto-provision profil `Owner`** bila belum ada (`LoginPage.tsx`) + Owner = semua-izin di client.
4. 🟠 **Meta webhook fail-open** saat `META_APP_SECRET` kosong (Kirimdev fail-closed) — inkonsisten.
5. 🟠 **Mock payment fallback** Xendit aktif bila secret kosong — bahaya jika lolos ke produksi.
6. 🟠 **orders/leads ganda KV vs Postgres** tanpa sinkronisasi.
7. 🟡 **TikTok tanpa token-refresh**; **Telegram `/notify` "auth" no-op**.
8. 🟡 **Coupling edge↔frontend src** (edge import `../../../src/app/data/*`).
9. 🟡 **Audit payment lanjutan:** `PaymentsPage` masih perlu dicek ulang terhadap data live dan kebutuhan finance final.
10. 🟡 **Performa KV:** `getByPrefix` = `LIKE 'prefix%'` full-scan satu tabel; client Supabase dibuat ulang tiap operasi.

---

## 9. Urutan Baca untuk Onboarding Cepat
1. `README.md` + dokumen ini
2. `src/app/AuthenticatedApp.tsx` → `components/layout/AppLayout.tsx`
3. `hooks/usePermissions.tsx` + `data/permissions.ts`
4. `pages/master-data/context/MasterDataCtx.tsx`
5. `pages/Prospek.tsx` → `pages/Pesanan.tsx`
6. `supabase/functions/server/index.tsx` (+ `requester_access.ts`)
7. `supabase/functions/server/meta_messaging.tsx` (komunikasi)
