# Blueprint Adaptation Notes for Polesheadlamp.id

Status: Reference detail
Date: 2026-04-20
Scope: Documentation first, no runtime change
Document role: Supporting reference after consolidation into `BLUEPRINT-EXECUTION-MASTER.md`

## Purpose

Dokumen ini dipakai untuk menyusun arah adaptasi dari `File Review/BLUEPRINT.md` ke app `Polesheadlamp.id` tanpa mengubah tampilan, alur kerja, atau perilaku aplikasi yang berjalan saat ini.

Fokus fase ini adalah menyamakan pemahaman, menulis batasan kerja, dan memilih bagian blueprint yang relevan untuk repo ini.

## Deep Read: What the Blueprint Actually Is

Setelah dibaca lebih dalam, `BLUEPRINT.md` ternyata bukan sekadar template struktur folder atau daftar dependency. Dokumen ini lebih tepat dipahami sebagai:

- konstitusi teknis proyek
- kontrak implementasi yang sangat preskriptif
- dokumen inisialisasi untuk proyek greenfield
- spesifikasi yang memang dirancang agar bisa dijalankan oleh tim atau AI dengan ruang tafsir yang sangat kecil

Artinya, blueprint ini tidak hanya bilang "pakai stack apa", tetapi juga mengunci:

- bagaimana komponen diklasifikasikan
- bagaimana data boleh mengalir
- bagaimana styling boleh ditulis
- bagaimana API harus merespons
- bagaimana auth, security, CI/CD, testing, dan migration harus dibentuk
- apa saja yang secara eksplisit dianggap salah

Kesimpulan penting:

> Ini bukan blueprint fitur. Ini blueprint governance.

## Deep Read: What It Optimizes For

Secara implisit, `BLUEPRINT.md` mengoptimalkan proyek untuk hal-hal berikut:

### 1. Predictability over flexibility

Dokumen ini sengaja mengurangi ruang improvisasi. Hampir semua keputusan penting sudah ditentukan:

- struktur repo
- bentuk route
- klasifikasi komponen
- pola auth
- pola real-time
- style token
- quality gate
- anti-pattern

Tujuannya adalah membuat hasil implementasi konsisten walau dikerjakan banyak orang atau AI.

### 2. Server-first architecture

Meski banyak bagian terasa seperti UI guide, fondasi utamanya sebenarnya server-first:

- React Server Components sebagai default
- client component hanya bila benar-benar perlu
- data fetch idealnya di server
- mutation lewat server action
- route guard lewat middleware

Jadi blueprint ini dibangun dari asumsi bahwa rendering, data access, dan auth lebih aman jika dipusatkan di server.

### 3. Strict boundary enforcement

Blueprint sangat obsesif terhadap batas antar layer. Ini terlihat dari pemisahan:

- primitive
- shell
- composite
- feature
- frontend
- backend
- shared db
- design token source

Dokumen ini tidak suka file atau modul yang memegang terlalu banyak tanggung jawab.

### 4. Operational maturity from day one

CI/CD, Lighthouse budget, accessibility, observability, Sentry, OpenTelemetry, security headers, rate limiting, migration rules, dan audit log diposisikan sebagai bagian inti arsitektur, bukan pekerjaan belakangan.

Jadi blueprint ini dibuat dengan mentalitas:

> proyek harus siap tumbuh dan diaudit sejak awal, bukan dirapikan setelah besar.

### 5. Design system as infrastructure

Blueprint tidak memperlakukan UI sebagai kumpulan halaman, tetapi sebagai sistem token berlapis:

- primitive token
- semantic token
- role token
- utility bridge

Dan aturan visualnya juga keras:

- grouping pakai surface hierarchy, bukan border
- role accent hanya aksen, bukan background utama
- tidak boleh fork komponen per role

Ini menunjukkan bahwa blueprint ini ingin visual system tetap stabil walau role dan fitur bertambah.

## Deep Read: Hidden Assumptions Inside the Blueprint

Blueprint ini membawa beberapa asumsi besar yang penting untuk dicatat sebelum diadaptasi.

