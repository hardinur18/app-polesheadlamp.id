# OPENCLAW MARKETING OS BLUEPRINT
Spesifikasi Sistem Universal — Versi 1.1.0
Klasifikasi     : Spesifikasi Teknis Produk yang bisa dieksekusi AI

Cakupan         : Fitur / workspace OpenClaw Marketing OS di dalam RHI System
                  yang sudah berjalan
                  Command Center · Ads Monitoring · Conversation Hub
                  Lead Intelligence · Order Automation
                  Creative & Content Center · AI Action Center
                  plus kemampuan AI visual di dalam alur percakapan

Arsitektur      : Single repository · React + Vite frontend · Supabase Auth
                  Supabase PostgreSQL · Supabase Edge Functions
                  Snapshot database · Integrasi Ads API · Integrasi Chat API

Rendering       : SPA dashboard · live + snapshot + fallback rendering
                  drawer detail · approval-centric action flow

Kepatuhan       : Satu auth · satu permission model · satu source of truth
                  semua status data harus jujur · audit trail wajib

Menggantikan    : Draft blueprint OpenClaw sebelumnya yang masih terlalu
                  diposisikan seperti sistem baru dari nol


CATATAN POSISI PRODUK
OpenClaw bukan sistem greenfield yang dibangun terpisah dari nol.

OpenClaw adalah:

- fitur strategis
- workspace operasional
- dan calon sub-product

yang hidup di dalam sistem RHI System yang sudah berjalan.

Asumsi dasar blueprint ini:

- shell aplikasi utama sudah ada
- auth utama sudah ada
- permission dan role utama sudah ada
- master data utama sudah ada
- order, lead, user, dan mapping bisnis utama sudah ada
- OpenClaw masuk sebagai lapisan observasi, insight, aksi, dan automasi


CARA MENGGUNAKAN FILE INI
Dokumen ini dipakai sebagai blueprint utama saat:

- merancang modul OpenClaw di dalam web Restoration Headlamp Indonesia
- memecah pekerjaan frontend, backend, dan data
- menentukan field apa saja yang wajib ditarik per fitur
- menilai apakah OpenClaw dapat dipisah menjadi modul mandiri
- memberi konteks lengkap ke AI agent sebelum implementasi

Dokumen ini tidak menganggap tim sedang membangun produk baru dari nol.
Dokumen ini menganggap tim sedang menambah workspace baru yang sangat besar di atas sistem host yang sudah berjalan.

Dokumen ini harus dibaca bersama:

- `Microfrontend Architecture OpenClaw Marketing OS.md`
- `PRD OpenClaw Marketing OS.md`
- `Technical OpenClaw Marketing OS.md`
- `UI OpenClaw Marketing OS.md`


KONTRAK PENAMAAN WORKSPACE
Untuk OpenClaw di dalam sistem host, penamaan workspace utama memakai nama penuh agar terasa kuat dan mudah dipahami oleh user operasional:

- `Command Center`
- `Ads Monitoring`
- `Conversation Hub`
- `Lead Intelligence`
- `Order Automation`
- `Creative & Content Center`
- `AI Action Center`


________________


VARIABLES — PROFIL PROYEK
project:

  name:         "OpenClaw Marketing OS"
  slug:         "openclaw-marketing-os"
  org:          "restoration-headlamp-indonesia"
  description:  "Sistem operasi marketing dan percakapan berbasis data, AI, dan automasi untuk Restoration Headlamp Indonesia."
  host_system:  "RHI System"
  repo:         "Polesheadlamp.id"
  domain:       "polesheadlamp-id.pages.dev"
  locale:       "id"
  timezone:     "Asia/Jakarta"

roles:

  - id: "owner"        label: "Owner"
  - id: "advertiser"   label: "Advertiser / Media Buyer"
  - id: "cs"           label: "Customer Service"
  - id: "admin"        label: "Admin Operasional"
  - id: "analyst"      label: "Analis / Observer"

brand:

  primary_color:  "#2563eb"
  font_heading:   "inherit dari RHI System"
  font_body:      "inherit dari RHI System"
  font_heading_marketing_os: "Public Sans"
  font_body_marketing_os:    "Inter"
  font_mono_marketing_os:    "IBM Plex Mono"

