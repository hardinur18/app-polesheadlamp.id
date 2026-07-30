# Execution Batch 01 Plan for Polesheadlamp.id

Status: Reference execution detail, closed - implemented in code and smoke passed
Date: 2026-04-20
Scope: Internal-only execution log for `Batch 01`
Document role: Supporting execution detail for `Batch 01`

## Purpose

Dokumen ini menerjemahkan backlog `safe` menjadi batch eksekusi pertama yang konkret, dan sekarang juga dipakai sebagai catatan progres implementasinya.

Tujuannya:

- memilih task paling aman untuk memulai refactor internal
- menjaga agar batch pertama tetap zero UI/UX change dan zero logic change
- menyiapkan urutan kerja yang jelas saat implementasi dimulai

`Batch 01` sudah dieksekusi di level kode dan smoke checklist-nya juga sudah ditutup.

## Hard Guardrails

Batch ini tetap tunduk pada guardrail utama:

- tidak ada perubahan UI/UX
- tidak ada perubahan logic sistem
- tidak ada perubahan route behavior
- tidak ada perubahan auth flow
- jika implementasi mulai menyentuh salah satu area di atas, pekerjaan harus pause dan minta approval user

## Current Execution Snapshot

- [x] `Batch 01A` sudah diimplementasikan.
- [x] `Batch 01B` sudah diimplementasikan.
- [x] `npm run build` lolos setelah perubahan.
- [x] Manual smoke checklist `Batch 01A` dan `Batch 01B` sudah ditutup.
- [x] Sign-off final `Batch 01` sudah ditutup.

Implementation notes:

- `Batch 01A` mengekstrak registry tab, permission map, page title map, dan workspace metadata dari [AppLayout.tsx](D:/Polesheadlamp.id/src/app/components/layout/AppLayout.tsx).
- `Batch 01B` memusatkan helper Edge Function base URL, session-backed headers, dan shared service typing untuk service utama.

## Why This Is The First Batch

Batch pertama sebaiknya dimulai dari area yang:

- punya nilai perapihan tinggi
- blast radius relatif kecil
- mudah diverifikasi dengan smoke test
- menyiapkan fondasi untuk batch berikutnya

Karena itu, batch ini dipilih dari area:

- metadata shell internal di `AppLayout`
- helper service untuk Edge Function URL dan header auth

Area `MasterDataCtx` sengaja belum dijadikan batch pertama walaupun ada di `safe backlog`, karena file itu terlalu sentral dan blast radius-nya lebih besar.

## Selected Tasks

Task yang masuk ke Batch 01:

- `S01` Extract `AppLayout` tab registry into a dedicated config module
- `S02` Extract `AppLayout` title map and permission map
- `S06` Centralize Edge Function base URL helpers
- `S07` Centralize session-backed request header helper
- `S08` Normalize shared service response typing
- `S09` Extract workspace metadata constants for Marketing OS and conversation/ads workspaces

Task yang belum masuk Batch 01:

- `S03` Extract `MasterDataCtx` mapper functions by domain
- `S04` Extract `MasterDataCtx` table fetch catalog
- `S05` Extract lead social contact adapter into dedicated service file

Alasan penundaan:

- `MasterDataCtx` adalah pusat coupling besar
- perubahan di sana tetap aman, tetapi lebih cocok jadi batch kedua setelah helper shell dan service sudah rapi

## Batch Structure

### Batch 01A - Shell Registry Cleanup

Backlog IDs:

- `S01`
- `S02`
- `S09`

Target utama:

- mengurangi literal dan mapping yang menumpuk di [AppLayout.tsx](D:/Polesheadlamp.id/src/app/components/layout/AppLayout.tsx)
- memisahkan registry tab, title, permission, dan workspace metadata dari komponen shell utama

Current hotspots:

- `activeTab` state hidup di `AppLayout`
- `tabPermissions` masih inline
- switch tab dan workspace map masih bercampur dalam file yang sama
- AppLayout membaca `ADS_MONITORING_WORKSPACE_MAP`, `CONVERSATION_CENTER_WORKSPACE_MAP`, dan `MARKETING_OS_WORKSPACE_MAP` langsung

Suggested target files:

- `src/app/components/layout/appLayoutTabRegistry.ts`
- `src/app/components/layout/appLayoutTabPermissions.ts`
- `src/app/components/layout/appLayoutWorkspaceMeta.ts`

Expected touched files:

- [AppLayout.tsx](D:/Polesheadlamp.id/src/app/components/layout/AppLayout.tsx)
- [Sidebar.tsx](D:/Polesheadlamp.id/src/app/components/Sidebar.tsx) only if shell metadata extraction needs reuse there
- [adsMonitoringWorkspace.ts](D:/Polesheadlamp.id/src/app/pages/ads/adsMonitoringWorkspace.ts)
- [conversationWorkspace.ts](D:/Polesheadlamp.id/src/app/pages/conversations/conversationWorkspace.ts)
- [workspaces.ts](D:/Polesheadlamp.id/src/marketing-os/foundation/workspaces.ts)

Success condition:

- `AppLayout` menjadi lebih kecil dan lebih declarative
- semua `activeTab` string tetap sama
- semua permission key tetap sama
- shell masih menampilkan halaman yang sama seperti sebelumnya

### Batch 01B - Service Helper Foundation

Backlog IDs:

- `S06`
- `S07`
- `S08`

Target utama:

- menghapus duplikasi `functions base URL`
- menghapus duplikasi pola header `Authorization + x-client-token`
- menyiapkan typing response service yang lebih seragam tanpa mengubah payload runtime

Current hotspots:

