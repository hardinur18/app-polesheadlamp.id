# Route Inventory for Professional App Upgrade

Status: Planning inventory
Date: 2026-05-01
Scope: Current `activeTab` navigation mapped to target browser routes
Document role: Source-of-truth draft before route-driven implementation

## Purpose

Dokumen ini memetakan navigasi aplikasi saat ini dari model `activeTab` menuju target URL profesional.

Tujuannya:

- memastikan semua fitur internal punya target URL
- menjaga permission dan fallback tetap sama
- menyiapkan route registry sebelum kode runtime diubah
- menjadi checklist agar upgrade route tidak melewatkan modul

Dokumen ini tidak mengubah sistem atau logic. Ini inventory untuk fase implementasi berikutnya.

## Source Files

Inventory ini disusun dari:

- `src/app/routes.ts`
- `src/app/components/layout/AppLayout.tsx`
- `src/app/components/layout/appLayoutTabRegistry.ts`
- `src/app/components/layout/appLayoutTabPermissions.ts`
- `src/app/components/layout/appLayoutPageTitles.ts`
- `src/app/components/layout/appLayoutWorkspaceMeta.ts`
- `src/app/components/Sidebar.tsx`
- `src/app/components/BottomNav.tsx`
- `src/marketing-os/routes/index.ts`
- `src/marketing-os/foundation/workspaces.ts`
- `src/app/pages/ads/adsMonitoringWorkspace.ts`
- `src/app/pages/conversations/conversationWorkspace.ts`

## Current Browser Routes

| Current path | Current component | Access | Target status |
|---|---|---|---|
| `/` | `AuthenticatedApp` | smart auth gate | Keep as smart entry |
| short internal routes | `AuthenticatedApp` | authenticated app namespace | Canonical route set |
| `/app/*` | `AuthenticatedApp` | legacy authenticated app namespace | Kept as compatibility route |
| `/booking` | `PublicBookingPage` | public | Keep stable |
| `/payment-gateway-preview` | `PaymentGatewayPreviewPage` | public | Keep stable |
| `*` | `AuthenticatedApp` | smart fallback | Keep during transition, then narrow later |

## Target Route Rules

Recommended route contract:

- `/login` becomes the official login route.
- internal authenticated routes use short canonical paths without `/app`, for example `/dashboard`, `/orders`, and `/finance/payments`.
- `/app/*` stays supported as a legacy compatibility namespace during transition, but is canonicalized back to short URLs in the app.
- top-level internal routes canonicalize with a trailing slash in production, for example `/orders/`, because Cloudflare Pages serves those direct routes reliably with the slash.
- `/booking` and `/payment-gateway-preview` remain public and unchanged.
- `/` becomes a smart entry:
  - logged out: login
  - logged in: default role route, normally `/dashboard`
- unknown paths stay safe during transition through the existing fallback.

## Global Navigation Compatibility

The current runtime uses:

```txt
URL -> AuthenticatedApp -> AppLayout -> activeTab -> switch(activeTab) -> page component
```

The first implementation should move toward:

```txt
URL -> AuthenticatedApp -> AppLayout route bridge -> activeTab compatibility -> existing page component
```

`activeTab` should not be removed in the first route batch.

## Fallback Rules to Preserve

Current fallback constants:

| Rule | Current value |
|---|---|
| Default app tab | `dashboard` |
| Access denied fallback tab | `profile` |
| Access fallback priority | `dashboard.view -> dashboard`, `teknisi.view_mobile -> teknisi-mobile`, `leads.view -> leads` |
| Technician allowed tabs | `teknisi-mobile`, `dashboard`, `profile`, `orders` |

These rules must remain behaviorally equivalent during route migration.

## Primary Internal Routes

