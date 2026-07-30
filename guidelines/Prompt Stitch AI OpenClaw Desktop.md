# Prompt Stitch AI — OpenClaw Marketing OS Desktop

Dokumen ini berisi prompt siap-paste untuk Stitch AI agar menghasilkan konsep UI/UX desktop OpenClaw Marketing OS yang sesuai dengan posisi produk, kebutuhan data, dan gaya sistem host RHI System.


## Prompt Utama

```text
Design a desktop-first operational workspace called "OpenClaw Marketing OS" that lives inside an existing admin web app called "RHI System" (Restoration Headlamp Indonesia).

Important context:
- This is NOT a brand new startup product from scratch.
- This is a feature/workspace inside an existing running business system.
- The host system already has login, roles, navigation shell, master data, lead, order, and internal business entities.
- OpenClaw should feel like a powerful new operations workspace inside the host system, not a separate marketing landing page.
- The UI may feel more premium, sharper, and more command-center-like than the rest of the app, but it must still feel like part of the same ecosystem.
- Marketing OS should be treated as a dedicated frontend boundary / route-level microfrontend inside the host app.
- It can have its own local design system, shell, and UI rules, but it still shares auth, permissions, API contracts, and source of truth with the host system.
- Architecture decision is locked: Marketing OS is treated as a dedicated workspace with its own frontend boundary and may use a different UI framework, while still sharing the same auth, permissions, API contracts, and source of truth as the host app.

Primary goal:
Create a desktop UI/UX concept for OpenClaw as a marketing + conversation + action control center that helps the owner and internal team monitor ads, monitor conversations, detect bottlenecks, and approve AI actions.

Primary users:
- Owner / internet marketer specialist
- Advertiser / media buyer
- Customer service
- Admin operasional
- Analyst

Core product idea:
OpenClaw is an operational AI workspace that connects:
- ads data from Meta Ads, Google Ads, TikTok Ads
- conversation data from Instagram DM, Messenger, WhatsApp, and future TikTok DM
- lead data
- order data
- operational assignment
- AI recommendations and future automation

At this stage, focus on desktop UI/UX first.
Do not design mobile first.
Do not make a landing page.
Do not make a generic SaaS homepage.
Do not make it look like a simple analytics dashboard only.
This should feel like a real operator console for a running business.

Design direction:
- dark professional control-room feel
- strong information hierarchy
- dense but calm
- modern enterprise dashboard
- crisp typography
- sharp tables
- structured cards
- clear status badges
- confident visual system
- no purple default SaaS vibe
- no playful consumer style
- no excessive glassmorphism
- no over-decorated futuristic sci-fi UI

Visual language:
- preserve compatibility with an existing dark admin system
- use deep navy / graphite / slate surfaces
- use blue as primary action color
- use green, amber, and red for operational states
- use lighter text with strong readability
- use subtle separators and grid structure
- use meaningful highlights for alert states and AI action states

Create a local design system specifically for Marketing OS first, not for the entire host app.
The design system should feel scoped to the Marketing OS workspace only.
Assume the scope is something like `.marketing-os-shell` or an equivalent frontend boundary so the style system feels global inside Marketing OS, but does not leak into the rest of the host app.

Global Marketing OS design rules:
- use a local workspace shell with 24px horizontal padding and 24px vertical padding
- use 24px section spacing and 16px grid/card gaps
- use large shell radius around major workspace containers: 24px
- use card radius: 24px
- use control, button, and input radius: 20px
- use input height around 48px and default button height around 44px
- use pill/status badge radius: fully rounded
- use dense operational cards with around 20px internal padding
- use tables with around 40px header height and 46px row height
- use stronger display typography for headings and KPI numbers
- use Public Sans for headings
- use Inter for body and UI text
- use a mono font such as IBM Plex Mono for timestamps, sync state, IDs, and status-heavy metadata
- keep shadows subtle and heavy enough to separate layers in a dark workspace
- do not let these tokens override the entire host system globally; scope them to Marketing OS only

Desktop target:
- 1440px to 1600px wide desktop layout
- design for widescreen operational use
- support heavy data density without feeling cluttered

The workspace should include these modules:
1. Command Center
2. Ads Monitoring
3. Conversation Hub
4. AI Action Center

Optional secondary modules that can appear in navigation or future placeholders:
5. Lead Intelligence
6. Order Automation
7. Creative & Content Center

Host app navigation must follow this tree:
- DASHBOARD
  - Dashboard
- OPERASIONAL
  - Iklan Harian
  - Monitoring Perf.
  - Marketing OS
    - Command Center
    - Ads Monitoring
    - Conversation Hub
    - Lead Intelligence
    - Order Automation
    - Creative & Content Center
    - AI Action Center
  - Affiliate
  - Prospek
  - Pesanan & Penugasan
  - Laporan Operasional
  - Jadwal
  - Ketersediaan Teknisi
  - Jadwal Saya
  - Aktivitas Teknisi
  - Pemantauan Lapangan
  - Peta Sebaran
- KEUANGAN
  - Payroll & Gaji
  - Pembayaran
  - Pengeluaran Rutin
  - Kas Masuk/Keluar
  - Hutang & Piutang
  - Operasional Teknisi
  - Payment Gateway
- ADMINISTRASI
  - Inventaris
  - Master Data
  - Pengguna & Akses
  - Role Permission
  - Template WhatsApp

Important navigation rule:
- do NOT show standalone root sidebar items named "Ads Monitoring" or "Conversation Center"
- those areas must live under one parent item only: "Marketing OS"
- the left sidebar should make Marketing OS look like one coherent workspace family inside the host system

Overall UX requirements:
- top control bar for global filtering
- summary strip with operational KPI cards
- main workspace area
- contextual right drawer or side panel for detail
- clear live/snapshot/fallback/rate-limit states
- every critical number must show its data source state
- make it obvious which actions are safe and which require approval

Global control bar should include:
- date range filter
- platform filter
- advertiser filter
- channel filter
- compare mode toggle
- sync status pill
- refresh action
- AI action shortcut

Global KPI cards examples:
- Spend Hari Ini
- Lead Hari Ini
- Order Hari Ini
- Pendapatan Hari Ini
- CPL
- Response Time
- Unread Percakapan
- Alert Prioritas

Data source badges that must exist visually:
- Live API
- Snapshot DB
- Fallback
- Partial
- Rate Limit
- Error
- Approval Required

Integrations to show in the system status area:
- Meta Ads
- Google Ads
- TikTok Ads
- Instagram DM
- Messenger
- WhatsApp
- TikTok DM (future / not active yet)

Now design the following desktop screens in one coherent design system:

SCREEN 1 — OVERVIEW (COMMAND CENTER)
Purpose:
- give the owner the fastest answer about today's business condition
- answer: how much money spent, how many leads entered, how many orders closed, where the bottleneck is

Layout:
- top control bar
- first row: integration status cards
- second row: KPI cards
- third row: compact funnel strip
- fourth row: alert list + AI insight list + priority issues
- right side or lower area: action queue for urgent operational items

Integration status cards must show:
- platform name
- status
- last sync time
- source state
- warning message if any

Funnel examples:
- impressions
- clicks
- conversations
- leads
- orders
- paid / revenue

Alert blocks examples:
- akun boros
- percakapan panas belum dibalas
- CS overload
- lead macet
- data rate limit
- snapshot lama

SCREEN 2 — ADS (ADS MONITORING)
Purpose:
- objectively monitor ad accounts across platforms
- decide which account to scale, hold, cut, or investigate

Layout:
- same control bar
- summary strip
- large table/grid as main focus
- right drawer for selected ad account details

Main table columns:
- Platform
- BM / Manager / Group
- Akun Internal
- Akun Live
- Advertiser
- Spend
- Burn
- Leads
- Orders
- Revenue
- CPL
- CTR
- Source Status
- Last Sync
- Action

Important UX rules:
- Meta, Google, TikTok should feel unified
- source status must be visible, not hidden
- if Google is rate limited, account rows must still appear if snapshot exists
- if account is mapped but snapshot is not ready, show clear waiting state instead of hiding row
- drawer detail should contain tabs:
  - Ringkasan
  - Metrik
  - Riwayat Sinkron
  - Masalah Data
  - Rekomendasi AI

SCREEN 3 — CONVERSATIONS (CONVERSATION HUB)
Purpose:
- central inbox for Instagram DM, Messenger, and later WhatsApp / TikTok DM
- help CS and owner see which conversations need immediate action

Layout:
- three-panel desktop layout
- left panel: conversation list
- center panel: active conversation thread
- right panel: contextual CRM and AI panel

Left panel requirements:
- grouped by channel
- searchable by name / handle / number
- filter by date activity
- filter by status
- show unread count
- show last activity
- show priority

Center panel requirements:
- full conversation thread
- inbound/outbound distinction
- attachments
- time grouping
- quick reply area
- AI draft reply area
- AI visual diagnosis result if the customer sends a headlamp photo

Right panel requirements:
- linked lead info
- linked order info
- advertiser / source ads info
- CS owner
- qualification status
- next best action
- AI visual inspection card for customer-submitted photos
- action buttons like:
  - tandai follow-up
  - buat lead
  - buat order draft
  - minta approval AI

Important UX rule:
- Instagram and Messenger must be visually distinguishable but still part of one system
- photo diagnosis is NOT a separate module screen; it is an AI capability embedded inside the conversation workflow
- show daily summary cards above or near the inbox:
  - Active Threads
  - Today Inbound
  - Unique Contacts
  - Unreplied
  - Median Response Time
- show clear labels if stats are from webhook store or fallback activity

SCREEN 4 — ACTIONS (ACTION CENTER)
Purpose:
- a place where OpenClaw recommendations are reviewed and approved

Layout:
- queue/list view on the left or center
- detail view on the right
- filters for priority, module, approval status, risk level

Recommendation rows should show:
- priority
- action type
- related entity
- summary reason
- approval status
- created time

Detail panel should show:
- title
- problem summary
- evidence
- proposed action payload
- expected impact
- risk notes
- source of truth
- approve / reject / edit controls

Action examples:
- naikkan budget akun tertentu
- hold campaign
- follow up lead panas
- buat order draft
- remind CS
- refresh snapshot

Important product rules:
- high-risk actions should never feel auto-executed
- the design must clearly separate recommendation from execution
- evidence must be visible before approval

Cross-screen design rules:
- use a consistent desktop shell
- support a right-side detail drawer pattern across modules
- tables should feel premium and data-dense
- empty states should feel useful, not decorative
- all data states must be explicit
- warnings should feel operational, not dramatic
- make the whole experience feel like a real business control room

Must-have UX states:
- loading
- empty
- live
- snapshot
- fallback
- partial
- rate limit
- error
- unmapped
- approval required

Output request:
- create a coherent desktop UI system and high-fidelity concept
- show the main desktop shell and navigation for OpenClaw inside the existing app
- design the four main screens in one consistent visual language
- include realistic cards, tables, filters, drawers, status pills, alert blocks, and action components
- show operational density and hierarchy clearly
- make the result feel production-minded, not conceptual fluff

Do not:
- create a landing page hero
- create a simple BI dashboard only
- use soft pastel startup colors
- over-focus on mobile
- make it feel like a separate unrelated brand

The final design should feel like:
- a powerful embedded workspace inside a real running business system
- an operator-grade AI marketing OS
- serious, fast, dense, and trustworthy
```


