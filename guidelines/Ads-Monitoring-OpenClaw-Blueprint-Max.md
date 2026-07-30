# Ads Monitoring OpenClaw Blueprint-Max

## Status

- `Tanggal`: 12 April 2026
- `Fitur`: `Ads Monitoring`
- `Mode masa depan`: `OpenClaw = robot advertiser`
- `Acuan`: [BLUEPRINT.md](/Users/macbookair/Windsurf/LKPP-repo/LKPP%20FE%20baru/web/BLUEPRINT.md)
- `Repo saat ini`: `Vite + React 18`

Dokumen ini mendefinisikan bentuk paling tinggi dari fitur `Ads Monitoring` saat sistem tidak hanya menampilkan dashboard, tetapi juga memiliki `OpenClaw` sebagai mesin analisis dan eksekusi advertiser.

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

## 1. Mission

`Ads Monitoring` bukan hanya halaman monitoring.
Fitur ini adalah `operating system` untuk akuisisi lead.

Target akhirnya:

1. membaca spend, lead, order, omzet, margin, dan closing rate lintas platform
2. menemukan masalah secara otomatis
3. memberi diagnosis yang bisa dibaca manusia
4. memberi rekomendasi aksi
5. mengeksekusi sebagian aksi secara otomatis melalui `OpenClaw`
6. menyimpan jejak keputusan agar bisa diaudit

Singkatnya:

- `Monitoring Perf.` = papan hasil
- `Integrasi Iklan` = data engine per akun
- `Ads Monitoring + OpenClaw` = command center + robot advertiser

---

## 2. Role Produk

### 2.1 Human Roles

- `Owner`
- `Super Admin`
- `Advertiser`
- `CS`
- `Finance`

### 2.2 System Roles

- `OpenClaw Observer`
  - baca data
  - deteksi anomaly
  - tidak melakukan aksi

- `OpenClaw Analyst`
  - baca data
  - kasih diagnosis
  - kasih recommendation

- `OpenClaw Operator`
  - boleh mengeksekusi aksi aman
  - misal pause campaign tertentu, ubah budget cap, kirim alert, freeze lane

- `OpenClaw Strategist`
  - boleh melakukan eksperimen terkontrol
  - misal reallocation budget, goal switch, creative routing, throttle lane

### 2.3 Mode Kendali

- `Manual`
- `Assisted`
- `Semi Auto`
- `Full Auto (Guardrailed)`

Default production:

- `Owner`: bisa lihat semua mode
- `Advertiser`: default `Assisted`
- `OpenClaw`: default `Assisted` atau `Semi Auto`

---

## 3. Core Workspaces

Fitur `Ads Monitoring` tingkat tertinggi harus punya workspace berikut.

### 3.1 Ringkasan

Tujuan:

- memberi ringkasan global untuk owner/super admin

Isi:

- spend total
- burn total
- order total
- closing total
- omzet total
- gross margin estimate
- CPL
- CPR
- ROAS operasional
- target vs actual

### 3.2 Integrasi Iklan

Tujuan:

- membaca funnel penuh dari media ke revenue

Isi:

- clicks
- leads masuk
- order masuk
- order closing
- service selesai
- omzet
- profit proxy

### 3.3 Matriks Advertiser

Tujuan:

- tabel utama per account lintas Meta/Google

Isi:

- platform
- business manager / group
- ad account
- advertiser
- spend
- burn
- clicks
- CTR
- CPC
- leads
- order
- CPL
- CPR
- closing rate
- omzet
- ROAS
- status OpenClaw

### 3.4 Matriks CS

Tujuan:

- menjelaskan kenapa akun bagus/buruk

Isi:

- anomaly list
- delivery issue
- attribution issue
- gap antara lead dan order
- gap antara order dan closing
- lag CS
- lag teknisi
- lane overload
- budget waste

### 3.5 Diagnostik

Tujuan:

- workspace robot advertiser

