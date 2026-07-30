import { buildMakeServerUrl } from './internal/functionsBaseUrl';
import { getSessionBackedEdgeHeaders } from './internal/sessionClientHeaders';
import type { ServiceErrorPayload } from './internal/serviceTypes';

const envMetaAccessToken = import.meta.env.VITE_META_ACCESS_TOKEN?.trim();
const envMetaAppSecret = import.meta.env.VITE_META_APP_SECRET?.trim();
const envMetaDirectFallback =
  import.meta.env.VITE_META_DIRECT_FALLBACK?.trim().toLowerCase() === 'true';
const envMetaGraphVersion = import.meta.env.VITE_META_GRAPH_VERSION?.trim() || 'v23.0';
const META_LIVE_BREAKDOWN_CACHE_INDEX_KEY = 'polesheadlamp_meta_live_breakdown_cache_index_v1';
const META_LIVE_BREAKDOWN_CACHE_PREFIX = 'polesheadlamp_meta_live_breakdown_cache_v1';
const META_LIVE_REGISTRY_CACHE_KEY = 'polesheadlamp_meta_live_registry_cache_v1';
const LOCAL_META_DIRECT_FALLBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export const functionsBaseUrl = buildMakeServerUrl();

export interface MetaLiveBusinessSnapshot {
  id: string;
  name: string;
  verificationStatus: string;
  accountCount: number;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
}

export interface MetaLiveAccountSnapshot {
  id: string;
  accountId: string;
  name: string;
  businessId: string | null;
  businessName: string;
  accountStatus: number | null;
  currency: string;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  cpc: number | null;
  ctr: number | null;
  cpm: number | null;
  cpp: number | null;
  dateStart: string;
  dateStop: string;
  error: string | null;
}

export interface MetaLiveBreakdownResponse {
  source: 'meta-live';
  generatedAt: string;
  requestedBy: string;
  cacheStatus?: 'live' | 'stale';
  cacheMessage?: string | null;
  servedFrom?: 'server' | 'local-direct' | 'cache';
  range: {
    from: string;
    to: string;
  };
  businesses: MetaLiveBusinessSnapshot[];
  accounts: MetaLiveAccountSnapshot[];
  summary: {
    businessCount: number;
    accountCount: number;
    spend: number;
    clicks: number;
    impressions: number;
    reach: number;
  };
}

export interface AdsIntegrationConfig {
  adAccountId: string;
  enabled: boolean;
  businessManagerId?: string;
  businessManagerName?: string;
  liveMetaAccountId?: string;
  liveMetaAccountName?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface MetaSnapshotRow {
  id: string;
  platformKey: 'meta';
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

export interface MetaSnapshotDatasetResponse {
  source: string;
  range: {
    from: string;
    to: string;
  };
  rows: MetaSnapshotRow[];
  metadata?: {
    rowCount?: number;
    lastSyncedAt?: string | null;
    upsertedCount?: number;
    servedFrom?: string;
    skippedSync?: boolean;
  };
}

type MetaDirectBusinessRecord = {
  id: string;
  name: string;
  verification_status?: string;
};

type MetaDirectAccountRecord = {
  id: string;
  account_id?: string;
  name?: string;
  account_status?: number | string;
  currency?: string;
  business?: {
    id?: string;
    name?: string;
  } | null;
};

type MetaDirectInsightsRecord = {
  account_id?: string;
  account_name?: string;
  spend?: string | number;
  clicks?: string | number;
  cpc?: string | number;
  ctr?: string | number;
  cpm?: string | number;
  cpp?: string | number;
  reach?: string | number;
  impressions?: string | number;
  date_start?: string;
  date_stop?: string;
};

const META_BATCH_SIZE = 50;
const ADS_INTEGRATION_CONFIG_STORAGE_KEY = 'polesheadlamp_ads_integration_configs_v1';

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function splitIntoChunks<T>(items: T[], chunkSize: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    result.push(items.slice(index, index + chunkSize));
  }
  return result;
}

function canUseMetaDirectFallback() {
  if (!envMetaDirectFallback || !envMetaAccessToken || typeof window === 'undefined') {
    return false;
  }

  return LOCAL_META_DIRECT_FALLBACK_HOSTS.has(window.location.hostname.toLowerCase());
}

function ensureMetaDirectFallbackAllowed() {
  if (!envMetaDirectFallback || !envMetaAccessToken) {
    throw new Error('VITE_META_ACCESS_TOKEN belum diatur untuk fallback lokal.');
  }

  if (!canUseMetaDirectFallback()) {
    throw new Error('Fallback lokal Meta hanya diizinkan saat app dibuka dari localhost.');
  }
}

async function fetchMetaJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || (!Array.isArray(payload) && payload?.error)) {
    throw new Error(
      (Array.isArray(payload) ? null : payload?.error?.message) ||
        'Meta Graph API request gagal.',
    );
  }

  return payload;
}

