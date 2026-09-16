# Release Verification Checklist

Last updated: 2026-09-16

Use this checklist before marking the app release-ready. Local checks can pass without production access, but production validation must run against the real Supabase project used by the frontend app.

## Automated Gates

- [ ] `npm run lint`
- [ ] `npm run typecheck:phase4`
- [ ] `npm run build`
- [ ] `npm run smoke:routes` against a local preview build.
- [ ] `npm run smoke:role-routes` with `SMOKE_ROLE_ACCOUNTS` for real test accounts, or an authorized user-management token.

Expected smoke setup:

- `SMOKE_BASE_URL` points to the preview or deployed app URL.
- `SMOKE_SUPABASE_URL` / `SMOKE_SUPABASE_ANON_KEY` point to the same Supabase project as the app.
- `SMOKE_ROLE_ACCOUNTS` contains Owner, CS, Finance, Teknisi, and Advertiser credentials when anonymous test-user creation is blocked.
- `smoke:routes` checks login redirects for protected routes and the public `/booking` route. Payment preview is treated as an internal authenticated workflow, not a public route.

## Role Checks

Run each role in a fresh browser session.

### Owner / Super Admin

- [ ] Can open Dashboard, Prospek, Kontak, Pesanan, Jadwal, Finance, Inventory, Master Data, Users, Role Permission, and Audit Logs.
- [ ] Can create/edit/delete representative records in guarded admin areas.
- [ ] Can view audit logs after a data mutation.
- [ ] Denied or failed requests show clear UI feedback, not blank screens.

### Admin PIC

- [ ] Can open Dashboard, Prospek, Pesanan, Monitoring, Affiliate, Inventory, Master Data, Users, and Audit Logs.
- [ ] Cannot open Role Permission unless custom access is explicitly granted.
- [ ] Cannot open finance-only workflows unless custom access is explicitly granted.
- [ ] User management hides Owner accounts unless the signed-in user is Owner.

### Finance

- [ ] Can open Finance pages, payroll, recurring expenses, debts, valuation reports, and operational reports.
- [ ] Can update payment status and finance-owned records.
- [ ] Cannot open Role Permission, Audit Logs, User Management, or technician mobile workflows.
- [ ] Finance data mutations produce audit entries.

### CS

- [ ] Can open Dashboard CS, Prospek, Pesanan, Jadwal, Monitoring Iklan, and OKR CS.
- [ ] Can create/edit allowed leads and orders.
- [ ] Cannot open Finance, Audit Logs, User Management, Role Permission, or Technician Mobile.
- [ ] WhatsApp/Live Chat remains hidden unless `whatsapp.view` is explicitly granted.

### Teknisi

- [ ] Can open Technician Mobile and assigned order detail workflows.
- [ ] Can upload/update allowed field evidence where the workflow permits it.
- [ ] Cannot open Finance, User Management, Audit Logs, Role Permission, or marketing monitoring.
- [ ] Customer/staff contact visibility follows the assigned permissions.

### Advertiser

- [ ] Can open Daily Ads, Ads Monitoring, Dashboard Advertiser, Prospek, Pesanan, and Jadwal.
- [ ] Can use advertiser-owned ads integrations where permissions allow.
- [ ] Cannot open Finance, User Management, Audit Logs, Role Permission, or Technician Mobile.
- [ ] Does not see unrelated advertiser data when scoped data exists.

## Public Workflows

- [ ] `/booking` renders without authentication and only accepts valid public booking payloads.
- [ ] `/embed/form/:identifier` only serves active forms and respects allowed origins.
- [ ] Public embed submissions create server-side leads without exposing admin write paths.
- [ ] Public affiliate booking validates active affiliates and creates leads through the public server endpoint.

## Production Validation

- [ ] Confirm the frontend app project ref from `.env.local` / `.env.supabase.local`.
- [ ] Apply all pending Supabase migrations to that frontend app project.
- [ ] Deploy `make-server-f781cd00`, `meta-messaging-webhook`, and `kirimdev-messaging-webhook` to that same project.
- [ ] Verify required Edge Function secrets exist in that project.
- [ ] Verify CORS allows only approved app/embed origins in production.
- [ ] Verify `_headers` are deployed, including no-store for `/sw.js` and `/workbox-*.js`.
- [ ] Install/open the PWA, deploy a new build, and confirm the app updates without being stuck on stale assets.
- [ ] Run real login smoke tests for Owner, CS, Finance, Teknisi, and Advertiser.
- [ ] Run real public embed form and public affiliate booking tests.
- [ ] Verify storage bucket policies for `orders`, `avatars`, `proof-assets`, platform logos, and bank logos.
- [ ] Verify realtime subscriptions only expose rows allowed by RLS.

## Residual Items

- Direct browser Supabase access still exists in specialized modules: stock, finance, schedule, reports, operational expense categories, storage uploads, and realtime subscriptions. These paths must rely on production RLS/storage policies until they are moved behind guarded server routes.
- The release cannot be marked production-clear while Supabase deploy/migration access for the frontend app project is unavailable.
- No active source path named Figma or Figma bundle is referenced in runtime scans. Generated `dist`, `node_modules`, `.tmp`, and review artifacts remain ignored and outside committed runtime source.
