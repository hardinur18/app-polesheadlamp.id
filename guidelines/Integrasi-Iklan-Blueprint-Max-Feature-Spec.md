# Integrasi Iklan Blueprint-Max Feature Spec

## Status

- `Tanggal`: 12 April 2026
- `Fitur`: `Integrasi Iklan`
- `Level`: `Tertinggi / Blueprint-Max`
- `Dokumen pasangan`:
  - [Integrasi-Iklan-Blueprint-P0.md](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/guidelines/Integrasi-Iklan-Blueprint-P0.md)
  - [Integrasi-Iklan-Blueprint-Advanced-Spec.md](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/guidelines/Integrasi-Iklan-Blueprint-Advanced-Spec.md)
- `Acuan utama`: [BLUEPRINT.md](/Users/macbookair/Windsurf/LKPP-repo/LKPP%20FE%20baru/web/BLUEPRINT.md)

Dokumen ini adalah spesifikasi fitur `Integrasi Iklan` pada level paling tinggi, khusus untuk:

- arsitektur fitur
- framework support yang diperlukan
- struktur folder target
- komponen dan tanggung jawab
- query/cache/state contract
- data pipeline
- performance and UX contract
- testing, observability, and rollout

Dokumen ini memisahkan dengan jelas:

- `apa yang bisa dikerjakan sekarang` di repo `Vite + React 18`
- `apa yang menjadi target penuh` jika nanti mengikuti blueprint `Next.js 16 + React 19`

---

## 1. Mission

`Integrasi Iklan` harus menjadi `command center` untuk lane `Meta + Google`, dengan fungsi:

1. membaca spend live
2. membaca burn internal
3. membaca order terbaca per akun
4. menampilkan breakdown per account / advertiser / business group
5. menjaga konsistensi angka dengan `Monitoring Perf.`
6. menjadi basis untuk drill-down, export, dan auto diagnostics

Fitur ini bukan sekadar tabel.
Fitur ini harus terasa seperti `workspace operasional modern`.

---

## 2. Non-Negotiable Principles

1. `Data-first`
   UI mengikuti data. Bukan sebaliknya.

2. `Filter-first`
   Filter adalah alat kerja utama, bukan elemen tambahan.

3. `Table-first`
   Table adalah pusat fitur. Semua elemen lain mendukung table.

4. `Snapshot-first for history`
   Semua histori harus cepat dan stabil, tidak bergantung ke live API.

5. `Server-cached live for today`
   Hari ini tetap live, tapi tidak boleh raw API setiap render.

6. `Reference is secondary`
   Glosarium, aturan hitung, dan copy penjelasan tidak boleh mengganggu ritme kerja.

7. `Single source of truth`
   Istilah, label, mapping rule, dan cache policy tidak boleh tersebar liar.

---

## 3. Framework Support Matrix

### 3.1 Real Stack Saat Ini

- `Vite`: `6.3.5`
- `React`: `18.3.1`
- `React Router`: `7.13.0`
- `Tailwind CSS`: `4.1.12`
- `Supabase JS`: `2.91.0`

### 3.2 Minimum Support untuk P0

Tidak wajib install framework baru untuk merapikan fitur ini.

Yang cukup untuk P0:

- `React 18`
- `Tailwind CSS v4`
- `Radix UI`
- existing service layer
- existing server cache/snapshot sync

### 3.3 Strongly Recommended Support untuk P1

Kalau mau fitur ini naik kelas tanpa migrasi penuh ke Next.js, framework support yang paling berguna:

1. `@tanstack/react-query` `^5.80.0`
   - query key per filter
   - stale/fresh control
   - prefetch preset waktu
   - background refetch hanya untuk `today`
   - devtools untuk debugging cache

2. `@tanstack/react-table` `v8 latest stable`
   - sorting
   - column definitions
   - row models
   - pinning
   - visibility
   - future-ready for export state

3. `@tanstack/react-virtual` `v3 latest stable`
   - opsional
   - dipasang jika row > `200` per filter aktif

4. `zustand` `^5.0.0`
   - untuk state lintas section:
     - selected row
     - table density
     - glossary open/closed
     - detail drawer
     - column visibility

### 3.4 Full Blueprint-Max Support

Kalau repo nanti dimigrasikan penuh ke blueprint:

- `Next.js`: `16.2.3`
- `React`: `19.2.4`
- `TanStack Query`: `^5.80.0`
- `Zustand`: `^5.0.0`
- `RSC`
- `PPR`
- `Suspense streaming`
- `API/BFF route`
- `Storybook coverage`
- `Playwright E2E`

### 3.5 Keputusan Praktis

Untuk `Integrasi Iklan`, support framework dibagi begini:

- `Wajib sekarang`: tidak ada install tambahan
- `Sangat dianjurkan sesudah P0`: `TanStack Query + TanStack Table + Zustand`
- `Migrasi besar`: `Next.js 16 + React 19`

