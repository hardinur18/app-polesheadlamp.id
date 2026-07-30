import { buildMakeServerUrl } from './internal/functionsBaseUrl';
import { getSessionBackedEdgeHeaders } from './internal/sessionClientHeaders';
import type { ServiceErrorPayload } from './internal/serviceTypes';

export const tiktokAdsFunctionsBaseUrl = buildMakeServerUrl();

const TIKTOK_BUSINESS_CENTER_CACHE_KEY = 'polesheadlamp_tiktok_business_centers_cache_v1';
const TIKTOK_ADVERTISER_CACHE_KEY = 'polesheadlamp_tiktok_advertisers_cache_v1';
const TIKTOK_INTEGRATION_CONFIG_STORAGE_KEY = 'polesheadlamp_tiktok_integration_configs_v1';

export interface TikTokBusinessCenter {
  bcId: string;
  bcName: string;
  raw?: Record<string, unknown>;
}

export interface TikTokAdvertiser {
  advertiserId: string;
  advertiserName: string;
  currency?: string | null;
  status?: string | null;
  timezone?: string | null;
  bcId?: string | null;
  bcName?: string | null;
  raw?: {
    authorized?: Record<string, unknown>;
    info?: Record<string, unknown>;
  };
}

export interface TikTokAdsTokenHealthResponse {
  ok: boolean;
  checkedAt: string;
  apiVersion: string;
  error?: string;
  configured: {
    appId: boolean;
    appSecret: boolean;
    redirectUri: string | null;
  };
  token?: {
    appId: string;
    exchangedAt: string;
    accessTokenAvailable: boolean;
    refreshTokenAvailable: boolean;
    advertiserIds: string[];
    scope: string[];
    expiresInSeconds?: number | null;
    refreshExpiresInSeconds?: number | null;
    expiresAt?: string | null;
  } | null;
  cached?: {
    advertiserCount?: number;
    advertiserFetchedAt?: string | null;
    businessCenterCount?: number;
    businessCenterFetchedAt?: string | null;
  };
}

export interface TikTokAdsAuthorizeUrlResponse {
  ok: boolean;
  authorizeUrl: string;
  configured: {
    appId: boolean;
    appSecret: boolean;
    redirectUri: string | null;
  };
}

export interface TikTokAdsExchangeCodeResponse {
  ok: boolean;
  exchangedAt: string;
  token: {
    accessTokenAvailable: boolean;
    refreshTokenAvailable: boolean;
    advertiserIds: string[];
    scope: string[];
    expiresInSeconds?: number | null;
    refreshExpiresInSeconds?: number | null;
    expiresAt?: string | null;
  };
  advertisers?: TikTokAdvertiser[];
  advertiserError?: string | null;
}

export interface TikTokAdsIntegrationConfig {
  adAccountId: string;
  enabled: boolean;
  businessCenterId?: string;
  businessCenterName?: string;
  liveTikTokAdvertiserId?: string;
  liveTikTokAdvertiserName?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface TikTokAdsSnapshotRow {
  id: string;
  platformKey: 'tiktok';
  snapshotDate: string;
  internalAdAccountId?: string | null;
  advertiserId?: string | null;
  platformId?: string | null;
  externalAccountId: string;
  externalAccountName: string;
  externalGroupId?: string | null;
  externalGroupName?: string | null;
  externalAccountStatus?: string | null;
  currencyCode?: string | null;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  conversions: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  costPerConversion: number | null;
  error?: string | null;
  syncedAt?: string;
}

export interface TikTokAdsSnapshotDatasetResponse {
  source: string;
  range: {
    from: string;
    to: string;
  };
  rows: TikTokAdsSnapshotRow[];
  metadata?: {
    rowCount?: number;
    lastSyncedAt?: string | null;
    upsertedCount?: number;
    servedFrom?: string;
    skippedSync?: boolean;
  };
}

function readCachedValue<T>(storageKey: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return (parsed as T) || fallback;
  } catch {
    return fallback;
  }
}

function writeCachedValue(storageKey: string, value: unknown) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(value));
}

function readTikTokBusinessCentersFromStorage() {
  return readCachedValue<TikTokBusinessCenter[]>(TIKTOK_BUSINESS_CENTER_CACHE_KEY, []);
}

