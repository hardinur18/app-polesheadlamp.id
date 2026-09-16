# Security Hardening Progress

This document tracks the staged hardening work for the RHI System app.

## Phase 1 - Security Foundation

Status: Completed

- [x] Create progress tracker.
- [x] Restrict legacy unguarded server endpoints.
- [x] Remove service-role-to-anon fallback in server admin clients.
- [x] Restrict backend CORS and add baseline security headers.
- [x] Add database migration to remove anonymous full CRUD from sensitive tables.
- [x] Run source-only verification checks.

Notes:

- Phase 1 removes anonymous full CRUD and locks the most exposed endpoints.
- Authenticated broad table policies still exist intentionally where current browser-side CRUD depends on them. Those move to role-aware Edge Functions in Phase 2/3.
- Live Supabase still needs the new migration applied and verified in staging/production.

## Phase 2 - Role Permission Enforcement

Status: Completed

- [x] Change frontend permission loading to default-deny.
- [x] Review default role permission matrix.
- [x] Add server-side permission enforcement for remaining sensitive routes.
- [x] Add role route smoke checklist.

Notes:

- Frontend permission checks now fail closed while the server permission snapshot is loading or unavailable.
- Default role presets no longer grant `audit_logs.view` to Finance, CS, Teknisi, or Advertiser.
- Google Ads, TikTok Ads, Meta live-breakdown, reports, expand-url, and legacy Meta Messaging inbox routes now require feature permissions on the server.
- Legacy `/conversations/*` routes now require `whatsapp.view` instead of only `leads.view`.
- Role smoke checks are documented in `docs/role-permission-smoke-checklist.md`.
- Broad authenticated database policies still exist where browser-side CRUD depends on them. That is intentionally carried into Phase 3.

## Phase 3 - Data Access Refactor

Status: Completed

- [x] Replace central sensitive Supabase CRUD with guarded Edge Functions.
- [x] Scope `MasterDataProvider` fetches by page and permission.
- [x] Split public embed-form access from admin form management.

Notes:

- Added guarded `/app-data/:type` Edge Function routes with a per-table whitelist and per-action permission checks.
- `MasterDataProvider` now reads and mutates app data through the guarded server route. Forbidden tables fail closed to empty local state.
- Embed form admin management now requires authenticated lead permissions, while public embed fetch/submit stays unauthenticated but only serves active forms and validates allowed origins.
- Public embed submissions now create submissions, leads, and CS routing on the server instead of exposing that write path in the browser.
- Affiliate admin CRUD now uses guarded `/app-data/affiliates`, and public affiliate booking now validates active affiliates and creates leads through a public server endpoint.
- Source scans for central provider, embed forms, and affiliate lead paths are clean, and `typecheck`, `build`, and `smoke:role-routes` pass.
- Deno CLI is not installed locally, so Edge Function validation is covered by source review and frontend checks only.
- Residual direct Supabase access still exists in specialized modules, storage/realtime flows, and profile/session bootstrap. Those remain tracked for Phase 5 cleanup and production validation.

## Phase 4 - Frontend/UI Stability

Status: Completed

- [x] Consolidate table horizontal-scroll foundation.
- [x] Reduce conflicting CSS overrides.
- [x] Harden PWA update/cache behavior.
- [x] Expand typecheck coverage.

Notes:

- `DataTable` and legacy `Table` wrappers now share explicit horizontal-scroll markers, keyboard-focusable scroll regions, and the same drag/touch scroll foundation.
- The inventory transaction table no longer overrides DataTable horizontal scrolling with `overflow-x: hidden` or a forced `min-width: 100%`.
- PWA registration is now handled from the app bootstrap only in production, with periodic online/visible update checks and no duplicate `/registerSW.js` injection.
- `tsconfig.typecheck.json` now covers the frontend bootstrap, UI foundation components, and the PWA update service. The Phase 4 aggregate typecheck covers base, stock, finance, orders, ads, and technician suites.
- Valid local verification passed on Node `20.20.2`: aggregate typecheck, production build, lint, and role-route smoke script. The role-route smoke script exited as a guarded skip because anonymous user creation is correctly unauthorized without provided smoke credentials.
- Local build verification required repairing the local esbuild native binary in `node_modules`; no dependency manifest change was needed.

## Phase 5 - Cleanup & Release Verification

Status: Not started

- [ ] Remove unused legacy artifacts from runtime scope.
- [ ] Add release checklist for each role.
- [ ] Run lint/typecheck/build/smoke checks.
- [ ] Document residual production validation steps.

## Pre-Phase 4 Clearance - 2026-09-16

Status: Partially cleared, production access blocked

- [x] Local source verification passed for Phase 1-3.
- [x] Supabase CLI `2.117.0` was downloaded to a temporary folder and used without adding binaries to the repo.
- [x] Remote SQL execution path was verified through Supabase CLI Management API.
- [x] Phase 1 security SQL and `cs_okr_targets` SQL were executed successfully on the shell `SUPABASE_PROJECT_REF`.
- [x] Edge Functions `make-server-f781cd00`, `meta-messaging-webhook`, and `kirimdev-messaging-webhook` were deployed successfully on the shell `SUPABASE_PROJECT_REF`.
- [x] Remote secrets on the shell project include core Supabase runtime keys, including `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Apply migrations to the frontend app project from `.env.local` / `.env.supabase.local`.
- [ ] Deploy Edge Functions to the frontend app project from `.env.local` / `.env.supabase.local`.
- [ ] Run real login smoke tests for Owner, CS, Finance, Teknisi, and Advertiser against the frontend app project.
- [ ] Run real public embed form and public affiliate booking smoke tests against the frontend app project.
- [ ] Run Deno check for Edge Functions.

Blocker:

- The shell `SUPABASE_PROJECT_REF` does not match the project used by `.env.local` / `.env.supabase.local`.
- The available `SUPABASE_ACCESS_TOKEN` can access the shell project, but does not have the required privileges for the frontend app project. Supabase CLI returns an access-control error when linking the frontend app project.
- Until a token with access to the frontend app project is available, production migration/deploy and real role smoke tests for that project cannot be honestly marked complete.
