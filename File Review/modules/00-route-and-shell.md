# 00 - Route and Shell

Status: Planning reference
Date: 2026-05-01
Scope: App shell, browser routing, active tab compatibility, navigation frame

## Purpose

Modul ini mengatur bagaimana aplikasi dibuka, berpindah halaman, dan menampilkan shell utama.

## Current Entry Files

- `src/App.tsx`
- `src/app/routes.ts`
- `src/app/AuthenticatedApp.tsx`
- `src/app/components/layout/AppLayout.tsx`
- `src/app/components/Sidebar.tsx`
- `src/app/components/BottomNav.tsx`

## Current Navigation Model

Saat ini browser route masih tipis:

- `/`
- `/booking`
- `/payment-gateway-preview`
- `*`

Mayoritas halaman internal dikendalikan oleh state `activeTab` di `AppLayout`.

## Target Routes

Target awal:

- `/login`
- `/dashboard`
- `/leads`
- `/orders`
- `/schedule`
- `/monitoring`
- `/map`
- `/ads/*`
- `/conversations/*`
- `/finance/*`
- `/inventory/*`
- `/master-data`
- `/users`
- `/settings/roles`
- `/marketing-os/*`

## Required Preparation

- route registry
- tab id to route mapping
- route to tab id mapping
- permission mapping per route
- page title mapping per route
- fallback route per role
- compatibility adapter for existing `activeTab`

## Migration Risks

- wrong default tab after login
- permission fallback changes
- browser refresh changes active page
- sidebar selection mismatch
- bottom nav mismatch on mobile
- technician-specific navigation regression

## No-Regression Checklist

- login still opens correctly
- owner can reach dashboard
- CS can reach leads and orders
- technician lands on correct mobile surface
- finance pages remain protected
- public routes still open without login
- unknown routes do not crash the app

## First Safe Upgrade Step

Create route definitions as pure data without wiring them into runtime navigation yet.
