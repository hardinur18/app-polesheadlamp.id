# OPENCLAW MARKETING OS MICROFRONTEND ARCHITECTURE
Spesifikasi Arsitektur Frontend Modular — Versi 1.0.0
Klasifikasi     : Spesifikasi Arsitektur FE yang bisa dieksekusi tim

Cakupan         : Boundary frontend khusus `Marketing OS` di dalam
                  `RHI System`
                  Host Shell · Marketing OS Frontend
                  Shared Backend / Orchestration
                  Data + Integration

Arsitektur      : Route-level microfrontend · shared auth
                  shared permission · shared API contract
                  shared source of truth · local design system

Rendering       : Embedded workspace di host system
                  shell FE modular · design token scoped
                  internal routing per workspace

Kepatuhan       : Satu session · satu identity contract
                  satu audit trail · satu arti entity bisnis

Menggantikan    : Draft arsitektur microfrontend sebelumnya yang masih
                  berbentuk dokumen naratif biasa


CATATAN POSISI PRODUK
Dokumen ini tidak mendefinisikan `Marketing OS` sebagai aplikasi bisnis yang berdiri sendiri dari nol.

Dokumen ini mendefinisikan `Marketing OS` sebagai:

- workspace khusus
- boundary frontend khusus
- calon microfrontend
- dan calon sub-product

yang tetap hidup di dalam sistem `RHI System` yang sudah berjalan.

Artinya:

- shell produk utama tetap ada
- login utama tetap ada
- role dan permission tetap ada
- entity bisnis utama tetap ada
- `Marketing OS` hanya mengambil boundary FE yang lebih tegas dan lebih mandiri


CARA MENGGUNAKAN FILE INI
Dokumen ini dipakai saat:

- menentukan apakah `Marketing OS` akan memakai framework frontend khusus
- menentukan boundary antara host shell dan frontend Marketing OS
- menentukan desain token global khusus Marketing OS
- merancang struktur package FE modular
- menilai apakah perubahan visual boleh dilakukan global atau hanya scoped
- merancang rollout bertahap dari embedded workspace ke microfrontend yang lebih mandiri

Dokumen ini harus dibaca bersama:

- `Blueprint OpenClaw Marketing OS.md`
- `PRD OpenClaw Marketing OS.md`
- `Technical OpenClaw Marketing OS.md`
- `UI OpenClaw Marketing OS.md`


________________


VARIABLES — PROFIL ARSITEKTUR
project:

  name:         "OpenClaw Marketing OS"
  slug:         "openclaw-marketing-os"
  host_system:  "RHI System"
  repo:         "Polesheadlamp.id"
  frontend_mode: "Route-level microfrontend"
  domain_mode:   "Embedded in host, separable later"
  locale:       "id"
  timezone:     "Asia/Jakarta"

roles:

  - id: "owner"        label: "Owner"
  - id: "advertiser"   label: "Advertiser / Media Buyer"
  - id: "cs"           label: "Customer Service"
  - id: "admin"        label: "Admin Operasional"
  - id: "analyst"      label: "Analis / Observer"

frontend_boundary:

  host_shell:            "RHI System"
  mfe_name:              "Marketing OS"
  navigation_mount:      "OPERASIONAL > Marketing OS"
  route_mount:           "/app/marketing-os"
  auth_mode:             "shared"
  permission_mode:       "shared"
  api_mode:              "shared"
  audit_mode:            "shared"

design_system_marketing_os:

  scope: "khusus di dalam shell Marketing OS, tidak menimpa seluruh host system"

  typography:
    font_heading:        "Public Sans"
    font_body:           "Inter"
    font_mono:           "IBM Plex Mono"
    title_size:          "32px - 40px"
    section_title_size:  "24px"
    metric_size:         "30px - 40px"
    body_size:           "14px"
    caption_size:        "12px"

  spacing:
    shell_padding_x:     "24px"
    shell_padding_y:     "24px"
    section_gap:         "24px"
    grid_gap:            "16px"
    card_gap:            "16px"
    control_gap:         "16px"

  radius:
    shell:               "24px"
    card:                "24px"
    drawer:              "30px"
    control:             "20px"
    button:              "20px"
    badge:               "999px"

  card:
    padding:             "20px"
    background:          "#111827"
    background_muted:    "#0f172a"
    border:              "1px solid rgba(148, 163, 184, 0.14)"
    shadow:              "0 10px 30px rgba(0, 0, 0, 0.22)"

  table:
    header_height:       "40px"
    row_height:          "46px"
    dense_row_height:    "40px"
    horizontal_padding:  "16px"

