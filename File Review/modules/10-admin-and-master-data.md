# 10 - Admin and Master Data

Status: Planning reference
Date: 2026-05-01
Scope: Master data, users, roles, audit logs, profile, access config

## Purpose

Modul ini mengatur data master, user, role, permission, audit, dan konfigurasi admin.

## Current Entry Files

- `src/app/pages/master-data/MasterDataPage.tsx`
- `src/app/pages/master-data/context/MasterDataCtx.tsx`
- `src/app/pages/users/UserManagementPage.tsx`
- `src/app/pages/settings/RoleManagement.tsx`
- `src/app/pages/AuditLogPage.tsx`
- `src/app/pages/ProfilePage.tsx`
- `src/app/pages/master-data/tabs/*`
- `src/app/pages/master-data/forms/*`
- `src/app/pages/master-data/modals/*`

## Current Navigation Ids

- `master-data`
- `users`
- `roles`
- `audit-logs`
- `profile`

## Target Routes

- `/master-data`
- `/users`
- `/settings/roles`
- `/audit-logs`
- `/profile`

## Permissions

- master data permissions from current mapping
- user management permissions
- role management permissions
- audit log permissions

## Data Sources

- many master tables loaded by `MasterDataProvider`
- profiles
- roles
- permissions endpoints
- access config endpoints
- audit logs

## Service/API Boundary

- `MasterDataCtx` remains public provider during route upgrade
- avoid changing provider shape during navigation migration
- future refactor should split internals without forcing consumer rewrites

## Migration Risks

- current user resolution changes
- role management changes permission behavior
- master data refresh affects all modules
- audit log back button target changes

## No-Regression Checklist

- master data opens
- user management opens
- role management opens
- profile opens
- audit logs open and back navigation remains sane
- refresh trigger still works
- current role/current user remain resolved

## First Safe Upgrade Step

Keep admin routes mapped to existing tabs while documenting every tab and permission dependency.