### Assumption 1

Proyek dimulai dari nol atau dari fondasi yang masih mudah dibentuk.

### Assumption 2

Tim bersedia menerima aturan teknis yang ketat dan seragam.

### Assumption 3

Arsitektur route-based, server-driven, dan package-based dianggap lebih sehat daripada app client-heavy yang tumbuh organik.

### Assumption 4

Refactor besar di awal dianggap lebih murah daripada merawat fleksibilitas yang tidak disiplin.

### Assumption 5

Setiap domain idealnya punya kontrak formal, bukan hanya implementasi yang "berjalan".

## Deep Read: Why It Does Not Fit This Repo As-Is

Masalah utama blueprint ini bukan karena isinya buruk, tetapi karena titik berangkat repo ini berbeda.

Repo `Polesheadlamp.id` saat ini:

- sudah hidup dan memuat modul bisnis yang cukup banyak
- banyak alur user sudah nyata dan dipakai
- frontend utamanya client-heavy
- navigasi internal masih dominan state-driven
- akses data client masih cukup terpusat
- backend terdistribusi antara query langsung ke Supabase dan Edge Function Hono

Sementara blueprint mengasumsikan:

- route structure yang jauh lebih tegas
- server-first rendering
- klasifikasi komponen yang ketat sejak awal
- kontrak data dan API yang lebih formal
- governance process yang sudah ditanam sejak awal proyek

Jadi bila dipaksakan mentah-mentah, hasilnya bukan adaptasi, tetapi rewrite arsitektur.

## Deep Read: Real Value for This Repo

Nilai paling besar blueprint untuk repo ini ada pada tiga lapisan berikut:

### 1. Decision framework

Blueprint memberi cara memilih keputusan teknis:

- file ini seharusnya hidup di layer mana
- logic ini seharusnya diletakkan di mana
- fetch ini seharusnya dilakukan oleh siapa
- state ini sebenarnya domain-local atau global

### 2. Governance checklist

Blueprint menyediakan standar untuk menilai kualitas struktur saat ini, misalnya:

- apakah satu file terlalu gemuk
- apakah boundary domain masih bercampur
- apakah API response terlalu liar
- apakah permission hanya dijaga di UI atau juga di server
- apakah migration dan security sudah cukup disiplin

### 3. Refactor compass

Blueprint bisa dipakai sebagai kompas refactor bertahap tanpa harus mengganti stack utama.

Yang diambil:

- disiplin kontrak
- disiplin boundary
- disiplin naming
- disiplin validation
- disiplin quality gate

Yang tidak diambil secara paksa:

- Next.js
- RSC
- PPR
- Turborepo
- Redis/BullMQ sebagai fondasi wajib

## Current App Snapshot

Kondisi app saat dokumen ini dibuat:

- Frontend: React 18 + Vite 6 + Tailwind CSS 4
- Backend/runtime: Supabase Auth, Postgres, Realtime, Storage, Edge Functions
- Server modules: Hono-based endpoints di `supabase/functions/server`
- Routing browser masih tipis, dan mayoritas navigasi internal memakai state `activeTab`
- Shared client data masih banyak terpusat di `src/app/pages/master-data/context/MasterDataCtx.tsx`
- Permission role sudah cukup matang di `src/app/data/permissions.ts`
- Migration database sudah ada di `supabase/migrations`

Dokumen acuan utama yang sudah ada:

- `README.md`
- `APP_OVERVIEW.md`
- `PLATFORM_OVERVIEW.md`
- `File Review/BLUEPRINT.md`

## Hard Constraints

Constraint ini dianggap wajib sampai ada instruksi baru.

### 1. No UI/UX changes

- Tidak ada perubahan layout, navigasi visual, struktur halaman, styling, spacing, warna, typography, atau interaction pattern.
- Tidak ada redesign komponen atau pergeseran pengalaman pengguna.
- Design token boleh didokumentasikan, tetapi tidak boleh mengubah output visual saat ini.

### 2. No logic changes