arsitektur_saat_ini:

  frontend_host:        "React 18 + Vite 6 + React Router 7"
  backend_shared:       "Supabase Edge Functions + service layer"
  database_shared:      "Supabase PostgreSQL"
  auth_shared:          "Supabase Auth"
  storage_shared:       "Supabase Storage"


________________


SECTION 0 — GLOBAL FE DESIGN CONTRACT KHUSUS MARKETING OS
Tujuan section ini adalah menetapkan `global FE rules` yang rapi untuk `Marketing OS` tanpa mengubah global style seluruh `RHI System`.

Prinsip:

- `Marketing OS` boleh punya visual language yang lebih kuat
- `Marketing OS` boleh punya design token sendiri
- token ini hanya berlaku di bawah shell `Marketing OS`
- host system di luar `Marketing OS` tidak ikut berubah

Aturan implementasi:

- semua style global Marketing OS harus di-scope ke namespace seperti:
  - `.marketing-os-shell`
  - `.marketing-os-theme`
  - atau boundary FE setara
- tidak boleh override selector global host system secara liar
- token harus didefinisikan sebagai `local design system`
- seluruh modul `Marketing OS` harus memakai token yang sama

Token minimal yang wajib ada:

- `spacing shell`
- `spacing section`
- `grid gap`
- `card gap`
- `radius shell`
- `radius card`
- `radius drawer`
- `radius control`
- `radius badge`
- `card padding`
- `table header height`
- `table row height`
- `font heading`
- `font body`
- `font mono`

Aturan FE modular:

- modul baru tidak boleh hardcode padding/radius berbeda tanpa alasan
- semua card harus baca token radius dan padding yang sama
- semua table harus baca density token yang sama
- semua drawer harus baca radius, gap, dan spacing token yang sama
- semua badge status harus baca radius dan height token yang sama

Target hasil:

- FE terasa modular
- style terasa global di dalam `Marketing OS`
- tetapi tetap tidak bocor ke seluruh host app


________________


SECTION 1 — 4-LAYER MICROFRONTEND ARCHITECTURE
Arsitektur `Marketing OS` harus dibaca sebagai `4 layer`.

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
Marketing OS Microfrontend / Workspace
- route internal
- design system
- screen shell
- module UI

        ↓

LAYER 3 — SHARED BACKEND / ORCHESTRATION
Supabase Edge Functions + shared orchestration
- ads sync
- conversation orchestration
- snapshot
- approval
- AI action flow

        ↓

