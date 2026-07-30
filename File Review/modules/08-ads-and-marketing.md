# 08 - Ads and Marketing

Status: Planning reference
Date: 2026-05-01
Scope: Daily ads, ads monitoring, live integrations, diagnostics, sandbox

## Purpose

Modul ini mengelola iklan harian, monitoring performa iklan, integrasi live ads, diagnostics, dan action sandbox.

## Current Entry Files

- `src/app/pages/IklanHarian.tsx`
- `src/app/pages/ads/MarketingMonitoringPage.tsx`
- `src/app/pages/ads/AdsMonitoringOverviewPage.tsx`
- `src/app/pages/ads/UnifiedAdsMonitoringPage.tsx`
- `src/app/pages/ads/AdsMonitoringAdvertiserMatrixPage.tsx`
- `src/app/pages/ads/AdsMonitoringCsMatrixPage.tsx`
- `src/app/pages/ads/AdsMonitoringDiagnosticsPage.tsx`
- `src/app/pages/ads/AdsMonitoringOpenClawPage.tsx`
- `src/app/pages/ads/AdsMonitoringActionSandboxPage.tsx`
- `src/app/services/liveAdsService.ts`
- `src/app/services/googleAdsLiveService.ts`
- `src/app/services/tiktokAdsLiveService.ts`

## Current Navigation Ids

- `daily-ads`
- `ads-monitoring`
- `ads-monitoring-workspace`
- `ads-monitoring-overview`
- `ads-realtime`
- `ads-monitoring-integrasi-iklan`
- `ads-monitoring-advertiser-matrix`
- `ads-monitoring-cs-matrix`
- `ads-monitoring-diagnostics`
- `ads-monitoring-openclaw`
- `ads-monitoring-action-sandbox`

## Target Routes

- `/ads/daily`
- `/ads/monitoring`
- `/ads/monitoring/overview`
- `/ads/realtime`
- `/ads/advertiser-matrix`
- `/ads/cs-matrix`
- `/ads/diagnostics`
- `/ads/openclaw`
- `/ads/action-sandbox`

## Permissions

- `monitoring.marketing.view`
- advertiser-specific permissions from current mapping

## Data Sources

- `daily_ads`
- `ad_platforms`
- `ad_sub_channels`
- `ad_accounts`
- `ad_sources`
- `ads_live_daily_snapshots`
- Meta live endpoints
- Google Ads endpoints
- TikTok Ads endpoints

## Service/API Boundary

- keep live integrations behind service wrappers
- do not change snapshot/cache semantics during route upgrade
- Marketing OS ads adapter should reuse host app service where possible

## Migration Risks

- ads realtime page route overlaps with Marketing OS ads monitoring
- advertiser role sees wrong matrix
- live integration fetch cadence changes
- diagnostics page loses context

## No-Regression Checklist

- daily ads page opens
- unified ads monitoring opens
- advertiser matrix opens
- CS matrix opens
- diagnostics opens
- OpenClaw page opens
- action sandbox opens
- advertiser role access remains correct

## First Safe Upgrade Step

Create route intent map for every ads tab because this module has many aliases and overlapping surfaces.
