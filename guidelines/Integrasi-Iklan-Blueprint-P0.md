# Integrasi Iklan Blueprint P0

## Status

- `Tanggal`: 12 April 2026
- `Fitur`: `Integrasi Iklan`
- `Acuan standar`: [BLUEPRINT.md](/Users/macbookair/Windsurf/LKPP-repo/LKPP%20FE%20baru/web/BLUEPRINT.md)
- `Kondisi repo saat ini`: `Vite 6.3.5 + React 18.3.1 + React Router 7.13.0 + Tailwind 4.1.12`
- `Catatan penting`: repo ini `belum` full Next.js / RSC / App Router seperti blueprint. Dokumen ini dipakai sebagai `target implementasi fitur`, bukan klaim bahwa repo sudah setara blueprint penuh.

---

## 1. Target Produk

`Integrasi Iklan` harus menjadi `analytics workspace` untuk lane `Meta + Google`, bukan halaman dekoratif.

Urutan prioritas visual:

1. `Section header` ringkas
2. `Filter bar` sebagai alat kerja utama
3. `Summary rail`
4. `Primary data table`
5. `Drill-down / detail akun`
6. `Glossary / aturan hitung` sebagai referensi sekunder

Yang tidak boleh dominan:

- hero tinggi kosong
- copy panjang di atas fold
- glosarium penuh terbuka sebelum user melihat data

---

## 2. Standar Teknis yang Dipakai

### 2.1 Real Stack Sekarang

- `Vite`: `6.3.5`
- `React`: `18.3.1`
- `React Router`: `7.13.0`
- `Tailwind CSS`: `4.1.12`
- `Supabase JS`: `2.91.0`

### 2.2 Target Blueprint-Max

- `Next.js`: `16.2.3`
- `React`: `19.2.4`
- `TanStack Query`: `^5.80.0`
- `Zustand`: `^5.0.0`
- `Rendering`: `RSC + PPR + Suspense streaming`

### 2.3 Keputusan untuk Fitur Ini

Karena repo sekarang masih `Vite SPA`, maka P0 fitur ini memakai:

- `feature-first architecture`
- `client rendering`
- `server-backed cache + snapshot`
- `section-based UI composition`
- `strict content registry`

Target blueprint yang bisa langsung diadopsi sekarang:

- `filter -> summary -> table` hierarchy
- `server-first data contract`
- `glossary/content registry`
- `primitive/composite discipline`
- `table-first workspace`

Yang belum dikejar di P0:

- migrasi full ke Next.js
- RSC
- Server Actions
- monorepo package split

---

## 3. P0 Performance Budget

### 3.1 Data Strategy

- `Today`: `live cache server`
- `Yesterday backward`: `snapshot database`
- `History window`: `90 hari`
- `Today refresh interval`: `5 menit`
- `Today min fresh`: `10 menit`
- `Historical snapshot refresh`: `maks 2x per hari`
- `Finalisasi D-1`: `maks 00:15 WIB`

### 3.2 UX Budget

- buka halaman sampai filter siap dipakai: `<= 1.2 detik`
- ganti preset yang sudah ada cache: `<= 150 ms`
- ganti preset yang mencakup hari ini: UI respons awal `<= 150 ms`
- merge data lengkap untuk range yang mencakup hari ini: `<= 800 ms`
- buka dropdown filter: `<= 100 ms`
- sort/filter tabel lokal: `<= 120 ms`
- open glossary accordion: `<= 160 ms`

### 3.3 Error Budget

- stale live today masih boleh dipakai jika umur data `<= 15 menit`
- kalau Google rate limited:
  - pakai snapshot terakhir
  - tampilkan pesan halus, bukan raw error
- histori tidak boleh gagal hanya karena live API bermasalah

---

## 4. Layout Standard

### 4.1 Fold Pertama

Yang harus tampil di fold pertama desktop:

1. `Section Header`
2. `Filter Bar`
3. `4 Summary Cards`
4. awal `Primary Table`

Yang tidak boleh memakan fold pertama:

- glossary penuh
- legend panjang
- panel penjelasan besar

### 4.2 Dimensi yang Disarankan

- `Section header` tinggi efektif: `96–140 px`
- `Filter bar`: `1 surface`, tinggi efektif `96–132 px`
- `Summary cards`: `4 kartu`
- `Row table`: `56–64 px`
- `Table min width`: `1120 px`
- `Sticky table header`: `wajib`

### 4.3 Motion

Mengikuti token dari blueprint:

- `micro interaction`: `160 ms cubic-bezier(0.2, 0.8, 0.2, 1)`
- `panel / accordion`: `320 ms cubic-bezier(0.2, 0.8, 0.2, 1)`

### 4.4 Z-Index

Mengikuti blueprint:

- `header sticky page`: `40`
- `popover / date picker`: `50`
- `sheet / detail drawer`: `50`
- `dialog`: `60`
- `tooltip`: `80`

---

## 5. Data Contract Standard

### 5.1 Summary Wajib

Minimal summary:

- `Total Spend`
- `Total Burn`
- `Order Terbaca`
- `Clicks`

Opsional P1:

- `CTR Global`
- `CPL Global`
- `Account Count`
- `Advertiser Count`

### 5.2 Table Columns Wajib

Urutan minimum:

