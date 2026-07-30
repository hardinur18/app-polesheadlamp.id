# Professional App Upgrade Plan for Polesheadlamp.id

Status: Planning document
Date: 2026-05-01
Scope: Documentation-only preparation for professional routing, module boundaries, and future execution
Document role: Master plan for upgrading the current SPA into a more professional app structure without changing existing business logic

## Purpose

Dokumen ini menjawab kebutuhan upgrade aplikasi ke struktur yang lebih profesional tanpa membongkar sistem dan logic yang sudah berjalan.

Targetnya adalah:

- membuat URL aplikasi mengikuti fitur atau halaman aktif
- memisahkan tanggung jawab per modul secara bertahap
- menjaga behavior existing tetap sama selama migrasi
- menyediakan markdown per modul sebagai pegangan kerja
- membuat proses upgrade bisa dicek, dicicil, dan di-rollback lebih aman

Dokumen ini tidak mengubah runtime. Ini adalah peta kesiapan sebelum implementasi.

## Current Problem

Saat ini aplikasi sudah memakai React, Vite, React Router, Supabase, dan struktur folder yang cukup matang. Namun navigasi internal utama masih dikendalikan oleh state `activeTab` di `AppLayout`.

Akibatnya:

- URL browser sering tetap statis di root domain
- link spesifik ke modul sulit dibagikan
- refresh halaman bisa kembali ke tab default
- tombol back dan forward browser belum terasa natural
- route seperti `/login` belum menjadi route login resmi
- banyak fitur besar masih bertemu di shell utama

Ini bukan bug fatal. Ini adalah tanda aplikasi dashboard internal yang tumbuh menjadi platform operasional.

## Upgrade Principle

Upgrade harus mengikuti prinsip berikut:

- no rewrite
- no sudden logic change
- no UI redesign unless approved
- no auth behavior change unless approved
- no permission behavior change unless approved
- no data contract change without verification
- every module migration must have a fallback path

Tujuan awal bukan mengganti sistem lama, tetapi membuat wrapper profesional di sekeliling sistem yang sudah stabil.

## Target App Shape

Target jangka menengah:

```txt
/login
/dashboard
/leads
/orders
/schedule
/technician/mobile
/monitoring
/map
/ads/daily
/ads/monitoring
/conversations/inbox
/finance/payments
/finance/debts
/finance/payroll
/inventory/products
/master-data
/users
/settings/roles
/marketing-os/command-center
/marketing-os/ads-monitoring
/marketing-os/conversation-hub
```

Target ini tidak berarti semua page harus langsung dipindah sekaligus. Path di atas adalah route intent yang akan dijadikan acuan migrasi.

## What Must Be Prepared

### 1. Route Registry

Siapkan registry route terpusat yang memetakan:

- route path
- tab id existing
- page title
- permission key
- component
- layout mode
- redirect fallback

Tujuannya agar `activeTab` lama dan URL baru bisa hidup berdampingan dulu.

### 2. URL-to-Tab Adapter

Karena sistem sekarang memakai `activeTab`, perlu adapter yang bisa:

- membaca URL
- menentukan tab yang sesuai
- memanggil flow render lama
- menjaga permission behavior existing
- mengarahkan URL lama ke URL baru secara aman jika dibutuhkan

Adapter ini adalah bridge, bukan rewrite.

### 3. Tab-to-URL Navigation

Sidebar dan tombol navigasi internal perlu diarahkan bertahap dari:

```ts
setActiveTab('orders')
```

menjadi:

```ts
navigate('/orders')
```

Namun pada fase transisi, keduanya tetap perlu sinkron.

### 4. Module Documentation

Setiap modul perlu markdown sendiri berisi:

- purpose
- current entry files
- target route
- permission
- data sources
- service/API boundary
- shared dependencies
- migration risk
- no-regression checklist

Dokumen modul disimpan di:

```txt
File Review/modules/
```

### 5. Permission Contract Review

Sebelum route-driven navigation diterapkan, setiap route harus jelas permission-nya.