| Module | Current `activeTab` | Target URL | Current render target | Permission | Notes |
|---|---|---|---|---|---|
| Dashboard | `dashboard` | `/dashboard` | `Dashboard` | `dashboard.view` | Dashboard view mode is role/permission-specific |
| Daily Ads | `daily-ads` | `/ads/daily` | `IklanHarian` | `ads.view_daily` | Sidebar item |
| Marketing Monitoring | `ads-monitoring` | `/ads/monitoring` | `MarketingMonitoringPage` | `monitoring.marketing.view` | Current "Monitoring Perf." entry |
| Affiliate | `affiliates` | `/affiliates` | `AffiliateList` | `affiliate.view` | Operational module |
| Leads | `leads` | `/leads` | `Prospek` | `leads.view` | Main sidebar id |
| Leads legacy alias | `prospek` | `/leads` | `Prospek` | `leads.view` | Bottom nav still uses this id in some roles |
| Orders | `orders` | `/orders` | `Pesanan` | `order.view` | Used by sidebar and bottom nav |
| Daily Report | `daily-report` | `/reports/daily` | `Laporan` | `daily_report.view` | Operational report |
| Schedule | `schedule` | `/schedule` | `Schedule` | `schedule.view` | Used by sidebar and bottom nav |
| Technician Schedule | `technician-schedule` | `/technician/schedule` | `TechnicianSchedulePage` | `technician_schedule.view` | Admin/ops technician scheduling |
| Technician Mobile | `teknisi-mobile` | `/technician/mobile` | `TeknisiMobile` | `teknisi.view_mobile` | Special role behavior |
| Monitoring Activity | `monitoring-activity` | `/monitoring/activity` | `MonitoringPage` | `monitoring.activity_view` | Technician activity |
| Field Monitoring | `monitoring` | `/monitoring/field` | `Pemantauan` | `monitoring.view` | Field monitoring |
| Map | `map` | `/map` | `MapPage` | `map.view_global` | Global map |
| Profile | `profile` | `/profile` | `ProfilePage` | none in map | Access denied fallback target |

## Finance Routes

| Module | Current `activeTab` | Target URL | Current render target | Permission | Notes |
|---|---|---|---|---|---|
| Payroll | `payroll` | `/finance/payroll` | `PayrollPage` | `payroll.view` | Hybrid data access |
| Payments | `payments` | `/finance/payments` | `PaymentsPage` | `payments.view` | Payment transaction module |
| Recurring Expenses | `recurring-expenses` | `/finance/recurring-expenses` | `RecurringExpensesTab` | `recurring_expenses.view` | Receives `currentRole` |
| Cashflow | `cashflow` | `/finance/cashflow` | `Kas` | `cashflow.view` | Cash in/out |
| Debts | `debts` | `/finance/debts` | `DebtsPage` | `debts.view` | Debt/receivable module |
| Finance Report | `finance-report` | `/finance/report` | `Laporan mode="finance"` | `finance_report.view` | Uses report component in finance mode |
| Payment Gateway | `payment-gateway` | `/finance/payment-gateway` | `PaymentGatewaySettings` | `payment_gateway.view` | Internal settings page |

## Inventory Routes

| Module | Current `activeTab` | Target URL | Current render target | Permission | Notes |
|---|---|---|---|---|---|
| Inventory default | `inventory` | `/inventory` | `StockManagementPage defaultTab="products"` | `inventory.view` | Parent/sidebar item |
| Products | `inventory-products` | `/inventory/products` | `StockManagementPage defaultTab="products"` | `inventory.view` | Child item |
| Transactions | `inventory-transactions` | `/inventory/transactions` | `StockManagementPage defaultTab="transactions"` | `stock.transaction.view` | Child item |
| Valuation | `inventory-valuation` | `/inventory/valuation` | `StockManagementPage defaultTab="valuation"` | `stock.valuation.view` | Child item |
| Settings | `inventory-settings` | `/inventory/settings` | `StockManagementPage defaultTab="settings"` | `stock.settings.manage` | Child item |

## Admin Routes

