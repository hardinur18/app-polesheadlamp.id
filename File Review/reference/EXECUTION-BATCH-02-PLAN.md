# Execution Batch 02 Plan for Polesheadlamp.id

Status: Reference execution detail, closed - Batch 02 implemented in code and smoke passed
Date: 2026-04-20
Scope: Execution log for `Batch 02`, with all sub-batches implemented and smoke closed
Document role: Supporting execution detail for `Batch 02`

## Purpose

Dokumen ini menyiapkan batch eksekusi kedua untuk area `MasterDataCtx`, dan sekarang juga dipakai untuk mencatat progres implementasinya setelah semua sub-batch aman masuk ke kode.

Tujuannya:

- memecah file yang terlalu sentral menjadi struktur internal yang lebih mudah ditinjau
- menjaga agar provider shape tetap sama untuk consumer existing
- menyiapkan fondasi sebelum masuk ke refactor data layer yang lebih besar

`Batch 02A`, `Batch 02B`, dan `Batch 02C` sekarang sudah masuk ke kode dan smoke verification lintas domain untuk scope batch ini juga sudah ditutup.

## Dependency on Batch 01

Batch 02 sebaiknya dikerjakan setelah `Batch 01` lolos bersih.

Alasannya:

- pola ekstraksi helper dan registry dari Batch 01 akan jadi referensi untuk extraction di context
- helper service yang lebih rapi dari Batch 01 akan memudahkan penanganan area function fetch di `MasterDataCtx`
- `MasterDataCtx` punya blast radius lebih besar, jadi lebih aman disentuh setelah batch awal terbukti stabil

## Current Execution Snapshot

- [x] `Batch 02A` part 1: user dan master-data entity mapper extraction selesai.
- [x] `Batch 02A` part 2: misc mapper extraction selesai.
- [x] `Batch 02A` part 3: transaction dan lead mapper extraction selesai.
- [x] `Batch 02B` fetch catalog extraction selesai.
- [x] `Batch 02C` lead social adapter extraction selesai.
- [x] `npm run build` lolos setelah extraction yang sudah dikerjakan.
- [x] `npm run typecheck` baseline lolos untuk scope fokus yang sudah diformalkan.
- [x] Manual smoke checklist `Batch 02` sudah ditutup.

Implementation notes:

- File mapper yang sudah terbentuk: `userMappers.ts`, `masterDataEntityMappers.ts`, `miscMappers.ts`, `transactionMappers.ts`, dan `leadMappers.ts`.
- [MasterDataCtx.tsx](D:/Polesheadlamp.id/src/app/pages/master-data/context/MasterDataCtx.tsx) sekarang tinggal memanggil helper mapper dari modul internal.
- Initial fetch catalog sekarang dipusatkan di [masterDataFetchCatalog.ts](D:/Polesheadlamp.id/src/app/pages/master-data/context/internal/masterDataFetchCatalog.ts).
- Lead social request adapter sekarang dipusatkan di [leadSocialAdapter.ts](D:/Polesheadlamp.id/src/app/pages/master-data/context/internal/leadSocialAdapter.ts).

## Hard Guardrails

Batch ini tetap tunduk pada guardrail utama:

- tidak ada perubahan UI/UX
- tidak ada perubahan logic sistem
- tidak ada perubahan contract `useMasterData()` yang dirasakan consumer
- tidak ada perubahan hasil fetch, mutation, atau realtime event handling
- jika implementasi mulai menuntut perubahan provider API atau flow data user-facing, pekerjaan harus pause dan minta approval user

## Why This Is Batch 02

`MasterDataCtx.tsx` saat ini adalah pusat coupling terbesar di app:

- panjang file sekitar `1749` baris
- memegang state lintas banyak domain
- memegang mapper domain
- memegang generic CRUD helper
- memegang fetch waterfall awal
- memegang fetch ke Edge Function
- memegang auth sync
- memegang realtime subscription

Karena itu, target realistis untuk batch kedua bukan memecah provider secara total, tetapi:

- merapikan isi internalnya
- memisahkan concern yang sudah jelas
- menjaga provider shape tetap utuh

## Selected Tasks

Task yang masuk ke Batch 02:

- `S03` Extract `MasterDataCtx` mapper functions by domain
- `S04` Extract `MasterDataCtx` table fetch catalog
- `S05` Extract lead social contact adapter into dedicated service file

Task yang sengaja belum masuk Batch 02:

- `M03` Split `MasterDataCtx` into internal domain modules while keeping public provider shape stable
- perubahan realtime architecture
- perubahan access config contract
- perubahan generic CRUD contract

Alasan penundaan:

- `M03` masih satu level lebih berisiko
- batch ini difokuskan ke extraction yang benar-benar mechanical lebih dulu

## Batch Structure

### Batch 02A - Domain Mapper Extraction

Backlog IDs:

- `S03`

Target utama:

- memindahkan fungsi `map*FromDB` dan `map*ToDB` keluar dari `MasterDataCtx.tsx`
- mengelompokkan mapper per domain agar review lebih mudah

Current hotspots:

- branch, area, ad account, source, payment, role, platform, subchannel, affiliate, vendor, cancel reason
- lead, prospect booking, order
- WA template, daily ads, notification, technician schedule
- profile to user mapping masih hidup dekat auth sync logic

Suggested target files:

- `src/app/pages/master-data/context/internal/mappers/userMappers.ts`
- `src/app/pages/master-data/context/internal/mappers/masterDataMappers.ts`
- `src/app/pages/master-data/context/internal/mappers/leadMappers.ts`
- `src/app/pages/master-data/context/internal/mappers/orderMappers.ts`
- `src/app/pages/master-data/context/internal/mappers/miscMappers.ts`

Rules for this extraction:

- nama fungsi boleh tetap sama jika membantu diff kecil
- output mapper harus identik dengan sekarang
- import type tetap diarahkan ke type source yang sudah ada

Success condition:

- `MasterDataCtx.tsx` tidak lagi menjadi tempat semua mapper domain
- tidak ada perubahan bentuk object hasil mapping

### Batch 02B - Fetch Catalog Extraction

Backlog IDs:

- `S04`

Target utama:

- memisahkan daftar fetch awal menjadi katalog yang lebih eksplisit
- mengurangi daftar pemanggilan `fetchData(...)` yang panjang dan sulit dibaca

Current hotspots:

- fetch master tables masih inline di effect utama
- fetch transactional tables masih inline di effect utama
- fetch special cases seperti users, lead social contacts, audit logs, advertiser configs masih bercampur

Suggested target files:

- `src/app/pages/master-data/context/internal/masterDataFetchCatalog.ts`
- `src/app/pages/master-data/context/internal/masterDataTableGroups.ts`

Expected content:

- daftar tabel master
- daftar tabel transactional
- mapper yang dipakai per tabel jika ada
- catatan explicit untuk special fetch yang memang tidak boleh dimasukkan ke katalog generic

Explicitly not included in this batch:

- mengubah urutan fetch
- mengubah parallelism fetch
- mengganti `fetchData` ke mekanisme lain

Success condition:

- effect initial fetch lebih pendek dan lebih mudah dibaca
- urutan dan perilaku fetch tetap sama

### Batch 02C - Lead Social Adapter Extraction

Backlog IDs:

- `S05`

Target utama:

- memindahkan helper lead social contact keluar dari `MasterDataCtx`
- menjadikan special case ini sebagai service/adapter yang lebih jelas

Current hotspots:

- `LEAD_SOCIAL_MASTER_TYPE`
- `pickLeadSocialFields`
- `hasLeadSocialData`
- `mergeLeadSocialFields`
- `stripLeadSocialFields`
- `mapLeadSocialFromMaster`
- `fetchLeadSocialContacts`
- `upsertLeadSocialContact`
- `deleteLeadSocialContact`

Suggested target files:

- `src/app/pages/master-data/context/internal/leadSocialAdapter.ts`
- atau `src/app/services/leadSocialContactService.ts`

Preferred approach:

- pisahkan pure helpers dan fetch adapter
- pertahankan state update strategy yang sekarang
- jangan ubah fallback behavior saat delete atau fetch gagal

Success condition:

- logic lead social contact tidak lagi menumpuk di `MasterDataCtx`
- merge dan strip behavior tetap identik