---

## 4. Feature Architecture

### 4.1 Current-Compatible Target

Struktur target di repo sekarang:

```text
src/app/pages/ads/
├── UnifiedAdsMonitoringPage.tsx           # route/page orchestrator
├── integrasiIklanContent.ts               # content registry
├── integrasiIklanTypes.ts                 # shared feature types
├── hooks/
│   ├── useIntegrasiIklanFilters.ts        # filter state orchestration
│   ├── useIntegrasiIklanDataset.ts        # merged dataset query
│   └── useIntegrasiIklanTable.ts          # table transforms and sort
├── lib/
│   ├── integrasiIklan.mapper.ts           # raw -> row view model
│   ├── integrasiIklan.attribution.ts      # order attribution rules
│   ├── integrasiIklan.summary.ts          # summary reducers
│   └── integrasiIklan.constants.ts        # TTL, widths, densities, defaults
└── components/
    ├── IntegrasiIklanHeader.tsx
    ├── IntegrasiIklanFilters.tsx
    ├── IntegrasiIklanSummaryCards.tsx
    ├── IntegrasiIklanTable.tsx
    ├── IntegrasiIklanGlossary.tsx
    ├── IntegrasiIklanEmptyState.tsx
    ├── IntegrasiIklanErrorBanner.tsx
    └── IntegrasiIklanDetailDrawer.tsx
```

### 4.2 Blueprint-Max Target

Kalau nanti full blueprint:

```text
apps/web/src/
├── app/(app)/ads/integrasi-iklan/page.tsx
├── features/ads-integrations/
│   ├── components/
│   ├── actions/
│   ├── hooks/
│   ├── schemas/
│   ├── lib/
│   └── content/
└── components/composite/data-table.tsx
```

---

## 5. Component Inventory

### 5.1 `IntegrasiIklanHeader`

Tugas:

- render title
- render one-line description
- render 2-4 badges kecil
- render source mode singkat

Tidak boleh:

- menampilkan glossary panjang
- menampilkan legend panjang
- memuat data sendiri

### 5.2 `IntegrasiIklanFilters`

Tugas:

- render date range
- platform select
- business group select
- advertiser select
- ad account select
- render applying state

Harus:

- responsif
- semua trigger tinggi konsisten
- full-width di setiap sel

### 5.3 `IntegrasiIklanSummaryCards`

Tugas:

- render summary utama
- render hint per metric
- tampil cepat dari cache dataset

### 5.4 `IntegrasiIklanTable`

Tugas:

- render core dataset
- align angka
- render labels `order/order*/manual`
- sticky header
- empty state

### 5.5 `IntegrasiIklanGlossary`

Tugas:

- secondary knowledge layer
- collapsed by default
- tidak mengganggu primary flow

### 5.6 `IntegrasiIklanDetailDrawer`

P1 target:

- daily trend per akun
- data source state
- order attribution diagnostics
- recent sync metadata

---

## 6. Query and Cache Contract

### 6.1 Data Lanes

Fitur ini selalu punya dua lane:

1. `history lane`
   - source: snapshot DB
   - window: `90 hari`
   - refresh: background, `maks 2x/hari`

2. `today lane`
   - source: live cache server
   - refresh interval: `5 menit`
   - minimum fresh: `10 menit`
   - stale warning threshold: `15 menit`

### 6.2 Merge Contract

Semua range filter dibentuk dari:

```text
merged range result =
  historical snapshot rows
  + today cached rows (jika range mencakup hari ini)
```

### 6.3 Query Keys

Jika nanti memakai TanStack Query, gunakan pola:

```text
["ads-integrations", "history", from, to]
["ads-integrations", "today", todayKey]
["ads-integrations", "merged", from, to, platformId, groupId, advertiserId, adAccountId]
["ads-integrations", "registry"]
```

### 6.4 Cache Durations

- `registry`: `6 jam`
- `history`: `12 jam`
- `today`: `5 menit`
- `merged`: derive in-memory dari history + today

### 6.5 Prefetch Rules

Preset yang harus diprewarm:

- `Hari Ini`
- `Kemarin`
- `Bulan Ini`
- `1 Bulan Terakhir`
- `3 Bulan Terakhir`

---

## 7. State Architecture

### 7.1 P0 Local State

State yang cukup di page orchestrator:

- date range
- selected platform
- selected group
- selected advertiser
- selected ad account

### 7.2 P1 Global Feature State

Jika Zustand dipasang, buat slice:

```text
adsIntegrations.store.ts
```

State yang layak dipindah:

- selected row id
- detail drawer open
- glossary open
- table density
- visible columns
- compare mode

---

## 8. Data Model Contract

### 8.1 Core Summary

P0 wajib:

- `spend`
- `burn`
- `leads`
- `clicks`
- `accountCount`
- `advertiserCount`
- `cpl`

### 8.2 Row Model

