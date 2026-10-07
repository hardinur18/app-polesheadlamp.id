import { supabase } from '@/lib/supabaseClient';

export type AdsSnapshotPlatformKey = 'meta' | 'google' | 'tiktok';

export type AdsSnapshotFallbackRow = {
  id: string;
  platformKey: AdsSnapshotPlatformKey;
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
};

type AdsSnapshotDbRow = {
  id: string;
  platform_key: AdsSnapshotPlatformKey;
  snapshot_date: string;
  internal_ad_account_id: string | null;
  advertiser_id: string | null;
  platform_id: string | null;
  external_account_id: string;
  external_account_name: string;
  external_group_id: string | null;
  external_group_name: string | null;
  external_account_status: string | null;
  currency_code: string | null;
  spend: number | string | null;
  clicks: number | string | null;
  impressions: number | string | null;
  reach: number | string | null;
  conversions: number | string | null;
  ctr: number | string | null;
  cpc: number | string | null;
  cpm: number | string | null;
  cost_per_conversion: number | string | null;
  error: string | null;
  synced_at: string | null;
  updated_at?: string | null;
};

const SNAPSHOT_DB_READ_TIMEOUT_MS = 6_000;
const SNAPSHOT_LATEST_KNOWN_READ_LIMIT = 1000;
const SNAPSHOT_DATASET_CACHE_PREFIX = 'polesheadlamp_ads_snapshot_dataset_cache_v1';
const SNAPSHOT_DATASET_CACHE_INDEX_KEY = 'polesheadlamp_ads_snapshot_dataset_cache_index_v1';
const SNAPSHOT_DATASET_CACHE_LIMIT = 30;
const SNAPSHOT_DATASET_CACHE_MAX_AGE_MS = 24 * 60 * 60_000;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function withSnapshotDbTimeout<T>(promise: PromiseLike<T>, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => reject(new Error(message)), SNAPSHOT_DB_READ_TIMEOUT_MS);
  });

  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timeoutId) globalThis.clearTimeout(timeoutId);
  });
}

function readCacheIndex() {
  if (typeof window === 'undefined') return [] as string[];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SNAPSHOT_DATASET_CACHE_INDEX_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : [];
  } catch {
    return [];
  }
}

function writeCacheIndex(keys: string[]) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(SNAPSHOT_DATASET_CACHE_INDEX_KEY, JSON.stringify(keys));
  } catch {
    // Cache is an optimization only.
  }
}

function buildSnapshotDatasetCacheKey({
  platformKey,
  from,
  to,
  externalAccountIds,
  externalGroupId,
  includeLastKnown,
}: {
  platformKey: AdsSnapshotPlatformKey;
  from: string;
  to: string;
  externalAccountIds?: string[];
  externalGroupId?: string;
  includeLastKnown?: boolean;
}) {
  return [
    SNAPSHOT_DATASET_CACHE_PREFIX,
    platformKey,
    from,
    to,
    normalizeIds(externalAccountIds).sort().join(',') || 'all-accounts',
    externalGroupId || 'all-groups',
    includeLastKnown ? 'last-known' : 'strict-range',
  ].join(':');
}

function readCachedSnapshotDataset(cacheKey: string) {
  if (typeof window === 'undefined') return null;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(cacheKey) || 'null');
    if (!parsed || !Array.isArray(parsed.rows)) return null;
    const cachedAt = parsed.metadata?.cachedAt ? new Date(parsed.metadata.cachedAt).getTime() : Number.NaN;
    if (!Number.isFinite(cachedAt) || Date.now() - cachedAt > SNAPSHOT_DATASET_CACHE_MAX_AGE_MS) {
      window.localStorage.removeItem(cacheKey);
      return null;
    }

    return parsed as {
      rows: AdsSnapshotFallbackRow[];
      metadata?: {
        rowCount?: number;
        lastSyncedAt?: string | null;
        servedFrom?: string;
        fallbackSnapshotDate?: string | null;
        cachedAt?: string;
      };
    };
  } catch {
    return null;
  }
}

function writeCachedSnapshotDataset(cacheKey: string, rows: AdsSnapshotFallbackRow[], metadata: Record<string, unknown>) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify({
        rows,
        metadata: {
          ...metadata,
          cachedAt: new Date().toISOString(),
        },
      }),
    );

    const existingKeys = readCacheIndex().filter((key) => key !== cacheKey);
    const nextKeys = [cacheKey, ...existingKeys].slice(0, SNAPSHOT_DATASET_CACHE_LIMIT);
    writeCacheIndex(nextKeys);

    for (const staleKey of existingKeys.slice(SNAPSHOT_DATASET_CACHE_LIMIT - 1)) {
      window.localStorage.removeItem(staleKey);
    }
  } catch {
    // Cache is best effort.
  }
}

function toNullableNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapSnapshotRow(row: AdsSnapshotDbRow): AdsSnapshotFallbackRow {
  return {
    id: row.id,
    platformKey: row.platform_key,
    snapshotDate: row.snapshot_date,
    internalAdAccountId: row.internal_ad_account_id || null,
    advertiserId: row.advertiser_id || null,
    platformId: row.platform_id || null,
    externalAccountId: row.external_account_id,
    externalAccountName: row.external_account_name,
    externalGroupId: row.external_group_id || null,
    externalGroupName: row.external_group_name || null,
    externalAccountStatus: row.external_account_status || null,
    currencyCode: row.currency_code || null,
    spend: toNumber(row.spend),
    clicks: toNumber(row.clicks),
    impressions: toNumber(row.impressions),
    reach: toNumber(row.reach),
    conversions: toNumber(row.conversions),
    ctr: toNullableNumber(row.ctr),
    cpc: toNullableNumber(row.cpc),
    cpm: toNullableNumber(row.cpm),
    costPerConversion: toNullableNumber(row.cost_per_conversion),
    error: row.error || null,
    syncedAt: row.synced_at || undefined,
  };
}

function getMaxTimestamp(rows: AdsSnapshotFallbackRow[]) {
  const timestamps = rows
    .map((row) => (row.syncedAt ? new Date(row.syncedAt).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

function normalizeIds(ids?: string[]) {
  return Array.from(new Set((ids || []).map((id) => id.trim()).filter(Boolean)));
}

export function buildMetaAccountIdVariants(accountId?: string | null) {
  const trimmed = String(accountId || '').trim();
  if (!trimmed) return [];

  const withoutPrefix = trimmed.replace(/^act_/i, '');
  return normalizeIds([trimmed, withoutPrefix, `act_${withoutPrefix}`]);
}

export async function fetchAdsSnapshotDatasetFromSupabase<T extends AdsSnapshotFallbackRow>({
  platformKey,
  from,
  to,
  externalAccountIds,
  externalGroupId,
  includeLastKnown,
  source = 'client-snapshot-db',
}: {
  platformKey: AdsSnapshotPlatformKey;
  from: string;
  to: string;
  externalAccountIds?: string[];
  externalGroupId?: string;
  includeLastKnown?: boolean;
  source?: string;
}) {
  const accountIds = normalizeIds(externalAccountIds);
  const cacheKey = buildSnapshotDatasetCacheKey({
    platformKey,
    from,
    to,
    externalAccountIds: accountIds,
    externalGroupId,
    includeLastKnown,
  });

  try {
  let query = supabase
    .from('ads_live_daily_snapshots')
    .select('*')
    .eq('platform_key', platformKey)
    .gte('snapshot_date', from)
    .lte('snapshot_date', to)
    .order('snapshot_date', { ascending: true })
    .order('external_account_name', { ascending: true });

  if (accountIds.length === 1) {
    query = query.eq('external_account_id', accountIds[0]);
  } else if (accountIds.length > 1) {
    query = query.in('external_account_id', accountIds);
  }

  if (externalGroupId && externalGroupId !== 'all') {
    query = query.eq('external_group_id', externalGroupId);
  }

  const { data, error } = await withSnapshotDbTimeout(
    query,
    `Snapshot ${platformKey} dari database terlalu lama.`,
  );
  if (error) throw new Error(error.message);

  let rows = ((data || []) as AdsSnapshotDbRow[]).map(mapSnapshotRow);
  let servedFrom = source;
  let fallbackSnapshotDate: string | null = null;

  if (includeLastKnown && rows.length === 0) {
    let latestQuery = supabase
      .from('ads_live_daily_snapshots')
      .select('*')
      .eq('platform_key', platformKey)
      .lte('snapshot_date', to)
      .order('snapshot_date', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(SNAPSHOT_LATEST_KNOWN_READ_LIMIT);

    if (accountIds.length === 1) {
      latestQuery = latestQuery.eq('external_account_id', accountIds[0]);
    } else if (accountIds.length > 1) {
      latestQuery = latestQuery.in('external_account_id', accountIds);
    }

    if (externalGroupId && externalGroupId !== 'all') {
      latestQuery = latestQuery.eq('external_group_id', externalGroupId);
    }

    const { data: latestData, error: latestError } = await withSnapshotDbTimeout(
      latestQuery,
      `Snapshot terakhir ${platformKey} dari database terlalu lama.`,
    );
    if (latestError) throw new Error(latestError.message);

    const latestByAccount = new Map<string, AdsSnapshotDbRow>();
    for (const row of (latestData || []) as AdsSnapshotDbRow[]) {
      if (!row.external_account_id || latestByAccount.has(row.external_account_id)) continue;
      latestByAccount.set(row.external_account_id, row);
    }

    rows = Array.from(latestByAccount.values()).map(mapSnapshotRow);
    servedFrom = rows.length > 0 ? 'client-database-latest-known' : servedFrom;
    fallbackSnapshotDate = rows[0]?.snapshotDate || null;
  }

  const metadata = {
    rowCount: rows.length,
    lastSyncedAt: getMaxTimestamp(rows),
    servedFrom,
    fallbackSnapshotDate,
  };

  writeCachedSnapshotDataset(cacheKey, rows, metadata);

  return {
    source: servedFrom,
    range: { from, to },
    rows: rows as T[],
    metadata,
  };
  } catch (error) {
    const cached = readCachedSnapshotDataset(cacheKey);
    if (cached) {
      return {
        source: 'client-snapshot-cache',
        range: { from, to },
        rows: cached.rows as T[],
        metadata: {
          ...cached.metadata,
          rowCount: cached.rows.length,
          servedFrom: 'client-snapshot-cache',
          fallbackReason: error instanceof Error ? error.message : 'Snapshot database gagal dimuat.',
        },
      };
    }

    throw error;
  }
}