- Tidak ada perubahan behavior business flow.
- Tidak ada perubahan permission behavior per role.
- Tidak ada perubahan auth flow, realtime flow, payment flow, stock flow, payroll flow, atau routing behavior yang memengaruhi user.
- Tidak ada perubahan hasil perhitungan, validasi bisnis, atau side effect aplikasi.

### 3. Documentation-first only

- Fase ini hanya untuk dokumentasi, pemetaan, dan keputusan arsitektur tingkat dokumen.
- Belum ada implementasi kode yang mengubah perilaku sistem.
- Jika nanti ada implementasi, harus diturunkan dari dokumen ini dan disetujui per fase.

### 4. Approval required for UI/UX or logic changes

- Setiap perubahan UI/UX wajib meminta persetujuan user terlebih dahulu.
- Setiap perubahan logic sistem atau behavior runtime wajib meminta persetujuan user terlebih dahulu.
- Jika ada usulan perubahan yang menyentuh salah satu area tersebut, pekerjaan harus pause dan dikonfirmasi ke user sebelum lanjut.

## What Can Be Adapted from the Blueprint

Bagian blueprint yang paling relevan untuk app ini adalah prinsipnya, bukan stack-nya mentah-mentah.

### A. Module boundaries

Blueprint kuat dalam pemisahan area frontend, backend, shared package, dan domain. Di app ini, prinsip itu bisa diadaptasi menjadi:

- batas domain yang lebih jelas antara `leads`, `orders`, `finance`, `inventory`, `users`, dan `marketing`
- pemisahan tanggung jawab file besar yang saat ini terlalu sentral
- dokumentasi ownership per domain sebelum refactor teknis dilakukan

### B. API contract discipline

Blueprint mendefinisikan format API, status code, error envelope, auth convention, dan validation pattern. Ini cocok diadaptasi ke Edge Functions yang sudah memakai Hono, terutama untuk:

- standarisasi request/response
- standarisasi error handling
- validasi input yang konsisten
- dokumentasi endpoint publik vs internal

### C. Data access layering

Blueprint membedakan area fetch, mutation, auth, dan cache dengan lebih tegas. Di app ini, itu bisa diterjemahkan menjadi:

- pemisahan data fetching per domain
- pengurangan ketergantungan pada context raksasa
- dokumentasi lapisan `UI -> service -> supabase/edge function`

### D. Security and permission contracts

Blueprint cukup ketat soal auth, RBAC, secret handling, dan input validation. App ini sudah punya pondasi tersebut, jadi yang bisa diadaptasi adalah:

- dokumen mapping permission UI vs permission server
- daftar endpoint yang wajib protected
- checklist secret dan server-only config

### E. Schema and migration conventions

Karena repo ini sudah punya `supabase/migrations`, maka prinsip blueprint terkait kontrak schema bisa dipakai untuk:

- aturan penamaan migration
- aturan kolom audit
- aturan relasi inti
- checklist RLS/policy review

### F. Quality gates

Blueprint punya standar merge requirement yang jelas. Itu relevan untuk repo ini sebagai target proses, misalnya:

- typecheck
- lint
- test baseline
- build validation
- security checklist

Catatan: untuk fase sekarang, bagian ini masih sebatas dokumentasi target, belum implementasi pipeline.

### G. Observability and logging conventions

Blueprint menekankan logging dan observability yang konsisten. Di repo ini, adaptasinya bisa berupa:

- aturan penggunaan `console.*`
- format error log minimum
- daftar area kritis yang butuh logging lebih rapi

## What Should Not Be Adopted As-Is

Bagian di bawah ini tidak cocok diambil langsung untuk kondisi repo saat ini:

- Next.js App Router
- React Server Components
- Partial Prerendering
- Turborepo monorepo
- Redis/BullMQ sebagai default
- pemecahan package shared ala monorepo

Alasannya sederhana: app saat ini adalah SPA berbasis Vite dengan Supabase sebagai tulang punggung utama. Memaksa stack blueprint secara penuh akan berubah menjadi rewrite, bukan adaptasi.

