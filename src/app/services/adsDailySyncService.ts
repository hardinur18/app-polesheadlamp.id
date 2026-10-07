import { supabase } from '@/lib/supabaseClient';
import type {
  AdAccount,
  AdAccountAssignment,
  AdAccountOwnerAssignment,
  DailyAd,
  Platform,
  User,
} from '@/app/pages/master-data/data';
import {
  fetchAdsIntegrationConfigs,
  syncMetaSnapshotDataset,
  type AdsIntegrationConfig,
  type MetaSnapshotRow,
} from '@/app/services/liveAdsService';
import {
  fetchGoogleAdsIntegrationConfigs,
  syncGoogleAdsSnapshotDataset,
  type GoogleAdsIntegrationConfig,
  type GoogleAdsSnapshotRow,
} from '@/app/services/googleAdsLiveService';
import {
  fetchTikTokAdsIntegrationConfigs,
  syncTikTokAdsSnapshotDataset,
  type TikTokAdsIntegrationConfig,
  type TikTokAdsSnapshotRow,
} from '@/app/services/tiktokAdsLiveService';
import {
  fetchAdAccountApiMappings,
  type AdAccountApiMapping,
} from '@/app/services/adApiIntegrationService';

export type AdsProviderKey = 'meta' | 'google' | 'tiktok';
export type AdsDailySyncMode = 'insert-missing' | 'update-existing';

export type AdsDailySyncProviderStatus = {
  key: AdsProviderKey;
  label: string;
  state: 'loading' | 'success' | 'empty' | 'error';
  count: number;
  message: string;
};

export type AdsDailySyncPreviewRow = {
  id: string;
  date: string;
  platformId: string;
  adAccountId: string;
  advertiserId: string;
  csId?: string;
  subChannelId?: string;
  amountSpent: number;
  leadsDashboard: number;
  ppnAmount: number;
  feeAmount: number;
  sourceLabel: string;
  accountName: string;
  advertiserName: string;
  status: 'new' | 'update' | 'skip' | 'unmapped';
  reason: string;
  existing?: DailyAd;
};

export type AdsDailySyncContext = {
  dailyAds: DailyAd[];
  platforms: Platform[];
  adAccounts: AdAccount[];
  adAccountAssignments: AdAccountAssignment[];
  adAccountOwnerAssignments: AdAccountOwnerAssignment[];
  users: User[];
};

export type AdsDailySyncFilters = {
  platformId?: string;
  advertiserId?: string;
  csId?: string;
  adAccountId?: string;
  mode?: AdsDailySyncMode;
  preserveEdited?: boolean;
  mappedOnly?: boolean;
};

export type AdsDailySyncPreviewResult = {
  rows: AdsDailySyncPreviewRow[];
  providerStatuses: AdsDailySyncProviderStatus[];
  errors: string[];
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  unmappedCount: number;
};

export type AdsDailySyncCommitResult = {
  inserted: number;
  updated: number;
};

type AdsSnapshotRow = MetaSnapshotRow | GoogleAdsSnapshotRow | TikTokAdsSnapshotRow;

type IntegrationConfigs = {
  meta: AdsIntegrationConfig[];
  google: GoogleAdsIntegrationConfig[];
  tiktok: TikTokAdsIntegrationConfig[];
  mappings: AdAccountApiMapping[];
};

type ProviderBuildResult = {
  rows: AdsDailySyncPreviewRow[];
  ignoredZeroActivityCount: number;
  ignoredInactiveAccountCount: number;
};

const providerLabels: Record<AdsProviderKey, string> = {
  meta: 'Meta',
  google: 'Google Ads',
  tiktok: 'TikTok Ads',
};

const defaultFilters: Required<Pick<AdsDailySyncFilters, 'mode' | 'preserveEdited' | 'mappedOnly'>> = {
  mode: 'update-existing',
  preserveEdited: true,
  mappedOnly: true,
};

const normalizeLookupKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^act_/, '')
    .replace(/\s+/g, ' ');

const normalizeExternalAccountId = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^act_/, '')
    .replace(/[^a-z0-9]/g, '');

const normalizeFlexibleLookupKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^act_/, '')
    .replace(/[^a-z0-9]+/g, '');

