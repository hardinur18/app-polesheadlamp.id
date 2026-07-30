# Ads Monitoring OpenClaw Foundation

## Status

- `Tanggal`: 12 April 2026
- `Scope`: pondasi khusus `Ads Monitoring + OpenClaw`
- `Tujuan`: membangun fondasi fitur tanpa mengganggu data dan perilaku fitur lain

Dokumen ini menjawab satu hal:

> pondasi apa yang dibangun khusus untuk fitur ini, agar kita bisa naik ke level tertinggi tanpa merusak modul lain.

Penamaan resmi fitur:

- `Nama fitur sidebar`: `Ads Monitoring`
- `Workspace resmi`:
  - `Ringkasan`
  - `Integrasi Iklan`
  - `Matriks Advertiser`
  - `Matriks CS`
  - `Diagnostik`
  - `OpenClaw`
  - `Simulasi Aksi`

---

## 1. Prinsip Utama

Pondasi fitur ini harus mengikuti 4 prinsip:

1. `Read-first, not rewrite-first`
   Fitur ini pertama-tama membaca dan menyusun data dari sumber yang sudah ada. Bukan langsung mengubah struktur data inti aplikasi.

2. `Namespaced, not shared-mess`
   Semua cache, state, service, dan dokumen internal fitur ini harus punya namespace sendiri.

3. `Derived model, not core model mutation`
   Kita bangun `read model` dan `decision model` khusus Ads Monitoring, bukan mencampur business logic baru ke seluruh tabel inti.

4. `Feature isolation`
   Jika fitur ini gagal, modul lain seperti `Prospek`, `Pesanan`, `Iklan Harian`, dan `Master Data` tetap harus aman.

---

## 2. Yang Tidak Akan Kita Ganggu

Pondasi ini sengaja `tidak` mengubah perilaku inti fitur lain di tahap awal.

### 2.1 Tabel Inti yang Tetap Jadi Source of Truth

- `orders`
- `daily_ads`
- `leads`
- `ad_accounts`
- `ad_platforms`
- `ad_sub_channels`
- `profiles`
- `advertiserConfigs`

### 2.2 Fitur yang Tidak Boleh Terganggu

- `Prospek`
- `Pesanan`
- `Iklan Harian`
- `Master Data`
- `Template WhatsApp`
- `Dashboard per role`

### 2.3 Larangan P0

Di tahap pondasi, kita `tidak`:

- mengubah semantics tabel inti
- mengubah alur CRUD fitur lain
- mengganti source truth existing
- menulis balik keputusan OpenClaw ke tabel operasional utama
- memaksa modul lain mengikuti state baru Ads Monitoring

---

## 3. Pondasi yang Akan Dibuat

Berikut pondasi khusus fitur ini.

### 3.1 Feature Read Model

Kita akan membuat `read model` khusus Ads Monitoring.

Tujuannya:

- menyatukan data dari `orders`, `daily_ads`, `integrasi iklan`, `capacity`, dan metadata lain
- membentuk dataset yang cepat dibaca UI
- tidak mengubah source truth utama

Bentuk read model:

- `history snapshot lane`
- `today live cache lane`
- `merged derived dataset`

Output read model:

- KPI global
- performance rows per account
- advertiser leaderboard
- CS matrix
- capacity indicators
- attribution quality indicators

Ini adalah pondasi nomor satu.

### 3.2 Attribution Engine

Kita akan memisahkan engine atribusi order ke akun iklan menjadi domain sendiri.

Tanggung jawab:

- exact match
- primary CS match
- primary subchannel match
- historical set match
- proportional fallback
- manual fallback marker

Kenapa perlu dipisah:

- supaya logika ini tidak tercecer di table render
- supaya bisa dites
- supaya tidak merusak modul `Monitoring Perf.` atau `Integrasi Iklan`

### 3.3 Diagnostics Engine

Kita akan buat engine diagnosis yang hanya membaca derived data.

Tanggung jawab:

- menemukan anomaly
- mengklasifikasikan bottleneck
- menghitung risk score
- membuat evidence list

Jenis diagnosis:

- spend anomaly
- burn anomaly
- funnel drop
- CS lag
- branch overload
- attribution drift

Engine ini `read-only`.

### 3.4 Recommendation Engine

Ini fondasi untuk `OpenClaw`.

Tanggung jawab:

- membaca output diagnostics
- menyusun recommendation object
- memberi confidence
- memberi risk
- memberi expected impact

Output recommendation:

- `type`
- `priority`
- `reason`
- `evidence`
- `confidence`
- `risk`
- `approvalRequired`
- `rollbackPlan`

Masih `read-first`.
Belum langsung mengeksekusi apa pun.

### 3.5 Action Sandbox

Sebelum ada auto-action, kita akan buat `sandbox` khusus Ads Monitoring.

Tugas:

- menampung proposed actions
- menampung approval state
- menampung rejected actions
- menampung action logs

Penting:

- action sandbox ini terpisah dari modul operasional utama
- jadi walau OpenClaw mulai “bertindak”, ia tetap lewat jalur terkontrol

### 3.6 Audit Layer

Kita butuh audit khusus Ads Monitoring.

Yang dicatat:

- recommendation dibuat kapan
- berdasarkan data apa
- siapa approve / reject
- aksi jalan atau tidak
- hasilnya apa

Audit ini tidak boleh menumpuk di log UI biasa.
Ia harus punya namespace sendiri.

### 3.7 Feature UI Shell

Kita akan bangun shell UI khusus fitur ini:

- header
- control bar
- KPI rail
- diagnostics rail
- table grid
- detail drawer
- OpenClaw strip