| Module | Current `activeTab` | Target URL | Current render target | Permission | Notes |
|---|---|---|---|---|---|
| Master Data | `master-data` | `/master-data` | `MasterDataPage` | `master_data.view` | Receives `currentRole` |
| Users | `users` | `/users` | `UserManagementPage` | `users.view` | User and access management |
| Roles | `roles` | `/settings/roles` | `RoleManagement` | `role_permissions.view` | Hidden while `viewAsRole` active |
| WhatsApp Templates | `wa-templates` | `/leads/templates` | `WATemplatesPage` | `wa_template.view` | Related to leads |
| Audit Logs | `audit-logs` | `/audit-logs` | `AuditLogPage` | `audit_logs.view` | Current back target is dashboard |

## Ads Monitoring Routes

| Module | Current `activeTab` | Target URL | Current render target | Permission | Notes |
|---|---|---|---|---|---|
| Ads workspace alias | `ads-monitoring-workspace` | `/ads/monitoring` | `AdsMonitoringOverviewPage` | `monitoring.marketing.view` | Alias to overview |
| Overview | `ads-monitoring-overview` | `/ads/monitoring/overview` | `AdsMonitoringOverviewPage` | `monitoring.marketing.view` | Workspace metadata exists |
| Realtime legacy alias | `ads-realtime` | `/ads/realtime` | `UnifiedAdsMonitoringPage` | `monitoring.marketing.view` | Alias for integration page |
| Integrasi Iklan | `ads-monitoring-integrasi-iklan` | `/ads/monitoring/integrasi-iklan` | `UnifiedAdsMonitoringPage` | `monitoring.marketing.view` | Workspace metadata exists |
| Advertiser Matrix | `ads-monitoring-advertiser-matrix` | `/ads/monitoring/advertiser-matrix` | `AdsMonitoringAdvertiserMatrixPage` | `monitoring.marketing.view` | Workspace metadata exists |
| CS Matrix | `ads-monitoring-cs-matrix` | `/ads/monitoring/cs-matrix` | `AdsMonitoringCsMatrixPage` | `monitoring.marketing.view` | Workspace metadata exists |
| Diagnostics | `ads-monitoring-diagnostics` | `/ads/monitoring/diagnostics` | `AdsMonitoringDiagnosticsPage` | `monitoring.marketing.view` | Workspace metadata exists |
| OpenClaw | `ads-monitoring-openclaw` | `/ads/monitoring/openclaw` | `AdsMonitoringOpenClawPage` | `monitoring.marketing.view` | Workspace metadata exists |
| Action Sandbox | `ads-monitoring-action-sandbox` | `/ads/monitoring/action-sandbox` | `AdsMonitoringActionSandboxPage` | `monitoring.marketing.view` | Workspace metadata exists |

## Conversation Routes

| Module | Current `activeTab` | Target URL | Current render target | Permission | Notes |
|---|---|---|---|---|---|
| Conversation Center alias | `conversation-center` | `/conversations` | `ConversationLiveInboxPage` | `leads.view` | Alias to inbox |
| Live Inbox | `conversation-live-inbox` | `/conversations/inbox` | `ConversationLiveInboxPage` | `leads.view` | Live page |
| Channel Settings | `conversation-channel-settings` | `/conversations/channel-settings` | `ConversationChannelSettingsPage` | `leads.view` | Live page |
| Automation | `conversation-automation` | `/conversations/automation` | `PlaceholderPage` via workspace meta | `leads.view` | Placeholder route candidate |
| Routing | `conversation-routing` | `/conversations/routing` | `PlaceholderPage` via workspace meta | `leads.view` | Placeholder route candidate |
| History | `conversation-history` | `/conversations/history` | `PlaceholderPage` via workspace meta | `leads.view` | Placeholder route candidate |

## Marketing OS Routes

