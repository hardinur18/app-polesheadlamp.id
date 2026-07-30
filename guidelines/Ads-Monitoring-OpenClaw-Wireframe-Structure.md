# Ads Monitoring OpenClaw Wireframe Structure

## Status

- `Tanggal`: 12 April 2026
- `Fitur`: `Ads Monitoring + OpenClaw`
- `Acuan`: [Ads-Monitoring-OpenClaw-Blueprint-Max.md](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/guidelines/Ads-Monitoring-OpenClaw-Blueprint-Max.md)
- `Current page`: [MarketingMonitoringPage.tsx](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/src/app/pages/ads/MarketingMonitoringPage.tsx)

Dokumen ini adalah `struktur layar` untuk versi paling tinggi dari `Ads Monitoring`, agar desain, UX, dan implementasi punya bentuk yang jelas sebelum masuk coding besar.

---

## 1. Screen Philosophy

Urutan perhatian user harus selalu:

1. `apa kondisi bisnis hari ini`
2. `apa masalah utamanya`
3. `apa rekomendasi OpenClaw`
4. `akun / advertiser / CS mana yang harus dibuka`
5. `aksi apa yang bisa dilakukan`

Jadi layar tidak boleh dimulai dari tabel langsung atau glosarium. Harus dimulai dari `state of the system`.

---

## 2. Desktop Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header: Ads Monitoring + OpenClaw                                           │
│ subtitle · mode badge · range badge · last healthy update                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Global Control Bar                                                          │
│ Date Range | Platform | Branch | Advertiser | BM/Group | Mode | Compare     │
├──────────────────────────────────────────────────────────────────────────────┤
│ KPI Row 1                                                                   │
│ Spend | Burn | Order | Closing | Omzet | ROAS                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ KPI Row 2                                                                   │
│ CPL | CPR | Closing Rate | Attribution Quality | Capacity Health | AI Ready  │
├──────────────────────────────────────────────────────────────────────────────┤
│ OpenClaw Action Strip                                                       │
│ top recommendation | confidence | risk | action count | approval pending     │
├───────────────────────────────┬──────────────────────────────────────────────┤
│ Diagnostics Rail              │ Trend Workspace                              │
│ anomaly cards                 │ spend vs order trend                         │
│ bottleneck cards              │ funnel trend                                 │
│ risk cards                    │ capacity trend                               │
├───────────────────────────────┴──────────────────────────────────────────────┤
│ Matrix Row                                                                 │
│ Advertiser x CS Matrix | Platform x Funnel Matrix | Branch x Capacity       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Main Performance Grid                                                       │
│ account performance table + sort + pin + density + source state             │
├──────────────────────────────────────────────────────────────────────────────┤
│ Detail Drawer / Bottom Panel                                                │
│ account detail | diagnostics | recommendation | action log                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Glossary / Methodology / Audit / Experiment notes                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mobile Wireframe

```text
┌──────────────────────────────────────┐
│ Header                               │
│ title · mode · health badge          │
├──────────────────────────────────────┤
│ Control Bar                          │
│ date                                 │
│ platform                             │
│ advertiser                           │
│ more filters                         │
├──────────────────────────────────────┤
│ KPI Carousel / 2-column cards        │
├──────────────────────────────────────┤
│ OpenClaw Strip                       │
├──────────────────────────────────────┤
│ Charts tabs                          │
│ Overview | Funnel | Risk             │
├──────────────────────────────────────┤
│ Table card list / horizontal grid    │
├──────────────────────────────────────┤
│ Detail sheet                         │
└──────────────────────────────────────┘
```

Mobile rule:

- jangan paksa semua matrix tampil sekaligus
- matrix pindah ke tab atau sheet
- detail akun jadi sheet, bukan inline expansion

---

## 4. First Fold Contract

### 4.1 First Fold Desktop

Yang wajib langsung terlihat:

1. `Header`
2. `Global Control Bar`
3. `12 KPI cards maksimal dalam 2 baris`
4. `OpenClaw Action Strip`
5. awal `trend workspace`

### 4.2 First Fold Mobile

Yang wajib langsung terlihat:

1. title
2. health/status ringkas
3. date range
4. KPI utama
5. OpenClaw recommendation teratas

---

## 5. Section Detail

### 5.1 Header

Isi:

- `Ads Monitoring`
- subtitle singkat
- `OpenClaw Mode`
- `Data Health`
- `Last healthy sync`

Tidak boleh:

- paragraph panjang
- legend panjang
- glosarium di header

### 5.2 Global Control Bar

Field:

- date range
- platform
- advertiser
- business manager / group
- branch
- OpenClaw mode
- compare toggle

Action kanan:

- refresh diagnostics
- export
- open methodology

### 5.3 KPI Rows

#### KPI Row 1

- `Total Spend`
- `Total Burn`
- `Total Order`
- `Total Closing`
- `Total Omzet`
- `ROAS Operasional`

#### KPI Row 2

- `CPL`
- `CPR`
- `Closing Rate`
- `Attribution Quality`
- `Capacity Health`
- `OpenClaw Readiness`

Setiap card:

