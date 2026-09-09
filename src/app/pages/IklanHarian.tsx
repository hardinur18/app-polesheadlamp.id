import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Edit, Trash2, Download, TrendingUp, Users, ShoppingCart, DollarSign,
  Calendar as CalendarIcon, Filter, Search, Loader2, ArrowUpDown, Upload, FileSpreadsheet, AlertTriangle, RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '../components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter
} from '../components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../components/ui/select';
import { Label } from '../components/ui/label';
import {
  OperationalEmptyState,
  OperationalFilterPanel,
  OperationalKpiCard,
  OperationalKpiGrid,
  OperationalPageHeader,
  OperationalPageShell,
  OperationalTableCard,
  RequiredLabel,
} from '../components/ui/operational-page';
import { useMasterData } from '@/app/pages/master-data/context';
import { usePermissions } from '@/app/hooks/usePermissions';
import { logActivity } from '@/app/services/auditService';
import {
  isAdminManagementRole,
  isAdvertiserRole,
  isCsRole,
} from '@/app/data/roleHelpers';
import { DailyAd, Platform, AdAccount } from '@/app/pages/master-data/data';
import { toast } from 'sonner';
import { FoundationDateRangePicker } from '../components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { isWithinInterval, startOfDay, endOfDay, format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
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
  getScopedAdAccountAttributionsForDate,
  resolveAdAccountAttribution,
  type ResolvedAdAccountAttribution,
} from '@/app/pages/ads/adAccountAttribution';

const loadSpreadsheet = () => import('xlsx');

// Helper for formatting currency input (1.000.000)
const formatNumber = (value: string | number) => {
    if (!value) return '';
    return new Intl.NumberFormat('id-ID').format(Number(value));
};

const parseNumber = (value: string) => {
    return value.replace(/\./g, '').replace(/,/g, '');
};

const INITIAL_AD_ROW_LIMIT = 80;

const normalizeAdAccountLookupKey = (value: unknown) =>
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

const normalizeFlexibleAdAccountLookupKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^act_/, '')
    .replace(/[^a-z0-9]+/g, '');

const getTrailingNumberKey = (value: unknown) =>
  String(value || '').match(/(\d+)\s*$/)?.[1] || '';

type AdsProviderKey = 'meta' | 'google' | 'tiktok';

type ApiRecapProviderStatus = {
  key: AdsProviderKey;
  label: string;
  state: 'success' | 'empty' | 'error';
  count: number;
  message: string;
};

const adsProviderLabels: Record<AdsProviderKey, string> = {
  meta: 'Meta',
  google: 'Google Ads',
  tiktok: 'TikTok Ads',
};

const normalizeAdsProviderName = (value: unknown) =>
  String(value || '').toLowerCase().replace(/\s+/g, '');

const getAdsProviderKeyByPlatformName = (name: unknown): AdsProviderKey | null => {
  const normalized = normalizeAdsProviderName(name);
  if (normalized.includes('google')) return 'google';
  if (normalized.includes('tiktok')) return 'tiktok';
  if (normalized.includes('meta') || normalized.includes('facebook') || normalized.includes('instagram')) return 'meta';
  return null;
};

const getApiRecapErrorMessage = (provider: AdsProviderKey, reason: unknown) => {
  const rawMessage = reason instanceof Error ? reason.message : String(reason || 'Sinkronisasi API gagal.');
  if (provider === 'google' && /invalid_grant/i.test(rawMessage)) {
    return 'Token OAuth Google Ads ditolak. Reconnect Google Ads di Master Data Akun Iklan.';
  }
  return rawMessage;
};

const getEmptyApiRecapMessage = (provider: AdsProviderKey, enabledConfigCount: number) => {
  if (enabledConfigCount === 0) {
    return `Belum ada akun ${adsProviderLabels[provider]} aktif yang dipetakan ke Master Data Akun Iklan.`;
  }
  return `${enabledConfigCount} akun terpetakan, tetapi tidak ada snapshot pada periode/filter ini.`;
};

const buildFlexibleAdAccountLookupKeys = (value: unknown) => {
  const rawValue = String(value || '');
  const keys = new Set<string>();
  const add = (candidate: string) => {
    const key = normalizeFlexibleAdAccountLookupKey(candidate);
    if (key) keys.add(key);
  };

  add(rawValue);
  add(rawValue.replace(/\b(akun|account|ads?|iklan|meta|facebook|fb|tiktok|tik\s*tok|snack\s*video|google)\b/gi, ' '));
  add(rawValue.replace(/\b(cv|pt)\b/gi, ' '));
  add(rawValue.replace(/\s+\d+\s*$/g, ' '));
  add(
    rawValue
      .replace(/\b(cv|pt)\b/gi, ' ')
      .replace(/\s+\d+\s*$/g, ' '),
  );

  return [...keys];
};

type ApiRecapMode = 'insert-missing' | 'update-existing';

