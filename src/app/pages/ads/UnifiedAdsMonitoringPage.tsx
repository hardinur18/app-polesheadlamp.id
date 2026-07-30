import React from 'react';
import type { DateRange } from 'react-day-picker';
import {
  AlertCircle,
} from 'lucide-react';
import { endOfMonth, format, startOfMonth, subDays, subMonths } from 'date-fns';

import { useMasterData } from '@/app/pages/master-data/context';
import { isAdvertiserRole } from '@/app/data/roleHelpers';
import { Card } from '@/app/components/ui/card';
import { minutesToMs, useUsageControlSettings } from '@/app/services/usageControlSettings';
import {
  fetchAdsIntegrationConfigs,
  fetchMetaSnapshotDataset,
  syncMetaSnapshotDataset,
  type AdsIntegrationConfig,
  type MetaLiveBreakdownResponse,
  type MetaSnapshotDatasetResponse,
  type MetaSnapshotRow,
} from '@/app/services/liveAdsService';
import {
  fetchGoogleAdsIntegrationConfigs,
  fetchGoogleAdsLiveBreakdown,
  fetchGoogleAdsSnapshotDataset,
  getCachedGoogleAdsLiveBreakdown,
  getCachedGoogleAdsLiveRegistry,
  syncGoogleAdsSnapshotDataset,
  type GoogleAdsIntegrationConfig,
  type GoogleAdsLiveBreakdownResponse,
  type GoogleAdsSnapshotDatasetResponse,
  type GoogleAdsSnapshotRow,
} from '@/app/services/googleAdsLiveService';
import {
  fetchTikTokAdsIntegrationConfigs,
  fetchTikTokAdsSnapshotDataset,
  syncTikTokAdsSnapshotDataset,
  type TikTokAdsIntegrationConfig,
  type TikTokAdsSnapshotDatasetResponse,
  type TikTokAdsSnapshotRow,
} from '@/app/services/tiktokAdsLiveService';
import type {
  IntegrasiIklanOption,
  IntegrasiIklanSummary,
  LeadSource,
  UnifiedPerformanceRow,
} from './integrasiIklanTypes';
import { IntegrasiIklanFilters } from './components/IntegrasiIklanFilters';
import { IntegrasiIklanSummaryCards } from './components/IntegrasiIklanSummaryCards';
import { IntegrasiIklanTable } from './components/IntegrasiIklanTable';
import { ADS_MONITORING_FOUNDATION_CONFIG } from './openclaw-foundation';

type AccountGroupMeta = {
  id: string;
  name: string;
};


const ACCOUNT_GROUP_PRESETS: Record<string, AccountGroupMeta> = {
  bpnxcln4x: { id: 'bm-rahmanshafashion', name: 'Business Manager rahmanshafashion' },
  '7s9okdilm': { id: 'bm-rahmanshafashion', name: 'Business Manager rahmanshafashion' },
  khx9v5llk: { id: 'bm-fajri-agung-pratama', name: 'Business Manager FAJRI AGUNG Pratama' },
  eu7c8kd06: { id: 'bm-fajri-agung-pratama', name: 'Business Manager FAJRI AGUNG Pratama' },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatNumber = (value: number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value || 0);

const formatPercent = (value: number | null | undefined) =>
  value == null
    ? '-'
    : `${new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value)}%`;

const normalizePlatformKey = (name: string) => name.toLowerCase().replace(/\s+/g, '');
const isMetaPlatformName = (name: string) => normalizePlatformKey(name).includes('meta');
const isGooglePlatformName = (name: string) => normalizePlatformKey(name).includes('google');
const isTikTokPlatformName = (name: string) => normalizePlatformKey(name).includes('tiktok');
const isUnifiedPerformanceRow = (row: UnifiedPerformanceRow | null): row is UnifiedPerformanceRow =>
  row !== null;
const normalizeLookupKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
const GOOGLE_LOOKUP_STOPWORDS = /\b(google|ads|account|akun|iklan)\b/gi;
const getTrailingNumberKey = (value: string) => value.match(/(\d+)\s*$/)?.[1] || '';
const buildLookupKeys = (value: string) => {
  const keys = new Set<string>();
  const primaryKey = normalizeLookupKey(value);
  if (primaryKey) keys.add(primaryKey);

  const withoutGoogleStopwords = normalizeLookupKey(value.replace(GOOGLE_LOOKUP_STOPWORDS, ' '));
  if (withoutGoogleStopwords) keys.add(withoutGoogleStopwords);

  return [...keys];
};
const buildFlexibleLookupKeys = (value: string) => {
  const keys = new Set<string>();
  const add = (candidate: string) => {
    const key = normalizeLookupKey(candidate);
    if (key) keys.add(key);
  };

  add(value);
  add(value.replace(/\b(akun|account|ads?|iklan|meta|facebook|fb|tiktok|tik\s*tok|snack\s*video)\b/gi, ' '));
  add(value.replace(/\b(cv|pt)\b/gi, ' '));
  add(value.replace(/\s+\d+\s*$/g, ' '));
  add(
    value
      .replace(/\b(cv|pt)\b/gi, ' ')
      .replace(/\s+\d+\s*$/g, ' '),
  );

  return [...keys];
};
const addUniqueTrailingNumberLookup = <T,>(
  map: Map<string, T>,
  duplicateKeys: Set<string>,
  value: string,
  item: T,
) => {
  const key = getTrailingNumberKey(value);
  if (!key) return;
  if (map.has(key)) {
    duplicateKeys.add(key);
    map.delete(key);
    return;
  }
  if (!duplicateKeys.has(key)) {
    map.set(key, item);
  }
};

const deriveAccountGroup = (
  accountId: string,
  platformName: string,
  advertiserName: string,
): AccountGroupMeta => {
  const preset = ACCOUNT_GROUP_PRESETS[accountId];
  if (preset) return preset;

  const platformKey = normalizePlatformKey(platformName);

  if (platformKey.includes('meta')) {
    return { id: `bm-meta-unmapped-${accountId}`, name: 'Business Manager Meta Belum Dipetakan' };
  }
  if (platformKey.includes('google')) {
    return { id: `group-google-${advertiserName}`, name: `Google Ads • ${advertiserName}` };
  }
  if (platformKey.includes('tiktok')) {
    return { id: `group-tiktok-${advertiserName}`, name: `TikTok Ads • ${advertiserName}` };
  }
  if (platformKey === 'snackvideo') {
    return { id: `group-snackvideo-${advertiserName}`, name: `SnackVideo Ads • ${advertiserName}` };
  }

  return { id: `group-${platformKey}-${advertiserName}`, name: `${platformName} • ${advertiserName}` };
};

const sanitizeTikTokBusinessCenterName = (value?: string | null) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;

  return normalized.replace(/^bm[\s\-:|]+/i, '').trim() || null;
};

const TIKTOK_ORDER_CS_OVERRIDES = {
  lrp83ud9p: {
    label: 'Tokotemansaya digital media 07 -> Dita',
    csId: '6df069d1-efe3-40ff-aa30-1bd4ca49f4fd',
  },
  ts7tjm90z: {
    label: 'Nature care 29 -> lane Rida TikTok',
    csId: 'de730808-b4ae-4eea-b0c5-66c58e2761b7',
  },
} as const;

const TIKTOK_ORDER_SUBCHANNEL_OVERRIDES = {
  lrp83ud9p: {
    label: 'Tokotemansaya digital media 07 -> 95be8zp6r',
    subChannelId: '95be8zp6r',
  },
} as const;

const buildAdvertiserPlatformKey = (advertiserId: string, platformId: string) =>
  `${advertiserId}::${platformId}`;

const getOrderAttributionDateKey = (order: { leadDate?: string; created_at?: string }) =>
  order.created_at?.slice(0, 10) || order.leadDate || null;

const allocateCountsProportionally = (
  rows: UnifiedPerformanceRow[],
  unresolvedByAdvertiserPlatform: Map<
    string,
    {
      leads: number;
      lastDate: string | null;
    }
  >,
) => {
  const allocations = new Map<string, number>();

  for (const [groupKey, unresolved] of unresolvedByAdvertiserPlatform.entries()) {
    if (unresolved.leads <= 0) continue;

    const groupRows = rows.filter(
      (row) => buildAdvertiserPlatformKey(row.advertiserId, row.platformId) === groupKey,
    );
    if (groupRows.length === 0) continue;

    const totalSpendWeight = groupRows.reduce(
      (sum, row) => sum + Math.max(row.spend, 0),
      0,
    );

    const weightedRows = groupRows.map((row) => {
      const weight =
        totalSpendWeight > 0
          ? Math.max(row.spend, 0) / totalSpendWeight
          : 1 / groupRows.length;
      const rawShare = weight * unresolved.leads;
      return {
        accountId: row.adAccountId,
        floorShare: Math.floor(rawShare),
        fraction: rawShare - Math.floor(rawShare),
        spend: row.spend,
      };
    });

    let distributed = weightedRows.reduce((sum, row) => sum + row.floorShare, 0);
    let remainder = unresolved.leads - distributed;

    weightedRows.sort((left, right) => {
      if (right.fraction !== left.fraction) return right.fraction - left.fraction;
      if (right.spend !== left.spend) return right.spend - left.spend;
      return left.accountId.localeCompare(right.accountId);
    });

    for (const row of weightedRows) {
      const nextShare = row.floorShare + (remainder > 0 ? 1 : 0);
      if (nextShare > 0) {
        allocations.set(row.accountId, (allocations.get(row.accountId) || 0) + nextShare);
      }
      if (remainder > 0) remainder -= 1;
      distributed += nextShare - row.floorShare;
    }
  }

  return allocations;
};

const getDateRangeValueKey = (range: DateRange | undefined) => {
  if (!range?.from) return 'empty';

  const from = format(range.from, 'yyyy-MM-dd');
  const to = format(range.to || range.from, 'yyyy-MM-dd');
  return `${from}:${to}`;
};

const computeLatestSyncedAt = (values: Array<string | null | undefined>) => {
  const timestamps = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
};

