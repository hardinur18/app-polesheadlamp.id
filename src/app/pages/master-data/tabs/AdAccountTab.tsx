import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Edit, Trash2,
  History, Link2, Monitor, RefreshCw, Unlink, UserCheck, Users
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { ControlPanel, ControlRow, SearchBox } from '../../../components/ui/control-panel';
import { DataTable, TableActionCell, TableActionHeader, TableActionMenu, TableActionMenuItem, TableStatusCell, TableStatusSwitch, TableText } from '../../../components/ui/data-table';
import { MasterDataTableTitle } from '../../../components/ui/master-data-table-title';
import {
  MasterDataFieldLabel,
  MasterDataFormDialogContent,
  MasterDataUnsavedChangesDialog,
  MobileCardActions,
  useMasterDataFormCloseGuard,
} from '../../../components/ui/master-data-ui';
import type { NoticeItem } from '../../../components/ui/notice-stack';
import { PlatformLogo } from '../../../components/ui/platform-logo';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Checkbox } from '../../../components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '../../../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { AdAccount, Role } from '../data';
import { useMasterData } from '../context';
import { usePermissions } from '@/app/hooks/usePermissions';
import { isAdvertiserRole, isCsRole } from '@/app/data/roleHelpers';
import { toast } from 'sonner';
import { getTodayDateKey } from '../dateKeys';
import { AdAccountForm } from '../forms/AdAccountForm';
import { cn } from '../../../components/ui/utils';
import {
  fetchAdsIntegrationConfigs,
  fetchMetaLiveBreakdown,
  getCachedMetaLiveRegistry,
  saveAdsIntegrationConfig,
  type AdsIntegrationConfig,
  type MetaLiveBreakdownResponse,
} from '@/app/services/liveAdsService';
import {
  fetchGoogleAdsIntegrationConfigs,
  fetchGoogleAdsLiveBreakdown,
  getCachedGoogleAdsLiveRegistry,
  saveGoogleAdsIntegrationConfig,
  type GoogleAdsIntegrationConfig,
  type GoogleAdsLiveBreakdownResponse,
} from '@/app/services/googleAdsLiveService';
import {
  fetchTikTokAdsIntegrationConfigs,
  fetchTikTokAdvertisers,
  fetchTikTokBusinessCenters,
  getCachedTikTokAdvertisers,
  getCachedTikTokBusinessCenters,
  saveTikTokAdsIntegrationConfig,
  type TikTokAdsIntegrationConfig,
  type TikTokAdvertiser,
  type TikTokBusinessCenter,
} from '@/app/services/tiktokAdsLiveService';
import {
  deleteAdApiAccount,
  fetchAdAccountApiMappings,
  fetchAdApiAccounts,
  getCachedAdAccountApiMappings,
  getCachedAdApiAccounts,
  removeAdAccountApiMapping,
  saveAdApiAccount,
  saveAdAccountApiMapping,
  upsertAdApiAccounts,
  type AdAccountApiMapping,
  type AdApiAccount,
  type AdsPlatformKey,
} from '@/app/services/adApiIntegrationService';

interface AdAccountTabProps {
  currentRole: Role;
  setPageNotices?: (notices: NoticeItem[]) => void;
}

type AccountView = 'all' | 'api' | 'live' | 'unmatched' | 'assignment' | 'cs-relations' | 'advertiser-relations';

