# 07 - Inventory

Status: Implemented foundation pass
Date: 2026-08-04
Scope: Master data produk, transaksi mutasi, kartu stok, laporan valuasi, pengaturan stok

## Purpose

Modul ini mengelola inventory operasional: master data produk, transaksi masuk/keluar/opname, kartu stok per produk, laporan valuasi aset, dan pengaturan satuan stok.

## Inventory Submodules

- Master Data Produk: daftar produk aktif, filter produk, form tambah/edit produk, detail produk, status stok, harga jual, HPP rata-rata, nilai aset, dan akses kartu stok.
- Transaksi & Mutasi: histori transaksi, filter mutasi, form transaksi baru/edit transaksi, pembatalan transaksi terbaru, batch item, cabang/teknisi, harga satuan, total nilai, dan catatan transaksi.
- Kartu Stok: ringkasan stok produk, total masuk, total keluar, HPP rata-rata, riwayat transaksi per produk, saldo berjalan, dan pagination maksimal 50 baris.
- Laporan Valuasi: KPI nilai aset, total item fisik, item low stock, tabel valuasi produk, HPP satuan, stok fisik, dan total valuasi.
- Pengaturan Stok: daftar jenis layanan aktif dari master data layanan, daftar satuan stok, tambah satuan, hapus satuan, dan tabel setting berbasis DataTable.

## UI Foundation Usage

- Page shell: `StockManagementPage.tsx`
- Table shell: `OperationalTableCard`, `DataTable`, `MasterDataTableTitle`, `InventoryTablePagination`
- Filter shell: `OperationalFilterPanel`
- Form/dialog shell: `Dialog`, `MasterDataFormDialogContent`, `MasterDataDialogBody`, `MasterDataFormActions`, `MasterDataFieldLabel`
- Empty state/KPI: `OperationalEmptyState`, `OperationalKpiGrid`, `OperationalKpiCard`
- Styling scope: `.inventoryPage` and inventory-specific classes in `src/styles/foundation.css`

## UI Rules

- Isi tabel menggunakan font normal, bukan bold.
- Nomor urut memakai angka biasa tanpa leading zero.
- Nominal harus beridentitas Rupiah.
- Kolom gabungan menggunakan baris utama dan teks kedua lebih kecil, misalnya produk/SKU dan teknisi/cabang.
- Maksimal pagination inventory adalah 50 baris per halaman.
- Detail produk dan form transaksi memakai dialog modul foundation, bukan drawer samping.

## Current Entry Files

- `src/app/pages/stock/StockManagementPage.tsx`
- `src/app/pages/stock/components/ProductList.tsx`
- `src/app/pages/stock/components/StockTransactions.tsx`
- `src/app/pages/stock/components/StockValuationReport.tsx`
- `src/app/pages/stock/components/StockSettings.tsx`
- `src/app/pages/stock/utils/stockLedger.ts`
- `src/app/pages/stock/utils/stockTransactionScope.ts`

## Current Navigation Ids

- `inventory`
- `inventory-products`
- `inventory-transactions`
- `inventory-valuation`
- `inventory-settings`

## Target Routes

- `/inventory`
- `/inventory/products`
- `/inventory/transactions`
- `/inventory/valuation`
- `/inventory/settings`

## Permissions

- inventory permissions from current tab permission mapping

## Data Sources

- Supabase `stock_products`
- Supabase `stock_transactions`
- Supabase `stock_units`
- Master data services, branches, and users from master-data context

## Service/API Boundary

- inventory is already more server-oriented than older modules
- keep current endpoint boundary stable

## Migration Risks

- default tab mismatch
- route refresh opens wrong stock tab
- transaction scope behavior changes
- valuation calculation regresses

## No-Regression Checklist

- products tab opens
- transactions tab opens
- valuation tab opens
- settings tab opens
- default inventory route opens products as current behavior expects
- product table keeps row click detail behavior
- transaction table keeps row number visible
- table body text is not bold
- unit setting input and add button have equal height
- detail product opens as foundation dialog
- stock pagination stays at maximum 50 rows per page

## First Safe Upgrade Step

Map inventory subroutes to `StockManagementPage` with the same `defaultTab` values currently used by `AppLayout`.