Yang perlu dicek:

- route mana yang public
- route mana yang auth-only
- route mana yang role/permission-specific
- fallback route jika permission ditolak
- behavior khusus Teknisi

### 6. Auth Route Contract

Route `/login` perlu diformalkan.

Target behavior:

- user belum login membuka `/login` melihat login page
- user sudah login membuka `/login` diarahkan ke default app page
- user belum login membuka route internal diarahkan atau ditampilkan login sesuai keputusan product
- logout kembali ke login/root dengan behavior yang konsisten

### 7. Public Route Contract

Route public yang sudah ada harus tetap aman:

- `/booking`
- `/payment-gateway-preview`

Keduanya tidak boleh ikut terpengaruh oleh route app internal.

### 8. Module Boundary Cleanup

Setiap modul perlu batas yang makin jelas:

- page sebagai composition layer
- service sebagai data/API layer
- mapper/helper sebagai internal domain utility
- shared UI hanya untuk komponen reusable
- permission tidak tersebar sebagai string literal liar

### 9. Quality Gate

Setiap batch route/module upgrade minimal harus melewati:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run smoke:routes` untuk route/public fallback smoke
- `npm run smoke:role-routes` untuk authenticated route smoke jika kredensial test tersedia
- smoke test login
- smoke test public route
- smoke test role utama yang terdampak

### 10. Rollback Plan

Karena route upgrade menyentuh pengalaman navigasi, setiap batch harus bisa dikembalikan dengan jelas.

Minimal yang perlu disiapkan:

- daftar file yang diubah
- route lama dan route baru
- expected redirect
- smoke evidence
- fallback ke `activeTab` lama jika ada blocker

## Recommended Execution Phases

### Phase A - Documentation and Route Inventory

Status: in progress

Status target: safe

Output:

- master upgrade plan
- module markdown index
- markdown per modul
- route intent map
- permission inventory

Tidak ada perubahan runtime.

Current output:

- [ROUTE-INVENTORY.md](D:/Polesheadlamp.id/File%20Review/ROUTE-INVENTORY.md)
- [modules/README.md](D:/Polesheadlamp.id/File%20Review/modules/README.md)
- per-module notes in `File Review/modules/`

### Phase B - Route Registry Preparation

Status: started

Status target: low to medium risk

Output:

- route definition object
- mapping route path ke tab id
- mapping tab id ke route path
- helper untuk page title dan permission

Behavior user-facing belum berubah.

Current output:

- `src/app/routing/appRouteRegistry.ts`

### Phase C - Login and Public Route Formalization

Status: implemented

Status target: medium risk

Output:

- `/login` route resmi
- redirect rule untuk logged-in dan logged-out user
- public route tetap stabil

Perlu smoke test.

Current output:

- `/login` is now an explicit browser route
- short internal routes are now explicit authenticated app route branches
- `public/_redirects` preserves SPA fallback behavior on Cloudflare Pages
- logged-in users opening `/login` are redirected to `/dashboard`
- logged-out users still see the existing `LoginPage`
- public routes are unchanged

### Phase D - Internal Route Bridge

Status: started

Status target: medium to high risk

Output:

- URL bisa membuka modul tertentu
- `activeTab` masih menjadi compatibility layer
- refresh page mempertahankan modul aktif
- browser back/forward mulai bekerja

Perlu smoke test lintas role.

Current output:

- `AppLayout` now reads route registry paths and initializes or syncs the matching `activeTab`
- direct internal paths can enter the existing tab render flow
- sidebar and bottom nav are not route-driven yet

### Phase E - Sidebar Navigation Upgrade

Status: implemented at shell boundary

Status target: high risk

Output:

- sidebar memakai route navigation
- bottom nav memakai route navigation
- old tab navigation tetap didukung untuk callback internal

Perlu validasi visual dan permission.

Current output:

- sidebar navigation now flows through the route registry
- bottom navigation now flows through the route registry
- notification navigation and selected internal callbacks now use the same route-aware handler
- `activeTab` remains as the compatibility layer for rendering existing modules

### Phase F - Module-by-Module Boundary Upgrade

Status target: incremental

Output:

- modul besar dipisah secara internal
- data access makin jelas
- service dan hook domain dipakai lebih konsisten
- `MasterDataCtx` tidak makin membesar

Dilakukan satu modul per batch.

## Migration Risk Ranking

### Lower Risk

- route inventory
- documentation
- page title mapping
- route constants
- module markdown
- helper pure function

### Medium Risk

- `/login` formalization
- redirect behavior
- public route handling
- URL-to-tab adapter
- tab-to-url adapter

### Higher Risk

- replacing sidebar navigation
- changing `AppLayout` render flow
- splitting `MasterDataCtx` provider shape
- changing auth/session flow
- changing permission fallback behavior
- moving direct Supabase access behind API in bulk

## Module Documentation Index

Module docs live in:

- [modules/README.md](D:/Polesheadlamp.id/File%20Review/modules/README.md)

Route inventory:

- [ROUTE-INVENTORY.md](D:/Polesheadlamp.id/File%20Review/ROUTE-INVENTORY.md)

Primary module docs:

- [00-route-and-shell.md](D:/Polesheadlamp.id/File%20Review/modules/00-route-and-shell.md)
- [01-auth-and-access.md](D:/Polesheadlamp.id/File%20Review/modules/01-auth-and-access.md)
- [02-dashboard.md](D:/Polesheadlamp.id/File%20Review/modules/02-dashboard.md)
- [03-leads-and-prospects.md](D:/Polesheadlamp.id/File%20Review/modules/03-leads-and-prospects.md)
- [04-orders-and-scheduling.md](D:/Polesheadlamp.id/File%20Review/modules/04-orders-and-scheduling.md)
- [05-technician-operations.md](D:/Polesheadlamp.id/File%20Review/modules/05-technician-operations.md)
- [06-finance-and-payments.md](D:/Polesheadlamp.id/File%20Review/modules/06-finance-and-payments.md)
- [07-inventory.md](D:/Polesheadlamp.id/File%20Review/modules/07-inventory.md)
- [08-ads-and-marketing.md](D:/Polesheadlamp.id/File%20Review/modules/08-ads-and-marketing.md)
- [09-conversations.md](D:/Polesheadlamp.id/File%20Review/modules/09-conversations.md)
- [10-admin-and-master-data.md](D:/Polesheadlamp.id/File%20Review/modules/10-admin-and-master-data.md)
- [11-marketing-os.md](D:/Polesheadlamp.id/File%20Review/modules/11-marketing-os.md)
- [12-public-surfaces.md](D:/Polesheadlamp.id/File%20Review/modules/12-public-surfaces.md)

## Immediate Next Decision

Sebelum implementasi route dimulai, keputusan yang perlu dikunci:

1. Apakah URL target memakai prefix `/app/*` untuk semua halaman internal?
   Decision: tidak. Canonical route memakai URL pendek tanpa `/app`.
2. Apakah `/` setelah login diarahkan ke `/dashboard` atau tetap menjadi host shell?
3. Apakah user belum login yang membuka route internal diarahkan ke `/login` atau tetap melihat login page di URL yang sama?
4. Apakah route lama yang tidak dikenal tetap fallback ke shell atau diarahkan ke halaman default?

Rekomendasi awal:

- pakai URL pendek untuk semua halaman internal
- pertahankan `/app/*` sebagai legacy compatibility route selama transisi, lalu canonicalize ke URL pendek
- jadikan `/login` route resmi
- jadikan `/` smart entry: logged out ke login, logged in ke dashboard/default role
- pertahankan fallback `*` selama transisi agar link lama tidak mati

## Working Conclusion

Upgrade profesional yang paling aman adalah route-first secara bertahap, bukan rewrite.

`activeTab` tidak langsung dibuang. Ia dijadikan compatibility layer sampai semua modul punya route, permission, dan fallback yang jelas.
