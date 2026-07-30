# Technical OpenClaw Marketing OS

## 1. Tujuan Dokumen

Dokumen ini menjelaskan kontrak teknis OpenClaw Marketing OS berdasarkan kode yang benar-benar ada saat ini di project `Polesheadlamp.id`.

Fokus dokumen ini:

- field data yang memang sudah dipakai di frontend dan backend
- endpoint yang memang sudah tersedia
- status implementasi per modul
- gap antara visi produk dan kode saat ini

Dokumen ini sengaja memisahkan:

- `sudah diimplementasikan`
- `sebagian diimplementasikan`
- `belum diimplementasikan`

agar tim tidak mencampur antara fitur yang sudah hidup dan fitur yang masih visi.

Dokumen ini harus dibaca bersama:

- `Blueprint OpenClaw Marketing OS.md`
- `Microfrontend Architecture OpenClaw Marketing OS.md`
- `UI OpenClaw Marketing OS.md`

## 1.1 Posisi Teknis di Host System

Secara teknis, OpenClaw saat ini bukan aplikasi baru yang berdiri di luar sistem host.

OpenClaw berada di atas fondasi teknis yang sudah ada:

- frontend React + Vite yang sudah berjalan
- Supabase Auth yang sudah dipakai sistem utama
- tabel, master data, lead, order, dan role yang sudah ada
- edge function server yang sudah menjadi backend integrasi utama

Karena itu dokumen teknis ini harus dibaca dengan asumsi:

- implementasi baru sedapat mungkin menempel ke kontrak entity yang sudah ada
- route, auth, dan permission tidak dipecah tanpa alasan kuat
- OpenClaw boleh punya service, route, atau UI sendiri, tetapi source of truth tetap sistem host

## 1.2 Keputusan Boundary Frontend

Untuk tahap ini, `Marketing OS` dikunci sebagai workspace khusus dengan boundary frontend yang mandiri.

Artinya:

- UI Marketing OS boleh memakai framework atau stack frontend yang berbeda dari host app
- tetapi ia tetap wajib membaca auth yang sama
- tetap wajib membaca permission yang sama
- tetap wajib memakai kontrak API yang sama atau kompatibel
- tetap wajib memakai source of truth yang sama
- tetap wajib menulis audit trail ke jalur yang sama

Implikasi teknis:

- domain entity tidak boleh dipecah
- session user tidak boleh diduplikasi
- token visual boleh berbeda, tetapi identity contract tidak boleh berbeda
- route frontend boleh dipisah, tetapi backend orchestration tetap satu

Catatan implementasi:

- pembacaan arsitektur final mengikuti `4 layer` di `Microfrontend Architecture OpenClaw Marketing OS.md`
- `Marketing OS` boleh menjadi route-level microfrontend
- tetapi jalur backend, arti entity, audit trail, dan kontrak integrasi tetap shared

## 2. Status Modul Saat Ini

### 2.1 API Iklan

- `Meta Ads`: sudah diimplementasikan
- `Google Ads`: sudah diimplementasikan
- `TikTok Ads`: sudah diimplementasikan

### 2.2 API Percakapan

- `Instagram DM`: sudah diimplementasikan
- `Messenger`: sudah diimplementasikan
- `WhatsApp`: sebagian diimplementasikan
- `TikTok DM`: belum diimplementasikan

### 2.3 Otomasi Order

- `model data prospect booking`: sudah diimplementasikan
- `CRUD order`: sudah diimplementasikan
- `helper rute / jarak`: sudah diimplementasikan sebagai logika pendukung
- `AI membuat order otomatis dari chat`: belum diimplementasikan
- `AI assign cabang / teknisi otomatis`: belum diimplementasikan

### 2.4 Kemampuan Diagnostik Visual AI

- `upload foto dan referensi penyimpanan pada order`: sudah diimplementasikan
- `AI diagnosis dari foto headlamp`: belum diimplementasikan

Catatan:

- ini bukan modul UI khusus yang berdiri sendiri
- secara teknis kemampuan ini nantinya menempel pada alur percakapan customer, media attachment, dan data order / inspeksi

## 3. Sumber Kebenaran Saat Ini

### 3.1 Service Layer Frontend

Sumber utama kontrak frontend:

- [liveAdsService.ts](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/src/app/services/liveAdsService.ts)
- [googleAdsLiveService.ts](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/src/app/services/googleAdsLiveService.ts)
- [tiktokAdsLiveService.ts](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/src/app/services/tiktokAdsLiveService.ts)
- [conversationCenterService.ts](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/src/app/services/conversationCenterService.ts)