- `conversationCenterService.ts`
- `googleAdsLiveService.ts`
- `liveAdsService.ts`
- `tiktokAdsLiveService.ts`
- `masterDataService.ts`
- `orderPaymentService.ts`

Evidence from current code:

- beberapa service membangun `https://${projectId}.supabase.co/functions/v1/make-server-f781cd00` sendiri
- beberapa service punya helper `getSessionAccessToken()` masing-masing
- pola header `Authorization: Bearer {publicAnonKey}` dan `x-client-token` berulang di banyak tempat

Suggested target files:

- `src/app/services/internal/functionsBaseUrl.ts`
- `src/app/services/internal/sessionClientHeaders.ts`
- `src/app/services/internal/serviceTypes.ts`

Expected touched files:

- [conversationCenterService.ts](D:/Polesheadlamp.id/src/app/services/conversationCenterService.ts)
- [googleAdsLiveService.ts](D:/Polesheadlamp.id/src/app/services/googleAdsLiveService.ts)
- [liveAdsService.ts](D:/Polesheadlamp.id/src/app/services/liveAdsService.ts)
- [tiktokAdsLiveService.ts](D:/Polesheadlamp.id/src/app/services/tiktokAdsLiveService.ts)
- [masterDataService.ts](D:/Polesheadlamp.id/src/app/services/masterDataService.ts)
- [orderPaymentService.ts](D:/Polesheadlamp.id/src/app/services/orderPaymentService.ts)

Explicitly out of scope for this batch:

- page-level fetches that still live in UI files such as `PayrollPage`, `MonitoringPage`, `TeknisiMobile`, `AffiliateList`, or `PublicBookingPage`
- auth model changes
- API contract changes
- response shape changes returned to consumers

Success condition:

- helper URL dan header dipakai ulang lintas service
- typing service lebih jelas
- tidak ada perubahan request path
- tidak ada perubahan header semantics
- tidak ada perubahan response semantics

## Recommended Execution Order

Urutan kerja yang disarankan saat coding nanti:

1. Kerjakan `Batch 01A` lebih dulu.
2. Pastikan smoke check shell dan permission lolos.
3. Baru kerjakan `Batch 01B`.
4. Lakukan smoke check service-driven screens setelah helper service dipusatkan.

Alasan urutan ini:

- `Batch 01A` lebih mudah dibatasi ke shell internal
- `Batch 01B` menyentuh lebih banyak file sekaligus walau masih aman
- kalau `Batch 01A` lolos bersih, kita punya momentum dan pattern extraction yang lebih jelas

## Commit Strategy

Supaya review lebih enak dan rollback tetap kecil jika ada masalah, pembagian commit yang disarankan:

### Commit 1

`S01` dan `S02`

Fokus:

- ekstraksi registry tab
- ekstraksi permission/title map
- no behavior change

### Commit 2

`S09`

Fokus:

- ekstraksi metadata workspace yang dipakai shell
- hindari mengubah definisi domain workspace yang sudah hidup

### Commit 3

`S06` dan `S07`

Fokus:

- helper base URL
- helper session-backed auth headers

### Commit 4

`S08`

Fokus:

- rapikan typing service
- pertahankan payload runtime apa adanya

## Verification Checklist for Batch 01A

Gunakan [NO-REGRESSION-CHECKLIST.md](D:/Polesheadlamp.id/File%20Review/NO-REGRESSION-CHECKLIST.md), minimal item berikut:

- `App boot and auth`
- `Theme and shell`
- `Role and permission behavior`
- `Ads and marketing integrations`
- `Conversations`
- `Marketing OS`

Role minimum:

- Owner
- CS
- Advertiser

Practical checks:

- app boot normal
- sidebar tetap sama
- menu label tetap sama
- fallback permission saat tab tidak diizinkan tetap sama
- workspace ads monitoring tetap bisa dibuka
- workspace conversation tetap bisa dibuka
- workspace marketing-os tetap bisa dibuka

## Verification Checklist for Batch 01B

Gunakan [NO-REGRESSION-CHECKLIST.md](D:/Polesheadlamp.id/File%20Review/NO-REGRESSION-CHECKLIST.md), minimal item berikut:

- `Ads and marketing integrations`
- `Conversations`
- `Payments and finance`
- `Admin and master data`

Role minimum:

- Owner
- Advertiser
- Finance

Practical checks:

- conversation center overview tetap termuat
- ads live / snapshot view tetap termuat
- payment service call tetap bekerja
- master data service call tetap bekerja
- tidak ada request yang berubah endpoint-nya tanpa sengaja

## Done Criteria for Batch 01

Batch 01 dianggap selesai jika:

- semua task yang dipilih selesai sesuai scope
- tidak ada perubahan UI/UX
- tidak ada perubahan logic sistem
- no-regression check yang relevan lolos
- file target menjadi lebih modular dan lebih mudah ditinjau

Current status:

- code implementation: done
- build verification: done
- smoke verification: done

## Explicit Stop Conditions

Eksekusi batch harus pause dan minta approval user jika:

- refactor shell mulai mengubah navigation behavior yang user rasakan
- refactor service menuntut perubahan auth contract
- ada kebutuhan mengganti response shape consumer-facing
- ada kebutuhan memindahkan flow dari page ke route browser
- ada kebutuhan menyentuh `MasterDataCtx` lebih dalam daripada scope batch ini

## What Comes After Batch 01

Jika Batch 01 lolos bersih, kandidat langkah berikutnya adalah:

- Batch 02 untuk `S03`, `S04`, dan `S05`
- baru setelah itu mempertimbangkan item `M01` atau `M03`

Urutan ini menjaga supaya `MasterDataCtx` baru disentuh setelah:

- helper service sudah lebih rapi
- shell registry sudah lebih stabil
- pattern extraction awal sudah terbukti aman
