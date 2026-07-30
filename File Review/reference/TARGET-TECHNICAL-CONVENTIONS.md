# Target Technical Conventions for Polesheadlamp.id

Status: Reference conventions
Date: 2026-04-20
Scope: Target conventions for future execution
Document role: Supporting reference for technical rules and boundaries

## Purpose

Dokumen ini menetapkan aturan teknis target untuk repo `Polesheadlamp.id` berdasarkan:

- kondisi repo saat ini
- keputusan di `BLUEPRINT-SECTION-MATRIX.md`
- constraint bahwa belum ada perubahan UI/UX dan belum ada perubahan logic sistem

Tujuan dokumen ini adalah memberi standar implementasi nanti, bukan mengubah runtime sekarang.

## Hard Guardrails

Semua convention di bawah ini tunduk pada guardrail berikut:

- tidak ada perubahan UI/UX tanpa approval user
- tidak ada perubahan logic sistem tanpa approval user
- tidak ada rewrite stack tanpa keputusan eksplisit
- semua refactor awal harus mempertahankan output user-facing yang sama

## Stack Baseline to Preserve

Sampai ada keputusan lain, target implementasi tetap dibangun di atas stack saat ini:

- React 18
- Vite 6
- Tailwind CSS 4
- Supabase Auth, Postgres, Realtime, Storage
- Supabase Edge Functions
- Hono untuk server-side endpoint layer
- Cloudflare Pages untuk delivery frontend

Blueprint discipline boleh diambil. Stack blueprint tidak diadopsi mentah.

## System Boundary Conventions

### 1. Host app remains the primary runtime

`src/app` tetap dianggap sebagai host application utama.

Semua perubahan struktur harus menghormati kenyataan bahwa:

- auth gate hidup di host app
- shell navigasi utama hidup di host app
- permission dan master data utama hidup di host app

### 2. Marketing OS is an extension layer, not a separate product runtime

`src/marketing-os` diperlakukan sebagai extension layer di dalam host app.

Konvensinya:

- gunakan service, contract, dan data host app jika sudah ada
- jangan duplikasi domain logic yang sudah hidup stabil di host app
- workspace mock atau prototype harus ditandai jelas sebagai belum live

### 3. Edge Functions are the server logic boundary

Untuk area yang butuh:

- keamanan lebih tinggi
- akses secret
- validasi server-side
- integrasi pihak ketiga
- kontrol permission yang lebih tegas

maka boundary resminya adalah Supabase Edge Functions berbasis Hono.

## Routing and Shell Conventions

### 1. Current route behavior stays stable

Sampai ada approval eksplisit, browser route yang ada sekarang dianggap fixed:

- `/`
- `/booking`
- `/payment-gateway-preview`

Tidak ada perubahan route semantics saat fase awal refactor.

### 2. App shell remains the active navigation shell

`AppLayout` tetap diperlakukan sebagai shell runtime utama sampai ada keputusan lanjut.

Konvensi refactor:

- boleh merapikan struktur internal shell
- tidak boleh mengubah pengalaman navigasi user tanpa approval
- tidak boleh mengubah fallback access behavior tanpa approval

### 3. Route intent should still be documented

Meski browser route belum diubah, setiap domain penting harus punya dokumentasi:

- nama domain
- entry screen utama
- permission utama
- source data utama
- edge function yang dipakai

## Component Placement Conventions

### 1. `src/app/components/ui/`

Tujuan:

- primitive UI
- visual building blocks
- reusable visual wrappers

Aturan:

- tidak memanggil API
- tidak mengandung business flow
- tidak membaca Supabase langsung
- tidak memegang domain-specific permission logic

### 2. `src/app/components/layout/`

Tujuan:

- shell dan frame aplikasi
- container layout
- navigation frame

Aturan:

- boleh membaca state shell
- tidak boleh menjadi tempat penumpukan domain logic baru
- tidak boleh menambah query data domain baru jika tidak mutlak

### 3. `src/app/pages/**`

Tujuan:

- entry screen per domain
- composition layer untuk UI, service, dan state

Aturan target:

- page boleh menjadi orchestration layer
- domain helper, mapper, dan service jangan terus ditumpuk di satu file besar
- file page besar harus dipecah bertahap tanpa mengubah behavior

### 4. `src/app/services/**`

Tujuan:

- service wrapper
- domain helper untuk endpoint/server integration
- data transformation yang perlu dipakai ulang

Aturan:

- jadikan service sebagai tempat standar untuk request ke Edge Functions
- respons service harus typed sejauh memungkinkan
- error normalization sebaiknya hidup di layer ini, bukan tersebar di page

### 5. `src/marketing-os/shared/**`

Tujuan:

- shared contract
- adapter layer
- shared workspace UI

Aturan:

- pakai adapter ke host app, jangan duplikasi fetch logic jika bisa reuse
- tandai jelas area yang masih mock
- pisahkan contract workspace dari contract host bila memang berbeda

## Data Access Conventions

### 1. Allowed access patterns

Target jangka menengah untuk data access adalah:

- UI/page -> service/hook -> Supabase or Edge Function

Namun untuk legacy compatibility:

- akses langsung `supabase.from(...)` yang sudah ada tidak dirombak mendadak
- refactor dilakukan bertahap dan berbasis domain

### 2. Direct Supabase access rule

Direct Supabase access masih boleh untuk:

- legacy area yang belum direfactor
- query sederhana yang sudah stabil
- leaf domain dengan risiko rendah

Direct Supabase access sebaiknya tidak ditambah untuk:

- alur yang butuh secret
- alur yang butuh permission enforcement server-side
- integrasi pihak ketiga
- operasi lintas tabel yang sensitif