design_system_marketing_os:

  scope: "khusus di dalam workspace / route Marketing OS, tidak mengubah global host system"

  layout:
    shell_padding_x:      "24px"
    shell_padding_y:      "24px"
    content_max_width:    "1600px"
    section_gap:          "24px"
    card_gap:             "16px"
    grid_gap:             "16px"

  radius:
    shell:                "24px"
    card:                 "24px"
    control:              "20px"
    button:               "20px"
    pill:                 "999px"
    drawer:               "30px"

  card:
    background:           "#111827"
    background_muted:     "#0f172a"
    border:               "1px solid rgba(148, 163, 184, 0.14)"
    shadow:               "0 10px 30px rgba(0, 0, 0, 0.22)"
    padding:              "16px 18px"

  table:
    header_height:        "40px"
    row_height:           "46px"
    dense_row_height:     "40px"
    horizontal_padding:   "16px"
    zebra:                "subtle"

  typography:
    title_size:           "32px - 40px"
    section_title_size:   "24px"
    card_title_size:      "20px"
    body_size:            "14px"
    caption_size:         "12px"
    metric_size:          "30px - 40px"
    line_height_dense:    "1.35"

  status_badge:
    height:               "24px"
    padding_x:            "10px"
    radius:               "999px"

  interaction:
    focus_ring:           "0 0 0 4px rgba(37, 99, 235, 0.16)"
    hover_lift:           "translateY(-2px)"
    transition:           "160ms ease"

arsitektur_saat_ini:

  frontend:     "React 18 + Vite 6 + React Router 7"
  backend:      "Supabase Edge Functions + service layer"
  database:     "Supabase PostgreSQL"
  storage:      "Supabase Storage"
  auth:         "Supabase Auth"

integrasi_aktif:

  ads:
    - "Meta Ads"
    - "Google Ads"
    - "TikTok Ads"

  conversation:
    - "Instagram DM"
    - "Messenger"
    - "WhatsApp webhook parsial"

  future:
    - "TikTok DM"
    - "Kemampuan diagnostik visual AI di dalam percakapan"
    - "Eksekusi iklan dan follow-up berbasis AI"


________________


SECTION 0 — GLOBAL DESIGN CONTRACT KHUSUS MARKETING OS
Tujuan section ini adalah menetapkan `global visual rules` khusus untuk OpenClaw Marketing OS tanpa merusak style global RHI System.

Prinsip:

- token visual Marketing OS harus di-scope ke route atau shell Marketing OS
- token ini tidak boleh menimpa style global seluruh app
- Marketing OS boleh terasa lebih premium, lebih tajam, dan lebih padat daripada modul host lain
- meskipun begitu, warna aksi utama, state operasional, dan pola interaksi tetap harus kompatibel dengan host system

Aturan implementasi:

- buat namespace lokal seperti `.marketing-os-shell` atau setara
- semua variabel visual Marketing OS didefinisikan di bawah namespace itu
- komponen host di luar Marketing OS tidak ikut berubah
- kalau suatu komponen dipakai bersama dengan host system, buat adapter style, jangan override global sembarangan

Token yang wajib ada:

- spacing shell
- spacing section
- radius kartu
- radius kontrol
- padding kartu
- tipografi heading
- tipografi body
- tipografi mono untuk angka dan state
- tinggi row tabel
- badge status
- drawer radius

Pola visual yang diinginkan:

- shell terasa seperti control room, bukan halaman admin generik
- kartu terasa padat, tegas, dan rapi
- tabel harus dense tapi tetap mudah discan
- heading harus punya karakter lebih kuat daripada host system
- angka penting harus punya ritme visual yang konsisten
- status live/snapshot/fallback/rate-limit harus terbaca dalam 1 detik

Catatan:

- kalau nanti ada frontend OpenClaw yang lebih mandiri, token ini bisa dibawa penuh
- selama masih embedded di host system, token ini dipakai sebagai `local design system`


________________


SECTION 1 — SYSTEM ARCHITECTURE OVERVIEW
Blueprint utama ini mengikuti kontrak arsitektur yang dikunci di `Microfrontend Architecture OpenClaw Marketing OS.md`.

Untuk OpenClaw, arsitektur final harus dibaca sebagai `4 layer`:

```text
LAYER 1 — HOST SHELL
RHI System
- login
- session
- permission
- sidebar utama
- shell produk

        ↓

LAYER 2 — MARKETING OS FRONTEND
Marketing OS Workspace / Microfrontend Boundary
- internal routing
- local design system
- screen shell
- module UI
- tabs / subnav / drawer internal

        ↓

LAYER 3 — SHARED BACKEND / ORCHESTRATION
Supabase Edge Functions + service layer
- ads ingestion
- snapshot & fallback orchestration
- conversation orchestration
- mapping internal entities
- approval payload
- future AI workflow / job runner

        ↓

LAYER 4 — DATA + INTEGRATION
Shared DB + Storage + External APIs
- master data
- ads snapshot
- percakapan
- lead / order
- audit / action log
- Meta / Google / TikTok / WhatsApp / Instagram DM / Messenger / Drive
```