## Recommended Adaptation Direction

Arah terbaik untuk repo ini adalah:

1. Ambil aturan arsitektur dan kualitas dari blueprint.
2. Pertahankan stack React + Vite + Supabase + Hono yang sudah berjalan.
3. Gunakan blueprint sebagai referensi untuk merapikan struktur internal, bukan untuk mengganti fondasi aplikasi.

Kalimat kerjanya:

> Adapt the discipline, not the stack.

## Priority Areas for Future Work

Area di bawah ini dipandang paling layak untuk diadaptasi nanti, tetapi belum dikerjakan pada fase dokumentasi ini.

### Priority 1

- memecah tanggung jawab `MasterDataCtx` per domain
- mendokumentasikan kontrak endpoint Edge Functions
- mendokumentasikan alur permission client dan server

### Priority 2

- menyiapkan quality gate minimal untuk repo
- merapikan konvensi migration dan schema review
- menyusun standar logging dan error handling

### Priority 3

- memetakan kandidat route per modul tanpa mengubah UI saat ini
- menyusun boundary antara main app dan `marketing-os`
- menyusun token/design system governance tanpa mengubah tampilan

## Explicit Non-Goals for This Phase

Hal berikut bukan tujuan fase ini:

- refactor komponen
- refactor context menjadi store/service
- tambah atau ubah route yang dipakai user
- ubah tampilan dashboard, sidebar, topbar, form, tabel, atau dialog
- ubah permission matrix
- ubah query database, endpoint behavior, atau migration aktif
- tambah test runner, lint runner, atau script CI baru tanpa keputusan fase lanjut

## Documentation Packet Status

Paket dokumentasi pre-execution yang sudah siap saat ini:

- [x] `BLUEPRINT-ADAPTATION-NOTES.md`
- [x] `CURRENT-ARCHITECTURE-MAP.md`
- [x] `BLUEPRINT-SECTION-MATRIX.md`
- [x] `TARGET-TECHNICAL-CONVENTIONS.md`
- [x] `NO-REGRESSION-CHECKLIST.md`
- [x] `REFACTOR-BACKLOG.md`
- [x] `PERFORMANCE-BASELINE-PLAN.md` as measurement plan only
- [x] `EXECUTION-BATCH-01-PLAN.md` as first execution brief
- [x] `EXECUTION-BATCH-02-PLAN.md` as second execution brief
- [x] `EXECUTION-READINESS-CHECKLIST.md` as go/no-go gate

Artinya, sebelum masuk eksekusi kita sudah punya:

- dokumen arah adaptasi
- peta arsitektur saat ini
- matrix keputusan blueprint per section
- aturan teknis target
- pagar no-regression
- backlog task per level risiko
- rencana baseline performa untuk isu Chrome HP
- brief batch eksekusi pertama
- brief batch eksekusi kedua
- checklist readiness sebelum coding

## Step-by-Step Todo

Urutan di bawah ini disusun agar adaptasi blueprint tidak liar, tidak berubah menjadi rewrite mendadak, dan tetap menjaga app yang sekarang stabil.

### Phase 0 - Freeze Scope

Status: done

Goal:
Mengunci batas kerja supaya tim tidak lompat ke implementasi yang terlalu cepat.

Checklist:

- [x] Tetapkan bahwa fase saat ini adalah documentation-first.
- [x] Tetapkan bahwa tidak ada perubahan UI/UX.
- [x] Tetapkan bahwa tidak ada perubahan logic dan behavior runtime.
- [x] Gunakan dokumen ini sebagai pegangan scope sampai ada revisi eksplisit.

Output:

- `BLUEPRINT-ADAPTATION-NOTES.md` aktif sebagai dokumen keputusan awal.

Exit criteria:

- [x] Semua orang sepakat bahwa blueprint belum dipakai untuk rewrite stack.
- [x] Semua perubahan masih sebatas dokumen.

### Phase 1 - Map Current Architecture

Status: done

Goal:
Memotret arsitektur repo yang benar-benar ada sekarang, bukan yang ideal.