LAYER 4 — DATA + INTEGRATION
Shared DB + Storage + External APIs
- lead
- order
- conversation
- ads snapshot
- Meta / Google / TikTok / WA / Drive
```

1.1 Layer 1 — Host Shell

Tanggung jawab:

- login
- session user
- role dan permission
- sidebar utama
- entry point ke `Marketing OS`

Komponen nyata saat ini:

- `Sidebar.tsx`
- `AppLayout.tsx`

Boundary:

- host shell tetap memegang navigasi utama
- `Marketing OS` masuk sebagai parent item baru di `OPERASIONAL`

1.2 Layer 2 — Marketing OS Frontend

Tanggung jawab:

- internal routing `Marketing OS`
- shell layout khusus `Marketing OS`
- design system khusus `Marketing OS`
- module FE:
  - `Command Center`
  - `Ads Monitoring`
  - `Conversation Hub`
  - `Lead Intelligence`
  - `Order Automation`
  - `Creative & Content Center`
  - `AI Action Center`

Boundary:

- boleh beda framework
- boleh beda sistem styling
- boleh beda bundle frontend
- tetapi tidak boleh beda identity contract

1.3 Layer 3 — Shared Backend / Orchestration

Tanggung jawab:

- backend integrasi ads
- backend percakapan
- snapshot
- fallback
- approval payload
- rekomendasi aksi
- future workflow AI

Komponen nyata saat ini:

- `supabase/functions/server/index.tsx`
- `meta_messaging.tsx`
- `google_ads.tsx`
- `tiktok_ads.tsx`

Boundary:

- `Marketing OS` tidak membuat backend paralel dengan arti data berbeda
- semua route baru harus kompatibel dengan kontrak entity yang sama

1.4 Layer 4 — Data + Integration

Tanggung jawab:

- database utama
- storage utama
- audit log
- snapshot ads
- conversation store
- lead
- order
- integrasi platform

Boundary:

- `lead`, `order`, `conversation`, `ad account`, `platform`, `channel` tetap satu arti
- tidak boleh ada tabel bayangan dengan definisi bisnis yang berbeda


________________


SECTION 2 — MICROFRONTEND MOUNT CONTRACT
2.1 Posisi mount

`Marketing OS` harus dipasang sebagai:

- parent item di sidebar host
- route mount khusus
- shell FE khusus

Tree host:

```text
OPERASIONAL
├── Iklan Harian
├── Monitoring Perf.
├── Marketing OS
│   ├── Command Center
│   ├── Ads Monitoring
│   ├── Conversation Hub
│   ├── Lead Intelligence
│   ├── Order Automation
│   ├── Creative & Content Center
│   └── AI Action Center
```

2.2 Route mount

```text
/app/marketing-os
/app/marketing-os/command-center
/app/marketing-os/ads-monitoring
/app/marketing-os/conversation-hub
/app/marketing-os/lead-intelligence
/app/marketing-os/order-automation
/app/marketing-os/creative-content
/app/marketing-os/ai-action-center
```

2.3 Aturan navigasi

- host sidebar hanya sampai level `Marketing OS -> Workspace`
- level yang lebih dalam harus memakai:
  - `tab`
  - `subnav horizontal`
  - `segmented control`
  - `drawer`
- jangan buat sidebar level ketiga


________________


SECTION 3 — SHARED AUTH, PERMISSION, DAN IDENTITY CONTRACT
3.1 Auth boundary

- session tidak boleh pecah
- login tidak boleh digandakan
- logout harus memutus host dan Marketing OS sekaligus

3.2 Permission boundary

- role tetap membaca sistem host
- privilege tetap mengikuti contract host
- `Marketing OS` tidak boleh punya model permission liar sendiri

3.3 Identity boundary

Entity berikut tidak boleh dipecah:

- `user`
- `role`
- `lead`
- `order`
- `conversation`
- `ad account`
- `platform`
- `channel`
- `advertiser`

3.4 Audit boundary

- semua aksi AI
- semua approval
- semua sync penting
- semua perubahan state penting

harus tetap masuk ke audit trail yang sama


________________


SECTION 4 — FRONTEND MODULAR PACKAGE CONTRACT
Tujuan section ini adalah membuat FE `Marketing OS` benar-benar modular.

4.1 Boundary folder di repo yang sama

```text
src/
├── app/                           # host system
├── marketing-os/                  # boundary FE Marketing OS
│   ├── app-shell/
│   ├── routes/
│   ├── modules/
│   │   ├── command-center/
│   │   ├── ads-monitoring/
│   │   ├── conversation-hub/
│   │   ├── lead-intelligence/
│   │   ├── order-automation/
│   │   ├── creative-content/
│   │   └── ai-action-center/
│   ├── shared/
│   │   ├── ui/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── stores/
│   │   └── contracts/
│   └── design-system/
└── lib/
```

4.2 Package logis yang disarankan

- `marketing-os/app-shell`
- `marketing-os/design-system`
- `marketing-os/shared-ui`
- `marketing-os/shared-services`
- `marketing-os/shared-contracts`
- `marketing-os/modules/command-center`
- `marketing-os/modules/ads-monitoring`
- `marketing-os/modules/conversation-hub`
- `marketing-os/modules/lead-intelligence`
- `marketing-os/modules/order-automation`
- `marketing-os/modules/creative-content`
- `marketing-os/modules/ai-action-center`

4.3 Aturan modular FE

- module tidak boleh saling import komponen page secara liar
- shared UI harus lewat package/boundary yang jelas
- tokens desain harus terpusat
- services FE harus terpusat
- contract type harus terpusat

4.4 Global FE tokens khusus Marketing OS

Semua modul harus memakai token yang sama untuk:

- `shell padding x = 24px`
- `shell padding y = 24px`
- `section gap = 24px`
- `grid gap = 16px`
- `card gap = 16px`
- `card radius = 24px`
- `drawer radius = 30px`
- `control radius = 20px`
- `badge radius = 999px`
- `card padding = 20px`
- `input height = 48px`
- `button height = 44px`
- `table header height = 40px`
- `table row height = 46px`
- `font heading = Public Sans`
- `font body = Inter`
- `font mono = IBM Plex Mono`

4.5 Anti-pattern FE

Yang tidak boleh terjadi:

- setiap modul punya radius sendiri-sendiri
- padding card beda jauh tanpa aturan
- table density beda total antar modul
- drawer style tidak konsisten
- heading font bercampur tanpa kontrak
- override global host system secara sembarangan


________________


SECTION 5 — IMPLEMENTATION MODEL
5.1 Opsi A — Embedded Route di Frontend yang Sama

Plus:

- paling cepat
- paling mudah implementasi
- paling minim risiko auth/session

Minus:

- boundary frontend belum sepenuhnya terpisah

5.2 Opsi B — Route-Level Microfrontend dengan Frontend Terpisah

Plus:

- boundary FE paling jelas
- paling cocok untuk framework khusus
- paling cocok untuk design system yang lebih mandiri

Minus:

- perlu integrasi session dan deployment yang lebih disiplin

5.3 Opsi C — Module Federation Runtime

Status:

- belum direkomendasikan untuk fase awal
- terlalu berat untuk kondisi sekarang


________________


SECTION 6 — REKOMENDASI FINAL
Rekomendasi final untuk kondisi sekarang:

- pakai `route-level microfrontend`
- `Marketing OS` tetap embedded dari sisi produk
- `Marketing OS` diperlakukan sebagai boundary FE khusus dari sisi arsitektur
- backend tetap shared
- database tetap shared
- auth tetap shared
- permission tetap shared
- design system global di-scope hanya ke Marketing OS

Kesimpulan implementasi:

- `fase 1`: logical microfrontend
- `fase 2`: physical separate frontend jika sudah perlu


________________


SECTION 7 — ROADMAP
7.1 Tahap 1 — Logical Microfrontend

- parent sidebar `Marketing OS` hidup di host
- route `Marketing OS` dipisah rapi
- layout `Marketing OS` dipisah
- design token `Marketing OS` dipisah
- shared services `Marketing OS` dipisah

7.2 Tahap 2 — Physical Frontend Boundary

- folder FE `Marketing OS` dipisah
- bundle FE `Marketing OS` dipisah
- host mount tetap sama
- session sharing diverifikasi

7.3 Tahap 3 — Full Microfrontend Operations

- deploy independen
- observability independen
- rollback FE independen
- lifecycle FE independen tanpa memecah sistem bisnis


________________


SECTION 8 — KEPUTUSAN AKHIR
Keputusan akhir dokumen ini:

- `Marketing OS` adalah `workspace microfrontend`
- `RHI System` adalah `host shell`
- `backend + data` tetap `shared platform`
- FE Marketing OS harus modular
- global FE token Marketing OS harus rapi dan konsisten
- padding, radius, table density, shell spacing, card style, dan typography harus jadi kontrak global di dalam Marketing OS
- kontrak global itu tidak boleh bocor ke seluruh host system

Dengan bentuk ini, `Marketing OS` bisa tumbuh menjadi sub-product yang sangat kuat tanpa membuat sistem operasional utama pecah.