Pembacaan layer ini penting:

- `Host Shell` tetap milik `RHI System`, bukan milik `Marketing OS`.
- `Marketing OS Frontend` adalah boundary FE modular yang boleh lebih mandiri, termasuk design system, shell, dan framework UI.
- `Shared Backend / Orchestration` tetap satu jalur agar arti entity, workflow approval, dan audit tidak pecah.
- `Data + Integration` menggabungkan source of truth dan konektor eksternal dalam satu lapisan operasional agar FE tidak membuat arti data paralel sendiri.

Prinsip arsitektur:

- OpenClaw default-nya adalah workspace di dalam RHI System yang sudah ada.
- OpenClaw boleh menjadi microfrontend workspace, tetapi source of truth tetap satu.
- UI boleh berbeda framework, tetapi auth, permission, API contract, audit trail, dan entity identity tidak boleh pecah.
- Navigasi global sebaiknya berhenti di level `Marketing OS -> Workspace`.
- Sub-struktur yang lebih dalam sebaiknya memakai `tab`, `subnav horizontal`, `segmented control`, atau `drawer`, bukan sidebar level ketiga.
- Semua angka penting harus punya status sumber: `live`, `snapshot`, `fallback`, `partial`, atau `error`.
- Semua aksi AI yang berdampak bisnis harus bisa diaudit.


________________


SECTION 2 — REPOSITORY STRUCTURE
2.1 Workspace Host Root — `Polesheadlamp.id/`
```text
Polesheadlamp.id/
├── src/                            # Frontend utama React + Vite
├── supabase/
│   ├── functions/                 # Edge Functions
│   └── migrations/                # SQL migrations
├── scripts/                       # Utility dan sync scripts
├── guidelines/                    # PRD, technical, UI, blueprint
├── API Platform.md                # registry integrasi platform
├── README.md
├── PLATFORM_OVERVIEW.md
├── APP_OVERVIEW.md
├── package.json
├── vite.config.ts
└── index.html
```

Aturan penting:

- OpenClaw tidak menjadi root repository sendiri pada fase sekarang.
- OpenClaw hidup di dalam repository host yang sama.
- workspace ini harus kompatibel dengan route, layout, auth, dan service yang sudah ada.

2.2 Frontend Application — `src/`
```text
src/
├── app/
│   ├── components/
│   │   ├── layout/
│   │   ├── ui/
│   │   └── figma/
│   ├── data/
│   ├── hooks/
│   ├── pages/
│   │   ├── ads/
│   │   ├── conversations/
│   │   ├── master-data/
│   │   ├── monitoring/
│   │   ├── leads/
│   │   ├── orders/
│   │   ├── prospects/
│   │   ├── finance/
│   │   ├── owner/
│   │   ├── settings/
│   │   ├── users/
│   │   └── ...
│   ├── services/
│   └── types/
├── assets/
├── lib/
├── styles/
└── utils/
```

2.3 Backend / Integration Layer — `supabase/functions/`
```text
supabase/functions/
├── make-server-f781cd00/          # wrapper function utama
├── meta-messaging-webhook/        # webhook publik Meta messaging
└── server/
    ├── index.tsx                  # route registry utama
    ├── meta_messaging.tsx         # IG DM / Messenger / WA orchestration
    ├── google_ads.tsx             # Google Ads orchestration
    ├── tiktok_ads.tsx             # TikTok Ads orchestration
    ├── ads_snapshot_store.tsx     # snapshot DB ads
    ├── ads_snapshot_utils.tsx
    ├── kv_store.tsx               # key-value / state helper
    ├── permissions.tsx
    ├── payments.tsx
    ├── payroll.tsx
    └── telegram.tsx
```

2.4 Script Layer — `scripts/`
```text
scripts/
├── backfill-ads-snapshots.mjs
├── google-ads-snapshot-refresh.mjs
├── meta-ig-refresh.mjs
├── meta-messaging-assets.mjs
├── meta-role-dm-token.mjs
├── meta-role-wa-token.mjs
├── meta-system-user-token.mjs
├── meta-wa-webhook-subscribe.mjs
└── chrome-ocr-action.swift
```

2.5 Migration Layer — `supabase/migrations/`
```text
supabase/migrations/
├── 20260402013347_remote_baseline_placeholder.sql
├── 20260411_add_lead_social_contact_columns.sql
├── 20260411_add_payment_transactions.sql
├── 20260412_add_ads_live_daily_snapshots.sql
├── 20260412_add_prospect_bookings.sql
└── 20260413_allow_tiktok_ads_live_snapshots.sql
```