Isi:

- mode auto/manual
- confidence score
- recommendation queue
- approved actions
- blocked actions
- guardrail hits
- action history
- simulation result

### 3.6 OpenClaw

Tujuan:

- menguji perbaikan dengan kontrol

Isi:

- experiment list
- split budget test
- creative test
- audience test
- landing/CS assignment test
- outcome comparison

### 3.7 Simulasi Aksi

Tujuan:

- memastikan marketing tidak lebih cepat dari kapasitas operasional

Isi:

- target lead
- forecast lead
- forecast order
- forecast closing
- CS capacity
- technician capacity
- branch saturation
- queue risk

---

## 4. Analyst Matrix

Ini jantung fitur. `Ads Monitoring` tingkat tertinggi harus punya beberapa “analis” internal.

### 4.1 Spend Analyst

Pertanyaan:

- uang habis di mana
- akun mana yang boros
- burn naik karena spend, ppn, atau fee
- spending speed terlalu cepat atau sehat

Output:

- spend anomaly
- burn anomaly
- pacing status
- top wastage account

### 4.2 Funnel Analyst

Pertanyaan:

- klik berubah jadi lead atau tidak
- lead berubah jadi order atau tidak
- order berubah jadi closing atau tidak

Output:

- CTR issue
- CPL issue
- CPR issue
- closing bottleneck

### 4.3 Attribution Analyst

Pertanyaan:

- order sudah terpetakan ke akun yang benar atau belum
- ada berapa `order`, `order*`, `manual`
- dimana ambiguity tertinggi

Output:

- attribution quality score
- unresolved order pool
- manual fallback dependence

### 4.4 Advertiser Analyst

Pertanyaan:

- advertiser mana paling efektif
- advertiser mana paling boros
- advertiser mana perlu intervensi

Output:

- top advertiser
- bottom advertiser
- consistency score
- recommendation priority

### 4.5 CS Analyst

Pertanyaan:

- apakah masalah terjadi di ads atau di follow-up CS
- CS mana lambat
- lead banyak tapi order rendah di CS mana

Output:

- order intake per CS
- conversion per CS
- response bottleneck
- overload flag

### 4.6 Ops Analyst

Pertanyaan:

- apakah marketing sedang menciptakan demand melebihi kapasitas lapangan
- cabang mana overbook
- teknisi mana penuh

Output:

- capacity risk
- branch pressure score
- throttle recommendation

### 4.7 Profit Analyst

Pertanyaan:

- akun mana hanya terlihat bagus di CPL tapi jelek di profit
- advertiser mana ROAS operasionalnya sehat

Output:

- margin estimate
- cost per paid order
- cost per completed service
- profit-risk rank

### 4.8 OpenClaw Strategy Analyst

Pertanyaan:

- tindakan apa yang paling rasional berikutnya
- apakah budget harus dipindah
- apakah lane harus dipause
- apakah advertiser perlu alert

Output:

- recommendation card
- confidence score
- expected impact
- rollback plan

---

## 5. Card System

### 5.1 Top-Level Cards

Baris pertama wajib berisi:

1. `Total Spend`
2. `Total Burn`
3. `Total Order`
4. `Total Closing`
5. `Total Omzet`
6. `ROAS Operasional`

### 5.2 Second-Level Cards

Baris kedua:

1. `CPL`
2. `CPR`
3. `Closing Rate`
4. `Attribution Quality`
5. `Capacity Health`
6. `OpenClaw Action Readiness`

### 5.3 Smart Cards

Kartu pintar yang muncul dinamis:

- `Akun paling boros hari ini`
- `Advertiser paling efisien`
- `CS bottleneck terbesar`
- `Cabang terpadat`
- `Akun paling tidak stabil 7 hari`
- `OpenClaw rekomendasi utama`

### 5.4 Card Content Contract

Setiap card modern harus punya:

- label
- angka utama
- delta vs previous period
- context line
- hint / tooltip
- optional sparkline