### 3.2 Route Backend

Sumber utama route backend:

- [index.tsx](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/supabase/functions/server/index.tsx)
- [meta_messaging.tsx](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/supabase/functions/server/meta_messaging.tsx)
- [google_ads.tsx](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/supabase/functions/server/google_ads.tsx)
- [tiktok_ads.tsx](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/supabase/functions/server/tiktok_ads.tsx)

### 3.3 Model Data Order dan Operasional

Sumber utama order dan booking:

- [data.ts](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/src/app/pages/master-data/data.ts)
- [MasterDataCtx.tsx](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/src/app/pages/master-data/context/MasterDataCtx.tsx)
- [mapUtils.ts](/Users/macbookair/Windsurf/_tmp/Polesheadlamp.id/src/utils/mapUtils.ts)

## 4. Field API Iklan

## 4.1 Meta Ads

### Endpoint yang sudah ada

- `GET /make-server-f781cd00/meta/live-breakdown`
- `GET /make-server-f781cd00/meta/snapshots`
- `POST /make-server-f781cd00/meta/sync-snapshots`
- `GET /make-server-f781cd00/meta/integration-configs`
- `POST /make-server-f781cd00/meta/integration-configs/:adAccountId`

### Field response live yang dipakai frontend

`MetaLiveBusinessSnapshot`

- `id`
- `name`
- `verificationStatus`
- `accountCount`
- `spend`
- `clicks`
- `impressions`
- `reach`

`MetaLiveAccountSnapshot`

- `id`
- `accountId`
- `name`
- `businessId`
- `businessName`
- `accountStatus`
- `currency`
- `spend`
- `clicks`
- `impressions`
- `reach`
- `cpc`
- `ctr`
- `cpm`
- `cpp`
- `dateStart`
- `dateStop`
- `error`

`MetaLiveBreakdownResponse.summary`

- `businessCount`
- `accountCount`
- `spend`
- `clicks`
- `impressions`
- `reach`

### Field response snapshot yang dipakai frontend

`MetaSnapshotRow`

- `id`
- `platformKey`
- `snapshotDate`
- `internalAdAccountId`
- `advertiserId`
- `platformId`
- `externalAccountId`
- `externalAccountName`
- `externalGroupId`
- `externalGroupName`
- `externalAccountStatus`
- `currencyCode`
- `spend`
- `clicks`
- `impressions`
- `reach`
- `conversions`
- `ctr`
- `cpc`
- `cpm`
- `costPerConversion`
- `error`
- `syncedAt`

### Status implementasi

- live fetch: sudah
- snapshot DB: sudah
- integration config: sudah
- direct frontend fallback untuk localhost: sudah
- mutation otomatis / ubah budget: belum

## 4.2 Google Ads

### Endpoint yang sudah ada

- `GET /make-server-f781cd00/google/token-health`
- `GET /make-server-f781cd00/google/live-breakdown`
- `GET /make-server-f781cd00/google/snapshots`
- `POST /make-server-f781cd00/google/sync-snapshots`
- `GET /make-server-f781cd00/google/integration-configs`
- `POST /make-server-f781cd00/google/integration-configs/:adAccountId`

### Field response live yang dipakai frontend

`GoogleAdsLiveManagerSnapshot`

- `id`
- `name`
- `accountCount`
- `spend`
- `clicks`
- `impressions`
- `conversions`

`GoogleAdsLiveAccountSnapshot`

- `customerId`
- `customerName`
- `name`
- `managerCustomerId`
- `managerCustomerName`
- `currencyCode`
- `status`
- `isManager`
- `spend`
- `clicks`
- `impressions`
- `conversions`
- `ctr`
- `cpc`
- `cpm`
- `costPerConversion`
- `dateStart`
- `dateStop`
- `error`

`GoogleAdsLiveBreakdownResponse.metadata`

- `apiVersion`
- `loginCustomerId`
- `accessibleCustomerCount`

### Field response token health

`GoogleAdsTokenHealthResponse`

- `ok`
- `checkedAt`
- `apiVersion`
- `error`
- `configured.developerToken`
- `configured.clientId`
- `configured.clientSecret`
- `configured.refreshToken`
- `configured.loginCustomerId`
- `configured.scopedCustomerIds`
- `accessibleCustomerCount`
- `accessibleCustomerIds`
- `metadata.source`
- `metadata.expiresInSeconds`

### Field response snapshot

`GoogleAdsSnapshotRow`