| Module | Current `activeTab` | Existing internal path | Target URL | Current render target | Permission |
|---|---|---|---|---|---|
| Command Center | `marketing-os-command-center` | `/marketing-os/command-center` | `/marketing-os/command-center` | `MarketingOsShell + CommandCenterPage` | `monitoring.marketing.view` |
| Ads Monitoring | `marketing-os-ads-monitoring` | `/marketing-os/ads-monitoring` | `/marketing-os/ads-monitoring` | `MarketingOsShell + AdsMonitoringWorkspacePage` | `monitoring.marketing.view` |
| Conversation Hub | `marketing-os-conversation-hub` | `/marketing-os/conversation-hub` | `/marketing-os/conversation-hub` | `MarketingOsShell + ConversationHubPage` | `leads.view` |
| Lead Intelligence | `marketing-os-lead-intelligence` | `/marketing-os/lead-intelligence` | `/marketing-os/lead-intelligence` | `MarketingOsShell + LeadIntelligencePage` | `leads.view` |
| Order Automation | `marketing-os-order-automation` | `/marketing-os/order-automation` | `/marketing-os/order-automation` | `MarketingOsShell + OrderAutomationPage` | `order.view` |
| Creative Content | `marketing-os-creative-content` | `/marketing-os/creative-content` | `/marketing-os/creative-content` | `MarketingOsShell + CreativeContentPage` | `monitoring.marketing.view` |
| AI Action Center | `marketing-os-ai-action-center` | `/marketing-os/ai-action-center` | `/marketing-os/ai-action-center` | `MarketingOsShell + AiActionCenterPage` | `monitoring.marketing.view` |

## Dashboard View Sub-Navigation

Dashboard child items are not independent app routes in the first migration batch.

| Current child id | Suggested query route | Permission | Notes |
|---|---|---|---|
| `dashboard-view-Owner` | `/dashboard?view=Owner` | `dashboard.view_owner` | Changes dashboard view mode, active tab remains `dashboard` |
| `dashboard-view-Advertiser` | `/dashboard?view=Advertiser` | `dashboard.view_advertiser` | Changes dashboard view mode |
| `dashboard-view-CS` | `/dashboard?view=CS` | `dashboard.view_cs` | Changes dashboard view mode |
| `dashboard-view-Teknisi` | `/dashboard?view=Teknisi` | `dashboard.view_teknisi` | Changes dashboard view mode |

Recommendation: keep dashboard view mode as internal state during the first route batch. Query string support can be added later.

## Bottom Navigation Mapping

| Role mode | Current bottom item | Current id | Target behavior |
|---|---|---|---|
| Technician | Dashboard | `dashboard` | navigate `/dashboard` |
| Technician | Pesanan | `orders` | navigate `/orders` |
| Technician | Jadwal Saya | `teknisi-mobile` | navigate `/technician/mobile` |
| Technician | Profil | `profile` | navigate `/profile` |
| Advertiser | Home | `dashboard` | navigate `/dashboard` |
| Advertiser | Iklan | `daily-ads` | navigate `/ads/daily` |
| Advertiser | Prospek | `prospek` | navigate `/leads` |
| Advertiser | Pesanan | `orders` | navigate `/orders` |
| Advertiser | Jadwal | `schedule` | navigate `/schedule` |
| Standard | Home | `dashboard` | navigate `/dashboard` |
| Standard | Prospek | `prospek` | navigate `/leads` |
| Standard | Pesanan | `orders` | navigate `/orders` |
| Standard | Jadwal | `schedule` | navigate `/schedule` |
| Standard | Menu | `menu` | keep as drawer action, not a route |

## Route Aliases to Preserve During Transition

| Alias | Canonical route | Reason |
|---|---|---|
| `prospek` | `/leads` | legacy/bottom nav id |
| `ads-monitoring-workspace` | `/ads/monitoring/overview` | old workspace alias |
| `ads-realtime` | `/ads/monitoring/integrasi-iklan` | old integration alias |
| `conversation-center` | `/conversations/inbox` | old conversation parent alias |
| `inventory` | `/inventory/products` | parent default behavior |

## Implementation Batch Recommendation

### Batch R00 - SPA Hosting Fallback

Status: implemented.

Implemented files:

- `public/_redirects`
- `src/app/routes.ts`

Expected outcome:

- direct Cloudflare Pages requests to `/login` return the SPA
- direct Cloudflare Pages requests to short internal routes return the SPA
- direct Cloudflare Pages requests to `/app/*` remain compatible
- direct Cloudflare Pages requests to public routes remain stable
- React Router has explicit short internal route branches and a legacy `/app/*` branch before the catch-all

### Batch R01 - Pure Route Registry

Status: implemented as a no-runtime-change foundation.

Created route data:

- `src/app/routing/appRouteRegistry.ts`
- `tabToPath`
- `pathToTab`
- route permission metadata

No user-facing behavior changes.

### Batch R02 - URL-to-Tab Bridge

Status: implemented as a route-to-tab bridge.

Implemented files:

- `src/app/components/layout/AppLayout.tsx`
- `src/app/routing/appRouteRegistry.ts`
- `tsconfig.typecheck.json`
- `eslint.config.mjs`

Wired authenticated internal paths to the existing `AppLayout` render flow.

Expected outcome:

- direct open `/orders` renders current `orders` tab
- refresh preserves page
- permission fallback remains unchanged

Verification:

- `npm run typecheck` passed
- `npm run lint` passed
- `npm run build` passed with existing Vite chunk-size warning
- `npm run smoke:routes` passed against `http://localhost:5174`
- latest route smoke confirms `/app/orders` final URL is `/orders`
- smoke artifact: `File Review/artifacts/route-navigation-smoke.json`
- `npm run smoke:role-routes` script added for authenticated role route smoke
- role route smoke artifact: `File Review/artifacts/role-route-smoke.json`
- latest role route smoke was skipped because temporary user creation returned `Unauthorized`; no temporary users were created

### Batch R03 - Login Route Formalization

Status: implemented with minimal auth-route behavior change.

Implemented files:

- `src/app/routes.ts`
- `src/app/AuthenticatedApp.tsx`

Made `/login` official while preserving current unauthenticated behavior.

Expected outcome:

- logged out `/login` shows login
- logged in `/login` redirects to default app route
- public routes stay public

Verification:

- `npm run typecheck` passed
- `npm run lint` passed
- `npm run build` passed with existing Vite chunk-size warning

### Batch R04 - Navigation Upgrade

Status: implemented at the `AppLayout` navigation boundary.

Implemented files:

- `src/app/components/layout/AppLayout.tsx`

Changed sidebar, bottom nav, notification navigation, and selected page callbacks to navigate by URL while keeping tab compatibility callbacks.

Expected outcome:

- address bar updates on navigation
- sidebar active state stays correct
- mobile bottom nav still works

Verification:

- `npm run typecheck` passed
- `npm run lint` passed
- `npm run build` passed with existing Vite chunk-size warning

## Verification Checklist

For every routing batch:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run smoke:routes`
- `npm run smoke:role-routes` when authorized test credentials are available
- open `/`
- open `/login`
- open `/booking`
- open `/payment-gateway-preview`
- login as Owner and open `/dashboard`
- open `/leads`
- open `/orders`
- open `/finance/payments`
- open `/inventory/products`
- open `/marketing-os/ads-monitoring`
- validate Technician route fallback
- validate unauthorized route fallback

## Open Decisions

| Decision | Recommendation |
|---|---|
| Should all internal pages use `/app/*`? | No. Canonical routes use short URLs; `/app/*` is legacy compatibility only. |
| Should `/` redirect after login? | Eventually yes, but preserve smart entry first |
| Should unknown routes redirect or render app shell? | Keep current fallback during transition |
| Should dashboard view mode be query string? | Defer until route bridge is stable |
| Should placeholder conversation pages get real URLs? | Yes, but mark as placeholder |

## Working Conclusion

This inventory confirms the app can be upgraded professionally without rewriting the business modules.

The safest next code change is a pure route registry that maps current `activeTab` ids to target URLs, with no runtime behavior change in the first batch.
