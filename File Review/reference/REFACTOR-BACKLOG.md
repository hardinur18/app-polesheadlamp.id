# Refactor Backlog for Polesheadlamp.id

Status: Reference backlog
Date: 2026-04-20
Scope: Prepared task list before execution
Document role: Supporting reference for task inventory and risk grouping

## Purpose

Dokumen ini adalah daftar task refactor yang disusun sebelum eksekusi dimulai.

Tujuannya:

- membuat urutan kerja nanti jelas
- memisahkan task aman dari task berisiko
- menjaga agar implementasi awal tetap sesuai constraint no UI/UX change dan no logic change

## Backlog Rules

- task `safe` ditujukan untuk perapihan internal dengan target zero behavior change
- task `medium-risk` butuh no-regression verification ketat
- task `high-risk` tidak boleh dikerjakan tanpa approval eksplisit user

## Safe Backlog

| ID | Task | Scope | Why it matters | Dependency |
|---|---|---|---|---|
| S01 | Extract `AppLayout` tab registry into a dedicated config module | Frontend shell internal only | Mengurangi switch dan map yang menumpuk di satu file | `CURRENT-ARCHITECTURE-MAP.md` |
| S02 | Extract `AppLayout` title map and permission map | Frontend shell internal only | Mengurangi coupling visual shell vs permission routing | S01 |
| S03 | Extract `MasterDataCtx` mapper functions by domain | Frontend data layer internal only | Mengurangi ukuran file dan membuat mapping lebih mudah ditinjau | Architecture map |
| S04 | Extract `MasterDataCtx` table fetch catalog | Frontend data layer internal only | Membuat daftar source data lebih eksplisit dan tidak tersebar | S03 |
| S05 | Extract lead social contact adapter into dedicated service file | Leads domain internal only | Mengurangi special-case logic di context utama | S03 |
| S06 | Centralize Edge Function base URL helpers | Service layer only | Saat ini ada beberapa service yang membangun URL serupa | None |
| S07 | Centralize session-backed request header helper | Service layer only | Mengurangi duplikasi `Authorization + x-client-token` pattern | S06 |
| S08 | Normalize shared service response typing | Service layer only | Mengurangi `any` dan memudahkan audit contract tanpa ubah behavior | S06 |
| S09 | Extract workspace metadata constants for Marketing OS and conversation/ads workspaces | Shell and workspace metadata only | Mengurangi literal yang tersebar di shell | None |
| S10 | Split documentation-heavy decisions into per-domain notes | Docs only | Memudahkan eksekusi bertahap per domain | None |

## Medium-Risk Backlog

| ID | Task | Scope | Risk | Why it matters | Dependency |
|---|---|---|---|---|---|
| M01 | Introduce API response normalization in frontend services | Service layer | Medium | Membuat service layer lebih konsisten walau backend masih campur | Target conventions |
| M02 | Add validation wrapper for selected Edge Function inputs | Backend function boundary | Medium | Mengurangi error liar dan input tidak tervalidasi | Blueprint matrix, no-regression |
| M03 | Split `MasterDataCtx` into internal domain modules while keeping public provider shape stable | Frontend data layer | Medium | Mengurangi coupling tanpa memaksa consumer berubah besar-besaran | S03, S04 |
| M04 | Wrap payroll write operations behind service layer | Finance/payroll | Medium | Saat ini payroll bersifat hybrid dan cukup sensitif | No-regression |
| M05 | Consolidate ads integration config fetch logic | Marketing and master data | Medium | Meta, Google, dan TikTok config flow cukup menyebar | S06, S07 |
| M06 | Consolidate conversation service consumers | Conversation domain | Medium | Mengurangi perbedaan perilaku antar consumer host app dan Marketing OS | S06, S07 |
| M07 | Introduce domain-level read helpers or hooks for major modules | Leads, orders, finance, inventory | Medium | Mengurangi direct table access yang semakin liar | Target conventions |
| M08 | Introduce logging helper for newly touched server modules | Edge Functions | Medium | Menyiapkan observability tanpa rewrite massal | Target conventions |

## High-Risk Backlog

| ID | Task | Scope | Why high-risk | Approval needed |
|---|---|---|---|---|
| H01 | Replace `activeTab` navigation with route-driven browser navigation | App shell and user navigation | Berpotensi mengubah UX, deep-linking, and permission fallback behavior | Yes |
| H02 | Change auth/session model | App-wide | Menyentuh login, logout, permission, inactivity, and service headers | Yes |
| H03 | Migrate to monorepo/package split | Repo-wide | Mengubah build, import, delivery, dan developer workflow | Yes |
| H04 | Migrate to Next.js or server-first rendering model | Repo-wide | Ini rewrite arsitektur, bukan refactor aman | Yes |
| H05 | Move all direct Supabase reads to API-only boundary | App-wide | Berisiko mengubah loading, caching, and permission behavior | Yes |
| H06 | Change visual design system output | UI-wide | Menyentuh UI/UX secara langsung | Yes |

## Suggested Execution Order

### Batch A - safest start

- S01
- S02
- S03
- S04
- S06
- S07
- S08
- S09

### Batch B - still internal, but needs stronger review

- S05
- M01
- M03
- M05
- M06

### Batch C - domain-sensitive cleanup

- M02
- M04
- M07
- M08

### Batch D - approval-only items

- all `H*` items

## Definition of Ready Before Execution

Eksekusi baru dianggap siap bila:

- `BLUEPRINT-SECTION-MATRIX.md` selesai
- `TARGET-TECHNICAL-CONVENTIONS.md` selesai
- `NO-REGRESSION-CHECKLIST.md` selesai
- backlog ini disetujui sebagai dasar kerja

## Definition of Done for a Safe Refactor Task

Sebuah task `safe` baru dianggap selesai bila:

- code internal lebih rapi atau boundary lebih jelas
- output UI sama
- logic bisnis sama
- no-regression checklist yang relevan lolos
- tidak ada perubahan yang diam-diam menyentuh approval-only area

## Not in Scope Until Approved

Yang tetap tidak boleh dikerjakan tanpa approval:

- perubahan layout
- perubahan alur user
- perubahan behavior permission
- perubahan auth flow
- perubahan business rule
- perubahan stack besar