## Suggested Write Scope

File yang paling mungkin disentuh saat implementasi:

- [MasterDataCtx.tsx](D:/Polesheadlamp.id/src/app/pages/master-data/context/MasterDataCtx.tsx)
- file baru di `src/app/pages/master-data/context/internal/**`
- mungkin [masterDataService.ts](D:/Polesheadlamp.id/src/app/services/masterDataService.ts) jika helper lead social lebih cocok reuse service layer, tetapi ini opsional

File yang sebaiknya tidak disentuh dalam batch ini kecuali benar-benar perlu:

- page consumer yang memakai `useMasterData()`
- `AppLayout`
- permission system
- Edge Functions
- routing layer

## Recommended Execution Order

Urutan kerja yang disarankan saat coding nanti:

1. Kerjakan `Batch 02A` lebih dulu.
2. Setelah mapper extraction stabil, kerjakan `Batch 02B`.
3. Kerjakan `Batch 02C` paling akhir karena ia menyentuh state update `leads`.
4. Jalankan smoke test domain setelah tiap sub-batch, bukan menunggu semuanya selesai.

Alasan urutan ini:

- mapper extraction paling mechanical
- fetch catalog extraction lebih aman setelah mapper sudah tidak inline
- lead social adapter punya potensi side effect paling terasa di domain leads

## Commit Strategy

Supaya review tetap kecil dan jelas, pembagian commit yang disarankan:

### Commit 1

`S03` part 1

Fokus:

- extract master-data mappers yang paling straightforward
- no behavioral change

### Commit 2

`S03` part 2

Fokus:

- extract lead, order, prospect booking, notification, dan schedule mappers

### Commit 3

`S04`

Fokus:

- katalog fetch dan grup tabel
- pertahankan urutan pemanggilan

### Commit 4

`S05`

Fokus:

- lead social adapter/service extraction
- pertahankan merge, delete, dan fallback behavior

## Verification Checklist for Batch 02

Gunakan [NO-REGRESSION-CHECKLIST.md](D:/Polesheadlamp.id/File%20Review/NO-REGRESSION-CHECKLIST.md), minimal item berikut:

- `App boot and auth`
- `Role and permission behavior`
- `Leads and prospects`
- `Orders and assignment`
- `Admin and master data`
- `Ads and marketing integrations`

Role minimum:

- Owner
- CS
- Advertiser
- Finance

Practical checks:

- lead list tetap termuat
- create/edit/delete lead tetap berfungsi
- social contact lead tetap terbaca
- prospect booking tetap masuk
- order list tetap termuat
- user management dan master data tetap terbuka
- access config advertiser tetap terbaca

## Done Criteria for Batch 02

Batch 02 dianggap selesai jika:

- mapper domain sudah dipindah dari `MasterDataCtx`
- fetch catalog sudah terdokumentasi dalam struktur internal yang jelas
- lead social adapter sudah dipisahkan dari body utama context
- provider value yang diexpose tetap sama
- consumer existing tidak perlu diubah
- tidak ada perubahan UI/UX
- tidak ada perubahan logic sistem

Current status:

- `Batch 02A`: done
- `Batch 02B`: done
- `Batch 02C`: done
- build verification: done for current extraction
- focused typecheck verification: done
- smoke verification: done

## Explicit Stop Conditions

Eksekusi batch harus pause dan minta approval user jika:

- provider shape `MasterDataContextType` perlu diubah
- consumer existing mulai harus diubah massal
- urutan fetch perlu diubah untuk membuat extraction berhasil
- realtime subscription perlu dirombak
- auth sync behavior perlu diubah

## What Comes After Batch 02

Jika Batch 02 lolos bersih, kandidat langkah berikutnya adalah:

- evaluasi `M03` untuk split internal module `MasterDataCtx`
- atau pindah dulu ke hardening service/API lewat `M01`
- atau formalkan quality gate berikutnya seperti baseline test minimum setelah smoke selesai

Pilihan yang paling aman kemungkinan:

- tutup smoke manual dulu
- selesaikan semua task `safe` dulu
- baru pertimbangkan `medium-risk` yang paling bernilai