- `id`
- `platformKey`
- `snapshotDate`
- `internalAdAccountId`
- `advertiserId`
- `platformId`
- `externalAccountId`
- `externalAccountName`
- `externalGroupId`
- `externalGroupName`
- `externalAccountStatus`
- `currencyCode`
- `spend`
- `clicks`
- `impressions`
- `reach`
- `conversions`
- `ctr`
- `cpc`
- `cpm`
- `costPerConversion`
- `error`
- `syncedAt`

`GoogleAdsSnapshotDatasetResponse.metadata`

- `rowCount`
- `lastSyncedAt`
- `upsertedCount`
- `servedFrom`
- `skippedSync`
- `fallbackSnapshotDate`
- `rateLimited`
- `retryAfterSeconds`
- `cooldownMessage`

### Status implementasi

- live fetch: sudah
- snapshot DB: sudah
- handling cooldown rate limit: sudah
- integration config: sudah
- mutation otomatis / optimizer execution: belum

## 4.3 TikTok Ads

### Endpoint yang sudah ada

- `GET /make-server-f781cd00/tiktok/token-health`
- `GET /make-server-f781cd00/tiktok/authorize-url`
- `POST /make-server-f781cd00/tiktok/exchange-code`
- `GET /make-server-f781cd00/tiktok/advertisers`
- `GET /make-server-f781cd00/tiktok/business-centers`
- `GET /make-server-f781cd00/tiktok/business-centers/:bcId/assets`
- `GET /make-server-f781cd00/tiktok/live-breakdown`
- `GET /make-server-f781cd00/tiktok/snapshots`
- `POST /make-server-f781cd00/tiktok/sync-snapshots`
- `GET /make-server-f781cd00/tiktok/integration-configs`
- `POST /make-server-f781cd00/tiktok/integration-configs/:adAccountId`

### Field registry entitas yang dipakai frontend

`TikTokBusinessCenter`

- `bcId`
- `bcName`
- `raw`

`TikTokAdvertiser`

- `advertiserId`
- `advertiserName`
- `currency`
- `status`
- `timezone`
- `bcId`
- `bcName`
- `raw.authorized`
- `raw.info`

### Field response token health

`TikTokAdsTokenHealthResponse`

- `ok`
- `checkedAt`
- `apiVersion`
- `error`
- `configured.appId`
- `configured.appSecret`
- `configured.redirectUri`
- `token.appId`
- `token.exchangedAt`
- `token.accessTokenAvailable`
- `token.refreshTokenAvailable`
- `token.advertiserIds`
- `token.scope`
- `token.expiresInSeconds`
- `token.refreshExpiresInSeconds`
- `token.expiresAt`
- `cached.advertiserCount`
- `cached.advertiserFetchedAt`
- `cached.businessCenterCount`
- `cached.businessCenterFetchedAt`

### Field response snapshot

`TikTokAdsSnapshotRow`

- `id`
- `platformKey`
- `snapshotDate`
- `internalAdAccountId`
- `advertiserId`
- `platformId`
- `externalAccountId`
- `externalAccountName`
- `externalGroupId`
- `externalGroupName`
- `externalAccountStatus`
- `currencyCode`
- `spend`
- `clicks`
- `impressions`
- `reach`
- `conversions`
- `ctr`
- `cpc`
- `cpm`
- `costPerConversion`
- `error`
- `syncedAt`

### Field live breakdown yang nyata di backend

Route TikTok live breakdown di backend menghasilkan group dan account snapshot. Field utamanya yang nyata di server:

- `businessCenterGroups[].id`
- `businessCenterGroups[].name`
- `businessCenterGroups[].advertiserCount`
- `businessCenterGroups[].spend`
- `businessCenterGroups[].clicks`
- `businessCenterGroups[].impressions`
- `businessCenterGroups[].conversions`
- `accountSnapshots[]` berisi metrik per advertiser

### Status implementasi

- OAuth authorize URL: sudah
- exchange auth code: sudah
- advertiser registry: sudah
- business center registry: sudah
- live breakdown: sudah
- snapshot DB: sudah
- mutation otomatis / publish iklan: belum

## 5. Field API Percakapan

## 5.1 Cakupan Nyata yang Sudah Ada

Channel yang benar-benar sudah punya jalur kode:

- `instagram`
- `facebook_page`
- `whatsapp`

Catatan penting:

- TikTok DM belum ada service dan route production saat ini.
- WhatsApp sudah masuk sebagai platform channel, tetapi coverage-nya masih bergantung pada jalur webhook/store dan belum setara penuh dengan inbox IG/Messenger live.

