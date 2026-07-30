# 12 - Public Surfaces

Status: Planning reference
Date: 2026-05-01
Scope: Public booking, payment preview, unauthenticated route handling

## Purpose

Modul ini menjaga halaman publik yang boleh dibuka tanpa login.

## Current Entry Files

- `src/app/routes.ts`
- `src/app/pages/affiliates/PublicBookingPage.tsx`
- `src/app/pages/orders/PaymentGatewayPreviewPage.tsx`

## Current Routes

- `/booking`
- `/payment-gateway-preview`

## Target Routes

Tetap:

- `/booking`
- `/payment-gateway-preview`

Opsional masa depan:

- `/public/booking`
- `/public/payment-preview`

Namun route existing tidak boleh dimatikan tanpa redirect plan.

## Permissions

- public route
- no authenticated app permission required

## Data Sources

- affiliate booking-related data
- payment preview data
- provider wrappers used by existing pages

## Migration Risks

- public route accidentally protected by auth gate
- payment preview changes provider behavior
- booking link external menjadi broken
- Cloudflare SPA fallback changes route serving

## No-Regression Checklist

- `/booking` opens without login
- `/payment-gateway-preview` opens without login
- unauthenticated root still shows login
- unknown public path does not expose protected data

## First Safe Upgrade Step

Keep public routes outside the authenticated route set and verify them after every router change.