const buildFlexibleLookupKeys = (value: unknown) => {
  const rawValue = String(value || '');
  const keys = new Set<string>();
  const add = (candidate: string) => {
    const key = normalizeFlexibleLookupKey(candidate);
    if (key) keys.add(key);
  };

  add(rawValue);
  add(rawValue.replace(/\b(akun|account|ads?|iklan|meta|facebook|fb|tiktok|tik\s*tok|snack\s*video|google)\b/gi, ' '));
  add(rawValue.replace(/\b(cv|pt)\b/gi, ' '));
  add(rawValue.replace(/\s+\d+\s*$/g, ' '));
  add(rawValue.replace(/\b(cv|pt)\b/gi, ' ').replace(/\s+\d+\s*$/g, ' '));

  return [...keys];
};

const getTrailingNumberKey = (value: unknown) =>
  String(value || '').match(/(\d+)\s*$/)?.[1] || '';

const normalizeProviderName = (value: unknown) =>
  String(value || '').toLowerCase().replace(/\s+/g, '');

export const getAdsProviderKeyByPlatformName = (name: unknown): AdsProviderKey | null => {
  const normalized = normalizeProviderName(name);
  if (normalized.includes('google')) return 'google';
  if (normalized.includes('tiktok')) return 'tiktok';
  if (normalized.includes('meta') || normalized.includes('facebook') || normalized.includes('instagram')) return 'meta';
  return null;
};

const getDailyAdKey = (row: Pick<DailyAd, 'date' | 'adAccountId'>) =>
  `${row.date}|${row.adAccountId}`;

const getUserName = (users: User[], id?: string) =>
  users.find((user) => user.id === id)?.name || 'Tidak diketahui';

const resolveAssignmentForDate = (
  assignments: AdAccountAssignment[],
  adAccountId: string,
  date: string,
) => assignments
  .filter((assignment) =>
    assignment.adAccountId === adAccountId &&
    assignment.status === 'active' &&
    assignment.startDate <= date &&
    (!assignment.endDate || assignment.endDate >= date)
  )
  .sort((left, right) => right.startDate.localeCompare(left.startDate))[0];

const resolveOwnerForDate = (
  ownerAssignments: AdAccountOwnerAssignment[],
  adAccountId: string,
  date: string,
  fallbackAdvertiserId: string,
) => ownerAssignments
  .filter((assignment) =>
    assignment.adAccountId === adAccountId &&
    assignment.status === 'active' &&
    assignment.startDate <= date &&
    (!assignment.endDate || assignment.endDate >= date)
  )
  .sort((left, right) => right.startDate.localeCompare(left.startDate))[0]?.advertiserId || fallbackAdvertiserId;

const getErrorMessage = (provider: AdsProviderKey, reason: unknown) => {
  const rawMessage = reason instanceof Error ? reason.message : String(reason || 'Sinkronisasi API gagal.');
  if (provider === 'google' && /invalid_grant/i.test(rawMessage)) {
    return 'Token OAuth Google Ads ditolak. Reconnect Google Ads di Master Data Akun Iklan.';
  }
  return rawMessage;
};

const getEmptyMessage = (provider: AdsProviderKey, enabledConfigCount: number) => {
  if (enabledConfigCount === 0) {
    return `Belum ada akun ${providerLabels[provider]} aktif yang dipetakan ke Master Data Akun Iklan.`;
  }
  return `${enabledConfigCount} akun terpetakan, tetapi tidak ada snapshot pada periode/filter ini.`;
};

export async function loadAdsDailySyncIntegrationConfigs(): Promise<IntegrationConfigs> {
  const [meta, google, tiktok, mappings] = await Promise.allSettled([
    fetchAdsIntegrationConfigs(),
    fetchGoogleAdsIntegrationConfigs(),
    fetchTikTokAdsIntegrationConfigs(),
    fetchAdAccountApiMappings(),
  ]);

  return {
    meta: meta.status === 'fulfilled' ? meta.value : [],
    google: google.status === 'fulfilled' ? google.value : [],
    tiktok: tiktok.status === 'fulfilled' ? tiktok.value : [],
    mappings: mappings.status === 'fulfilled' ? mappings.value : [],
  };
}