________________


SECTION 3 — PLATFORM & DEPENDENCY MANIFEST
3.1 Frontend Runtime

- `react@18.3.1`
- `react-dom@18.3.1`
- `react-router@7.13.0`
- `vite@6.3.5`
- `tailwindcss@4.1.12`
- `@supabase/supabase-js@2.91.0`
- `react-hook-form@7.55.0`
- `zod@3.24.1`
- `@mui/material@7.3.5`
- `@radix-ui/*`
- `lucide-react`
- `recharts`
- `vite-plugin-pwa`

3.2 Backend / Function Runtime

- Supabase Edge Functions
- Deno runtime
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- state helper internal via `kv_store.tsx`

3.3 External Platform Layer

Ads:
- Meta Ads API
- Google Ads API
- TikTok Ads API

Conversation:
- Instagram Messaging API
- Facebook Messenger API
- WhatsApp webhook / Meta messaging flow

Content and utility:
- Google Drive / storage content source
- Google Maps URL / lat-lng helper

Future AI layer:
- diagnosis foto
- auto follow-up
- auto ordering
- rule engine
- iklan berbasis AI


________________


SECTION 4 — MODULE BLUEPRINT
4.1 Command Center

Tujuan:
- memberi jawaban tercepat ke owner tentang kondisi bisnis hari ini
- memperlihatkan bottleneck utama dari iklan sampai order

Output utama:
- spend hari ini
- lead hari ini
- order hari ini
- pendapatan hari ini
- response time
- alert prioritas
- status integrasi

4.2 Ads Monitoring

Tujuan:
- membaca performa akun iklan secara objektif
- melihat akun mana yang harus scale, hold, atau cut

Output utama:
- ringkasan platform
- tabel akun iklan
- perbandingan periode
- status live vs snapshot
- rekomendasi aksi

4.3 Conversation Hub

Tujuan:
- membaca semua chat masuk
- memprioritaskan chat
- menghubungkan chat ke lead dan order

Output utama:
- inbox gabungan
- detail percakapan
- prioritas follow-up
- statistik harian percakapan

4.4 Lead Intelligence

Tujuan:
- menilai kualitas lead setelah masuk dari ads dan chat
- melihat lead panas, macet, duplikat, atau siap closing

Output utama:
- daftar lead
- status qualification
- source attribution
- progress ke order

4.5 Order Automation

Tujuan:
- mengubah hasil percakapan menjadi order operasional
- memilih cabang, teknisi, jadwal, dan estimasi rute

Output utama:
- draft order
- rekomendasi cabang
- rekomendasi teknisi
- queue order

4.6 Kemampuan Diagnostik Visual AI di Dalam Percakapan

Tujuan:
- membaca kondisi headlamp dari foto customer di chat
- membantu reply, qualification, dan rekomendasi treatment

Output utama:
- hasil deteksi kondisi
- severity
- rekomendasi tindakan
- status review manusia

Status saat ini:
- belum ada model diagnosis aktif di code
- baru ada fondasi upload/foto pada order

Catatan:
- ini bukan workspace / layar mandiri
- ini adalah kemampuan lintas modul yang muncul terutama di Pusat Percakapan

4.7 Creative & Content Center

Tujuan:
- menghubungkan konten iklan ke source storage
- memetakan aset ke performa iklan

Output utama:
- library aset
- metadata aset
- keterkaitan ke campaign
- performa aset

4.8 AI Action Center

Tujuan:
- menjadi pusat rekomendasi, approval, dan audit aksi AI

Output utama:
- queue rekomendasi
- alasan dan evidence
- payload usulan
- approval status
- hasil eksekusi


________________


SECTION 5 — DATA CONTRACT & REQUIRED FIELDS
5.1 Entity Identity Contract

Semua modul harus memakai identitas yang konsisten:

- `user_id`
- `role`
- `internal_ad_account_id`
- `platform_key`
- `external_account_id`
- `conversation_id`
- `channel_id`
- `lead_id`
- `order_id`
- `prospect_booking_id`
- `advertiser_id`
- `branch_id`
- `technician_id`

Tanpa kontrak identity ini, OpenClaw tidak boleh dipisah menjadi modul mandiri.

5.2 Ads Monitoring — Field Kontrak

Field agregat lintas platform:

- `date_range.from`
- `date_range.to`
- `platform`
- `internal_ad_account_id`
- `internal_ad_account_name`
- `live_account_name`
- `group_name`
- `source`
- `snapshot_date`
- `synced_at`
- `rate_limited`
- `error`
- `spend`
- `clicks`
- `impressions`
- `conversions`
- `leads`
- `orders`
- `revenue`
- `ctr`
- `cpc`
- `cpm`
- `cost_per_conversion`
- `cpl`
- `burn`

