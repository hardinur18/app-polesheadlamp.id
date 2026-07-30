import { buildMakeServerUrl } from './internal/functionsBaseUrl';
import { getSessionBackedEdgeHeaders } from './internal/sessionClientHeaders';
import type { ServiceErrorPayload } from './internal/serviceTypes';

export const googleAdsFunctionsBaseUrl = buildMakeServerUrl();

const GOOGLE_LIVE_BREAKDOWN_CACHE_INDEX_KEY =
  'polesheadlamp_google_live_breakdown_cache_index_v1';
const GOOGLE_LIVE_BREAKDOWN_CACHE_PREFIX = 'polesheadlamp_google_live_breakdown_cache_v1';
const GOOGLE_LIVE_REGISTRY_CACHE_KEY = 'polesheadlamp_google_live_registry_cache_v1';
const GOOGLE_INTEGRATION_CONFIG_STORAGE_KEY = 'polesheadlamp_google_integration_configs_v1';
const GOOGLE_SYNC_COOLDOWN_STORAGE_KEY = 'polesheadlamp_google_sync_cooldown_v1';

export interface GoogleAdsLiveManagerSnapshot {
  id: string;
  name: string;
  accountCount: number;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
}

export interface GoogleAdsLiveAccountSnapshot {
  customerId: string;
  customerName: string;
  name: string;
  managerCustomerId: string | null;
  managerCustomerName: string;
  currencyCode: string;
  status: string;
  isManager: boolean;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  costPerConversion: number | null;
  dateStart: string;
  dateStop: string;
  error: string | null;
}

export interface GoogleAdsLiveBreakdownResponse {
  source: 'google-ads-live';
  generatedAt: string;
  requestedBy: string;
  cacheStatus?: 'live' | 'stale';
  cacheMessage?: string | null;
  servedFrom?: 'server' | 'cache';
  range: {
    from: string;
    to: string;
  };
  managers: GoogleAdsLiveManagerSnapshot[];
  accounts: GoogleAdsLiveAccountSnapshot[];
  summary: {
    managerCount: number;
    accountCount: number;
    spend: number;
    clicks: number;
    impressions: number;
    conversions: number;
  };
  metadata?: {
    apiVersion?: string;
    loginCustomerId?: string | null;
    accessibleCustomerCount?: number;
  };
}

export interface GoogleAdsTokenHealthResponse {
  ok: boolean;
  checkedAt: string;
  apiVersion: string;
  error?: string;
  configured: {
    developerToken: boolean;
    clientId: boolean;
    clientSecret: boolean;
    refreshToken: boolean;
    loginCustomerId: string | null;
    scopedCustomerIds: string[];
  };
  accessibleCustomerCount?: number;
  accessibleCustomerIds?: string[];
  metadata?: {
    source: 'server';
    refreshTokenSource?: 'env' | 'kv';
    storedRefreshTokenExchangedAt?: string | null;
    expiresInSeconds?: number;
  };
}

export interface GoogleAdsAuthorizeUrlResponse {
  ok: boolean;
  authorizeUrl: string;
  configured: {
    developerToken: boolean;
    clientId: boolean;
    clientSecret: boolean;
    redirectUri: string;
  };
}

export interface GoogleAdsExchangeCodeResponse {
  ok: boolean;
  exchangedAt: string;
  refreshTokenSource: 'kv';
  token: {
    refreshTokenAvailable: boolean;
    refreshTokenExpiresInSeconds?: number | null;
  };
  healthCheck?: {
    expiresInSeconds?: number;
    accessibleCustomerCount?: number;
    discoveredCustomerCount?: number;
    error?: string;
  } | null;
}

