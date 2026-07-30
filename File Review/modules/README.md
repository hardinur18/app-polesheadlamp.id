# Module Documentation Index

Status: Planning reference
Date: 2026-05-01
Scope: Per-module documentation for professional app upgrade

## Purpose

Folder ini berisi catatan per modul untuk upgrade aplikasi ke struktur yang lebih profesional.

Dokumen ini dipakai untuk:

- mencatat entry file existing
- menentukan target route
- mencatat permission utama
- mencatat data source
- mencatat risk
- menjaga no-regression saat migrasi

Semua dokumen di folder ini bersifat dokumentasi. Tidak ada perubahan runtime.

## Module Docs

| No | Module | File |
|---|---|---|
| 00 | Route and Shell | [00-route-and-shell.md](D:/Polesheadlamp.id/File%20Review/modules/00-route-and-shell.md) |
| 01 | Auth and Access | [01-auth-and-access.md](D:/Polesheadlamp.id/File%20Review/modules/01-auth-and-access.md) |
| 02 | Dashboard | [02-dashboard.md](D:/Polesheadlamp.id/File%20Review/modules/02-dashboard.md) |
| 03 | Leads and Prospects | [03-leads-and-prospects.md](D:/Polesheadlamp.id/File%20Review/modules/03-leads-and-prospects.md) |
| 04 | Orders and Scheduling | [04-orders-and-scheduling.md](D:/Polesheadlamp.id/File%20Review/modules/04-orders-and-scheduling.md) |
| 05 | Technician Operations | [05-technician-operations.md](D:/Polesheadlamp.id/File%20Review/modules/05-technician-operations.md) |
| 06 | Finance and Payments | [06-finance-and-payments.md](D:/Polesheadlamp.id/File%20Review/modules/06-finance-and-payments.md) |
| 07 | Inventory | [07-inventory.md](D:/Polesheadlamp.id/File%20Review/modules/07-inventory.md) |
| 08 | Ads and Marketing | [08-ads-and-marketing.md](D:/Polesheadlamp.id/File%20Review/modules/08-ads-and-marketing.md) |
| 09 | Conversations | [09-conversations.md](D:/Polesheadlamp.id/File%20Review/modules/09-conversations.md) |
| 10 | Admin and Master Data | [10-admin-and-master-data.md](D:/Polesheadlamp.id/File%20Review/modules/10-admin-and-master-data.md) |
| 11 | Marketing OS | [11-marketing-os.md](D:/Polesheadlamp.id/File%20Review/modules/11-marketing-os.md) |
| 12 | Public Surfaces | [12-public-surfaces.md](D:/Polesheadlamp.id/File%20Review/modules/12-public-surfaces.md) |

## Standard Module Template

Setiap modul sebaiknya punya bagian:

- purpose
- current entry files
- current navigation id
- target routes
- permissions
- data sources
- service/API boundary
- shared dependencies
- migration risks
- no-regression checklist
- first safe upgrade step

## Reading Order

Untuk mulai upgrade route profesional:

1. Baca [../PROFESSIONAL-APP-UPGRADE-PLAN.md](D:/Polesheadlamp.id/File%20Review/PROFESSIONAL-APP-UPGRADE-PLAN.md)
2. Baca [../ROUTE-INVENTORY.md](D:/Polesheadlamp.id/File%20Review/ROUTE-INVENTORY.md)
3. Baca [00-route-and-shell.md](D:/Polesheadlamp.id/File%20Review/modules/00-route-and-shell.md)
4. Baca [01-auth-and-access.md](D:/Polesheadlamp.id/File%20Review/modules/01-auth-and-access.md)
5. Baca modul yang akan disentuh
6. Cek [../NO-REGRESSION-CHECKLIST.md](D:/Polesheadlamp.id/File%20Review/NO-REGRESSION-CHECKLIST.md)