Meta Ads — field yang sudah nyata di code:

- `accountId`
- `name`
- `businessId`
- `businessName`
- `currency`
- `dateStart`
- `dateStop`
- `spend`
- `clicks`
- `impressions`
- `reach`
- `cpc`
- `ctr`
- `cpm`
- `cpp`

Google Ads — field yang sudah nyata di code:

- `customerId`
- `customerName`
- `managerCustomerId`
- `managerCustomerName`
- `currencyCode`
- `status`
- `dateStart`
- `dateStop`
- `spend`
- `clicks`
- `impressions`
- `conversions`
- `ctr`
- `cpc`
- `cpm`
- `costPerConversion`

TikTok Ads — field yang sudah nyata di code:

- `advertiserId`
- `advertiserName`
- `businessCenterId`
- `businessCenterName`
- `currency`
- `status`
- `dateStart`
- `dateStop`
- `spend`
- `clicks`
- `impressions`
- `conversions`
- `ctr`
- `cpc`
- `cpm`
- `costPerConversion`

5.3 Conversation Hub — Field Kontrak

Header / daftar percakapan:

- `conversation_id`
- `channel_id`
- `platform`
- `channel_label`
- `contact_name`
- `contact_handle`
- `last_message_at`
- `last_message_text`
- `unread_count`
- `message_count`
- `source`
- `priority`

Detail percakapan:

- `direction`
- `sender_name`
- `text`
- `attachments`
- `timestamp`
- `graph_link`
- `lead_id`
- `order_id`
- `assigned_cs_id`
- `qualification_status`

Statistik harian:

- `date`
- `inbound_messages`
- `new_conversations`
- `unique_contacts`
- `instagram_inbound_messages`
- `messenger_inbound_messages`

5.4 Lead Intelligence — Field Kontrak

- `lead_id`
- `customer_name`
- `customer_phone`
- `platform_id`
- `sub_channel_id`
- `conversation_id`
- `assigned_cs_id`
- `lead_status`
- `qualified_status`
- `follow_up_status`
- `last_follow_up_at`
- `order_id`
- `created_at`

5.5 Order Automation — Field Kontrak

Prospect booking / draft order:

- `id`
- `leadId`
- `orderId`
- `customerName`
- `customerPhone`
- `scheduleDate`
- `scheduleTime`
- `branchId`
- `areaId`
- `address`
- `mapsUrl`
- `notes`
- `status`
- `csId`
- `advertiserId`
- `technicianId`
- `vehicleId`
- `platformId`
- `subChannelId`
- `serviceId`

Order:

- `id`
- `leadDate`
- `customerName`
- `customerPhone`
- `address`
- `serviceDate`
- `serviceTime`
- `serviceId`
- `serviceCategory`
- `mapsUrl`
- `vehicleId`
- `units`
- `price`
- `platformId`
- `subChannelId`
- `csId`
- `advertiserId`
- `notes`
- `technicianId`
- `branchId`
- `areaId`
- `status`
- `paymentType`
- `paymentMethodId`
- `income`
- `paymentStatus`
- `paymentValidation`
- `affiliateName`
- `lat`
- `lng`
- `leadId`
- `photos.before`
- `photos.after`
- `photos.payment`
- `photos.signature`
- `startTravelAt`
- `startWorkAt`
- `finishedAt`
- `cancelReason`
- `cancelReasonNote`
- `isFollowedUp`
- `followedUpBy`
- `followedUpAt`
- `followUpNote`

5.6 Kemampuan Diagnostik Visual AI — Kontrak Input/Output

Input yang wajib nanti:

- `image_url`
- `vehicle_id`
- `service_id`
- `customer_complaint`
- `submitted_by`
- `submitted_at`

Output yang harus ada nanti:

- `detected_condition`
- `severity`
- `recommended_action`
- `confidence`
- `needs_human_review`
- `model_version`
- `review_status`

Status nyata saat ini:
- belum ada diagnosis engine di code
- blueprint ini menjadi kontrak masa depan

5.7 Creative & Content Center — Field Kontrak

- `asset_id`
- `asset_name`
- `asset_type`
- `storage_provider`
- `storage_path`
- `drive_file_id`
- `thumbnail_url`
- `caption`
- `copy_angle`
- `hook_type`
- `platform_fit`
- `status`
- `linked_campaign_ids`
- `performance_summary`

5.8 AI Action Center — Field Kontrak