async function createDirectAppSecretProof(accessToken: string) {
  if (!envMetaAppSecret || typeof crypto === 'undefined' || !crypto.subtle) return null;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(envMetaAppSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(accessToken));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchMetaPagedDirect<T>(path: string, params: Record<string, string>) {
  ensureMetaDirectFallbackAllowed();

  const url = new URL(`https://graph.facebook.com/${envMetaGraphVersion}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('access_token', envMetaAccessToken);
  const appSecretProof = await createDirectAppSecretProof(envMetaAccessToken);
  if (appSecretProof) {
    url.searchParams.set('appsecret_proof', appSecretProof);
  }

  const rows: T[] = [];
  let nextUrl: string | null = url.toString();

  while (nextUrl) {
    const payload = await fetchMetaJson(nextUrl);
    if (Array.isArray(payload?.data)) {
      rows.push(...payload.data);
    }
    nextUrl = payload?.paging?.next || null;
  }

  return rows;
}

async function fetchMetaInsightsBatchDirect(
  accounts: MetaDirectAccountRecord[],
  from: string,
  to: string,
) {
  ensureMetaDirectFallbackAllowed();

  const appSecretProof = await createDirectAppSecretProof(envMetaAccessToken);

  const insightMap = new Map<
    string,
    {
      metrics: MetaDirectInsightsRecord | null;
      error: string | null;
    }
  >();

  const chunks = splitIntoChunks(accounts, META_BATCH_SIZE);
  for (const chunk of chunks) {
    const batch = chunk.map((account) => {
      const params = new URLSearchParams({
        fields:
          'account_id,account_name,spend,clicks,cpc,ctr,cpm,cpp,reach,impressions,date_start,date_stop',
        level: 'account',
        time_range: JSON.stringify({ since: from, until: to }),
        limit: '1',
      });

      return {
        method: 'GET',
        relative_url: `${account.id}/insights?${params.toString()}`,
      };
    });

    const body = new URLSearchParams({
      access_token: envMetaAccessToken,
      batch: JSON.stringify(batch),
    });
    if (appSecretProof) {
      body.set('appsecret_proof', appSecretProof);
    }

    const payload = await fetchMetaJson(`https://graph.facebook.com/${envMetaGraphVersion}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const responses = Array.isArray(payload) ? payload : [];
    chunk.forEach((account, index) => {
      const response = responses[index];
      if (!response) {
        insightMap.set(account.id, { metrics: null, error: 'Meta batch response missing' });
        return;
      }

      if (response.code !== 200) {
        insightMap.set(account.id, {
          metrics: null,
          error: `Meta batch error (${response.code})`,
        });
        return;
      }

      const parsedBody = JSON.parse(response.body || '{}');
      const metrics =
        Array.isArray(parsedBody?.data) && parsedBody.data.length > 0 ? parsedBody.data[0] : null;

      insightMap.set(account.id, {
        metrics,
        error: parsedBody?.error?.message || null,
      });
    });
  }

  return insightMap;
}

async function fetchMetaLiveBreakdownDirect({
  from,
  to,
  businessId,
  accountId,
}: {
  from: string;
  to: string;
  businessId?: string;
  accountId?: string;
}) {
  const [businesses, accounts] = await Promise.all([
    fetchMetaPagedDirect<MetaDirectBusinessRecord>('/me/businesses', {
      fields: 'id,name,verification_status',
      limit: '200',
    }),
    fetchMetaPagedDirect<MetaDirectAccountRecord>('/me/adaccounts', {
      fields: 'id,account_id,name,account_status,currency,business{id,name}',
      limit: '500',
    }),
  ]);

  const filteredAccounts = accounts.filter((account) => {
    if (businessId && businessId !== 'all' && account.business?.id !== businessId) return false;
    if (accountId && accountId !== 'all' && account.id !== accountId) return false;
    return true;
  });

  const insightMap = await fetchMetaInsightsBatchDirect(filteredAccounts, from, to);

  const accountSnapshots: MetaLiveAccountSnapshot[] = filteredAccounts
    .map((account) => {
      const insight = insightMap.get(account.id);
      const metrics = insight?.metrics;

      return {
        id: account.id,
        accountId: account.account_id || account.id.replace(/^act_/, ''),
        name: account.name || metrics?.account_name || account.id,
        businessId: account.business?.id || null,
        businessName: account.business?.name || 'Tanpa BM',
        accountStatus: account.account_status != null ? Number(account.account_status) : null,
        currency: account.currency || 'IDR',
        spend: toNumber(metrics?.spend),
        clicks: toNumber(metrics?.clicks),
        impressions: toNumber(metrics?.impressions),
        reach: toNumber(metrics?.reach),
        cpc: metrics?.cpc != null ? toNumber(metrics.cpc) : null,
        ctr: metrics?.ctr != null ? toNumber(metrics.ctr) : null,
        cpm: metrics?.cpm != null ? toNumber(metrics.cpm) : null,
        cpp: metrics?.cpp != null ? toNumber(metrics.cpp) : null,
        dateStart: metrics?.date_start || from,
        dateStop: metrics?.date_stop || to,
        error: insight?.error || null,
      };
    })
    .sort((left, right) => {
      if (right.spend !== left.spend) return right.spend - left.spend;
      return left.name.localeCompare(right.name);
    });

  const businessMap = new Map(
    businesses.map((business) => [
      business.id,
      {
        id: business.id,
        name: business.name,
        verificationStatus: business.verification_status || 'unknown',
        accountCount: 0,
        spend: 0,
        clicks: 0,
        impressions: 0,
        reach: 0,
      },
    ]),
  );

  for (const account of accountSnapshots) {
    if (!account.businessId) continue;
    const current =
      businessMap.get(account.businessId) || {
        id: account.businessId,
        name: account.businessName,
        verificationStatus: 'unknown',
        accountCount: 0,
        spend: 0,
        clicks: 0,
        impressions: 0,
        reach: 0,
      };

    current.accountCount += 1;
    current.spend += account.spend;
    current.clicks += account.clicks;
    current.impressions += account.impressions;
    current.reach += account.reach;
    businessMap.set(account.businessId, current);
  }

  const businessSnapshots = Array.from(businessMap.values()).sort((left, right) => {
    if (right.spend !== left.spend) return right.spend - left.spend;
    return left.name.localeCompare(right.name);
  });

  return {
    source: 'meta-live',
    generatedAt: new Date().toISOString(),
    requestedBy: 'local-dev',
    range: { from, to },
    businesses: businessSnapshots,
    accounts: accountSnapshots,
    summary: accountSnapshots.reduce(
      (acc, account) => {
        acc.accountCount += 1;
        acc.businessCount = businessSnapshots.length;
        acc.spend += account.spend;
        acc.clicks += account.clicks;
        acc.impressions += account.impressions;
        acc.reach += account.reach;
        return acc;
      },
      {
        businessCount: businessSnapshots.length,
        accountCount: 0,
        spend: 0,
        clicks: 0,
        impressions: 0,
        reach: 0,
      },
    ),
  } satisfies MetaLiveBreakdownResponse;
}

function readIntegrationConfigsFromStorage() {
  if (typeof window === 'undefined') return [] as AdsIntegrationConfig[];

  try {
    const raw = window.localStorage.getItem(ADS_INTEGRATION_CONFIG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdsIntegrationConfig[]) : [];
  } catch {
    return [];
  }
}

function writeIntegrationConfigsToStorage(configs: AdsIntegrationConfig[]) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(ADS_INTEGRATION_CONFIG_STORAGE_KEY, JSON.stringify(configs));
}