const extractRetryAfterSeconds = (message?: string | null) => {
  const matched = String(message || '').match(/retry in\s+(\d+)\s+seconds?/i);
  if (!matched) return null;

  const seconds = Number(matched[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
};

const formatRetryDelayLabel = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}j ${Math.max(minutes, 0)}m`;
  }

  return `${Math.max(minutes, 1)}m`;
};

const mergeSnapshotRows = <
  T extends {
    platformKey: string;
    snapshotDate: string;
    externalAccountId: string;
    externalAccountName: string;
    syncedAt?: string;
  },
>(
  currentRows: T[],
  incomingRows: T[],
) => {
  const rowMap = new Map<string, T>();

  for (const row of currentRows) {
    rowMap.set(`${row.platformKey}:${row.snapshotDate}:${row.externalAccountId}`, row);
  }

  for (const row of incomingRows) {
    const key = `${row.platformKey}:${row.snapshotDate}:${row.externalAccountId}`;
    const existingRow = rowMap.get(key);

    if (!existingRow) {
      rowMap.set(key, row);
      continue;
    }

    const existingSyncedAt = existingRow.syncedAt ? new Date(existingRow.syncedAt).getTime() : 0;
    const nextSyncedAt = row.syncedAt ? new Date(row.syncedAt).getTime() : 0;
    rowMap.set(key, nextSyncedAt >= existingSyncedAt ? row : existingRow);
  }

  return Array.from(rowMap.values()).sort((left, right) => {
    if (left.snapshotDate !== right.snapshotDate) {
      return left.snapshotDate.localeCompare(right.snapshotDate);
    }
    return left.externalAccountName.localeCompare(right.externalAccountName);
  });
};

export function UnifiedAdsMonitoringPage() {
  const usageControlSettings = useUsageControlSettings();
  const todayLiveRefreshMs = minutesToMs(usageControlSettings.adsTodayLiveRefreshMinutes);
  const { adAccounts, dailyAds, orders, platforms, users } = useMasterData();

  const [selectedDateRange, setSelectedDateRange] = React.useState<DateRange | undefined>(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  }));
  const appliedDateRange = React.useDeferredValue(selectedDateRange);
  const [selectedPlatformId, setSelectedPlatformId] = React.useState('all');
  const [selectedGroupId, setSelectedGroupId] = React.useState('all');
  const [selectedAdvertiserId, setSelectedAdvertiserId] = React.useState('all');
  const [selectedAdAccountId, setSelectedAdAccountId] = React.useState('all');
  const todayKey = React.useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const recentSnapshotRange = React.useMemo(() => {
    const now = new Date();
    return {
      from: format(subDays(now, ADS_MONITORING_FOUNDATION_CONFIG.historyWindowDays), 'yyyy-MM-dd'),
      to: format(subDays(now, 1), 'yyyy-MM-dd'),
    };
  }, []);
  const [metaSnapshotRows, setMetaSnapshotRows] = React.useState<MetaSnapshotRow[]>([]);
  const [googleSnapshotRows, setGoogleSnapshotRows] = React.useState<GoogleAdsSnapshotRow[]>([]);
  const [googleLatestKnownSnapshotRows, setGoogleLatestKnownSnapshotRows] = React.useState<
    GoogleAdsSnapshotRow[]
  >([]);
  const [tiktokSnapshotRows, setTikTokSnapshotRows] = React.useState<TikTokAdsSnapshotRow[]>([]);
  const [metaTodayRows, setMetaTodayRows] = React.useState<MetaSnapshotRow[]>([]);
  const [googleTodayRows, setGoogleTodayRows] = React.useState<GoogleAdsSnapshotRow[]>([]);
  const [tiktokTodayRows, setTikTokTodayRows] = React.useState<TikTokAdsSnapshotRow[]>([]);
  const [metaSnapshotLastSyncedAt, setMetaSnapshotLastSyncedAt] = React.useState<string | null>(
    null,
  );
  const [googleSnapshotLastSyncedAt, setGoogleSnapshotLastSyncedAt] = React.useState<string | null>(
    null,
  );
  const [googleLatestKnownSnapshotLastSyncedAt, setGoogleLatestKnownSnapshotLastSyncedAt] =
    React.useState<string | null>(null);
  const [tiktokSnapshotLastSyncedAt, setTikTokSnapshotLastSyncedAt] = React.useState<string | null>(
    null,
  );
  const [metaTodayLastSyncedAt, setMetaTodayLastSyncedAt] = React.useState<string | null>(null);
  const [googleTodayLastSyncedAt, setGoogleTodayLastSyncedAt] = React.useState<string | null>(null);
  const [tiktokTodayLastSyncedAt, setTikTokTodayLastSyncedAt] = React.useState<string | null>(null);
  const [googleCachedBreakdown, setGoogleCachedBreakdown] =
    React.useState<GoogleAdsLiveBreakdownResponse | null>(null);
  const [liveMetaError, setLiveMetaError] = React.useState<string | null>(null);
  const [liveGoogleError, setLiveGoogleError] = React.useState<string | null>(null);
  const [liveTikTokError, setLiveTikTokError] = React.useState<string | null>(null);
  const [isBootstrappingSnapshots, setIsBootstrappingSnapshots] = React.useState(true);
  const [metaIntegrationConfigs, setMetaIntegrationConfigs] = React.useState<
    Record<string, AdsIntegrationConfig>
  >({});
  const [googleIntegrationConfigs, setGoogleIntegrationConfigs] = React.useState<
    Record<string, GoogleAdsIntegrationConfig>
  >({});
  const [tiktokIntegrationConfigs, setTikTokIntegrationConfigs] = React.useState<
    Record<string, TikTokAdsIntegrationConfig>
  >({});

  const advertiserUsers = React.useMemo(
    () => users.filter((user) => isAdvertiserRole(user.role) && user.status === 'active'),
    [users],
  );

  const platformMap = React.useMemo(
    () => new Map(platforms.map((platform) => [platform.id, platform.name])),
    [platforms],
  );

  const advertiserMap = React.useMemo(
    () => new Map(advertiserUsers.map((advertiser) => [advertiser.id, advertiser.name])),
    [advertiserUsers],
  );

  const metaPlatform = React.useMemo(
    () => platforms.find((platform) => isMetaPlatformName(platform.name)),
    [platforms],
  );

  const googlePlatform = React.useMemo(
    () => platforms.find((platform) => isGooglePlatformName(platform.name)),
    [platforms],
  );

  const tiktokPlatform = React.useMemo(
    () => platforms.find((platform) => isTikTokPlatformName(platform.name)),
    [platforms],
  );

  const dateRangeParams = React.useMemo(() => {
    if (!appliedDateRange?.from) return null;

    return {
      from: format(appliedDateRange.from, 'yyyy-MM-dd'),
      to: format(appliedDateRange.to || appliedDateRange.from, 'yyyy-MM-dd'),
    };
  }, [appliedDateRange]);

  const selectedRangeIncludesToday = React.useMemo(() => {
    if (!dateRangeParams) return false;
    return dateRangeParams.from <= todayKey && dateRangeParams.to >= todayKey;
  }, [dateRangeParams, todayKey]);

  React.useEffect(() => {
    let cancelled = false;

    const loadConfigs = async () => {
      const [metaConfigs, googleConfigs, tiktokConfigs] = await Promise.all([
        fetchAdsIntegrationConfigs(),
        fetchGoogleAdsIntegrationConfigs(),
        fetchTikTokAdsIntegrationConfigs(),
      ]);
      if (cancelled) return;

      setMetaIntegrationConfigs(
        metaConfigs.reduce<Record<string, AdsIntegrationConfig>>((acc, config) => {
          acc[config.adAccountId] = config;
          return acc;
        }, {}),
      );
      setGoogleIntegrationConfigs(
        googleConfigs.reduce<Record<string, GoogleAdsIntegrationConfig>>((acc, config) => {
          acc[config.adAccountId] = config;
          return acc;
        }, {}),
      );
      setTikTokIntegrationConfigs(
        tiktokConfigs.reduce<Record<string, TikTokAdsIntegrationConfig>>((acc, config) => {
          acc[config.adAccountId] = config;
          return acc;
        }, {}),
      );
    };

    void loadConfigs();

    return () => {
      cancelled = true;
    };
  }, []);

  const applyMetaSnapshotPayload = React.useCallback((payload: MetaSnapshotDatasetResponse) => {
    setMetaSnapshotRows(payload.rows || []);
    setMetaSnapshotLastSyncedAt(
      payload.metadata?.lastSyncedAt ||
        computeLatestSyncedAt((payload.rows || []).map((row) => row.syncedAt)),
    );
  }, []);

  const applyGoogleSnapshotPayload = React.useCallback(
    (payload: GoogleAdsSnapshotDatasetResponse) => {
      const servedFrom = payload.metadata?.servedFrom || payload.source;
      const lastSyncedAt =
        payload.metadata?.lastSyncedAt ||
        computeLatestSyncedAt((payload.rows || []).map((row) => row.syncedAt));

      if (servedFrom === 'database-latest-known') {
        setGoogleLatestKnownSnapshotRows(payload.rows || []);
        setGoogleLatestKnownSnapshotLastSyncedAt(lastSyncedAt);
        return;
      }

      setGoogleSnapshotRows(payload.rows || []);
      setGoogleSnapshotLastSyncedAt(lastSyncedAt);

      if ((payload.rows || []).length > 0) {
        setGoogleLatestKnownSnapshotRows([]);
        setGoogleLatestKnownSnapshotLastSyncedAt(null);
      }
    },
    [],
  );

  const getGoogleSnapshotSyncErrorMessage = React.useCallback(
    (payload: GoogleAdsSnapshotDatasetResponse) => {
      if (!payload.metadata?.rateLimited) return null;

      return (
        payload.metadata.cooldownMessage ||
        'Google Ads API sedang rate limit. Snapshot database terakhir tetap dipakai.'
      );
    },
    [],
  );

  const applyTikTokSnapshotPayload = React.useCallback(
    (payload: TikTokAdsSnapshotDatasetResponse) => {
      setTikTokSnapshotRows(payload.rows || []);
      setTikTokSnapshotLastSyncedAt(
        payload.metadata?.lastSyncedAt ||
          computeLatestSyncedAt((payload.rows || []).map((row) => row.syncedAt)),
      );
    },
    [],
  );

  const warmRecentSnapshotCache = React.useCallback(
    async (options?: { force?: boolean; minFreshMinutes?: number }) => {
      const force = options?.force ?? false;
      const minFreshMinutes =
        options?.minFreshMinutes ??
        (force ? 0 : ADS_MONITORING_FOUNDATION_CONFIG.historySnapshotMinFreshMinutes);

      const [metaResult, googleResult, tiktokResult] = await Promise.allSettled([
        syncMetaSnapshotDataset({
          from: recentSnapshotRange.from,
          to: recentSnapshotRange.to,
          force,
          minFreshMinutes,
        }),
        syncGoogleAdsSnapshotDataset({
          from: recentSnapshotRange.from,
          to: recentSnapshotRange.to,
          force,
          minFreshMinutes,
        }),
        syncTikTokAdsSnapshotDataset({
          from: recentSnapshotRange.from,
          to: recentSnapshotRange.to,
          force,
          minFreshMinutes,
        }),
      ]);

      if (metaResult.status === 'fulfilled') {
        applyMetaSnapshotPayload(metaResult.value);
        setLiveMetaError(null);
      } else {
        setLiveMetaError(
          metaResult.reason instanceof Error
            ? metaResult.reason.message
            : 'Sinkronisasi Meta snapshot gagal.',
        );
      }

      if (googleResult.status === 'fulfilled') {
        applyGoogleSnapshotPayload(googleResult.value);
        setLiveGoogleError(getGoogleSnapshotSyncErrorMessage(googleResult.value));
      } else {
        setLiveGoogleError(
          googleResult.reason instanceof Error
            ? googleResult.reason.message
            : 'Sinkronisasi Google Ads snapshot gagal.',
        );
      }

      if (tiktokResult.status === 'fulfilled') {
        applyTikTokSnapshotPayload(tiktokResult.value);
        setLiveTikTokError(null);
      } else {
        setLiveTikTokError(
          tiktokResult.reason instanceof Error
            ? tiktokResult.reason.message
            : 'Sinkronisasi TikTok Ads snapshot gagal.',
        );
      }
    },
    [
      applyGoogleSnapshotPayload,
      applyMetaSnapshotPayload,
      applyTikTokSnapshotPayload,
      getGoogleSnapshotSyncErrorMessage,
      recentSnapshotRange.from,
      recentSnapshotRange.to,
    ],
  );

  const refreshTodayLiveCache = React.useCallback(
    async (options?: { force?: boolean; minFreshMinutes?: number }) => {
      const force = options?.force ?? false;
      const minFreshMinutes =
        options?.minFreshMinutes ??
        (force ? 0 : ADS_MONITORING_FOUNDATION_CONFIG.todayLiveMinFreshMinutes);

      const [metaResult, googleResult, tiktokResult] = await Promise.allSettled([
        syncMetaSnapshotDataset({
          from: todayKey,
          to: todayKey,
          force,
          minFreshMinutes,
        }),
        syncGoogleAdsSnapshotDataset({
          from: todayKey,
          to: todayKey,
          force,
          minFreshMinutes,
        }),
        syncTikTokAdsSnapshotDataset({
          from: todayKey,
          to: todayKey,
          force,
          minFreshMinutes,
        }),
      ]);

      if (metaResult.status === 'fulfilled') {
        setMetaTodayRows(metaResult.value.rows || []);
        setMetaTodayLastSyncedAt(
          metaResult.value.metadata?.lastSyncedAt ||
            computeLatestSyncedAt((metaResult.value.rows || []).map((row) => row.syncedAt)),
        );
        setLiveMetaError(null);
      } else {
        setLiveMetaError(
          metaResult.reason instanceof Error ? metaResult.reason.message : 'Sinkronisasi Meta hari ini gagal.',
        );
      }

      if (googleResult.status === 'fulfilled') {
        setGoogleTodayRows(googleResult.value.rows || []);
        setGoogleTodayLastSyncedAt(
          googleResult.value.metadata?.lastSyncedAt ||
            computeLatestSyncedAt((googleResult.value.rows || []).map((row) => row.syncedAt)),
        );
        setLiveGoogleError(getGoogleSnapshotSyncErrorMessage(googleResult.value));
      } else {
        setLiveGoogleError(
          googleResult.reason instanceof Error
            ? googleResult.reason.message
            : 'Sinkronisasi Google Ads hari ini gagal.',
        );
      }

      if (tiktokResult.status === 'fulfilled') {
        setTikTokTodayRows(tiktokResult.value.rows || []);
        setTikTokTodayLastSyncedAt(
          tiktokResult.value.metadata?.lastSyncedAt ||
            computeLatestSyncedAt((tiktokResult.value.rows || []).map((row) => row.syncedAt)),
        );
        setLiveTikTokError(null);
      } else {
        setLiveTikTokError(
          tiktokResult.reason instanceof Error
            ? tiktokResult.reason.message
            : 'Sinkronisasi TikTok Ads hari ini gagal.',
        );
      }
    },
    [getGoogleSnapshotSyncErrorMessage, todayKey],
  );

  React.useEffect(() => {
    let cancelled = false;

    const loadSnapshotDatasets = async () => {
      setIsBootstrappingSnapshots(true);

      const [metaResult, googleResult, tiktokResult] = await Promise.allSettled([
        fetchMetaSnapshotDataset(recentSnapshotRange),
        fetchGoogleAdsSnapshotDataset(recentSnapshotRange),
        fetchTikTokAdsSnapshotDataset(recentSnapshotRange),
      ]);

      if (cancelled) return;

      if (metaResult.status === 'fulfilled') {
        applyMetaSnapshotPayload(metaResult.value);
        setLiveMetaError(null);
      } else {
        setLiveMetaError(
          metaResult.reason instanceof Error
            ? metaResult.reason.message
            : 'Gagal mengambil snapshot Meta dari database.',
        );
      }

      if (googleResult.status === 'fulfilled') {
        applyGoogleSnapshotPayload(googleResult.value);
        setLiveGoogleError(null);
      } else {
        setLiveGoogleError(
          googleResult.reason instanceof Error
            ? googleResult.reason.message
            : 'Gagal mengambil snapshot Google Ads dari database.',
          );
      }

      if (tiktokResult.status === 'fulfilled') {
        applyTikTokSnapshotPayload(tiktokResult.value);
        setLiveTikTokError(null);
      } else {
        setLiveTikTokError(
          tiktokResult.reason instanceof Error
            ? tiktokResult.reason.message
            : 'Gagal mengambil snapshot TikTok Ads dari database.',
        );
      }

      setIsBootstrappingSnapshots(false);
      void warmRecentSnapshotCache();
    };

    void loadSnapshotDatasets();

    return () => {
      cancelled = true;
    };
  }, [
    applyGoogleSnapshotPayload,
    applyMetaSnapshotPayload,
    applyTikTokSnapshotPayload,
    recentSnapshotRange,
    warmRecentSnapshotCache,
  ]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void warmRecentSnapshotCache();
    }, ADS_MONITORING_FOUNDATION_CONFIG.historyWarmIntervalMs);

    return () => window.clearInterval(timer);
  }, [warmRecentSnapshotCache]);

  React.useEffect(() => {
    const handleVisibilityRefresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void warmRecentSnapshotCache();
    };

    window.addEventListener('focus', handleVisibilityRefresh);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);

    return () => {
      window.removeEventListener('focus', handleVisibilityRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
    };
  }, [warmRecentSnapshotCache]);

  React.useEffect(() => {
    if (!selectedRangeIncludesToday) return;

    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void refreshTodayLiveCache();
    }, todayLiveRefreshMs);

    return () => window.clearInterval(timer);
  }, [refreshTodayLiveCache, selectedRangeIncludesToday, todayLiveRefreshMs]);

  React.useEffect(() => {
    if (!selectedRangeIncludesToday) return;

    const handleVisibilityRefresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void refreshTodayLiveCache();
    };

    window.addEventListener('focus', handleVisibilityRefresh);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);

    return () => {
      window.removeEventListener('focus', handleVisibilityRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
    };
  }, [refreshTodayLiveCache, selectedRangeIncludesToday]);

  React.useEffect(() => {
    if (!selectedRangeIncludesToday) return;
    void refreshTodayLiveCache();
  }, [refreshTodayLiveCache, selectedRangeIncludesToday]);

  React.useEffect(() => {
    if (!dateRangeParams) {
      setGoogleCachedBreakdown(getCachedGoogleAdsLiveRegistry());
      return;
    }

    const cachedForRange =
      getCachedGoogleAdsLiveBreakdown({
        from: dateRangeParams.from,
        to: dateRangeParams.to,
      }) || getCachedGoogleAdsLiveRegistry();

    setGoogleCachedBreakdown(cachedForRange);
  }, [dateRangeParams]);

  React.useEffect(() => {
    if (!dateRangeParams) return;

    let cancelled = false;

    const warmGoogleCachedBreakdown = async () => {
      try {
        const payload = await fetchGoogleAdsLiveBreakdown({
          from: dateRangeParams.from,
          to: dateRangeParams.to,
        });

        if (!cancelled) {
          setGoogleCachedBreakdown(payload);
        }
      } catch {
        if (!cancelled) {
          setGoogleCachedBreakdown((current) => current || getCachedGoogleAdsLiveRegistry());
        }
      }
    };

    void warmGoogleCachedBreakdown();

    return () => {
      cancelled = true;
    };
  }, [dateRangeParams]);

  const effectiveMetaSnapshotRows = React.useMemo(
    () => mergeSnapshotRows(metaSnapshotRows, metaTodayRows),
    [metaSnapshotRows, metaTodayRows],
  );

  const effectiveGoogleSnapshotRows = React.useMemo(
    () => mergeSnapshotRows(googleSnapshotRows, googleTodayRows),
    [googleSnapshotRows, googleTodayRows],
  );

  const effectiveTikTokSnapshotRows = React.useMemo(
    () => mergeSnapshotRows(tiktokSnapshotRows, tiktokTodayRows),
    [tiktokSnapshotRows, tiktokTodayRows],
  );

  const effectiveMetaLastSyncedAt = React.useMemo(
    () => computeLatestSyncedAt([metaSnapshotLastSyncedAt, metaTodayLastSyncedAt]),
    [metaSnapshotLastSyncedAt, metaTodayLastSyncedAt],
  );

  const effectiveGoogleLastSyncedAt = React.useMemo(
    () =>
      computeLatestSyncedAt([
        googleSnapshotLastSyncedAt,
        googleLatestKnownSnapshotLastSyncedAt,
        googleTodayLastSyncedAt,
      ]),
    [
      googleLatestKnownSnapshotLastSyncedAt,
      googleSnapshotLastSyncedAt,
      googleTodayLastSyncedAt,
    ],
  );

  const effectiveTikTokLastSyncedAt = React.useMemo(
    () => computeLatestSyncedAt([tiktokSnapshotLastSyncedAt, tiktokTodayLastSyncedAt]),
    [tiktokSnapshotLastSyncedAt, tiktokTodayLastSyncedAt],
  );

  const googleSnapshotRowsInRange = React.useMemo(() => {
    if (!dateRangeParams) return [];

    return effectiveGoogleSnapshotRows.filter(
      (row) => row.snapshotDate >= dateRangeParams.from && row.snapshotDate <= dateRangeParams.to,
    );
  }, [dateRangeParams, effectiveGoogleSnapshotRows]);

  const isUsingGoogleLatestKnownSnapshot = React.useMemo(
    () => googleSnapshotRowsInRange.length === 0 && googleLatestKnownSnapshotRows.length > 0,
    [googleLatestKnownSnapshotRows.length, googleSnapshotRowsInRange.length],
  );

  const googleLatestKnownSnapshotDate =
    googleLatestKnownSnapshotRows.length > 0
      ? googleLatestKnownSnapshotRows
          .map((row) => row.snapshotDate)
          .sort((left, right) => right.localeCompare(left))[0]
      : null;

  const tiktokSnapshotRowsInRange = React.useMemo(() => {
    if (!dateRangeParams) return [];

    return effectiveTikTokSnapshotRows.filter(
      (row) => row.snapshotDate >= dateRangeParams.from && row.snapshotDate <= dateRangeParams.to,
    );
  }, [dateRangeParams, effectiveTikTokSnapshotRows]);

  const accountRegistry = React.useMemo(() => {
    return adAccounts
      .map((account) => {
        const platformName = platformMap.get(account.platformId) || 'Unknown';
        const advertiserName = advertiserMap.get(account.advertiserId) || 'Unknown';
        const businessGroup = deriveAccountGroup(account.id, platformName, advertiserName);

        return {
          ...account,
          platformName,
          advertiserName,
          businessGroupId: businessGroup.id,
          businessGroupName: businessGroup.name,
        };
      })
      .sort((left, right) => left.accountName.localeCompare(right.accountName));
  }, [adAccounts, advertiserMap, platformMap]);

  const isIntegrationEnabled = React.useCallback(
    (account: (typeof accountRegistry)[number]) => {
      if (isGooglePlatformName(account.platformName)) {
        return (
          googleIntegrationConfigs[account.id]?.enabled ??
          metaIntegrationConfigs[account.id]?.enabled ??
          account.status === 'active'
        );
      }

      if (isTikTokPlatformName(account.platformName)) {
        return tiktokIntegrationConfigs[account.id]?.enabled ?? account.status === 'active';
      }

      return metaIntegrationConfigs[account.id]?.enabled ?? account.status === 'active';
    },
    [googleIntegrationConfigs, metaIntegrationConfigs, tiktokIntegrationConfigs],
  );

  const enabledAccountRegistry = React.useMemo(
    () => accountRegistry.filter((account) => isIntegrationEnabled(account)),
    [accountRegistry, isIntegrationEnabled],
  );

  const enabledAccountIdsByAdvertiserPlatform = React.useMemo(() => {
    const grouped = new Map<string, string[]>();

    for (const account of enabledAccountRegistry) {
      const key = buildAdvertiserPlatformKey(account.advertiserId, account.platformId);
      const current = grouped.get(key) || [];
      current.push(account.id);
      grouped.set(key, current);
    }

    return grouped;
  }, [enabledAccountRegistry]);

  const tiktokOrderOverrideCsIdByAccountId = React.useMemo(() => {
    const overrideMap = new Map<string, string>();

    for (const account of enabledAccountRegistry) {
      if (!isTikTokPlatformName(account.platformName)) continue;

      const matchedRule =
        TIKTOK_ORDER_CS_OVERRIDES[
          account.id as keyof typeof TIKTOK_ORDER_CS_OVERRIDES
        ];
      if (!matchedRule?.csId) continue;

      overrideMap.set(account.id, matchedRule.csId);
    }

    return overrideMap;
  }, [enabledAccountRegistry]);

  const tiktokOrderOverrideSubChannelIdByAccountId = React.useMemo(() => {
    const overrideMap = new Map<string, string>();

    for (const account of enabledAccountRegistry) {
      if (!isTikTokPlatformName(account.platformName)) continue;

      const matchedRule =
        TIKTOK_ORDER_SUBCHANNEL_OVERRIDES[
          account.id as keyof typeof TIKTOK_ORDER_SUBCHANNEL_OVERRIDES
        ];
      if (!matchedRule?.subChannelId) continue;

      overrideMap.set(account.id, matchedRule.subChannelId);
    }

    return overrideMap;
  }, [enabledAccountRegistry]);

  const accountOrderSignalsById = React.useMemo(() => {
    const signals = new Map<
      string,
      {
        subChannelIds: Set<string>;
        csIds: Set<string>;
        subChannelFrequency: Map<string, number>;
        csFrequency: Map<string, number>;
        primarySubChannelId: string | null;
        primaryCsId: string | null;
      }
    >();

    for (const account of enabledAccountRegistry) {
      signals.set(account.id, {
        subChannelIds: new Set<string>(),
        csIds: new Set<string>(),
        subChannelFrequency: new Map<string, number>(),
        csFrequency: new Map<string, number>(),
        primarySubChannelId: null,
        primaryCsId: null,
      });
    }

    for (const item of dailyAds) {
      const signal = signals.get(item.adAccountId);
      if (!signal) continue;
      if (item.subChannelId) {
        signal.subChannelIds.add(item.subChannelId);
        signal.subChannelFrequency.set(
          item.subChannelId,
          (signal.subChannelFrequency.get(item.subChannelId) || 0) + 1,
        );
      }
      if (item.csId) {
        signal.csIds.add(item.csId);
        signal.csFrequency.set(item.csId, (signal.csFrequency.get(item.csId) || 0) + 1);
      }
    }

    for (const signal of signals.values()) {
      signal.primarySubChannelId =
        Array.from(signal.subChannelFrequency.entries()).sort((left, right) => {
          if (right[1] !== left[1]) return right[1] - left[1];
          return left[0].localeCompare(right[0]);
        })[0]?.[0] || null;

      signal.primaryCsId =
        Array.from(signal.csFrequency.entries()).sort((left, right) => {
          if (right[1] !== left[1]) return right[1] - left[1];
          return left[0].localeCompare(right[0]);
        })[0]?.[0] || null;
    }

    return signals;
  }, [dailyAds, enabledAccountRegistry]);

  const datedOrders = React.useMemo(() => {
    if (!dateRangeParams) return orders;

    return orders.filter((order) => {
      const attributionDateKey = getOrderAttributionDateKey(order);
      return (
        !!attributionDateKey &&
        attributionDateKey >= dateRangeParams.from &&
        attributionDateKey <= dateRangeParams.to
      );
    });
  }, [dateRangeParams, orders]);

  const datedAds = React.useMemo(() => {
    if (!dateRangeParams) return dailyAds;

    return dailyAds.filter((item) => item.date >= dateRangeParams.from && item.date <= dateRangeParams.to);
  }, [dailyAds, dateRangeParams]);

  const internalRangeByAccountId = React.useMemo(() => {
    const grouped = new Map<
      string,
      {
        spend: number;
        ppn: number;
        fee: number;
        burn: number;
        leads: number;
      }
    >();

    for (const item of datedAds) {
      const current = grouped.get(item.adAccountId) || {
        spend: 0,
        ppn: 0,
        fee: 0,
        burn: 0,
        leads: 0,
      };

      current.spend += item.amountSpent || 0;
      current.ppn += item.ppnAmount || 0;
      current.fee += item.feeAmount || 0;
      current.burn += (item.amountSpent || 0) + (item.ppnAmount || 0) + (item.feeAmount || 0);
      current.leads += item.leadsDashboard || 0;
      grouped.set(item.adAccountId, current);
    }

    return grouped;
  }, [datedAds]);

  const allTimeInternalStatsByAccountId = React.useMemo(() => {
    const grouped = new Map<
      string,
      {
        leads: number;
        lastDate: string | null;
      }
    >();

    for (const item of dailyAds) {
      const current = grouped.get(item.adAccountId) || {
        leads: 0,
        lastDate: null,
      };

      current.leads += item.leadsDashboard || 0;
      if (!current.lastDate || item.date > current.lastDate) {
        current.lastDate = item.date;
      }
      grouped.set(item.adAccountId, current);
    }

    return grouped;
  }, [dailyAds]);

  const orderFallbackState = React.useMemo(() => {
    const exactByAccountId = new Map<
      string,
      {
        leads: number;
        lastDate: string | null;
      }
    >();
    const unresolvedByAdvertiserPlatform = new Map<
      string,
      {
        leads: number;
        lastDate: string | null;
      }
    >();

    for (const order of datedOrders) {
      if (!order.advertiserId || !order.platformId) continue;
      const attributionDateKey = getOrderAttributionDateKey(order);
      if (!attributionDateKey) continue;
      const isGoogleOrder = order.platformId === googlePlatform?.id;

      let candidateAccountIds =
        enabledAccountIdsByAdvertiserPlatform.get(
          buildAdvertiserPlatformKey(order.advertiserId, order.platformId),
        ) || [];

      if (candidateAccountIds.length === 0) continue;

      if (order.csId) {
        const explicitOverrideMatchedAccountIds = candidateAccountIds.filter(
          (accountId) => tiktokOrderOverrideCsIdByAccountId.get(accountId) === order.csId,
        );
        if (explicitOverrideMatchedAccountIds.length > 0) {
          candidateAccountIds = explicitOverrideMatchedAccountIds;
        }
      }

      if (order.csId) {
        const primaryCsMatchedAccountIds = candidateAccountIds.filter(
          (accountId) => accountOrderSignalsById.get(accountId)?.primaryCsId === order.csId,
        );
        if (primaryCsMatchedAccountIds.length > 0) {
          candidateAccountIds = primaryCsMatchedAccountIds;
        }
      }

      if (candidateAccountIds.length > 1 && order.subChannelId && !isGoogleOrder) {
        const primarySubChannelMatchedAccountIds = candidateAccountIds.filter(
          (accountId) =>
            accountOrderSignalsById.get(accountId)?.primarySubChannelId === order.subChannelId,
        );
        if (primarySubChannelMatchedAccountIds.length > 0) {
          candidateAccountIds = primarySubChannelMatchedAccountIds;
        }
      }

      if (candidateAccountIds.length > 1 && order.csId) {
        const csMatchedAccountIds = candidateAccountIds.filter((accountId) =>
          accountOrderSignalsById.get(accountId)?.csIds.has(order.csId as string),
        );
        if (csMatchedAccountIds.length > 0) {
          candidateAccountIds = csMatchedAccountIds;
        }
      }

      if (order.subChannelId) {
        const explicitOverrideMatchedAccountIds = candidateAccountIds.filter(
          (accountId) => tiktokOrderOverrideSubChannelIdByAccountId.get(accountId) === order.subChannelId,
        );
        if (explicitOverrideMatchedAccountIds.length > 0) {
          candidateAccountIds = explicitOverrideMatchedAccountIds;
        }
      }

      if (candidateAccountIds.length > 1 && order.subChannelId && !isGoogleOrder) {
        const subChannelMatchedAccountIds = candidateAccountIds.filter((accountId) =>
          accountOrderSignalsById.get(accountId)?.subChannelIds.has(order.subChannelId as string),
        );
        if (subChannelMatchedAccountIds.length > 0) {
          candidateAccountIds = subChannelMatchedAccountIds;
        }
      }

      const groupKey = buildAdvertiserPlatformKey(order.advertiserId, order.platformId);

      if (candidateAccountIds.length === 1) {
        const accountId = candidateAccountIds[0];
        const current = exactByAccountId.get(accountId) || {
          leads: 0,
          lastDate: null,
        };

        current.leads += 1;
        if (!current.lastDate || attributionDateKey > current.lastDate) {
          current.lastDate = attributionDateKey;
        }
        exactByAccountId.set(accountId, current);
        continue;
      }

      const current = unresolvedByAdvertiserPlatform.get(groupKey) || {
        leads: 0,
        lastDate: null,
      };

      current.leads += 1;
      if (!current.lastDate || attributionDateKey > current.lastDate) {
        current.lastDate = attributionDateKey;
      }
      unresolvedByAdvertiserPlatform.set(groupKey, current);
    }

    return {
      exactByAccountId,
      unresolvedByAdvertiserPlatform,
    };
  }, [
    accountOrderSignalsById,
    datedOrders,
    enabledAccountIdsByAdvertiserPlatform,
    googlePlatform?.id,
    tiktokOrderOverrideCsIdByAccountId,
    tiktokOrderOverrideSubChannelIdByAccountId,
  ]);

  const metaInternalAccounts = React.useMemo(
    () =>
      enabledAccountRegistry.filter((account) => isMetaPlatformName(account.platformName)),
    [enabledAccountRegistry],
  );

  const googleInternalAccounts = React.useMemo(
    () =>
      enabledAccountRegistry.filter((account) => isGooglePlatformName(account.platformName)),
    [enabledAccountRegistry],
  );

  const tiktokInternalAccounts = React.useMemo(
    () =>
      enabledAccountRegistry.filter((account) => isTikTokPlatformName(account.platformName)),
    [enabledAccountRegistry],
  );

  const metaInternalAccountByNormalizedName = React.useMemo(() => {
    const mapped = new Map<string, (typeof metaInternalAccounts)[number]>();
    const byNumber = new Map<string, (typeof metaInternalAccounts)[number]>();
    const duplicateNumberKeys = new Set<string>();
    for (const account of metaInternalAccounts) {
      for (const key of buildFlexibleLookupKeys(account.accountName)) {
        mapped.set(key, account);
      }
      addUniqueTrailingNumberLookup(byNumber, duplicateNumberKeys, account.accountName, account);
    }
    for (const [key, account] of byNumber.entries()) {
      mapped.set(`number:${key}`, account);
    }
    return mapped;
  }, [metaInternalAccounts]);

  const metaInternalAccountByConfiguredAccountId = React.useMemo(() => {
    const mapped = new Map<string, (typeof metaInternalAccounts)[number]>();
    for (const account of metaInternalAccounts) {
      const configuredAccountId = metaIntegrationConfigs[account.id]?.liveMetaAccountId;
      if (configuredAccountId) {
        mapped.set(configuredAccountId, account);
      }
    }
    return mapped;
  }, [metaIntegrationConfigs, metaInternalAccounts]);

  const googleInternalAccountByNormalizedName = React.useMemo(() => {
    const mapped = new Map<string, (typeof googleInternalAccounts)[number]>();
    for (const account of googleInternalAccounts) {
      for (const key of buildLookupKeys(account.accountName)) {
        mapped.set(key, account);
      }
    }
    return mapped;
  }, [googleInternalAccounts]);

  const googleInternalAccountByConfiguredCustomerId = React.useMemo(() => {
    const mapped = new Map<string, (typeof googleInternalAccounts)[number]>();
    for (const account of googleInternalAccounts) {
      const configuredCustomerId = googleIntegrationConfigs[account.id]?.liveGoogleCustomerId;
      if (configuredCustomerId) {
        mapped.set(configuredCustomerId, account);
      }
    }
    return mapped;
  }, [googleIntegrationConfigs, googleInternalAccounts]);

  const tiktokInternalAccountByNormalizedName = React.useMemo(() => {
    const mapped = new Map<string, (typeof tiktokInternalAccounts)[number]>();
    for (const account of tiktokInternalAccounts) {
      for (const key of buildFlexibleLookupKeys(account.accountName)) {
        mapped.set(key, account);
      }
    }
    return mapped;
  }, [tiktokInternalAccounts]);

  const tiktokInternalAccountByConfiguredAdvertiserId = React.useMemo(() => {
    const mapped = new Map<string, (typeof tiktokInternalAccounts)[number]>();
    for (const account of tiktokInternalAccounts) {
      const configuredAdvertiserId = tiktokIntegrationConfigs[account.id]?.liveTikTokAdvertiserId;
      if (configuredAdvertiserId) {
        mapped.set(configuredAdvertiserId, account);
      }
    }
    return mapped;
  }, [tiktokIntegrationConfigs, tiktokInternalAccounts]);

  const liveMetaData = React.useMemo<MetaLiveBreakdownResponse | null>(() => {
    if (!metaPlatform || !dateRangeParams) return null;

    const rangedRows = effectiveMetaSnapshotRows.filter(
      (row) => row.snapshotDate >= dateRangeParams.from && row.snapshotDate <= dateRangeParams.to,
    );

    if (rangedRows.length === 0) return null;

    const accountMap = new Map<
      string,
      {
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
    >();

    for (const row of rangedRows) {
      const current = accountMap.get(row.externalAccountId) || {
        id: row.externalAccountId,
        accountId: row.externalAccountId.replace(/^act_/, ''),
        name: row.externalAccountName,
        businessId: row.externalGroupId || null,
        businessName: row.externalGroupName || 'Tanpa Business Manager',
        accountStatus:
          row.externalAccountStatus != null && row.externalAccountStatus !== ''
            ? Number(row.externalAccountStatus)
            : null,
        currency: row.currencyCode || 'IDR',
        spend: 0,
        clicks: 0,
        impressions: 0,
        reach: 0,
        cpc: null,
        ctr: null,
        cpm: null,
        cpp: null,
        dateStart: row.snapshotDate,
        dateStop: row.snapshotDate,
        error: row.error || null,
      };

      current.spend += row.spend || 0;
      current.clicks += row.clicks || 0;
      current.impressions += row.impressions || 0;
      current.reach += row.reach || 0;
      if (row.snapshotDate < current.dateStart) current.dateStart = row.snapshotDate;
      if (row.snapshotDate > current.dateStop) current.dateStop = row.snapshotDate;
      current.error = current.error || row.error || null;
      accountMap.set(row.externalAccountId, current);
    }

    const accounts = Array.from(accountMap.values())
      .map((account) => ({
        ...account,
        ctr: account.impressions > 0 ? (account.clicks / account.impressions) * 100 : null,
        cpc: account.clicks > 0 ? account.spend / account.clicks : null,
        cpm: account.impressions > 0 ? (account.spend / account.impressions) * 1000 : null,
        cpp: account.reach > 0 ? account.spend / account.reach : null,
      }))
      .sort((left, right) => {
        if (right.spend !== left.spend) return right.spend - left.spend;
        return left.name.localeCompare(right.name);
      });

    const businessMap = new Map<
      string,
      {
        id: string;
        name: string;
        verificationStatus: string;
        accountCount: number;
        spend: number;
        clicks: number;
        impressions: number;
        reach: number;
      }
    >();

    for (const account of accounts) {
      if (!account.businessId) continue;

      const current = businessMap.get(account.businessId) || {
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

    const businesses = Array.from(businessMap.values()).sort((left, right) => {
      if (right.spend !== left.spend) return right.spend - left.spend;
      return left.name.localeCompare(right.name);
    });

    return {
      source: 'meta-live',
      generatedAt: effectiveMetaLastSyncedAt || new Date().toISOString(),
      requestedBy: 'snapshot-db',
      range: dateRangeParams,
      businesses,
      accounts,
      summary: accounts.reduce(
        (acc, account) => {
          acc.accountCount += 1;
          acc.businessCount = businesses.length;
          acc.spend += account.spend;
          acc.clicks += account.clicks;
          acc.impressions += account.impressions;
          acc.reach += account.reach;
          return acc;
        },
        {
          businessCount: businesses.length,
          accountCount: 0,
          spend: 0,
          clicks: 0,
          impressions: 0,
          reach: 0,
        },
      ),
    };
  }, [dateRangeParams, effectiveMetaLastSyncedAt, effectiveMetaSnapshotRows, metaPlatform]);

  const liveGoogleData = React.useMemo<GoogleAdsLiveBreakdownResponse | null>(() => {
    if (!googlePlatform || !dateRangeParams) return googleCachedBreakdown;

    const rangedRows =
      googleSnapshotRowsInRange.length > 0
        ? googleSnapshotRowsInRange
        : googleLatestKnownSnapshotRows;

    if (rangedRows.length === 0) return googleCachedBreakdown;

    const accountMap = new Map<
      string,
      {
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
    >();

    for (const row of rangedRows) {
      const current = accountMap.get(row.externalAccountId) || {
        customerId: row.externalAccountId,
        customerName: row.externalAccountName,
        name: row.externalAccountName,
        managerCustomerId: row.externalGroupId || null,
        managerCustomerName: row.externalGroupName || 'Google Ads Direct Access',
        currencyCode: row.currencyCode || 'IDR',
        status: row.externalAccountStatus || 'UNKNOWN',
        isManager: false,
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        ctr: null,
        cpc: null,
        cpm: null,
        costPerConversion: null,
        dateStart: row.snapshotDate,
        dateStop: row.snapshotDate,
        error: row.error || null,
      };

      current.spend += row.spend || 0;
      current.clicks += row.clicks || 0;
      current.impressions += row.impressions || 0;
      current.conversions += row.conversions || 0;
      if (row.snapshotDate < current.dateStart) current.dateStart = row.snapshotDate;
      if (row.snapshotDate > current.dateStop) current.dateStop = row.snapshotDate;
      current.error = current.error || row.error || null;
      accountMap.set(row.externalAccountId, current);
    }

    const accounts = Array.from(accountMap.values())
      .map((account) => ({
        ...account,
        ctr: account.impressions > 0 ? (account.clicks / account.impressions) * 100 : null,
        cpc: account.clicks > 0 ? account.spend / account.clicks : null,
        cpm: account.impressions > 0 ? (account.spend / account.impressions) * 1000 : null,
        costPerConversion:
          account.conversions > 0 ? account.spend / account.conversions : null,
      }))
      .sort((left, right) => {
        if (right.spend !== left.spend) return right.spend - left.spend;
        return left.customerName.localeCompare(right.customerName);
      });

    const managersMap = new Map<
      string,
      {
        id: string;
        name: string;
        accountCount: number;
        spend: number;
        clicks: number;
        impressions: number;
        conversions: number;
      }
    >();

    for (const account of accounts) {
      const managerId = account.managerCustomerId || account.customerId;
      const managerName = account.managerCustomerName || account.customerName;
      const current = managersMap.get(managerId) || {
        id: managerId,
        name: managerName,
        accountCount: 0,
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
      };

      current.accountCount += 1;
      current.spend += account.spend;
      current.clicks += account.clicks;
      current.impressions += account.impressions;
      current.conversions += account.conversions;
      managersMap.set(managerId, current);
    }

    const managers = Array.from(managersMap.values()).sort((left, right) => {
      if (right.spend !== left.spend) return right.spend - left.spend;
      return left.name.localeCompare(right.name);
    });

    return {
      source: 'google-ads-live',
      generatedAt: effectiveGoogleLastSyncedAt || new Date().toISOString(),
      requestedBy: 'snapshot-db',
      range: dateRangeParams,
      managers,
      accounts,
      summary: accounts.reduce(
        (acc, account) => {
          acc.accountCount += 1;
          acc.managerCount = managers.length;
          acc.spend += account.spend;
          acc.clicks += account.clicks;
          acc.impressions += account.impressions;
          acc.conversions += account.conversions;
          return acc;
        },
        {
          managerCount: managers.length,
          accountCount: 0,
          spend: 0,
          clicks: 0,
          impressions: 0,
          conversions: 0,
        },
      ),
      metadata: {
        apiVersion: isUsingGoogleLatestKnownSnapshot ? 'snapshot-db-latest-known' : 'snapshot-db',
        loginCustomerId: null,
        accessibleCustomerCount: accounts.length,
      },
    };
  }, [
    dateRangeParams,
    effectiveGoogleLastSyncedAt,
    googleCachedBreakdown,
    googleLatestKnownSnapshotRows,
    googlePlatform,
    isUsingGoogleLatestKnownSnapshot,
    googleSnapshotRowsInRange,
  ]);

  const liveTikTokData = React.useMemo(() => {
    if (!tiktokPlatform || !dateRangeParams) return null;

    const rangedRows = tiktokSnapshotRowsInRange;
    if (rangedRows.length === 0) return null;

    const accountMap = new Map<
      string,
      {
        advertiserId: string;
        advertiserName: string;
        businessCenterId: string | null;
        businessCenterName: string;
        currency: string;
        status: string;
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
    >();

    for (const row of rangedRows) {
      const current = accountMap.get(row.externalAccountId) || {
        advertiserId: row.externalAccountId,
        advertiserName: row.externalAccountName,
        businessCenterId: row.externalGroupId || null,
        businessCenterName:
          sanitizeTikTokBusinessCenterName(row.externalGroupName) ||
          'TikTok Business Center Belum Dipetakan',
        currency: row.currencyCode || 'IDR',
        status: row.externalAccountStatus || 'UNKNOWN',
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        ctr: null,
        cpc: null,
        cpm: null,
        costPerConversion: null,
        dateStart: row.snapshotDate,
        dateStop: row.snapshotDate,
        error: row.error || null,
      };

      current.spend += row.spend || 0;
      current.clicks += row.clicks || 0;
      current.impressions += row.impressions || 0;
      current.conversions += row.conversions || 0;
      if (row.snapshotDate < current.dateStart) current.dateStart = row.snapshotDate;
      if (row.snapshotDate > current.dateStop) current.dateStop = row.snapshotDate;
      current.error = current.error || row.error || null;
      accountMap.set(row.externalAccountId, current);
    }

    const accounts = Array.from(accountMap.values())
      .map((account) => ({
        ...account,
        ctr: account.impressions > 0 ? (account.clicks / account.impressions) * 100 : null,
        cpc: account.clicks > 0 ? account.spend / account.clicks : null,
        cpm: account.impressions > 0 ? (account.spend / account.impressions) * 1000 : null,
        costPerConversion:
          account.conversions > 0 ? account.spend / account.conversions : null,
      }))
      .sort((left, right) => {
        if (right.spend !== left.spend) return right.spend - left.spend;
        return left.advertiserName.localeCompare(right.advertiserName);
      });

    const businessCenterMap = new Map<
      string,
      {
        id: string;
        name: string;
        advertiserCount: number;
        spend: number;
        clicks: number;
        impressions: number;
        conversions: number;
      }
    >();

    for (const account of accounts) {
      const groupId = account.businessCenterId || 'tiktok-bc-unmapped';
      const current = businessCenterMap.get(groupId) || {
        id: groupId,
        name: account.businessCenterName || 'TikTok Business Center Belum Dipetakan',
        advertiserCount: 0,
        spend: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
      };

      current.advertiserCount += 1;
      current.spend += account.spend;
      current.clicks += account.clicks;
      current.impressions += account.impressions;
      current.conversions += account.conversions;
      businessCenterMap.set(groupId, current);
    }

    const businessCenters = Array.from(businessCenterMap.values()).sort((left, right) => {
      if (right.spend !== left.spend) return right.spend - left.spend;
      return left.name.localeCompare(right.name);
    });

    return {
      source: 'tiktok-ads-live',
      generatedAt: effectiveTikTokLastSyncedAt || new Date().toISOString(),
      requestedBy: 'snapshot-db',
      range: dateRangeParams,
      businessCenters,
      accounts,
      summary: accounts.reduce(
        (acc, account) => {
          acc.businessCenterCount = businessCenters.length;
          acc.accountCount += 1;
          acc.spend += account.spend;
          acc.clicks += account.clicks;
          acc.impressions += account.impressions;
          acc.conversions += account.conversions;
          return acc;
        },
        {
          businessCenterCount: businessCenters.length,
          accountCount: 0,
          spend: 0,
          clicks: 0,
          impressions: 0,
          conversions: 0,
        },
      ),
      metadata: {
        apiVersion: 'snapshot-db',
        advertiserCount: accounts.length,
      },
    };
  }, [dateRangeParams, effectiveTikTokLastSyncedAt, tiktokPlatform, tiktokSnapshotRowsInRange]);

  const baseLiveMetaRows = React.useMemo<UnifiedPerformanceRow[]>(() => {
    if (!liveMetaData || !metaPlatform) return [];

    return liveMetaData.accounts
      .map((account) => {
        const configuredInternal = metaInternalAccountByConfiguredAccountId.get(account.id);
        const matchedInternal =
          configuredInternal ||
          buildFlexibleLookupKeys(account.name).reduce<
            (typeof metaInternalAccounts)[number] | undefined
          >((current, key) => current || metaInternalAccountByNormalizedName.get(key), undefined) ||
          (getTrailingNumberKey(account.name)
            ? metaInternalAccountByNormalizedName.get(`number:${getTrailingNumberKey(account.name)}`)
            : undefined);

        if (!matchedInternal) return null;

        const internalAggregate = internalRangeByAccountId.get(matchedInternal.id);
        const allTimeInternalStats = allTimeInternalStatsByAccountId.get(matchedInternal.id);
        const orderFallback = orderFallbackState.exactByAccountId.get(matchedInternal.id);
        const ppnRate = matchedInternal.ppn || 0;
        const feeRate = matchedInternal.fee || 0;
        const ppn = account.spend * (ppnRate / 100);
        const fee = account.spend * (feeRate / 100);
        const dashboardLeads = internalAggregate?.leads || 0;
        const orderFallbackLeads = orderFallback?.leads || 0;
        const currentLeads = orderFallbackLeads > 0 ? orderFallbackLeads : dashboardLeads;
        const leadSource: LeadSource =
          orderFallbackLeads > 0 ? 'order-fallback' : dashboardLeads > 0 ? 'dashboard' : 'none';
        const leadInputStatus =
          dashboardLeads > 0 || orderFallbackLeads > 0
            ? 'ok'
            : (allTimeInternalStats?.leads || 0) > 0
              ? 'missing-in-range'
              : 'never-input';

        return {
          uniqueId: `meta-live:${account.id}`,
          source: 'meta-live',
          platformId: metaPlatform.id,
          platformName: metaPlatform.name,
          businessGroupId: account.businessId || 'bm-meta-tanpa-bm',
          businessGroupName: account.businessName || 'Tanpa Business Manager',
          adAccountId: matchedInternal.id,
          accountName: account.name,
          advertiserId: matchedInternal.advertiserId,
          advertiserName: matchedInternal.advertiserName,
          spend: account.spend,
          ppn,
          fee,
          burn: account.spend + ppn + fee,
          leads: currentLeads,
          cpl: currentLeads > 0 ? account.spend / currentLeads : 0,
          clicks: account.clicks,
          ctr: account.ctr,
          cpc: account.cpc,
          cpm: account.cpm,
          cpp: account.cpp,
          reach: account.reach,
          impressions: account.impressions,
          currency: account.currency,
          liveLabel: 'Meta Graph Live',
          liveError: account.error,
          leadSource,
          leadInputStatus,
          lastLeadInputDate: allTimeInternalStats?.lastDate || null,
          lastOrderFallbackDate: orderFallback?.lastDate || null,
          dashboardLeadCount: dashboardLeads,
          exactOrderLeadCount: orderFallbackLeads,
          sharedOrderLeadCount: 0,
        } satisfies UnifiedPerformanceRow;
      })
      .filter(isUnifiedPerformanceRow);
  }, [
    allTimeInternalStatsByAccountId,
    internalRangeByAccountId,
    liveMetaData,
    metaInternalAccountByConfiguredAccountId,
    metaInternalAccountByNormalizedName,
    metaPlatform,
    orderFallbackState.exactByAccountId,
  ]);

  const sharedMetaOrderAllocations = React.useMemo(
    () =>
      allocateCountsProportionally(
        baseLiveMetaRows,
        orderFallbackState.unresolvedByAdvertiserPlatform,
      ),
    [baseLiveMetaRows, orderFallbackState.unresolvedByAdvertiserPlatform],
  );

  const liveMetaRows = React.useMemo<UnifiedPerformanceRow[]>(
    () =>
      baseLiveMetaRows.map((row) => {
        const sharedLeads = sharedMetaOrderAllocations.get(row.adAccountId) || 0;
        const totalOrderLeads = (row.exactOrderLeadCount || 0) + sharedLeads;
        const groupKey = buildAdvertiserPlatformKey(row.advertiserId, row.platformId);
        const unresolvedMeta = orderFallbackState.unresolvedByAdvertiserPlatform.get(groupKey);

        if (totalOrderLeads > 0) {
          return {
            ...row,
            leads: totalOrderLeads,
            cpl: totalOrderLeads > 0 ? row.spend / totalOrderLeads : 0,
            leadSource: sharedLeads > 0 ? 'order-share' : 'order-fallback',
            leadInputStatus: 'ok',
            lastOrderFallbackDate: unresolvedMeta?.lastDate || row.lastOrderFallbackDate,
            sharedOrderLeadCount: sharedLeads,
          };
        }

        if ((row.dashboardLeadCount || 0) > 0) {
          return {
            ...row,
            leads: row.dashboardLeadCount || 0,
            cpl: (row.dashboardLeadCount || 0) > 0 ? row.spend / (row.dashboardLeadCount || 0) : 0,
            leadSource: 'dashboard',
            sharedOrderLeadCount: sharedLeads,
          };
        }

        return {
          ...row,
          sharedOrderLeadCount: sharedLeads,
        };
      }),
    [
      baseLiveMetaRows,
      orderFallbackState.unresolvedByAdvertiserPlatform,
      sharedMetaOrderAllocations,
    ],
  );

  const baseLiveGoogleRows = React.useMemo<UnifiedPerformanceRow[]>(() => {
    if (!liveGoogleData || !googlePlatform) return [];

    return liveGoogleData.accounts
      .map((account) => {
        const configuredInternal = googleInternalAccountByConfiguredCustomerId.get(account.customerId);
        const matchedInternal =
          configuredInternal ||
          [
            ...buildLookupKeys(account.name),
            ...buildLookupKeys(account.customerName),
          ].reduce<(typeof googleInternalAccounts)[number] | undefined>(
            (currentMatch, key) => currentMatch || googleInternalAccountByNormalizedName.get(key),
            undefined,
          );

        if (!matchedInternal) return null;

        const internalAggregate = matchedInternal
          ? internalRangeByAccountId.get(matchedInternal.id)
          : undefined;
        const allTimeInternalStats = matchedInternal
          ? allTimeInternalStatsByAccountId.get(matchedInternal.id)
          : undefined;
        const orderFallback = matchedInternal
          ? orderFallbackState.exactByAccountId.get(matchedInternal.id)
          : undefined;
        const ppnRate = matchedInternal?.ppn || 0;
        const feeRate = matchedInternal?.fee || 0;
        const configuredManagerCustomerId = matchedInternal
          ? googleIntegrationConfigs[matchedInternal.id]?.managerCustomerId
          : undefined;
        const configuredManagerCustomerName = matchedInternal
          ? googleIntegrationConfigs[matchedInternal.id]?.managerCustomerName
          : undefined;
        const googleRowLiveLabel = isUsingGoogleLatestKnownSnapshot
          ? 'Snapshot DB terakhir'
          : 'Google Ads Live';
        const googleRowLiveError = isUsingGoogleLatestKnownSnapshot
          ? `Google Ads sedang rate limit. Menampilkan snapshot database terakhir${
              googleLatestKnownSnapshotDate ? ` tanggal ${googleLatestKnownSnapshotDate}` : ''
            }.`
          : account.error;
        const ppn = account.spend * (ppnRate / 100);
        const fee = account.spend * (feeRate / 100);
        const dashboardLeads = internalAggregate?.leads || 0;
        const orderFallbackLeads = orderFallback?.leads || 0;
        const currentLeads = orderFallbackLeads > 0 ? orderFallbackLeads : dashboardLeads;
        const leadSource: LeadSource =
          orderFallbackLeads > 0 ? 'order-fallback' : dashboardLeads > 0 ? 'dashboard' : 'none';
        const leadInputStatus =
          dashboardLeads > 0 || orderFallbackLeads > 0
            ? 'ok'
            : (allTimeInternalStats?.leads || 0) > 0
              ? 'missing-in-range'
              : 'never-input';

        return {
          uniqueId: `google-live:${account.customerId}`,
          source: 'google-live',
          platformId: googlePlatform.id,
          platformName: googlePlatform.name,
          businessGroupId:
            configuredManagerCustomerId ||
            account.managerCustomerId ||
            deriveAccountGroup(
              matchedInternal.id,
              googlePlatform.name,
              matchedInternal.advertiserName,
            ).id,
          businessGroupName:
            configuredManagerCustomerName ||
            account.managerCustomerName ||
            deriveAccountGroup(
              matchedInternal.id,
              googlePlatform.name,
              matchedInternal.advertiserName,
            ).name,
          adAccountId: matchedInternal.id,
          accountName: account.customerName || account.name,
          advertiserId: matchedInternal.advertiserId,
          advertiserName: matchedInternal.advertiserName,
          spend: account.spend,
          ppn,
          fee,
          burn: account.spend + ppn + fee,
          leads: currentLeads,
          cpl: currentLeads > 0 ? account.spend / currentLeads : 0,
          clicks: account.clicks,
          ctr: account.ctr,
          cpc: account.cpc,
          cpm: account.cpm,
          cpp: account.costPerConversion,
          reach: 0,
          impressions: account.impressions,
          currency: account.currencyCode,
          liveLabel: googleRowLiveLabel,
          liveError: googleRowLiveError,
          leadSource,
          leadInputStatus,
          lastLeadInputDate: allTimeInternalStats?.lastDate || null,
          lastOrderFallbackDate: orderFallback?.lastDate || null,
          dashboardLeadCount: dashboardLeads,
          exactOrderLeadCount: orderFallbackLeads,
          sharedOrderLeadCount: 0,
        } satisfies UnifiedPerformanceRow;
      })
      .filter(isUnifiedPerformanceRow);
  }, [
    allTimeInternalStatsByAccountId,
    googleInternalAccountByConfiguredCustomerId,
    googleInternalAccountByNormalizedName,
    googleLatestKnownSnapshotDate,
    googlePlatform,
    internalRangeByAccountId,
    isUsingGoogleLatestKnownSnapshot,
    liveGoogleData,
    orderFallbackState.exactByAccountId,
  ]);

  const sharedGoogleOrderAllocations = React.useMemo(
    () =>
      allocateCountsProportionally(
        baseLiveGoogleRows,
        orderFallbackState.unresolvedByAdvertiserPlatform,
      ),
    [baseLiveGoogleRows, orderFallbackState.unresolvedByAdvertiserPlatform],
  );

  const liveGoogleRows = React.useMemo<UnifiedPerformanceRow[]>(
    () =>
      baseLiveGoogleRows.map((row) => {
        const sharedLeads = sharedGoogleOrderAllocations.get(row.adAccountId) || 0;
        const totalOrderLeads = (row.exactOrderLeadCount || 0) + sharedLeads;
        const groupKey = buildAdvertiserPlatformKey(row.advertiserId, row.platformId);
        const unresolvedGoogle = orderFallbackState.unresolvedByAdvertiserPlatform.get(groupKey);

        if (totalOrderLeads > 0) {
          return {
            ...row,
            leads: totalOrderLeads,
            cpl: totalOrderLeads > 0 ? row.spend / totalOrderLeads : 0,
            leadSource: sharedLeads > 0 ? 'order-share' : 'order-fallback',
            leadInputStatus: 'ok',
            lastOrderFallbackDate: unresolvedGoogle?.lastDate || row.lastOrderFallbackDate,
            sharedOrderLeadCount: sharedLeads,
          };
        }

        if ((row.dashboardLeadCount || 0) > 0) {
          return {
            ...row,
            leads: row.dashboardLeadCount || 0,
            cpl: (row.dashboardLeadCount || 0) > 0 ? row.spend / (row.dashboardLeadCount || 0) : 0,
            leadSource: 'dashboard',
            sharedOrderLeadCount: sharedLeads,
          };
        }

        return {
          ...row,
          sharedOrderLeadCount: sharedLeads,
        };
      }),
    [
      baseLiveGoogleRows,
      orderFallbackState.unresolvedByAdvertiserPlatform,
      sharedGoogleOrderAllocations,
    ],
  );

  const baseLiveTikTokRows = React.useMemo<UnifiedPerformanceRow[]>(() => {
    if (!liveTikTokData || !tiktokPlatform) return [];

    return liveTikTokData.accounts
      .map((account) => {
        const configuredInternal = tiktokInternalAccountByConfiguredAdvertiserId.get(account.advertiserId);
        const matchedInternal =
          configuredInternal ||
          buildFlexibleLookupKeys(account.advertiserName).reduce<
            (typeof tiktokInternalAccounts)[number] | undefined
          >((current, key) => current || tiktokInternalAccountByNormalizedName.get(key), undefined);

        if (!matchedInternal) return null;

        const internalAggregate = internalRangeByAccountId.get(matchedInternal.id);
        const allTimeInternalStats = allTimeInternalStatsByAccountId.get(matchedInternal.id);
        const orderFallback = orderFallbackState.exactByAccountId.get(matchedInternal.id);
      const configuredBusinessCenterId =
        tiktokIntegrationConfigs[matchedInternal.id]?.businessCenterId;
      const configuredBusinessCenterName =
        sanitizeTikTokBusinessCenterName(
          tiktokIntegrationConfigs[matchedInternal.id]?.businessCenterName,
        );
        const ppnRate = matchedInternal.ppn || 0;
        const feeRate = matchedInternal.fee || 0;
        const ppn = account.spend * (ppnRate / 100);
        const fee = account.spend * (feeRate / 100);
        const dashboardLeads = internalAggregate?.leads || 0;
        const orderFallbackLeads = orderFallback?.leads || 0;
        const currentLeads = orderFallbackLeads > 0 ? orderFallbackLeads : dashboardLeads;
        const leadSource: LeadSource =
          orderFallbackLeads > 0 ? 'order-fallback' : dashboardLeads > 0 ? 'dashboard' : 'none';
        const leadInputStatus =
          dashboardLeads > 0 || orderFallbackLeads > 0
            ? 'ok'
            : (allTimeInternalStats?.leads || 0) > 0
              ? 'missing-in-range'
              : 'never-input';

        return {
          uniqueId: `tiktok-live:${account.advertiserId}`,
          source: 'tiktok-live',
          platformId: tiktokPlatform.id,
          platformName: tiktokPlatform.name,
          businessGroupId:
            configuredBusinessCenterId ||
            account.businessCenterId ||
            `tiktok-bc-${matchedInternal.id}`,
          businessGroupName:
            configuredBusinessCenterName ||
            sanitizeTikTokBusinessCenterName(account.businessCenterName) ||
            `TikTok Ads • ${matchedInternal.advertiserName}`,
          adAccountId: matchedInternal.id,
          accountName: account.advertiserName,
          advertiserId: matchedInternal.advertiserId,
          advertiserName: matchedInternal.advertiserName,
          spend: account.spend,
          ppn,
          fee,
          burn: account.spend + ppn + fee,
          leads: currentLeads,
          cpl: currentLeads > 0 ? account.spend / currentLeads : 0,
          clicks: account.clicks,
          ctr: account.ctr,
          cpc: account.cpc,
          cpm: account.cpm,
          cpp: account.costPerConversion,
          reach: 0,
          impressions: account.impressions,
          currency: account.currency,
          liveLabel: 'TikTok Ads Live',
          liveError: account.error,
          leadSource,
          leadInputStatus,
          lastLeadInputDate: allTimeInternalStats?.lastDate || null,
          lastOrderFallbackDate: orderFallback?.lastDate || null,
          dashboardLeadCount: dashboardLeads,
          exactOrderLeadCount: orderFallbackLeads,
          sharedOrderLeadCount: 0,
        } satisfies UnifiedPerformanceRow;
      })
      .filter(isUnifiedPerformanceRow);
  }, [
    allTimeInternalStatsByAccountId,
    internalRangeByAccountId,
    liveTikTokData,
    orderFallbackState.exactByAccountId,
    tiktokIntegrationConfigs,
    tiktokInternalAccountByConfiguredAdvertiserId,
    tiktokInternalAccountByNormalizedName,
    tiktokPlatform,
  ]);

  const sharedTikTokOrderAllocations = React.useMemo(
    () =>
      allocateCountsProportionally(
        baseLiveTikTokRows,
        orderFallbackState.unresolvedByAdvertiserPlatform,
      ),
    [baseLiveTikTokRows, orderFallbackState.unresolvedByAdvertiserPlatform],
  );

  const liveTikTokRows = React.useMemo<UnifiedPerformanceRow[]>(
    () =>
      baseLiveTikTokRows.map((row) => {
        const sharedLeads = sharedTikTokOrderAllocations.get(row.adAccountId) || 0;
        const totalOrderLeads = (row.exactOrderLeadCount || 0) + sharedLeads;
        const groupKey = buildAdvertiserPlatformKey(row.advertiserId, row.platformId);
        const unresolvedTikTok = orderFallbackState.unresolvedByAdvertiserPlatform.get(groupKey);

        if (totalOrderLeads > 0) {
          return {
            ...row,
            leads: totalOrderLeads,
            cpl: totalOrderLeads > 0 ? row.spend / totalOrderLeads : 0,
            leadSource: sharedLeads > 0 ? 'order-share' : 'order-fallback',
            leadInputStatus: 'ok',
            lastOrderFallbackDate: unresolvedTikTok?.lastDate || row.lastOrderFallbackDate,
            sharedOrderLeadCount: sharedLeads,
          };
        }

        if ((row.dashboardLeadCount || 0) > 0) {
          return {
            ...row,
            leads: row.dashboardLeadCount || 0,
            cpl: (row.dashboardLeadCount || 0) > 0 ? row.spend / (row.dashboardLeadCount || 0) : 0,
            leadSource: 'dashboard',
            sharedOrderLeadCount: sharedLeads,
          };
        }

        return {
          ...row,
          sharedOrderLeadCount: sharedLeads,
        };
      }),
    [
      baseLiveTikTokRows,
      orderFallbackState.unresolvedByAdvertiserPlatform,
      sharedTikTokOrderAllocations,
    ],
  );

  const liveGoogleRowAccountIds = React.useMemo(
    () => new Set(liveGoogleRows.map((row) => row.adAccountId)),
    [liveGoogleRows],
  );

  const fallbackGoogleRows = React.useMemo<UnifiedPerformanceRow[]>(() => {
    const googleRateLimited = Boolean(extractRetryAfterSeconds(liveGoogleError));

    return googleInternalAccounts
      .filter((account) => !liveGoogleRowAccountIds.has(account.id))
      .map((account) => {
        const config = googleIntegrationConfigs[account.id];
        const internalAggregate = internalRangeByAccountId.get(account.id);
        const allTimeInternalStats = allTimeInternalStatsByAccountId.get(account.id);
        const orderFallback = orderFallbackState.exactByAccountId.get(account.id);
        const sharedLeads = sharedGoogleOrderAllocations.get(account.id) || 0;
        const totalOrderLeads = (orderFallback?.leads || 0) + sharedLeads;
        const dashboardLeads = internalAggregate?.leads || 0;
        const currentLeads = totalOrderLeads > 0 ? totalOrderLeads : dashboardLeads;
        const ppn = internalAggregate?.ppn || 0;
        const fee = internalAggregate?.fee || 0;
        const spend = internalAggregate?.spend || 0;
        const burn = internalAggregate?.burn || spend + ppn + fee;
        const leadSource: LeadSource =
          totalOrderLeads > 0
            ? sharedLeads > 0
              ? 'order-share'
              : 'order-fallback'
            : dashboardLeads > 0
              ? 'dashboard'
              : 'none';
        const leadInputStatus =
          dashboardLeads > 0 || totalOrderLeads > 0
            ? 'ok'
            : (allTimeInternalStats?.leads || 0) > 0
              ? 'missing-in-range'
              : 'never-input';
        const derivedGroup = deriveAccountGroup(
          account.id,
          account.platformName,
          account.advertiserName,
        );
        const keepVisibleWhileGoogleLimited =
          Boolean(config?.liveGoogleCustomerId) &&
          (googleRateLimited || isUsingGoogleLatestKnownSnapshot);
        const liveLabel = !config?.liveGoogleCustomerId
          ? 'Belum dipetakan'
          : googleRateLimited
            ? isUsingGoogleLatestKnownSnapshot
              ? 'Snapshot DB terakhir'
              : 'Rate limit Google'
            : 'Menunggu sinkron otomatis';
        const liveError = !config?.liveGoogleCustomerId
          ? 'Customer Google Ads belum dipasangkan ke akun internal.'
          : googleRateLimited
            ? isUsingGoogleLatestKnownSnapshot
              ? 'Google Ads sedang rate limit. Tabel memakai snapshot database terakhir yang tersedia.'
              : 'Google Ads sedang rate limit. Akun tetap ditampilkan, tetapi snapshot database untuk akun ini belum tersedia.'
            : liveGoogleError || 'Snapshot Google Ads belum tersedia untuk rentang ini.';

        return {
          uniqueId: `google-internal:${account.id}`,
          source: 'internal',
          platformId: account.platformId,
          platformName: account.platformName,
          businessGroupId: config?.managerCustomerId || derivedGroup.id,
          businessGroupName: config?.managerCustomerName || derivedGroup.name,
          adAccountId: account.id,
          accountName: config?.liveGoogleCustomerName || account.accountName,
          advertiserId: account.advertiserId,
          advertiserName: account.advertiserName,
          spend,
          ppn,
          fee,
          burn,
          leads: currentLeads,
          cpl: currentLeads > 0 ? spend / currentLeads : 0,
          clicks: 0,
          ctr: null,
          cpc: null,
          cpm: null,
          cpp: null,
          reach: 0,
          impressions: 0,
          currency: 'IDR',
          liveLabel,
          liveError,
          leadSource,
          leadInputStatus,
          lastLeadInputDate: allTimeInternalStats?.lastDate || null,
          lastOrderFallbackDate: orderFallback?.lastDate || null,
          dashboardLeadCount: dashboardLeads,
          exactOrderLeadCount: orderFallback?.leads || 0,
          sharedOrderLeadCount: sharedLeads,
        } satisfies UnifiedPerformanceRow;
      })
      .filter((row) => {
        return (
          row.spend > 0 ||
          row.leads > 0 ||
          (row.liveLabel !== 'Belum dipetakan' && (googleRateLimited || isUsingGoogleLatestKnownSnapshot))
        );
      });
  }, [
    allTimeInternalStatsByAccountId,
    googleIntegrationConfigs,
    googleInternalAccounts,
    internalRangeByAccountId,
    isUsingGoogleLatestKnownSnapshot,
    liveGoogleError,
    liveGoogleRowAccountIds,
    orderFallbackState.exactByAccountId,
    sharedGoogleOrderAllocations,
  ]);

  const combinedRows = React.useMemo(
    () => [...liveMetaRows, ...liveGoogleRows, ...liveTikTokRows, ...fallbackGoogleRows],
    [fallbackGoogleRows, liveGoogleRows, liveMetaRows, liveTikTokRows],
  );

  const businessGroupOptions = React.useMemo<IntegrasiIklanOption[]>(() => {
    const optionMap = new Map<string, string>();

    for (const row of combinedRows) {
      if (selectedPlatformId !== 'all' && row.platformId !== selectedPlatformId) continue;
      if (selectedAdvertiserId !== 'all' && row.advertiserId !== selectedAdvertiserId) continue;
      optionMap.set(row.businessGroupId, row.businessGroupName);
    }

    return Array.from(optionMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [combinedRows, selectedAdvertiserId, selectedPlatformId]);

  const advertiserOptions = React.useMemo<IntegrasiIklanOption[]>(() => {
    const optionMap = new Map<string, string>();

    for (const row of combinedRows) {
      if (selectedPlatformId !== 'all' && row.platformId !== selectedPlatformId) continue;
      if (selectedGroupId !== 'all' && row.businessGroupId !== selectedGroupId) continue;
      optionMap.set(row.advertiserId, row.advertiserName);
    }

    return Array.from(optionMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [combinedRows, selectedGroupId, selectedPlatformId]);

  const adAccountOptions = React.useMemo<IntegrasiIklanOption[]>(() => {
    const optionMap = new Map<string, string>();

    for (const row of combinedRows) {
      if (selectedPlatformId !== 'all' && row.platformId !== selectedPlatformId) continue;
      if (selectedGroupId !== 'all' && row.businessGroupId !== selectedGroupId) continue;
      if (selectedAdvertiserId !== 'all' && row.advertiserId !== selectedAdvertiserId) continue;
      optionMap.set(row.adAccountId, row.accountName);
    }

    return Array.from(optionMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [combinedRows, selectedAdvertiserId, selectedGroupId, selectedPlatformId]);

  const filteredRows = React.useMemo(() => {
    return combinedRows
      .filter((row) => {
        if (selectedPlatformId !== 'all' && row.platformId !== selectedPlatformId) return false;
        if (selectedGroupId !== 'all' && row.businessGroupId !== selectedGroupId) return false;
        if (selectedAdvertiserId !== 'all' && row.advertiserId !== selectedAdvertiserId) return false;
        if (selectedAdAccountId !== 'all' && row.adAccountId !== selectedAdAccountId) return false;
        return true;
      })
      .sort((left, right) => right.spend - left.spend);
  }, [combinedRows, selectedAdAccountId, selectedAdvertiserId, selectedGroupId, selectedPlatformId]);

  const summary = React.useMemo<IntegrasiIklanSummary>(() => {
    const spend = filteredRows.reduce((sum, row) => sum + row.spend, 0);
    const ppn = filteredRows.reduce((sum, row) => sum + row.ppn, 0);
    const fee = filteredRows.reduce((sum, row) => sum + row.fee, 0);
    const burn = filteredRows.reduce((sum, row) => sum + row.burn, 0);
    const leads = filteredRows.reduce((sum, row) => sum + row.leads, 0);
    const clicks = filteredRows.reduce((sum, row) => sum + row.clicks, 0);
    const advertiserCount = new Set(filteredRows.map((row) => row.advertiserId)).size;
    const accountCount = filteredRows.length;

    return {
      spend,
      ppn,
      fee,
      burn,
      leads,
      clicks,
      advertiserCount,
      accountCount,
      cpl: leads > 0 ? spend / leads : 0,
    };
  }, [filteredRows]);

  const handlePlatformChange = (value: string) => {
    setSelectedPlatformId(value);
    setSelectedGroupId('all');
    setSelectedAdvertiserId('all');
    setSelectedAdAccountId('all');
  };

  const handleGroupChange = (value: string) => {
    setSelectedGroupId(value);
    setSelectedAdvertiserId('all');
    setSelectedAdAccountId('all');
  };

  const handleAdvertiserChange = (value: string) => {
    setSelectedAdvertiserId(value);
    setSelectedAdAccountId('all');
  };

  const hasMetaSnapshotData = effectiveMetaSnapshotRows.length > 0;
  const hasGoogleSnapshotData = effectiveGoogleSnapshotRows.length > 0;
  const hasTikTokSnapshotData = effectiveTikTokSnapshotRows.length > 0;
  const configuredGoogleLiveAccountCount = googleInternalAccounts.filter(
    (account) => !!googleIntegrationConfigs[account.id]?.liveGoogleCustomerId,
  ).length;
  const googleRetryAfterSeconds = extractRetryAfterSeconds(liveGoogleError);
  const isUsingStaleMetaSnapshot = hasMetaSnapshotData;
  const isUsingStaleGoogleSnapshot = hasGoogleSnapshotData || isUsingGoogleLatestKnownSnapshot;
  const isUsingStaleTikTokSnapshot = hasTikTokSnapshotData;
  const shouldShowMetaError = !!liveMetaError && (selectedRangeIncludesToday || !hasMetaSnapshotData);
  const shouldShowGoogleError =
    !!liveGoogleError && (selectedRangeIncludesToday || !hasGoogleSnapshotData);
  const shouldShowGoogleSyncWaiting =
    !shouldShowGoogleError &&
    configuredGoogleLiveAccountCount > 0 &&
    googleSnapshotRowsInRange.length === 0 &&
    liveGoogleRows.length === 0;
  const shouldShowTikTokError =
    !!liveTikTokError && (selectedRangeIncludesToday || !hasTikTokSnapshotData);
  const isApplyingDateRange = getDateRangeValueKey(selectedDateRange) !== getDateRangeValueKey(appliedDateRange);
  const handleDateRangeChange = React.useCallback((nextRange: DateRange | undefined) => {
    setSelectedDateRange((currentRange) => {
      if (getDateRangeValueKey(currentRange) === getDateRangeValueKey(nextRange)) {
        return currentRange;
      }

      return nextRange;
    });
  }, []);

  return (
    <div className="p-4 md:p-8 w-full max-w-[1600px] mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 space-y-6">
      <div className="space-y-6">
        {shouldShowMetaError ? (
          <Card
            className={
              isUsingStaleMetaSnapshot
                ? 'border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-900 dark:bg-amber-950/30'
                : 'border-rose-200 bg-rose-50 p-4 shadow-sm dark:border-rose-900 dark:bg-rose-950/30'
            }
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className={
                  isUsingStaleMetaSnapshot
                    ? 'mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400'
                    : 'mt-0.5 h-5 w-5 text-rose-600 dark:text-rose-400'
                }
              />
              <div>
                <div
                  className={
                    isUsingStaleMetaSnapshot
                      ? 'font-semibold text-amber-700 dark:text-amber-300'
                      : 'font-semibold text-rose-700 dark:text-rose-300'
                  }
                >
                  {isUsingStaleMetaSnapshot
                    ? selectedRangeIncludesToday
                      ? 'Sinkronisasi Meta hari ini bermasalah, snapshot database terakhir tetap dipakai'
                      : 'Sinkronisasi Meta bermasalah, snapshot database terakhir tetap dipakai'
                    : 'Snapshot Meta belum berhasil dimuat'}
                </div>
                <p
                  className={
                    isUsingStaleMetaSnapshot
                      ? 'mt-1 text-sm text-amber-600 dark:text-amber-400'
                      : 'mt-1 text-sm text-rose-600 dark:text-rose-400'
                  }
                >
                  {liveMetaError}
                </p>
              </div>
            </div>
          </Card>
        ) : null}

        {shouldShowGoogleError ? (
          <Card
            className={
              isUsingStaleGoogleSnapshot
                ? 'border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-900 dark:bg-amber-950/30'
                : 'border-rose-200 bg-rose-50 p-4 shadow-sm dark:border-rose-900 dark:bg-rose-950/30'
            }
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className={
                  isUsingStaleGoogleSnapshot
                    ? 'mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400'
                    : 'mt-0.5 h-5 w-5 text-rose-600 dark:text-rose-400'
                }
              />
              <div>
                <div
                  className={
                    isUsingStaleGoogleSnapshot
                      ? 'font-semibold text-amber-700 dark:text-amber-300'
                      : 'font-semibold text-rose-700 dark:text-rose-300'
                  }
                >
                  {isUsingStaleGoogleSnapshot
                    ? selectedRangeIncludesToday
                      ? googleRetryAfterSeconds
                        ? 'Google Ads sedang dibatasi quota, snapshot terakhir tetap dipakai'
                        : 'Sinkronisasi Google Ads hari ini bermasalah, snapshot database terakhir tetap dipakai'
                      : googleRetryAfterSeconds
                        ? 'Google Ads sedang dibatasi quota, sistem akan mencoba sinkron ulang otomatis'
                        : 'Sinkronisasi Google Ads bermasalah, snapshot database terakhir tetap dipakai'
                    : googleRetryAfterSeconds
                      ? 'Snapshot Google Ads belum tersedia karena quota Google Ads sedang dibatasi'
                      : 'Snapshot Google Ads belum berhasil dimuat'}
                </div>
                <p
                  className={
                    isUsingStaleGoogleSnapshot
                      ? 'mt-1 text-sm text-amber-600 dark:text-amber-400'
                      : 'mt-1 text-sm text-rose-600 dark:text-rose-400'
                  }
                >
                  {googleRetryAfterSeconds
                    ? isUsingGoogleLatestKnownSnapshot
                      ? `Google Ads API sedang membatasi sinkronisasi. Tabel tetap memakai snapshot database terakhir${
                          googleLatestKnownSnapshotDate
                            ? ` tanggal ${googleLatestKnownSnapshotDate}`
                            : ''
                        } dan sistem akan mencoba lagi otomatis sekitar ${formatRetryDelayLabel(
                          googleRetryAfterSeconds,
                        )} lagi.`
                      : `Google Ads API sedang membatasi sinkronisasi. Akun yang sudah dipetakan tetap ditampilkan, tetapi metrik live baru akan terisi setelah snapshot database pertama masuk. Sistem akan mencoba lagi otomatis sekitar ${formatRetryDelayLabel(
                          googleRetryAfterSeconds,
                        )} lagi.`
                    : liveGoogleError}
                </p>
              </div>
            </div>
          </Card>
        ) : null}

        {shouldShowGoogleSyncWaiting ? (
          <Card className="border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900 dark:bg-blue-950/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <div className="font-semibold text-blue-700 dark:text-blue-300">
                  Google Ads sedang menunggu sinkronisasi otomatis pertama untuk rentang ini
                </div>
                <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">
                  Akun Google yang sudah dihubungkan tetap dikenali, tetapi metrik live seperti
                  spend, clicks, CTR, dan CPL baru akan terisi setelah snapshot Google masuk.
                </p>
              </div>
            </div>
          </Card>
        ) : null}

        {shouldShowTikTokError ? (
          <Card
            className={
              isUsingStaleTikTokSnapshot
                ? 'border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-900 dark:bg-amber-950/30'
                : 'border-rose-200 bg-rose-50 p-4 shadow-sm dark:border-rose-900 dark:bg-rose-950/30'
            }
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className={
                  isUsingStaleTikTokSnapshot
                    ? 'mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400'
                    : 'mt-0.5 h-5 w-5 text-rose-600 dark:text-rose-400'
                }
              />
              <div>
                <div
                  className={
                    isUsingStaleTikTokSnapshot
                      ? 'font-semibold text-amber-700 dark:text-amber-300'
                      : 'font-semibold text-rose-700 dark:text-rose-300'
                  }
                >
                  {isUsingStaleTikTokSnapshot
                    ? selectedRangeIncludesToday
                      ? 'Sinkronisasi TikTok Ads hari ini bermasalah, snapshot database terakhir tetap dipakai'
                      : 'Sinkronisasi TikTok Ads bermasalah, snapshot database terakhir tetap dipakai'
                    : 'Snapshot TikTok Ads belum berhasil dimuat'}
                </div>
                <p
                  className={
                    isUsingStaleTikTokSnapshot
                      ? 'mt-1 text-sm text-amber-600 dark:text-amber-400'
                      : 'mt-1 text-sm text-rose-600 dark:text-rose-400'
                  }
                >
                  {liveTikTokError}
                </p>
              </div>
            </div>
          </Card>
        ) : null}

        <IntegrasiIklanFilters
          selectedDateRange={selectedDateRange}
          onDateRangeChange={handleDateRangeChange}
          selectedPlatformId={selectedPlatformId}
          selectedGroupId={selectedGroupId}
          selectedAdvertiserId={selectedAdvertiserId}
          selectedAdAccountId={selectedAdAccountId}
          onPlatformChange={handlePlatformChange}
          onGroupChange={handleGroupChange}
          onAdvertiserChange={handleAdvertiserChange}
          onAdAccountChange={setSelectedAdAccountId}
          platformOptions={platforms
            .filter((platform) => platform.status === 'active')
            .map((platform) => ({ id: platform.id, name: platform.name }))}
          businessGroupOptions={businessGroupOptions}
          advertiserOptions={advertiserOptions}
          adAccountOptions={adAccountOptions}
          isApplyingDateRange={isApplyingDateRange}
        />

        <IntegrasiIklanSummaryCards
          summary={summary}
          formatCurrency={formatCurrency}
          formatNumber={formatNumber}
        />

        <IntegrasiIklanTable
          rows={filteredRows}
          accountCount={summary.accountCount}
          formatCurrency={formatCurrency}
          formatNumber={formatNumber}
          formatPercent={formatPercent}
        />
      </div>
    </div>
  );
}

export default UnifiedAdsMonitoringPage;