1. `Platform`
2. `Business Manager / Grup`
3. `Akun`
4. `Advertiser`
5. `Spend`
6. `Burn`
7. `Order`
8. `Clicks`
9. `CTR`
10. `CPL`

### 5.3 Format Angka

- `Currency`: `IDR`, tanpa desimal
- `Number`: separator ribuan `id-ID`
- `Percent`: `0–2 decimal`
- `CPL`: tampil hanya jika denominator > 0

### 5.4 Source Truth

Source truth fitur:

- `live media metrics`: Meta / Google live cache
- `historical media metrics`: snapshot DB
- `order`: `orders.created_at`
- `manual fallback`: `daily_ads.leads_dashboard`
- `terminology`: `integrasiIklanContent.ts`

---

## 6. Attribution Rules

### 6.1 Prioritas Mapping Order

1. `advertiser + platform + akun exact`
2. `primary CS`
3. `primary subchannel`
4. `historical CS/subchannel set match`
5. `proportional share dalam advertiser/platform yang sama`
6. jika tetap tidak aman: fallback `manual dashboard`

### 6.2 Label yang Wajib Konsisten

- `order` = exact
- `order*` = proportional share
- `manual` = fallback ke dashboard manual

### 6.3 Aturan Google

- semua `subchannel Google` dianggap satu lane operasional
- kalau order belum exact ke akun Google tertentu, boleh dibagi proporsional dalam grup Google advertiser yang sama

---

## 7. File Ownership P0

### 7.1 Page Orchestrator

- [UnifiedAdsMonitoringPage.tsx](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/src/app/pages/ads/UnifiedAdsMonitoringPage.tsx)

Tanggung jawab:

- orchestration query/data
- merge `today live cache + historical snapshot`
- filter state
- summary derivation
- row assembly

Tidak boleh:

- copy hard-coded bertebaran
- primitive UI baru di file ini

### 7.2 Content Registry

- [integrasiIklanContent.ts](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/src/app/pages/ads/integrasiIklanContent.ts)

Tanggung jawab:

- copy
- label
- glossary
- help text
- column descriptions

### 7.3 Presentational Sections

- [IntegrasiIklanHero.tsx](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/src/app/pages/ads/components/IntegrasiIklanHero.tsx)
- [IntegrasiIklanFilters.tsx](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/src/app/pages/ads/components/IntegrasiIklanFilters.tsx)
- [IntegrasiIklanSummaryCards.tsx](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/src/app/pages/ads/components/IntegrasiIklanSummaryCards.tsx)
- [IntegrasiIklanTable.tsx](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/src/app/pages/ads/components/IntegrasiIklanTable.tsx)
- [IntegrasiIklanGlossary.tsx](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/src/app/pages/ads/components/IntegrasiIklanGlossary.tsx)

Tanggung jawab:

- menerima props siap pakai
- tidak melakukan fetch sendiri
- tidak menyimpan business logic atribusi

### 7.4 Services

- [liveAdsService.ts](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/src/app/services/liveAdsService.ts)
- [googleAdsLiveService.ts](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/src/app/services/googleAdsLiveService.ts)

Tanggung jawab:

- fetch/sync snapshot
- live cache rules
- cooldown / stale fallback

---

## 8. P0 Checklist

### P0-A — Hierarchy

- hero diperkecil jadi `section header`
- filter bar jadi fokus utama
- summary rail tepat di bawah filter
- table jadi pusat perhatian
- glossary dipindah ke bawah dan `collapsed by default`

### P0-B — Data

- `today = cached live`
- `yesterday backward = snapshot DB`
- `90 hari histori`
- range filter merge dua sumber
- histori tidak trigger live refresh

### P0-C — Table

- sticky header
- row spacing stabil
- tooltip untuk metric penting
- label `order / order* / manual` konsisten
- empty/loading/error state rapi

### P0-D — Performance

- prewarm preset umum:
  - `Hari Ini`
  - `Kemarin`
  - `Bulan Ini`
  - `1 Bulan Terakhir`
  - `3 Bulan Terakhir`
- no raw API hit on every render
- no full-range sync for historical presets

---

## 9. P1 Setelah P0 Stabil

- detail drawer per akun iklan
- breakdown harian per akun
- sticky first columns
- sort per kolom
- density switch
- source badge per row
- exported report matching current filter

---

## 10. P2 Blueprint-Max

Jika nanti repo ini dimigrasikan penuh mengikuti blueprint:

- pindah ke `Next.js 16.2.3`
- `React 19.2.4`
- `TanStack Query`
- `Zustand`
- `RSC + Suspense`
- `data-table composite reusable`
- `feature folder khusus ads-integrations`
- `server instrumentation + perf telemetry`

---

## 11. Acceptance Criteria

Fitur `Integrasi Iklan` dianggap lolos P0 jika:

1. layout terasa seperti `workspace`, bukan halaman informasi
2. filter adalah alat kerja utama
3. summary dan table tampil di fold pertama desktop
4. glosarium tidak lagi mendominasi layar
5. preset histori terasa instan
6. preset yang mencakup hari ini tetap cepat dan tidak hammer API
7. order Meta + Google tidak selisih terhadap `Monitoring Perf.` pada level harian platform
8. error live tidak merusak histori
9. semua istilah inti konsisten dengan content registry