function writeTikTokBusinessCentersToStorage(rows: TikTokBusinessCenter[]) {
  writeCachedValue(TIKTOK_BUSINESS_CENTER_CACHE_KEY, rows);
}

function readTikTokAdvertisersFromStorage() {
  return readCachedValue<TikTokAdvertiser[]>(TIKTOK_ADVERTISER_CACHE_KEY, []);
}

function writeTikTokAdvertisersToStorage(rows: TikTokAdvertiser[]) {
  writeCachedValue(TIKTOK_ADVERTISER_CACHE_KEY, rows);
}

function readTikTokIntegrationConfigsFromStorage() {
  return readCachedValue<TikTokAdsIntegrationConfig[]>(TIKTOK_INTEGRATION_CONFIG_STORAGE_KEY, []);
}

function writeTikTokIntegrationConfigsToStorage(configs: TikTokAdsIntegrationConfig[]) {
  writeCachedValue(TIKTOK_INTEGRATION_CONFIG_STORAGE_KEY, configs);
}

async function fetchTikTokJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({} as ServiceErrorPayload));

  if (!response.ok) {
    throw new Error(payload.error || 'Request TikTok Ads gagal.');
  }

  return payload as T;
}

export function getCachedTikTokBusinessCenters() {
  return readTikTokBusinessCentersFromStorage();
}

export function getCachedTikTokAdvertisers() {
  return readTikTokAdvertisersFromStorage();
}

export async function fetchTikTokAdsTokenHealth() {
  const response = await fetch(`${tiktokAdsFunctionsBaseUrl}/tiktok/token-health`, {
    headers: await getSessionBackedEdgeHeaders(),
  });

  const payload = await response.json().catch(() => ({} as ServiceErrorPayload));
  if (!response.ok && typeof (payload as TikTokAdsTokenHealthResponse).ok !== 'boolean') {
    throw new Error(payload.error || 'Gagal mengecek token health TikTok Ads.');
  }

  return payload as TikTokAdsTokenHealthResponse;
}

export async function fetchTikTokAdsAuthorizeUrl() {
  return await fetchTikTokJson<TikTokAdsAuthorizeUrlResponse>(
    `${tiktokAdsFunctionsBaseUrl}/tiktok/authorize-url`,
    {
      headers: await getSessionBackedEdgeHeaders(),
    },
  );
}

export async function exchangeTikTokAdsAuthorizationCode(code: string) {
  return await fetchTikTokJson<TikTokAdsExchangeCodeResponse>(
    `${tiktokAdsFunctionsBaseUrl}/tiktok/exchange-code`,
    {
      method: 'POST',
      headers: await getSessionBackedEdgeHeaders({ includeJsonContentType: true }),
      body: JSON.stringify({ code }),
    },
  );
}

export async function fetchTikTokBusinessCenters() {
  try {
    const payload = await fetchTikTokJson<{ businessCenters?: TikTokBusinessCenter[] }>(
      `${tiktokAdsFunctionsBaseUrl}/tiktok/business-centers`,
      {
        headers: await getSessionBackedEdgeHeaders(),
      },
    );

    const rows = Array.isArray(payload.businessCenters) ? payload.businessCenters : [];
    writeTikTokBusinessCentersToStorage(rows);
    return rows;
  } catch {
    return readTikTokBusinessCentersFromStorage();
  }
}

export async function fetchTikTokAdvertisers() {
  try {
    const payload = await fetchTikTokJson<{ advertisers?: TikTokAdvertiser[] }>(
      `${tiktokAdsFunctionsBaseUrl}/tiktok/advertisers`,
      {
        headers: await getSessionBackedEdgeHeaders(),
      },
    );

    const rows = Array.isArray(payload.advertisers) ? payload.advertisers : [];
    writeTikTokAdvertisersToStorage(rows);
    return rows;
  } catch {
    return readTikTokAdvertisersFromStorage();
  }
}

