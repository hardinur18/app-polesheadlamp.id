# Professional Hardening Checklist - 2026-06-10

Status: active checklist  
Policy: no business logic, permission behavior, data contract, or production workflow changes without explicit approval.

## Batch 01 - Tooling Recovery

- [x] Open local app in Chrome.
- [x] Recover Vite dev server startup.
- [x] Reinstall corrupt local `esbuild` package in `node_modules`.
- [x] Confirm Vite dev server runs at `http://127.0.0.1:5173`.
- [x] Reinstall corrupt local `core-js` package in `node_modules`.
- [x] Confirm production build works again.

## Batch 02 - Type Foundation

- [x] Align React runtime and React type packages on React 18.
- [x] Replace explicit `.ts` import extensions in permission backfill.
- [x] Fix TooltipProvider typing while preserving Radix behavior.
- [x] Keep existing `npm run typecheck` green.
- [x] Keep existing `npm run lint` green.

## Batch 03 - Inventory Safety Gate

- [x] Clean stock module type errors from full-app typecheck output.
- [x] Add scoped `npm run typecheck:stock` quality gate.
- [x] Include inventory page, stock utils, required shared UI, permission, master-data context, and service dependencies in stock typecheck scope.
- [x] Preserve stock transaction, fallback schema compatibility, permission checks, and audit behavior.

## Batch 04 - Module Safety Gates

- [x] Add scoped `npm run typecheck:finance` quality gate.
- [x] Add scoped `npm run typecheck:orders` quality gate.
- [x] Add scoped `npm run typecheck:ads` quality gate.
- [x] Add scoped `npm run typecheck:technicians` quality gate.
- [x] Keep these gates non-runtime: config/scripts only, no business logic or system behavior changes.

## Batch 05 - Dependency Health Guardrail

- [x] Add manual `npm run dependency:health` quality gate.
- [x] Check local `esbuild` metadata and native transform readiness before build troubleshooting.
- [x] Check local `core-js` metadata and key module files before build troubleshooting.
- [x] Parse key `core-js` probe files so corrupted binary content is caught before production build.
- [x] Keep the guardrail read-only and manual-only: no runtime app code, production workflow, business logic, permission behavior, or data contract changes.

## Session Notes - 2026-06-12

- Reinstalled corrupted local `esbuild` and `core-js` packages in `node_modules` after the new health gate and build exposed local package corruption.
- No source runtime, backend function, business logic, permission behavior, data contract, or production workflow files were changed.

## Current Verified Commands

- [x] `npm run dependency:health`
- [x] `npm run typecheck:stock`
- [x] `npm run typecheck:finance`
- [x] `npm run typecheck:orders`
- [x] `npm run typecheck:ads`
- [x] `npm run typecheck:technicians`
- [x] `npm run typecheck`
- [x] `npm run typecheck:full`
- [x] `npm run lint`
- [x] `npm run build`

## Known Remaining Work

- [ ] `xlsx` still has high-severity audit findings with no npm auto-fix.
- [ ] Heavy route chunks still need safe lazy-boundary review: `vendor-charts`, `vendor-xlsx`, `vendor-pdf`, `Pesanan`, and global CSS.
- [ ] `MasterDataCtx` is still the biggest frontend coupling point.
- [ ] `AppLayout` still uses `activeTab` switch as the render compatibility layer.
- [ ] Direct `supabase.from(...)` access still exists in several pages.
- [ ] Backend route surface in `supabase/functions/server/index.tsx` is still large.
- [ ] Payment gateway secret handling still needs backend-only hardening.
- [ ] Live Supabase schema should be checked for `ad_account_owner_assignments`.

## Next Safe Batches

1. Plan `xlsx` migration or isolation strategy without changing import/export behavior.
2. Move repeated API URL/header construction to existing service helpers where behavior stays identical.
3. Split documentation and service boundaries before moving runtime logic.
4. Only after gates are stable, extract domain providers from `MasterDataCtx` one module at a time.

