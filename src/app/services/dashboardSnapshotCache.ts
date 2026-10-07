const DASHBOARD_SNAPSHOT_CACHE_PREFIX = 'polesheadlamp_dashboard_snapshot_cache_v1';
const DASHBOARD_SNAPSHOT_CACHE_INDEX_KEY = 'polesheadlamp_dashboard_snapshot_cache_index_v1';
const DASHBOARD_SNAPSHOT_CACHE_LIMIT = 40;
const DEFAULT_MAX_AGE_MS = 6 * 60 * 60_000;

type DashboardSnapshotCacheEnvelope<T> = {
  value: T;
  cachedAt: number;
};

const buildCacheKey = (namespace: string, key: string) =>
  `${DASHBOARD_SNAPSHOT_CACHE_PREFIX}:${namespace}:${key}`;

const readIndex = () => {
  if (typeof window === 'undefined') return [] as string[];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(DASHBOARD_SNAPSHOT_CACHE_INDEX_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const writeIndex = (keys: string[]) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(DASHBOARD_SNAPSHOT_CACHE_INDEX_KEY, JSON.stringify(keys));
  } catch {
    // Dashboard cache is best effort.
  }
};

export function readDashboardSnapshotCache<T>(
  namespace: string,
  key: string | null,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
) {
  if (!key || typeof window === 'undefined') return null;

  try {
    const cacheKey = buildCacheKey(namespace, key);
    const parsed = JSON.parse(window.localStorage.getItem(cacheKey) || 'null') as DashboardSnapshotCacheEnvelope<T> | null;
    if (!parsed || !parsed.value || !Number.isFinite(parsed.cachedAt)) return null;
    if (Date.now() - parsed.cachedAt > maxAgeMs) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

export function writeDashboardSnapshotCache<T>(namespace: string, key: string | null, value: T) {
  if (!key || typeof window === 'undefined') return;

  const cacheKey = buildCacheKey(namespace, key);
  try {
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify({
        value,
        cachedAt: Date.now(),
      } satisfies DashboardSnapshotCacheEnvelope<T>),
    );

    const existingKeys = readIndex().filter((item) => item !== cacheKey);
    const nextKeys = [cacheKey, ...existingKeys].slice(0, DASHBOARD_SNAPSHOT_CACHE_LIMIT);
    writeIndex(nextKeys);

    for (const staleKey of existingKeys.slice(DASHBOARD_SNAPSHOT_CACHE_LIMIT - 1)) {
      window.localStorage.removeItem(staleKey);
    }
  } catch {
    // Dashboard cache is best effort.
  }
}