export const AdAccountTab: React.FC<AdAccountTabProps> = ({ currentRole: _currentRole, setPageNotices }) => {
  const {
    adAccounts,
    adAccountAssignments,
    adAccountOwnerAssignments,
    platforms,
    subChannels,
    users,
    addAdAccount,
    updateAdAccount,
    deleteAdAccount,
    assignAdAccountCs,
    assignAdAccountOwner,
  } = useMasterData();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [accountView, setAccountView] = useState<AccountView>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdAccount | null>(null);
  const [deletingItem, setDeletingItem] = useState<AdAccount | null>(null);
  const [statusToggleItem, setStatusToggleItem] = useState<AdAccount | null>(null);
  const [bulkStatusTarget, setBulkStatusTarget] = useState<AdAccount['status'] | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [isBulkSelectMode, setIsBulkSelectMode] = useState(false);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [bulkStatusSaving, setBulkStatusSaving] = useState(false);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [historyItem, setHistoryItem] = useState<AdAccount | null>(null);
  const [relationDetail, setRelationDetail] = useState<{
    type: 'cs' | 'advertiser';
    title: string;
    subtitle: string;
    accounts: AdAccount[];
  } | null>(null);
  const [liveMetaData, setLiveMetaData] = useState<MetaLiveBreakdownResponse | null>(
    () => getCachedMetaLiveRegistry(),
  );
  const [liveGoogleData, setLiveGoogleData] = useState<GoogleAdsLiveBreakdownResponse | null>(
    () => getCachedGoogleAdsLiveRegistry(),
  );
  const [liveTikTokAdvertisers, setLiveTikTokAdvertisers] = useState<TikTokAdvertiser[]>(
    () => getCachedTikTokAdvertisers(),
  );
  const [liveTikTokBusinessCenters, setLiveTikTokBusinessCenters] = useState<TikTokBusinessCenter[]>(
    () => getCachedTikTokBusinessCenters(),
  );
  const [liveMetaLoading, setLiveMetaLoading] = useState(false);
  const [liveGoogleLoading, setLiveGoogleLoading] = useState(false);
  const [liveTikTokLoading, setLiveTikTokLoading] = useState(false);
  const [liveMetaError, setLiveMetaError] = useState<string | null>(null);
  const [liveGoogleError, setLiveGoogleError] = useState<string | null>(null);
  const [liveTikTokError, setLiveTikTokError] = useState<string | null>(null);
  const [integrationConfigs, setIntegrationConfigs] = useState<Record<string, AdsIntegrationConfig>>({});
  const [googleIntegrationConfigs, setGoogleIntegrationConfigs] = useState<
    Record<string, GoogleAdsIntegrationConfig>
  >({});
  const [tiktokIntegrationConfigs, setTikTokIntegrationConfigs] = useState<
    Record<string, TikTokAdsIntegrationConfig>
  >({});
  const [savingConfigId, setSavingConfigId] = useState<string | null>(null);
  const [assignmentDialogItem, setAssignmentDialogItem] = useState<AdAccount | null>(null);
  const [assignmentCsId, setAssignmentCsId] = useState('');
  const [assignmentSubChannelId, setAssignmentSubChannelId] = useState('none');
  const [assignmentStartDate, setAssignmentStartDate] = useState(() => getTodayDateKey());
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [ownerDialogItem, setOwnerDialogItem] = useState<AdAccount | null>(null);
  const [ownerAdvertiserId, setOwnerAdvertiserId] = useState('');
  const [ownerStartDate, setOwnerStartDate] = useState(() => getTodayDateKey());
  const [ownerNotes, setOwnerNotes] = useState('');
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [apiAccounts, setApiAccounts] = useState<AdApiAccount[]>(() => getCachedAdApiAccounts());
  const [apiMappings, setApiMappings] = useState<AdAccountApiMapping[]>(() => getCachedAdAccountApiMappings());
  const [apiSyncing, setApiSyncing] = useState(false);
  const [apiMappingDialogAccount, setApiMappingDialogAccount] = useState<AdApiAccount | null>(null);
  const [apiMappingInternalId, setApiMappingInternalId] = useState('');
  const [apiMappingNotes, setApiMappingNotes] = useState('');
  const [apiMappingSaving, setApiMappingSaving] = useState(false);
  const [apiAccountDialogItem, setApiAccountDialogItem] = useState<AdApiAccount | null>(null);
  const [isApiAccountDialogOpen, setIsApiAccountDialogOpen] = useState(false);
  const [apiAccountPlatformKey, setApiAccountPlatformKey] = useState<AdsPlatformKey>('meta');
  const [apiAccountExternalId, setApiAccountExternalId] = useState('');
  const [apiAccountExternalName, setApiAccountExternalName] = useState('');
  const [apiAccountGroupId, setApiAccountGroupId] = useState('');
  const [apiAccountGroupName, setApiAccountGroupName] = useState('');
  const [apiAccountStatus, setApiAccountStatus] = useState('manual');
  const [apiAccountCurrency, setApiAccountCurrency] = useState('IDR');
  const [selectedBackendApiKey, setSelectedBackendApiKey] = useState('manual-entry');
  const [apiAccountInternalId, setApiAccountInternalId] = useState('none');
  const [apiAccountSaving, setApiAccountSaving] = useState(false);
  const [apiDeletingAccount, setApiDeletingAccount] = useState<AdApiAccount | null>(null);

  const isApiAccountFormDirty = useMemo(() => {
    if (!isApiAccountDialogOpen) return false;
    if (apiAccountDialogItem) {
      return (
        apiAccountPlatformKey !== apiAccountDialogItem.platformKey ||
        apiAccountExternalId !== apiAccountDialogItem.externalAccountId ||
        apiAccountExternalName !== apiAccountDialogItem.externalAccountName ||
        apiAccountGroupId !== (apiAccountDialogItem.externalGroupId || '') ||
        apiAccountGroupName !== (apiAccountDialogItem.externalGroupName || '') ||
        apiAccountStatus !== (apiAccountDialogItem.externalAccountStatus || 'manual') ||
        apiAccountCurrency !== (apiAccountDialogItem.currencyCode || 'IDR')
      );
    }

    return (
      selectedBackendApiKey !== 'manual-entry' ||
      apiAccountInternalId !== 'none' ||
      apiAccountPlatformKey !== 'meta' ||
      Boolean(apiAccountExternalId.trim()) ||
      Boolean(apiAccountExternalName.trim()) ||
      Boolean(apiAccountGroupId.trim()) ||
      Boolean(apiAccountGroupName.trim()) ||
      apiAccountStatus !== 'manual' ||
      apiAccountCurrency !== 'IDR'
    );
  }, [
    apiAccountCurrency,
    apiAccountDialogItem,
    apiAccountExternalId,
    apiAccountExternalName,
    apiAccountGroupId,
    apiAccountGroupName,
    apiAccountInternalId,
    apiAccountPlatformKey,
    apiAccountStatus,
    isApiAccountDialogOpen,
    selectedBackendApiKey,
  ]);
  const isApiMappingFormDirty = Boolean(apiMappingInternalId || apiMappingNotes.trim());
  const isOwnerFormDirty = Boolean(ownerAdvertiserId || ownerNotes.trim() || ownerStartDate !== getTodayDateKey());
  const isAssignmentFormDirty = Boolean(assignmentCsId || assignmentNotes.trim() || assignmentStartDate !== getTodayDateKey());

  const closeApiAccountDialog = React.useCallback(() => {
    setIsApiAccountDialogOpen(false);
    setApiAccountDialogItem(null);
    setApiAccountInternalId('none');
  }, []);

  const apiAccountCloseGuard = useMasterDataFormCloseGuard({
    hasUnsavedChanges: isApiAccountFormDirty,
    onClose: closeApiAccountDialog,
  });

  const closeApiMappingDialog = React.useCallback(() => {
    setApiMappingDialogAccount(null);
  }, []);

  const apiMappingCloseGuard = useMasterDataFormCloseGuard({
    hasUnsavedChanges: isApiMappingFormDirty,
    onClose: closeApiMappingDialog,
  });

  const closeOwnerDialog = React.useCallback(() => {
    setOwnerDialogItem(null);
  }, []);

  const ownerCloseGuard = useMasterDataFormCloseGuard({
    hasUnsavedChanges: isOwnerFormDirty,
    onClose: closeOwnerDialog,
  });

  const closeAssignmentDialog = React.useCallback(() => {
    setAssignmentDialogItem(null);
  }, []);

  const assignmentCloseGuard = useMasterDataFormCloseGuard({
    hasUnsavedChanges: isAssignmentFormDirty,
    onClose: closeAssignmentDialog,
  });

  useEffect(() => {
    setPageNotices?.([
      ...(liveMetaError
        ? [{
            id: 'live-meta',
            tone: liveMetaData?.cacheStatus === 'stale' ? 'warning' as const : 'danger' as const,
            message: `Live Meta sedang tidak aktif: ${liveMetaError}`,
          }]
        : []),
      ...(liveGoogleError
        ? [{
            id: 'live-google',
            tone: liveGoogleData?.cacheStatus === 'stale' ? 'warning' as const : 'danger' as const,
            message: `Live Google Ads sedang tidak aktif: ${liveGoogleError}`,
          }]
        : []),
      ...(liveTikTokError
        ? [{
            id: 'live-tiktok',
            tone: 'danger' as const,
            message: `Live TikTok Ads sedang tidak aktif: ${liveTikTokError}`,
          }]
        : []),
    ]);

    return () => setPageNotices?.([]);
  }, [
    liveGoogleData?.cacheStatus,
    liveGoogleError,
    liveMetaData?.cacheStatus,
    liveMetaError,
    liveTikTokError,
    setPageNotices,
  ]);

  const canCreate = hasPermission('master_data.create');
  const canEdit = hasPermission('master_data.edit');
  const canDelete = hasPermission('master_data.delete');

  const closeFormDialog = React.useCallback(() => {
    setIsFormDirty(false);
    setIsAddOpen(false);
  }, []);

  const formCloseGuard = useMasterDataFormCloseGuard({
    hasUnsavedChanges: isFormDirty,
    onClose: closeFormDialog,
  });

  const requestFormDialogOpenChange = (open: boolean) => {
    if (open) {
      setIsAddOpen(true);
      return;
    }
    formCloseGuard.requestClose();
  };

  const advertisers = useMemo(() => {
    const activeAdvertisers = users.filter(u => isAdvertiserRole(u.role) && u.status === 'active');
    const referencedAdvertiserIds = new Set([
      ...adAccounts.map((account) => account.advertiserId).filter(Boolean),
      ...adAccountOwnerAssignments.map((assignment) => assignment.advertiserId).filter(Boolean),
      ownerAdvertiserId,
    ]);
    const referencedInactiveAdvertisers = users.filter(
      (user) =>
        isAdvertiserRole(user.role) &&
        referencedAdvertiserIds.has(user.id) &&
        !activeAdvertisers.some((activeUser) => activeUser.id === user.id),
    );

    return [...activeAdvertisers, ...referencedInactiveAdvertisers].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [adAccountOwnerAssignments, adAccounts, ownerAdvertiserId, users]);
  const csUsers = users.filter(u => isCsRole(u.role) && u.status === 'active');
  const activePlatforms = platforms.filter(p => p.status === 'active');
  const isMetaPlatformName = (name: string) => name.toLowerCase().replace(/\s+/g, '').includes('meta');
  const isGooglePlatformName = (name: string) => name.toLowerCase().replace(/\s+/g, '').includes('google');
  const isTikTokPlatformName = (name: string) => name.toLowerCase().replace(/\s+/g, '').includes('tiktok');
  const getPlatformKeyByName = (name: string): AdsPlatformKey | null => {
    if (isGooglePlatformName(name)) return 'google';
    if (isTikTokPlatformName(name)) return 'tiktok';
    if (isMetaPlatformName(name) || name.toLowerCase().includes('facebook')) return 'meta';
    return null;
  };
  const metaPlatform = platforms.find(p => isMetaPlatformName(p.name));
  const googlePlatform = platforms.find(p => isGooglePlatformName(p.name));
  const tiktokPlatform = platforms.find(p => isTikTokPlatformName(p.name));

  const getPlatformName = (id: string) => platforms.find(p => p.id === id)?.name || 'Unknown';
  const getPlatform = (id: string) => platforms.find(p => p.id === id);
  const getPlatformByKey = (key: AdsPlatformKey) => {
    if (key === 'google') return googlePlatform;
    if (key === 'tiktok') return tiktokPlatform;
    return metaPlatform;
  };
  const getPlatformLabelByKey = (key: AdsPlatformKey) =>
    getPlatformByKey(key)?.name || (key === 'google' ? 'Google Ads' : key === 'tiktok' ? 'TikTok Ads' : 'Meta Ads');
  const getAdvertiserName = (id: string) => users.find(u => u.id === id)?.name || 'Unknown';
  const getUserName = (id?: string | null) => users.find(u => u.id === id)?.name || 'Belum diset';
  const getSubChannelName = (id?: string | null) => subChannels.find(s => s.id === id)?.name || '-';
  const formatAssignmentPeriod = (startDate: string, endDate?: string | null) =>
    `${startDate} - ${endDate || 'Sekarang'}`;
  const normalizeLookupKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const getTrailingNumberKey = (value: string) => value.match(/(\d+)\s*$/)?.[1] || '';
  const buildFlexibleLookupKeys = React.useCallback((value: string) => {
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
  }, []);
  const todayKey = getTodayDateKey();

  const getActiveAssignment = React.useCallback(
    (adAccountId: string, date = todayKey) =>
      adAccountAssignments
        .filter((assignment) =>
          assignment.adAccountId === adAccountId &&
          assignment.status === 'active' &&
          assignment.startDate <= date &&
          (!assignment.endDate || assignment.endDate >= date)
        )
        .sort((left, right) => right.startDate.localeCompare(left.startDate))[0],
    [adAccountAssignments, todayKey],
  );

  const getActiveOwnerAssignment = React.useCallback(
    (adAccountId: string, date = todayKey) =>
      adAccountOwnerAssignments
        .filter((assignment) =>
          assignment.adAccountId === adAccountId &&
          assignment.status === 'active' &&
          assignment.startDate <= date &&
          (!assignment.endDate || assignment.endDate >= date)
        )
        .sort((left, right) => right.startDate.localeCompare(left.startDate))[0],
    [adAccountOwnerAssignments, todayKey],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [configs, googleConfigs, tiktokConfigs, storedApiAccounts, storedApiMappings] = await Promise.all([
        fetchAdsIntegrationConfigs(),
        fetchGoogleAdsIntegrationConfigs(),
        fetchTikTokAdsIntegrationConfigs(),
        fetchAdApiAccounts(),
        fetchAdAccountApiMappings(),
      ]);
      if (!cancelled) {
        setIntegrationConfigs(
          configs.reduce<Record<string, AdsIntegrationConfig>>((acc, config) => {
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
          tiktokConfigs.reduce<Record<string, TikTokAdsIntegrationConfig>>(
            (acc, config) => {
              acc[config.adAccountId] = config;
              return acc;
            },
            {},
          ),
        );
        setApiAccounts(storedApiAccounts);
        setApiMappings(storedApiMappings);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadMetaRegistry = React.useCallback(async () => {
    if (!metaPlatform) return null;

    setLiveMetaLoading(true);
    try {
      const today = new Date();
      const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const to = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const payload = await fetchMetaLiveBreakdown({ from, to });
      setLiveMetaData(payload);
      setLiveMetaError(payload.cacheStatus === 'stale' ? payload.cacheMessage || null : null);
      return payload;
    } catch (error) {
      setLiveMetaError(error instanceof Error ? error.message : 'Gagal memuat registry Meta live.');
      return null;
    } finally {
      setLiveMetaLoading(false);
    }
  }, [metaPlatform]);

  useEffect(() => {
    void loadMetaRegistry();
  }, [loadMetaRegistry]);

  const loadGoogleRegistry = React.useCallback(async () => {
    if (!googlePlatform) return null;

    setLiveGoogleLoading(true);
    try {
      const today = new Date();
      const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const to = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const payload = await fetchGoogleAdsLiveBreakdown({ from, to });
      setLiveGoogleData(payload);
      setLiveGoogleError(payload.cacheStatus === 'stale' ? payload.cacheMessage || null : null);
      return payload;
    } catch (error) {
      setLiveGoogleError(
        error instanceof Error ? error.message : 'Gagal memuat registry Google Ads live.',
      );
      return null;
    } finally {
      setLiveGoogleLoading(false);
    }
  }, [googlePlatform]);

  useEffect(() => {
    void loadGoogleRegistry();
  }, [loadGoogleRegistry]);

  const loadTikTokRegistry = React.useCallback(async () => {
    if (!tiktokPlatform) return null;

    setLiveTikTokLoading(true);
    try {
      const [businessCenters, advertisers] = await Promise.all([
        fetchTikTokBusinessCenters(),
        fetchTikTokAdvertisers(),
      ]);
      setLiveTikTokBusinessCenters(businessCenters);
      setLiveTikTokAdvertisers(advertisers);
      setLiveTikTokError(null);
      return advertisers;
    } catch (error) {
      setLiveTikTokError(
        error instanceof Error ? error.message : 'Gagal memuat registry TikTok Ads live.',
      );
      return null;
    } finally {
      setLiveTikTokLoading(false);
    }
  }, [tiktokPlatform]);

  useEffect(() => {
    void loadTikTokRegistry();
  }, [loadTikTokRegistry]);

  const liveMetaAccountByName = useMemo(() => {
    const map = new Map<string, MetaLiveBreakdownResponse['accounts'][number]>();
    for (const account of liveMetaData?.accounts || []) {
      for (const key of buildFlexibleLookupKeys(account.name)) {
        map.set(key, account);
      }
    }
    return map;
  }, [buildFlexibleLookupKeys, liveMetaData]);

  const liveMetaAccountByUniqueNumber = useMemo(() => {
    const map = new Map<string, MetaLiveBreakdownResponse['accounts'][number]>();
    const duplicateKeys = new Set<string>();

    for (const account of liveMetaData?.accounts || []) {
      const key = getTrailingNumberKey(account.name);
      if (!key) continue;
      if (map.has(key)) {
        duplicateKeys.add(key);
        map.delete(key);
        continue;
      }
      if (!duplicateKeys.has(key)) {
        map.set(key, account);
      }
    }

    return map;
  }, [liveMetaData]);

  const liveGoogleAccountByCustomerId = useMemo(() => {
    const map = new Map<string, GoogleAdsLiveBreakdownResponse['accounts'][number]>();
    for (const account of liveGoogleData?.accounts || []) {
      map.set(account.customerId, account);
    }
    return map;
  }, [liveGoogleData]);

  const liveGoogleAccountByName = useMemo(() => {
    const map = new Map<string, GoogleAdsLiveBreakdownResponse['accounts'][number]>();
    for (const account of liveGoogleData?.accounts || []) {
      map.set(normalizeLookupKey(account.name || account.customerName), account);
      map.set(normalizeLookupKey(account.customerName || account.name), account);
    }
    return map;
  }, [liveGoogleData]);

  const liveTikTokAdvertiserById = useMemo(() => {
    const map = new Map<string, TikTokAdvertiser>();
    for (const advertiser of liveTikTokAdvertisers) {
      map.set(advertiser.advertiserId, advertiser);
    }
    return map;
  }, [liveTikTokAdvertisers]);

  const liveTikTokAdvertiserByName = useMemo(() => {
    const map = new Map<string, TikTokAdvertiser>();
    for (const advertiser of liveTikTokAdvertisers) {
      for (const key of buildFlexibleLookupKeys(advertiser.advertiserName)) {
        map.set(key, advertiser);
      }
    }
    return map;
  }, [buildFlexibleLookupKeys, liveTikTokAdvertisers]);

  const liveTikTokBusinessCenterById = useMemo(() => {
    const map = new Map<string, TikTokBusinessCenter>();
    for (const businessCenter of liveTikTokBusinessCenters) {
      map.set(businessCenter.bcId, businessCenter);
    }
    return map;
  }, [liveTikTokBusinessCenters]);

  const activeApiMappingByInternalAccountId = useMemo(() => {
    const map = new Map<string, AdAccountApiMapping>();
    for (const mapping of apiMappings) {
      if (mapping.status !== 'active') continue;
      map.set(mapping.internalAdAccountId, mapping);
    }
    return map;
  }, [apiMappings]);

  const apiAccountByProviderExternalId = useMemo(() => {
    const map = new Map<string, AdApiAccount>();
    for (const account of apiAccounts) {
      map.set(`${account.platformKey}:${account.externalAccountId}`, account);
    }
    return map;
  }, [apiAccounts]);

  const getMappedApiAccountForInternal = React.useCallback(
    (internalAdAccountId: string) => {
      const mapping = activeApiMappingByInternalAccountId.get(internalAdAccountId);
      if (!mapping) return null;
      return (
        apiAccountByProviderExternalId.get(`${mapping.platformKey}:${mapping.externalAccountId}`) ||
        null
      );
    },
    [activeApiMappingByInternalAccountId, apiAccountByProviderExternalId],
  );

  const getBusinessManagerLabel = React.useCallback(
    (item: AdAccount) => {
      const mappedApiAccount = getMappedApiAccountForInternal(item.id);
      if (mappedApiAccount) {
        return mappedApiAccount.externalGroupName || 'Tanpa Business / Manager';
      }

      const platformName = getPlatformName(item.platformId);

      if (isGooglePlatformName(platformName)) {
        const googleConfig = googleIntegrationConfigs[item.id];
        const liveGoogleAccount =
          (googleConfig?.liveGoogleCustomerId
            ? liveGoogleAccountByCustomerId.get(googleConfig.liveGoogleCustomerId)
            : undefined) || liveGoogleAccountByName.get(normalizeLookupKey(item.accountName));

        return (
          googleConfig?.managerCustomerName ||
          liveGoogleAccount?.managerCustomerName ||
          'Belum match live'
        );
      }

      if (isTikTokPlatformName(platformName)) {
        const tiktokConfig = tiktokIntegrationConfigs[item.id];
        const liveTikTokAdvertiser =
          (tiktokConfig?.liveTikTokAdvertiserId
            ? liveTikTokAdvertiserById.get(tiktokConfig.liveTikTokAdvertiserId)
            : undefined) ||
          buildFlexibleLookupKeys(item.accountName).reduce<TikTokAdvertiser | undefined>(
            (current, key) => current || liveTikTokAdvertiserByName.get(key),
            undefined,
          );

        return (
          tiktokConfig?.businessCenterName ||
          (liveTikTokAdvertiser?.bcId
            ? liveTikTokBusinessCenterById.get(liveTikTokAdvertiser.bcId)?.bcName
            : undefined) ||
          liveTikTokAdvertiser?.bcName ||
          (liveTikTokAdvertiser ? 'Tanpa Business Center' : undefined) ||
          'Belum match live'
        );
      }

      return (
        buildFlexibleLookupKeys(item.accountName).reduce<
          MetaLiveBreakdownResponse['accounts'][number] | undefined
        >((current, key) => current || liveMetaAccountByName.get(key), undefined)?.businessName ||
        (getTrailingNumberKey(item.accountName)
          ? liveMetaAccountByUniqueNumber.get(getTrailingNumberKey(item.accountName))?.businessName
          : undefined) ||
        integrationConfigs[item.id]?.businessManagerName ||
        'Belum match live'
      );
    },
    [
      getPlatformName,
      getMappedApiAccountForInternal,
      googleIntegrationConfigs,
      integrationConfigs,
      isGooglePlatformName,
      isTikTokPlatformName,
      buildFlexibleLookupKeys,
      liveGoogleAccountByCustomerId,
      liveGoogleAccountByName,
      liveMetaAccountByName,
      liveMetaAccountByUniqueNumber,
      liveTikTokAdvertiserById,
      liveTikTokAdvertiserByName,
      liveTikTokBusinessCenterById,
      tiktokIntegrationConfigs,
    ],
  );

  const isIntegrationEnabled = React.useCallback(
    (item: AdAccount) => {
      const mapped = apiMappings.some((mapping) =>
        mapping.status === 'active' &&
        mapping.internalAdAccountId === item.id
      );
      if (mapped) return true;

      const platformName = getPlatformName(item.platformId);
      if (isGooglePlatformName(platformName)) {
        return googleIntegrationConfigs[item.id]?.enabled ?? false;
      }

      if (isTikTokPlatformName(platformName)) {
        return tiktokIntegrationConfigs[item.id]?.enabled ?? false;
      }

      return integrationConfigs[item.id]?.enabled ?? false;
    },
    [
      apiMappings,
      getPlatformName,
      googleIntegrationConfigs,
      integrationConfigs,
      isGooglePlatformName,
      isTikTokPlatformName,
      tiktokIntegrationConfigs,
    ],
  );

  const hasLiveMapping = React.useCallback(
    (item: AdAccount) => {
      const mapped = apiMappings.some((mapping) =>
        mapping.status === 'active' &&
        mapping.internalAdAccountId === item.id
      );
      if (mapped) return true;

      const platformName = getPlatformName(item.platformId);
      if (isGooglePlatformName(platformName)) {
        const config = googleIntegrationConfigs[item.id];
        return Boolean(config?.enabled && config.liveGoogleCustomerId);
      }

      if (isTikTokPlatformName(platformName)) {
        const config = tiktokIntegrationConfigs[item.id];
        return Boolean(config?.enabled && config.liveTikTokAdvertiserId);
      }

      const config = integrationConfigs[item.id];
      return Boolean(config?.enabled && config.liveMetaAccountId);
    },
    [
      apiMappings,
      getPlatformName,
      googleIntegrationConfigs,
      integrationConfigs,
      isGooglePlatformName,
      isTikTokPlatformName,
      tiktokIntegrationConfigs,
    ],
  );

  const isUnmatchedAccount = React.useCallback(
    (item: AdAccount) => getBusinessManagerLabel(item) === 'Belum match live',
    [getBusinessManagerLabel],
  );

  const hasAssignmentIssue = React.useCallback(
    (item: AdAccount) => !getActiveOwnerAssignment(item.id) || !getActiveAssignment(item.id),
    [getActiveAssignment, getActiveOwnerAssignment],
  );

  const rawFilteredData = adAccounts.filter(item => {
    const activeAssignment = getActiveAssignment(item.id);
    const activeOwner = getActiveOwnerAssignment(item.id);
    const searchText = [
      item.accountName,
      getPlatformName(item.platformId),
      getSubChannelName(item.subChannelId || activeAssignment?.subChannelId),
      getAdvertiserName(activeOwner?.advertiserId || item.advertiserId),
      getUserName(activeAssignment?.csId),
      getBusinessManagerLabel(item),
    ].join(' ').toLowerCase();

    return searchText.includes(search.toLowerCase());
  });

  const liveRegistryRows = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();
    return (liveMetaData?.accounts || [])
      .map((account) => {
        const matchedMaster = adAccounts.find(
          item => normalizeLookupKey(item.accountName) === normalizeLookupKey(account.name),
        );

        return {
          ...account,
          matchedMaster,
        };
      })
      .filter((row) => {
        if (!lowerSearch) return true;
        return (
          row.name.toLowerCase().includes(lowerSearch) ||
          row.businessName.toLowerCase().includes(lowerSearch) ||
          (row.matchedMaster?.accountName || '').toLowerCase().includes(lowerSearch) ||
          getAdvertiserName(row.matchedMaster?.advertiserId || '').toLowerCase().includes(lowerSearch)
        );
      })
      .sort((left, right) => right.spend - left.spend);
  }, [adAccounts, getAdvertiserName, liveMetaData, search]);

  const registryApiAccounts = useMemo<AdApiAccount[]>(() => {
    const syncedAt = new Date().toISOString();
    const metaRows: AdApiAccount[] = (liveMetaData?.accounts || []).map((account) => ({
      id: `meta:${account.id}`,
      platformKey: 'meta',
      externalAccountId: account.id,
      externalAccountName: account.name,
      externalGroupId: account.businessId,
      externalGroupName: account.businessName,
      externalAccountStatus: account.accountStatus !== null ? String(account.accountStatus) : null,
      currencyCode: account.currency,
      raw: account as unknown as Record<string, unknown>,
      lastSyncedAt: syncedAt,
    }));

    const googleRows: AdApiAccount[] = (liveGoogleData?.accounts || []).map((account) => ({
      id: `google:${account.customerId}`,
      platformKey: 'google',
      externalAccountId: account.customerId,
      externalAccountName: account.customerName || account.name,
      externalGroupId: account.managerCustomerId,
      externalGroupName: account.managerCustomerName,
      externalAccountStatus: account.status,
      currencyCode: account.currencyCode,
      raw: account as unknown as Record<string, unknown>,
      lastSyncedAt: syncedAt,
    }));

    const tiktokRows: AdApiAccount[] = liveTikTokAdvertisers.map((advertiser) => ({
      id: `tiktok:${advertiser.advertiserId}`,
      platformKey: 'tiktok',
      externalAccountId: advertiser.advertiserId,
      externalAccountName: advertiser.advertiserName,
      externalGroupId: advertiser.bcId,
      externalGroupName: advertiser.bcName,
      externalAccountStatus: advertiser.status,
      currencyCode: advertiser.currency,
      raw: advertiser as unknown as Record<string, unknown>,
      lastSyncedAt: syncedAt,
    }));

    return [...metaRows, ...googleRows, ...tiktokRows];
  }, [liveGoogleData, liveMetaData, liveTikTokAdvertisers]);

  const registryApiAccountSignature = useMemo(
    () => registryApiAccounts.map((account) => `${account.platformKey}:${account.externalAccountId}`).sort().join('|'),
    [registryApiAccounts],
  );

  useEffect(() => {
    if (!registryApiAccountSignature) return;

    let cancelled = false;
    const sync = async () => {
      setApiSyncing(true);
      try {
        const rows = await upsertAdApiAccounts(registryApiAccounts);
        if (!cancelled) setApiAccounts(rows);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Gagal menyimpan registry API Ads.');
      } finally {
        if (!cancelled) setApiSyncing(false);
      }
    };

    void sync();
    return () => {
      cancelled = true;
    };
  }, [registryApiAccountSignature]);

  const allApiAccounts = useMemo(() => {
    const map = new Map<string, AdApiAccount>();
    for (const account of apiAccounts) {
      map.set(`${account.platformKey}:${account.externalAccountId}`, account);
    }
    for (const account of registryApiAccounts) {
      const existing = map.get(`${account.platformKey}:${account.externalAccountId}`);
      map.set(`${account.platformKey}:${account.externalAccountId}`, {
        ...account,
        id: existing?.id || account.id,
      });
    }
    return Array.from(map.values()).sort((left, right) =>
      left.platformKey.localeCompare(right.platformKey) ||
      left.externalAccountName.localeCompare(right.externalAccountName),
    );
  }, [apiAccounts, registryApiAccounts]);

  const legacyIntegrationPairs = useMemo(() => {
    const pairs: Array<{ internalAdAccountId: string; apiAccount: AdApiAccount }> = [];
    const syncedAt = new Date().toISOString();

    for (const account of adAccounts) {
      const platformName = getPlatformName(account.platformId);

      if (isGooglePlatformName(platformName)) {
        const config = googleIntegrationConfigs[account.id];
        if (!config?.enabled || !config.liveGoogleCustomerId) continue;
        pairs.push({
          internalAdAccountId: account.id,
          apiAccount: {
            id: `legacy-google:${config.liveGoogleCustomerId}`,
            platformKey: 'google',
            externalAccountId: config.liveGoogleCustomerId,
            externalAccountName: config.liveGoogleCustomerName || account.accountName,
            externalGroupId: config.managerCustomerId || null,
            externalGroupName: config.managerCustomerName || null,
            externalAccountStatus: config.enabled ? 'ENABLED' : 'DISABLED',
            currencyCode: 'IDR',
            raw: { source: 'legacy-integration-config' },
            lastSyncedAt: syncedAt,
          },
        });
        continue;
      }

      if (isTikTokPlatformName(platformName)) {
        const config = tiktokIntegrationConfigs[account.id];
        if (!config?.enabled || !config.liveTikTokAdvertiserId) continue;
        pairs.push({
          internalAdAccountId: account.id,
          apiAccount: {
            id: `legacy-tiktok:${config.liveTikTokAdvertiserId}`,
            platformKey: 'tiktok',
            externalAccountId: config.liveTikTokAdvertiserId,
            externalAccountName: config.liveTikTokAdvertiserName || account.accountName,
            externalGroupId: config.businessCenterId || null,
            externalGroupName: config.businessCenterName || null,
            externalAccountStatus: config.enabled ? 'ENABLED' : 'DISABLED',
            currencyCode: 'IDR',
            raw: { source: 'legacy-integration-config' },
            lastSyncedAt: syncedAt,
          },
        });
        continue;
      }

      const config = integrationConfigs[account.id];
      if (!config?.enabled || !config.liveMetaAccountId) continue;
      pairs.push({
        internalAdAccountId: account.id,
        apiAccount: {
          id: `legacy-meta:${config.liveMetaAccountId}`,
          platformKey: 'meta',
          externalAccountId: config.liveMetaAccountId,
          externalAccountName: config.liveMetaAccountName || account.accountName,
          externalGroupId: config.businessManagerId || null,
          externalGroupName: config.businessManagerName || null,
          externalAccountStatus: config.enabled ? 'ENABLED' : 'DISABLED',
          currencyCode: 'IDR',
          raw: { source: 'legacy-integration-config' },
          lastSyncedAt: syncedAt,
        },
      });
    }

    return pairs;
  }, [
    adAccounts,
    getPlatformName,
    googleIntegrationConfigs,
    integrationConfigs,
    isGooglePlatformName,
    isTikTokPlatformName,
    tiktokIntegrationConfigs,
  ]);

  const legacyIntegrationSignature = useMemo(
    () => legacyIntegrationPairs
      .map((pair) => `${pair.internalAdAccountId}:${pair.apiAccount.platformKey}:${pair.apiAccount.externalAccountId}`)
      .sort()
      .join('|'),
    [legacyIntegrationPairs],
  );

  useEffect(() => {
    if (!legacyIntegrationSignature) return;

    let cancelled = false;
    const mirrorLegacyConfigs = async () => {
      try {
        const storedAccounts = await upsertAdApiAccounts(legacyIntegrationPairs.map((pair) => pair.apiAccount));
        if (cancelled) return;
        setApiAccounts(storedAccounts);

        const accountByExternalKey = new Map(
          storedAccounts.map((account) => [`${account.platformKey}:${account.externalAccountId}`, account]),
        );

        const missingPairs = legacyIntegrationPairs.filter((pair) => {
          return !apiMappings.some((mapping) =>
            mapping.status === 'active' &&
            mapping.internalAdAccountId === pair.internalAdAccountId &&
            mapping.platformKey === pair.apiAccount.platformKey &&
            mapping.externalAccountId === pair.apiAccount.externalAccountId
          );
        });

        if (missingPairs.length === 0) return;

        const savedMappings = await Promise.all(
          missingPairs.map((pair) => {
            const storedAccount =
              accountByExternalKey.get(`${pair.apiAccount.platformKey}:${pair.apiAccount.externalAccountId}`) ||
              pair.apiAccount;

            return saveAdAccountApiMapping({
              internalAdAccountId: pair.internalAdAccountId,
              apiAccount: storedAccount,
              notes: 'Migrasi otomatis dari config integrasi lama.',
            });
          }),
        );

        if (cancelled) return;
        setApiMappings(prev => [
          ...savedMappings,
          ...prev.filter((mapping) =>
            !savedMappings.some((saved) =>
              saved.internalAdAccountId === mapping.internalAdAccountId ||
              (saved.platformKey === mapping.platformKey && saved.externalAccountId === mapping.externalAccountId)
            )
          ),
        ]);
      } catch (error) {
        console.warn('[AdAccountTab] gagal mirror config integrasi lama', error);
      }
    };

    void mirrorLegacyConfigs();
    return () => {
      cancelled = true;
    };
  }, [legacyIntegrationSignature]);

  const getApiMappingForAccount = React.useCallback(
    (account: AdApiAccount) =>
      apiMappings.find((mapping) =>
        mapping.status === 'active' &&
        mapping.platformKey === account.platformKey &&
        mapping.externalAccountId === account.externalAccountId
      ),
    [apiMappings],
  );

  const getApiMappingForInternalAccount = React.useCallback(
    (internalAdAccountId: string) =>
      apiMappings.find((mapping) =>
        mapping.status === 'active' &&
        mapping.internalAdAccountId === internalAdAccountId
      ),
    [apiMappings],
  );

  const getInternalAdAccount = React.useCallback(
    (id?: string | null) => adAccounts.find((account) => account.id === id),
    [adAccounts],
  );

  const apiFilteredAccounts = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();
    return allApiAccounts.filter((account) => {
      const mapping = getApiMappingForAccount(account);
      if (!mapping) return false;

      if (!lowerSearch) return true;
      const internalAccount = getInternalAdAccount(mapping?.internalAdAccountId);
      return (
        getPlatformLabelByKey(account.platformKey).toLowerCase().includes(lowerSearch) ||
        account.externalAccountName.toLowerCase().includes(lowerSearch) ||
        account.externalAccountId.toLowerCase().includes(lowerSearch) ||
        (account.externalGroupName || '').toLowerCase().includes(lowerSearch) ||
        (internalAccount?.accountName || '').toLowerCase().includes(lowerSearch)
      );
    });
  }, [allApiAccounts, getApiMappingForAccount, getInternalAdAccount, search]);

  const apiMappingCandidates = useMemo(() => {
    if (!apiMappingDialogAccount) return [];
    return adAccounts
      .filter((account) => {
        const platformName = getPlatformName(account.platformId);
        if (apiMappingDialogAccount.platformKey === 'google') return isGooglePlatformName(platformName);
        if (apiMappingDialogAccount.platformKey === 'tiktok') return isTikTokPlatformName(platformName);
        return isMetaPlatformName(platformName) || platformName.toLowerCase().includes('facebook');
      })
      .sort((left, right) => left.accountName.localeCompare(right.accountName));
  }, [adAccounts, apiMappingDialogAccount, getPlatformName, isGooglePlatformName, isTikTokPlatformName]);

  const apiAccountBackendOptions = useMemo(
    () => allApiAccounts
      .filter((account) => account.externalAccountId && account.externalAccountName)
      .sort((left, right) =>
        left.platformKey.localeCompare(right.platformKey) ||
        left.externalAccountName.localeCompare(right.externalAccountName),
      ),
    [allApiAccounts],
  );

  const apiAccountStatusOptions = useMemo(
    () => Array.from(new Set([
      'manual',
      'ENABLED',
      'DISABLED',
      'PAUSED',
      'UNKNOWN',
      ...allApiAccounts.map((account) => account.externalAccountStatus || '').filter(Boolean),
    ])),
    [allApiAccounts],
  );

  const apiAccountCurrencyOptions = useMemo(
    () => Array.from(new Set([
      'IDR',
      'USD',
      'MYR',
      'SGD',
      ...allApiAccounts.map((account) => account.currencyCode || '').filter(Boolean),
    ])),
    [allApiAccounts],
  );

  const apiPlatformOptions = useMemo(() => {
    const masterOptions = activePlatforms
      .map((platform) => {
        const key = getPlatformKeyByName(platform.name);
        return key ? { key, label: platform.name } : null;
      })
      .filter((option): option is { key: AdsPlatformKey; label: string } => Boolean(option));

    const dedupedOptions = Array.from(
      new Map(masterOptions.map((option) => [option.key, option])).values(),
    );

    const options = dedupedOptions.length > 0
      ? dedupedOptions
      : [
          { key: 'meta' as const, label: 'Meta Ads' },
          { key: 'google' as const, label: 'Google Ads' },
          { key: 'tiktok' as const, label: 'TikTok Ads' },
        ];

    return options.sort((left, right) => left.label.localeCompare(right.label));
  }, [activePlatforms]);

  const apiAccountInternalOptions = useMemo(() => {
    return adAccounts
      .filter((account) => {
        const platformName = getPlatformName(account.platformId);
        const platformKey = getPlatformKeyByName(platformName);
        if (platformKey !== apiAccountPlatformKey) return false;
        if (apiAccountDialogItem) return true;

        return !apiMappings.some((mapping) =>
          mapping.status === 'active' &&
          mapping.internalAdAccountId === account.id
        );
      })
      .sort((left, right) => left.accountName.localeCompare(right.accountName));
  }, [adAccounts, apiAccountDialogItem, apiAccountPlatformKey, apiMappings, getPlatformName]);

  const formatNameSet = (values: string[]) => {
    const uniqueValues = Array.from(new Set(values.filter(Boolean)));
    if (uniqueValues.length === 0) return '-';
    const visibleValues = uniqueValues.slice(0, 3).join(', ');
    return uniqueValues.length > 3 ? `${visibleValues} +${uniqueValues.length - 3}` : visibleValues;
  };

  const csRelationRows = useMemo(() => {
    const grouped = new Map<string, {
      id: string;
      label: string;
      secondary: string;
      accounts: AdAccount[];
      advertisers: string[];
      platforms: string[];
      subChannels: string[];
      liveCount: number;
      issueCount: number;
    }>();

    rawFilteredData.forEach((account) => {
      const assignment = getActiveAssignment(account.id);
      const owner = getActiveOwnerAssignment(account.id);
      const key = assignment?.csId || 'unassigned-cs';
      const current = grouped.get(key) || {
        id: key,
        label: assignment ? getUserName(assignment.csId) : 'Belum diset',
        secondary: assignment ? 'CS aktif' : 'Perlu assignment',
        accounts: [],
        advertisers: [],
        platforms: [],
        subChannels: [],
        liveCount: 0,
        issueCount: 0,
      };

      current.accounts.push(account);
      current.advertisers.push(getAdvertiserName(owner?.advertiserId || account.advertiserId));
      current.platforms.push(getPlatformName(account.platformId));
      current.subChannels.push(getSubChannelName(account.subChannelId || assignment?.subChannelId));
      if (isIntegrationEnabled(account)) current.liveCount += 1;
      if (hasAssignmentIssue(account) || isUnmatchedAccount(account)) current.issueCount += 1;
      grouped.set(key, current);
    });

    return Array.from(grouped.values()).sort((left, right) =>
      right.accounts.length - left.accounts.length || left.label.localeCompare(right.label),
    );
  }, [
    rawFilteredData,
    getActiveAssignment,
    getActiveOwnerAssignment,
    getAdvertiserName,
    getPlatformName,
    getSubChannelName,
    getUserName,
    hasAssignmentIssue,
    isIntegrationEnabled,
    isUnmatchedAccount,
  ]);

  const advertiserRelationRows = useMemo(() => {
    const grouped = new Map<string, {
      id: string;
      label: string;
      secondary: string;
      accounts: AdAccount[];
      csNames: string[];
      platforms: string[];
      subChannels: string[];
      liveCount: number;
      issueCount: number;
    }>();

    rawFilteredData.forEach((account) => {
      const assignment = getActiveAssignment(account.id);
      const owner = getActiveOwnerAssignment(account.id);
      const key = owner?.advertiserId || account.advertiserId || 'unassigned-advertiser';
      const current = grouped.get(key) || {
        id: key,
        label: getAdvertiserName(key),
        secondary: owner ? 'Advertiser aktif' : 'Fallback master akun',
        accounts: [],
        csNames: [],
        platforms: [],
        subChannels: [],
        liveCount: 0,
        issueCount: 0,
      };

      current.accounts.push(account);
      current.csNames.push(getUserName(assignment?.csId));
      current.platforms.push(getPlatformName(account.platformId));
      current.subChannels.push(getSubChannelName(account.subChannelId || assignment?.subChannelId));
      if (isIntegrationEnabled(account)) current.liveCount += 1;
      if (hasAssignmentIssue(account) || isUnmatchedAccount(account)) current.issueCount += 1;
      grouped.set(key, current);
    });

    return Array.from(grouped.values()).sort((left, right) =>
      right.accounts.length - left.accounts.length || left.label.localeCompare(right.label),
    );
  }, [
    rawFilteredData,
    getActiveAssignment,
    getActiveOwnerAssignment,
    getAdvertiserName,
    getPlatformName,
    getSubChannelName,
    getUserName,
    hasAssignmentIssue,
    isIntegrationEnabled,
    isUnmatchedAccount,
  ]);

  const viewTabs = [
    { id: 'all' as const, label: 'Semua', count: rawFilteredData.length },
    { id: 'api' as const, label: 'Integrasi API', count: allApiAccounts.filter(getApiMappingForAccount).length },
    { id: 'live' as const, label: 'Live Ads ON', count: rawFilteredData.filter(isIntegrationEnabled).length },
    { id: 'unmatched' as const, label: 'Belum Match API', count: rawFilteredData.filter(isUnmatchedAccount).length },
    { id: 'assignment' as const, label: 'Perlu Assignment', count: rawFilteredData.filter(hasAssignmentIssue).length },
    { id: 'cs-relations' as const, label: 'Relasi CS', count: csRelationRows.length },
    { id: 'advertiser-relations' as const, label: 'Relasi Advertiser', count: advertiserRelationRows.length },
  ];

  const filteredData = rawFilteredData.filter((item) => {
    if (accountView === 'live') return isIntegrationEnabled(item);
    if (accountView === 'unmatched') return isUnmatchedAccount(item);
    if (accountView === 'assignment') return hasAssignmentIssue(item);
    return true;
  });

  const visibleAccountIdSignature = filteredData.map((item) => item.id).join('|');
  const visibleAccountIds = useMemo(() => new Set(filteredData.map((item) => item.id)), [visibleAccountIdSignature]);

  useEffect(() => {
    setSelectedAccountIds((prev) => prev.filter((id) => visibleAccountIds.has(id)));
  }, [visibleAccountIds]);

  useEffect(() => {
    if (!isBulkSelectMode) setSelectedAccountIds([]);
  }, [isBulkSelectMode]);

  const activeData = filteredData.filter(item => item.status === 'active');
  const inactiveData = filteredData.filter(item => item.status !== 'active');

  const openApiMappingDialog = (apiAccount: AdApiAccount) => {
    const existingMapping = getApiMappingForAccount(apiAccount);
    setApiMappingDialogAccount(apiAccount);
    setApiMappingInternalId(existingMapping?.internalAdAccountId || '');
    setApiMappingNotes(existingMapping?.notes || '');
  };

  const fillApiAccountForm = (account: AdApiAccount) => {
    setApiAccountPlatformKey(account.platformKey);
    setApiAccountExternalId(account.externalAccountId);
    setApiAccountExternalName(account.externalAccountName);
    setApiAccountGroupId(account.externalGroupId || '');
    setApiAccountGroupName(account.externalGroupName || '');
    setApiAccountStatus(account.externalAccountStatus || 'ENABLED');
    setApiAccountCurrency(account.currencyCode || 'IDR');
  };

  const handleSelectBackendApiAccount = (value: string) => {
    setSelectedBackendApiKey(value);
    if (value === 'manual-entry') {
      setApiAccountInternalId('none');
      setApiAccountPlatformKey('meta');
      setApiAccountExternalId('');
      setApiAccountExternalName('');
      setApiAccountGroupId('');
      setApiAccountGroupName('');
      setApiAccountStatus('manual');
      setApiAccountCurrency('IDR');
      return;
    }

    const selected = allApiAccounts.find(
      (account) => `${account.platformKey}:${account.externalAccountId}` === value,
    );
    if (selected) fillApiAccountForm(selected);
  };

  const handleSelectApiAccountInternal = (value: string) => {
    setApiAccountInternalId(value);
    if (value === 'none') return;

    const internalAccount = adAccounts.find((account) => account.id === value);
    if (!internalAccount) return;

    const platformKey = getPlatformKeyByName(getPlatformName(internalAccount.platformId));
    if (platformKey) setApiAccountPlatformKey(platformKey);

    if (selectedBackendApiKey === 'manual-entry' && !apiAccountExternalName.trim()) {
      setApiAccountExternalName(internalAccount.accountName);
    }
  };

  const mergeApiAccountIntoState = (account: AdApiAccount) => {
    setApiAccounts(prev => {
      const key = `${account.platformKey}:${account.externalAccountId}`;
      return [
        ...prev.filter((item) => `${item.platformKey}:${item.externalAccountId}` !== key),
        account,
      ].sort((left, right) =>
        left.platformKey.localeCompare(right.platformKey) ||
        left.externalAccountName.localeCompare(right.externalAccountName),
      );
    });
  };

  const openAddApiAccountDialog = () => {
    setApiAccountDialogItem(null);
    setSelectedBackendApiKey('manual-entry');
    setApiAccountInternalId('none');
    setApiAccountPlatformKey('meta');
    setApiAccountExternalId('');
    setApiAccountExternalName('');
    setApiAccountGroupId('');
    setApiAccountGroupName('');
    setApiAccountStatus('manual');
    setApiAccountCurrency('IDR');
    setIsApiAccountDialogOpen(true);
  };

  const openEditApiAccountDialog = (account: AdApiAccount) => {
    setApiAccountDialogItem(account);
    setSelectedBackendApiKey('manual-entry');
    setApiAccountInternalId('none');
    fillApiAccountForm(account);
    setIsApiAccountDialogOpen(true);
  };

  const handleSaveApiAccount = async () => {
    if (!apiAccountExternalName.trim()) {
      toast.error('Nama akun API wajib diisi.');
      return;
    }

    if (!apiAccountExternalId.trim()) {
      toast.error('ID akun API wajib diisi.');
      return;
    }

    setApiAccountSaving(true);
    try {
      const saved = await saveAdApiAccount({
        id: apiAccountDialogItem?.id,
        platformKey: apiAccountPlatformKey,
        externalAccountId: apiAccountExternalId,
        externalAccountName: apiAccountExternalName,
        externalGroupId: apiAccountGroupId || null,
        externalGroupName: apiAccountGroupName || null,
        externalAccountStatus: apiAccountStatus || null,
        currencyCode: apiAccountCurrency || null,
        raw: {
          source:
            selectedBackendApiKey !== 'manual-entry'
              ? 'backend-registry'
              : apiAccountDialogItem?.raw?.source || 'manual',
          manualEntry: selectedBackendApiKey === 'manual-entry',
        },
        lastSyncedAt: apiAccountDialogItem?.lastSyncedAt,
      });

      mergeApiAccountIntoState(saved);
      if (!apiAccountDialogItem && apiAccountInternalId !== 'none') {
        const mapping = await saveAdAccountApiMapping({
          internalAdAccountId: apiAccountInternalId,
          apiAccount: saved,
          notes:
            selectedBackendApiKey !== 'manual-entry'
              ? 'Pairing dibuat dari akun backend/API.'
              : 'Pairing dibuat dari input manual registry API.',
        });
        await saveLegacyIntegrationConfigFromMapping(apiAccountInternalId, saved);
        setApiMappings(prev => [
          mapping,
          ...prev.filter((item) =>
            item.internalAdAccountId !== apiAccountInternalId &&
            !(item.platformKey === saved.platformKey && item.externalAccountId === saved.externalAccountId)
          ),
        ]);
      }

      toast.success(
        apiAccountDialogItem
          ? 'Akun API berhasil diperbarui.'
          : apiAccountInternalId !== 'none'
            ? 'Akun API berhasil ditambahkan dan dipasangkan.'
            : 'Akun API berhasil ditambahkan.',
      );
      setIsApiAccountDialogOpen(false);
      setApiAccountDialogItem(null);
      setApiAccountInternalId('none');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan akun API.');
    } finally {
      setApiAccountSaving(false);
    }
  };

  const handleDeleteApiAccount = async (account: AdApiAccount) => {
    try {
      const activeMappings = apiMappings.filter(
        (item) =>
          item.status === 'active' &&
          item.platformKey === account.platformKey &&
          item.externalAccountId === account.externalAccountId,
      );
      await Promise.all(activeMappings.map(disableLegacyIntegrationConfigFromMapping));
      await deleteAdApiAccount(account);
      setApiAccounts(prev => prev.filter(
        (item) => !(item.platformKey === account.platformKey && item.externalAccountId === account.externalAccountId),
      ));
      setApiMappings(prev => prev.filter(
        (item) => !(item.platformKey === account.platformKey && item.externalAccountId === account.externalAccountId),
      ));
      toast.success('Akun API dan pairing aktifnya sudah dihapus.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus akun API.');
    } finally {
      setApiDeletingAccount(null);
    }
  };

  const refreshApiFoundation = React.useCallback(async () => {
    setApiSyncing(true);
    try {
      const [metaResult, googleResult, tiktokResult] = await Promise.allSettled([
        loadMetaRegistry(),
        loadGoogleRegistry(),
        loadTikTokRegistry(),
      ]);

      const syncedAt = new Date().toISOString();
      const refreshedApiAccounts: AdApiAccount[] = [];
      const metaPayload = metaResult.status === 'fulfilled' ? metaResult.value : null;
      const googlePayload = googleResult.status === 'fulfilled' ? googleResult.value : null;
      const tiktokAdvertisersPayload = tiktokResult.status === 'fulfilled' ? tiktokResult.value : null;

      for (const account of metaPayload?.accounts || []) {
        refreshedApiAccounts.push({
          id: `meta:${account.id}`,
          platformKey: 'meta',
          externalAccountId: account.id,
          externalAccountName: account.name,
          externalGroupId: account.businessId,
          externalGroupName: account.businessName,
          externalAccountStatus: account.accountStatus !== null ? String(account.accountStatus) : null,
          currencyCode: account.currency,
          raw: account as unknown as Record<string, unknown>,
          lastSyncedAt: syncedAt,
        });
      }

      for (const account of googlePayload?.accounts || []) {
        refreshedApiAccounts.push({
          id: `google:${account.customerId}`,
          platformKey: 'google',
          externalAccountId: account.customerId,
          externalAccountName: account.customerName || account.name,
          externalGroupId: account.managerCustomerId,
          externalGroupName: account.managerCustomerName,
          externalAccountStatus: account.status,
          currencyCode: account.currencyCode,
          raw: account as unknown as Record<string, unknown>,
          lastSyncedAt: syncedAt,
        });
      }

      for (const advertiser of tiktokAdvertisersPayload || []) {
        refreshedApiAccounts.push({
          id: `tiktok:${advertiser.advertiserId}`,
          platformKey: 'tiktok',
          externalAccountId: advertiser.advertiserId,
          externalAccountName: advertiser.advertiserName,
          externalGroupId: advertiser.bcId,
          externalGroupName: advertiser.bcName,
          externalAccountStatus: advertiser.status,
          currencyCode: advertiser.currency,
          raw: advertiser as unknown as Record<string, unknown>,
          lastSyncedAt: syncedAt,
        });
      }

      const [storedApiAccounts, storedApiMappings] = await Promise.all([
        refreshedApiAccounts.length > 0 ? upsertAdApiAccounts(refreshedApiAccounts) : fetchAdApiAccounts(),
        fetchAdAccountApiMappings(),
      ]);
      setApiAccounts(storedApiAccounts);
      setApiMappings(storedApiMappings);
      toast.success(
        refreshedApiAccounts.length > 0
          ? `${refreshedApiAccounts.length} akun API tersimpan ke database.`
          : 'Registry API sudah dimuat dari database.',
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal refresh integrasi API.');
    } finally {
      setApiSyncing(false);
    }
  }, [loadGoogleRegistry, loadMetaRegistry, loadTikTokRegistry]);

  const saveLegacyIntegrationConfigFromMapping = async (internalAdAccountId: string, apiAccount: AdApiAccount) => {
    if (apiAccount.platformKey === 'google') {
      const saved = await saveGoogleAdsIntegrationConfig(internalAdAccountId, true, {
        managerCustomerId: apiAccount.externalGroupId || undefined,
        managerCustomerName: apiAccount.externalGroupName || undefined,
        liveGoogleCustomerId: apiAccount.externalAccountId,
        liveGoogleCustomerName: apiAccount.externalAccountName,
      });
      setGoogleIntegrationConfigs(prev => ({ ...prev, [internalAdAccountId]: saved }));
      return;
    }

    if (apiAccount.platformKey === 'tiktok') {
      const saved = await saveTikTokAdsIntegrationConfig(internalAdAccountId, true, {
        businessCenterId: apiAccount.externalGroupId || undefined,
        businessCenterName: apiAccount.externalGroupName || undefined,
        liveTikTokAdvertiserId: apiAccount.externalAccountId,
        liveTikTokAdvertiserName: apiAccount.externalAccountName,
      });
      setTikTokIntegrationConfigs(prev => ({ ...prev, [internalAdAccountId]: saved }));
      return;
    }

    const saved = await saveAdsIntegrationConfig(internalAdAccountId, true, {
      businessManagerId: apiAccount.externalGroupId || undefined,
      businessManagerName: apiAccount.externalGroupName || undefined,
      liveMetaAccountId: apiAccount.externalAccountId,
      liveMetaAccountName: apiAccount.externalAccountName,
    });
    setIntegrationConfigs(prev => ({ ...prev, [internalAdAccountId]: saved }));
  };

  const disableLegacyIntegrationConfigFromMapping = async (mapping: AdAccountApiMapping) => {
    if (mapping.platformKey === 'google') {
      const saved = await saveGoogleAdsIntegrationConfig(mapping.internalAdAccountId, false, {
        managerCustomerId: undefined,
        managerCustomerName: undefined,
        liveGoogleCustomerId: undefined,
        liveGoogleCustomerName: undefined,
      });
      setGoogleIntegrationConfigs(prev => ({ ...prev, [mapping.internalAdAccountId]: saved }));
      return;
    }

    if (mapping.platformKey === 'tiktok') {
      const saved = await saveTikTokAdsIntegrationConfig(mapping.internalAdAccountId, false, {
        businessCenterId: undefined,
        businessCenterName: undefined,
        liveTikTokAdvertiserId: undefined,
        liveTikTokAdvertiserName: undefined,
      });
      setTikTokIntegrationConfigs(prev => ({ ...prev, [mapping.internalAdAccountId]: saved }));
      return;
    }

    const saved = await saveAdsIntegrationConfig(mapping.internalAdAccountId, false, {
      businessManagerId: undefined,
      businessManagerName: undefined,
      liveMetaAccountId: undefined,
      liveMetaAccountName: undefined,
    });
    setIntegrationConfigs(prev => ({ ...prev, [mapping.internalAdAccountId]: saved }));
  };

  const handleSaveApiMapping = async () => {
    if (!apiMappingDialogAccount) return;
    if (!apiMappingInternalId) {
      toast.error('Pilih akun internal yang akan dipasangkan.');
      return;
    }

    setApiMappingSaving(true);
    try {
      const saved = await saveAdAccountApiMapping({
        internalAdAccountId: apiMappingInternalId,
        apiAccount: apiMappingDialogAccount,
        notes: apiMappingNotes,
      });
      await saveLegacyIntegrationConfigFromMapping(apiMappingInternalId, apiMappingDialogAccount);
      setApiMappings(prev => [
        saved,
        ...prev.filter((mapping) =>
          mapping.internalAdAccountId !== apiMappingInternalId &&
          !(mapping.platformKey === apiMappingDialogAccount.platformKey &&
            mapping.externalAccountId === apiMappingDialogAccount.externalAccountId)
        ),
      ]);
      toast.success('Akun API berhasil dipasangkan ke akun internal.');
      setApiMappingDialogAccount(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan pairing API.');
    } finally {
      setApiMappingSaving(false);
    }
  };

  const handleRemoveApiMapping = async (mapping: AdAccountApiMapping) => {
    try {
      await removeAdAccountApiMapping(mapping);
      await disableLegacyIntegrationConfigFromMapping(mapping);
      setApiMappings(prev => prev.filter((item) => item.id !== mapping.id));
      toast.success('Pairing API dilepas.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal melepas pairing API.');
    }
  };

  const handleSubmit = async (formData: any) => {
    const {
      liveMetaBusinessManagerId,
      liveMetaBusinessManagerName,
      liveMetaAccountId,
      liveMetaAccountName,
      liveGoogleManagerCustomerId,
      liveGoogleManagerCustomerName,
      liveGoogleCustomerId,
      liveGoogleCustomerName,
      liveTikTokBusinessCenterId,
      liveTikTokBusinessCenterName,
      liveTikTokAdvertiserId,
      liveTikTokAdvertiserName,
      ...payload
    } = formData;
    const hasSelectedMetaLiveAccount = Boolean(liveMetaAccountId);
    const hasSelectedGoogleLiveAccount = Boolean(liveGoogleCustomerId);
    const hasSelectedTikTokLiveAdvertiser = Boolean(liveTikTokAdvertiserId);

    if (editingItem) {
      if (!canEdit) {
        toast.error("Anda tidak memiliki izin untuk mengubah akun iklan");
        return;
      }

      const duplicate = adAccounts.find(
        (a) =>
          a.id !== editingItem.id &&
          a.platformId === payload.platformId &&
          a.accountName.trim().toLowerCase() === payload.accountName.trim().toLowerCase() &&
          a.advertiserId === payload.advertiserId,
      );
      if (duplicate) {
        toast.error("Akun iklan dengan platform, nama akun, dan advertiser yang sama sudah ada");
        return;
      }

      const updatedItem = { ...editingItem, ...payload };
      await updateAdAccount(updatedItem);

      try {
        if (isGooglePlatformName(getPlatformName(updatedItem.platformId))) {
          const savedConfig = await saveGoogleAdsIntegrationConfig(
            updatedItem.id,
            hasSelectedGoogleLiveAccount || isIntegrationEnabled(updatedItem),
            {
              managerCustomerId: liveGoogleManagerCustomerId,
              managerCustomerName: liveGoogleManagerCustomerName,
              liveGoogleCustomerId,
              liveGoogleCustomerName,
            },
          );
          setGoogleIntegrationConfigs(prev => ({
            ...prev,
            [updatedItem.id]: savedConfig,
          }));
        } else if (isTikTokPlatformName(getPlatformName(updatedItem.platformId))) {
          const savedConfig = await saveTikTokAdsIntegrationConfig(
            updatedItem.id,
            hasSelectedTikTokLiveAdvertiser || isIntegrationEnabled(updatedItem),
            {
              businessCenterId: liveTikTokBusinessCenterId,
              businessCenterName: liveTikTokBusinessCenterName,
              liveTikTokAdvertiserId,
              liveTikTokAdvertiserName,
            },
          );
          setTikTokIntegrationConfigs(prev => ({
            ...prev,
            [updatedItem.id]: savedConfig,
          }));
        } else {
          const savedConfig = await saveAdsIntegrationConfig(
            updatedItem.id,
            hasSelectedMetaLiveAccount || isIntegrationEnabled(updatedItem),
            {
              businessManagerId: liveMetaBusinessManagerId,
              businessManagerName: liveMetaBusinessManagerName,
              liveMetaAccountId,
              liveMetaAccountName,
            },
          );
          setIntegrationConfigs(prev => ({
            ...prev,
            [updatedItem.id]: savedConfig,
          }));
        }
      } catch {
        // keep UI update optimistic even if config save falls back locally
      }
    } else {
      if (!canCreate) {
        toast.error("Anda tidak memiliki izin untuk menambah akun iklan");
        return;
      }

      const duplicate = adAccounts.find(
        (a) =>
          a.platformId === payload.platformId &&
          a.accountName.trim().toLowerCase() === payload.accountName.trim().toLowerCase() &&
          a.advertiserId === payload.advertiserId,
      );
      if (duplicate) {
        toast.error("Akun iklan dengan platform, nama akun, dan advertiser yang sama sudah ada");
        return;
      }

      const newItem: AdAccount = {
        id: Math.random().toString(36).substr(2, 9),
        ...payload
      };
      await addAdAccount(newItem);

      try {
        if (isGooglePlatformName(getPlatformName(newItem.platformId))) {
          const savedConfig = await saveGoogleAdsIntegrationConfig(
            newItem.id,
            hasSelectedGoogleLiveAccount,
            {
              managerCustomerId: liveGoogleManagerCustomerId,
              managerCustomerName: liveGoogleManagerCustomerName,
              liveGoogleCustomerId,
              liveGoogleCustomerName,
            },
          );
          setGoogleIntegrationConfigs(prev => ({
            ...prev,
            [newItem.id]: savedConfig,
          }));
        } else if (isTikTokPlatformName(getPlatformName(newItem.platformId))) {
          const savedConfig = await saveTikTokAdsIntegrationConfig(
            newItem.id,
            hasSelectedTikTokLiveAdvertiser,
            {
              businessCenterId: liveTikTokBusinessCenterId,
              businessCenterName: liveTikTokBusinessCenterName,
              liveTikTokAdvertiserId,
              liveTikTokAdvertiserName,
            },
          );
          setTikTokIntegrationConfigs(prev => ({
            ...prev,
            [newItem.id]: savedConfig,
          }));
        } else {
          const savedConfig = await saveAdsIntegrationConfig(
            newItem.id,
            hasSelectedMetaLiveAccount,
            {
              businessManagerId: liveMetaBusinessManagerId,
              businessManagerName: liveMetaBusinessManagerName,
              liveMetaAccountId,
              liveMetaAccountName,
            },
          );
          setIntegrationConfigs(prev => ({
            ...prev,
            [newItem.id]: savedConfig,
          }));
        }
      } catch {
        // keep UI update optimistic even if config save falls back locally
      }
    }
    setIsAddOpen(false);
    setEditingItem(null);
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      toast.error("Anda tidak memiliki izin untuk menghapus akun iklan");
      return;
    }
    await deleteAdAccount(id);
  };

  const updateAccountStatus = async (item: AdAccount, status: AdAccount['status']) => {
    if (!canEdit) {
      toast.error('Anda tidak memiliki izin untuk mengubah status akun iklan');
      return;
    }

    setSavingStatusId(item.id);
    try {
      await updateAdAccount({ ...item, status });
      toast.success(status === 'active' ? 'Akun iklan diaktifkan.' : 'Akun iklan dinonaktifkan.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengubah status akun iklan.');
    } finally {
      setSavingStatusId(null);
    }
  };

  const requestAccountStatusToggle = (item: AdAccount) => {
    if (item.status === 'active') {
      setStatusToggleItem(item);
      return;
    }

    void updateAccountStatus(item, 'active');
  };

  const renderAccountStatusSwitch = (item: AdAccount) => (
    <TableStatusSwitch
      checked={item.status === 'active'}
      disabled={!canEdit}
      loading={savingStatusId === item.id}
      offLabel="OFF"
      onClick={(event) => {
        event.stopPropagation();
        requestAccountStatusToggle(item);
      }}
      onLabel="ON"
      title={item.status === 'active' ? 'Klik untuk nonaktifkan akun' : 'Klik untuk aktifkan akun'}
    />
  );

  const selectedAccounts = useMemo(
    () => adAccounts.filter((item) => selectedAccountIds.includes(item.id)),
    [adAccounts, selectedAccountIds],
  );
  const selectedActiveCount = selectedAccounts.filter((item) => item.status === 'active').length;
  const selectedInactiveCount = selectedAccounts.length - selectedActiveCount;

  const toggleAccountSelection = (id: string, checked: boolean) => {
    setSelectedAccountIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((itemId) => itemId !== id);
    });
  };

  const toggleSectionSelection = (items: AdAccount[], checked: boolean) => {
    const itemIds = items.map((item) => item.id);
    setSelectedAccountIds((prev) => {
      if (!checked) return prev.filter((id) => !itemIds.includes(id));
      return Array.from(new Set([...prev, ...itemIds]));
    });
  };

  const applyBulkStatus = async (status: AdAccount['status']) => {
    if (!canEdit) {
      toast.error('Anda tidak memiliki izin untuk mengubah status akun iklan');
      return;
    }

    const targetAccounts = selectedAccounts.filter((item) => item.status !== status);
    if (targetAccounts.length === 0) {
      toast.info(status === 'active' ? 'Semua akun terpilih sudah ON.' : 'Semua akun terpilih sudah OFF.');
      setBulkStatusTarget(null);
      return;
    }

    setBulkStatusSaving(true);
    try {
      await Promise.all(targetAccounts.map((item) => updateAdAccount({ ...item, status })));
      toast.success(
        status === 'active'
          ? `${targetAccounts.length} akun iklan diaktifkan.`
          : `${targetAccounts.length} akun iklan dinonaktifkan.`,
      );
      setSelectedAccountIds([]);
      setBulkStatusTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengubah status akun iklan secara massal.');
    } finally {
      setBulkStatusSaving(false);
    }
  };

  const requestBulkStatus = (status: AdAccount['status']) => {
    if (selectedAccountIds.length === 0) {
      toast.info('Pilih akun iklan dulu.');
      return;
    }

    if (status === 'inactive') {
      setBulkStatusTarget(status);
      return;
    }

    void applyBulkStatus(status);
  };

  const renderBulkActionBar = () => {
    if (!isBulkSelectMode) return null;

    return (
      <div className="adAccountBulkBar">
        <div className="adAccountBulkSummary">
          <span className="adAccountBulkCount">{selectedAccounts.length}</span>
          <span>{selectedAccounts.length > 0 ? 'akun dipilih' : 'mode pilih massal'}</span>
          <small>
            {selectedAccounts.length > 0
              ? `${selectedActiveCount} ON / ${selectedInactiveCount} OFF`
              : 'centang akun yang ingin diubah'}
          </small>
        </div>
        <div className="adAccountBulkActions">
          <Button
            className="adAccountBulkButton isOn"
            disabled={bulkStatusSaving || selectedAccounts.length === 0}
            onClick={() => requestBulkStatus('active')}
            type="button"
          >
            Aktifkan
          </Button>
          <Button
            className="adAccountBulkButton isOff"
            disabled={bulkStatusSaving || selectedAccounts.length === 0}
            onClick={() => requestBulkStatus('inactive')}
            type="button"
          >
            Nonaktifkan
          </Button>
          <Button
            className="adAccountBulkButton isGhost"
            disabled={bulkStatusSaving}
            onClick={() => {
              setSelectedAccountIds([]);
              setIsBulkSelectMode(false);
            }}
            type="button"
            variant="ghost"
          >
            Tutup
          </Button>
        </div>
      </div>
    );
  };

  const handleToggleIntegration = async (item: AdAccount, enabled: boolean) => {
    setSavingConfigId(item.id);
    try {
      if (isGooglePlatformName(getPlatformName(item.platformId))) {
        const saved = await saveGoogleAdsIntegrationConfig(item.id, enabled, {
          managerCustomerId: googleIntegrationConfigs[item.id]?.managerCustomerId,
          managerCustomerName: googleIntegrationConfigs[item.id]?.managerCustomerName,
          liveGoogleCustomerId: googleIntegrationConfigs[item.id]?.liveGoogleCustomerId,
          liveGoogleCustomerName: googleIntegrationConfigs[item.id]?.liveGoogleCustomerName,
        });
        setGoogleIntegrationConfigs(prev => ({
          ...prev,
          [item.id]: saved,
        }));
      } else if (isTikTokPlatformName(getPlatformName(item.platformId))) {
        const saved = await saveTikTokAdsIntegrationConfig(item.id, enabled, {
          businessCenterId: tiktokIntegrationConfigs[item.id]?.businessCenterId,
          businessCenterName: tiktokIntegrationConfigs[item.id]?.businessCenterName,
          liveTikTokAdvertiserId: tiktokIntegrationConfigs[item.id]?.liveTikTokAdvertiserId,
          liveTikTokAdvertiserName: tiktokIntegrationConfigs[item.id]?.liveTikTokAdvertiserName,
        });
        setTikTokIntegrationConfigs(prev => ({
          ...prev,
          [item.id]: saved,
        }));
      } else {
        const saved = await saveAdsIntegrationConfig(item.id, enabled);
        setIntegrationConfigs(prev => ({
          ...prev,
          [item.id]: saved,
        }));
      }
      toast.success(
        enabled ? 'Akun ditampilkan di Live Ads' : 'Akun disembunyikan dari Live Ads',
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan checklist integrasi.');
    } finally {
      setSavingConfigId(null);
    }
  };

  const renderIntegrationControl = (item: AdAccount) => {
    const enabled = isIntegrationEnabled(item);
    const unmatched = isUnmatchedAccount(item);
    const saving = savingConfigId === item.id;
    const tone = saving ? 'saving' : enabled ? (unmatched ? 'warning' : 'live') : 'off';
    const label = saving ? 'Sync' : enabled ? (unmatched ? 'Belum Match' : 'Live ON') : 'OFF';

    return (
      <button
        type="button"
        className={cn('integrationStatusPill', `is-${tone}`)}
        disabled={!canEdit || saving}
        onClick={(event) => {
          event.stopPropagation();
          if (enabled && unmatched) {
            toast.info('Pilih akun live/API yang sesuai agar status menjadi Live ON.');
            openEdit(item);
            return;
          }

          if (!enabled && !hasLiveMapping(item)) {
            toast.info('Hubungkan akun ini ke akun live/API dulu.');
            openEdit(item);
            return;
          }

          void handleToggleIntegration(item, !enabled);
        }}
        title={enabled && unmatched ? 'Klik untuk hubungkan akun live/API' : enabled ? 'Klik untuk mematikan Live Ads akun ini' : 'Klik untuk mengaktifkan atau menghubungkan Live Ads akun ini'}
      >
        <span className="integrationStatusDot" />
        <span>{label}</span>
      </button>
    );
  };

  const renderAssignmentControl = (item: AdAccount) => {
    const activeOwner = getActiveOwnerAssignment(item.id);
    const activeAssignment = getActiveAssignment(item.id);
    const ownerReady = Boolean(activeOwner);
    const csReady = Boolean(activeAssignment);
    const complete = ownerReady && csReady;
    const empty = !ownerReady && !csReady;
    const tone = complete ? 'ready' : empty ? 'empty' : 'partial';
    const label = complete ? 'Siap' : empty ? 'Belum' : 'Kurang';

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn('assignmentStatusPill', `is-${tone}`)}
            onClick={(event) => event.stopPropagation()}
          >
            <span className="assignmentStatusDot" />
            <span>{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="assignmentStatusPopover">
          <div className="assignmentStatusPopoverHeader">
            <strong>Assignment Aktif</strong>
            <span>{item.accountName}</span>
          </div>

          <div className="assignmentStatusRows">
            <div>
              <span>Advertiser</span>
              <strong>{activeOwner ? getAdvertiserName(activeOwner.advertiserId) : 'Belum diset'}</strong>
              {activeOwner && <small>Sejak {activeOwner.startDate}</small>}
            </div>
            <div>
              <span>CS</span>
              <strong>{activeAssignment ? getUserName(activeAssignment.csId) : 'Belum diset'}</strong>
              {activeAssignment && (
                <small>
                  Sejak {activeAssignment.startDate}
                  {activeAssignment.subChannelId ? ` / ${getSubChannelName(activeAssignment.subChannelId)}` : ''}
                </small>
              )}
            </div>
          </div>

          <div className="assignmentStatusActions">
            {canEdit && (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => openOwnerDialog(item)}>
                  Ganti Advertiser
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => openAssignmentDialog(item)}>
                  Ganti CS
                </Button>
              </>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setHistoryItem(item)}>
              Riwayat
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const refreshLiveRegistries = React.useCallback(async () => {
    await Promise.allSettled([loadMetaRegistry(), loadGoogleRegistry(), loadTikTokRegistry()]);
  }, [loadGoogleRegistry, loadMetaRegistry, loadTikTokRegistry]);

  const openEdit = (item: AdAccount) => {
    setEditingItem(item);
    setIsAddOpen(true);
    void refreshLiveRegistries();
  };

  const openAssignmentDialog = (item: AdAccount) => {
    const activeAssignment = getActiveAssignment(item.id);
    setAssignmentDialogItem(item);
    setAssignmentCsId(activeAssignment?.csId || '');
    setAssignmentSubChannelId(activeAssignment?.subChannelId || 'none');
    setAssignmentStartDate(getTodayDateKey());
    setAssignmentNotes('');
  };

  const openOwnerDialog = (item: AdAccount) => {
    const activeOwner = getActiveOwnerAssignment(item.id);
    setOwnerDialogItem(item);
    setOwnerAdvertiserId(activeOwner?.advertiserId || item.advertiserId || '');
    setOwnerStartDate(getTodayDateKey());
    setOwnerNotes('');
  };

  const handleSaveOwner = async () => {
    if (!ownerDialogItem) return;
    if (!ownerAdvertiserId) {
      toast.error('Pilih advertiser pemilik akun dulu.');
      return;
    }
    if (!ownerStartDate) {
      toast.error('Tanggal mulai wajib diisi.');
      return;
    }

    setOwnerSaving(true);
    try {
      await assignAdAccountOwner({
        adAccountId: ownerDialogItem.id,
        advertiserId: ownerAdvertiserId,
        startDate: ownerStartDate,
        notes: ownerNotes,
      });
      toast.success('Riwayat advertiser akun iklan berhasil diperbarui.');
      setOwnerDialogItem(null);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'message' in error
          ? String((error as { message?: unknown }).message)
          : 'Gagal menyimpan advertiser akun iklan.';
      toast.error(message);
    } finally {
      setOwnerSaving(false);
    }
  };

  const handleSaveAssignment = async () => {
    if (!assignmentDialogItem) return;
    if (!assignmentCsId) {
      toast.error('Pilih CS penanggung jawab dulu.');
      return;
    }
    if (!assignmentStartDate) {
      toast.error('Tanggal mulai wajib diisi.');
      return;
    }

    const normalizedSubChannelId = assignmentSubChannelId === 'none' ? null : assignmentSubChannelId;
    const matchingAssignment = getActiveAssignment(assignmentDialogItem.id, assignmentStartDate);
    if (
      matchingAssignment &&
      matchingAssignment.csId === assignmentCsId &&
      (matchingAssignment.subChannelId || null) === normalizedSubChannelId
    ) {
      toast.info('CS aktif pada tanggal itu sudah sama. Pilih CS atau subchannel lain jika memang ingin membuat riwayat baru.');
      return;
    }

    setAssignmentSaving(true);
    try {
      await assignAdAccountCs({
        adAccountId: assignmentDialogItem.id,
        csId: assignmentCsId,
        subChannelId: normalizedSubChannelId,
        startDate: assignmentStartDate,
        notes: assignmentNotes,
      });
      toast.success('Riwayat CS akun iklan berhasil diperbarui.');
      setAssignmentDialogItem(null);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'message' in error
          ? String((error as { message?: unknown }).message)
          : 'Gagal menyimpan CS akun iklan.';
      toast.error(message);
    } finally {
      setAssignmentSaving(false);
    }
  };

  const renderTable = (items: AdAccount[], title: string, variant: 'active' | 'inactive') => {
    if (items.length === 0) return null;

    return (
      <div className="mb-8 last:mb-0">
        <div className="adAccountTableHeaderRow">
          <MasterDataTableTitle title={title} count={items.length} variant={variant} />
          {canEdit && (
            <TableStatusSwitch
              checked={isBulkSelectMode}
              className="adAccountBulkModeSwitch"
              offLabel="Pilih"
              onClick={(event) => {
                event.stopPropagation();
                setIsBulkSelectMode((value) => !value);
              }}
              onLabel="Massal"
              title={isBulkSelectMode ? 'Tutup mode pilih massal' : 'Aktifkan mode pilih massal'}
            />
          )}
        </div>
        {renderBulkActionBar()}

        <div className="tablePanel">
          {/* Desktop Table */}
          <div className="hidden md:block">
            {(() => {
              const selectedInSection = items.filter((item) => selectedAccountIds.includes(item.id)).length;
              const allSelected = selectedInSection === items.length;
              const partiallySelected = selectedInSection > 0 && !allSelected;
              return (
            <DataTable
              actionWidth={82}
              cellY={12}
              columns={[
                isBulkSelectMode ? 54 : null,
                64,
                260,
                180,
                220,
                190,
                190,
                118,
                142,
                88,
                82,
                90,
                (canEdit || canDelete) ? 82 : null,
              ]}
              minWidth={canEdit || canDelete ? (isBulkSelectMode ? 1790 : 1736) : (isBulkSelectMode ? 1708 : 1654)}
              rowMinHeight={76}
            >
              <table>
                <thead>
                  <tr>
                    {isBulkSelectMode && (
                      <th className="text-center">
                        <Checkbox
                          aria-label={`Pilih semua ${title}`}
                          checked={allSelected ? true : partiallySelected ? 'indeterminate' : false}
                          className="dataTableSoftCheckbox"
                          disabled={!canEdit}
                          onCheckedChange={(checked) => toggleSectionSelection(items, checked === true)}
                        />
                      </th>
                    )}
                    <th className="text-center">No</th>
                    <th>Nama Akun</th>
                    <th>Sub Channel</th>
                    <th>Business / Manager</th>
                    <th>Advertiser</th>
                    <th>CS Aktif</th>
                    <th className="text-center">Assignment</th>
                    <th className="text-center">Live Ads</th>
                    <th className="text-center">PPN</th>
                    <th className="text-center">Fee</th>
                    <th className="text-center">Status</th>
                    {(canEdit || canDelete) && <TableActionHeader />}
                  </tr>
                </thead>
                <tbody>
                {items.map((item, index) => {
                  const activeAssignment = getActiveAssignment(item.id);
                  const activeOwner = getActiveOwnerAssignment(item.id);
                  const effectiveAdvertiserId = activeOwner?.advertiserId || item.advertiserId;
                  const businessManagerLabel = getBusinessManagerLabel(item);
                  const platform = getPlatform(item.platformId);
                  const selected = selectedAccountIds.includes(item.id);

                  return (
                  <tr key={item.id}>
                    {isBulkSelectMode && (
                      <td className="tableIconCell text-center">
                        <Checkbox
                          aria-label={`Pilih ${item.accountName}`}
                          checked={selected}
                          className="dataTableSoftCheckbox"
                          disabled={!canEdit}
                          onCheckedChange={(checked) => toggleAccountSelection(item.id, checked === true)}
                        />
                      </td>
                    )}
                    <td className="monoCell text-center">{index + 1}</td>
                    <td>
                      <div className="platformLogoTableCell">
                        <PlatformLogo
                          density="compact"
                          logoPath={platform?.logoPath}
                          name={platform?.name || item.accountName}
                          size="sm"
                        />
                        <TableText primary={item.accountName} />
                      </div>
                    </td>
                    <td>
                      <TableText
                        primary={item.subChannelId ? getSubChannelName(item.subChannelId) : 'Belum diset'}
                        primaryClassName={!item.subChannelId ? 'text-slate-400 dark:text-slate-500' : undefined}
                      />
                    </td>
                    <td>
                      <TableText
                        primary={businessManagerLabel}
                        primaryClassName={businessManagerLabel === 'Belum match live' ? 'text-slate-400 dark:text-slate-500' : undefined}
                      />
                    </td>
                    <td>
                      <TableText
                        primary={getAdvertiserName(effectiveAdvertiserId)}
                        secondary={activeOwner ? `Sejak ${activeOwner.startDate}` : 'Belum ada histori'}
                      />
                    </td>
                    <td>
                      <TableText
                        primary={activeAssignment ? getUserName(activeAssignment.csId) : 'Belum diset'}
                        secondary={
                          activeAssignment
                            ? `Sejak ${activeAssignment.startDate}${activeAssignment.subChannelId ? ` / ${getSubChannelName(activeAssignment.subChannelId)}` : ''}`
                            : 'Set agar CS View historis akurat'
                        }
                        primaryClassName={!activeAssignment ? 'text-amber-600 dark:text-amber-300' : undefined}
                      />
                    </td>
                    <td className="tableIconCell text-center">
                      {renderAssignmentControl(item)}
                    </td>
                    <td className="tableIconCell text-center">
                      {renderIntegrationControl(item)}
                    </td>
                    <td className="monoCell text-center">{item.ppn ?? 0}%</td>
                    <td className="monoCell text-center">{item.fee ?? 0}%</td>
                    <TableStatusCell>
                      {renderAccountStatusSwitch(item)}
                    </TableStatusCell>
                    {(canEdit || canDelete) && (
                      <TableActionCell>
                        <TableActionMenu contentClassName="w-48">
                          {canEdit && (
                            <TableActionMenuItem icon={Users} onClick={() => openOwnerDialog(item)}>
                              Ganti Advertiser
                            </TableActionMenuItem>
                          )}
                          {canEdit && (
                            <TableActionMenuItem icon={UserCheck} onClick={() => openAssignmentDialog(item)}>
                              Ganti CS
                            </TableActionMenuItem>
                          )}
                          <TableActionMenuItem icon={History} onClick={() => setHistoryItem(item)}>
                            Riwayat Assignment
                          </TableActionMenuItem>
                          {canEdit && (
                            <TableActionMenuItem icon={Edit} onClick={() => openEdit(item)}>
                              Edit Akun
                            </TableActionMenuItem>
                          )}
                          {canDelete && (
                            <TableActionMenuItem danger icon={Trash2} onClick={() => setDeletingItem(item)}>
                              Hapus
                            </TableActionMenuItem>
                          )}
                        </TableActionMenu>
                      </TableActionCell>
                    )}
                  </tr>
                  );
                })}
                </tbody>
              </table>
            </DataTable>
              );
            })()}
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
             {items.map((item) => {
                const activeOwner = getActiveOwnerAssignment(item.id);
                const effectiveAdvertiserId = activeOwner?.advertiserId || item.advertiserId;
                const platform = getPlatform(item.platformId);
                const selected = selectedAccountIds.includes(item.id);

                return (
                <div key={item.id} className="p-4 bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                           {isBulkSelectMode && (
                             <Checkbox
                               aria-label={`Pilih ${item.accountName}`}
                               checked={selected}
                               className="dataTableSoftCheckbox"
                               disabled={!canEdit}
                               onCheckedChange={(checked) => toggleAccountSelection(item.id, checked === true)}
                             />
                           )}
                           <PlatformLogo
                             density="compact"
                             logoPath={platform?.logoPath}
                             name={platform?.name || item.accountName}
                             size="sm"
                           />
                           <div className="flex flex-col">
                              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{item.accountName}</h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{getPlatformName(item.platformId)}</p>
                           </div>
                        </div>
                        {renderAccountStatusSwitch(item)}
                    </div>
                    
                    <div className="pl-[52px] space-y-1 mb-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Sub Channel</p>
                        <p className={cn("text-sm font-semibold", item.subChannelId ? "text-slate-800 dark:text-slate-200" : "text-slate-400")}>
                          {item.subChannelId ? getSubChannelName(item.subChannelId) : 'Belum diset'}
                        </p>
                    </div>

                    <div className="pl-[52px] space-y-1 mb-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Business / Manager</p>
                        <p className="text-sm text-slate-800 dark:text-slate-200 font-semibold">
                          {getBusinessManagerLabel(item)}
                        </p>
                    </div>

                    <div className="pl-[52px] space-y-1 mb-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Advertiser</p>
                        <p className="text-sm text-slate-800 dark:text-slate-200 font-semibold">{getAdvertiserName(effectiveAdvertiserId)}</p>
                        <p className="text-xs text-slate-500">{activeOwner ? `Sejak ${activeOwner.startDate}` : 'Belum ada histori'}</p>
                    </div>

                    {(() => {
                      const activeAssignment = getActiveAssignment(item.id);
                      return (
                        <div className="pl-[52px] space-y-1 mb-3">
                          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">CS Aktif</p>
                          <p className={cn("text-sm font-semibold", activeAssignment ? "text-slate-800 dark:text-slate-200" : "text-amber-600")}>
                            {activeAssignment ? getUserName(activeAssignment.csId) : 'Belum diset'}
                          </p>
                          {activeAssignment && (
                            <p className="text-xs text-slate-500">Sejak {activeAssignment.startDate}</p>
                          )}
                        </div>
                      );
                    })()}

                    <div className="pl-[52px] mb-3">
                      <div className="flex flex-wrap gap-2">
                        {renderAssignmentControl(item)}
                        {renderIntegrationControl(item)}
                      </div>
                    </div>

                    {(canEdit || canDelete) && (
                      <MobileCardActions
                        className="ml-[52px]"
                        actions={[
                          ...(canEdit ? [
                            { icon: Users, label: 'Atur Advertiser', onClick: () => openOwnerDialog(item) },
                            { icon: UserCheck, label: 'Atur CS', onClick: () => openAssignmentDialog(item) },
                            { icon: History, label: 'Riwayat', onClick: () => setHistoryItem(item) },
                            { icon: Edit, label: 'Edit Akun', onClick: () => openEdit(item) },
                          ] : []),
                          ...(!canEdit ? [{ icon: History, label: 'Riwayat', onClick: () => setHistoryItem(item) }] : []),
                          ...(canDelete ? [{ danger: true, icon: Trash2, label: 'Hapus', onClick: () => setDeletingItem(item) }] : []),
                        ]}
                      />
                    )}
                </div>
             );})}
          </div>
        </div>
      </div>
    );
  };

  const renderApiIntegrationTable = () => {
    if (apiFilteredAccounts.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
          <div className="p-4 rounded-full bg-slate-50 dark:bg-slate-900 mb-4">
            <Link2 className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Belum ada registry API Ads</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto mt-1">
            Klik refresh setelah token Meta, Google Ads, atau TikTok Ads aktif agar akun live masuk ke registry.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {canCreate && (
              <Button className="masterDataActionButton" onClick={openAddApiAccountDialog}>
                <Plus /> Tambah Akun API
              </Button>
            )}
            <Button variant="outline" onClick={() => void refreshApiFoundation()} disabled={apiSyncing}>
              <RefreshCw className={apiSyncing ? 'animate-spin' : undefined} />
              Refresh API
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="mb-8 last:mb-0">
        <div className="flex items-center justify-between gap-3">
          <MasterDataTableTitle title="Akun API Terintegrasi" count={apiFilteredAccounts.length} variant="active" />
          <Button variant="outline" onClick={() => void refreshApiFoundation()} disabled={apiSyncing}>
            <RefreshCw className={apiSyncing ? 'animate-spin' : undefined} />
            Refresh API
          </Button>
        </div>

        <div className="tablePanel">
          <div className="hidden md:block">
            <DataTable
              actionWidth={82}
              cellY={12}
              columns={[64, 190, 300, 240, 260, 140, canEdit ? 82 : null]}
              minWidth={canEdit ? 1276 : 1194}
              rowMinHeight={76}
            >
              <table>
                <thead>
                  <tr>
                    <th className="text-center">No</th>
                    <th>Platform</th>
                    <th>Akun API</th>
                    <th>Business / Manager</th>
                    <th>Akun Internal</th>
                    <th className="text-center">Pairing</th>
                    {canEdit && <TableActionHeader />}
                  </tr>
                </thead>
                <tbody>
                  {apiFilteredAccounts.map((apiAccount, index) => {
                    const platform = getPlatformByKey(apiAccount.platformKey);
                    const mapping = getApiMappingForAccount(apiAccount);
                    const internalAccount = getInternalAdAccount(mapping?.internalAdAccountId);

                    return (
                      <tr key={`${apiAccount.platformKey}:${apiAccount.externalAccountId}`}>
                        <td className="monoCell text-center">{index + 1}</td>
                        <td>
                          <div className="platformLogoTableCell">
                            <PlatformLogo
                              density="compact"
                              logoPath={platform?.logoPath}
                              name={platform?.name || getPlatformLabelByKey(apiAccount.platformKey)}
                              size="sm"
                            />
                            <TableText primary={platform?.name || getPlatformLabelByKey(apiAccount.platformKey)} />
                          </div>
                        </td>
                        <td>
                          <TableText primary={apiAccount.externalAccountName} secondary={`ID API: ${apiAccount.externalAccountId}`} />
                        </td>
                        <td>
                          <TableText
                            primary={apiAccount.externalGroupName || 'Tanpa manager'}
                            secondary={apiAccount.externalGroupId ? `BM ID: ${apiAccount.externalGroupId}` : apiAccount.currencyCode ? `Mata uang: ${apiAccount.currencyCode}` : undefined}
                          />
                        </td>
                        <td>
                          <TableText
                            primary={internalAccount?.accountName || 'Belum dipasangkan'}
                            secondary={internalAccount ? `Master internal: ${getAdvertiserName(internalAccount.advertiserId)}` : 'Belum ada relasi ke master akun iklan'}
                            primaryClassName={!internalAccount ? 'text-amber-600 dark:text-amber-300' : undefined}
                          />
                        </td>
                        <td className="tableIconCell text-center">
                          <span className={cn('assignmentStatusPill', mapping ? 'is-ready' : 'is-partial')}>
                            <span className="assignmentStatusDot" />
                            <span>{mapping ? 'Paired' : 'Belum'}</span>
                          </span>
                        </td>
                        {canEdit && (
                          <TableActionCell>
                            <TableActionMenu contentClassName="w-44">
                            <TableActionMenuItem icon={Link2} onClick={() => openApiMappingDialog(apiAccount)}>
                              {mapping ? 'Ganti Pairing' : 'Pasangkan'}
                            </TableActionMenuItem>
                            <TableActionMenuItem icon={Edit} onClick={() => openEditApiAccountDialog(apiAccount)}>
                              Edit Akun API
                            </TableActionMenuItem>
                            {mapping && (
                              <TableActionMenuItem icon={Unlink} onClick={() => void handleRemoveApiMapping(mapping)}>
                                Lepas Pairing
                              </TableActionMenuItem>
                            )}
                            {canDelete && (
                              <TableActionMenuItem icon={Trash2} danger onClick={() => setApiDeletingAccount(apiAccount)}>
                                Hapus Akun API
                              </TableActionMenuItem>
                            )}
                          </TableActionMenu>
                        </TableActionCell>
                      )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTable>
          </div>

          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
            {apiFilteredAccounts.map((apiAccount) => {
              const platform = getPlatformByKey(apiAccount.platformKey);
              const mapping = getApiMappingForAccount(apiAccount);
              const internalAccount = getInternalAdAccount(mapping?.internalAdAccountId);

              return (
                <div key={`${apiAccount.platformKey}:${apiAccount.externalAccountId}`} className="p-4 bg-white dark:bg-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <PlatformLogo
                        density="compact"
                        logoPath={platform?.logoPath}
                        name={platform?.name || getPlatformLabelByKey(apiAccount.platformKey)}
                        size="sm"
                      />
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{apiAccount.externalAccountName}</h3>
                        <p className="text-xs text-slate-500">{getPlatformLabelByKey(apiAccount.platformKey)} / ID API: {apiAccount.externalAccountId}</p>
                      </div>
                    </div>
                    <span className={cn('assignmentStatusPill', mapping ? 'is-ready' : 'is-partial')}>
                      <span className="assignmentStatusDot" />
                      <span>{mapping ? 'Paired' : 'Belum'}</span>
                    </span>
                  </div>

                  <div className="pl-[52px] mt-3 space-y-1">
                    <p className="text-xs text-slate-500 uppercase font-medium">Akun Internal</p>
                    <p className={cn('text-sm font-semibold', internalAccount ? 'text-slate-800 dark:text-slate-200' : 'text-amber-600')}>
                      {internalAccount?.accountName || 'Belum dipasangkan'}
                    </p>
                    <p className="text-xs font-semibold text-slate-500">
                      {apiAccount.externalGroupName || 'Tanpa manager'}{apiAccount.externalGroupId ? ` / BM ID: ${apiAccount.externalGroupId}` : ''}
                    </p>
                  </div>

                  {canEdit && (
                    <MobileCardActions
                      className="ml-[52px] mt-3"
                      actions={[
                        { icon: Link2, label: mapping ? 'Ganti Pairing' : 'Pasangkan', onClick: () => openApiMappingDialog(apiAccount) },
                        { icon: Edit, label: 'Edit API', onClick: () => openEditApiAccountDialog(apiAccount) },
                        ...(mapping ? [{ icon: Unlink, label: 'Lepas', onClick: () => void handleRemoveApiMapping(mapping) }] : []),
                        ...(canDelete ? [{ danger: true, icon: Trash2, label: 'Hapus API', onClick: () => setApiDeletingAccount(apiAccount) }] : []),
                      ]}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderRelationEmptyState = (title: string, description: string) => (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
      <div className="p-4 rounded-full bg-slate-50 dark:bg-slate-900 mb-4">
        <Users className="w-8 h-8 text-slate-300" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">{title}</h3>
      <p className="text-slate-500 text-sm max-w-sm mx-auto mt-1">{description}</p>
    </div>
  );

  const openRelationDetail = (
    type: 'cs' | 'advertiser',
    title: string,
    subtitle: string,
    accounts: AdAccount[],
  ) => {
    setRelationDetail({
      type,
      title,
      subtitle,
      accounts: [...accounts].sort((left, right) => left.accountName.localeCompare(right.accountName)),
    });
  };

  const renderRelationDetailDialog = () => {
    if (!relationDetail) return null;

    const liveCount = relationDetail.accounts.filter(isIntegrationEnabled).length;
    const issueCount = relationDetail.accounts.filter((account) =>
      hasAssignmentIssue(account) || isUnmatchedAccount(account)
    ).length;

    return (
      <Dialog open={Boolean(relationDetail)} onOpenChange={(open) => !open && setRelationDetail(null)}>
        <DialogContent className="max-w-6xl rounded-[28px] border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-slate-950 dark:text-slate-50">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                  <Users className="h-5 w-5" />
                </span>
                <span>{relationDetail.title}</span>
              </DialogTitle>
              <DialogDescription>{relationDetail.subtitle}</DialogDescription>
            </DialogHeader>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="assignmentStatusPill is-ready">
                <span className="assignmentStatusDot" />
                <span>{relationDetail.accounts.length} akun</span>
              </span>
              <span className={cn('assignmentStatusPill', liveCount > 0 ? 'is-ready' : 'is-empty')}>
                <span className="assignmentStatusDot" />
                <span>{liveCount} live ON</span>
              </span>
              <span className={cn('assignmentStatusPill', issueCount > 0 ? 'is-partial' : 'is-ready')}>
                <span className="assignmentStatusDot" />
                <span>{issueCount} issue</span>
              </span>
            </div>
          </div>

          <div className="max-h-[68vh] overflow-auto px-6 py-5">
            <div className="tablePanel">
              <DataTable
                cellY={12}
                columns={[64, 260, 190, 220, 220, 190, 130, 130]}
                minWidth={1404}
                rowMinHeight={72}
              >
                <table>
                  <thead>
                    <tr>
                      <th className="text-center">No</th>
                      <th>Nama Akun</th>
                      <th>Platform</th>
                      <th>Advertiser</th>
                      <th>CS Aktif</th>
                      <th>Sub Channel</th>
                      <th className="text-center">Live Ads</th>
                      <th className="text-center">Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relationDetail.accounts.map((account, index) => {
                      const activeAssignment = getActiveAssignment(account.id);
                      const activeOwner = getActiveOwnerAssignment(account.id);
                      const platform = platforms.find((item) => item.id === account.platformId);
                      const effectiveAdvertiserId = activeOwner?.advertiserId || account.advertiserId;
                      const effectiveSubChannelId = account.subChannelId || activeAssignment?.subChannelId;
                      const hasIssue = hasAssignmentIssue(account) || isUnmatchedAccount(account);

                      return (
                        <tr key={account.id}>
                          <td className="monoCell text-center">{index + 1}</td>
                          <td>
                            <TableText
                              primary={account.accountName}
                              secondary={getBusinessManagerLabel(account)}
                            />
                          </td>
                          <td>
                            <div className="platformLogoTableCell">
                              <PlatformLogo
                                density="compact"
                                logoPath={platform?.logoPath}
                                name={platform?.name || getPlatformName(account.platformId)}
                                size="sm"
                              />
                              <TableText primary={platform?.name || getPlatformName(account.platformId)} />
                            </div>
                          </td>
                          <td>
                            <TableText
                              primary={getAdvertiserName(effectiveAdvertiserId)}
                              secondary={activeOwner ? `Sejak ${activeOwner.startDate}` : 'Fallback master akun'}
                              primaryClassName={!effectiveAdvertiserId ? 'text-amber-600 dark:text-amber-300' : undefined}
                            />
                          </td>
                          <td>
                            <TableText
                              primary={activeAssignment ? getUserName(activeAssignment.csId) : 'Belum diset'}
                              secondary={activeAssignment ? `Sejak ${activeAssignment.startDate}` : 'Perlu assignment'}
                              primaryClassName={!activeAssignment ? 'text-amber-600 dark:text-amber-300' : undefined}
                            />
                          </td>
                          <td>
                            <TableText
                              primary={effectiveSubChannelId ? getSubChannelName(effectiveSubChannelId) : 'Tidak dikunci'}
                              primaryClassName={!effectiveSubChannelId ? 'text-slate-400 dark:text-slate-500' : undefined}
                            />
                          </td>
                          <td className="tableIconCell text-center">
                            <span className={cn('assignmentStatusPill', isIntegrationEnabled(account) ? 'is-ready' : 'is-empty')}>
                              <span className="assignmentStatusDot" />
                              <span>{isIntegrationEnabled(account) ? 'ON' : 'OFF'}</span>
                            </span>
                          </td>
                          <td className="tableIconCell text-center">
                            <span className={cn('assignmentStatusPill', hasIssue ? 'is-partial' : 'is-ready')}>
                              <span className="assignmentStatusDot" />
                              <span>{hasIssue ? 'Perlu cek' : 'Clear'}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </DataTable>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const renderCsRelationTable = () => {
    if (csRelationRows.length === 0) {
      return renderRelationEmptyState('Belum ada relasi CS', 'Relasi CS akan muncul dari assignment akun iklan.');
    }

    return (
      <div className="mb-8 last:mb-0">
        <MasterDataTableTitle title="Relasi CS" count={csRelationRows.length} variant="active" />
        <div className="tablePanel">
          <DataTable
            cellY={12}
            columns={[72, 240, 120, 280, 220, 220, 120, 120]}
            minWidth={1392}
            rowMinHeight={72}
          >
            <table>
              <thead>
                <tr>
                  <th className="text-center">No</th>
                  <th>CS</th>
                  <th className="text-center">Akun</th>
                  <th>Advertiser</th>
                  <th>Platform</th>
                  <th>Sub Channel</th>
                  <th className="text-center">Live ON</th>
                  <th className="text-center">Issue</th>
                </tr>
              </thead>
              <tbody>
                {csRelationRows.map((row, index) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/60"
                    role="button"
                    tabIndex={0}
                    onClick={() => openRelationDetail('cs', row.label, `${row.accounts.length} akun terkait ${row.secondary.toLowerCase()}.`, row.accounts)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openRelationDetail('cs', row.label, `${row.accounts.length} akun terkait ${row.secondary.toLowerCase()}.`, row.accounts);
                      }
                    }}
                  >
                    <td className="monoCell text-center">{index + 1}</td>
                    <td>
                      <TableText
                        primary={row.label}
                        secondary={row.secondary}
                        primaryClassName={row.id === 'unassigned-cs' ? 'text-amber-600 dark:text-amber-300' : undefined}
                      />
                    </td>
                    <td className="monoCell text-center">{row.accounts.length}</td>
                    <td><TableText primary={formatNameSet(row.advertisers)} /></td>
                    <td><TableText primary={formatNameSet(row.platforms)} /></td>
                    <td><TableText primary={formatNameSet(row.subChannels)} /></td>
                    <td className="monoCell text-center">{row.liveCount}/{row.accounts.length}</td>
                    <td className={cn('monoCell text-center', row.issueCount > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600')}>
                      {row.issueCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        </div>
      </div>
    );
  };

  const renderAdvertiserRelationTable = () => {
    if (advertiserRelationRows.length === 0) {
      return renderRelationEmptyState('Belum ada relasi advertiser', 'Relasi advertiser akan muncul dari owner assignment akun iklan.');
    }

    return (
      <div className="mb-8 last:mb-0">
        <MasterDataTableTitle title="Relasi Advertiser" count={advertiserRelationRows.length} variant="active" />
        <div className="tablePanel">
          <DataTable
            cellY={12}
            columns={[72, 260, 120, 280, 220, 220, 120, 120]}
            minWidth={1412}
            rowMinHeight={72}
          >
            <table>
              <thead>
                <tr>
                  <th className="text-center">No</th>
                  <th>Advertiser</th>
                  <th className="text-center">Akun</th>
                  <th>CS</th>
                  <th>Platform</th>
                  <th>Sub Channel</th>
                  <th className="text-center">Live ON</th>
                  <th className="text-center">Issue</th>
                </tr>
              </thead>
              <tbody>
                {advertiserRelationRows.map((row, index) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/60"
                    role="button"
                    tabIndex={0}
                    onClick={() => openRelationDetail('advertiser', row.label, `${row.accounts.length} akun terkait ${row.secondary.toLowerCase()}.`, row.accounts)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openRelationDetail('advertiser', row.label, `${row.accounts.length} akun terkait ${row.secondary.toLowerCase()}.`, row.accounts);
                      }
                    }}
                  >
                    <td className="monoCell text-center">{index + 1}</td>
                    <td><TableText primary={row.label} secondary={row.secondary} /></td>
                    <td className="monoCell text-center">{row.accounts.length}</td>
                    <td><TableText primary={formatNameSet(row.csNames)} /></td>
                    <td><TableText primary={formatNameSet(row.platforms)} /></td>
                    <td><TableText primary={formatNameSet(row.subChannels)} /></td>
                    <td className="monoCell text-center">{row.liveCount}/{row.accounts.length}</td>
                    <td className={cn('monoCell text-center', row.issueCount > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600')}>
                      {row.issueCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        </div>
      </div>
    );
  };

  return (
    <div className="masterDataTabSurface">
      {/* Search Toolbar */}
      <ControlPanel aria-label="Filter akun iklan">
        <ControlRow className="masterDataControlRow">
          <SearchBox
            placeholder="Cari akun atau advertiser..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {(canCreate || accountView === 'api') && (
            <div className="masterDataControlActions">
            {accountView === 'api' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void refreshApiFoundation()}
                disabled={apiSyncing}
              >
                <RefreshCw className={apiSyncing ? 'animate-spin' : undefined} /> Refresh API
              </Button>
            )}
            {canCreate && (
              accountView === 'api' ? (
                <Button className="masterDataActionButton" onClick={openAddApiAccountDialog}>
                  <Plus /> Tambah Akun API
                </Button>
              ) : (
                <Button 
                  className="masterDataActionButton"
                  onClick={() => {
                    setEditingItem(null);
                    setIsAddOpen(true);
                    void refreshLiveRegistries();
                  }}
                >
                  <Plus /> Tambah Akun
                </Button>
              )
            )}
            </div>
              )}
        </ControlRow>
      </ControlPanel>

      <div className="adAccountViewSwitch" role="tablist" aria-label="Tampilan akun iklan">
        {viewTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={accountView === tab.id}
            className={cn('adAccountViewSwitchItem', accountView === tab.id && 'isActive')}
            onClick={() => setAccountView(tab.id)}
          >
            <span>{tab.label}</span>
            <strong>{tab.count}</strong>
          </button>
        ))}
      </div>

      {accountView === 'api' ? (
        renderApiIntegrationTable()
      ) : accountView === 'cs-relations' ? (
        renderCsRelationTable()
      ) : accountView === 'advertiser-relations' ? (
        renderAdvertiserRelationTable()
      ) : filteredData.length > 0 ? (
         <>
           {renderTable(activeData, "Akun Aktif", 'active')}
           {renderTable(inactiveData, "Akun Non-Aktif", 'inactive')}
         </>
      ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
               <div className="p-4 rounded-full bg-slate-50 dark:bg-slate-900 mb-4">
                   <Monitor className="w-8 h-8 text-slate-300" />
               </div>
               <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Tidak ada data akun iklan</h3>
               <p className="text-slate-500 text-sm max-w-xs mx-auto mt-1">
                   {search ? 'Tidak ditemukan data yang sesuai dengan pencarian Anda.' : 'Belum ada data akun iklan yang ditambahkan.'}
               </p>
          </div>
      )}

      {renderRelationDetailDialog()}

      <Dialog open={isApiAccountDialogOpen} onOpenChange={(open) => {
        if (open) {
          setIsApiAccountDialogOpen(true);
          return;
        }
        apiAccountCloseGuard.requestClose();
      }}>
        <MasterDataFormDialogContent size="wide">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Link2 className="h-5 w-5 text-blue-600" />
              {apiAccountDialogItem ? 'Edit Akun API' : 'Tambah Akun API'}
            </DialogTitle>
            <DialogDescription>
              Registry akun ads live untuk dipasangkan ke master akun iklan internal.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {!apiAccountDialogItem && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <MasterDataFieldLabel
                    info={{
                      title: 'Akun API dari Backend',
                      description: 'Pilih akun yang sudah tersimpan di registry API. ID, status, business manager, dan mata uang akan terisi otomatis. Jika akun belum ada, pilih input manual.',
                    }}
                  >
                    Akun API dari Backend
                  </MasterDataFieldLabel>
                  <Select value={selectedBackendApiKey} onValueChange={handleSelectBackendApiAccount}>
                    <SelectTrigger className="bg-white dark:bg-slate-900">
                      <SelectValue placeholder="Pilih akun backend yang sudah sync" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900">
                      <SelectItem value="manual-entry">Input manual akun baru</SelectItem>
                      {apiAccountBackendOptions.map((account) => {
                        const value = `${account.platformKey}:${account.externalAccountId}`;
                        return (
                          <SelectItem key={value} value={value}>
                            {getPlatformLabelByKey(account.platformKey)} - {account.externalAccountName} / {account.externalAccountId}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <MasterDataFieldLabel
                    info={{
                      title: 'Pasangkan ke Akun Internal',
                      description: 'Daftar ini berasal dari Master Data Akun Iklan. Jika dipilih, registry API akan langsung dibuat dan dipasangkan ke akun internal saat form disimpan.',
                    }}
                  >
                    Pasangkan ke Akun Internal
                  </MasterDataFieldLabel>
                  <Select value={apiAccountInternalId} onValueChange={handleSelectApiAccountInternal}>
                    <SelectTrigger className="bg-white dark:bg-slate-900">
                      <SelectValue placeholder="Pilih master akun iklan" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900">
                      <SelectItem value="none">Belum dipasangkan</SelectItem>
                      {apiAccountInternalOptions.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.accountName} - {getPlatformName(account.platformId)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <MasterDataFieldLabel
                  required
                  info={{
                    title: 'Platform',
                    description: 'Platform diambil dari Master Data Platform, lalu dibatasi ke platform yang sudah punya konektor API: Meta, Google, dan Tiktok.',
                  }}
                >
                  Platform
                </MasterDataFieldLabel>
                <Select
                  value={apiAccountPlatformKey}
                  onValueChange={(value) => {
                    setApiAccountPlatformKey(value as AdsPlatformKey);
                    setApiAccountInternalId('none');
                  }}
                  disabled={Boolean(apiAccountDialogItem) || selectedBackendApiKey !== 'manual-entry'}
                >
                  <SelectTrigger className="bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Pilih platform" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900">
                    {apiPlatformOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <MasterDataFieldLabel
                  required
                  info={{
                    title: 'ID Akun API',
                    description: 'ID akun asli dari platform ads. Contoh Meta memakai act_..., Google memakai customer ID, dan Tiktok memakai advertiser ID.',
                  }}
                >
                  ID Akun API
                </MasterDataFieldLabel>
                <Input
                  value={apiAccountExternalId}
                  onChange={(event) => setApiAccountExternalId(event.target.value)}
                  placeholder="Contoh: act_123 / 987654321"
                  className="bg-white dark:bg-slate-900"
                  disabled={Boolean(apiAccountDialogItem) || selectedBackendApiKey !== 'manual-entry'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <MasterDataFieldLabel
                required
                info={{
                  title: 'Nama Akun API',
                  description: 'Nama ini berasal dari backend/API jika dipilih dari registry. Jika input manual, isi nama akun seperti yang tampil di platform ads.',
                }}
              >
                Nama Akun API
              </MasterDataFieldLabel>
              <Input
                value={apiAccountExternalName}
                onChange={(event) => setApiAccountExternalName(event.target.value)}
                placeholder="Contoh: Google Ads 2"
                className="bg-white dark:bg-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">ID Business / Manager</label>
                <Input
                  value={apiAccountGroupId}
                  onChange={(event) => setApiAccountGroupId(event.target.value)}
                  placeholder="Opsional"
                  className="bg-white dark:bg-slate-900"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama Business / Manager</label>
                <Input
                  value={apiAccountGroupName}
                  onChange={(event) => setApiAccountGroupName(event.target.value)}
                  placeholder="Opsional"
                  className="bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <MasterDataFieldLabel
                  info={{
                    title: 'Status API',
                    description: 'Status dari akun platform. Manual berarti akun dibuat dari input manual, bukan hasil sync live langsung.',
                  }}
                >
                  Status API
                </MasterDataFieldLabel>
                <Select value={apiAccountStatus || 'UNKNOWN'} onValueChange={setApiAccountStatus}>
                  <SelectTrigger className="bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Pilih status API" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900">
                    {apiAccountStatusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status === 'manual' ? 'Manual' : status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <MasterDataFieldLabel
                  info={{
                    title: 'Mata Uang',
                    description: 'Mata uang/currency akun ads. Ini bukan threshold billing atau limit spending.',
                  }}
                >
                  Mata Uang
                </MasterDataFieldLabel>
                <Select value={apiAccountCurrency || 'IDR'} onValueChange={setApiAccountCurrency}>
                  <SelectTrigger className="bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Pilih mata uang" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900">
                    {apiAccountCurrencyOptions.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={apiAccountCloseGuard.requestClose}
              disabled={apiAccountSaving}
            >
              Batal
            </Button>
            <Button onClick={handleSaveApiAccount} disabled={apiAccountSaving}>
              {apiAccountSaving ? 'Menyimpan...' : 'Simpan Akun API'}
            </Button>
          </div>
        </MasterDataFormDialogContent>
        <MasterDataUnsavedChangesDialog
          open={apiAccountCloseGuard.isConfirmOpen}
          onCancel={apiAccountCloseGuard.cancelClose}
          onConfirm={apiAccountCloseGuard.confirmClose}
        />
      </Dialog>

      <Dialog open={Boolean(apiMappingDialogAccount)} onOpenChange={(open) => {
        if (open) return;
        apiMappingCloseGuard.requestClose();
      }}>
        <MasterDataFormDialogContent size="wide">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Link2 className="h-5 w-5 text-blue-600" />
              Pasangkan Akun API
            </DialogTitle>
            <DialogDescription>
              Hubungkan {apiMappingDialogAccount?.externalAccountName || 'akun API'} ke master akun internal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Akun API</p>
              <div className="mt-2 flex items-center gap-3">
                {apiMappingDialogAccount && (
                  <PlatformLogo
                    density="compact"
                    logoPath={getPlatformByKey(apiMappingDialogAccount.platformKey)?.logoPath}
                    name={getPlatformByKey(apiMappingDialogAccount.platformKey)?.name || getPlatformLabelByKey(apiMappingDialogAccount.platformKey)}
                    size="sm"
                  />
                )}
                <div>
                  <strong className="block text-sm font-bold text-slate-900 dark:text-slate-100">
                    {apiMappingDialogAccount?.externalAccountName || '-'}
                  </strong>
                  <span className="text-xs font-semibold text-slate-500">
                    {apiMappingDialogAccount ? `${getPlatformLabelByKey(apiMappingDialogAccount.platformKey)} / ${apiMappingDialogAccount.externalAccountId}` : '-'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Akun Internal <span className="text-red-500">*</span>
              </label>
              <Select value={apiMappingInternalId} onValueChange={setApiMappingInternalId}>
                <SelectTrigger className="bg-white dark:bg-slate-900">
                  <SelectValue placeholder="Pilih akun internal" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900">
                  {apiMappingCandidates.map((account) => {
                    const existingMapping = getApiMappingForInternalAccount(account.id);
                    return (
                      <SelectItem key={account.id} value={account.id}>
                        {account.accountName}{existingMapping ? ' - sudah ada pairing' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {apiMappingCandidates.length === 0 && (
                <p className="text-xs font-semibold text-amber-600">
                  Belum ada akun internal dengan platform yang sesuai.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Catatan Pairing
              </label>
              <Textarea
                value={apiMappingNotes}
                onChange={(event) => setApiMappingNotes(event.target.value)}
                placeholder="Contoh: match manual karena nama akun live berbeda dengan master data."
                className="min-h-[84px] bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={apiMappingCloseGuard.requestClose}
              disabled={apiMappingSaving}
            >
              Batal
            </Button>
            <Button onClick={handleSaveApiMapping} disabled={apiMappingSaving || apiMappingCandidates.length === 0}>
              Simpan Pairing
            </Button>
          </div>
        </MasterDataFormDialogContent>
        <MasterDataUnsavedChangesDialog
          open={apiMappingCloseGuard.isConfirmOpen}
          onCancel={apiMappingCloseGuard.cancelClose}
          onConfirm={apiMappingCloseGuard.confirmClose}
        />
      </Dialog>

      <Dialog open={Boolean(ownerDialogItem)} onOpenChange={(open) => {
        if (open) return;
        ownerCloseGuard.requestClose();
      }}>
        <MasterDataFormDialogContent size="wide">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Users className="h-5 w-5 text-indigo-600" />
              Advertiser Pemilik Akun
            </DialogTitle>
            <DialogDescription>
              Atur advertiser aktif untuk akun {ownerDialogItem?.accountName || 'iklan'} mulai tanggal tertentu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Advertiser <span className="text-red-500">*</span>
              </label>
              <Select value={ownerAdvertiserId} onValueChange={setOwnerAdvertiserId}>
                <SelectTrigger className="bg-white dark:bg-slate-900">
                  <SelectValue placeholder="Pilih advertiser" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900">
                  {advertisers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Mulai Tanggal <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={ownerStartDate}
                onChange={(event) => setOwnerStartDate(event.target.value)}
                className="bg-white dark:bg-slate-900"
              />
              <p className="text-xs text-slate-500">
                Data sebelum tanggal ini tetap mengikuti advertiser lama saat proses rekap.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Catatan Perpindahan
              </label>
              <Textarea
                value={ownerNotes}
                onChange={(event) => setOwnerNotes(event.target.value)}
                placeholder="Contoh: advertiser resign, pindah PIC, atau koreksi ownership."
                className="min-h-[84px] bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={ownerCloseGuard.requestClose}
              disabled={ownerSaving}
            >
              Batal
            </Button>
            <Button onClick={handleSaveOwner} disabled={ownerSaving}>
              Simpan Advertiser
            </Button>
          </div>
        </MasterDataFormDialogContent>
        <MasterDataUnsavedChangesDialog
          open={ownerCloseGuard.isConfirmOpen}
          onCancel={ownerCloseGuard.cancelClose}
          onConfirm={ownerCloseGuard.confirmClose}
        />
      </Dialog>

      <Dialog open={Boolean(assignmentDialogItem)} onOpenChange={(open) => {
        if (open) return;
        assignmentCloseGuard.requestClose();
      }}>
        <MasterDataFormDialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <UserCheck className="h-5 w-5 text-emerald-600" />
              CS Penanggung Jawab
            </DialogTitle>
            <DialogDescription>
              Atur CS aktif untuk akun {assignmentDialogItem?.accountName || 'iklan'} mulai tanggal tertentu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                CS <span className="text-red-500">*</span>
              </label>
              <Select value={assignmentCsId} onValueChange={setAssignmentCsId}>
                <SelectTrigger className="bg-white dark:bg-slate-900">
                  <SelectValue placeholder="Pilih CS" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900">
                  {csUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Subchannel Default</label>
              <Select value={assignmentSubChannelId} onValueChange={setAssignmentSubChannelId}>
                <SelectTrigger className="bg-white dark:bg-slate-900">
                  <SelectValue placeholder="Opsional" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900">
                  <SelectItem value="none">Tidak dikunci</SelectItem>
                  {subChannels
                    .filter((subChannel) =>
                      !assignmentDialogItem ||
                      subChannel.platformId === assignmentDialogItem.platformId
                    )
                    .map((subChannel) => (
                      <SelectItem key={subChannel.id} value={subChannel.id}>{subChannel.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Mulai Tanggal <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={assignmentStartDate}
                onChange={(event) => setAssignmentStartDate(event.target.value)}
                className="bg-white dark:bg-slate-900"
              />
              <p className="text-xs text-slate-500">
                Data sebelum tanggal ini tetap mengikuti CS lama.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Catatan Perpindahan
              </label>
              <Textarea
                value={assignmentNotes}
                onChange={(event) => setAssignmentNotes(event.target.value)}
                placeholder="Contoh: CS resign, rolling shift, atau akun dialihkan ke CS lain."
                className="min-h-[84px] bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={assignmentCloseGuard.requestClose}
              disabled={assignmentSaving}
            >
              Batal
            </Button>
            <Button onClick={handleSaveAssignment} disabled={assignmentSaving}>
              Simpan CS
            </Button>
          </div>
        </MasterDataFormDialogContent>
        <MasterDataUnsavedChangesDialog
          open={assignmentCloseGuard.isConfirmOpen}
          onCancel={assignmentCloseGuard.cancelClose}
          onConfirm={assignmentCloseGuard.confirmClose}
        />
      </Dialog>

      <Dialog open={Boolean(historyItem)} onOpenChange={(open) => {
        if (!open) setHistoryItem(null);
      }}>
        <DialogContent className="sm:max-w-[760px] bg-white dark:bg-slate-900 border-none shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <History className="h-5 w-5 text-blue-600" />
              Riwayat Assignment Akun
            </DialogTitle>
            <DialogDescription>
              Jejak perpindahan advertiser dan CS untuk {historyItem?.accountName || 'akun iklan'}.
            </DialogDescription>
          </DialogHeader>

          {historyItem && (
            <div className="assignmentHistoryGrid">
              <div className="assignmentHistoryPanel">
                <div className="assignmentHistoryHeading">
                  <Users className="h-4 w-4" />
                  <span>Advertiser</span>
                </div>
                <div className="assignmentHistoryList">
                  {adAccountOwnerAssignments
                    .filter((assignment) => assignment.adAccountId === historyItem.id)
                    .sort((left, right) => right.startDate.localeCompare(left.startDate))
                    .map((assignment) => (
                      <div key={assignment.id} className="assignmentHistoryItem">
                        <strong>{getAdvertiserName(assignment.advertiserId)}</strong>
                        <span>{formatAssignmentPeriod(assignment.startDate, assignment.endDate)}</span>
                        {assignment.notes && <p>{assignment.notes}</p>}
                      </div>
                    ))}
                  {!adAccountOwnerAssignments.some((assignment) => assignment.adAccountId === historyItem.id) && (
                    <div className="assignmentHistoryEmpty">Belum ada riwayat advertiser.</div>
                  )}
                </div>
              </div>

              <div className="assignmentHistoryPanel">
                <div className="assignmentHistoryHeading">
                  <UserCheck className="h-4 w-4" />
                  <span>CS</span>
                </div>
                <div className="assignmentHistoryList">
                  {adAccountAssignments
                    .filter((assignment) => assignment.adAccountId === historyItem.id)
                    .sort((left, right) => right.startDate.localeCompare(left.startDate))
                    .map((assignment) => (
                      <div key={assignment.id} className="assignmentHistoryItem">
                        <strong>{getUserName(assignment.csId)}</strong>
                        <span>
                          {formatAssignmentPeriod(assignment.startDate, assignment.endDate)}
                          {assignment.subChannelId ? ` / ${getSubChannelName(assignment.subChannelId)}` : ''}
                        </span>
                        {assignment.notes && <p>{assignment.notes}</p>}
                      </div>
                    ))}
                  {!adAccountAssignments.some((assignment) => assignment.adAccountId === historyItem.id) && (
                    <div className="assignmentHistoryEmpty">Belum ada riwayat CS.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(apiDeletingAccount)} onOpenChange={(open) => {
        if (!open) setApiDeletingAccount(null);
      }}>
        <AlertDialogContent className="bg-white dark:bg-slate-800 dark:border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-slate-200">Hapus Akun API</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-slate-400">
              Akun <strong>{apiDeletingAccount?.externalAccountName}</strong> akan dihapus dari registry API.
              Pairing aktif yang memakai akun ini juga akan dilepas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="dangerButton"
              onClick={() => {
                if (apiDeletingAccount) void handleDeleteApiAccount(apiDeletingAccount);
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deletingItem)} onOpenChange={(open) => {
        if (!open) setDeletingItem(null);
      }}>
        <AlertDialogContent className="bg-white dark:bg-slate-800 dark:border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-slate-200">Hapus Akun Iklan</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-slate-400">
              Apakah anda yakin ingin menghapus akun <strong>{deletingItem?.accountName}</strong>?
              <br />Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="dangerButton"
              onClick={() => {
                if (deletingItem) void handleDelete(deletingItem.id);
                setDeletingItem(null);
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(statusToggleItem)} onOpenChange={(open) => {
        if (!open) setStatusToggleItem(null);
      }}>
        <AlertDialogContent className="bg-white dark:bg-slate-800 dark:border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-slate-200">Nonaktifkan Akun Iklan</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-slate-400">
              Akun <strong>{statusToggleItem?.accountName}</strong> akan dipindahkan ke status OFF.
              Akun tidak hilang, dan bisa diaktifkan kembali dari switch ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="dangerButton"
              onClick={() => {
                if (statusToggleItem) void updateAccountStatus(statusToggleItem, 'inactive');
                setStatusToggleItem(null);
              }}
            >
              Nonaktifkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkStatusTarget === 'inactive'} onOpenChange={(open) => {
        if (!open) setBulkStatusTarget(null);
      }}>
        <AlertDialogContent className="bg-white dark:bg-slate-800 dark:border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-slate-200">Nonaktifkan Akun Terpilih</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-slate-400">
              {selectedAccounts.length} akun iklan akan dipindahkan ke status OFF.
              Data, histori, assignment, dan pairing API tetap tersimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="dangerButton"
              disabled={bulkStatusSaving}
              onClick={() => void applyBulkStatus('inactive')}
            >
              {bulkStatusSaving ? 'Memproses...' : 'Nonaktifkan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Modal */}
      <Dialog open={isAddOpen} onOpenChange={requestFormDialogOpenChange}>
        <MasterDataFormDialogContent size="wide">
          <DialogHeader className="px-6 py-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-blue-600" />
                {editingItem ? 'Edit Akun Iklan' : 'Tambah Akun Iklan'}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Kelola data akun iklan dan advertiser.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 overflow-y-auto bg-slate-50/50 dark:bg-slate-950">
            <AdAccountForm 
              item={editingItem}
              platforms={activePlatforms}
              subChannels={subChannels}
              advertisers={advertisers}
              liveMetaAccounts={liveMetaData?.accounts || []}
              liveMetaError={liveMetaError}
              liveMetaLoading={liveMetaLoading}
              metaIntegrationConfig={
                editingItem ? integrationConfigs[editingItem.id] || null : null
              }
              onRefreshMetaRegistry={() => void loadMetaRegistry()}
              liveGoogleAccounts={liveGoogleData?.accounts || []}
              liveGoogleError={liveGoogleError}
              liveGoogleLoading={liveGoogleLoading}
              googleIntegrationConfig={
                editingItem ? googleIntegrationConfigs[editingItem.id] || null : null
              }
              onRefreshGoogleRegistry={() => void loadGoogleRegistry()}
              liveTikTokAdvertisers={liveTikTokAdvertisers}
              liveTikTokBusinessCenters={liveTikTokBusinessCenters}
              liveTikTokError={liveTikTokError}
              liveTikTokLoading={liveTikTokLoading}
              tiktokIntegrationConfig={
                editingItem ? tiktokIntegrationConfigs[editingItem.id] || null : null
              }
              onRefreshTikTokRegistry={() => void loadTikTokRegistry()}
              onSubmit={handleSubmit}
              onDirtyChange={setIsFormDirty}
              onCancel={formCloseGuard.requestClose}
            />
          </div>
        </MasterDataFormDialogContent>
        <MasterDataUnsavedChangesDialog
          open={formCloseGuard.isConfirmOpen}
          onCancel={formCloseGuard.cancelClose}
          onConfirm={formCloseGuard.confirmClose}
        />
      </Dialog>
    </div>
  );
};
