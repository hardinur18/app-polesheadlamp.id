# 12 - Public Surfaces

Status: Planning reference
Date: 2026-05-01
Scope: Public booking and unauthenticated route handling

## Purpose

Modul ini menjaga halaman publik yang boleh dibuka tanpa login.

## Current Entry Files

- `src/app/routes.ts`
- `src/app/pages/affiliates/PublicBookingPage.tsx`

## Current Routes

- `/booking`

## Target Routes

Tetap:

- `/booking`

Opsional masa depan:

- `/public/booking`

Payment Gateway preview sudah dihapus dari app.

## Permissions

- public route
- no authenticated app permission required

## Data Sources

- affiliate booking-related data
- provider wrappers used by existing pages

## Migration Risks

- public route accidentally protected by auth gate
- booking link external menjadi broken
- Cloudflare SPA fallback changes route serving

## No-Regression Checklist

- `/booking` opens without login
- unauthenticated root still shows login
- unknown public path does not expose protected data

## First Safe Upgrade Step

Keep public routes outside the authenticated route set and verify them after every router change.