---

## 6. Chart System

### 6.1 Mandatory Charts

1. `Spend vs Order Trend`
   - line or area
   - per hari
   - overlay target

2. `Funnel Conversion`
   - funnel or stepped bar
   - click -> lead -> order -> closing -> selesai

3. `Platform Mix`
   - stacked bar / donut
   - Meta vs Google vs others

4. `Advertiser Leaderboard`
   - horizontal bar
   - by order, closing, CPL, CPR

5. `CS Conversion Matrix`
   - heatmap
   - CS vs advertiser

6. `Capacity Pressure`
   - branch/technician load chart

### 6.2 Advanced Charts

1. `Burn vs Omzet Scatter`
   - x = burn
   - y = omzet
   - bubble = order
   - color = platform

2. `Anomaly Timeline`
   - show spikes, pauses, drop-offs

3. `Attribution Quality Trend`
   - line
   - % exact vs shared vs manual

4. `Budget Reallocation Map`
   - sankey / grouped transfer bars

5. `OpenClaw Impact Score`
   - before vs after recommended action

---

## 7. Table Matrix

### 7.1 Main Grid Columns

Mandatory:

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
17. Status
18. OpenClaw

### 7.2 Diagnostics Columns

Optional toggles:

- exact orders
- shared orders
- manual fallback leads
- attribution quality
- last sync
- stale age
- anomaly count
- recommendation state

### 7.3 Row Detail Drawer

Saat row dibuka:

- spend trend harian
- funnel account
- source split
- order attribution quality
- CS split
- closing split
- OpenClaw insight
- recommended action

---

## 8. OpenClaw Modules

### 8.1 OpenClaw Observer

Hanya membaca:

- spend spike
- CPL spike
- CTR drop
- order lag
- CS lag
- capacity overload

### 8.2 OpenClaw Diagnostician

Menjawab:

- masalah ada di ads, CS, atau operasional
- account mana perlu perhatian
- advertiser mana stagnan

### 8.3 OpenClaw Planner

Menyusun:

- tindakan prioritas
- urgensi
- expected effect
- required approval

### 8.4 OpenClaw Executor

Menjalankan aksi yang diizinkan:

- pause low-quality lane
- reduce budget
- hold new scale-up
- switch alert mode
- assign focus ke advertiser
- kirim warning ke owner/advertiser

### 8.5 OpenClaw Auditor

Menyimpan:

- action log
- approval chain
- rollback log
- expected vs actual effect

---

## 9. Recommendation Engine

Recommendation harus tampil sebagai object yang jelas:

- `type`
- `priority`
- `reason`
- `evidence`
- `confidence`
- `expected impact`
- `risk`
- `approval requirement`
- `rollback plan`

Contoh tipe:

- `pause-account`
- `reduce-budget`
- `increase-budget`
- `freeze-scale`
- `investigate-cs`
- `reassign-cs`
- `branch-capacity-warning`
- `creative-refresh-needed`

---

## 10. Screen Layout

### 10.1 First Fold

1. page header
2. global control bar
3. top KPI cards
4. OpenClaw action strip

### 10.2 Second Fold

1. charts row 1
2. charts row 2
3. diagnostics cards

### 10.3 Third Fold

1. main table
2. row drawer
3. glossary / methodology

### 10.4 OpenClaw Strip

Harus selalu ada blok kecil yang menampilkan:

- mode current
- recommendation count
- blocked actions
- approval pending
- last successful action

---

## 11. Matrices

### 11.1 Advertiser x CS Matrix

Isi:

- orders
- closing
- closing rate
- omzet
- issue color

Tujuan:

- lihat hubungan advertiser ke performa CS

### 11.2 Platform x Funnel Matrix

Isi:

- clicks
- leads
- orders
- closing
- CPR
- ROAS

Tujuan:

- cari stage bottleneck per platform

### 11.3 Branch x Capacity Matrix