function buildMetaBreakdownCacheStorageKey({
  from,
  to,
  businessId,
  accountId,
}: {
  from: string;
  to: string;
  businessId?: string;
  accountId?: string;
}) {
  return `${META_LIVE_BREAKDOWN_CACHE_PREFIX}:${from}:${to}:${businessId || 'all'}:${accountId || 'all'}`;
}

function readMetaBreakdownCacheIndex() {
  if (typeof window === 'undefined') return [] as string[];

  try {
    const raw = window.localStorage.getItem(META_LIVE_BREAKDOWN_CACHE_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function writeMetaBreakdownCacheIndex(keys: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(META_LIVE_BREAKDOWN_CACHE_INDEX_KEY, JSON.stringify(keys));
}

function readMetaLiveBreakdownCache(cacheKey: string) {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed as MetaLiveBreakdownResponse;
  } catch {
    return null;
  }
}

function writeMetaLiveBreakdownCache(
  cacheKey: string,
  payload: MetaLiveBreakdownResponse,
) {
  if (typeof window === 'undefined') return;

  const sanitizedPayload: MetaLiveBreakdownResponse = {
    ...payload,
    cacheStatus: 'live',
    cacheMessage: null,
  };

  window.localStorage.setItem(cacheKey, JSON.stringify(sanitizedPayload));

  const existingKeys = readMetaBreakdownCacheIndex().filter((key) => key !== cacheKey);
  const nextKeys = [cacheKey, ...existingKeys].slice(0, 10);
  writeMetaBreakdownCacheIndex(nextKeys);

  for (const staleKey of existingKeys.slice(9)) {
    window.localStorage.removeItem(staleKey);
  }
}

function readMetaLiveRegistryCache() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(META_LIVE_REGISTRY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed as MetaLiveBreakdownResponse;
  } catch {
    return null;
  }
}

function writeMetaLiveRegistryCache(payload: MetaLiveBreakdownResponse) {
  if (typeof window === 'undefined') return;

  const sanitizedPayload: MetaLiveBreakdownResponse = {
    ...payload,
    cacheStatus: 'live',
    cacheMessage: null,
  };

  window.localStorage.setItem(META_LIVE_REGISTRY_CACHE_KEY, JSON.stringify(sanitizedPayload));
}

export function getCachedMetaLiveRegistry() {
  return readMetaLiveRegistryCache();
}

export function getCachedMetaLiveBreakdown({
  from,
  to,
  businessId,
  accountId,
}: {
  from: string;
  to: string;
  businessId?: string;
  accountId?: string;
}) {
  return readMetaLiveBreakdownCache(
    buildMetaBreakdownCacheStorageKey({ from, to, businessId, accountId }),
  );
}

async function fetchMetaLiveBreakdownFromServer({
  from,
  to,
  businessId,
  accountId,
}: {
  from: string;
  to: string;
  businessId?: string;
  accountId?: string;
}) {
  const url = new URL(`${functionsBaseUrl}/meta/live-breakdown`);

  url.searchParams.set('from', from);
  url.searchParams.set('to', to);

  if (businessId && businessId !== 'all') {
    url.searchParams.set('businessId', businessId);
  }

  if (accountId && accountId !== 'all') {
    url.searchParams.set('accountId', accountId);
  }

  const response = await fetch(url.toString(), {
    headers: await getSessionBackedEdgeHeaders(),
  });

  const payload = await response.json().catch(() => ({} as ServiceErrorPayload));

  if (!response.ok) {
    throw new Error(payload.error || 'Gagal mengambil live data Meta.');
  }

  return payload as MetaLiveBreakdownResponse;
}

export async function fetchAdsIntegrationConfigs() {
  try {
    const response = await fetch(`${functionsBaseUrl}/meta/integration-configs`, {
      headers: await getSessionBackedEdgeHeaders(),
    });
    const payload = await response.json().catch(() => ({} as ServiceErrorPayload));

    if (!response.ok) {
      throw new Error(payload.error || 'Gagal mengambil config integrasi iklan.');
    }

    const configs = Array.isArray(payload?.configs) ? (payload.configs as AdsIntegrationConfig[]) : [];
    writeIntegrationConfigsToStorage(configs);
    return configs;
  } catch {
    return readIntegrationConfigsFromStorage();
  }
}

export async function saveAdsIntegrationConfig(
  adAccountId: string,
  enabled: boolean,
  extra?: Partial<AdsIntegrationConfig>,
) {
  const localConfigs = readIntegrationConfigsFromStorage();
  const existingConfig = localConfigs.find((config) => config.adAccountId === adAccountId);
  const nextConfig: AdsIntegrationConfig = {
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
  writeIntegrationConfigsToStorage(mergedLocalConfigs);

  try {
    const response = await fetch(`${functionsBaseUrl}/meta/integration-configs/${adAccountId}`, {
      method: 'POST',
      headers: await getSessionBackedEdgeHeaders({ includeJsonContentType: true }),
      body: JSON.stringify({
        enabled,
        businessManagerId: extra?.businessManagerId,
        businessManagerName: extra?.businessManagerName,
        liveMetaAccountId: extra?.liveMetaAccountId,
        liveMetaAccountName: extra?.liveMetaAccountName,
      }),
    });
    const payload = await response.json().catch(() => ({} as ServiceErrorPayload));

    if (!response.ok) {
      throw new Error(payload.error || 'Gagal menyimpan config integrasi iklan.');
    }

    const savedConfig = payload?.config as AdsIntegrationConfig | undefined;
    if (savedConfig) {
      const committed = [
        ...mergedLocalConfigs.filter((config) => config.adAccountId !== adAccountId),
        savedConfig,
      ];
      writeIntegrationConfigsToStorage(committed);
      return savedConfig;
    }

    return nextConfig;
  } catch {
    return nextConfig;
  }
}

export async function fetchMetaLiveBreakdown({
  from,
  to,
  businessId,
  accountId,
}: {
  from: string;
  to: string;
  businessId?: string;
  accountId?: string;
}): Promise<MetaLiveBreakdownResponse> {
  const cacheKey = buildMetaBreakdownCacheStorageKey({ from, to, businessId, accountId });
  const cachedBreakdown = readMetaLiveBreakdownCache(cacheKey);
  let serverError: Error | undefined;

  try {
    const payload = await fetchMetaLiveBreakdownFromServer({ from, to, businessId, accountId });
    const livePayload: MetaLiveBreakdownResponse = {
      ...payload,
      cacheStatus: 'live',
      cacheMessage: null,
      servedFrom: 'server',
    };

    writeMetaLiveBreakdownCache(cacheKey, livePayload);
    writeMetaLiveRegistryCache(livePayload);
    return livePayload;
  } catch (error) {
    serverError = error instanceof Error ? error : new Error('Gagal mengambil live data Meta.');
  }

  let lastError = serverError;
  if (canUseMetaDirectFallback()) {
    try {
      const payload = await fetchMetaLiveBreakdownDirect({ from, to, businessId, accountId });
      const livePayload: MetaLiveBreakdownResponse = {
        ...payload,
        cacheStatus: 'live',
        cacheMessage: null,
        servedFrom: 'local-direct',
      };

      writeMetaLiveBreakdownCache(cacheKey, livePayload);
      writeMetaLiveRegistryCache(livePayload);
      return livePayload;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Gagal mengambil live data Meta.');
    }
  }

  if (cachedBreakdown) {
    return {
      ...cachedBreakdown,
      cacheStatus: 'stale',
      cacheMessage:
        lastError?.message ||
        'Live Meta sedang tidak aktif. Menampilkan snapshot terakhir yang tersimpan.',
      servedFrom: 'cache',
    };
  }

  const cachedRegistry = readMetaLiveRegistryCache();
  if (cachedRegistry) {
    return {
      ...cachedRegistry,
      range: { from, to },
      cacheStatus: 'stale',
      cacheMessage:
        lastError?.message ||
        'Live Meta sedang tidak aktif. Menampilkan snapshot terakhir yang tersimpan.',
      servedFrom: 'cache',
    };
  }

  throw lastError || new Error('Gagal mengambil live data Meta.');
}

export async function fetchMetaSnapshotDataset({
  from,
  to,
  businessId,
  accountId,
  includeLastKnown = false,
}: {
  from: string;
  to: string;
  businessId?: string;
  accountId?: string;
  includeLastKnown?: boolean;
}) {
  const url = new URL(`${functionsBaseUrl}/meta/snapshots`);

  url.searchParams.set('from', from);
  url.searchParams.set('to', to);

  if (businessId && businessId !== 'all') {
    url.searchParams.set('businessId', businessId);
  }

  if (accountId && accountId !== 'all') {
    url.searchParams.set('accountId', accountId);
  }

  if (includeLastKnown) {
    url.searchParams.set('includeLastKnown', 'true');
  }

  const response = await fetch(url.toString(), {
    headers: await getSessionBackedEdgeHeaders(),
  });

  const payload = await response.json().catch(() => ({} as ServiceErrorPayload));
  if (!response.ok) {
    throw new Error(payload.error || 'Gagal mengambil snapshot Meta dari database.');
  }

  return payload as MetaSnapshotDatasetResponse;
}

export async function syncMetaSnapshotDataset({
  from,
  to,
  businessId,
  accountId,
  force = false,
  minFreshMinutes = 10,
}: {
  from: string;
  to: string;
  businessId?: string;
  accountId?: string;
  force?: boolean;
  minFreshMinutes?: number;
}) {
  const response = await fetch(`${functionsBaseUrl}/meta/sync-snapshots`, {
    method: 'POST',
    headers: await getSessionBackedEdgeHeaders({ includeJsonContentType: true }),
    body: JSON.stringify({
      from,
      to,
      businessId: businessId && businessId !== 'all' ? businessId : undefined,
      accountId: accountId && accountId !== 'all' ? accountId : undefined,
      force,
      minFreshMinutes,
    }),
  });

  const payload = await response.json().catch(() => ({} as ServiceErrorPayload));
  if (!response.ok) {
    throw new Error(payload.error || 'Sinkronisasi snapshot Meta gagal.');
  }

  return payload as MetaSnapshotDatasetResponse;
}
