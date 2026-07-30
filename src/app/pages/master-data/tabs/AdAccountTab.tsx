import React, { useEffect, useMemo, useState } from 'react';
import { 
  Plus, Filter, Edit, Trash2,
  Monitor, CheckCircle2, XCircle, UserCheck, Users
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { ControlPanel, ControlRow, SearchBox } from '../../../components/ui/control-panel';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../../../components/ui/table';
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
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog"
import { Badge } from '../../../components/ui/badge';
import { Checkbox } from '../../../components/ui/checkbox';
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

interface AdAccountTabProps {
  currentRole: Role;
}

export const AdAccountTab: React.FC<AdAccountTabProps> = ({ currentRole: _currentRole }) => {
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
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdAccount | null>(null);
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
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [ownerDialogItem, setOwnerDialogItem] = useState<AdAccount | null>(null);
  const [ownerAdvertiserId, setOwnerAdvertiserId] = useState('');
  const [ownerStartDate, setOwnerStartDate] = useState(() => getTodayDateKey());
  const [ownerSaving, setOwnerSaving] = useState(false);

  const canCreate = hasPermission('master_data.create');
  const canEdit = hasPermission('master_data.edit');
  const canDelete = hasPermission('master_data.delete');

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
  const metaPlatform = platforms.find(p => isMetaPlatformName(p.name));
  const googlePlatform = platforms.find(p => isGooglePlatformName(p.name));
  const tiktokPlatform = platforms.find(p => isTikTokPlatformName(p.name));

  const getPlatformName = (id: string) => platforms.find(p => p.id === id)?.name || 'Unknown';
  const getAdvertiserName = (id: string) => users.find(u => u.id === id)?.name || 'Unknown';
  const getUserName = (id?: string | null) => users.find(u => u.id === id)?.name || 'Belum diset';
  const getSubChannelName = (id?: string | null) => subChannels.find(s => s.id === id)?.name || '-';
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
      const [configs, googleConfigs, tiktokConfigs] = await Promise.all([
        fetchAdsIntegrationConfigs(),
        fetchGoogleAdsIntegrationConfigs(),
        fetchTikTokAdsIntegrationConfigs(),
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
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadMetaRegistry = React.useCallback(async () => {
    if (!metaPlatform) return;

    setLiveMetaLoading(true);
    try {
      const today = new Date();
      const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const to = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const payload = await fetchMetaLiveBreakdown({ from, to });
      setLiveMetaData(payload);
      setLiveMetaError(payload.cacheStatus === 'stale' ? payload.cacheMessage || null : null);
    } catch (error) {
      setLiveMetaError(error instanceof Error ? error.message : 'Gagal memuat registry Meta live.');
    } finally {
      setLiveMetaLoading(false);
    }
  }, [metaPlatform]);

  useEffect(() => {
    void loadMetaRegistry();
  }, [loadMetaRegistry]);

  const loadGoogleRegistry = React.useCallback(async () => {
    if (!googlePlatform) return;

    setLiveGoogleLoading(true);
    try {
      const today = new Date();
      const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const to = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const payload = await fetchGoogleAdsLiveBreakdown({ from, to });
      setLiveGoogleData(payload);
      setLiveGoogleError(payload.cacheStatus === 'stale' ? payload.cacheMessage || null : null);
    } catch (error) {
      setLiveGoogleError(
        error instanceof Error ? error.message : 'Gagal memuat registry Google Ads live.',
      );
    } finally {
      setLiveGoogleLoading(false);
    }
  }, [googlePlatform]);

  useEffect(() => {
    void loadGoogleRegistry();
  }, [loadGoogleRegistry]);

  const loadTikTokRegistry = React.useCallback(async () => {
    if (!tiktokPlatform) return;

    setLiveTikTokLoading(true);
    try {
      const [businessCenters, advertisers] = await Promise.all([
        fetchTikTokBusinessCenters(),
        fetchTikTokAdvertisers(),
      ]);
      setLiveTikTokBusinessCenters(businessCenters);
      setLiveTikTokAdvertisers(advertisers);
      setLiveTikTokError(null);
    } catch (error) {
      setLiveTikTokError(
        error instanceof Error ? error.message : 'Gagal memuat registry TikTok Ads live.',
      );
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

  const getBusinessManagerLabel = React.useCallback(
    (item: AdAccount) => {
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
      const platformName = getPlatformName(item.platformId);
      if (isGooglePlatformName(platformName)) {
        return googleIntegrationConfigs[item.id]?.enabled ?? item.status === 'active';
      }

      if (isTikTokPlatformName(platformName)) {
        return tiktokIntegrationConfigs[item.id]?.enabled ?? item.status === 'active';
      }

      return integrationConfigs[item.id]?.enabled ?? item.status === 'active';
    },
    [
      getPlatformName,
      googleIntegrationConfigs,
      integrationConfigs,
      isGooglePlatformName,
      isTikTokPlatformName,
      tiktokIntegrationConfigs,
    ],
  );

  const filteredData = adAccounts.filter(item => 
    item.accountName.toLowerCase().includes(search.toLowerCase()) ||
    getAdvertiserName(item.advertiserId).toLowerCase().includes(search.toLowerCase()) ||
    getBusinessManagerLabel(item).toLowerCase().includes(search.toLowerCase())
  );

  const activeData = filteredData.filter(item => item.status === 'active');
  const inactiveData = filteredData.filter(item => item.status !== 'active');

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
            isIntegrationEnabled(updatedItem),
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
            isIntegrationEnabled(updatedItem),
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
            isIntegrationEnabled(updatedItem),
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
            newItem.status === 'active',
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
            newItem.status === 'active',
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
            newItem.status === 'active',
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
        enabled ? 'Akun ditampilkan di Integrasi Iklan' : 'Akun disembunyikan dari Integrasi Iklan',
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan checklist integrasi.');
    } finally {
      setSavingConfigId(null);
    }
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
  };

  const openOwnerDialog = (item: AdAccount) => {
    const activeOwner = getActiveOwnerAssignment(item.id);
    setOwnerDialogItem(item);
    setOwnerAdvertiserId(activeOwner?.advertiserId || item.advertiserId || '');
    setOwnerStartDate(getTodayDateKey());
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
         <div className="flex items-center gap-2 mb-4 px-1">
            <div className={cn("p-1.5 rounded-lg", variant === 'active' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400")}>
                {variant === 'active' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
            <Badge variant="secondary" className="ml-2 bg-slate-100 dark:bg-slate-800 text-slate-500">
                {items.length}
            </Badge>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50 dark:bg-slate-700/50">
                <TableRow className="border-b border-slate-100 dark:border-slate-700">
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 pl-6">Platform</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Business / Manager</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Nama Akun</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">Advertiser</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4">CS Aktif</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 text-center">Integrasi</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 text-center">PPN</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 text-center">Fee</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 text-center">Status</TableHead>
                  {(canEdit || canDelete) && <TableHead className="text-right font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 pr-6">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const activeAssignment = getActiveAssignment(item.id);
                  const activeOwner = getActiveOwnerAssignment(item.id);
                  const effectiveAdvertiserId = activeOwner?.advertiserId || item.advertiserId;

                  return (
                  <TableRow key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors">
                    <TableCell className="py-4 pl-6">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
                          <Monitor className="h-4 w-4" />
                        </div>
                        <span className="font-semibold text-slate-900 dark:text-slate-200 text-sm">{getPlatformName(item.platformId)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-400">
                      {getBusinessManagerLabel(item) === 'Belum match live' ? (
                        <span className="text-slate-400 dark:text-slate-500">Belum match live</span>
                      ) : (
                        getBusinessManagerLabel(item)
                      )}
                    </TableCell>
                    <TableCell className="py-4 font-medium text-slate-900 dark:text-slate-200 text-sm">{item.accountName}</TableCell>
                    <TableCell className="py-4 text-sm">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-slate-900 dark:text-slate-200">
                          {getAdvertiserName(effectiveAdvertiserId)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {activeOwner ? `Sejak ${activeOwner.startDate}` : 'Belum ada histori'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-sm">
                      <div className="flex flex-col gap-1">
                        <span className={activeAssignment ? 'font-semibold text-slate-900 dark:text-slate-200' : 'text-amber-600 dark:text-amber-300'}>
                          {activeAssignment ? getUserName(activeAssignment.csId) : 'Belum diset'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {activeAssignment
                            ? `Sejak ${activeAssignment.startDate}${activeAssignment.subChannelId ? ` / ${getSubChannelName(activeAssignment.subChannelId)}` : ''}`
                            : 'Set agar CS View historis akurat'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={isIntegrationEnabled(item)}
                          disabled={!canEdit || savingConfigId === item.id}
                          onCheckedChange={(checked) => void handleToggleIntegration(item, checked === true)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-sm text-slate-900 dark:text-slate-200 text-center">{item.ppn ?? 0}%</TableCell>
                    <TableCell className="py-4 text-sm text-slate-900 dark:text-slate-200 text-center">{item.fee ?? 0}%</TableCell>
                    <TableCell className="py-4 text-center">
                      <Badge 
                        variant="outline"
                        className={item.status === 'active' 
                          ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800 uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-sm" 
                          : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-sm"}
                      >
                        {item.status === 'active' ? 'AKTIF' : 'NON AKTIF'}
                      </Badge>
                    </TableCell>
                    {(canEdit || canDelete) && (
                      <TableCell className="py-4 pr-6 text-right">
                        <div className="flex justify-end gap-1">
                          {canEdit && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-900/30" onClick={() => openOwnerDialog(item)} title="Ganti advertiser akun">
                              <Users className="h-4 w-4" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-900/30" onClick={() => openAssignmentDialog(item)} title="Ganti CS akun">
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/30" onClick={() => openEdit(item)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-white dark:bg-slate-800 dark:border-slate-700">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="dark:text-slate-200">Hapus Akun Iklan</AlertDialogTitle>
                                  <AlertDialogDescription className="dark:text-slate-400">
                                    Apakah anda yakin ingin menghapus akun <strong>{item.accountName}</strong>?
                                    <br/>Tindakan ini tidak dapat dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">Batal</AlertDialogCancel>
                                  <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete(item.id)}>
                                    Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
             {items.map((item) => {
                const activeOwner = getActiveOwnerAssignment(item.id);
                const effectiveAdvertiserId = activeOwner?.advertiserId || item.advertiserId;

                return (
                <div key={item.id} className="p-4 bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                           <div className={cn("p-2 rounded-lg", variant === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                                <Monitor className="w-5 h-5" />
                           </div>
                           <div className="flex flex-col">
                              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{item.accountName}</h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{getPlatformName(item.platformId)}</p>
                           </div>
                        </div>
                        <Badge 
                          variant="outline"
                          className={item.status === 'active' 
                            ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800 text-[10px] px-1.5 py-0.5 h-5" 
                            : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 text-[10px] px-1.5 py-0.5 h-5"}
                        >
                          {item.status === 'active' ? 'AKTIF' : 'NON AKTIF'}
                        </Badge>
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

                    <div className="pl-[52px] flex items-center gap-2 mb-3">
                      <Checkbox
                        checked={isIntegrationEnabled(item)}
                        disabled={!canEdit || savingConfigId === item.id}
                        onCheckedChange={(checked) => void handleToggleIntegration(item, checked === true)}
                      />
                      <span className="text-xs text-slate-600 dark:text-slate-400">Tampilkan di Integrasi Iklan</span>
                    </div>

                    {(canEdit || canDelete) && (
                       <div className="pl-[52px] flex gap-2 pt-2">
                           {canEdit && (
                             <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs h-8 text-indigo-600 border-slate-200 dark:border-slate-700"
                                onClick={() => openOwnerDialog(item)}
                             >
                                <Users className="w-3 h-3 mr-2" />
                                Adv
                             </Button>
                           )}
                           {canEdit && (
                             <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-xs h-8 text-emerald-600 border-slate-200 dark:border-slate-700"
                                onClick={() => openAssignmentDialog(item)}
                             >
                                <UserCheck className="w-3 h-3 mr-2" />
                                CS
                             </Button>
                           )}
                           {canEdit && (
                             <Button 
                                variant="outline" 
                                size="sm" 
                                className="flex-1 text-xs h-8 text-blue-600 border-slate-200 dark:border-slate-700"
                                onClick={() => openEdit(item)}
                             >
                                <Edit className="w-3 h-3 mr-2" />
                                Edit
                             </Button>
                           )}
                           {canDelete && (
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                   <Button variant="outline" size="sm" className="w-8 px-0 text-red-600 border-slate-200 dark:border-slate-700 h-8 shrink-0">
                                      <Trash2 className="w-3 h-3" />
                                   </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-white dark:bg-slate-800 dark:border-slate-700">
                                   <AlertDialogHeader>
                                      <AlertDialogTitle className="dark:text-slate-200">Hapus Akun Iklan</AlertDialogTitle>
                                      <AlertDialogDescription className="dark:text-slate-400">
                                        Apakah anda yakin ingin menghapus akun <strong>{item.accountName}</strong>?
                                      </AlertDialogDescription>
                                   </AlertDialogHeader>
                                   <AlertDialogFooter>
                                      <AlertDialogCancel className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">Batal</AlertDialogCancel>
                                      <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete(item.id)}>
                                        Hapus
                                      </AlertDialogAction>
                                   </AlertDialogFooter>
                                </AlertDialogContent>
                             </AlertDialog>
                           )}
                       </div>
                    )}
                </div>
             );})}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search Toolbar */}
      <ControlPanel aria-label="Filter akun iklan">
        <ControlRow className="sm:grid-cols-[minmax(280px,0.9fr)_max-content]">
          <SearchBox
            placeholder="Cari akun atau advertiser..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {canCreate && (
            <Button 
              className="w-full sm:w-auto sm:min-w-[220px]"
              onClick={() => {
                setEditingItem(null);
                setIsAddOpen(true);
                void refreshLiveRegistries();
              }}
            >
              <Plus /> Tambah Akun
            </Button>
              )}
        </ControlRow>
      </ControlPanel>

      {liveMetaError ? (
        <div className={cn(
          "rounded-xl px-4 py-3 text-sm",
          liveMetaData?.cacheStatus === 'stale'
            ? "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
            : "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300",
        )}>
          Live Meta sedang tidak aktif: {liveMetaError}
        </div>
      ) : null}

      {liveGoogleError ? (
        <div className={cn(
          "rounded-xl px-4 py-3 text-sm",
          liveGoogleData?.cacheStatus === 'stale'
            ? "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
            : "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300",
        )}>
          Live Google Ads sedang tidak aktif: {liveGoogleError}
        </div>
      ) : null}

      {liveTikTokError ? (
        <div
          className={cn(
            "rounded-xl px-4 py-3 text-sm",
            "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300",
          )}
        >
          Live TikTok Ads sedang tidak aktif: {liveTikTokError}
        </div>
      ) : null}

      {filteredData.length > 0 ? (
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

      <Dialog open={Boolean(ownerDialogItem)} onOpenChange={(open) => {
        if (!open) setOwnerDialogItem(null);
      }}>
        <DialogContent className="sm:max-w-[460px] bg-white dark:bg-slate-900 border-none shadow-2xl rounded-2xl">
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
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOwnerDialogItem(null)} disabled={ownerSaving}>
              Batal
            </Button>
            <Button onClick={handleSaveOwner} disabled={ownerSaving} className="bg-indigo-600 hover:bg-indigo-700">
              Simpan Advertiser
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(assignmentDialogItem)} onOpenChange={(open) => {
        if (!open) setAssignmentDialogItem(null);
      }}>
        <DialogContent className="sm:max-w-[460px] bg-white dark:bg-slate-900 border-none shadow-2xl rounded-2xl">
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
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAssignmentDialogItem(null)} disabled={assignmentSaving}>
              Batal
            </Button>
            <Button onClick={handleSaveAssignment} disabled={assignmentSaving} className="bg-emerald-600 hover:bg-emerald-700">
              Simpan CS
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 border-none shadow-2xl p-0 overflow-hidden rounded-2xl max-h-[90vh] flex flex-col">
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
              advertisers={advertisers}
              liveMetaAccounts={liveMetaData?.accounts || []}
              metaIntegrationConfig={
                editingItem ? integrationConfigs[editingItem.id] || null : null
              }
              liveGoogleAccounts={liveGoogleData?.accounts || []}
              googleIntegrationConfig={
                editingItem ? googleIntegrationConfigs[editingItem.id] || null : null
              }
              liveTikTokAdvertisers={liveTikTokAdvertisers}
              liveTikTokBusinessCenters={liveTikTokBusinessCenters}
              tiktokIntegrationConfig={
                editingItem ? tiktokIntegrationConfigs[editingItem.id] || null : null
              }
              onSubmit={handleSubmit}
              onCancel={() => setIsAddOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