const resolveAdAccountFromSnapshot = (
  snapshot: AdsSnapshotRow,
  candidateAdAccounts: AdAccount[],
  platforms: Platform[],
  configs: IntegrationConfigs,
) => {
  if (snapshot.internalAdAccountId) {
    const account = candidateAdAccounts.find((item) => item.id === snapshot.internalAdAccountId);
    if (account) return account;
  }

  const platformKey = snapshot.platformKey;
  const externalAccountId = normalizeExternalAccountId(snapshot.externalAccountId);
  const externalAccountName = normalizeLookupKey(snapshot.externalAccountName);
  const externalNameKeys = buildFlexibleLookupKeys(snapshot.externalAccountName);

  const activeMapping = configs.mappings.find((mapping) =>
    mapping.status === 'active' &&
    mapping.platformKey === platformKey &&
    normalizeExternalAccountId(mapping.externalAccountId) === externalAccountId
  );
  if (activeMapping) {
    const mappedAccount = candidateAdAccounts.find((item) => item.id === activeMapping.internalAdAccountId);
    if (mappedAccount) return mappedAccount;
  }

  const integrationAccountId =
    platformKey === 'meta'
      ? configs.meta.find((config) =>
          config.enabled && (
            normalizeExternalAccountId(config.liveMetaAccountId) === externalAccountId ||
            normalizeLookupKey(config.liveMetaAccountName) === externalAccountName ||
            buildFlexibleLookupKeys(config.liveMetaAccountName).some((key) => externalNameKeys.includes(key))
          )
        )?.adAccountId
      : platformKey === 'google'
        ? configs.google.find((config) =>
            config.enabled && (
              normalizeExternalAccountId(config.liveGoogleCustomerId) === externalAccountId ||
              normalizeLookupKey(config.liveGoogleCustomerName) === externalAccountName ||
              buildFlexibleLookupKeys(config.liveGoogleCustomerName).some((key) => externalNameKeys.includes(key))
            )
          )?.adAccountId
        : configs.tiktok.find((config) =>
            config.enabled && (
              normalizeExternalAccountId(config.liveTikTokAdvertiserId) === externalAccountId ||
              normalizeLookupKey(config.liveTikTokAdvertiserName) === externalAccountName ||
              buildFlexibleLookupKeys(config.liveTikTokAdvertiserName).some((key) => externalNameKeys.includes(key))
            )
          )?.adAccountId;

  if (integrationAccountId) {
    const account = candidateAdAccounts.find((item) => item.id === integrationAccountId);
    if (account) return account;
  }

  const platformCandidates = platforms
    .filter((platform) => getAdsProviderKeyByPlatformName(platform.name) === platformKey)
    .map((platform) => platform.id);
  const accountIdKey = normalizeLookupKey(snapshot.externalAccountId);
  const snapshotNumberKey = getTrailingNumberKey(snapshot.externalAccountName);
  const internalByUniqueNumber = new Map<string, AdAccount>();
  const duplicateNumberKeys = new Set<string>();

  for (const account of candidateAdAccounts.filter((item) => platformCandidates.includes(item.platformId))) {
    const numberKey = getTrailingNumberKey(account.accountName);
    if (!numberKey) continue;
    if (internalByUniqueNumber.has(numberKey)) {
      internalByUniqueNumber.delete(numberKey);
      duplicateNumberKeys.add(numberKey);
      continue;
    }
    if (!duplicateNumberKeys.has(numberKey)) {
      internalByUniqueNumber.set(numberKey, account);
    }
  }

  return candidateAdAccounts.find((account) => {
    if (!platformCandidates.includes(account.platformId)) return false;
    const internalNameKey = normalizeLookupKey(account.accountName);
    const internalFlexibleKeys = buildFlexibleLookupKeys(account.accountName);
    return (
      internalNameKey === externalAccountName ||
      internalNameKey === accountIdKey ||
      internalFlexibleKeys.some((key) => externalNameKeys.includes(key))
    );
  }) || (snapshotNumberKey ? internalByUniqueNumber.get(snapshotNumberKey) : undefined);
};