Shell ini hanya untuk Ads Monitoring.
Tidak boleh memaksa modul lain ikut strukturnya.

### 3.8 Feature State Layer

Kita butuh state khusus fitur:

- selected range
- selected platform
- selected advertiser
- selected BM / group
- selected row
- detail drawer open
- OpenClaw mode
- compare mode
- diagnostics filter

State ini harus hidup di scope fitur, bukan global seluruh app.

---

## 4. Bentuk Isolasi Teknis

### 4.1 Namespace Services

Service layer harus dipisah dengan nama khusus, misalnya:

```text
src/app/pages/ads-monitoring/
├── lib/
│   ├── adsMonitoring.read-model.ts
│   ├── adsMonitoring.attribution.ts
│   ├── adsMonitoring.diagnostics.ts
│   ├── adsMonitoring.recommendations.ts
│   └── adsMonitoring.constants.ts
```

### 4.2 Namespace Cache

Semua cache harus punya prefix sendiri.

Contoh:

- `ads_monitoring:history:*`
- `ads_monitoring:today:*`
- `ads_monitoring:diagnostics:*`
- `ads_monitoring:recommendations:*`

Jangan campur dengan cache fitur lain.

### 4.3 Namespace State

Kalau nanti memakai store:

- `adsMonitoring.store.ts`

Jangan menaruh state ini di `ui.store` global kecuali memang cross-feature.

### 4.4 Namespace Secrets / Config

Konfigurasi robot advertiser nanti dipisah, misalnya:

- `OPENCLAW_ENABLED`
- `OPENCLAW_MODE`
- `OPENCLAW_MAX_ACTION_LEVEL`
- `OPENCLAW_APPROVAL_REQUIRED`

Jangan campur dengan env operasional umum bila belum perlu.

---

## 5. Data Storage Strategy

### 5.1 P0

Belum perlu tabel baru besar.

P0 cukup:

- snapshot existing
- derived dataset in memory / cache
- diagnostics generated on demand

### 5.2 P1

Mulai layak punya storage fitur sendiri.

Tabel/collection yang aman ditambah:

- `ads_monitoring_snapshots`
- `ads_monitoring_diagnostics`
- `ads_monitoring_recommendations`
- `ads_monitoring_action_logs`

Prefix tabel khusus ini penting agar tidak mengganggu domain inti.

### 5.3 P2

Kalau OpenClaw mulai auto:

- `ads_monitoring_approval_queue`
- `ads_monitoring_experiments`
- `ads_monitoring_guardrail_events`

---

## 6. Boundary Konkrit

### 6.1 Read Boundary

Ads Monitoring boleh membaca:

- `orders`
- `daily_ads`
- `leads`
- `ad_accounts`
- `platforms`
- `subchannels`
- `users`
- `advertiserConfigs`
- snapshot integrasi iklan

### 6.2 Write Boundary P0

Ads Monitoring di P0 hanya boleh menulis ke:

- cache-nya sendiri
- local derived state
- docs/config khusus fitur

### 6.3 Write Boundary P1

Ads Monitoring boleh menulis ke:

- recommendation store sendiri
- audit log sendiri
- action sandbox sendiri

### 6.4 Write Boundary P2

Setelah guardrail matang, baru boleh:

- membuat action request untuk sistem lain
- bukan langsung mutate tabel inti tanpa approval

---

## 7. Pondasi UI yang Akan Dibuat

### 7.1 Header Foundation

Bukan hero besar, tapi operational header:

- title
- mode
- health
- last healthy data

### 7.2 Control Bar Foundation

Filter yang stabil dan reusable:

- date range
- platform
- advertiser
- business manager
- branch
- mode

### 7.3 KPI Foundation

Card system yang konsisten:

- KPI card
- smart card
- risk card
- recommendation card

### 7.4 Grid Foundation

Main table/grid:

- dense
- sortable
- filterable
- drill-down
- metadata aware

### 7.5 Drawer Foundation

Detail drawer per account / advertiser / anomaly.

---

## 8. Pondasi OpenClaw

Ini yang akan jadi inti robot advertiser.

### 8.1 Observe Layer

Hanya baca data.

### 8.2 Analyze Layer

Menghasilkan diagnosis dan insight.

### 8.3 Recommend Layer

Menghasilkan action plan.

### 8.4 Approve Layer

Menentukan apakah recommendation boleh jalan.

### 8.5 Execute Layer

Belum ke tabel inti dulu.
Eksekusi lewat sandbox dan integration adapters.

### 8.6 Audit Layer

Semua aksi dan hasil harus tercatat.

---

## 9. Fase Pembangunan Pondasi

### Fase 1

Bangun:

- read model
- attribution engine
- diagnostics engine
- UI shell

### Fase 2

Bangun:

- recommendation engine
- recommendation cards
- detail drawer
- audit log internal

### Fase 3

Bangun:

- sandbox action
- approval queue
- OpenClaw mode switching

### Fase 4

Bangun:

- auto actions dengan guardrails
- experiment layer
- rollback tracking

---

## 10. Jawaban Singkatnya

Pondasi yang akan kita buat khusus fitur ini adalah:

1. `read model khusus Ads Monitoring`
2. `engine atribusi khusus`
3. `engine diagnostics khusus`
4. `engine recommendation khusus OpenClaw`
5. `action sandbox`
6. `audit layer`
7. `UI shell dan state layer khusus fitur`
8. `namespace cache, config, dan storage sendiri`

Dengan begitu:

- fitur ini bisa tumbuh besar
- tidak mengacak-acak data inti modul lain
- tidak memaksa fitur lain ikut berubah
- dan OpenClaw bisa lahir di atas pondasi yang aman
