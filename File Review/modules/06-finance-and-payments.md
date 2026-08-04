# 06 - Finance and Payments

Status: Planning reference
Date: 2026-05-01
Scope: Payments, debts, cashflow, payroll, finance reports

## Purpose

Modul ini mengelola pembayaran reguler, piutang/hutang, kas, payroll, dan laporan finance. Fitur Payment Gateway/QRIS sudah dihapus dari app.

## Current Entry Files

- `src/app/pages/finance/PaymentsPage.tsx`
- `src/app/pages/finance/DebtsPage.tsx`
- `src/app/pages/finance/PayrollPage.tsx`
- `src/app/pages/Kas.tsx`
- `src/app/pages/Laporan.tsx`
- `src/app/pages/master-data/tabs/RecurringExpensesTab.tsx`

## Foundation Adoption

- Hutang & Piutang: foundation pass tanggal 2026-08-04.
- Page header memakai `OperationalPageHeader`.
- Filter memakai `OperationalFilterPanel`.
- KPI memakai `OperationalKpiGrid` dan `OperationalKpiCard`.
- Grup transaksi memakai `OperationalTableCard` dan detail memakai `DataTable`.
- Form settlement, tambah manual, dan edit manual memakai `MasterDataFormDialogContent`, `MasterDataDialogBody`, `MasterDataFieldLabel`, dan `MasterDataFormActions`.

## Hutang & Piutang Audit Notes

- Sebelumnya masih memakai header manual, card manual, filter manual, table primitive langsung, dan dialog footer manual.
- Badge di isi table sudah dikurangi untuk source/type utama dan diganti teks status ringan.
- Nomor detail transaksi memakai angka biasa tanpa leading zero.
- Logic kalkulasi, fetch, settle, create, edit, dan delete tidak diubah.

## Current Navigation Ids

- `payments`
- `cashflow`
- `debts`
- `finance-report`
- `payroll`
- `recurring-expenses`

## Target Routes

- `/finance/payments`
- `/finance/cashflow`
- `/finance/debts`
- `/finance/report`
- `/finance/payroll`
- `/finance/recurring-expenses`

## Permissions

- finance and payment permissions from `permissions.ts`
- payroll permissions from current mapping

## Data Sources

- `recurring_expenses`
- payroll-related tables
- technician daily reports
- payroll Edge Function
- manual debt endpoints

## Service/API Boundary

- payroll is hybrid and should be migrated carefully
- direct writes should not be moved in bulk without test coverage

## Migration Risks

- payroll calculation behavior changes
- finance report mode changes
- recurring expense tab loses role context

## No-Regression Checklist

- payments page opens
- debt page opens
- cashflow opens
- payroll opens
- finance report mode remains correct
- recurring expenses tab still receives current role

## First Safe Upgrade Step

Map finance route paths to current tab ids while preserving existing render switch.
