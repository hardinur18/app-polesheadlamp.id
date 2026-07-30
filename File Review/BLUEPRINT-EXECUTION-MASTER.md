# Blueprint Execution Master for Polesheadlamp.id

Status: Active master document
Date: 2026-04-20
Scope: Single operational markdown for blueprint adaptation, refactor planning, and execution tracking
Document role: Primary entry point for daily use

## Purpose

Dokumen ini menjadi pintu masuk utama untuk membaca:

- kenapa `BLUEPRINT.md` dipakai
- apa yang boleh dan tidak boleh diadaptasi
- status phase dan batch yang sedang berjalan
- backlog yang aman dikerjakan
- next action yang paling relevan sekarang

Tujuannya bukan menghapus jejak dokumen lain, tetapi menjadikan semuanya lebih mudah dibaca dari satu tempat.

## How to Use This File

- Pakai file ini sebagai dokumen utama harian.
- Anggap file markdown lain sebagai appendix atau detail reference.
- Jika ada konflik status, file ini menjadi sumber status kerja terbaru.

## Hard Constraints

- Tidak ada perubahan UI/UX tanpa approval user.
- Tidak ada perubahan logic sistem tanpa approval user.
- Tidak ada perubahan route behavior tanpa approval user.
- Tidak ada perubahan auth flow tanpa approval user.
- Semua refactor awal harus internal-only dan mempertahankan output user-facing yang sama.

## Current Repo Snapshot

Karakter repo saat ini:

- host app utama ada di `src/app`
- frontend memakai React 18 + Vite 6 + Tailwind CSS 4
- backend boundary utama memakai Supabase Edge Functions berbasis Hono
- data layer utama memakai Supabase Auth, Postgres, Realtime, dan Storage
- `AppLayout` adalah shell navigasi utama
- `MasterDataCtx` adalah salah satu pusat coupling terbesar
- `marketing-os` adalah extension layer di dalam runtime yang sama, bukan produk terpisah

Hotspot utama yang sudah teridentifikasi:

- `AppLayout.tsx`
- `MasterDataCtx.tsx`
- permission overlay dan shared data access
- live integration area untuk ads, conversation, dan payment

## Blueprint Translation Summary

`BLUEPRINT.md` dipakai sebagai:

- governance guide
- refactor compass
- quality and security checklist

`BLUEPRINT.md` tidak dipakai sebagai:

- Next.js migration brief
- monorepo bootstrap plan
- rewrite stack plan

### Section Decision Summary

| Section | Status | Ringkasannya |
|---|---|---|
| 1. System Architecture Overview | `adapt` | Dipakai sebagai peta layer konseptual, bukan stack literal |
| 2. Monorepo Structure | `adapt` | Ambil disiplin boundary, bukan Turborepo-nya |
| 3. Dependency Manifest | `defer` | Hanya referensi kategori dependency |
| 4. Configuration Files | `adapt` | Ambil aturan contract config dan strictness |
| 5. Database Schema Contracts | `adapt` | Ambil naming, migration discipline, dan schema review |
| 6. API Contract Specification | `adapt` | Salah satu target paling bernilai untuk Edge Functions dan service layer |
| 7. Design System Specification | `adapt` | Ambil governance sistem desain, bukan redesign |
| 8. Rendering Architecture | `ignore` | Terlalu Next.js/RSC/PPR-specific |
| 9. Authentication and Authorization | `adapt` | Ambil prinsip boundary auth dan permission enforcement |
| 10. Real-Time Architecture | `adapt` | Ambil governance realtime dan noise control |
| 11. Background Jobs | `defer` | Belum relevan sebagai task aktif |
| 12. Observability | `adapt` | Ambil logging dan performance discipline |
| 13. CI/CD Pipeline | `adapt` | Ambil quality flow dan deployment discipline |
| 14. PWA Specification | `adapt` | Ambil kontrak PWA formal |
| 15. Accessibility Contract | `adopt` | Langsung relevan lintas stack |
| 16. Component Architecture Rules | `adapt` | Sangat relevan untuk conventions dan backlog |
| 17. Anti-Patterns | `adapt` | Dipakai sebagai review lens, bukan alasan rewrite |
| 18. Security Requirements | `adapt` | Dipakai sebagai target hardening bertahap |
| 19. Setup Sequence | `ignore` | Greenfield-only |
| 20. Quality Gates | `adapt` | Dipakai sebagai target proses bertahap |
| 21. Glossary | `adopt` | Dipakai untuk konsistensi istilah |

### Highest-Value Areas to Adapt

- API contract and error discipline
- auth and permission boundary discipline
- observability and logging
- component and file boundary rules
- anti-pattern review lens
- security requirements
- quality gates

## Target Technical Direction