Checklist:

- [x] Buat `CURRENT-ARCHITECTURE-MAP.md`.
- [x] Petakan domain utama: `leads`, `orders`, `finance`, `inventory`, `users`, `marketing`, `technician`.
- [x] Tandai file pusat per domain.
- [x] Tandai entrypoint frontend, auth gate, layout shell, route layer, shared data layer, dan edge function layer.
- [x] Tandai dependency penting antar domain.
- [x] Tandai file yang terlalu besar atau terlalu sentral.

Output:

- `CURRENT-ARCHITECTURE-MAP.md`
- dokumen peta arsitektur saat ini
- daftar titik coupling utama

Exit criteria:

- [x] Kita bisa menjelaskan alur `UI -> data access -> Supabase / Edge Function` per domain.
- [x] Kita tahu area yang paling rawan kalau direfactor.

### Phase 2 - Translate Blueprint Section by Section

Status: done

Goal:
Mengubah blueprint dari dokumen abstrak menjadi matrix keputusan untuk repo ini.

Checklist:

- [x] Bedah `BLUEPRINT.md` per section.
- [x] Untuk tiap section, tandai status: `adopt`, `adapt`, `defer`, atau `ignore`.
- [x] Catat alasan tiap keputusan.
- [x] Bedakan mana yang hanya relevan untuk greenfield dan mana yang masih relevan untuk repo berjalan.
- [x] Tandai mana yang bisa diadopsi tanpa risiko behavior change.

Output:

- `BLUEPRINT-SECTION-MATRIX.md`
- matrix adaptasi blueprint per section

Exit criteria:

- [x] Tidak ada lagi interpretasi kabur soal bagian blueprint mana yang benar-benar akan dipakai.

### Phase 3 - Define Target Technical Conventions

Status: done

Goal:
Menentukan aturan teknis target tanpa langsung menyentuh runtime.

Checklist:

- [x] Buat `TARGET-TECHNICAL-CONVENTIONS.md`.
- [x] Tetapkan aturan boundary komponen.
- [x] Tetapkan aturan data access layer.
- [x] Tetapkan aturan request/response/error envelope untuk Edge Functions.
- [x] Tetapkan aturan validation input.
- [x] Tetapkan aturan logging dan error reporting minimum.
- [x] Tetapkan aturan migration dan schema review.
- [x] Tetapkan aturan permission check di client vs server.

Output:

- `TARGET-TECHNICAL-CONVENTIONS.md`
- dokumen konvensi target

Exit criteria:

- [x] Repo punya standar teknis tertulis yang spesifik dan bisa dipakai untuk review perubahan.

### Phase 4 - Define No-Regression Safety Net

Status: done

Goal:
Menentukan pagar pengaman sebelum ada refactor internal.

Checklist:

- [x] Buat checklist area kritis yang tidak boleh berubah behavior-nya.
- [x] Daftar modul sensitif: auth, leads, orders, payment, stock, payroll, permission, realtime.
- [x] Daftar alur user yang wajib tetap sama.
- [x] Daftar halaman yang wajib tetap sama dari sisi UI/UX.
- [x] Tetapkan cara verifikasi manual untuk setiap area kritis.

Output:

- `NO-REGRESSION-CHECKLIST.md`
- checklist no-regression

Exit criteria:

- [x] Sebelum refactor apa pun, kita sudah punya definisi jelas tentang apa yang tidak boleh rusak.

### Phase 5 - Build Refactor Backlog by Risk Level

Status: done

Goal:
Mengubah arahan besar menjadi backlog yang realistis.

Checklist:

- [x] Buat `REFACTOR-BACKLOG.md`.
- [x] Pisahkan backlog menjadi `safe`, `medium-risk`, dan `high-risk`.
- [x] Tandai perubahan yang murni internal.
- [x] Tandai perubahan yang berpotensi memengaruhi behavior.
- [x] Urutkan backlog berdasarkan nilai dan risiko.

Output:

- `REFACTOR-BACKLOG.md`
- backlog refactor bertahap