type ApiRecapPreviewRow = {
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

type DailyAdFormData = {
    date: string;
    advertiserId: string;
    platformId: string;
    subChannelId: string;
    adAccountId: string;
    csId: string;
    amountSpent: string;
    leadsDashboard: string;
    editCount: number;
};

type StagedDailyAdRow = {
    id: string;
    date: string;
    advertiserId: string;
    platformId: string;
    subChannelId: string;
    adAccountId: string;
    csId: string;
    amountSpent: string | number;
    leadsDashboard: string | number;
    _rawAccount?: string;
};

const normalizeMetricPart = (value: unknown) => {
    if (value === undefined || value === null) return 'empty';
    const normalized = String(value).trim();
    return normalized === '' ? 'empty' : normalized;
};

const formatMetricDate = (value: unknown) => {
    if (!value) return '';

    try {
        return format(new Date(String(value)), 'yyyy-MM-dd');
    } catch {
        return '';
    }
};

const buildAdMetricKey = (
    date: string,
    advertiserId?: string,
    platformId?: string,
    subChannelId?: string,
    csId?: string,
) => [
    date,
    normalizeMetricPart(advertiserId),
    normalizeMetricPart(platformId),
    normalizeMetricPart(subChannelId),
    normalizeMetricPart(csId),
].join('|');

const buildAdMetricFallbackKey = (
    date: string,
    advertiserId?: string,
    platformId?: string,
    csId?: string,
) => buildAdMetricKey(date, advertiserId, platformId, undefined, csId);

export function IklanHarian() {
  const { 
    dailyAds, platforms, subChannels, adAccounts, adAccountAssignments, adAccountOwnerAssignments, users, currentUser, currentRole,
    addDailyAd, updateDailyAd, deleteDailyAd, leads, orders,
  } = useMasterData();
  const { hasPermission } = usePermissions();
  const isAdminManagementUser = isAdminManagementRole(currentRole);
  const isAdvertiserUser = isAdvertiserRole(currentRole);
  const isCsUser = isCsRole(currentRole);

  // Mobile Check
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
      const checkMobile = () => setIsMobile(window.innerWidth < 768);
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isApiRecapOpen, setIsApiRecapOpen] = useState(false);
  const [apiRecapMode, setApiRecapMode] = useState<ApiRecapMode>('insert-missing');
  const [apiRecapPreserveEdited, setApiRecapPreserveEdited] = useState(true);
  const [apiRecapFromDate, setApiRecapFromDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [apiRecapToDate, setApiRecapToDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [apiRecapPlatformId, setApiRecapPlatformId] = useState('all');
  const [apiRecapAdvertiserId, setApiRecapAdvertiserId] = useState('all');
  const [apiRecapCsId, setApiRecapCsId] = useState('all');
  const [apiRecapRows, setApiRecapRows] = useState<ApiRecapPreviewRow[]>([]);
  const [apiRecapErrors, setApiRecapErrors] = useState<string[]>([]);
  const [apiRecapProviderStatuses, setApiRecapProviderStatuses] = useState<ApiRecapProviderStatus[]>([]);
  const [isApiRecapLoading, setIsApiRecapLoading] = useState(false);
  const [isApiRecapSaving, setIsApiRecapSaving] = useState(false);
  const apiRecapIntegrationConfigsRef = useRef<{
    meta: AdsIntegrationConfig[];
    google: GoogleAdsIntegrationConfig[];
    tiktok: TikTokAdsIntegrationConfig[];
  }>({ meta: [], google: [], tiktok: [] });
  const [importStep, setImportStep] = useState<'upload' | 'review'>('upload');
  
  const [confirmDialog, setConfirmDialog] = useState<{
      isOpen: boolean;
      title: string;
      description: string;
      confirmLabel?: string;
      variant?: 'destructive' | 'default';
      onConfirm: () => void;
  }>({
      isOpen: false,
      title: '',
      description: '',
      onConfirm: () => {}
  });
  const [stagedData, setStagedData] = useState<StagedDailyAdRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Form State
  const [formData, setFormData] = useState<DailyAdFormData>({
    date: new Date().toISOString().split('T')[0],
    advertiserId: '',
    platformId: '',
    subChannelId: '',
    adAccountId: '',
    csId: '',
    amountSpent: '',
    leadsDashboard: '',
    editCount: 0
  });

  // Filters State
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(), // Default Today
    to: new Date()
  });
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [subChannelFilter, setSubChannelFilter] = useState<string>('all');
  const [advertiserFilter, setAdvertiserFilter] = useState<string>('all'); // Added Advertiser Filter
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [csFilter, setCsFilter] = useState<string>('all');
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [visibleRowLimit, setVisibleRowLimit] = useState(INITIAL_AD_ROW_LIMIT);

  const lookupMaps = useMemo(() => ({
      platformNameById: new Map(platforms.map(platform => [platform.id, platform.name])),
      subChannelNameById: new Map(subChannels.map(subChannel => [subChannel.id, subChannel.name])),
      accountNameById: new Map(adAccounts.map(account => [account.id, account.accountName])),
      userNameById: new Map(users.map(user => [user.id, user.name])),
  }), [adAccounts, platforms, subChannels, users]);

  const resolveAccountAttribution = useCallback((
    adAccountId: string,
    date: string,
    preferredCsId?: string,
  ): ResolvedAdAccountAttribution | null => {
    const account = adAccounts.find((item) => item.id === adAccountId);
    if (!account || !date) return null;

    return resolveAdAccountAttribution({
      account,
      date,
      ownerAssignments: adAccountOwnerAssignments,
      csAssignments: adAccountAssignments,
      preferredCsId,
      fallbackToLatestCsAssignment: true,
    });
  }, [adAccountAssignments, adAccountOwnerAssignments, adAccounts]);

  const resolveDailyAdAttribution = useCallback((item: DailyAd) => {
    const resolved = resolveAccountAttribution(item.adAccountId, item.date, item.csId);
    return {
      advertiserId: resolved?.advertiserId || item.advertiserId,
      platformId: resolved?.platformId || item.platformId,
      subChannelId: resolved?.subChannelId || item.subChannelId,
      csId: resolved?.csId || item.csId,
    };
  }, [resolveAccountAttribution]);

  const resolveOwnerForDate = useCallback((adAccountId: string, date: string, fallbackAdvertiserId: string) =>
    resolveAccountAttribution(adAccountId, date)?.advertiserId || fallbackAdvertiserId,
  [resolveAccountAttribution]);

  const resolveCsAssignmentForDate = useCallback((adAccountId: string, date: string) => {
    const resolved = resolveAccountAttribution(adAccountId, date);
    return resolved?.csId
      ? {
          adAccountId,
          csId: resolved.csId,
          subChannelId: resolved.subChannelId,
          startDate: date,
          status: 'active' as const,
        }
      : undefined;
  }, [resolveAccountAttribution]);

  const getScopedAdAccountOptionsForDate = useCallback((date: string) =>
    getScopedAdAccountAttributionsForDate({
      date,
      adAccounts,
      ownerAssignments: adAccountOwnerAssignments,
      csAssignments: adAccountAssignments,
      currentUserId: currentUser?.id,
      isAdminManagementUser,
      isAdvertiserUser,
      isCsUser,
      fallbackToLatestCsAssignment: true,
    }), [
      adAccountAssignments,
      adAccountOwnerAssignments,
      adAccounts,
      currentUser?.id,
      isAdminManagementUser,
      isAdvertiserUser,
      isCsUser,
    ]);

  const getAdAccountOptionsForDate = useCallback((date: string, selectedAccountId?: string) => {
    const options = getScopedAdAccountOptionsForDate(date);

    if (selectedAccountId && !options.some((option) => option.account.id === selectedAccountId)) {
      const selectedAccount = adAccounts.find((account) => account.id === selectedAccountId);
      if (selectedAccount) {
        options.push(
          resolveAdAccountAttribution({
            account: selectedAccount,
            date,
            ownerAssignments: adAccountOwnerAssignments,
            csAssignments: adAccountAssignments,
            preferredCsId: isCsUser ? currentUser?.id : undefined,
            fallbackToLatestCsAssignment: true,
          }),
        );
      }
    }

    return options.sort((left, right) => left.account.accountName.localeCompare(right.account.accountName));
  }, [
    adAccountAssignments,
    adAccountOwnerAssignments,
    adAccounts,
    currentUser?.id,
    getScopedAdAccountOptionsForDate,
    isCsUser,
  ]);

  const formAdAccountOptions = useMemo(
    () => getAdAccountOptionsForDate(formData.date, formData.adAccountId),
    [
      getAdAccountOptionsForDate,
      formData.adAccountId,
      formData.date,
    ],
  );

  const selectedFormAttribution = useMemo(
    () => (formData.adAccountId ? resolveAccountAttribution(formData.adAccountId, formData.date, formData.csId) : null),
    [
      formData.adAccountId,
      formData.csId,
      formData.date,
      resolveAccountAttribution,
    ],
  );
  const editingLegacyAdvertiserId = useMemo(() => {
    if (!editingId || !formData.advertiserId) return '';
    const originalRow = dailyAds.find((item) => item.id === editingId);
    if (!originalRow?.advertiserId || originalRow.advertiserId === formData.advertiserId) return '';
    return originalRow.advertiserId;
  }, [dailyAds, editingId, formData.advertiserId]);

  const isAdAccountAllowedForDate = useCallback((adAccountId: string, date: string) =>
    getScopedAdAccountOptionsForDate(date).some((option) => option.account.id === adAccountId),
  [getScopedAdAccountOptionsForDate]);

  const hydrateAdFormData = useCallback((draft: DailyAdFormData): DailyAdFormData => {
    const resolved = draft.adAccountId
      ? resolveAccountAttribution(draft.adAccountId, draft.date, isCsUser ? currentUser?.id : draft.csId)
      : null;

    return {
      ...draft,
      advertiserId: resolved?.advertiserId || '',
      platformId: resolved?.platformId || '',
      subChannelId: resolved?.subChannelId || '',
      csId: resolved?.csId || '',
    };
  }, [currentUser?.id, isCsUser, resolveAccountAttribution]);

  const hydrateStagedAdRow = useCallback((row: StagedDailyAdRow): StagedDailyAdRow => {
    const resolved = row.adAccountId
      ? resolveAccountAttribution(row.adAccountId, row.date, isCsUser ? currentUser?.id : row.csId)
      : null;

    return {
      ...row,
      advertiserId: resolved?.advertiserId || '',
      platformId: resolved?.platformId || '',
      subChannelId: resolved?.subChannelId || '',
      csId: resolved?.csId || '',
    };
  }, [currentUser?.id, isCsUser, resolveAccountAttribution]);

  const activeDateBounds = useMemo(() => {
      if (!dateRange?.from) return null;

      return {
          start: startOfDay(dateRange.from),
          end: dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from),
      };
  }, [dateRange]);

  // MAIN DATA PROCESSING
  // 1. Filter raw daily ads first so opening the page only enriches the active period.
  const baseDailyAds = useMemo(() => {
      let data = dailyAds;
      
      // Date Filter
      if (activeDateBounds) {
        data = data.filter(item => {
          const itemDate = new Date(item.date);
          return isWithinInterval(itemDate, activeDateBounds);
        });
      }

      // Role Filter (Always apply this base security filter)
      if (isAdvertiserUser && currentUser) {
        data = data.filter(d => resolveDailyAdAttribution(d).advertiserId === currentUser.id);
      }

      if (isCsUser && currentUser) {
        data = data.filter(d => resolveDailyAdAttribution(d).csId === currentUser.id);
      }

      return data;
  }, [activeDateBounds, currentUser, dailyAds, isAdvertiserUser, isCsUser, resolveDailyAdAttribution]);

  // 1.5 Index lead/order metrics once, then every daily ad row becomes O(1) lookup.
  const adMetricIndexes = useMemo(() => {
      const realLeadsByKey = new Map<string, number>();
      const realOrdersByKey = new Map<string, number>();
      const realOrdersDoneByKey = new Map<string, number>();

      const increment = (map: Map<string, number>, key: string) => {
          map.set(key, (map.get(key) || 0) + 1);
      };

      leads.forEach((lead) => {
          const leadDate = formatMetricDate((lead as any).timestamp);
          if (!leadDate) return;
          if (activeDateBounds && !isWithinInterval(new Date(leadDate), activeDateBounds)) return;

          const exactKey = buildAdMetricKey(
              leadDate,
              (lead as any).advertiserId,
              (lead as any).platformId,
              (lead as any).subChannelId,
              (lead as any).csId,
          );
          const fallbackKey = buildAdMetricFallbackKey(
              leadDate,
              (lead as any).advertiserId,
              (lead as any).platformId,
              (lead as any).csId,
          );

          increment(realLeadsByKey, exactKey);
          if (fallbackKey !== exactKey) increment(realLeadsByKey, fallbackKey);
      });

      orders.forEach((order) => {
          const orderLeadDate = formatMetricDate((order as any).leadDate);
          if (!orderLeadDate) return;
          if (activeDateBounds && !isWithinInterval(new Date(orderLeadDate), activeDateBounds)) return;

          const key = buildAdMetricKey(
              orderLeadDate,
              (order as any).advertiserId,
              (order as any).platformId,
              (order as any).subChannelId,
              (order as any).csId,
          );
          const fallbackKey = buildAdMetricFallbackKey(
              orderLeadDate,
              (order as any).advertiserId,
              (order as any).platformId,
              (order as any).csId,
          );

          increment(realOrdersByKey, key);
          if (fallbackKey !== key) increment(realOrdersByKey, fallbackKey);
          if ((order as any).status === 'done') {
              increment(realOrdersDoneByKey, key);
              if (fallbackKey !== key) increment(realOrdersDoneByKey, fallbackKey);
          }
      });

      return { realLeadsByKey, realOrdersByKey, realOrdersDoneByKey };
  }, [activeDateBounds, leads, orders]);

  // 2. Enrich visible-period rows with real metrics.
  const dateFilteredData = useMemo(() => {
      return baseDailyAds.map(item => {
          const attribution = resolveDailyAdAttribution(item);
          const legacyAdvertiserId =
            item.advertiserId && item.advertiserId !== attribution.advertiserId
              ? item.advertiserId
              : undefined;
          const normalizedItem = {
              ...item,
              advertiserId: attribution.advertiserId,
              platformId: attribution.platformId,
              subChannelId: attribution.subChannelId,
              csId: attribution.csId,
              legacyAdvertiserId,
          };
          const key = buildAdMetricKey(
              normalizedItem.date,
              normalizedItem.advertiserId,
              normalizedItem.platformId,
              normalizedItem.subChannelId,
              normalizedItem.csId,
          );
          const fallbackKey = buildAdMetricFallbackKey(
              normalizedItem.date,
              normalizedItem.advertiserId,
              normalizedItem.platformId,
              normalizedItem.csId,
          );

          return {
              ...normalizedItem,
              realLeads: adMetricIndexes.realLeadsByKey.get(key) || adMetricIndexes.realLeadsByKey.get(fallbackKey) || 0,
              realOrders: adMetricIndexes.realOrdersByKey.get(key) || adMetricIndexes.realOrdersByKey.get(fallbackKey) || 0,
              realOrdersDone: adMetricIndexes.realOrdersDoneByKey.get(key) || adMetricIndexes.realOrdersDoneByKey.get(fallbackKey) || 0,
          };
      });
  }, [adMetricIndexes, baseDailyAds, resolveDailyAdAttribution]);

  // 3. Filter Enriched Data (Final Table Data)
  const filteredData = useMemo(() => {
    let data = dateFilteredData;

    // Dropdown Filters
    if (advertiserFilter !== 'all') {
      data = data.filter(item => item.advertiserId === advertiserFilter || item.legacyAdvertiserId === advertiserFilter);
    }
    if (platformFilter !== 'all') data = data.filter(item => item.platformId === platformFilter);
    if (subChannelFilter !== 'all') data = data.filter(item => item.subChannelId === subChannelFilter);
    if (accountFilter !== 'all') data = data.filter(item => item.adAccountId === accountFilter);
    if (csFilter !== 'all') data = data.filter(item => item.csId === csFilter);

    // Search
    if (search) {
        const lower = search.toLowerCase();
        data = data.filter(d => 
          d.date.includes(lower) ||
          lookupMaps.userNameById.get(d.advertiserId)?.toLowerCase().includes(lower) ||
          lookupMaps.userNameById.get(d.legacyAdvertiserId || '')?.toLowerCase().includes(lower) ||
          lookupMaps.accountNameById.get(d.adAccountId)?.toLowerCase().includes(lower)
        );
    }

    // Sorting
    if (sortConfig) {
      data = [...data].sort((a, b) => { // Create a copy to avoid mutating strict mode props
        let valA: any = a[sortConfig.key as keyof typeof a];
        let valB: any = b[sortConfig.key as keyof typeof b];

        // Custom Keys Handling
        if (sortConfig.key === 'spending') {
             valA = Number(a.amountSpent);
             valB = Number(b.amountSpent);
        } else if (sortConfig.key === 'leads_real') {
             valA = a.realLeads;
             valB = b.realLeads;
        } else if (sortConfig.key === 'orders_done') {
             valA = a.realOrdersDone;
             valB = b.realOrdersDone;
        } else if (sortConfig.key === 'cpl_real') {
             valA = a.realLeads > 0 ? Number(a.amountSpent) / a.realLeads : (sortConfig.direction === 'asc' ? 999999999 : 0);
             valB = b.realLeads > 0 ? Number(b.amountSpent) / b.realLeads : (sortConfig.direction === 'asc' ? 999999999 : 0);
        } else if (sortConfig.key === 'cpr_done') {
             valA = a.realOrdersDone > 0 ? Number(a.amountSpent) / a.realOrdersDone : (sortConfig.direction === 'asc' ? 999999999 : 0);
             valB = b.realOrdersDone > 0 ? Number(b.amountSpent) / b.realOrdersDone : (sortConfig.direction === 'asc' ? 999999999 : 0);
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
        data = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return data;
  }, [accountFilter, advertiserFilter, csFilter, dateFilteredData, lookupMaps, platformFilter, search, sortConfig, subChannelFilter]);

  useEffect(() => {
      setVisibleRowLimit(INITIAL_AD_ROW_LIMIT);
  }, [accountFilter, advertiserFilter, csFilter, dateRange, platformFilter, search, sortConfig, subChannelFilter]);

  const visibleFilteredData = useMemo(
      () => filteredData.slice(0, visibleRowLimit),
      [filteredData, visibleRowLimit],
  );

  // 2.5 Dynamic Filter Options (Based on dateFilteredData)
  const optAdvertisers = useMemo(() => {
    const ids = new Set(
      dateFilteredData
        .flatMap(d => [d.advertiserId, d.legacyAdvertiserId])
        .filter(Boolean) as string[],
    );
    return users.filter(u => ids.has(u.id));
  }, [dateFilteredData, users]);

  const optPlatforms = useMemo(() => {
      const ids = new Set(dateFilteredData.map(d => d.platformId));
      // Return platforms that exist in the data, preserving master data info
      return platforms.filter(p => ids.has(p.id));
  }, [dateFilteredData, platforms]);

  const optSubChannels = useMemo(() => {
      let data = dateFilteredData;
      // If platform is selected, narrow down subchannels
      if (platformFilter !== 'all') {
          data = data.filter(d => d.platformId === platformFilter);
      }
      const ids = new Set(data.map(d => d.subChannelId).filter(Boolean) as string[]);
      return subChannels.filter(s => ids.has(s.id));
  }, [dateFilteredData, platformFilter, subChannels]);

  const optAccounts = useMemo(() => {
      let data = dateFilteredData;
      // If platform is selected, narrow down accounts
      if (platformFilter !== 'all') {
          data = data.filter(d => d.platformId === platformFilter);
      }
      const ids = new Set(data.map(d => d.adAccountId));
      return adAccounts.filter(a => ids.has(a.id));
  }, [dateFilteredData, platformFilter, adAccounts]);

  const optCs = useMemo(() => {
      // CS usually works across platforms, but we show only CSs active in this period
      const ids = new Set(dateFilteredData.map(d => d.csId).filter(Boolean) as string[]);
      return users.filter(u => ids.has(u.id));
  }, [dateFilteredData, users]);

  // 3. Calculate Totals
  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => {
        const spend = Number(curr.amountSpent) || 0;
        const ppn = curr.ppnAmount || 0;
        const fee = curr.feeAmount || 0;
        return {
            spend: acc.spend + spend,
            burn: acc.burn + (spend + ppn + fee),
            leadsDash: acc.leadsDash + (Number(curr.leadsDashboard) || 0),
            leadsReal: acc.leadsReal + curr.realLeads,
            orders: acc.orders + curr.realOrders,
            ordersDone: acc.ordersDone + curr.realOrdersDone
        };
    }, { spend: 0, burn: 0, leadsDash: 0, leadsReal: 0, orders: 0, ordersDone: 0 });
  }, [filteredData]);

  // Global Averages for Cards/Footer
  const avgCplAds = totals.leadsDash > 0 ? totals.spend / totals.leadsDash : 0;
  const avgCplReal = totals.leadsReal > 0 ? totals.spend / totals.leadsReal : 0; // Cost / Real Leads
  const avgCpr = totals.orders > 0 ? totals.spend / totals.orders : 0;
  const avgCprDone = totals.ordersDone > 0 ? totals.spend / totals.ordersDone : 0; // Cost / Done Orders
  const canDeleteAdItem = isAdminManagementUser;
  const canManageAdItem = (item?: DailyAd) =>
    hasPermission('ads.manage') ||
    (isAdvertiserUser && item && resolveDailyAdAttribution(item).advertiserId === currentUser?.id);
  const activeFilterCount = useMemo(
    () =>
      [
        isAdminManagementUser && advertiserFilter !== 'all',
        platformFilter !== 'all',
        subChannelFilter !== 'all',
        accountFilter !== 'all',
        csFilter !== 'all',
      ].filter(Boolean).length,
    [accountFilter, advertiserFilter, csFilter, isAdminManagementUser, platformFilter, subChannelFilter],
  );
  const hasActiveFilters = activeFilterCount > 0;
  const resetAdvancedFilters = useCallback(() => {
    setAdvertiserFilter('all');
    setPlatformFilter('all');
    setSubChannelFilter('all');
    setAccountFilter('all');
    setCsFilter('all');
  }, []);

  const selectedRecapRange = useMemo(() => {
    return {
      from: apiRecapFromDate,
      to: apiRecapToDate || apiRecapFromDate,
    };
  }, [apiRecapFromDate, apiRecapToDate]);

  const advertiserFilterOptions = useMemo(() => {
    const advertiserMap = new Map<string, string>();
    users
      .filter((user) => isAdvertiserRole(user.role))
      .forEach((user) => advertiserMap.set(user.id, user.name));

    adAccounts.forEach((account) => {
      const name = lookupMaps.userNameById.get(account.advertiserId);
      if (name) advertiserMap.set(account.advertiserId, name);
    });

    adAccountOwnerAssignments.forEach((assignment) => {
      const name = lookupMaps.userNameById.get(assignment.advertiserId);
      if (name) advertiserMap.set(assignment.advertiserId, name);
    });

    return Array.from(advertiserMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [adAccountOwnerAssignments, adAccounts, lookupMaps.userNameById, users]);

  const recapCsFilterOptions = useMemo(() => {
    const csMap = new Map<string, string>();
    const rangeFrom = selectedRecapRange.from;
    const rangeTo = selectedRecapRange.to;

    adAccountAssignments.forEach((assignment) => {
      if (assignment.status !== 'active') return;
      if (assignment.startDate > rangeTo) return;
      if (assignment.endDate && assignment.endDate < rangeFrom) return;

      const account = adAccounts.find((item) => item.id === assignment.adAccountId);
      if (!account) return;
      if (apiRecapPlatformId !== 'all' && account.platformId !== apiRecapPlatformId) return;

      if (apiRecapAdvertiserId !== 'all') {
        const hasMatchingOwner = account.advertiserId === apiRecapAdvertiserId || adAccountOwnerAssignments.some((owner) =>
          owner.adAccountId === account.id &&
          owner.advertiserId === apiRecapAdvertiserId &&
          owner.status === 'active' &&
          owner.startDate <= rangeTo &&
          (!owner.endDate || owner.endDate >= rangeFrom)
        );
        if (!hasMatchingOwner) return;
      }

      const name = lookupMaps.userNameById.get(assignment.csId);
      if (name) csMap.set(assignment.csId, name);
    });

    apiRecapRows.forEach((row) => {
      if (!row.csId) return;
      const name = lookupMaps.userNameById.get(row.csId);
      if (name) csMap.set(row.csId, name);
    });

    return Array.from(csMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [
    adAccountAssignments,
    adAccountOwnerAssignments,
    adAccounts,
    apiRecapAdvertiserId,
    apiRecapPlatformId,
    apiRecapRows,
    lookupMaps.userNameById,
    selectedRecapRange.from,
    selectedRecapRange.to,
  ]);

  const resetApiRecapPreview = () => {
    setApiRecapRows([]);
    setApiRecapErrors([]);
    setApiRecapProviderStatuses([]);
  };

  const loadApiRecapIntegrationConfigs = async () => {
    const [meta, google, tiktok] = await Promise.allSettled([
      fetchAdsIntegrationConfigs(),
      fetchGoogleAdsIntegrationConfigs(),
      fetchTikTokAdsIntegrationConfigs(),
    ]);

    const configs = {
      meta: meta.status === 'fulfilled' ? meta.value : apiRecapIntegrationConfigsRef.current.meta,
      google: google.status === 'fulfilled' ? google.value : apiRecapIntegrationConfigsRef.current.google,
      tiktok: tiktok.status === 'fulfilled' ? tiktok.value : apiRecapIntegrationConfigsRef.current.tiktok,
    };

    apiRecapIntegrationConfigsRef.current = configs;
    return configs;
  };

  const openApiRecapModal = () => {
    const fromDate = dateRange?.from || new Date();
    const toDate = dateRange?.to || dateRange?.from || new Date();
    setApiRecapFromDate(format(fromDate, 'yyyy-MM-dd'));
    setApiRecapToDate(format(toDate, 'yyyy-MM-dd'));
    setApiRecapPlatformId(platformFilter);
    setApiRecapAdvertiserId(advertiserFilter);
    setApiRecapCsId(csFilter);
    setApiRecapRows([]);
    setApiRecapErrors([]);
    setApiRecapProviderStatuses([]);
    setIsApiRecapOpen(true);
    void loadApiRecapIntegrationConfigs();
  };

  const buildExistingDailyAdKey = (row: Pick<DailyAd, 'date' | 'adAccountId'>) =>
    `${row.date}|${row.adAccountId}`;

  const findFallbackAdAccountForSnapshot = (
    snapshot: MetaSnapshotRow | GoogleAdsSnapshotRow | TikTokAdsSnapshotRow,
  ) => {
    if (snapshot.internalAdAccountId) {
      const account = adAccounts.find((item) => item.id === snapshot.internalAdAccountId);
      if (account) return account;
    }

    const platformKey = snapshot.platformKey;
    const configs = apiRecapIntegrationConfigsRef.current;
    const externalAccountId = normalizeExternalAccountId(snapshot.externalAccountId);
    const externalAccountName = normalizeAdAccountLookupKey(snapshot.externalAccountName);
    const externalAccountNameKeys = buildFlexibleAdAccountLookupKeys(snapshot.externalAccountName);
    const integrationConfig =
      platformKey === 'meta'
        ? configs.meta.find((config) =>
            config.enabled && (
              normalizeExternalAccountId(config.liveMetaAccountId) === externalAccountId ||
              normalizeAdAccountLookupKey(config.liveMetaAccountName) === externalAccountName ||
              buildFlexibleAdAccountLookupKeys(config.liveMetaAccountName).some((key) =>
                externalAccountNameKeys.includes(key),
              )
            )
          )
        : platformKey === 'google'
          ? configs.google.find((config) =>
              config.enabled && (
                normalizeExternalAccountId(config.liveGoogleCustomerId) === externalAccountId ||
                normalizeAdAccountLookupKey(config.liveGoogleCustomerName) === externalAccountName ||
                buildFlexibleAdAccountLookupKeys(config.liveGoogleCustomerName).some((key) =>
                  externalAccountNameKeys.includes(key),
                )
              )
            )
          : configs.tiktok.find((config) =>
              config.enabled && (
                normalizeExternalAccountId(config.liveTikTokAdvertiserId) === externalAccountId ||
                normalizeAdAccountLookupKey(config.liveTikTokAdvertiserName) === externalAccountName ||
                buildFlexibleAdAccountLookupKeys(config.liveTikTokAdvertiserName).some((key) =>
                  externalAccountNameKeys.includes(key),
                )
              )
            );

    if (integrationConfig?.adAccountId) {
      const account = adAccounts.find((item) => item.id === integrationConfig.adAccountId);
      if (account) return account;
    }

    const platformCandidates = platforms
      .filter((platform) => getAdsProviderKeyByPlatformName(platform.name) === platformKey)
      .map((platform) => platform.id);
    const accountNameKey = normalizeAdAccountLookupKey(snapshot.externalAccountName);
    const accountIdKey = normalizeAdAccountLookupKey(snapshot.externalAccountId);
    const snapshotFlexibleKeys = buildFlexibleAdAccountLookupKeys(snapshot.externalAccountName);
    const snapshotNumberKey = getTrailingNumberKey(snapshot.externalAccountName);
    const internalByUniqueNumber = new Map<string, AdAccount>();
    const duplicateNumberKeys = new Set<string>();

    for (const account of adAccounts.filter((account) => platformCandidates.includes(account.platformId))) {
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

    return adAccounts.find((account) => {
      if (!platformCandidates.includes(account.platformId)) return false;
      const internalNameKey = normalizeAdAccountLookupKey(account.accountName);
      const internalFlexibleKeys = buildFlexibleAdAccountLookupKeys(account.accountName);
      return (
        internalNameKey === accountNameKey ||
        internalNameKey === accountIdKey ||
        internalFlexibleKeys.some((key) => snapshotFlexibleKeys.includes(key))
      );
    }) || (snapshotNumberKey ? internalByUniqueNumber.get(snapshotNumberKey) : undefined);
  };

  const buildApiRecapRows = (
    snapshotRows: Array<MetaSnapshotRow | GoogleAdsSnapshotRow | TikTokAdsSnapshotRow>,
    sourceLabel: string,
  ) => {
    const existingByKey = new Map(dailyAds.map((row) => [buildExistingDailyAdKey(row), row]));

    return snapshotRows.map<ApiRecapPreviewRow>((snapshot) => {
      const account = findFallbackAdAccountForSnapshot(snapshot);

      if (!account) {
        return {
          id: `${sourceLabel}:${snapshot.snapshotDate}:${snapshot.externalAccountId}`,
          date: snapshot.snapshotDate,
          platformId: snapshot.platformId || '',
          adAccountId: snapshot.internalAdAccountId || '',
          advertiserId: snapshot.advertiserId || '',
          amountSpent: snapshot.spend || 0,
          leadsDashboard: Math.round(snapshot.conversions || 0),
          ppnAmount: 0,
          feeAmount: 0,
          sourceLabel,
          accountName: snapshot.externalAccountName,
          advertiserName: 'Belum dipetakan',
          status: 'unmapped',
          reason: 'Akun live belum dipasangkan ke akun internal.',
        };
      }

      const advertiserId = resolveOwnerForDate(account.id, snapshot.snapshotDate, account.advertiserId);
      const assignment = resolveCsAssignmentForDate(account.id, snapshot.snapshotDate);
      const spend = Number(snapshot.spend) || 0;
      const ppnAmount = Math.round(spend * ((account.ppn || 0) / 100));
      const feeAmount = Math.round(spend * ((account.fee || 0) / 100));
      const existing = existingByKey.get(buildExistingDailyAdKey({
        date: snapshot.snapshotDate,
        adAccountId: account.id,
      }));

      let status: ApiRecapPreviewRow['status'] = existing ? 'skip' : 'new';
      let reason = existing ? 'Sudah ada di laporan harian.' : 'Siap ditambahkan.';

      if (apiRecapAdvertiserId !== 'all' && advertiserId !== apiRecapAdvertiserId) {
        status = 'skip';
        reason = 'Di luar filter advertiser.';
      }

      if (apiRecapCsId !== 'all' && assignment?.csId !== apiRecapCsId) {
        status = 'skip';
        reason = 'Di luar filter CS.';
      }

      if (existing && apiRecapMode === 'update-existing') {
        if (apiRecapPreserveEdited && (existing.editCount || 0) > 0) {
          status = 'skip';
          reason = 'Data pernah dikoreksi, tidak ditimpa.';
        } else {
          status = 'update';
          reason = 'Akan update data yang sudah ada.';
        }
      }

      return {
        id: `${sourceLabel}:${snapshot.snapshotDate}:${snapshot.externalAccountId}`,
        date: snapshot.snapshotDate,
        platformId: account.platformId,
        adAccountId: account.id,
        advertiserId,
        csId: assignment?.csId || undefined,
        subChannelId: assignment?.subChannelId || undefined,
        amountSpent: spend,
        leadsDashboard: Math.round(snapshot.conversions || 0),
        ppnAmount,
        feeAmount,
        sourceLabel,
        accountName: account.accountName,
        advertiserName: getAdvertiserName(advertiserId),
        status,
        reason,
        existing,
      };
    });
  };

  useEffect(() => {
    setApiRecapRows((rows) => {
      if (rows.length === 0) return rows;
      const existingByKey = new Map(dailyAds.map((row) => [buildExistingDailyAdKey(row), row]));

      return rows.map((row) => {
        if (row.status === 'unmapped') return row;
        const existing = existingByKey.get(buildExistingDailyAdKey(row));

        if (apiRecapAdvertiserId !== 'all' && row.advertiserId !== apiRecapAdvertiserId) {
          return { ...row, existing, status: 'skip', reason: 'Di luar filter advertiser.' };
        }

        if (apiRecapCsId !== 'all' && row.csId !== apiRecapCsId) {
          return { ...row, existing, status: 'skip', reason: 'Di luar filter CS.' };
        }

        if (!existing) {
          return { ...row, existing: undefined, status: 'new', reason: 'Siap ditambahkan.' };
        }

        if (apiRecapMode === 'update-existing') {
          if (apiRecapPreserveEdited && (existing.editCount || 0) > 0) {
            return { ...row, existing, status: 'skip', reason: 'Data pernah dikoreksi, tidak ditimpa.' };
          }

          return { ...row, existing, status: 'update', reason: 'Akan update data yang sudah ada.' };
        }

        return { ...row, existing, status: 'skip', reason: 'Sudah ada di laporan harian.' };
      });
    });
  }, [apiRecapAdvertiserId, apiRecapCsId, apiRecapMode, apiRecapPreserveEdited, dailyAds]);

  const handleOpenApiRecap = async () => {
    if (!apiRecapFromDate || !apiRecapToDate) {
      toast.error('Tanggal rekap wajib diisi.');
      return;
    }

    if (apiRecapFromDate > apiRecapToDate) {
      toast.error('Tanggal awal tidak boleh lebih besar dari tanggal akhir.');
      return;
    }

    setIsApiRecapOpen(true);
    setApiRecapRows([]);
    setApiRecapErrors([]);
    setApiRecapProviderStatuses([]);
    setIsApiRecapLoading(true);

    const configs = await loadApiRecapIntegrationConfigs();

    const platformNameById = new Map(platforms.map((platform) => [platform.id, platform.name.toLowerCase()]));
    const selectedProviderKey =
      apiRecapPlatformId === 'all'
        ? null
        : getAdsProviderKeyByPlatformName(platformNameById.get(apiRecapPlatformId));
    const shouldLoadProvider = (provider: AdsProviderKey) =>
      apiRecapPlatformId === 'all' || selectedProviderKey === provider;
    const getEnabledConfigCount = (provider: AdsProviderKey) => {
      if (provider === 'meta') {
        return configs.meta.filter((config) => config.enabled && config.liveMetaAccountId).length;
      }
      if (provider === 'google') {
        return configs.google.filter((config) => config.enabled && config.liveGoogleCustomerId).length;
      }
      return configs.tiktok.filter((config) => config.enabled && config.liveTikTokAdvertiserId).length;
    };

    const tasks: Array<{
      key: AdsProviderKey;
      label: string;
      enabledConfigCount: number;
      request: Promise<ApiRecapPreviewRow[]>;
    }> = [];

    if (shouldLoadProvider('meta')) {
      tasks.push(
        {
          key: 'meta',
          label: adsProviderLabels.meta,
          enabledConfigCount: getEnabledConfigCount('meta'),
          request: syncMetaSnapshotDataset({
            from: selectedRecapRange.from,
            to: selectedRecapRange.to,
            force: true,
            minFreshMinutes: 0,
          }).then((payload) => buildApiRecapRows(payload.rows || [], adsProviderLabels.meta)),
        },
      );
    }

    if (shouldLoadProvider('google')) {
      tasks.push(
        {
          key: 'google',
          label: adsProviderLabels.google,
          enabledConfigCount: getEnabledConfigCount('google'),
          request: syncGoogleAdsSnapshotDataset({
            from: selectedRecapRange.from,
            to: selectedRecapRange.to,
            force: true,
            minFreshMinutes: 0,
          }).then((payload) => buildApiRecapRows(payload.rows || [], adsProviderLabels.google)),
        },
      );
    }

    if (shouldLoadProvider('tiktok')) {
      tasks.push(
        {
          key: 'tiktok',
          label: adsProviderLabels.tiktok,
          enabledConfigCount: getEnabledConfigCount('tiktok'),
          request: syncTikTokAdsSnapshotDataset({
            from: selectedRecapRange.from,
            to: selectedRecapRange.to,
            force: true,
            minFreshMinutes: 0,
          }).then((payload) => buildApiRecapRows(payload.rows || [], adsProviderLabels.tiktok)),
        },
      );
    }

    try {
      if (tasks.length === 0) {
        toast.info('Platform ini belum punya konektor API laporan iklan.');
        return;
      }

      const results = await Promise.allSettled(tasks.map((task) => task.request));
      const rows: ApiRecapPreviewRow[] = [];
      const errors: string[] = [];
      const providerStatuses: ApiRecapProviderStatus[] = [];

      results.forEach((result, index) => {
        const task = tasks[index];
        if (result.status === 'fulfilled') {
          rows.push(...result.value);
          providerStatuses.push({
            key: task.key,
            label: task.label,
            state: result.value.length > 0 ? 'success' : 'empty',
            count: result.value.length,
            message: result.value.length > 0
              ? `${result.value.length} snapshot terbaca.`
              : getEmptyApiRecapMessage(task.key, task.enabledConfigCount),
          });
        } else {
          const message = getApiRecapErrorMessage(task.key, result.reason);
          errors.push(`${task.label}: ${message}`);
          providerStatuses.push({
            key: task.key,
            label: task.label,
            state: 'error',
            count: 0,
            message,
          });
        }
      });

      setApiRecapRows(rows.sort((left, right) => {
        if (left.date !== right.date) return left.date.localeCompare(right.date);
        return left.accountName.localeCompare(right.accountName);
      }));
      setApiRecapErrors(errors);
      setApiRecapProviderStatuses(providerStatuses);

      if (rows.length === 0 && errors.length === 0) {
        toast.info('Tidak ada snapshot API untuk periode ini.');
      }
    } finally {
      setIsApiRecapLoading(false);
    }
  };

  const handleCommitApiRecap = async () => {
    const actionableRows = apiRecapRows.filter((row) => row.status === 'new' || row.status === 'update');
    if (actionableRows.length === 0) {
      toast.info('Tidak ada data yang perlu disimpan.');
      return;
    }

    setIsApiRecapSaving(true);
    let inserted = 0;
    let updated = 0;

    try {
      for (const row of actionableRows) {
        const payload: DailyAd = {
          id: row.existing?.id || crypto.randomUUID(),
          date: row.date,
          advertiserId: row.advertiserId,
          platformId: row.platformId,
          subChannelId: row.subChannelId,
          adAccountId: row.adAccountId,
          csId: row.csId,
          amountSpent: row.amountSpent,
          leadsDashboard: row.leadsDashboard,
          ppnAmount: row.ppnAmount,
          feeAmount: row.feeAmount,
          editCount: row.status === 'update' ? (row.existing?.editCount || 0) + 1 : 0,
        };

        if (row.status === 'update') {
          await Promise.resolve(updateDailyAd(payload));
          updated += 1;
        } else {
          await Promise.resolve(addDailyAd(payload));
          inserted += 1;
        }
      }

      toast.success(`Rekap API selesai: ${inserted} ditambahkan, ${updated} diperbarui.`);
      setIsApiRecapOpen(false);
      setApiRecapRows([]);
    } finally {
      setIsApiRecapSaving(false);
    }
  };

  // Handlers
  const handleSortRequest = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleExport = async () => {
    if (filteredData.length === 0) {
        toast.error('Tidak ada data untuk diexport');
        return;
    }

    const exportData = filteredData.map(item => ({
        'Tanggal Lead': item.date,
        Advertiser: getAdvertiserName(item.advertiserId),
        'Advertiser Lama': item.legacyAdvertiserId ? getAdvertiserName(item.legacyAdvertiserId) : '',
        Platform: getPlatformName(item.platformId),
        Account: getAccountName(item.adAccountId),
        SubChannel: getSubChannelName(item.subChannelId || ''),
        CS: item.csId ? getCsName(item.csId) : '-',
        Spending: item.amountSpent,
        'Leads (Dash)': item.leadsDashboard,
        'Leads (Real)': item.realLeads,
        'Orders (Real)': item.realOrders,
        'Orders (Done)': item.realOrdersDone,
        'CPL (Real)': item.realLeads > 0 ? Math.round(Number(item.amountSpent) / item.realLeads) : 0,
        'CPR (Done)': item.realOrdersDone > 0 ? Math.round(Number(item.amountSpent) / item.realOrdersDone) : 0
    }));

    const spreadsheet = await loadSpreadsheet();
    const ws = spreadsheet.utils.json_to_sheet(exportData);
    const wb = spreadsheet.utils.book_new();
    spreadsheet.utils.book_append_sheet(wb, ws, "Laporan Iklan");
    spreadsheet.writeFile(wb, `Laporan_Iklan_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const normalizeImportDate = (value: unknown) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return format(value, 'yyyy-MM-dd');
    }

    if (typeof value === 'number') {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const parsedDate = new Date(excelEpoch.getTime() + value * 86400000);
      if (!Number.isNaN(parsedDate.getTime())) return format(parsedDate, 'yyyy-MM-dd');
    }

    const rawValue = String(value || '').trim();
    if (!rawValue) return format(new Date(), 'yyyy-MM-dd');

    const parsedDate = new Date(rawValue);
    if (!Number.isNaN(parsedDate.getTime())) return format(parsedDate, 'yyyy-MM-dd');

    return rawValue;
  };

  const findAdAccountByImportValue = (value: unknown) => {
    const rawValue = String(value || '').trim();
    if (!rawValue) return undefined;

    const normalized = normalizeAdAccountLookupKey(rawValue);
    const flexibleKeys = buildFlexibleAdAccountLookupKeys(rawValue);

    return adAccounts.find((account) => {
      if (account.id === rawValue) return true;
      if (normalizeAdAccountLookupKey(account.accountName) === normalized) return true;
      const accountKeys = buildFlexibleAdAccountLookupKeys(account.accountName);
      return accountKeys.some((key) => flexibleKeys.includes(key));
    });
  };

  const handleDownloadTemplate = async () => {
    const templateData = [
        {
            Date: '2024-01-01',
            Account: 'Nama Akun Iklan di Master Data',
            Spending: 1000000,
            Leads: 50
        }
    ];
    const spreadsheet = await loadSpreadsheet();
    const ws = spreadsheet.utils.json_to_sheet(templateData);
    const wb = spreadsheet.utils.book_new();
    spreadsheet.utils.book_append_sheet(wb, ws, "Template");
    spreadsheet.writeFile(wb, "Template_Import_Iklan.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const bstr = evt.target?.result;
            const spreadsheet = await loadSpreadsheet();
            const wb = spreadsheet.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = spreadsheet.utils.sheet_to_json(ws);
            
            const staged = data.map((row: any) => {
                 const dateStr = normalizeImportDate(row['Date'] || row['Tanggal'] || row['date']);
                 const accountValue =
                   row['Account'] ||
                   row['Akun'] ||
                   row['Akun Iklan'] ||
                   row['Ad Account'] ||
                   row['adAccountId'] ||
                   row['account'];
                 const account = findAdAccountByImportValue(accountValue);
                 const spending = row['Spending'] || row['spending'] || row['Amount Spent'] || 0;
                 const leads = row['Leads'] || row['leads'] || row['Leads Dashboard'] || 0;

                 return hydrateStagedAdRow({
                     id: crypto.randomUUID(),
                     date: dateStr,
                     advertiserId: '',
                     platformId: '',
                     subChannelId: '',
                     adAccountId: account?.id || '',
                     csId: '',
                     amountSpent: spending,
                     leadsDashboard: leads,
                     _rawAccount: accountValue ? String(accountValue) : undefined,
                 });
            });

            setStagedData(staged);
            setImportStep('review');
            if (fileInputRef.current) fileInputRef.current.value = '';

        } catch (error) {
            console.error(error);
            toast.error('Gagal memproses file Excel');
        }
    };
    reader.readAsBinaryString(file);
  };

  const handleStagedChange = (id: string, field: string, value: any) => {
      setStagedData(prev => prev.map(item => {
          if (item.id !== id) return item;

          return hydrateStagedAdRow({ ...item, [field]: value });
      }));
  };

  const handleRemoveStagedRow = (id: string) => {
      setStagedData(prev => prev.filter(p => p.id !== id));
  };

  const handleCommitImport = async () => {
      const hydratedRows = stagedData.map(hydrateStagedAdRow);
      // Validate
      const invalidItems = hydratedRows.filter(d =>
        !d.date ||
        !d.platformId ||
        !d.adAccountId ||
        !d.advertiserId ||
        !isAdAccountAllowedForDate(d.adAccountId, d.date)
      );
      if (invalidItems.length > 0) {
          toast.error(`Masih ada ${invalidItems.length} baris yang belum cocok dengan Master Data Akun Iklan.`);
          return;
      }

      setIsSubmitting(true);
      let successCount = 0;
      let dupCount = 0;

      setStagedData(hydratedRows);

      for (const item of hydratedRows) {
           // Check Duplicate in DB
           const exists = dailyAds.some(d => d.date === item.date && d.adAccountId === item.adAccountId);
           if (!exists) {
               const account = adAccounts.find(a => a.id === item.adAccountId);
               const ppnRate = account?.ppn || 0;
               const feeRate = account?.fee || 0;
               const spendVal = Number(item.amountSpent) || 0;

               await Promise.resolve(addDailyAd({
                   id: crypto.randomUUID(),
                   date: item.date,
                   advertiserId: item.advertiserId,
                   platformId: item.platformId,
                   subChannelId: item.subChannelId || undefined,
                   adAccountId: item.adAccountId,
                   csId: item.csId || undefined,
                   amountSpent: spendVal,
                   leadsDashboard: Number(item.leadsDashboard) || 0,
                   ppnAmount: Math.round(spendVal * (ppnRate/100)),
                   feeAmount: Math.round(spendVal * (feeRate/100)),
                   editCount: 0,
               }));
               successCount++;
           } else {
               dupCount++;
           }
      }

      setIsSubmitting(false);
      setIsImportModalOpen(false);
      setImportStep('upload');
      setStagedData([]);
      toast.success(`Import selesai: ${successCount} tersimpan, ${dupCount} duplikat diabaikan.`);
  };

  const handleOpenModal = (item?: DailyAd) => {
    if (item) {
      const attribution = resolveDailyAdAttribution(item);
      setEditingId(item.id);
      setFormData({
        date: item.date,
        advertiserId: attribution.advertiserId,
        platformId: attribution.platformId,
        subChannelId: attribution.subChannelId || '',
        adAccountId: item.adAccountId,
        csId: attribution.csId || '',
        amountSpent: String(item.amountSpent),
        leadsDashboard: String(item.leadsDashboard),
        editCount: item.editCount || 0
      });
    } else {
      setEditingId(null);
      setFormData(hydrateAdFormData({
        date: new Date().toISOString().split('T')[0],
        advertiserId: '',
        platformId: '',
        subChannelId: '',
        adAccountId: '',
        csId: '',
        amountSpent: '',
        leadsDashboard: '',
        editCount: 0
      }));
    }
    setIsModalOpen(true);
  };

  const handleInputCloseAttempt = () => {
      let isDirty = false;
      if (editingId) {
          isDirty = true;
          } else {
          isDirty = (
              !!formData.adAccountId || 
              !!formData.amountSpent || 
              !!formData.leadsDashboard
          );
      }

      if (isDirty) {
          setConfirmDialog({
              isOpen: true,
              title: "Batalkan Input?",
              description: "Data yang Anda masukkan belum disimpan. Apakah Anda yakin ingin membatalkan?",
              confirmLabel: "Ya, Batalkan",
              variant: 'destructive',
              onConfirm: () => setIsModalOpen(false)
          });
      } else {
          setIsModalOpen(false);
      }
  };

  const handleInputOpenChange = (open: boolean) => {
      if (open) {
          setIsModalOpen(true);
      } else {
          handleInputCloseAttempt();
      }
  };

  const proceedCloseImport = () => {
      setIsImportModalOpen(false);
      setTimeout(() => {
          setImportStep('upload');
          setStagedData([]);
      }, 300);
  };

  const handleImportCloseAttempt = () => {
      if (importStep === 'review') {
           setConfirmDialog({
              isOpen: true,
              title: "Batalkan Import?",
              description: "Proses review belum selesai. Apakah Anda yakin ingin membatalkan import ini?",
              confirmLabel: "Batalkan Import",
              variant: 'destructive',
              onConfirm: () => proceedCloseImport()
          });
      } else {
          proceedCloseImport();
      }
  };

  const handleImportOpenChange = (open: boolean) => {
      if (open) {
          setIsImportModalOpen(true);
      } else {
          handleImportCloseAttempt();
      }
  };

  const handleSave = async () => {
    if (!editingId) {
      toast.error('Input langsung dinonaktifkan. Gunakan Sinkronkan API atau Import Laporan.');
      return;
    }

    const hydratedFormData = hydrateAdFormData(formData);
    const selectedAttribution = hydratedFormData.adAccountId
      ? resolveAccountAttribution(
          hydratedFormData.adAccountId,
          hydratedFormData.date,
          isCsUser ? currentUser?.id : hydratedFormData.csId,
        )
      : null;

    if (
      !hydratedFormData.date ||
      !hydratedFormData.adAccountId ||
      !hydratedFormData.platformId ||
      !hydratedFormData.advertiserId ||
      !hydratedFormData.amountSpent ||
      !hydratedFormData.leadsDashboard ||
      !selectedAttribution
    ) {
      toast.error('Mohon lengkapi tanggal, akun iklan, spending, dan leads.');
      setFormData(hydratedFormData);
      return;
    }

    if (!isAdAccountAllowedForDate(hydratedFormData.adAccountId, hydratedFormData.date)) {
      toast.error('Akun iklan ini tidak sesuai akses atau assignment aktif user.');
      setFormData(hydratedFormData);
      return;
    }

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    // Duplicate Check
    if (editingId) {
        const exists = dailyAds.some(d => 
            d.id !== editingId &&
            d.date === hydratedFormData.date &&
            d.adAccountId === hydratedFormData.adAccountId
        );
        if (exists) {
            toast.error('Data untuk Tanggal & Akun ini sudah ada! Mohon edit data yang ada.');
            setIsSubmitting(false);
            return;
        }
    }

    const selectedAccount = selectedAttribution.account;
    const ppnRate = selectedAccount?.ppn || 0;
    const feeRate = selectedAccount?.fee || 0;
    const spendingVal = Number(parseNumber(hydratedFormData.amountSpent));
    
    const ppnAmount = Math.round(spendingVal * (ppnRate / 100));
    const feeAmount = Math.round(spendingVal * (feeRate / 100));

    const payload: DailyAd = {
        id: editingId || crypto.randomUUID(), 
        date: hydratedFormData.date,
        advertiserId: hydratedFormData.advertiserId,
        platformId: hydratedFormData.platformId,
        subChannelId: hydratedFormData.subChannelId || undefined,
        adAccountId: hydratedFormData.adAccountId,
        csId: hydratedFormData.csId || undefined,
        amountSpent: spendingVal,
        leadsDashboard: Number(hydratedFormData.leadsDashboard),
        ppnAmount: ppnAmount,
        feeAmount: feeAmount,
        editCount: hydratedFormData.editCount + 1
    };

    if (editingId) {
      updateDailyAd(payload);
      toast.success('Koreksi laporan disimpan');
      if (currentUser) {
        logActivity(
          { id: currentUser.id, name: currentUser.name, role: currentUser.role },
          'UPDATE', 'Iklan Harian',
          `Mengoreksi laporan iklan harian (spend: Rp ${spendingVal.toLocaleString('id-ID')})`,
          editingId
        );
      }
    }
    setIsSubmitting(false);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
        isOpen: true,
        title: "Hapus Data?",
        description: "Data yang dihapus tidak dapat dikembalikan. Lanjutkan?",
        confirmLabel: "Hapus",
        variant: 'destructive',
        onConfirm: () => {
           deleteDailyAd(id);
           toast.success('Data dihapus');
           if (currentUser) {
             logActivity(
               { id: currentUser.id, name: currentUser.name, role: currentUser.role },
               'DELETE', 'Iklan Harian',
               `Menghapus data iklan harian`,
               id
             );
           }
        }
    });
  };

  const getPlatformName = (id: string) => lookupMaps.platformNameById.get(id) || '-';
  const getSubChannelName = (id: string) => lookupMaps.subChannelNameById.get(id) || '-';
  const getAccountName = (id: string) => lookupMaps.accountNameById.get(id) || '-';
  const getAdvertiserName = (id: string) => lookupMaps.userNameById.get(id) || '-';
  const getCsName = (id: string) => lookupMaps.userNameById.get(id) || '-';

  const apiRecapSummary = useMemo(() => ({
    newRows: apiRecapRows.filter((row) => row.status === 'new').length,
    updateRows: apiRecapRows.filter((row) => row.status === 'update').length,
    skippedRows: apiRecapRows.filter((row) => row.status === 'skip').length,
    unmappedRows: apiRecapRows.filter((row) => row.status === 'unmapped').length,
    spend: apiRecapRows
      .filter((row) => row.status === 'new' || row.status === 'update')
      .reduce((sum, row) => sum + row.amountSpent, 0),
  }), [apiRecapRows]);
  const apiRecapActionableCount = apiRecapSummary.newRows + apiRecapSummary.updateRows;
  const apiRecapSaveDisabledReason = useMemo(() => {
    if (isApiRecapLoading) return 'Preview sedang dimuat.';
    if (apiRecapRows.length === 0) return 'Refresh preview dulu untuk melihat data yang bisa disimpan.';
    if (apiRecapActionableCount > 0) return '';

    const allRowsAlreadyExist = apiRecapRows.every((row) => row.status === 'skip' && row.reason === 'Sudah ada di laporan harian.');
    if (apiRecapMode === 'insert-missing' && allRowsAlreadyExist) {
      return 'Semua snapshot sudah ada di laporan harian. Ubah Mode Simpan ke Update existing untuk sinkron ulang.';
    }

    if (apiRecapRows.every((row) => row.status === 'unmapped')) {
      return 'Belum ada akun yang bisa disimpan. Lengkapi mapping akun iklan di Master Data Akun Iklan.';
    }

    return 'Tidak ada perubahan yang perlu disimpan dari preview ini.';
  }, [apiRecapActionableCount, apiRecapMode, apiRecapRows, isApiRecapLoading]);

  const renderAdvancedFilters = () => (
    <div className="dailyAdsAdvancedFilterGrid">
      {isAdminManagementUser && (
        <div className="dailyAdsFilterField">
          <Label>Advertiser</Label>
          <Select value={advertiserFilter} onValueChange={setAdvertiserFilter}>
            <SelectTrigger className="dailyAdsFilterControl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 dark:text-slate-200">
              <SelectValue placeholder="Advertiser" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <SelectItem value="all" className="dark:text-slate-200 dark:focus:bg-slate-700">Semua Advertiser</SelectItem>
              {optAdvertisers.map(user => (
                <SelectItem key={user.id} value={user.id} className="dark:text-slate-200 dark:focus:bg-slate-700">{user.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="dailyAdsFilterField">
        <Label>Platform</Label>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="dailyAdsFilterControl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 dark:text-slate-200">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <SelectItem value="all" className="dark:text-slate-200 dark:focus:bg-slate-700">Semua Platform</SelectItem>
            {optPlatforms.map(p => (
              <SelectItem key={p.id} value={p.id} className="dark:text-slate-200 dark:focus:bg-slate-700">{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="dailyAdsFilterField">
        <Label>Sub Channel</Label>
        <Select value={subChannelFilter} onValueChange={setSubChannelFilter}>
          <SelectTrigger className="dailyAdsFilterControl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 dark:text-slate-200">
            <SelectValue placeholder="Sub Channel" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <SelectItem value="all" className="dark:text-slate-200 dark:focus:bg-slate-700">Semua Sub</SelectItem>
            {optSubChannels.map(s => (
              <SelectItem key={s.id} value={s.id} className="dark:text-slate-200 dark:focus:bg-slate-700">{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="dailyAdsFilterField">
        <Label>Akun Iklan</Label>
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="dailyAdsFilterControl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 dark:text-slate-200">
            <SelectValue placeholder="Akun Iklan" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <SelectItem value="all" className="dark:text-slate-200 dark:focus:bg-slate-700">Semua Akun</SelectItem>
            {optAccounts.map(a => (
              <SelectItem key={a.id} value={a.id} className="dark:text-slate-200 dark:focus:bg-slate-700">{a.accountName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="dailyAdsFilterField">
        <Label>Customer Service</Label>
        <Select value={csFilter} onValueChange={setCsFilter}>
          <SelectTrigger className="dailyAdsFilterControl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 dark:text-slate-200">
            <SelectValue placeholder="Customer Service" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <SelectItem value="all" className="dark:text-slate-200 dark:focus:bg-slate-700">Semua CS</SelectItem>
            {optCs.map(cs => (
              <SelectItem key={cs.id} value={cs.id} className="dark:text-slate-200 dark:focus:bg-slate-700">{cs.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <OperationalPageShell className="dailyAdsPage">
      <div className="flex flex-col space-y-4">
        <OperationalPageHeader
          eyebrow="Operasional"
          title="Iklan Harian"
          subtitle="Monitor performa iklan dan pengeluaran harian."
          icon={CalendarIcon}
          actions={(
            <>
            <Button variant="outline" onClick={handleExport} className="dailyAdsHeaderButton h-9 bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" aria-label="Export laporan iklan">
               <Download className="w-4 h-4" /> <span className="dailyAdsHeaderButtonText">Export</span>
            </Button>
            {hasPermission('ads.manage') && (
            <>
            <Button variant="outline" onClick={openApiRecapModal} className="dailyAdsHeaderButton h-9 bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" aria-label="Sinkronkan laporan iklan">
               <RefreshCw className="w-4 h-4" /> <span className="dailyAdsHeaderButtonText">Sinkronkan</span>
            </Button>
            <Button variant="outline" onClick={() => setIsImportModalOpen(true)} className="dailyAdsHeaderButton h-9 bg-white dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700" aria-label="Import laporan iklan">
               <Upload className="w-4 h-4" /> <span className="dailyAdsHeaderButtonText">Import Laporan</span>
            </Button>
            </>
            )}
            </>
          )}
        />

        <OperationalKpiGrid className="dailyAdsKpiGrid">
          <OperationalKpiCard
            label="Total Spending"
            value={(
              <div className="space-y-1">
                <div>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totals.spend)}</div>
                <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  Burn: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totals.burn)}
                </div>
              </div>
            )}
            icon={DollarSign}
            tone="blue"
          />
          <OperationalKpiCard
            label="Total Leads"
            value={(
              <div className="space-y-1">
                <div>{totals.leadsDash}</div>
                <div className="text-xs font-normal text-slate-500 dark:text-slate-400">Real: {totals.leadsReal}</div>
              </div>
            )}
            icon={Users}
            tone="blue"
          />
          <OperationalKpiCard
            label="Total Sales"
            value={(
              <div className="space-y-1">
                <div>{totals.orders}</div>
                <div className="text-xs font-normal text-slate-500 dark:text-slate-400">Selesai: {totals.ordersDone}</div>
              </div>
            )}
            icon={ShoppingCart}
            tone="emerald"
          />
          <OperationalKpiCard
            label="CPR (Done)"
            value={(
              <div className="space-y-1">
                <div>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(avgCprDone)}</div>
                <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  CPL {new Intl.NumberFormat('id-ID', { notation: "compact", compactDisplay: "short" }).format(avgCplAds)} | CPR {new Intl.NumberFormat('id-ID', { notation: "compact", compactDisplay: "short" }).format(avgCpr)}
                </div>
              </div>
            )}
            icon={TrendingUp}
            tone="violet"
          />
        </OperationalKpiGrid>

        {/* Filters & Content */}
        <OperationalFilterPanel className="dailyAdsFilterPanel">
          <div className="dailyAdsFilterBar">
            <FoundationDateRangePicker
              date={dateRange}
              setDate={setDateRange}
              className="dailyAdsDateRange"
              contentClassName="dailyAdsDatePopover"
              numberOfMonths={isMobile ? 1 : 2}
              triggerLabelMode={isMobile ? 'compact' : 'full'}
            />

            <div className="dailyAdsSearchBox relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Cari tanggal, advertiser, atau akun iklan..."
                className="dailyAdsSearchInput pl-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 dark:text-slate-200 focus:ring-1 focus:ring-blue-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              className={`dailyAdsFilterButton ${hasActiveFilters ? 'isActive' : ''}`}
              onClick={() => setIsFilterDialogOpen(true)}
            >
              <Filter className="h-4 w-4" />
              <span className="dailyAdsFilterButtonText">Filter</span>
              {activeFilterCount > 0 && <span className="dailyAdsFilterCount">{activeFilterCount}</span>}
            </Button>
          </div>

          {hasActiveFilters && (
            <div className="dailyAdsActiveFilterRow">
              <span className="dailyAdsActiveFilterLabel">Filter aktif</span>
              {isAdminManagementUser && advertiserFilter !== 'all' && <Badge variant="outline">{getAdvertiserName(advertiserFilter)}</Badge>}
              {platformFilter !== 'all' && <Badge variant="outline">{getPlatformName(platformFilter)}</Badge>}
              {subChannelFilter !== 'all' && <Badge variant="outline">{getSubChannelName(subChannelFilter)}</Badge>}
              {accountFilter !== 'all' && <Badge variant="outline">{getAccountName(accountFilter)}</Badge>}
              {csFilter !== 'all' && <Badge variant="outline">{getCsName(csFilter)}</Badge>}
              <Button type="button" variant="ghost" size="sm" className="dailyAdsResetInline" onClick={resetAdvancedFilters}>
                Reset
              </Button>
            </div>
          )}

          <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
            <DialogContent className="dailyAdsFilterDialog bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <DialogHeader className="dailyAdsFilterDialogHeader">
                <DialogTitle>Filter Iklan Harian</DialogTitle>
                <DialogDescription>Filter laporan berdasarkan atribusi aktif dari Master Data Akun Iklan.</DialogDescription>
              </DialogHeader>
              <div className="dailyAdsFilterDialogBody">
                {renderAdvancedFilters()}
              </div>
              <DialogFooter className="dailyAdsFilterDialogFooter">
                <Button type="button" variant="outline" onClick={resetAdvancedFilters}>
                  Reset Filter
                </Button>
                <Button type="button" onClick={() => setIsFilterDialogOpen(false)}>
                  Terapkan Filter
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </OperationalFilterPanel>

        <OperationalTableCard className="dailyAdsTableCard overflow-hidden p-0">
             <div className="dailyAdsDesktopTable hidden md:block overflow-x-auto">
             <Table>
                 <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                     <TableRow className="border-b border-slate-100 dark:border-slate-700">
                         <TableHead className="py-4 pl-6 w-[140px] text-slate-600 dark:text-slate-400 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSortRequest('date')}>
                             <div className="flex items-center gap-2">
                                Tanggal Lead <ArrowUpDown className="w-3 h-3 text-slate-400" />
                             </div>
                         </TableHead>
                         <TableHead className="py-4 text-slate-600 dark:text-slate-400 font-semibold">Advertiser & CS</TableHead>
                         <TableHead className="py-4 text-slate-600 dark:text-slate-400 font-semibold">Info Iklan</TableHead>
                         <TableHead className="text-right py-4 text-slate-600 dark:text-slate-400 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSortRequest('spending')}>
                             <div className="flex items-center justify-end gap-2">
                                Spending <ArrowUpDown className="w-3 h-3 text-slate-400" />
                             </div>
                         </TableHead>
                         <TableHead className="text-right py-4 text-slate-600 dark:text-slate-400 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSortRequest('leads_real')}>
                             <div className="flex items-center justify-end gap-2">
                                Leads (Real) <ArrowUpDown className="w-3 h-3 text-slate-400" />
                             </div>
                         </TableHead>
                         <TableHead className="text-right py-4 text-slate-600 dark:text-slate-400 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSortRequest('orders_done')}>
                             <div className="flex items-center justify-end gap-2">
                                Orders (Done) <ArrowUpDown className="w-3 h-3 text-slate-400" />
                             </div>
                         </TableHead>
                         <TableHead className="text-right py-4 text-slate-600 dark:text-slate-400 font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleSortRequest('cpl_real')}>
                             <div className="flex items-center justify-end gap-2">
                                Efisiensi (CPL) <ArrowUpDown className="w-3 h-3 text-slate-400" />
                             </div>
                         </TableHead>
                         <TableHead className="text-right py-4 pr-6 w-[100px] text-slate-600 dark:text-slate-400 font-semibold">Aksi</TableHead>
                     </TableRow>
                 </TableHeader>
                 <TableBody>
                    {filteredData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center py-12 text-slate-500 dark:text-slate-400">
                                <OperationalEmptyState
                                  icon={FileSpreadsheet}
                                  title="Tidak ada data iklan"
                                  description="Coba ubah filter, tanggal, atau kata kunci pencarian."
                                />
                            </TableCell>
                        </TableRow>
                    ) : (
                        visibleFilteredData.map(item => {
                            const cplDash = item.leadsDashboard > 0 ? (Number(item.amountSpent) / item.leadsDashboard) : 0;
                            const cplReal = item.realLeads > 0 ? (Number(item.amountSpent) / item.realLeads) : 0;
                            const cprDeal = item.realOrders > 0 ? (Number(item.amountSpent) / item.realOrders) : 0;
                            const cprDone = item.realOrdersDone > 0 ? (Number(item.amountSpent) / item.realOrdersDone) : 0;
                            const burn = Number(item.amountSpent) + (item.ppnAmount || 0) + (item.feeAmount || 0);
                            const legacyAdvertiserName = item.legacyAdvertiserId
                              ? getAdvertiserName(item.legacyAdvertiserId)
                              : '';

                            return (
                                <TableRow key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors">
                                    <TableCell className="py-4 pl-6 align-top">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-slate-900 dark:text-slate-200">
                                                {format(new Date(item.date), 'dd MMM yyyy', { locale: idLocale })}
                                            </span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                {format(new Date(item.date), 'EEEE', { locale: idLocale })}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4 align-top">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-medium text-slate-700 dark:text-slate-300">{getAdvertiserName(item.advertiserId)}</span>
                                            {legacyAdvertiserName && (
                                                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-300">
                                                    Lama: {legacyAdvertiserName}
                                                </span>
                                            )}
                                            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                <Users className="w-3 h-3" />
                                                <span>{item.csId ? getCsName(item.csId) : '-'}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4 align-top">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-normal">
                                                    {getPlatformName(item.platformId)}
                                                </Badge>
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                                                    {getAccountName(item.adAccountId)}
                                                </span>
                                            </div>
                                            {item.subChannelId && (
                                                <span className="text-xs text-slate-500 dark:text-slate-400 pl-1 border-l-2 border-slate-200 dark:border-slate-700">
                                                    {getSubChannelName(item.subChannelId)}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    
                                    {/* Spending Column */}
                                    <TableCell className="text-right py-4 align-top">
                                        <div className="flex flex-col items-end gap-0.5">
                                            <span className="font-bold text-slate-900 dark:text-slate-100">
                                                Rp {Number(item.amountSpent).toLocaleString('id-ID')}
                                            </span>
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                Burn: Rp {burn.toLocaleString('id-ID')}
                                            </span>
                                        </div>
                                    </TableCell>

                                    {/* Leads Column */}
                                    <TableCell className="text-right py-4 align-top">
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center justify-end gap-2 text-xs">
                                                <span className="text-slate-400">Dash:</span>
                                                <span className="font-medium text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 px-1.5 rounded">{item.leadsDashboard}</span>
                                            </div>
                                            <div className="flex items-center justify-end gap-2 text-xs">
                                                <span className="text-slate-400">Real:</span>
                                                <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 rounded">{item.realLeads}</span>
                                            </div>
                                        </div>
                                    </TableCell>

                                    {/* Orders Column */}
                                    <TableCell className="text-right py-4 align-top">
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center justify-end gap-2 text-xs">
                                                <span className="text-slate-400">Deal:</span>
                                                <span className="font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 rounded">{item.realOrders}</span>
                                            </div>
                                            <div className="flex items-center justify-end gap-2 text-xs">
                                                <span className="text-slate-400">Done:</span>
                                                <span className="font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-1.5 rounded">{item.realOrdersDone}</span>
                                            </div>
                                        </div>
                                    </TableCell>

                                    {/* Efficiency Column */}
                                    <TableCell className="text-right py-4 align-top">
                                        <div className="flex flex-col items-end gap-1.5">
                                            {/* CPL Combined (Dash & Real) */}
                                            <div className="flex items-center justify-end gap-1 text-xs">
                                                <span className="text-slate-400 mr-0.5">CPL:</span>
                                                <span className="font-medium text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-900/20 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap" title="Cost per Lead (Dashboard)">
                                                    D: Rp {cplDash.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                                </span>
                                                <span className="font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap" title="Cost per Lead (Real)">
                                                    R: Rp {cplReal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                                </span>
                                            </div>

                                            {/* CPR Deal - Green */}
                                            <div className="flex items-center justify-end gap-2 text-xs">
                                                <span className="text-slate-400">CPR(Deal):</span>
                                                <span className="font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded text-[11px]">
                                                    Rp {cprDeal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                                </span>
                                            </div>
                                            {/* CPR Done - Purple */}
                                            <div className="flex items-center justify-end gap-2 text-xs">
                                                <span className="text-slate-400">CPR(Done):</span>
                                                <span className="font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded text-[11px]">
                                                    Rp {cprDone.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                                </span>
                                            </div>
                                        </div>
                                    </TableCell>

                                    <TableCell className="text-right py-4 pr-6 align-top">
                                        <div className="flex justify-end gap-1">
                                            {/* Edit Button */}
                                            {canManageAdItem(item) && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => {
                                                        if (isAdvertiserUser && (item.editCount || 0) >= 2) {
                                                            toast.error("Batas edit tercapai (Maks 2x). Hubungi Management untuk revisi.");
                                                            return;
                                                        }
                                                        handleOpenModal(item);
                                                    }} 
                                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            )}

                                            {/* Delete Button - Only for Admins */}
                                            {canDeleteAdItem && (
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                 </TableBody>
                 <TableFooter className="bg-slate-100/50 dark:bg-slate-800 font-medium border-t border-slate-200 dark:border-slate-700">
                    <TableRow>
                        <TableCell colSpan={3} className="py-4 pl-6 text-slate-900 dark:text-slate-100 text-right font-bold tracking-tight">TOTAL SUMMARY</TableCell>
                        
                        {/* Spending Total */}
                        <TableCell className="text-right py-4 align-top">
                             <div className="flex flex-col items-end gap-0.5">
                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                    Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(totals.spend)}
                                </span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Burn: Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(totals.burn)}
                                </span>
                             </div>
                        </TableCell>

                        {/* Leads Total */}
                        <TableCell className="text-right py-4 align-top">
                             <div className="flex flex-col items-end gap-1">
                                <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">Dash: {totals.leadsDash}</span>
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Real: {totals.leadsReal}</span>
                             </div>
                        </TableCell>

                         {/* Orders Total */}
                         <TableCell className="text-right py-4 align-top">
                             <div className="flex flex-col items-end gap-1">
                                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Deal: {totals.orders}</span>
                                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Done: {totals.ordersDone}</span>
                             </div>
                        </TableCell>

                        {/* Efficiency Total */}
                        <TableCell className="text-right py-4 align-top">
                             <div className="flex flex-col items-end gap-1">
                                <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
                                    CPL(D): Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(avgCplAds)}
                                </span>
                                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                    CPL(R): Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(avgCplReal)}
                                </span>
                                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">
                                    CPR: Rp {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(avgCprDone)}
                                </span>
                             </div>
                        </TableCell>

                        <TableCell className="py-4"></TableCell>
                    </TableRow>
                 </TableFooter>
             </Table>
             </div>
             
               {/* Mobile Card List */}
              <div className="dailyAdsMobileList md:hidden space-y-3 p-4">
                {filteredData.length === 0 ? (
                    <OperationalEmptyState
                      icon={FileSpreadsheet}
                      title="Tidak ada data iklan"
                      description="Coba ubah filter, tanggal, atau kata kunci pencarian."
                    />
                ) : (
                    visibleFilteredData.map(item => {
                        const burn = Number(item.amountSpent) + (item.ppnAmount || 0) + (item.feeAmount || 0);
                        const cprDeal = item.realOrders > 0 ? (Number(item.amountSpent) / item.realOrders) : 0;
                        const cprDone = item.realOrdersDone > 0 ? (Number(item.amountSpent) / item.realOrdersDone) : 0;
                        const legacyAdvertiserName = item.legacyAdvertiserId
                          ? getAdvertiserName(item.legacyAdvertiserId)
                          : '';
                        
                        return (
                            <div key={item.id} className="dailyAdsMobileCard bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
                                <div className="flex justify-between items-start gap-2 mb-3">
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                            {format(new Date(item.date), 'dd MMM yyyy', { locale: idLocale })}
                                        </span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 mb-2">
                                            {getPlatformName(item.platformId)} - {getAccountName(item.adAccountId)}
                                        </span>
                                        <div className="mb-2 flex min-w-0 flex-col gap-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                            <span className="truncate font-semibold text-slate-700 dark:text-slate-300">
                                                {getAdvertiserName(item.advertiserId)}
                                            </span>
                                            {legacyAdvertiserName && (
                                                <span className="truncate font-medium text-amber-600 dark:text-amber-300">
                                                    Lama: {legacyAdvertiserName}
                                                </span>
                                            )}
                                            <span className="truncate">
                                                CS: {item.csId ? getCsName(item.csId) : '-'}
                                            </span>
                                        </div>
                                        
                                        {/* Actions Inline */}
                                        {canManageAdItem(item) && (
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleOpenModal(item)} 
                                                    className="flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                                                >
                                                    <Edit className="w-3 h-3" /> Edit
                                                </button>
                                                {canDeleteAdItem && (
                                                    <button 
                                                        onClick={() => handleDelete(item.id)} 
                                                        className="flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded hover:bg-red-100 transition-colors"
                                                    >
                                                        <Trash2 className="w-3 h-3" /> Hapus
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Metrics Group - Merged to Top */}
                                    <div className="flex gap-1.5 shrink-0">
                                        <div className="flex flex-col items-center justify-center bg-cyan-50 dark:bg-cyan-900/20 rounded px-1.5 py-1 min-w-[36px]">
                                            <span className="text-[9px] text-cyan-600 dark:text-cyan-400 uppercase font-bold">Lead</span>
                                            <span className="text-sm font-bold text-cyan-700 dark:text-cyan-300 leading-none mt-0.5">{item.realLeads}</span>
                                        </div>
                                        <div className="flex flex-col items-center justify-center bg-emerald-50 dark:bg-emerald-900/20 rounded px-1.5 py-1 min-w-[36px]">
                                            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">Deal</span>
                                            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300 leading-none mt-0.5">{item.realOrders}</span>
                                        </div>
                                        <div className="flex flex-col items-center justify-center bg-purple-50 dark:bg-purple-900/20 rounded px-1.5 py-1 min-w-[36px]">
                                            <span className="text-[9px] text-purple-600 dark:text-purple-400 uppercase font-bold">Done</span>
                                            <span className="text-sm font-bold text-purple-700 dark:text-purple-300 leading-none mt-0.5">{item.realOrdersDone}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700 pb-1">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                            Rp {Number(item.amountSpent).toLocaleString('id-ID')}
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-0.5">Burn: Rp {burn.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex flex-col text-right mb-4">
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs truncate">
                                            CPR(Deal): Rp {cprDeal.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                        </span>
                                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-0.5 truncate">
                                            CPR(Done): Rp {cprDone.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                        </span>
                                    </div>
                                </div>

                            </div>
                        );
                    })
                )}
             </div>

             {visibleRowLimit < filteredData.length && (
                <div className="flex items-center justify-center border-t border-slate-100 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
                    <Button
                        variant="outline"
                        className="bg-white dark:bg-slate-900"
                        onClick={() => setVisibleRowLimit((limit) => Math.min(limit + INITIAL_AD_ROW_LIMIT, filteredData.length))}
                    >
                        Tampilkan Data Lainnya ({visibleRowLimit} / {filteredData.length})
                    </Button>
                </div>
             )}
        </OperationalTableCard>
      </div>

      {/* Input Modal */}
      <Sheet open={isModalOpen} onOpenChange={handleInputOpenChange}>
        <SheetContent 
            side={isMobile ? "bottom" : "right"}
            onInteractOutside={(e) => e.preventDefault()}
            className={isMobile ? "dailyAdsFormSheet flex h-[90vh] flex-col rounded-t-[20px] border-t border-slate-200 bg-slate-50 p-0 dark:border-slate-800 dark:bg-slate-950" : "dailyAdsFormSheet z-[150] flex h-full w-full flex-col gap-0 border-l border-slate-200 bg-slate-50 p-0 dark:border-slate-800 dark:bg-slate-950 sm:w-[560px] sm:max-w-[560px]"}
        >
          <div className="flex h-full flex-col">
          <SheetHeader className="sticky top-0 z-10 shrink-0 border-b border-slate-200 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-900">
            <SheetTitle className="text-slate-900 dark:text-slate-100">Koreksi Laporan Iklan</SheetTitle>
            <SheetDescription className="text-slate-500 dark:text-slate-400">Attribution mengikuti Master Data Akun Iklan. Koreksi hanya untuk angka laporan.</SheetDescription>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto bg-slate-50 px-6 py-4 space-y-4 dark:bg-slate-950">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <RequiredLabel>Tanggal</RequiredLabel>
                    <Input 
                        type="date" 
                        value={formData.date}
                        onChange={(e) => setFormData(prev => hydrateAdFormData({...prev, date: e.target.value}))}
                        className="bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                    />
                </div>
                <div className="space-y-2">
                    <RequiredLabel>Akun Iklan</RequiredLabel>
                    <Select 
                        value={formData.adAccountId}
                        onValueChange={(val) => setFormData(prev => hydrateAdFormData({...prev, adAccountId: val}))}
                        disabled={formAdAccountOptions.length === 0}
                    >
                        <SelectTrigger className="bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200">
                            <SelectValue placeholder="Pilih Akun Iklan" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            {formAdAccountOptions.map(option => (
                                <SelectItem key={option.account.id} value={option.account.id} className="dark:text-slate-200 dark:focus:bg-slate-700">
                                    {option.account.accountName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-bold uppercase text-blue-600 dark:text-blue-300">Master Akun Iklan</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Field di bawah otomatis dari assignment aktif.</p>
                    </div>
                    {selectedFormAttribution?.isComplete ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300">Valid</Badge>
                    ) : (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">Perlu dicek</Badge>
                    )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Advertiser</span>
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{getAdvertiserName(formData.advertiserId)}</p>
                        {editingLegacyAdvertiserId && (
                            <p className="mt-1 truncate text-xs font-medium text-amber-600 dark:text-amber-300">
                                Lama: {getAdvertiserName(editingLegacyAdvertiserId)}
                            </p>
                        )}
                    </div>
                    <div>
                        <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Platform</span>
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{getPlatformName(formData.platformId)}</p>
                    </div>
                    <div>
                        <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Sub Channel</span>
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{formData.subChannelId ? getSubChannelName(formData.subChannelId) : 'Tanpa sub channel'}</p>
                    </div>
                    <div>
                        <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">Customer Service</span>
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{formData.csId ? getCsName(formData.csId) : 'Belum ada assignment'}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <RequiredLabel>Amount Spent</RequiredLabel>
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-500 dark:text-slate-400">Rp</span>
                        <Input 
                            value={formatNumber(formData.amountSpent)}
                            onChange={(e) => {
                                // Strip non-digit characters to keep raw number in state
                                const rawValue = e.target.value.replace(/\D/g, '');
                                setFormData({...formData, amountSpent: rawValue});
                            }}
                            className="pl-10 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                            placeholder="0"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <RequiredLabel>Leads (Dashboard)</RequiredLabel>
                    <Input 
                        type="number"
                        value={formData.leadsDashboard}
                        onChange={(e) => setFormData({...formData, leadsDashboard: e.target.value})}
                        className="bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
                        placeholder="0"
                    />
                </div>
            </div>

            {/* Calculations Summary */}
            {(formData.amountSpent || formData.leadsDashboard) && formData.adAccountId && (
                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700 space-y-3">
                    <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estimasi Perhitungan</h4>
                    
                    {(() => {
                        const selectedAccount = selectedFormAttribution?.account;
                        const ppnRate = selectedAccount?.ppn || 0;
                        const feeRate = selectedAccount?.fee || 0;
                        const spendingVal = Number(parseNumber(formData.amountSpent));
                        
                        const ppnAmount = Math.round(spendingVal * (ppnRate / 100));
                        const feeAmount = Math.round(spendingVal * (feeRate / 100));
                        const totalBurn = spendingVal + ppnAmount + feeAmount;
                        
                        const leads = Number(formData.leadsDashboard) || 0;
                        const cplDash = leads > 0 ? spendingVal / leads : 0;

                        return (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 dark:text-slate-400">PPN ({ppnRate}%):</span>
                                        <span className="font-medium text-slate-700 dark:text-slate-300">Rp {ppnAmount.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 dark:text-slate-400">Fee ({feeRate}%):</span>
                                        <span className="font-medium text-slate-700 dark:text-slate-300">Rp {feeAmount.toLocaleString('id-ID')}</span>
                                    </div>
                                </div>
                                
                                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">Total Burn</span>
                                        <span className="font-bold text-slate-900 dark:text-slate-100">Rp {totalBurn.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">Est. CPL (Dash)</span>
                                        <span className={`font-bold ${cplDash > 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`}>
                                            Rp {cplDash.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
          </div>

          <SheetFooter className="sticky bottom-0 z-10 shrink-0 flex-row gap-3 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900 sm:justify-between">
            <Button variant="outline" onClick={handleInputCloseAttempt} className="flex-1 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">Batal</Button>
            <Button onClick={handleSave} disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Simpan
            </Button>
          </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* API Recap Modal */}
      <Dialog open={isApiRecapOpen} onOpenChange={(open) => {
        if (!isApiRecapSaving) setIsApiRecapOpen(open);
      }}>
          <DialogContent className="dailyAdsWideDialog dailyAdsRecapDialog max-w-[95vw] w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <DialogTitle className="text-slate-900 dark:text-slate-100">Rekap API ke Laporan Harian</DialogTitle>
            <DialogDescription>
              Preview snapshot API periode {selectedRecapRange.from} s/d {selectedRecapRange.to}. Data yang sudah dikoreksi bisa dilindungi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <div className="dailyAdsRecapControlGrid">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500 dark:text-slate-400">Dari Tanggal</Label>
                <Input
                  type="date"
                  value={apiRecapFromDate}
                  onChange={(event) => {
                    setApiRecapFromDate(event.target.value);
                    resetApiRecapPreview();
                  }}
                  className="bg-white dark:bg-slate-900"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500 dark:text-slate-400">Sampai Tanggal</Label>
                <Input
                  type="date"
                  value={apiRecapToDate}
                  onChange={(event) => {
                    setApiRecapToDate(event.target.value);
                    resetApiRecapPreview();
                  }}
                  className="bg-white dark:bg-slate-900"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500 dark:text-slate-400">Platform</Label>
                <Select
                  value={apiRecapPlatformId}
                  onValueChange={(value) => {
                    setApiRecapPlatformId(value);
                    setApiRecapCsId('all');
                    resetApiRecapPreview();
                  }}
                >
                  <SelectTrigger className="bg-white dark:bg-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900">
                    <SelectItem value="all">Semua Platform</SelectItem>
                    {platforms.filter((platform) => platform.status === 'active').map((platform) => (
                      <SelectItem key={platform.id} value={platform.id}>{platform.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500 dark:text-slate-400">Advertiser</Label>
                <Select
                  value={apiRecapAdvertiserId}
                  onValueChange={(value) => {
                    setApiRecapAdvertiserId(value);
                    setApiRecapCsId('all');
                    resetApiRecapPreview();
                  }}
                >
                  <SelectTrigger className="bg-white dark:bg-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900">
                    <SelectItem value="all">Semua Advertiser</SelectItem>
                    {advertiserFilterOptions.map((advertiser) => (
                      <SelectItem key={advertiser.id} value={advertiser.id}>{advertiser.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500 dark:text-slate-400">Mode Simpan</Label>
                <Select value={apiRecapMode} onValueChange={(value) => setApiRecapMode(value as ApiRecapMode)}>
                  <SelectTrigger className="bg-white dark:bg-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900">
                    <SelectItem value="insert-missing">Tambah yang belum ada</SelectItem>
                    <SelectItem value="update-existing">Update existing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500 dark:text-slate-400">CS</Label>
                <Select
                  value={apiRecapCsId}
                  onValueChange={(value) => {
                    setApiRecapCsId(value);
                    resetApiRecapPreview();
                  }}
                >
                  <SelectTrigger className="bg-white dark:bg-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900">
                    <SelectItem value="all">Semua CS</SelectItem>
                    {recapCsFilterOptions.map((cs) => (
                      <SelectItem key={cs.id} value={cs.id}>{cs.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="dailyAdsRecapSummaryBar">
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 shrink-0">
                <input
                  type="checkbox"
                  checked={apiRecapPreserveEdited}
                  onChange={(event) => setApiRecapPreserveEdited(event.target.checked)}
                  className="h-4 w-4 rounded"
                />
                Jangan timpa data yang pernah dikoreksi
              </label>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden lg:block" />
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-slate-500 dark:text-slate-400">Tambah</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{apiRecapSummary.newRows}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-slate-500 dark:text-slate-400">Update</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{apiRecapSummary.updateRows}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-slate-500 dark:text-slate-400">Skip</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{apiRecapSummary.skippedRows}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
                  <span className="text-slate-500 dark:text-slate-400">Unmapped</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{apiRecapSummary.unmappedRows}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-slate-500 dark:text-slate-400">Spend</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Rp {apiRecapSummary.spend.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>
            {apiRecapProviderStatuses.length > 0 && (
              <div className="dailyAdsApiProviderStatusGrid">
                {apiRecapProviderStatuses.map((provider) => (
                  <div
                    key={provider.key}
                    className={`dailyAdsApiProviderStatus is-${provider.state}`}
                  >
                    <div>
                      <span>{provider.label}</span>
                      <strong>{provider.state === 'error' ? 'Error' : `${provider.count} row`}</strong>
                    </div>
                    <small>{provider.message}</small>
                  </div>
                ))}
              </div>
            )}
          </div>

          {apiRecapErrors.length > 0 && apiRecapProviderStatuses.length === 0 && (
            <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              {apiRecapErrors.map((error, index) => (
                <div key={`${error}-${index}`}>{error}</div>
              ))}
            </div>
          )}

          <div className="dailyAdsRecapTableViewport px-6 py-3">
            {isApiRecapLoading ? (
              <div className="flex h-full items-center justify-center text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Menarik snapshot API...
              </div>
            ) : (
              <div className="dailyAdsRecapTableWrap">
                <Table className="dailyAdsRecapTable">
                  <colgroup>
                    <col className="dailyAdsRecapColDate" />
                    <col className="dailyAdsRecapColSource" />
                    <col className="dailyAdsRecapColAccount" />
                    <col className="dailyAdsRecapColAdvertiser" />
                    <col className="dailyAdsRecapColCs" />
                    <col className="dailyAdsRecapColSpend" />
                    <col className="dailyAdsRecapColLeads" />
                    <col className="dailyAdsRecapColStatus" />
                  </colgroup>
                  <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Tanggal</TableHead>
                      <TableHead className="whitespace-nowrap">Sumber</TableHead>
                      <TableHead className="whitespace-nowrap">Akun</TableHead>
                      <TableHead className="whitespace-nowrap">Advertiser</TableHead>
                      <TableHead className="whitespace-nowrap">CS</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Spend</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Leads API</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiRecapRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-slate-500">
                          Belum ada data preview.
                        </TableCell>
                      </TableRow>
                    ) : apiRecapRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.sourceLabel}</TableCell>
                        <TableCell><span className="dailyAdsRecapText">{row.accountName}</span></TableCell>
                        <TableCell><span className="dailyAdsRecapText">{row.advertiserName}</span></TableCell>
                        <TableCell><span className="dailyAdsRecapText">{row.csId ? getCsName(row.csId) : '-'}</span></TableCell>
                        <TableCell className="whitespace-nowrap text-right">Rp {row.amountSpent.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="whitespace-nowrap text-right">{row.leadsDashboard.toLocaleString('id-ID')}</TableCell>
                        <TableCell>
                          <div className="dailyAdsRecapStatusCell">
                            <Badge
                              variant="outline"
                              className={
                                row.status === 'new'
                                  ? 'w-fit border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : row.status === 'update'
                                    ? 'w-fit border-blue-200 bg-blue-50 text-blue-700'
                                    : row.status === 'unmapped'
                                      ? 'w-fit border-rose-200 bg-rose-50 text-rose-700'
                                      : 'w-fit border-slate-200 bg-slate-50 text-slate-600'
                              }
                            >
                              {row.status}
                            </Badge>
                            <span className="mt-1 text-xs text-slate-500">{row.reason}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter className="dailyAdsRecapFooter border-t border-slate-200 px-6 py-4 dark:border-slate-700">
            {apiRecapSaveDisabledReason && (
              <div className="dailyAdsRecapFooterNote">
                {apiRecapSaveDisabledReason}
              </div>
            )}
            <Button variant="outline" onClick={() => setIsApiRecapOpen(false)} disabled={isApiRecapSaving}>
              Batal
            </Button>
            <Button
              variant="outline"
              onClick={handleOpenApiRecap}
              disabled={isApiRecapLoading || isApiRecapSaving}
            >
              {isApiRecapLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh Preview
            </Button>
            <Button
              onClick={handleCommitApiRecap}
              disabled={isApiRecapLoading || isApiRecapSaving || apiRecapActionableCount === 0}
              className="bg-blue-600 text-white hover:bg-blue-700"
              title={apiRecapSaveDisabledReason || undefined}
            >
              {isApiRecapSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan Rekap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={handleImportOpenChange}>
        <DialogContent 
            onInteractOutside={(e) => e.preventDefault()}
            className={`dailyAdsImportDialog ${importStep === 'review' ? 'max-w-[95vw] h-[90vh]' : 'sm:max-w-[500px]'} w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl flex flex-col p-0 gap-0 overflow-hidden`}
        >
          
          {importStep === 'upload' ? (
            <>
            <DialogHeader className="p-6 pb-2">
                <DialogTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    Import Laporan Iklan
                </DialogTitle>
                <div className="flex flex-col gap-2">
                    <DialogDescription className="text-slate-500 dark:text-slate-400">
                        Upload file Excel (.xlsx) untuk import laporan iklan.
                        <br/>
                        Pastikan kolom header: <b>Date, Account, Spending, Leads</b>.
                    </DialogDescription>
                    <Button 
                        variant="link" 
                        onClick={handleDownloadTemplate} 
                        className="self-start h-auto p-0 text-blue-600 dark:text-blue-400"
                    >
                        <Download className="w-3 h-3 mr-1" />
                        Download Template Excel
                    </Button>
                </div>
            </DialogHeader>
            
            <div className="p-6 pt-2">
                <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-10 h-10 text-slate-400 mb-2" />
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Klik untuk upload file Excel</span>
                        <span className="text-xs text-slate-400 mt-1">.xlsx or .xls files</span>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImportExcel} 
                            accept=".xlsx, .xls" 
                            className="hidden" 
                        />
                </div>
            </div>

            <DialogFooter className="p-6 pt-0">
                <Button variant="outline" onClick={handleImportCloseAttempt} className="dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">Batal</Button>
            </DialogFooter>
            </>
          ) : (
            <>
             <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                <div className="flex flex-col gap-1">
                    <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {`Konfirmasi Import Laporan (${stagedData.length} Baris)`}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
                        Periksa akun iklan dan angka laporan sebelum disimpan. Attribution otomatis dari Master Data Akun Iklan.
                    </DialogDescription>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => {
                        setConfirmDialog({
                            isOpen: true,
                            title: "Ulangi Upload?",
                            description: "Data review saat ini akan dihapus. Anda harus mengupload ulang file.",
                            confirmLabel: "Ulangi Upload",
                            variant: 'default',
                            onConfirm: () => {
                                setImportStep('upload');
                                setStagedData([]);
                            }
                        });
                    }} className="dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                        Ulangi Upload
                    </Button>
                    <Button onClick={handleCommitImport} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white">
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Edit className="w-4 h-4 mr-2" />}
                        Simpan Semua
                    </Button>
                </div>
             </div>

             <div className="flex-1 overflow-auto bg-slate-100 p-4 dark:bg-slate-900/50">
                <div className="min-w-[980px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-700">
                            <TableRow>
                                <TableHead className="w-[50px] text-center">No</TableHead>
                                <TableHead className="w-[150px]">Tanggal</TableHead>
                                <TableHead className="min-w-[260px]">Akun Iklan</TableHead>
                                <TableHead className="min-w-[320px]">Attribution Master</TableHead>
                                <TableHead className="w-[150px] text-right">Spending</TableHead>
                                <TableHead className="w-[110px] text-right">Leads</TableHead>
                                <TableHead className="w-[130px]">Status</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stagedData.map((row, idx) => {
                                const rowOptions = getAdAccountOptionsForDate(row.date, row.adAccountId);
                                const rowAttribution = row.adAccountId
                                  ? resolveAccountAttribution(row.adAccountId, row.date, row.csId)
                                  : null;
                                const isAllowed = row.adAccountId ? isAdAccountAllowedForDate(row.adAccountId, row.date) : false;
                                const isValid = Boolean(row.date && row.platformId && row.adAccountId && row.advertiserId && isAllowed);
                                const isDup = dailyAds.some(d => d.date === row.date && d.adAccountId === row.adAccountId);
                                const rowStatus = !isValid ? 'Perlu dicek' : isDup ? 'Duplikat' : 'Siap simpan';

                                return (
                                    <TableRow key={row.id} className={`${!isValid ? 'bg-red-50 dark:bg-red-900/20' : ''} ${isDup ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}>
                                        <TableCell className="text-center font-medium">{idx + 1}</TableCell>
                                        <TableCell>
                                            <Input 
                                                type="date" 
                                                value={row.date} 
                                                onChange={(e) => handleStagedChange(row.id, 'date', e.target.value)}
                                                className={`h-9 ${!row.date ? 'border-red-500' : ''}`}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <select 
                                                    className={`flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 ${!row.adAccountId || !isAllowed ? 'border-red-500' : ''}`}
                                                    value={row.adAccountId}
                                                    onChange={(e) => handleStagedChange(row.id, 'adAccountId', e.target.value)}
                                                >
                                                    <option value="">Pilih Akun Iklan...</option>
                                                    {rowOptions.map(option => (
                                                        <option key={option.account.id} value={option.account.id}>{option.account.accountName}</option>
                                                    ))}
                                                </select>
                                                {!row.adAccountId && row._rawAccount && (
                                                    <span className="mt-1 max-w-[240px] truncate text-[10px] text-red-500" title={row._rawAccount}>
                                                        Tidak ketemu: {row._rawAccount}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                                <div className="truncate">
                                                    <span className="text-slate-400">Adv: </span>
                                                    <span className="font-medium text-slate-700 dark:text-slate-200">{getAdvertiserName(row.advertiserId)}</span>
                                                </div>
                                                <div className="truncate">
                                                    <span className="text-slate-400">Platform: </span>
                                                    <span className="font-medium text-slate-700 dark:text-slate-200">{getPlatformName(row.platformId)}</span>
                                                </div>
                                                <div className="truncate">
                                                    <span className="text-slate-400">Sub: </span>
                                                    <span className="font-medium text-slate-700 dark:text-slate-200">{row.subChannelId ? getSubChannelName(row.subChannelId) : 'Tanpa sub'}</span>
                                                </div>
                                                <div className="truncate">
                                                    <span className="text-slate-400">CS: </span>
                                                    <span className="font-medium text-slate-700 dark:text-slate-200">{row.csId ? getCsName(row.csId) : 'Belum assigned'}</span>
                                                </div>
                                                {rowAttribution && !rowAttribution.isComplete && (
                                                    <div className="col-span-2 text-[11px] font-medium text-amber-600 dark:text-amber-300">
                                                        Lengkapi {rowAttribution.missingFields.join(', ')} di Master Data Akun Iklan.
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Input 
                                                type="text" 
                                                value={formatNumber(row.amountSpent)} 
                                                onChange={(e) => handleStagedChange(row.id, 'amountSpent', parseNumber(e.target.value))}
                                                className="h-9 text-right"
                                                placeholder="0"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input 
                                                type="number" 
                                                value={row.leadsDashboard} 
                                                onChange={(e) => handleStagedChange(row.id, 'leadsDashboard', e.target.value)}
                                                className="h-9 text-right"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={isValid && !isDup ? 'default' : 'outline'}
                                                className={
                                                  isValid && !isDup
                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                    : isDup
                                                      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300'
                                                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300'
                                                }
                                            >
                                                {rowStatus}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" onClick={() => handleRemoveStagedRow(row.id)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
             </div>
            </>
          )}

        </DialogContent>
      </Dialog>
      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl gap-4">
           <DialogHeader>
             <div className="flex items-center gap-4">
                 <div className={`p-3 rounded-full ${confirmDialog.variant === 'destructive' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                    <AlertTriangle className="w-6 h-6" />
                 </div>
                 <div className="flex-1">
                    <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        {confirmDialog.title}
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                        {confirmDialog.description}
                    </DialogDescription>
                 </div>
             </div>
           </DialogHeader>
           
           <DialogFooter className="gap-2 sm:justify-end mt-2">
             <Button 
                variant="outline" 
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} 
                className="dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
            >
               Batal
             </Button>
             <Button 
                onClick={() => {
                     confirmDialog.onConfirm();
                     setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                }} 
                className={confirmDialog.variant === 'destructive' ? "bg-red-600 hover:bg-red-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}
            >
               {confirmDialog.confirmLabel || "Ya, Lanjutkan"}
             </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

    </OperationalPageShell>
  );
}