Arahan teknis yang dipakai saat ini:

- host app tetap runtime utama
- `marketing-os` tetap extension layer, bukan runtime terpisah
- Edge Functions tetap boundary server logic resmi
- route browser yang sekarang dianggap fixed sampai ada approval
- `AppLayout` boleh dirapikan internalnya, tapi tidak boleh mengubah pengalaman navigasi
- `MasterDataCtx` boleh dirapikan internalnya, tapi provider shape harus stabil
- service layer jadi tempat yang disukai untuk request ke Edge Functions
- direct `supabase.from(...)` legacy tidak dirombak mendadak
- permission penting tidak boleh hanya dijaga di UI
- migration tetap mengacu ke `supabase/migrations`

## No-Regression Rules

Area yang tidak boleh berubah diam-diam:

- app boot dan auth
- theme dan shell
- role dan permission behavior
- leads dan prospects
- orders dan assignment
- technician operations
- payments dan finance
- inventory
- admin dan master data
- ads and marketing integrations
- conversations
- Marketing OS
- public surfaces seperti `/booking`

Visual invariant yang dianggap fixed:

- label menu
- layout shell
- struktur tabel dan form
- urutan utama navigasi
- warna, theme output, typography, dan spacing visual

## Phase Status

| Phase | Status | Notes |
|---|---|---|
| Phase 0 - Freeze Scope | `done` | Constraint sudah dikunci |
| Phase 1 - Map Current Architecture | `done` | Arsitektur saat ini sudah dipetakan |
| Phase 2 - Translate Blueprint | `done` | Matrix `adopt/adapt/defer/ignore` sudah ada |
| Phase 3 - Target Technical Conventions | `done` | Conventions doc sudah siap |
| Phase 4 - No-Regression Safety Net | `done` | Checklist aman sudah siap |
| Phase 5 - Refactor Backlog by Risk | `done` | Backlog `safe/medium/high-risk` sudah siap |
| Phase 6 - Performance Baseline | `done` | Baseline emulasi mobile Chrome sudah ditangkap dan didokumentasikan |
| Phase 7 - Internal Structure Batch | `done` | `Batch 01A` dan `01B` sudah diimplementasikan dan smoke ditutup |
| Phase 8 - API Contract and Validation | `ready` | Belum mulai |
| Phase 9 - Data Layer Refactor | `done` | `Batch 02A`, `02B`, dan `02C` sudah diimplementasikan dan smoke ditutup |
| Phase 10 - Quality Gates | `done` | Baseline `lint`, `typecheck`, dan `build` sudah diformalkan dan lolos |
| Phase 11 - Larger Structural Moves | `deferred` | Menunggu fase aman selesai |

## Backlog by Risk

### Safe

| ID | Task | Status |
|---|---|---|
| S01 | Extract `AppLayout` tab registry | `done` |
| S02 | Extract `AppLayout` title map and permission map | `done` |
| S03 | Extract `MasterDataCtx` mapper functions by domain | `done` |
| S04 | Extract `MasterDataCtx` table fetch catalog | `done` |
| S05 | Extract lead social contact adapter | `done` |
| S06 | Centralize Edge Function base URL helpers | `done` |
| S07 | Centralize session-backed request header helper | `done` |
| S08 | Normalize shared service response typing | `done` |
| S09 | Extract workspace metadata constants | `done` |
| S10 | Split documentation-heavy decisions into per-domain notes | `not needed now` |

### Medium-Risk

- M01 API response normalization in frontend services
- M02 validation wrapper for selected Edge Function inputs
- M03 split `MasterDataCtx` into internal domain modules while keeping provider shape stable
- M04 wrap payroll writes behind service layer
- M05 consolidate ads integration config fetch logic
- M06 consolidate conversation service consumers
- M07 introduce domain-level read helpers/hooks
- M08 introduce logging helper for newly touched server modules

### High-Risk

- H01 replace `activeTab` navigation with route-driven navigation
- H02 change auth/session model
- H03 migrate to monorepo/package split
- H04 migrate to Next.js or server-first rendering
- H05 move all direct Supabase reads to API-only boundary
- H06 change visual design system output

## Execution Status

### Batch 01

Status: closed - implemented in code and smoke passed

Completed work:

- `Batch 01A` shell registry cleanup
- `Batch 01B` service helper foundation

Implemented outcome:

- `AppLayout` registry, permission map, page title map, dan workspace metadata dipisah ke modul internal
- helper Edge Function base URL, session-backed headers, dan shared service typing dipusatkan

Verification:

- `npm run build` passed
- smoke role-based `Owner`, `CS`, `Teknisi`, `Finance`, dan `Advertiser` passed via akun sementara
- unauthenticated root route `/` sekarang tervalidasi sampai `LoginPage` di browser headless
- public routes `/booking` dan `/payment-gateway-preview` sudah tervalidasi di browser headless
- localhost sanity check manual oleh user dinyatakan aman
- cleanup seluruh akun sementara tervalidasi di `File Review/artifacts/smoke-role-cleanup.json`

### Batch 02

Status: closed - implemented in code and smoke passed

Sub-batch status:

- `Batch 02A`: implemented in code
- `Batch 02B`: implemented in code
- `Batch 02C`: implemented in code

Completed work in `Batch 02A`:

- user mapper extraction
- master-data entity mapper extraction
- misc mapper extraction
- transaction mapper extraction
- lead mapper extraction

Completed work in `Batch 02B`:

- initial fetch catalog extraction
- grouped fetch descriptors for `masters`, `transactional`, and `support`

Completed work in `Batch 02C`:

- lead social network adapter extraction
- fetch, upsert, dan delete request untuk lead social dipusatkan ke modul internal

Implemented outcome:

- `MasterDataCtx.tsx` jauh lebih tipis di area mapper
- mapper sekarang hidup di `src/app/pages/master-data/context/internal/mappers/**`
- initial fetch table list sekarang hidup di `src/app/pages/master-data/context/internal/masterDataFetchCatalog.ts`
- request adapter lead social sekarang hidup di `src/app/pages/master-data/context/internal/leadSocialAdapter.ts`

Verification:

- `npm run build` passed
- smoke role-based `Owner`, `CS`, `Teknisi`, `Finance`, dan `Advertiser` passed via akun sementara
- unauthenticated root route `/` sekarang tervalidasi sampai `LoginPage` di browser headless
- public routes `/booking` dan `/payment-gateway-preview` sudah tervalidasi di browser headless
- localhost sanity check manual oleh user dinyatakan aman
- cleanup seluruh akun sementara tervalidasi di `File Review/artifacts/smoke-role-cleanup.json`

### Quality Gate Baseline

Status: done

Completed work:

- baseline `TypeScript` tooling ditambahkan
- baseline `ESLint` flat config ditambahkan untuk scope aman
- script `lint` dan `lint:fix` ditambahkan
- `typecheck` fokus ditambahkan lewat `tsconfig.typecheck.json`
- `typecheck:full` disiapkan sebagai audit yang lebih luas
- `vite-env` typing baseline ditambahkan
- warning duplicate `className` di `NotificationBell.tsx` dibersihkan
- typo penutup JSX di `OwnerAdsAnalytics.tsx` dibersihkan
- bootstrap auth di `AuthenticatedApp` dibuat fail-safe agar route `/` tidak menggantung tanpa batas di loader

Verification:

- `npm run lint` passed
- `npm run typecheck` passed
- `npm run build` passed
- routing upgrade smoke: `npm run smoke:routes` passed on `http://localhost:5174`
- authenticated role-route smoke script is available as `npm run smoke:role-routes`; latest run skipped because temporary user creation returned `Unauthorized`
- warning yang tersisa saat build tinggal warning chunk size dari Vite
- refresh verification terakhir dijalankan di branch `main` pada `2026-04-20`

## Current Stop Conditions

Pekerjaan harus pause dan minta approval user jika:

- mulai menyentuh UI/UX
- mulai menyentuh logic sistem
- provider API existing perlu diubah
- route behavior perlu diubah
- auth/session contract perlu diubah
- response semantics consumer-facing perlu diubah

## Performance Rule

Kalau targetnya juga menyelesaikan keluhan lemot di Chrome HP:

- jangan klaim ada perbaikan performa tanpa baseline
- jalankan baseline dulu sebelum task optimasi
- bedakan refactor struktur umum dari optimasi performa spesifik

Measurement priority:

1. login ke shell utama
2. dashboard
3. prospek
4. pesanan
5. unified ads monitoring
6. conversation live inbox
7. payroll
8. teknisi mobile

Hipotesis bottleneck awal:

- boot app memuat terlalu banyak data global lewat `MasterDataCtx`
- shell berbasis `activeTab` menahan state lebih luas dari yang diperlukan
- halaman besar membawa beban render tinggi
- live integration dan realtime update menambah noise
- host app dan Marketing OS menambah complexity dalam satu runtime

Latest baseline snapshot:

- cold public routes `/`, `/booking`, dan `/payment-gateway-preview` semuanya berada di sekitar `8 detik` cold start pada emulasi mobile
- login ke shell utama untuk `Owner` dan `Teknisi` berada di sekitar `17.4 detik`
- hotspot render terberat saat ini adalah `Monitoring Performance` lalu `Payroll & Komisi`
- evidence utama ada di [MOBILE-CHROME-PERFORMANCE-BASELINE.md](D:/Polesheadlamp.id/File%20Review/MOBILE-CHROME-PERFORMANCE-BASELINE.md) dan [mobile-chrome-performance-baseline.json](D:/Polesheadlamp.id/File%20Review/artifacts/mobile-chrome-performance-baseline.json)