export interface GoogleAdsIntegrationConfig {
  adAccountId: string;
  enabled: boolean;
  managerCustomerId?: string;
  managerCustomerName?: string;
  liveGoogleCustomerId?: string;
  liveGoogleCustomerName?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface GoogleAdsSnapshotRow {
  id: string;
  platformKey: 'google';
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

export interface GoogleAdsSnapshotDatasetResponse {
  source: string;
  range: {
    from: string;
    to: string;
  };
  rows: GoogleAdsSnapshotRow[];
  metadata?: {
    rowCount?: number;
    lastSyncedAt?: string | null;
    upsertedCount?: number;
    servedFrom?: string;
    skippedSync?: boolean;
    fallbackSnapshotDate?: string | null;
    rateLimited?: boolean;
    retryAfterSeconds?: number | null;
    cooldownMessage?: string | null;
  };
}

function buildGoogleBreakdownCacheStorageKey({
  from,
  to,
  managerId,
  customerId,
}: {
  from: string;
  to: string;
  managerId?: string;
  customerId?: string;
}) {
  return `${GOOGLE_LIVE_BREAKDOWN_CACHE_PREFIX}:${from}:${to}:${managerId || 'all'}:${customerId || 'all'}`;
}

function readGoogleBreakdownCacheIndex() {
  if (typeof window === 'undefined') return [] as string[];

  try {
    const raw = window.localStorage.getItem(GOOGLE_LIVE_BREAKDOWN_CACHE_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function writeGoogleBreakdownCacheIndex(keys: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GOOGLE_LIVE_BREAKDOWN_CACHE_INDEX_KEY, JSON.stringify(keys));
}

function readGoogleLiveBreakdownCache(cacheKey: string) {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;
    return JSON.parse(raw) as GoogleAdsLiveBreakdownResponse;
  } catch {
    return null;
  }
}

function writeGoogleLiveBreakdownCache(
  cacheKey: string,
  payload: GoogleAdsLiveBreakdownResponse,
) {
  if (typeof window === 'undefined') return;

  const sanitizedPayload: GoogleAdsLiveBreakdownResponse = {
    ...payload,
    cacheStatus: 'live',
    cacheMessage: null,
  };

  window.localStorage.setItem(cacheKey, JSON.stringify(sanitizedPayload));

  const existingKeys = readGoogleBreakdownCacheIndex().filter((key) => key !== cacheKey);
  const nextKeys = [cacheKey, ...existingKeys].slice(0, 10);
  writeGoogleBreakdownCacheIndex(nextKeys);

  for (const staleKey of existingKeys.slice(9)) {
    window.localStorage.removeItem(staleKey);
  }
}

function readGoogleLiveRegistryCache() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(GOOGLE_LIVE_REGISTRY_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GoogleAdsLiveBreakdownResponse;
  } catch {
    return null;
  }
}

function writeGoogleLiveRegistryCache(payload: GoogleAdsLiveBreakdownResponse) {
  if (typeof window === 'undefined') return;

  const sanitizedPayload: GoogleAdsLiveBreakdownResponse = {
    ...payload,
    cacheStatus: 'live',
    cacheMessage: null,
  };

  window.localStorage.setItem(GOOGLE_LIVE_REGISTRY_CACHE_KEY, JSON.stringify(sanitizedPayload));
}

export function getCachedGoogleAdsLiveRegistry() {
  return readGoogleLiveRegistryCache();
}

export function getCachedGoogleAdsLiveBreakdown({
  from,
  to,
  managerId,
  customerId,
}: {
  from: string;
  to: string;
  managerId?: string;
  customerId?: string;
}) {
  return readGoogleLiveBreakdownCache(
    buildGoogleBreakdownCacheStorageKey({ from, to, managerId, customerId }),
  );
}

function readGoogleIntegrationConfigsFromStorage() {
  if (typeof window === 'undefined') return [] as GoogleAdsIntegrationConfig[];

  try {
    const raw = window.localStorage.getItem(GOOGLE_INTEGRATION_CONFIG_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as GoogleAdsIntegrationConfig[]) : [];
  } catch {
    return [];
  }
}

function writeGoogleIntegrationConfigsToStorage(configs: GoogleAdsIntegrationConfig[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GOOGLE_INTEGRATION_CONFIG_STORAGE_KEY, JSON.stringify(configs));
}

function parseGoogleRetryAfterSeconds(message: string) {
  const matched = message.match(/retry in\s+(\d+)\s+seconds?/i);
  if (!matched) return null;

  const seconds = Number(matched[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function formatGoogleCooldownMessage(retryAfterSeconds: number) {
  const hours = Math.floor(retryAfterSeconds / 3600);
  const minutes = Math.ceil((retryAfterSeconds % 3600) / 60);

  if (hours > 0) {
    return `Google Ads sedang membatasi sinkronisasi live. Snapshot terakhir tetap dipakai sampai sekitar ${hours}j ${Math.max(minutes, 0)}m lagi.`;
  }

  return `Google Ads sedang membatasi sinkronisasi live. Snapshot terakhir tetap dipakai sampai sekitar ${Math.max(minutes, 1)} menit lagi.`;
}

function readGoogleSyncCooldown() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(GOOGLE_SYNC_COOLDOWN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      expiresAt?: string;
      retryAfterSeconds?: number;
      message?: string;
    };

    if (!parsed?.expiresAt) return null;
    const expiresAtMs = new Date(parsed.expiresAt).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      window.localStorage.removeItem(GOOGLE_SYNC_COOLDOWN_STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeGoogleSyncCooldown(retryAfterSeconds: number) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    GOOGLE_SYNC_COOLDOWN_STORAGE_KEY,
    JSON.stringify({
      retryAfterSeconds,
      expiresAt: new Date(Date.now() + retryAfterSeconds * 1000).toISOString(),
      message: formatGoogleCooldownMessage(retryAfterSeconds),
    }),
  );
}

function clearGoogleSyncCooldown() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(GOOGLE_SYNC_COOLDOWN_STORAGE_KEY);
}

async function fetchGoogleAdsLiveBreakdownFromServer({
  from,
  to,
  managerId,
  customerId,
}: {
  from: string;
  to: string;
  managerId?: string;
  customerId?: string;
}) {
  const url = new URL(`${googleAdsFunctionsBaseUrl}/google/live-breakdown`);

  url.searchParams.set('from', from);
  url.searchParams.set('to', to);

  if (managerId && managerId !== 'all') {
    url.searchParams.set('managerId', managerId);
  }

  if (customerId && customerId !== 'all') {
    url.searchParams.set('customerId', customerId);
  }

  const response = await fetch(url.toString(), {
    headers: await getSessionBackedEdgeHeaders(),
  });

  const payload = await response.json().catch(() => ({} as ServiceErrorPayload));
  if (!response.ok) {
    throw new Error(payload.error || 'Gagal mengambil live data Google Ads.');
  }

  const normalizedAccounts = Array.isArray(payload?.accounts)
    ? payload.accounts.map((account: any) => ({
        ...account,
        name: account?.name || account?.customerName || account?.customerId || 'Google Ads Account',
      }))
    : [];

  return {
    ...payload,
    accounts: normalizedAccounts,
  } as GoogleAdsLiveBreakdownResponse;
}

export async function fetchGoogleAdsTokenHealth() {
  const response = await fetch(`${googleAdsFunctionsBaseUrl}/google/token-health`, {
    headers: await getSessionBackedEdgeHeaders(),
  });

  const payload = await response.json().catch(() => ({} as ServiceErrorPayload));
  if (!response.ok && typeof (payload as GoogleAdsTokenHealthResponse).ok !== 'boolean') {
    throw new Error(payload.error || 'Gagal mengecek token health Google Ads.');
  }

  return payload as GoogleAdsTokenHealthResponse;
}

export async function fetchGoogleAdsAuthorizeUrl(redirectUri?: string) {
  const url = new URL(`${googleAdsFunctionsBaseUrl}/google/authorize-url`);
  if (redirectUri) {
    url.searchParams.set('redirectUri', redirectUri);
  }

  const response = await fetch(url.toString(), {
    headers: await getSessionBackedEdgeHeaders(),
  });

  const payload = await response.json().catch(() => ({} as ServiceErrorPayload));
  if (!response.ok) {
    throw new Error(payload.error || 'Gagal membuat URL authorize Google Ads.');
  }

  return payload as GoogleAdsAuthorizeUrlResponse;
}

export async function exchangeGoogleAdsAuthorizationCode({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri?: string;
}) {
  const response = await fetch(`${googleAdsFunctionsBaseUrl}/google/exchange-code`, {
    method: 'POST',
    headers: await getSessionBackedEdgeHeaders({ includeJsonContentType: true }),
    body: JSON.stringify({
      code,
      redirectUri,
    }),
  });

  const payload = await response.json().catch(() => ({} as ServiceErrorPayload));
  if (!response.ok) {
    throw new Error(payload.error || 'Gagal menyimpan token Google Ads baru.');
  }

  return payload as GoogleAdsExchangeCodeResponse;
}

export async function fetchGoogleAdsIntegrationConfigs() {
  try {
    const response = await fetch(`${googleAdsFunctionsBaseUrl}/google/integration-configs`, {
      headers: await getSessionBackedEdgeHeaders(),
    });

    const payload = await response.json().catch(() => ({} as ServiceErrorPayload));
    if (!response.ok) {
      throw new Error(payload.error || 'Gagal mengambil config integrasi Google Ads.');
    }

    const configs = Array.isArray(payload?.configs)
      ? (payload.configs as GoogleAdsIntegrationConfig[])
      : [];
    writeGoogleIntegrationConfigsToStorage(configs);
    return configs;
  } catch {
    return readGoogleIntegrationConfigsFromStorage();
  }
}

export async function saveGoogleAdsIntegrationConfig(
  adAccountId: string,
  enabled: boolean,
  extra?: Partial<GoogleAdsIntegrationConfig>,
) {
  const localConfigs = readGoogleIntegrationConfigsFromStorage();
  const existingConfig = localConfigs.find((config) => config.adAccountId === adAccountId);
  const nextConfig: GoogleAdsIntegrationConfig = {
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
  writeGoogleIntegrationConfigsToStorage(mergedLocalConfigs);

  try {
    const response = await fetch(
      `${googleAdsFunctionsBaseUrl}/google/integration-configs/${adAccountId}`,
      {
        method: 'POST',
        headers: await getSessionBackedEdgeHeaders({ includeJsonContentType: true }),
        body: JSON.stringify({
          enabled,
          managerCustomerId: extra?.managerCustomerId,
          managerCustomerName: extra?.managerCustomerName,
          liveGoogleCustomerId: extra?.liveGoogleCustomerId,
          liveGoogleCustomerName: extra?.liveGoogleCustomerName,
        }),
      },
    );

    const payload = await response.json().catch(() => ({} as ServiceErrorPayload));
    if (!response.ok) {
      throw new Error(payload.error || 'Gagal menyimpan config integrasi Google Ads.');
    }

    const savedConfig = payload?.config as GoogleAdsIntegrationConfig | undefined;
    if (savedConfig) {
      const committed = [
        ...mergedLocalConfigs.filter((config) => config.adAccountId !== adAccountId),
        savedConfig,
      ];
      writeGoogleIntegrationConfigsToStorage(committed);
      return savedConfig;
    }

    return nextConfig;
  } catch {
    return nextConfig;
  }
}

export async function fetchGoogleAdsLiveBreakdown({
  from,
  to,
  managerId,
  customerId,
}: {
  from: string;
  to: string;
  managerId?: string;
  customerId?: string;
}): Promise<GoogleAdsLiveBreakdownResponse> {
  const cacheKey = buildGoogleBreakdownCacheStorageKey({ from, to, managerId, customerId });
  const cachedBreakdown = readGoogleLiveBreakdownCache(cacheKey);
  let lastError: Error | undefined;

  try {
    const payload = await fetchGoogleAdsLiveBreakdownFromServer({ from, to, managerId, customerId });
    const livePayload: GoogleAdsLiveBreakdownResponse = {
      ...payload,
      cacheStatus: 'live',
      cacheMessage: null,
      servedFrom: 'server',
    };

    writeGoogleLiveBreakdownCache(cacheKey, livePayload);
    writeGoogleLiveRegistryCache(livePayload);
    return livePayload;
  } catch (error) {
    lastError =
      error instanceof Error ? error : new Error('Gagal mengambil live data Google Ads.');
  }

  if (cachedBreakdown) {
    return {
      ...cachedBreakdown,
      cacheStatus: 'stale',
      cacheMessage:
        lastError?.message ||
        'Live Google Ads sedang tidak aktif. Menampilkan snapshot terakhir yang tersimpan.',
      servedFrom: 'cache',
    };
  }

  const cachedRegistry = readGoogleLiveRegistryCache();
  if (cachedRegistry) {
    return {
      ...cachedRegistry,
      range: { from, to },
      cacheStatus: 'stale',
      cacheMessage:
        lastError?.message ||
        'Live Google Ads sedang tidak aktif. Menampilkan snapshot terakhir yang tersimpan.',
      servedFrom: 'cache',
    };
  }

  throw lastError || new Error('Gagal mengambil live data Google Ads.');
}

export async function fetchGoogleAdsSnapshotDataset({
  from,
  to,
  managerId,
  customerId,
  includeLastKnown = true,
}: {
  from: string;
  to: string;
  managerId?: string;
  customerId?: string;
  includeLastKnown?: boolean;
}) {
  const url = new URL(`${googleAdsFunctionsBaseUrl}/google/snapshots`);

  url.searchParams.set('from', from);
  url.searchParams.set('to', to);
  if (includeLastKnown) {
    url.searchParams.set('includeLastKnown', 'true');
  }

  if (managerId && managerId !== 'all') {
    url.searchParams.set('managerId', managerId);
  }

  if (customerId && customerId !== 'all') {
    url.searchParams.set('customerId', customerId);
  }

  const response = await fetch(url.toString(), {
    headers: await getSessionBackedEdgeHeaders(),
  });

  const payload = await response.json().catch(() => ({} as ServiceErrorPayload));
  if (!response.ok) {
    throw new Error(payload.error || 'Gagal mengambil snapshot Google Ads dari database.');
  }

  return payload as GoogleAdsSnapshotDatasetResponse;
}

export async function syncGoogleAdsSnapshotDataset({
  from,
  to,
  managerId,
  customerId,
  force = false,
  minFreshMinutes = 10,
}: {
  from: string;
  to: string;
  managerId?: string;
  customerId?: string;
  force?: boolean;
  minFreshMinutes?: number;
}) {
  const activeCooldown = readGoogleSyncCooldown();
  if (activeCooldown) {
    const payload = await fetchGoogleAdsSnapshotDataset({
      from,
      to,
      managerId,
      customerId,
      includeLastKnown: true,
    });
    return {
      ...payload,
      metadata: {
        ...payload.metadata,
        servedFrom:
          payload.metadata?.servedFrom === 'database-latest-known'
            ? 'database-latest-known'
            : 'google-rate-limit-cooldown',
        rateLimited: true,
        retryAfterSeconds: activeCooldown.retryAfterSeconds || null,
        cooldownMessage:
          activeCooldown.message || 'Google Ads API sedang rate limit. Snapshot terakhir tetap dipakai.',
      },
    } as GoogleAdsSnapshotDatasetResponse;
  }

  const response = await fetch(`${googleAdsFunctionsBaseUrl}/google/sync-snapshots`, {
    method: 'POST',
    headers: await getSessionBackedEdgeHeaders({ includeJsonContentType: true }),
    body: JSON.stringify({
      from,
      to,
      managerId: managerId && managerId !== 'all' ? managerId : undefined,
      customerId: customerId && customerId !== 'all' ? customerId : undefined,
      force,
      minFreshMinutes,
    }),
  });

  const payload = await response.json().catch(() => ({} as ServiceErrorPayload));
  if (!response.ok) {
    const rawMessage = payload.error || 'Sinkronisasi snapshot Google Ads gagal.';
    const retryAfterSeconds = parseGoogleRetryAfterSeconds(rawMessage);

    if (retryAfterSeconds) {
      writeGoogleSyncCooldown(retryAfterSeconds);
      const snapshotPayload = await fetchGoogleAdsSnapshotDataset({
        from,
        to,
        managerId,
        customerId,
        includeLastKnown: true,
      });
      return {
        ...snapshotPayload,
        metadata: {
          ...snapshotPayload.metadata,
          servedFrom:
            snapshotPayload.metadata?.servedFrom === 'database-latest-known'
              ? 'database-latest-known'
              : 'google-rate-limit-cooldown',
          rateLimited: true,
          retryAfterSeconds,
          cooldownMessage: formatGoogleCooldownMessage(retryAfterSeconds),
        },
      } as GoogleAdsSnapshotDatasetResponse;
    }

    throw new Error(rawMessage);
  }

  clearGoogleSyncCooldown();

  return payload as GoogleAdsSnapshotDatasetResponse;
}