const buildPreviewRowsForProvider = ({
  snapshotRows,
  sourceLabel,
  context,
  configs,
  filters,
}: {
  snapshotRows: AdsSnapshotRow[];
  sourceLabel: string;
  context: AdsDailySyncContext;
  configs: IntegrationConfigs;
  filters: Required<Pick<AdsDailySyncFilters, 'mode' | 'preserveEdited' | 'mappedOnly'>> & AdsDailySyncFilters;
}): ProviderBuildResult => {
  const existingByKey = new Map(context.dailyAds.map((row) => [getDailyAdKey(row), row]));
  const activeAccounts = context.adAccounts.filter((account) => account.status === 'active');
  const inactiveAccounts = context.adAccounts.filter((account) => account.status !== 'active');
  let ignoredZeroActivityCount = 0;
  let ignoredInactiveAccountCount = 0;

  const rows = snapshotRows.flatMap<AdsDailySyncPreviewRow>((snapshot) => {
    const spend = Number(snapshot.spend) || 0;
    const leads = Math.round(Number(snapshot.conversions) || 0);
    if (spend <= 0 && leads <= 0) {
      ignoredZeroActivityCount += 1;
      return [];
    }

    const inactiveAccount = resolveAdAccountFromSnapshot(snapshot, inactiveAccounts, context.platforms, configs);
    if (inactiveAccount) {
      ignoredInactiveAccountCount += 1;
      return [];
    }

    const account = resolveAdAccountFromSnapshot(snapshot, activeAccounts, context.platforms, configs);
    if (!account) {
      return [{
        id: `${sourceLabel}:${snapshot.snapshotDate}:${snapshot.externalAccountId}`,
        date: snapshot.snapshotDate,
        platformId: snapshot.platformId || '',
        adAccountId: snapshot.internalAdAccountId || '',
        advertiserId: snapshot.advertiserId || '',
        amountSpent: spend,
        leadsDashboard: leads,
        ppnAmount: 0,
        feeAmount: 0,
        sourceLabel,
        accountName: snapshot.externalAccountName,
        advertiserName: 'Belum dipetakan',
        status: 'unmapped',
        reason: 'Akun live belum dipasangkan ke akun internal.',
      }];
    }

    if (filters.platformId && filters.platformId !== 'all' && account.platformId !== filters.platformId) return [];
    if (filters.adAccountId && filters.adAccountId !== 'all' && account.id !== filters.adAccountId) return [];

    const advertiserId = resolveOwnerForDate(
      context.adAccountOwnerAssignments,
      account.id,
      snapshot.snapshotDate,
      account.advertiserId,
    );
    const assignment = resolveAssignmentForDate(
      context.adAccountAssignments,
      account.id,
      snapshot.snapshotDate,
    );

    if (filters.advertiserId && filters.advertiserId !== 'all' && advertiserId !== filters.advertiserId) return [];
    if (filters.csId && filters.csId !== 'all' && assignment?.csId !== filters.csId) return [];

    const existing = existingByKey.get(getDailyAdKey({ date: snapshot.snapshotDate, adAccountId: account.id }));
    const ppnAmount = Math.round(spend * ((account.ppn || 0) / 100));
    const feeAmount = Math.round(spend * ((account.fee || 0) / 100));
    let status: AdsDailySyncPreviewRow['status'] = existing ? 'skip' : 'new';
    let reason = existing ? 'Sudah ada di laporan harian.' : 'Siap ditambahkan.';

    if (existing && filters.mode === 'update-existing') {
      if (filters.preserveEdited && (existing.editCount || 0) > 0) {
        status = 'skip';
        reason = 'Data pernah dikoreksi manual, tidak ditimpa.';
      } else {
        status = 'update';
        reason = 'Akan update data operasional dari snapshot API.';
      }
    }

    return [{
      id: `${sourceLabel}:${snapshot.snapshotDate}:${snapshot.externalAccountId}`,
      date: snapshot.snapshotDate,
      platformId: account.platformId,
      adAccountId: account.id,
      advertiserId,
      csId: assignment?.csId || undefined,
      subChannelId: assignment?.subChannelId || undefined,
      amountSpent: spend,
      leadsDashboard: leads,
      ppnAmount,
      feeAmount,
      sourceLabel,
      accountName: account.accountName,
      advertiserName: getUserName(context.users, advertiserId),
      status,
      reason,
      existing,
    }];
  });

  return { rows, ignoredZeroActivityCount, ignoredInactiveAccountCount };
};