Exit criteria:

- [x] Kita tahu mana pekerjaan yang bisa dimulai lebih dulu tanpa menyentuh UI/UX dan logic.

### Phase 6 - Baseline Performance and Stability

Status: done

Goal:
Memastikan keputusan adaptasi nanti juga menyentuh problem nyata, termasuk isu lemot di Chrome HP.

Checklist:

- [x] Buat baseline performa untuk mobile Chrome.
- [x] Catat halaman atau modul yang paling berat.
- [x] Catat bottleneck awal: initial load, rerender global, fetch terlalu besar, chart, map, table, atau realtime noise.
- [x] Pisahkan masalah performa struktural dari masalah performa spesifik komponen.
- [x] Dokumentasikan hipotesis performa sebelum melakukan refactor.

Output:

- `PERFORMANCE-BASELINE-PLAN.md` as method reference
- `MOBILE-CHROME-PERFORMANCE-BASELINE.md`
- dokumen baseline performa
- daftar hipotesis bottleneck

Exit criteria:

- [x] Kita tahu apakah blueprint membantu performa secara langsung, tidak langsung, atau tidak relevan.

### Phase 7 - Implementation Batch 1: Internal Structure Only

Status: done

Goal:
Mulai implementasi paling aman, tanpa perubahan UI/UX dan tanpa perubahan logic bisnis.

Progress snapshot:

- [x] `Batch 01A` shell registry cleanup sudah dieksekusi di kode.
- [x] `Batch 01B` service helper foundation sudah dieksekusi di kode.
- [x] Manual smoke verification untuk `Batch 01` sudah ditutup.

Checklist:

- [x] Rapikan boundary file dan folder internal.
- [x] Pisahkan helper, mapper, dan service yang masih bercampur.
- [x] Kurangi file yang terlalu sentral jika bisa dilakukan tanpa behavior change.
- [x] Pertahankan semua output UI dan alur user tetap sama.

Output:

- perapihan struktur internal

Gate before moving on:

- [x] Review bahwa tidak ada perubahan tampilan.
- [x] Review bahwa logic bisnis tetap sama.

### Phase 8 - Implementation Batch 2: API Contract and Validation

Status: ready after documentation approval

Goal:
Meratakan kontrak backend secara bertahap.

Checklist:

- [ ] Standarkan response envelope pada endpoint yang dipilih.
- [ ] Tambahkan validation yang konsisten pada input server.
- [ ] Rapikan error handling agar lebih seragam.
- [ ] Pastikan permission penting tidak hanya dijaga di UI.

Output:

- endpoint lebih konsisten dan lebih aman

Gate before moving on:

- [ ] Tidak ada breaking change ke frontend yang sedang dipakai user.

### Phase 9 - Implementation Batch 3: Data Layer Refactor

Status: done

Goal:
Mengurangi coupling di client data layer.

Progress snapshot:

- [x] Mapper `user`, `master data`, `misc`, `transaction`, dan `lead` sudah diekstrak ke `internal/mappers/**`.
- [x] `Batch 02B` fetch catalog extraction sudah dieksekusi di kode.
- [x] `Batch 02C` lead social adapter extraction sudah dieksekusi di kode.
- [x] Manual smoke verification untuk `Batch 02` sudah ditutup.

Checklist:

- [x] Pecah area yang terlalu besar seperti `MasterDataCtx` secara bertahap.
- [x] Pisahkan per domain atau per concern.
- [x] Jaga agar UI tetap sama.
- [x] Jaga agar hasil fetch dan mutation tetap sama.

Output:

- data layer lebih modular

Gate before moving on:

- [x] Tidak ada perubahan user-facing flow.
- [x] Tidak ada penurunan stabilitas realtime, auth, atau permission.

### Phase 10 - Implementation Batch 4: Quality Gates

Status: done

Goal:
Menambahkan pagar kualitas yang selama ini belum formal.

Checklist:

