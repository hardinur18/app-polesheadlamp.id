const NON_CRITICAL_LOCAL_STORAGE_KEYS = new Set([
  'polesheadlamp_dashboard_snapshot_cache_index_v1',
  'polesheadlamp_ads_snapshot_dataset_cache_index_v1',
  'polesheadlamp_meta_live_breakdown_cache_index_v1',
  'polesheadlamp_meta_live_registry_cache_v1',
  'polesheadlamp_google_live_breakdown_cache_index_v1',
  'polesheadlamp_google_live_registry_cache_v1',
  'polesheadlamp_tiktok_business_centers_cache_v1',
  'polesheadlamp_tiktok_advertisers_cache_v1',
  'polesheadlamp_ad_api_accounts_cache_v1',
  'polesheadlamp_ad_account_api_mappings_cache_v1',
  'rhi.dailyAds.syncHistory.v1',
]);

const NON_CRITICAL_LOCAL_STORAGE_PREFIXES = [
  'rhi-v2-master-data-cache:',
  'polesheadlamp_dashboard_snapshot_cache_v1:',
  'polesheadlamp_ads_snapshot_dataset_cache_v1:',
  'polesheadlamp_meta_live_breakdown_cache_v1:',
  'polesheadlamp_google_live_breakdown_cache_v1:',
];

export function isBrowserStorageQuotaError(error: unknown) {
  if (!error) return false;

  if (error instanceof DOMException) {
    return (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes('quota') ||
    normalizedMessage.includes('exceeded the quota') ||
    (normalizedMessage.includes('storage') && normalizedMessage.includes('exceed'))
  );
}

export function clearNonCriticalBrowserCaches() {
  if (typeof window === 'undefined') return 0;

  let removedCount = 0;

  for (const key of Object.keys(window.localStorage)) {
    const shouldRemove =
      NON_CRITICAL_LOCAL_STORAGE_KEYS.has(key) ||
      NON_CRITICAL_LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));

    if (!shouldRemove) continue;

    try {
      window.localStorage.removeItem(key);
      removedCount += 1;
    } catch {
      // Storage cleanup is best effort.
    }
  }

  return removedCount;
}