Isi:

- orders incoming
- jobs ongoing
- technician capacity
- overload risk

Tujuan:

- throttle marketing jika ops tidak kuat

### 11.4 Account x Attribution Quality Matrix

Isi:

- exact %
- shared %
- manual %
- unresolved order count

Tujuan:

- audit kepercayaan data per akun

### 11.5 Advertiser x Profit Matrix

Isi:

- spend
- burn
- omzet
- gross profit proxy
- efficiency score

Tujuan:

- jangan hanya optimasi CPL

---

## 12. What Exists Inside This Feature

Versi tertinggi `Ads Monitoring` seharusnya punya menu internal seperti ini:

1. `Overview`
2. `Funnel`
3. `Accounts`
4. `Advertisers`
5. `CS Matrix`
6. `Capacity`
7. `Diagnostics`
8. `OpenClaw`
9. `Experiments`
10. `Audit Trail`
11. `Methodology`

---

## 13. Methodology Layer

Harus ada panel/bagian yang menjelaskan:

- definisi Spend
- definisi Burn
- definisi Order
- definisi Closing
- definisi ROAS operasional
- definisi `order`, `order*`, `manual`
- bagaimana OpenClaw mengambil keputusan

Ini tidak boleh dominan di atas fold.

---

## 14. Framework Support Required

### 14.1 Wajib untuk Level Tinggi

Kalau mau fitur ini benar-benar hidup dan scalable, support yang paling saya sarankan:

1. `@tanstack/react-query`
   - cache query
   - background refresh
   - stale control
   - optimistic filters

2. `@tanstack/react-table`
   - table modern
   - pinning
   - sorting
   - column state
   - group row

3. `zustand`
   - state OpenClaw console
   - drawer state
   - compare mode
   - matrix selections

4. `recharts` atau chart layer yang sudah ada
   - cukup sekarang

5. `Next.js 16 + React 19`
   - ini target tertinggi, bukan syarat P0

### 14.2 Tanpa Support Ini

Fitur masih bisa jalan, tapi akan:

- lebih sulit dirawat
- lebih susah di-cache
- table akan cepat membengkak
- OpenClaw state jadi kotor

---

## 15. Decision Levels

OpenClaw tidak boleh langsung bebas melakukan semua aksi.

### Level 0

- observe only

### Level 1

- recommend only

### Level 2

- auto low-risk actions

### Level 3

- auto advertiser actions with guardrails

### Level 4

- strategic budget orchestration with approval

---

## 16. Advanced Cards Detail

### 16.1 Risk Cards

- `Budget Waste Risk`
- `Capacity Overload Risk`
- `CS Bottleneck Risk`
- `Attribution Drift Risk`

### 16.2 Opportunity Cards

- `Scale Candidate`
- `Underfunded Winner`
- `High Margin Lane`
- `Fast Closing Lane`

### 16.3 Action Cards

- `Recommended Now`
- `Needs Approval`
- `Executed Today`
- `Rollback Available`

---

## 17. Testing Matrix

Wajib dites:

1. angka global == source truth
2. angka per advertiser == filtered truth
3. angka per account == attribution result
4. rate limit fallback aman
5. OpenClaw recommendation tidak muncul tanpa evidence
6. action audit trail tersimpan
7. branch overload mengubah recommendation

---

## 18. Final Form

Kalau benar-benar jadi `tingkat tertinggi`, maka `Ads Monitoring` di Polesheadlamp akan menjadi:

- dashboard eksekutif
- workspace advertiser
- workspace analyst
- workspace robot operator
- workspace audit

Jadi satu fitur ini akan memuat:

- monitoring
- diagnostics
- planning
- recommendation
- execution
- audit

Dan `OpenClaw` menjadi advertiser robot yang:

- bisa melihat
- bisa memahami
- bisa menjelaskan
- bisa merekomendasikan
- bisa mengeksekusi
- bisa diaudit