## 5.2 Endpoint yang sudah ada

- `GET /make-server-f781cd00/meta/messaging/readiness`
- `POST /make-server-f781cd00/meta/messaging/assets/sync`
- `GET /make-server-f781cd00/meta/messaging/inbox/overview`
- `GET /make-server-f781cd00/meta/messaging/inbox/daily-stats`
- `GET /make-server-f781cd00/meta/messaging/inbox/messages`
- `POST /make-server-f781cd00/meta/messaging/send`

## 5.3 Field registry channel

`ConversationChannel`

- `id`
- `platform`
- `pageId`
- `pageName`
- `instagramAccountId`
- `instagramUsername`
- `instagramName`
- `whatsappPhoneNumberId`
- `whatsappDisplayPhoneNumber`
- `tasks`
- `supportsMessaging`
- `subscribedFields`
- `updatedAt`

## 5.4 Field inbox overview

`ConversationOverviewItem`

- `id`
- `channelId`
- `platform`
- `source`
- `pageName`
- `channelLabel`
- `contactId`
- `contactName`
- `contactHandle`
- `lastMessageAt`
- `lastMessageText`
- `unreadCount`
- `messageCount`
- `updatedAt`
- `graphLink`
- `objectType`

`ConversationInboxOverviewResponse.diagnostics`

- `storedConversationCount`
- `liveConversationCount`
- `liveErrors[].channelId`
- `liveErrors[].error`

## 5.5 Field detail message

`ConversationMessage`

- `id`
- `channelId`
- `conversationId`
- `source`
- `direction`
- `senderId`
- `senderName`
- `text`
- `attachments`
- `timestamp`

## 5.6 Field statistik harian

`ConversationDailyInboxBucket`

- `date`
- `inboundMessages`
- `newConversations`
- `uniqueContacts`
- `instagramInboundMessages`
- `instagramNewConversations`
- `instagramUniqueContacts`
- `messengerInboundMessages`
- `messengerNewConversations`
- `messengerUniqueContacts`

`ConversationDailyInboxStatsResponse`

- `timezone`
- `generatedAt`
- `rangeDays`
- `latestStoredEventAt`
- `summary.today`
- `summary.yesterday`
- `summary.last7Days`
- `days[]`

## 5.7 Perilaku nyata saat ini

- Inbox overview menggabungkan `meta-live` dan `webhook-store`.
- Statistik harian akan memakai webhook store jika histori event tersedia.
- Jika histori webhook belum penuh, UI saat ini fallback ke `aktivitas thread` berbasis `lastMessageAt`.
- UI sudah memisahkan lane `Instagram` dan `Messenger`.

## 5.8 Status implementasi

- unified inbox: sudah
- statistik harian: sudah
- kirim pesan dari inbox: sudah
- TikTok DM inbox: belum
- AI auto-reply production: belum

## 6. Field Otomasi Order

## 6.1 Status nyata saat ini

Yang sudah ada di kode sekarang:

- model data `ProspectBooking`
- model data `Order`
- CRUD order
- mobile technician order read model
- parsing maps dan helper jarak dasar

Yang belum ada:

- robot yang membuat order otomatis dari chat
- routing decision engine otomatis
- auto-assign branch / technician berbasis aturan AI

## 6.2 Field prospect booking yang sudah nyata

`ProspectBooking`

- `id`
- `leadId`
- `orderId`
- `customerName`
- `customerPhone`
- `scheduleDate`
- `scheduleTime`
- `branchId`
- `areaId`
- `address`
- `mapsUrl`
- `notes`
- `status`
- `csId`
- `advertiserId`
- `technicianId`
- `vehicleId`
- `platformId`
- `subChannelId`
- `serviceId`
- `createdAt`
- `updatedAt`

## 6.3 Field order yang sudah nyata

`Order`

- `id`
- `leadDate`
- `customerName`
- `customerPhone`
- `address`
- `serviceDate`
- `serviceTime`
- `serviceId`
- `serviceCategory`
- `mapsUrl`
- `vehicleId`
- `units`
- `price`
- `platformId`
- `subChannelId`
- `csId`
- `advertiserId`
- `notes`
- `technicianId`
- `branchId`
- `areaId`
- `status`
- `paymentType`
- `paymentMethodId`
- `income`
- `paymentStatus`
- `paymentValidation`
- `affiliateName`
- `lat`
- `lng`
- `leadId`
- `templateHistory`
- `photos.before`
- `photos.after`
- `photos.payment`
- `photos.signature`
- `startTravelAt`
- `startWorkAt`
- `finishedAt`
- `payload`
- `cancelReason`
- `cancelReasonNote`
- `isFollowedUp`
- `followedUpBy`
- `followedUpAt`
- `followUpNote`