## Prompt Lanjutan Opsional

Pakai ini kalau hasil pertama dari Stitch sudah keluar, lalu Anda ingin refine.

### Refinement 1 — Biar Lebih Mirip Sistem Host

```text
Refine this design so it feels more embedded inside an existing admin system, not like a standalone SaaS product. Keep OpenClaw visually stronger and more premium, but make it look like a workspace that belongs inside the same host product.

Reduce anything that feels like a marketing homepage.
Increase operational density, table confidence, and control-room behavior.
Preserve dark admin styling, but keep readability high.
```

### Refinement 2 — Fokus Ads Monitoring

```text
Refine the Ads Monitoring screen to feel more like a real media buying cockpit.

Make the ad account table the hero.
Improve scanability for:
- platform
- live account
- spend
- leads
- orders
- revenue
- CPL
- CTR
- source status

Make rate-limit, snapshot, and fallback states explicit and elegant.
The UI should help a media buyer decide in seconds which account to scale, hold, cut, or inspect.
```

### Refinement 3 — Fokus Conversation Hub

```text
Refine the Conversation Hub screen so it feels like a high-performance conversation operations center.

Keep the three-panel structure.
Make Instagram and Messenger visually distinguishable.
Improve clarity for:
- unread
- last activity
- priority
- linked lead
- linked order
- recommended next action

The inbox should feel useful for a CS operator who needs to act fast, not just read messages.
```

### Refinement 4 — Fokus AI Action Center

```text
Refine the AI Action Center screen so it feels trustworthy and audit-friendly.

Recommendations must not feel like automatic hidden AI actions.
Show evidence, rationale, payload, expected impact, and approval controls clearly.
The design should communicate controlled autonomy, not black-box automation.
```


## Catatan Pakai

- Kalau Stitch menghasilkan UI yang terlalu “startup dashboard”, pakai `Refinement 1`.
- Kalau terlalu cantik tapi kurang operasional, minta `increase data density`.
- Kalau terlalu ramai, minta `preserve density but improve scanability and grouping`.
- Untuk tahap awal, generate dulu 4 layar inti:
  - `Command Center`
  - `Ads Monitoring`
  - `Conversation Hub`
  - `AI Action Center`