Setiap row minimal punya:

- `platformId`
- `platformName`
- `businessGroupId`
- `businessGroupName`
- `adAccountId`
- `accountName`
- `advertiserId`
- `advertiserName`
- `spend`
- `ppn`
- `fee`
- `burn`
- `leads`
- `clicks`
- `ctr`
- `cpl`
- `leadSource`
- `leadInputStatus`
- `lastLeadInputDate`
- `lastOrderFallbackDate`

### 8.3 Metadata Model

Dataset merged harus punya:

- `generatedAt`
- `historyLastSyncedAt`
- `todayLastSyncedAt`
- `servedFrom`
- `staleState`
- `errors`

---

## 9. Attribution Engine Contract

### 9.1 Priority

Urutan mapping order:

1. explicit account match
2. advertiser + platform + primary CS
3. advertiser + platform + primary subchannel
4. advertiser + platform + historical CS set
5. advertiser + platform + historical subchannel set
6. proportional allocation in same advertiser/platform
7. fallback manual dashboard

### 9.2 Output Labels

- `order`
- `order*`
- `manual`
- `none`

### 9.3 Rule for Google

Semua subchannel Google dianggap satu lane operasional.
Jika exact attribution belum ada, gunakan proportional share di grup advertiser/platform Google yang sama.

---

## 10. Visual Hierarchy Contract

### 10.1 First Fold

Yang harus tampak dulu:

1. header
2. filter
3. summary
4. top table rows

### 10.2 Second Fold

- lanjutan table
- glossary collapsed
- optional diagnostics card

### 10.3 Visual Weight

Urutan visual weight:

1. table
2. summary
3. filter
4. header
5. glossary

---

## 11. Interaction Contract

### 11.1 Motion

Mengikuti blueprint:

- micro: `160ms`
- smooth: `320ms`

### 11.2 Filter Behavior

- trigger update visual langsung
- gunakan cached data jika tersedia
- jangan blanking table saat fetch
- tampilkan stale data sambil refresh silently

### 11.3 Error Behavior

- histori tidak boleh blank jika live gagal
- rate limit Google tidak boleh muncul sebagai pesan mentah
- stale fallback diberi status ringan

---

## 12. Table Contract

### 12.1 P0

- sticky header
- right-align numeric
- row meta label di bawah angka
- min width `1120px`
- loading skeleton
- empty state

### 12.2 P1

- sort per column
- column hide/show
- sticky first columns
- density mode
- CSV export sesuai filter

### 12.3 P2

- virtualized rows
- grouped rows by business manager
- pinned summary footer

---

## 13. Testing Contract

### 13.1 P0

Minimal test yang wajib ada:

1. `history only range` tidak trigger live merge berlebih
2. `today range` merge history + live
3. `Google rate limit` fallback ke snapshot
4. `order attribution` konsisten dengan `Monitoring Perf.` per hari platform
5. `CPL` hanya tampil jika denominator > 0

### 13.2 P1

Tambah:

- filter interaction tests
- table sorting tests
- visual snapshot tests

### 13.3 Recommended Tools

- sekarang:
  - `Vitest`
  - `Testing Library`
- nanti:
  - `Playwright`
  - `Chromatic`

---

## 14. Observability Contract

### 14.1 Metrics

Catat minimal:

- page load duration
- filter apply duration
- history cache hit
- today cache hit
- stale fallback count
- Google rate limit events

### 14.2 Logs

Log jika:

- live refresh > `2 detik`
- stale state > `15 menit`
- attribution unresolved naik tajam
- history fetch gagal

### 14.3 UI Diagnostics

P1:

- source badge kecil
- stale badge kecil
- diagnostics drawer per akun

---

## 15. Framework Adoption Plan

### 15.1 P0

Tanpa install tambahan:

- rapikan layout
- stabilkan merge history + today
- perbaiki table-first hierarchy

### 15.2 P1

Install:

- `@tanstack/react-query`
- `@tanstack/react-table`
- `zustand`

Tujuan:

- cache yang lebih disiplin
- table behavior modern
- state feature yang lebih bersih

### 15.3 P2

Opsional install:

- `@tanstack/react-virtual`

Tujuan:

- performa table saat data sangat besar

### 15.4 P3

Migrasi besar:

- `Next.js 16`
- `React 19`
- RSC/PPR
- server-first feature routing

---

## 16. Acceptance Criteria Blueprint-Max

Fitur dianggap mendekati `blueprint-max` jika:

1. hierarchy page jelas dan data-first
2. histori instan
3. today live tetap cepat tapi aman dari API spam
4. table menjadi pusat fitur
5. glossary sekunder
6. mapping order stabil terhadap `Monitoring Perf.`
7. framework support jelas per fase
8. komponen punya ownership yang rapi
9. metrics dan stale state bisa ditelusuri
10. fitur siap diangkat ke Next.js tanpa rewrite konsep dari nol