export const reconcileAdsDailySyncPreviewRows = (
  rows: AdsDailySyncPreviewRow[],
  context: AdsDailySyncContext,
  filters: AdsDailySyncFilters,
) => {
  const mergedFilters = { ...defaultFilters, ...filters };
  const existingByKey = new Map(context.dailyAds.map((row) => [getDailyAdKey(row), row]));

  return rows.map((row) => {
    if (row.status === 'unmapped') return row;
    const existing = existingByKey.get(getDailyAdKey(row));

    if (mergedFilters.advertiserId && mergedFilters.advertiserId !== 'all' && row.advertiserId !== mergedFilters.advertiserId) {
      return { ...row, existing, status: 'skip' as const, reason: 'Di luar filter advertiser.' };
    }

    if (mergedFilters.csId && mergedFilters.csId !== 'all' && row.csId !== mergedFilters.csId) {
      return { ...row, existing, status: 'skip' as const, reason: 'Di luar filter CS.' };
    }

    if (mergedFilters.adAccountId && mergedFilters.adAccountId !== 'all' && row.adAccountId !== mergedFilters.adAccountId) {
      return { ...row, existing, status: 'skip' as const, reason: 'Di luar filter akun iklan.' };
    }

    if (!existing) {
      return { ...row, existing: undefined, status: 'new' as const, reason: 'Siap ditambahkan.' };
    }

    if (mergedFilters.mode === 'update-existing') {
      if (mergedFilters.preserveEdited && (existing.editCount || 0) > 0) {
        return { ...row, existing, status: 'skip' as const, reason: 'Data pernah dikoreksi manual, tidak ditimpa.' };
      }
      return { ...row, existing, status: 'update' as const, reason: 'Akan update data operasional dari snapshot API.' };
    }

    return { ...row, existing, status: 'skip' as const, reason: 'Sudah ada di laporan harian.' };
  });
};

export async function buildAdsDailySyncPreview({
  range,
  context,
  filters = {},
  onProviderStatus,
}: {
  range: { from: string; to: string };
  context: AdsDailySyncContext;
  filters?: AdsDailySyncFilters;
  onProviderStatus?: (statuses: AdsDailySyncProviderStatus[]) => void;
}): Promise<AdsDailySyncPreviewResult> {
  const mergedFilters = { ...defaultFilters, ...filters };
  const configs = await loadAdsDailySyncIntegrationConfigs();
  const platformNameById = new Map(context.platforms.map((platform) => [platform.id, platform.name]));
  const selectedProviderKey =
    mergedFilters.platformId && mergedFilters.platformId !== 'all'
      ? getAdsProviderKeyByPlatformName(platformNameById.get(mergedFilters.platformId))
      : null;
  const shouldLoadProvider = (provider: AdsProviderKey) =>
    !mergedFilters.platformId || mergedFilters.platformId === 'all' || selectedProviderKey === provider;
  const getEnabledConfigCount = (provider: AdsProviderKey) => {
    if (provider === 'meta') {
      return configs.meta.filter((config) => config.enabled && config.liveMetaAccountId).length +
        configs.mappings.filter((mapping) => mapping.status === 'active' && mapping.platformKey === 'meta').length;
    }
    if (provider === 'google') {
      return configs.google.filter((config) => config.enabled && config.liveGoogleCustomerId).length +
        configs.mappings.filter((mapping) => mapping.status === 'active' && mapping.platformKey === 'google').length;
    }
    return configs.tiktok.filter((config) => config.enabled && config.liveTikTokAdvertiserId).length +
      configs.mappings.filter((mapping) => mapping.status === 'active' && mapping.platformKey === 'tiktok').length;
  };

  const tasks: Array<{
    key: AdsProviderKey;
    label: string;
    enabledConfigCount: number;
    request: Promise<ProviderBuildResult>;
  }> = [];

  if (shouldLoadProvider('meta')) {
    tasks.push({
      key: 'meta',
      label: providerLabels.meta,
      enabledConfigCount: getEnabledConfigCount('meta'),
      request: syncMetaSnapshotDataset({
        from: range.from,
        to: range.to,
        force: true,
        minFreshMinutes: 0,
        mappedOnly: mergedFilters.mappedOnly,
      }).then((payload) => buildPreviewRowsForProvider({
        snapshotRows: payload.rows || [],
        sourceLabel: providerLabels.meta,
        context,
        configs,
        filters: mergedFilters,
      })),
    });
  }

  if (shouldLoadProvider('google')) {
    tasks.push({
      key: 'google',
      label: providerLabels.google,
      enabledConfigCount: getEnabledConfigCount('google'),
      request: syncGoogleAdsSnapshotDataset({
        from: range.from,
        to: range.to,
        force: true,
        minFreshMinutes: 0,
      }).then((payload) => buildPreviewRowsForProvider({
        snapshotRows: payload.rows || [],
        sourceLabel: providerLabels.google,
        context,
        configs,
        filters: mergedFilters,
      })),
    });
  }

  if (shouldLoadProvider('tiktok')) {
    tasks.push({
      key: 'tiktok',
      label: providerLabels.tiktok,
      enabledConfigCount: getEnabledConfigCount('tiktok'),
      request: syncTikTokAdsSnapshotDataset({
        from: range.from,
        to: range.to,
        force: true,
        minFreshMinutes: 0,
      }).then((payload) => buildPreviewRowsForProvider({
        snapshotRows: payload.rows || [],
        sourceLabel: providerLabels.tiktok,
        context,
        configs,
        filters: mergedFilters,
      })),
    });
  }

  if (tasks.length === 0) {
    return {
      rows: [],
      providerStatuses: [],
      errors: [],
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      unmappedCount: 0,
    };
  }

  const statuses: AdsDailySyncProviderStatus[] = tasks.map((task) => ({
    key: task.key,
    label: task.label,
    state: 'loading',
    count: 0,
    message: 'Mengambil snapshot provider...',
  }));
  onProviderStatus?.([...statuses]);

  const rows: AdsDailySyncPreviewRow[] = [];
  const errors: string[] = [];
  const setStatus = (nextStatus: AdsDailySyncProviderStatus) => {
    const index = statuses.findIndex((status) => status.key === nextStatus.key);
    if (index >= 0) statuses[index] = nextStatus;
    onProviderStatus?.([...statuses]);
  };

  await Promise.allSettled(tasks.map(async (task) => {
    try {
      const buildResult = await task.request;
      rows.push(...buildResult.rows);
      const ignoredMessage = buildResult.ignoredZeroActivityCount > 0
        ? ` ${buildResult.ignoredZeroActivityCount} snapshot kosong dilewati.`
        : '';
      const inactiveMessage = buildResult.ignoredInactiveAccountCount > 0
        ? ` ${buildResult.ignoredInactiveAccountCount} akun OFF dilewati.`
        : '';

      setStatus({
        key: task.key,
        label: task.label,
        state: buildResult.rows.length > 0 ? 'success' : 'empty',
        count: buildResult.rows.length,
        message: buildResult.rows.length > 0
          ? `${buildResult.rows.length} snapshot terbaca.${ignoredMessage}${inactiveMessage}`
          : `${getEmptyMessage(task.key, task.enabledConfigCount)}${ignoredMessage}${inactiveMessage}`,
      });
    } catch (reason) {
      const message = getErrorMessage(task.key, reason);
      errors.push(`${task.label}: ${message}`);
      setStatus({
        key: task.key,
        label: task.label,
        state: 'error',
        count: 0,
        message,
      });
    }
  }));

  const sortedRows = reconcileAdsDailySyncPreviewRows(
    rows.sort((left, right) => left.date.localeCompare(right.date) || left.accountName.localeCompare(right.accountName)),
    context,
    mergedFilters,
  );

  return {
    rows: sortedRows,
    providerStatuses: [...statuses],
    errors,
    insertedCount: sortedRows.filter((row) => row.status === 'new').length,
    updatedCount: sortedRows.filter((row) => row.status === 'update').length,
    skippedCount: sortedRows.filter((row) => row.status === 'skip').length,
    unmappedCount: sortedRows.filter((row) => row.status === 'unmapped').length,
  };
}