- label
- angka utama
- delta vs previous period
- subcontext 1 line
- optional sparkline

### 5.4 OpenClaw Action Strip

Isi minimum:

- recommendation utama
- confidence
- urgency
- risk
- action type
- approval state
- CTA `lihat detail`

Contoh:

- `Pause Arifin 56`
- `Confidence 82%`
- `Risk rendah`
- `Expected CPL turun 11%`

### 5.5 Diagnostics Rail

Bentuk:

- stack vertical cards

Jenis card:

- `Budget Waste Risk`
- `CS Bottleneck`
- `Capacity Overload`
- `Attribution Drift`
- `Creative Fatigue`
- `Underfunded Winner`

Setiap card:

- title
- status severity
- one-line diagnosis
- CTA `lihat bukti`

### 5.6 Trend Workspace

Default charts:

1. `Spend vs Order`
2. `Funnel Trend`
3. `Capacity Pressure`

Control:

- daily / weekly
- current vs previous
- all vs selected advertiser

### 5.7 Matrices

#### Advertiser x CS Matrix

Cell content:

- order
- closing
- close rate color

#### Platform x Funnel Matrix

Cell content:

- clicks
- leads
- order
- closing
- CPR

#### Branch x Capacity Matrix

Cell content:

- active orders
- occupied tech slots
- overload badge

### 5.8 Main Performance Grid

Grid utama harus jadi pusat analisa account.

Columns:

1. Platform
2. BM / Group
3. Account
4. Advertiser
5. Spend
6. Burn
7. Clicks
8. CTR
9. CPC
10. Leads
11. Order
12. CPL
13. CPR
14. Closing Rate
15. Omzet
16. ROAS
17. Source State
18. OpenClaw State

Toolbar di atas grid:

- search
- density
- column visibility
- sort preset
- anomaly only
- stale only

### 5.9 Detail Drawer

Tab dalam drawer:

1. `Overview`
2. `Trend`
3. `Funnel`
4. `Attribution`
5. `CS / Ops`
6. `OpenClaw`
7. `Audit`

Isi tab `OpenClaw`:

- diagnosis
- evidence
- confidence
- expected impact
- action options
- approval requirement

---

## 6. Data Health Layer

Harus selalu ada health strip kecil di dekat atas:

- `History Snapshot`: healthy / stale
- `Today Live Cache`: healthy / stale / rate-limited
- `Attribution Engine`: healthy / drift
- `Capacity Feed`: healthy / lagging

Jika salah satu gagal:

- user tetap bisa kerja
- panel tetap tampil
- health chip menunjukkan masalah

---

## 7. OpenClaw Mode UX

### 7.1 Mode Selector

Mode:

- `Observe`
- `Assist`
- `Semi Auto`
- `Full Auto`

### 7.2 Mode Placement

Mode selector harus ada:

- di header kecil
- di OpenClaw strip
- di detail drawer akun

### 7.3 Mode Response

Jika mode berubah:

- semua recommendation card update
- action buttons berubah
- risk explanation muncul

---

## 8. Analyst Tabs

Di level tertinggi, halaman ini bisa punya tab internal:

1. `Overview`
2. `Accounts`
3. `Advertisers`
4. `CS Matrix`
5. `Capacity`
6. `Diagnostics`
7. `OpenClaw`
8. `Audit`

Tab default:

- `Overview`

Tab untuk owner:

- semua

Tab untuk advertiser:

- `Overview`
- `Accounts`
- `Diagnostics`
- `OpenClaw`

---

## 9. Navigation Depth

User flow ideal:

1. buka overview
2. lihat masalah terbesar
3. klik card diagnosis
4. masuk filtered table
5. buka detail drawer account
6. review OpenClaw action
7. approve / hold / reject

Jadi semua elemen harus saling nyambung, bukan berdiri sendiri.

---

## 10. Priority Rendering

Urutan render yang harus diprioritaskan:

1. header
2. controls
3. KPI cards
4. OpenClaw strip
5. main trend
6. table
7. matrices
8. glossary/methodology

Kalau loading:

- KPI cards tampil dulu
- table skeleton kedua
- matrix dan glossary belakangan

---

## 11. Empty and Failure Wireframes

### 11.1 No Data

Jika tidak ada data:

- tetap tampil header
- tetap tampil filters
- KPI card jadi 0
- tampil empty state di table
- diagnostics rail kasih penjelasan singkat

### 11.2 Live Failure

Jika live API gagal:

- tampil data snapshot
- health chip `stale`
- OpenClaw strip disable eksekusi berat

### 11.3 Attribution Failure

Jika attribution buruk:

- tampil warning badge
- matrix `Account x Attribution Quality` naik ke atas
- recommendation berfokus ke perbaikan data, bukan scaling

---

## 12. Final Shape

Versi akhir `Ads Monitoring + OpenClaw` harus terasa seperti:

- `Bloomberg terminal` untuk marketing operasional
- tapi dengan bahasa bisnis lokal Polesheadlamp
- dan dengan guardrail yang kuat untuk robot advertiser

Fitur ini pada akhirnya harus memadukan:

- analytics
- diagnostics
- recommendations
- action orchestration
- audit trail