- `action_id`
- `action_type`
- `priority`
- `title`
- `reason`
- `evidence`
- `related_entity_type`
- `related_entity_id`
- `proposed_payload`
- `approval_status`
- `approved_by`
- `approved_at`
- `executed_at`
- `execution_result`


________________


SECTION 6 — API CONTRACT
6.1 Ads API yang sudah ada

Meta:
- `GET /make-server-f781cd00/meta/live-breakdown`
- `GET /make-server-f781cd00/meta/snapshots`
- `POST /make-server-f781cd00/meta/sync-snapshots`
- `GET /make-server-f781cd00/meta/integration-configs`
- `POST /make-server-f781cd00/meta/integration-configs/:adAccountId`

Google:
- `GET /make-server-f781cd00/google/token-health`
- `GET /make-server-f781cd00/google/live-breakdown`
- `GET /make-server-f781cd00/google/snapshots`
- `POST /make-server-f781cd00/google/sync-snapshots`
- `GET /make-server-f781cd00/google/integration-configs`
- `POST /make-server-f781cd00/google/integration-configs/:adAccountId`

TikTok:
- `GET /make-server-f781cd00/tiktok/token-health`
- `GET /make-server-f781cd00/tiktok/authorize-url`
- `POST /make-server-f781cd00/tiktok/exchange-code`
- `GET /make-server-f781cd00/tiktok/advertisers`
- `GET /make-server-f781cd00/tiktok/business-centers`
- `GET /make-server-f781cd00/tiktok/business-centers/:bcId/assets`
- `GET /make-server-f781cd00/tiktok/live-breakdown`
- `GET /make-server-f781cd00/tiktok/snapshots`
- `POST /make-server-f781cd00/tiktok/sync-snapshots`
- `GET /make-server-f781cd00/tiktok/integration-configs`
- `POST /make-server-f781cd00/tiktok/integration-configs/:adAccountId`

6.2 Conversation API yang sudah ada

- `GET /make-server-f781cd00/meta/messaging/readiness`
- `POST /make-server-f781cd00/meta/messaging/assets/sync`
- `GET /make-server-f781cd00/meta/messaging/inbox/overview`
- `GET /make-server-f781cd00/meta/messaging/inbox/daily-stats`
- `GET /make-server-f781cd00/meta/messaging/inbox/messages`
- `POST /make-server-f781cd00/meta/messaging/send`
- public webhook: `/functions/v1/meta-messaging-webhook`

6.3 Order API yang sudah ada

- `GET /make-server-f781cd00/orders`
- `POST /make-server-f781cd00/orders`
- `PUT /make-server-f781cd00/orders/:id`
- `DELETE /make-server-f781cd00/orders/:id`
- `GET /make-server-f781cd00/mobile/technician-orders/:userId`

6.4 API masa depan yang diperlukan

- kemampuan diagnostik visual AI di percakapan
- AI recommendation queue
- approval mutation endpoint
- auto order draft from conversation
- follow-up scheduler
- creative asset linking
- ad execution payload endpoint


________________


SECTION 7 — UI CONTRACT
7.1 Layout umum yang wajib konsisten

Semua workspace OpenClaw harus mengikuti pola:

- `Top Control Bar`
- `Summary Strip`
- `Main Workspace`
- `Context Drawer / Side Panel`

7.2 State UI yang wajib didukung

- `loading`
- `live`
- `snapshot`
- `fallback`
- `partial`
- `rate_limit`
- `error`
- `empty`
- `unmapped`
- `approval_required`

7.3 Status sumber data harus jujur

Setiap angka utama wajib punya konteks sumber:

- live API
- snapshot database
- fallback activity
- last valid snapshot
- quota / rate limit
- data belum tersedia

7.4 Hak akses UI

Owner:
- full visibility
- approval
- full insight

Advertiser:
- fokus iklan
- insight performa
- rekomendasi budget

CS:
- inbox
- lead
- follow-up

Admin:
- order
- operasional
- assignment

Analyst:
- read-only
- audit
- comparison


________________


SECTION 8 — MODULARITY CONTRACT
8.1 Posisi default modul

Posisi default OpenClaw adalah:

- fitur di dalam sistem yang sudah ada
- workspace khusus di dalam web RHI System
- memanfaatkan auth, role, dan data host system

Jadi keputusan baseline-nya bukan memisahkan OpenClaw sebagai produk terpisah, melainkan menanamkan OpenClaw sebagai workspace khusus dengan boundary frontend yang rapi.

Keputusan yang dikunci:

- `Marketing OS` diposisikan sebagai workspace khusus
- workspace ini boleh memakai frontend / framework yang berbeda
- namun ia tetap menjadi bagian dari RHI System dari sisi produk, auth, permission, dan sumber data