## Immediate Next Actions

- gunakan [MOBILE-CHROME-PERFORMANCE-BASELINE.md](D:/Polesheadlamp.id/File%20Review/MOBILE-CHROME-PERFORMANCE-BASELINE.md) sebagai acuan sebelum optimasi performa
- prioritaskan profiling `login -> shell`, `Monitoring Performance`, dan `Payroll & Komisi`
- jika quality gate mau diperluas, evaluasi apakah scope `lint` perlu dibesarkan dari baseline aman sekarang
- jika mau lanjut arsitektur, review backlog `medium-risk` dengan guardrail yang sama
- jika mau upgrade URL dan struktur app profesional, mulai dari [PROFESSIONAL-APP-UPGRADE-PLAN.md](D:/Polesheadlamp.id/File%20Review/PROFESSIONAL-APP-UPGRADE-PLAN.md), [ROUTE-INVENTORY.md](D:/Polesheadlamp.id/File%20Review/ROUTE-INVENTORY.md), dan [modules/README.md](D:/Polesheadlamp.id/File%20Review/modules/README.md)

## Reference Documents

File pendukung sekarang dipisah agar folder utama lebih bersih:

- active docs di root `File Review`
- reference docs di `File Review/reference`

Active docs:

- [BLUEPRINT-EXECUTION-MASTER.md](D:/Polesheadlamp.id/File%20Review/BLUEPRINT-EXECUTION-MASTER.md)
- [PROFESSIONAL-APP-UPGRADE-PLAN.md](D:/Polesheadlamp.id/File%20Review/PROFESSIONAL-APP-UPGRADE-PLAN.md)
- [ROUTE-INVENTORY.md](D:/Polesheadlamp.id/File%20Review/ROUTE-INVENTORY.md)
- [NO-REGRESSION-CHECKLIST.md](D:/Polesheadlamp.id/File%20Review/NO-REGRESSION-CHECKLIST.md)
- [MOBILE-CHROME-PERFORMANCE-BASELINE.md](D:/Polesheadlamp.id/File%20Review/MOBILE-CHROME-PERFORMANCE-BASELINE.md)
- [modules/README.md](D:/Polesheadlamp.id/File%20Review/modules/README.md)

Reference docs:

- [BLUEPRINT-ADAPTATION-NOTES.md](D:/Polesheadlamp.id/File%20Review/reference/BLUEPRINT-ADAPTATION-NOTES.md)
- [CURRENT-ARCHITECTURE-MAP.md](D:/Polesheadlamp.id/File%20Review/reference/CURRENT-ARCHITECTURE-MAP.md)
- [BLUEPRINT-SECTION-MATRIX.md](D:/Polesheadlamp.id/File%20Review/reference/BLUEPRINT-SECTION-MATRIX.md)
- [TARGET-TECHNICAL-CONVENTIONS.md](D:/Polesheadlamp.id/File%20Review/reference/TARGET-TECHNICAL-CONVENTIONS.md)
- [NO-REGRESSION-CHECKLIST.md](D:/Polesheadlamp.id/File%20Review/NO-REGRESSION-CHECKLIST.md)
- [REFACTOR-BACKLOG.md](D:/Polesheadlamp.id/File%20Review/reference/REFACTOR-BACKLOG.md)
- [PERFORMANCE-BASELINE-PLAN.md](D:/Polesheadlamp.id/File%20Review/reference/PERFORMANCE-BASELINE-PLAN.md)
- [EXECUTION-BATCH-01-PLAN.md](D:/Polesheadlamp.id/File%20Review/reference/EXECUTION-BATCH-01-PLAN.md)
- [EXECUTION-BATCH-02-PLAN.md](D:/Polesheadlamp.id/File%20Review/reference/EXECUTION-BATCH-02-PLAN.md)
- [EXECUTION-READINESS-CHECKLIST.md](D:/Polesheadlamp.id/File%20Review/reference/EXECUTION-READINESS-CHECKLIST.md)

## Working Conclusion

Untuk pemakaian sehari-hari, buka file ini dulu.

Kalau butuh detail per area:

- baca appendix yang relevan
- tetap pakai guardrail no UI/UX change dan no logic change
- anggap `Batch 01` dan `Batch 02` sudah selesai dengan aman; route `/`, `/booking`, dan `/payment-gateway-preview` sudah tervalidasi, dan smoke role-based untuk `Owner`, `CS`, `Teknisi`, `Finance`, serta `Advertiser` juga sudah ditutup