### 3. Edge Function usage rule

Gunakan Edge Function untuk:

- payment
- conversation and messaging integration
- ads live integration
- access config
- user or permission administration
- logic yang butuh env secret
- logic yang perlu validasi atau audit server-side

### 4. `MasterDataCtx` stability rule

Sebelum ada approval untuk refactor deeper:

- bentuk public provider dari `MasterDataCtx` tidak boleh berubah liar
- consumer existing tidak boleh dipaksa berubah massal
- domain baru jangan menambah beban lintas concern ke `MasterDataCtx` tanpa alasan kuat

### 5. New data access rule for future work

Untuk kode baru atau area refactor:

- hindari menambah generic helper baru yang makin memperbesar `MasterDataCtx`
- prefer service/domain module yang spesifik
- dokumentasikan source data setiap domain

## Permission and Auth Conventions

### 1. UI permission is not enough

Permission di UI dianggap:

- penting untuk visibility
- penting untuk navigation

tetapi bukan satu-satunya penjaga akses.

Untuk endpoint sensitif, kontrol server tetap harus ada.

### 2. Existing permission keys remain the source of truth

Gunakan:

- `src/app/data/permissions.ts`
- `usePermissions`

Jangan menambah literal role atau permission string di banyak tempat jika bisa reuse key existing.

### 3. Existing auth contract stays stable

Sampai ada keputusan lain:

- session model Supabase tetap dipakai
- inactivity timeout tetap dipertahankan
- header pattern current service calls tetap dihormati

Header convention yang sekarang dipakai di service layer:

- `Authorization: Bearer {publicAnonKey}`
- `x-client-token: {supabase session access token}`

### 4. No auth model migration without approval

Yang tidak boleh dilakukan tanpa approval eksplisit:

- mengganti storage/session model
- mengganti auth provider utama
- mengubah inactivity behavior
- mengubah login flow user-facing

## API Contract Conventions

### 1. Base path convention

Untuk endpoint internal utama, target boundary tetap:

- `functions/v1/make-server-f781cd00/...`

### 2. Response target for new or refactored endpoints

Untuk endpoint baru atau endpoint yang dirapikan nanti, target response shape:

- success: `{ "data": ..., "meta"?: ... }`
- error: `{ "error": { "code": string, "message": string, "details"?: unknown } }`

Catatan:

- endpoint lama tidak dipaksa diubah massal sekaligus
- kompatibilitas frontend existing tetap prioritas

### 3. Error handling convention

Target untuk endpoint server:

- jangan mengembalikan stack trace mentah ke client
- gunakan pesan yang aman untuk user
- simpan detail teknis di log server

### 4. Validation convention

Target untuk request masuk:

- validasi body, query, dan path sedekat mungkin ke function boundary
- untuk refactor bertahap, validation diprioritaskan pada endpoint sensitif lebih dulu

### 5. Versioning convention

Untuk perubahan besar yang bisa memutus consumer:

- jangan ubah endpoint existing diam-diam
- buat boundary atau subpath yang lebih jelas jika perlu perubahan breaking

## Realtime Conventions

### 1. Existing subscriptions stay stable during early refactor

Jangan mengubah daftar subscription existing tanpa alasan kuat dan verifikasi manual:

- `orders`
- `leads`
- `prospect_bookings`
- `profiles`

### 2. New realtime work should be domain-scoped

Jika nanti ada subscription baru:

- ikat ke domain yang jelas
- bersihkan subscription saat unmount
- hindari satu channel global baru yang makin membebani shell

### 3. Realtime noise should be measured before being changed

Untuk isu performa atau sync noise:

- ukur dulu
- dokumentasikan dulu
- jangan menghapus subscription hanya karena dugaan

## Database and Migration Conventions

### 1. Migration source of truth

Source of truth schema change tetap:

- `supabase/migrations`

### 2. Naming and review rules

Target convention:

- table and column names: snake_case
- migration file names: deskriptif dan berurutan
- relasi dan policy baru harus ditulis jelas di review

### 3. Safety rules

- tidak ada destructive schema change satu langkah tanpa staging plan
- tabel baru harus ditinjau RLS/policy-nya
- perubahan schema yang menyentuh domain kritis harus masuk no-regression review

## Logging and Observability Conventions

### 1. New code should move toward structured logging

Target jangka menengah:

- kurangi penyebaran `console.*` bebas
- arahkan logging baru ke helper yang lebih konsisten

### 2. Existing logs are not mass-rewritten during documentation phase

Karena constraint no-logic-change masih aktif:

- log existing tidak dibersihkan massal sekarang
- perubahan observability dilakukan bertahap saat task implementasi dimulai

### 3. User-facing errors should be normalized

Untuk area service dan endpoint:

- pesan untuk user harus jelas
- technical detail tetap disimpan untuk debugging

## Quality Gate Conventions

Target quality gate setelah fase dokumentasi:

- `typecheck`
- `lint`
- `build validation`
- targeted manual smoke test
- targeted automated test untuk domain kritis yang disentuh

Quality gate tidak ditambahkan massal sebelum task dan prioritasnya disepakati.

## Explicit Non-Goals

Dokumen ini bukan instruksi untuk:

- migrasi ke Next.js
- migrasi ke Turborepo
- mengganti auth model
- mengganti pola navigasi user
- redesign UI
- mengubah behavior bisnis

## Implementation Reading Order

Saat nanti masuk eksekusi, dokumen ini harus dibaca bersama:

- `CURRENT-ARCHITECTURE-MAP.md`
- `BLUEPRINT-SECTION-MATRIX.md`
- `NO-REGRESSION-CHECKLIST.md`
- `REFACTOR-BACKLOG.md`
