# 11 - Marketing OS

Status: Planning reference
Date: 2026-05-01
Scope: Marketing OS shell, workspace routes, workspace modules, shared adapters

## Purpose

Marketing OS adalah extension layer di dalam host app untuk workspace marketing yang lebih modern dan terstruktur.

## Current Entry Files

- `src/marketing-os/foundation/workspaces.ts`
- `src/marketing-os/routes/index.ts`
- `src/marketing-os/components/MarketingOsShell.tsx`
- `src/marketing-os/components/MarketingOsWorkspacePlaceholder.tsx`
- `src/marketing-os/modules/*`
- `src/marketing-os/shared/*`
- `src/app/pages/marketing-os/marketingOsWorkspace.ts`

## Current Navigation Ids

- `marketing-os-command-center`
- `marketing-os-ads-monitoring`
- `marketing-os-conversation-hub`
- `marketing-os-lead-intelligence`
- `marketing-os-order-automation`
- `marketing-os-creative-content`
- `marketing-os-ai-action-center`

## Target Routes

- `/marketing-os/command-center`
- `/marketing-os/ads-monitoring`
- `/marketing-os/conversation-hub`
- `/marketing-os/lead-intelligence`
- `/marketing-os/order-automation`
- `/marketing-os/creative-content`
- `/marketing-os/ai-action-center`

## Permissions

- defined in `MARKETING_OS_WORKSPACES`
- mostly `monitoring.marketing.view`, `leads.view`, and `order.view`

## Data Sources

- shared Marketing OS adapters
- host app services
- some workspace mock/static data
- ads adapter
- conversation adapter

## Service/API Boundary

- Marketing OS should not duplicate mature host app logic
- mock-heavy workspaces must remain clearly marked
- adapters should bridge host app services into Marketing OS contracts

## Migration Risks

- duplicate routes overlap with classic ads and conversation pages
- workspace permission mismatch
- placeholder workspaces look like live modules
- shell nesting changes layout unexpectedly

## No-Regression Checklist

- every Marketing OS workspace opens
- placeholder fallback remains available
- Ads Monitoring workspace still reads adapter data
- shell visual output remains stable
- classic app pages still open separately

## First Safe Upgrade Step

Use existing `MARKETING_OS_INTERNAL_ROUTES` as the first source for route registry entries.