8.2 Apakah boleh dipisah jadi modul sendiri?

Boleh, dan keputusan arsitektur sekarang memang mengarah ke sana.

OpenClaw dapat:
- tetap hidup di dalam frontend yang sama
- punya workspace visual yang terpisah
- atau menjadi frontend/app terpisah

8.3 Apakah boleh beda framework?

Ya, dan ini dianggap valid secara arsitektur dengan syarat:

- auth tetap satu
- permission tetap satu
- identity contract tetap satu
- source of truth tetap satu
- kontrak API tetap satu
- audit trail tetap satu

8.4 Boundary yang wajib dijaga

Auth boundary:
- session tidak boleh pecah
- user identity tidak boleh diduplikasi

Permission boundary:
- role dan privilege harus membaca sistem yang sama

Data boundary:
- tidak boleh ada tabel bayangan dengan arti entity berbeda
- `lead`, `order`, `conversation`, `ad account`, `channel` harus tetap satu arti

API boundary:
- semua modul membaca route yang sama atau kontrak baru yang kompatibel

Event boundary:
- event inbound harus tetap dicatat ke audit/store yang sama

UI boundary:
- boleh beda visual style
- boleh beda framework
- tidak boleh beda truth model

8.5 Rekomendasi saat ini

Untuk fase sekarang:
- backend tetap satu
- database tetap satu
- OpenClaw tetap dibuat sebagai workspace / fitur di dalam sistem host
- Marketing OS dipersiapkan sebagai workspace frontend khusus dengan boundary yang jelas
- visual language, routing, dan design system Marketing OS boleh lebih mandiri
- jika nanti dipisah frontend, gunakan kontrak API yang sekarang sebagai dasar


________________


SECTION 9 — DELIVERY ROADMAP
9.1 Fase 0 — Kondisi Saat Ini

Sudah ada:
- integrasi ads Meta, Google, TikTok
- snapshot ads database
- pusat percakapan IG DM dan Messenger
- mapping akun iklan internal ke live account
- order dan prospect booking dasar

Belum ada penuh:
- kemampuan diagnostik visual AI di percakapan
- full AI action center
- auto order from chat
- auto follow-up end-to-end
- eksekusi iklan berbasis AI

9.2 Fase 1 — Observe

Target:
- semua data penting terlihat jujur
- live + snapshot + fallback rapi
- semua bottleneck terlihat

9.3 Fase 2 — Assist

Target:
- AI memberi insight
- AI memberi draft reply
- AI memberi draft aksi
- AI memberi draft optimasi budget

9.4 Fase 3 — Execute With Approval

Target:
- AI bisa menyiapkan payload tindakan
- user tinggal review dan approve
- semua aksi tercatat

9.5 Fase 4 — Controlled Autonomy

Target:
- aksi berisiko rendah berjalan otomatis
- follow-up dasar otomatis
- routing order draft otomatis
- rotasi optimasi iklan terkontrol

9.6 Fase 5 — Full Revenue Loop

Target:
- traffic masuk
- chat tertangani
- kebutuhan terdeteksi
- order dibuat
- follow-up berjalan
- iklan disesuaikan ulang
- semua loop dari biaya ke uang berjalan semakin otomatis


________________


SECTION 10 — IMPLEMENTATION BREAKDOWN
10.1 Prinsip Breakdown

Karena OpenClaw adalah fitur / workspace di atas sistem host yang sudah berjalan, implementasi harus mengikuti urutan:

1. integrasi host system
2. observabilitas data
3. konsistensi entity
4. rekomendasi dan approval
5. automasi bertahap

Prioritas implementasi tidak boleh dimulai dari AI penuh.
Prioritas implementasi harus dimulai dari kebenaran data, kejelasan entity, dan action loop yang bisa diaudit.

10.2 Epic P0 — Host Integration Foundation

Tujuan:
- memastikan OpenClaw tertanam rapi di RHI System
- tidak memecah auth, role, dan entity bisnis

Scope:
- route workspace OpenClaw di dalam shell host
- permission gating per role
- source badge live / snapshot / fallback
- kontrak entity bersama: `user`, `lead`, `order`, `conversation`, `internal_ad_account`
- status integrasi lintas platform

Definition of done:
- OpenClaw bisa diakses dari navigasi host
- role yang tidak berhak tidak bisa membuka action sensitif
- semua layar utama menampilkan status sumber data
- tidak ada duplikasi model identity antar modul

10.3 Epic P1 — Ads Monitoring Hardening

Tujuan:
- menjadikan Ads Monitoring sebagai sumber baca performa yang objektif