- [x] Tambahkan `typecheck` baseline fokus.
- [x] Tambahkan `lint` baseline fokus.
- [ ] Tambahkan baseline test minimum untuk area kritis.
- [x] Tambahkan build validation yang lebih jelas.
- [ ] Tambahkan checklist security minimum untuk review.

Output:

- quality gate repo yang bisa dijalankan konsisten

Gate before moving on:

- [x] Tooling baru tidak mengubah runtime app.

### Phase 11 - Re-evaluate Larger Structural Moves

Status: deferred until earlier phases are complete

Goal:
Baru setelah semua fase aman, pertimbangkan perubahan yang lebih besar.

Checklist:

- [ ] Evaluasi apakah route per modul memang perlu.
- [ ] Evaluasi apakah pemisahan package atau workspace memang perlu.
- [ ] Evaluasi apakah sebagian pola data fetching perlu diubah lebih jauh.
- [ ] Evaluasi apakah ada bagian stack blueprint yang benar-benar layak diadopsi lebih dalam.

Output:

- keputusan lanjut berdasarkan data, bukan asumsi

Exit criteria:

- [ ] Keputusan besar hanya diambil setelah fase dokumentasi, baseline, dan refactor aman selesai.

## Immediate Next Actions

Kalau mengikuti urutan paling aman, pekerjaan terdekat sebelum eksekusi adalah:

- [x] Buat `CURRENT-ARCHITECTURE-MAP.md`.
- [x] Buat matrix adaptasi `BLUEPRINT.md` per section.
- [x] Buat `TARGET-TECHNICAL-CONVENTIONS.md`.
- [x] Buat `NO-REGRESSION-CHECKLIST.md`.
- [x] Buat `REFACTOR-BACKLOG.md`.
- [x] Siapkan `PERFORMANCE-BASELINE-PLAN.md`.
- [x] Pilih dan susun brief batch kerja pertama dari backlog `safe`.
- [x] Pilih dan susun brief batch kerja kedua untuk area `MasterDataCtx`.
- [x] Susun checklist readiness dan urutan eksekusi lintas batch.
- [x] Review dan approve paket dokumentasi ini sebagai dasar eksekusi.
- [x] Eksekusi `Batch 01A`.
- [x] Eksekusi `Batch 01B`.
- [x] Mulai `Batch 02A` domain mapper extraction.
- [x] Eksekusi `Batch 02B`.
- [x] Eksekusi `Batch 02C`.
- [x] Tambahkan baseline `typecheck` yang lolos untuk scope aman saat ini.
- [x] Tambahkan baseline `lint` yang lolos untuk scope aman saat ini.
- [x] Sinkronkan markdown status dengan progres implementasi.
- [ ] Jalankan manual smoke test untuk `Batch 01` dan `Batch 02`.
- [ ] Putuskan apakah scope `lint` akan diperluas setelah smoke manual.
- [ ] Jika targetnya juga mengatasi lemot Chrome HP, kumpulkan baseline performa nyata sebelum refactor.

## Decision Log

### Decision 01

`BLUEPRINT.md` diperlakukan sebagai referensi prinsip arsitektur, bukan template implementasi langsung.

### Decision 02

Seluruh adaptasi untuk tahap awal dibatasi pada dokumentasi dan penyusunan keputusan teknis.

### Decision 03

Tidak ada perubahan UI/UX dan tidak ada perubahan logic sampai ada update scope yang eksplisit.

### Decision 04

Jika di kemudian hari ada kebutuhan untuk mengubah UI/UX atau logic sistem, perubahan itu hanya boleh dilakukan setelah ada approval langsung dari user.

## Next Suggested Step

Tidak ada markdown wajib baru yang harus dibuat sebelum eksekusi.

Paket dokumentasi inti sudah siap. Langkah berikutnya adalah:

- tutup manual smoke untuk `Batch 01` dan `Batch 02`
- putuskan apakah scope `lint` perlu diperluas
- gunakan `NO-REGRESSION-CHECKLIST.md` sebagai pagar review tiap sub-batch
- jika performa mobile jadi target, jalankan `PERFORMANCE-BASELINE-PLAN.md` sebelum coding optimasi
