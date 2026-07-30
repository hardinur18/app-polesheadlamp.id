# 06 - Finance and Payments

Status: Planning reference
Date: 2026-05-01
Scope: Payments, debts, cashflow, payroll, finance reports, payment gateway settings

## Purpose

Modul ini mengelola pembayaran, piutang/hutang, kas, payroll, laporan finance, dan konfigurasi payment gateway.

## Current Entry Files

- `src/app/pages/finance/PaymentsPage.tsx`
- `src/app/pages/finance/DebtsPage.tsx`
- `src/app/pages/finance/PayrollPage.tsx`
- `src/app/pages/finance/PaymentGatewaySettings.tsx`
- `src/app/pages/Kas.tsx`
- `src/app/pages/Laporan.tsx`
- `src/app/pages/master-data/tabs/RecurringExpensesTab.tsx`

## Current Navigation Ids

- `payments`
- `cashflow`
- `debts`
- `finance-report`
- `payroll`
- `payment-gateway`
- `recurring-expenses`

## Target Routes

- `/finance/payments`
- `/finance/cashflow`
- `/finance/debts`
- `/finance/report`
- `/finance/payroll`
- `/finance/payment-gateway`
- `/finance/recurring-expenses`

## Permissions

- finance and payment permissions from `permissions.ts`
- payroll permissions from current mapping

## Data Sources

- `payment_transactions`
- `recurring_expenses`
- payroll-related tables
- technician daily reports
- payments Edge Function
- payroll Edge Function
- manual debt endpoints

## Service/API Boundary

- payment flow should remain behind service/Edge Function
- payroll is hybrid and should be migrated carefully
- direct writes should not be moved in bulk without test coverage

## Migration Risks

- payment gateway settings break
- payroll calculation behavior changes
- finance report mode changes
- recurring expense tab loses role context

## No-Regression Checklist

- payments page opens
- debt page opens
- cashflow opens
- payroll opens
- payment gateway settings open
- finance report mode remains correct
- recurring expenses tab still receives current role

## First Safe Upgrade Step

Map finance route paths to current tab ids while preserving existing render switch.
