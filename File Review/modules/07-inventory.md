# 07 - Inventory

Status: Planning reference
Date: 2026-05-01
Scope: Stock products, transactions, valuation, settings

## Purpose

Modul ini mengelola inventory, produk stock, transaksi stock, valuasi, dan pengaturan stock.

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

- stock settings endpoint
- stock products endpoint
- stock transactions endpoint
- stock-related Supabase tables behind server routes

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

## First Safe Upgrade Step

Map inventory subroutes to `StockManagementPage` with the same `defaultTab` values currently used by `AppLayout`.