const mapPreviewRowToDailyAdPayload = (row: AdsDailySyncPreviewRow) => ({
  id: row.existing?.id || crypto.randomUUID(),
  date: row.date,
  advertiser_id: row.advertiserId,
  platform_id: row.platformId,
  sub_channel_id: row.subChannelId || null,
  ad_account_id: row.adAccountId,
  cs_id: row.csId || null,
  amount_spent: row.amountSpent,
  leads_dashboard: row.leadsDashboard,
  ppn_amount: row.ppnAmount,
  fee_amount: row.feeAmount,
  edit_count: row.existing?.editCount || 0,
});

export async function commitAdsDailySyncPreview(rows: AdsDailySyncPreviewRow[]): Promise<AdsDailySyncCommitResult> {
  const actionableRows = rows.filter((row) => row.status === 'new' || row.status === 'update');
  let inserted = 0;
  let updated = 0;

  for (const row of actionableRows) {
    const payload = mapPreviewRowToDailyAdPayload(row);

    if (row.status === 'update' && row.existing?.id) {
      const { error } = await supabase
        .from('daily_ads')
        .update(payload)
        .eq('id', row.existing.id);
      if (error) throw new Error(error.message);
      updated += 1;
    } else {
      const { error } = await supabase
        .from('daily_ads')
        .insert(payload);
      if (error) throw new Error(error.message);
      inserted += 1;
    }
  }

  return { inserted, updated };
}