export async function fetchTikTokAdsIntegrationConfigs() {
  try {
    const payload = await fetchTikTokJson<{ configs?: TikTokAdsIntegrationConfig[] }>(
      `${tiktokAdsFunctionsBaseUrl}/tiktok/integration-configs`,
      {
        headers: await getSessionBackedEdgeHeaders(),
      },
    );

    const configs = Array.isArray(payload.configs) ? payload.configs : [];
    writeTikTokIntegrationConfigsToStorage(configs);
    return configs;
  } catch {
    return readTikTokIntegrationConfigsFromStorage();
  }
}

export async function saveTikTokAdsIntegrationConfig(
  adAccountId: string,
  enabled: boolean,
  extra?: Partial<TikTokAdsIntegrationConfig>,
) {
  const localConfigs = readTikTokIntegrationConfigsFromStorage();
  const existingConfig = localConfigs.find((config) => config.adAccountId === adAccountId);
  const nextConfig: TikTokAdsIntegrationConfig = {
    ...existingConfig,
    adAccountId,
    enabled,
    ...extra,
    updatedAt: new Date().toISOString(),
  };

  const mergedLocalConfigs = [
    ...localConfigs.filter((config) => config.adAccountId !== adAccountId),
    nextConfig,
  ];
  writeTikTokIntegrationConfigsToStorage(mergedLocalConfigs);

  try {
    const payload = await fetchTikTokJson<{ config?: TikTokAdsIntegrationConfig }>(
      `${tiktokAdsFunctionsBaseUrl}/tiktok/integration-configs/${adAccountId}`,
      {
        method: 'POST',
        headers: await getSessionBackedEdgeHeaders({ includeJsonContentType: true }),
        body: JSON.stringify({
          enabled,
          businessCenterId: extra?.businessCenterId,
          businessCenterName: extra?.businessCenterName,
          liveTikTokAdvertiserId: extra?.liveTikTokAdvertiserId,
          liveTikTokAdvertiserName: extra?.liveTikTokAdvertiserName,
        }),
      },
    );

    if (payload.config) {
      const committed = [
        ...mergedLocalConfigs.filter((config) => config.adAccountId !== adAccountId),
        payload.config,
      ];
      writeTikTokIntegrationConfigsToStorage(committed);
      return payload.config;
    }

    return nextConfig;
  } catch {
    return nextConfig;
  }
}

export async function fetchTikTokAdsSnapshotDataset({
  from,
  to,
  businessCenterId,
  advertiserId,
  includeLastKnown = false,
}: {
  from: string;
  to: string;
  businessCenterId?: string;
  advertiserId?: string;
  includeLastKnown?: boolean;
}) {
  const url = new URL(`${tiktokAdsFunctionsBaseUrl}/tiktok/snapshots`);

  url.searchParams.set('from', from);
  url.searchParams.set('to', to);

  if (businessCenterId && businessCenterId !== 'all') {
    url.searchParams.set('businessCenterId', businessCenterId);
  }

  if (advertiserId && advertiserId !== 'all') {
    url.searchParams.set('advertiserId', advertiserId);
  }

  if (includeLastKnown) {
    url.searchParams.set('includeLastKnown', 'true');
  }

  return await fetchTikTokJson<TikTokAdsSnapshotDatasetResponse>(url.toString(), {
    headers: await getSessionBackedEdgeHeaders(),
  });
}

export async function syncTikTokAdsSnapshotDataset({
  from,
  to,
  businessCenterId,
  advertiserId,
  force = false,
  minFreshMinutes = 10,
}: {
  from: string;
  to: string;
  businessCenterId?: string;
  advertiserId?: string;
  force?: boolean;
  minFreshMinutes?: number;
}) {
  return await fetchTikTokJson<TikTokAdsSnapshotDatasetResponse>(
    `${tiktokAdsFunctionsBaseUrl}/tiktok/sync-snapshots`,
    {
      method: 'POST',
      headers: await getSessionBackedEdgeHeaders({ includeJsonContentType: true }),
      body: JSON.stringify({
        from,
        to,
        businessCenterId: businessCenterId && businessCenterId !== 'all' ? businessCenterId : undefined,
        advertiserId: advertiserId && advertiserId !== 'all' ? advertiserId : undefined,
        force,
        minFreshMinutes,
      }),
    },
  );
}
