# 02 - Dashboard

Status: Planning reference
Date: 2026-05-01
Scope: Dashboard views and role-specific dashboard mode

## Purpose

Dashboard adalah landing internal utama setelah login untuk membaca kondisi operasional sesuai role.

## Current Entry Files

- `src/app/pages/Dashboard.tsx`
- `src/app/components/layout/AppLayout.tsx`
- `src/app/data/permissions.ts`

## Current Navigation Id

- `dashboard`

## Target Route

- `/dashboard`

## Permissions

- `dashboard.view`
- role-specific dashboard view permissions from `DASHBOARD_VIEW_PERMISSION_MAP`

## Data Sources

- `MasterDataProvider`
- Supabase tables already loaded by master data context
- role and permission data

## Migration Risks

- wrong dashboard mode after role switch
- owner default view changes
- dashboard permission fallback changes
- route refresh loses selected dashboard mode

## No-Regression Checklist

- owner dashboard still opens
- CS dashboard behavior remains valid
- finance dashboard behavior remains valid
- advertiser dashboard behavior remains valid
- users without dashboard permission still receive fallback

## First Safe Upgrade Step

Map `/dashboard` to existing `activeTab: 'dashboard'` without changing dashboard internals.