Scope:
- ringkasan lintas platform
- tabel akun iklan live + snapshot
- mapping akun internal ke akun live
- fallback saat rate limit
- sinkron snapshot 90 hari
- compare mode dan drawer detail

Dependensi:
- master data `ad_accounts`
- integrasi config Meta / Google / TikTok
- tabel snapshot ads

Definition of done:
- akun yang terceklis di master data tampil konsisten
- source status tampil jujur
- Google rate limit tidak membuat akun hilang dari tabel
- TikTok, Meta, Google mengikuti pola yang seragam

10.4 Epic P1 — Pusat Percakapan Hardening

Tujuan:
- menjadikan inbox lintas channel sebagai pusat follow-up yang bisa dipercaya

Scope:
- inbox gabungan IG DM + Messenger
- grouping per channel
- filter tanggal aktivitas
- statistik harian
- context panel lead / order terkait
- status unread, priority, dan follow-up

Dependensi:
- webhook store
- route `meta/messaging/*`
- identity contract `conversation_id`, `channel_id`, `lead_id`

Definition of done:
- thread IG dan Messenger terbaca terpisah
- filter tanggal berfungsi konsisten
- statistik harian punya label sumber yang jujur
- detail percakapan bisa terhubung ke lead/order bila ada

10.5 Epic P2 — Lead Intelligence & Order Orchestration

Tujuan:
- menyambungkan percakapan ke lead, lalu lead ke order

Scope:
- workspace lead intelligence
- scoring dan status lead
- draft order dari context percakapan
- rekomendasi cabang / teknisi / jarak
- queue prospect booking dan order

Dependensi:
- `leads`
- `prospect_bookings`
- `orders`
- helper maps / lat-lng / distance

Definition of done:
- owner bisa melihat jalur `chat -> lead -> order`
- CS bisa membuat order lebih cepat dari context yang sama
- operasional bisa membaca queue tanpa pindah banyak layar

10.6 Epic P3 — AI Assist Layer

Tujuan:
- membuat OpenClaw memberi bantuan nyata, bukan cuma menampilkan data

Scope:
- recommendation cards
- draft reply
- draft follow-up
- draft aksi budget
- approval queue
- evidence panel

Dependensi:
- audit trail
- source badge yang jujur
- action payload contract

Definition of done:
- semua rekomendasi punya alasan dan evidence
- semua rekomendasi bisa di-approve / reject / edit
- tidak ada aksi AI penting yang berjalan tanpa jejak audit

10.7 Epic P4 — Controlled Autonomy

Tujuan:
- menjalankan aksi berisiko rendah secara otomatis

Scope:
- auto follow-up dasar
- auto routing draft order
- auto warning overload lead
- auto scheduling sinkron snapshot
- auto triage percakapan

Dependensi:
- approval model
- confidence threshold
- audit and rollback policy

Definition of done:
- ada daftar aksi yang diizinkan otomatis
- ada daftar aksi yang wajib approval
- setiap automasi punya log, timestamp, dan hasil eksekusi

10.8 Epic P5 — Future Full Loop Modules

Modul masa depan:
- kemampuan diagnostik visual AI berbasis foto customer
- TikTok DM ingestion
- creative-content linking ke drive
- rule engine iklan
- draft campaign / ads generation
- optimasi berbasis closing nyata

Catatan:
- modul ini tidak boleh mengorbankan kestabilan host system
- setiap modul baru harus masuk lewat kontrak entity yang sudah disepakati

10.9 Definisi Siap Implementasi

Sebuah modul OpenClaw dianggap siap diimplementasikan jika:

- tujuan bisnisnya jelas
- entity contract-nya jelas
- field yang harus ditarik jelas
- UI state-nya jelas
- source of truth-nya jelas
- siapa yang berhak bertindak jelas
- fallback behavior-nya jelas

Jika salah satu belum jelas, modul belum layak masuk tahap coding penuh.


________________


SECTION 11 — KESIMPULAN
OpenClaw Marketing OS bukan sekadar fitur `Ads Monitoring`.

OpenClaw adalah modul sistem operasi marketing dan percakapan yang harus:

- membaca data lintas platform
- menyatukan ads, chat, lead, order, dan hasil bisnis
- menunjukkan bottleneck secara objektif
- memberi rekomendasi dan aksi
- lalu tumbuh menuju automasi penuh dari traffic sampai uang

Dokumen ini sengaja dibuat menyerupai blueprint sistem formal:

- agar engineering bisa memecah pekerjaan dengan jelas
- agar AI agent punya konteks implementasi yang konsisten
- agar OpenClaw bisa tumbuh menjadi modul mandiri tanpa memecah sumber kebenaran bisnis