## 6.4 Endpoint order yang sudah ada

Di backend saat ini tersedia:

- `GET /make-server-f781cd00/orders`
- `POST /make-server-f781cd00/orders`
- `PUT /make-server-f781cd00/orders/:id`
- `DELETE /make-server-f781cd00/orders/:id`
- `GET /make-server-f781cd00/mobile/technician-orders/:userId`

Catatan:

- route `orders` di `index.tsx` masih memakai payload gaya KV
- `MasterDataCtx` dan mobile technician flow sudah membaca tabel/order data yang dinormalisasi dari Supabase
- belum ada route khusus `create order from conversation` atau `create order by AI`

## 6.5 Dukungan jarak dan rute yang sudah ada

Logika pendukung yang sudah nyata:

- parsing koordinat dari `mapsUrl`
- helper `getDistance(lat1, lon1, lat2, lon2)`
- expand short maps URL via backend `/expand-url`
- visualisasi rute di UI memakai layanan rute OSM di komponen peta

Kesimpulan:

- dukungan jarak: sudah
- visualisasi rute: sudah
- full order automation engine: belum

## 7. Kontrak Input-Output Kemampuan Diagnostik Visual AI

## 7.1 Status nyata saat ini

Di kode yang ada sekarang:

- sistem sudah menyimpan foto pada field `order.photos`
- teknisi mobile sudah punya flow upload foto before/after/payment
- belum ada endpoint diagnosis foto
- belum ada model CV/AI yang membaca foto headlamp dan mengeluarkan hasil diagnosis terstruktur
- belum ada flow yang membaca attachment chat customer lalu mengubahnya menjadi diagnosis terstruktur

Jadi untuk saat ini:

- `pengambilan foto`: sudah diimplementasikan
- `diagnosis foto`: belum diimplementasikan

## 7.2 Input yang sudah tersedia dari kode sekarang

Input aktual yang sudah ada dan bisa dijadikan pondasi:

- `orderId`
- `vehicleId`
- `photos.before[]`
- `photos.after[]`
- `notes`
- `serviceCategory`
- `mapsUrl`
- `lat`
- `lng`

## 7.3 Kontrak future yang disarankan

Jika kemampuan diagnostik visual AI dibuat, kontrak minimal yang masuk akal:

### Input

- `orderId`
- `imageUrl`
- `vehicleId`
- `serviceId`
- `customerComplaint`
- `capturedAt`
- `source`

### Output

- `diagnosisId`
- `orderId`
- `imageUrl`
- `detectedCondition`
- `severity`
- `recommendedAction`
- `confidence`
- `needsHumanReview`
- `evidence[]`
- `createdAt`

### Status output

- `draft`
- `review_required`
- `accepted`
- `rejected`

## 7.4 Catatan implementasi

Karena saat ini belum ada real code diagnosis:

- technical doc harus menandai modul ini sebagai `future module`
- output diagnosis tidak boleh diperlakukan sebagai source of truth sampai ada engine dan evaluasi akurasi
- fase awal lebih aman sebagai `decision support`, bukan keputusan final otomatis

## 8. Gap Antara Visi dan Kode Saat Ini

Yang sudah dekat ke visi:

- ads live + snapshot lintas platform
- unified conversation center
- mapping akun internal ke akun live
- daily stats dan fallback logic
- order dan prospect booking data model
- dukungan peta dan jarak dasar

Yang belum ada secara nyata:

- integrasi TikTok DM
- AI auto-reply production
- create order otomatis dari chat
- diagnosis foto headlamp
- content engine terhubung ke Google Drive
- ad mutation / publish automation
- rule engine iklan yang benar-benar mengubah platform

## 9. Kesimpulan Teknis

OpenClaw Marketing OS saat ini sudah punya pondasi kuat di tiga area:

- `ingestion data iklan`
- `ingestion percakapan`
- `model data order dan operasional`

Namun untuk mencapai visi `full robot from traffic to money`, modul berikut masih harus dibangun:

- `lapisan aksi AI`
- `lapisan otomasi order`
- `mesin diagnosis foto`
- `lapisan akses konten dan creative`
- `mesin eksekusi dan rule iklan`
