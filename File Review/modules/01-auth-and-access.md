# 01 - Auth and Access

Status: Planning reference
Date: 2026-05-01
Scope: Login, Supabase session, role, permission, access fallback

## Purpose

Modul ini menjaga behavior login, session, role, permission, dan fallback akses.

## Current Entry Files

- `src/app/AuthenticatedApp.tsx`
- `src/app/pages/auth/LoginPage.tsx`
- `src/app/hooks/usePermissions.tsx`
- `src/app/data/permissions.ts`
- `src/app/data/roleHelpers.ts`
- `src/app/components/layout/appLayoutTabPermissions.ts`
- `src/app/components/layout/appLayoutTabRegistry.ts`

## Current Behavior

- session dicek lewat Supabase Auth
- user tanpa session melihat login page
- user dengan session masuk ke `AppLayout`
- permission diambil dari default local, server config, dan custom user config
- invalid role session menampilkan layar khusus
- inactivity logout berjalan setelah 24 jam

## Target Routes

- `/login`
- internal authenticated routes

## Required Preparation

- formal login route
- logged-in redirect rule from `/login`
- logged-out handling for internal authenticated routes
- role fallback route mapping
- permission denied route or state

## Migration Risks

- user login diarahkan ke halaman yang salah
- logout tidak membersihkan state
- role teknisi masuk ke shell desktop
- owner view-as role berubah behavior
- public page ikut diproteksi secara tidak sengaja

## No-Regression Checklist

- login existing tetap berhasil
- logout existing tetap berhasil
- inactive session tetap expired
- invalid role tetap ditahan
- permission denied tetap muncul atau redirect sesuai behavior existing
- owner, CS, teknisi, finance, advertiser tetap punya akses sesuai role

## First Safe Upgrade Step

Document route access rules before changing `AuthenticatedApp` or router behavior.
