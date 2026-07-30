import React, { useState, useMemo } from 'react';
import { useMasterData } from '../master-data/context';
import { DatePickerWithRange } from '../../components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { startOfDay, endOfDay, isWithinInterval, format, eachDayOfInterval, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
    DollarSign, Users, ShoppingCart, TrendingUp, Search, 
    ArrowUpDown, BarChart3, AlertCircle, Loader2, RefreshCw, ChevronDown, CheckCircle2, TriangleAlert
} from 'lucide-react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter
} from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { 
  ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend
} from 'recharts';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';
import { usePermissions } from '@/app/hooks/usePermissions';
import { isAdvertiserRole } from '@/app/data/roleHelpers';
import { Button } from '@/app/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { PlatformLogo } from '@/app/components/ui/PlatformLogo';
import { cn } from '@/app/components/ui/utils';
import { fetchMetaSnapshotDataset, syncMetaSnapshotDataset } from '@/app/services/liveAdsService';
import { fetchGoogleAdsSnapshotDataset, syncGoogleAdsSnapshotDataset } from '@/app/services/googleAdsLiveService';
import { fetchTikTokAdsSnapshotDataset, syncTikTokAdsSnapshotDataset } from '@/app/services/tiktokAdsLiveService';
import {
  OperationalEmptyState,
  OperationalFilterPanel,
  OperationalKpiCard,
  OperationalKpiGrid,
  OperationalPageHeader,
  OperationalPageShell,
  OperationalTableCard,
} from '../../components/ui/operational-page';

type AdvertiserViewTab = 'ads-summary' | 'cs-performance';
type ApiAdsStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

type AdsSnapshotRowLike = {
  id?: string;
  platformKey?: string | null;
  snapshotDate?: string;
  internalAdAccountId?: string | null;
  advertiserId?: string | null;
  platformId?: string | null;
  externalAccountId?: string | null;
  externalAccountName?: string | null;
  spend?: number | null;
  conversions?: number | null;
};

type AdvertiserCsAccountMetric = {
  date: string;
  adAccountId: string;
  advertiserId?: string | null;
  csId?: string | null;
  subChannelId?: string | null;
  platformId?: string | null;
  platformKey: string;
  accountName: string;
  ppn: number;
  fee: number;
  spend: number;
  leads: number;
};

const advertiserCsPerfCache = new Map<string, { byDateAccount: Record<string, AdvertiserCsAccountMetric>; status: ApiAdsStatus }>();

const formatCurrency = (value: number) =>
  value > 0
    ? value.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
    : '-';

const formatNumber = (value: number) =>
  value > 0 ? value.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '-';

const formatPercent = (value: number) =>
  Number.isFinite(value) && value > 0 ? `${value.toFixed(1)}%` : '-';

const formatPercentAllowZero = (value: number) =>
  Number.isFinite(value) ? `${value.toFixed(1)}%` : '-';

const normalizeLookupKey = (value?: string | null) =>
  (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();

const resolvePlatformKey = (value?: string | null) => {
  const normalized = normalizeLookupKey(value);
  if (normalized.includes('google')) return 'google';
  if (normalized.includes('tiktok')) return 'tiktok';
  if (normalized.includes('meta') || normalized.includes('facebook') || normalized.includes('instagram')) return 'meta';
  return 'meta';
};

const apiStatusLabel = (status: ApiAdsStatus) => {
  if (status === 'ready') return 'Connected';
  if (status === 'loading') return 'Loading';
  return 'Unconnect';
};

const apiStatusClassName = (status: ApiAdsStatus) => {
  if (status === 'ready') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300';
  if (status === 'loading') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300';
  if (status === 'error') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300';
  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300';
};

const getCostPerLeadTextClass = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 'text-slate-950 dark:text-slate-100';
  if (value < 8_000) return 'text-emerald-600 dark:text-emerald-300';
  if (value <= 10_000) return 'text-amber-500 dark:text-amber-300';
  return 'text-red-600 dark:text-red-300';
};

const getConversionRateTextClass = (value: number) => {
  if (!Number.isFinite(value)) return 'text-slate-950 dark:text-slate-100';
  if (value < 10) return 'text-red-600 dark:text-red-300';
  if (value <= 12) return 'text-amber-500 dark:text-amber-300';
  return 'text-emerald-600 dark:text-emerald-300';
};

export function AdvertiserDashboard({ userId }: { userId?: string }) {
  const {
    currentUser,
    dailyAds,
    leads,
    orders,
    leadSpamDailyInputs,
    platforms,
    users,
    adAccounts,
    adAccountAssignments,
    subChannels,
  } = useMasterData();
  const { hasPermission } = usePermissions();

  // Internal selection state for Owner viewing this dashboard
  const isOwner = hasPermission('dashboard.view_owner');
  const [selectedAdvertiserId, setSelectedAdvertiserId] = useState<string>(userId || 'all');
  const [activeTab, setActiveTab] = useState<AdvertiserViewTab>('ads-summary');
  const [apiAdsByDateAccount, setApiAdsByDateAccount] = useState<Record<string, AdvertiserCsAccountMetric>>({});
  const [apiAdsStatus, setApiAdsStatus] = useState<ApiAdsStatus>('idle');
  const [apiRefreshNonce, setApiRefreshNonce] = useState(0);
  const [expandedCsDates, setExpandedCsDates] = useState<string[]>([]);
  const lastApiRefreshNonceRef = React.useRef(0);

  // Update selection if prop changes
  React.useEffect(() => {
     if (userId) setSelectedAdvertiserId(userId);
  }, [userId]);

  // Date State
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  });
  
  // Filters State
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [subChannelFilter, setSubChannelFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [csFilter, setCsFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  // Helpers
  const getPlatformName = (id: string) => platforms.find(p => p.id === id)?.name || '-';
  const getAdvertiserName = (id: string) => users.find(u => u.id === id)?.name || '-';
  const getCsName = (id?: string) => users.find(u => u.id === id)?.name || '-';
  const getSubChannelName = (id?: string) => subChannels.find(s => s.id === id)?.name || '-';
  const getAccountName = (id: string) => adAccounts.find(a => a.id === id)?.accountName || '-';
  const targetAdvertiserId = useMemo(() => {
    if (isOwner) return selectedAdvertiserId === 'all' ? undefined : selectedAdvertiserId;
    if (isAdvertiserRole(currentUser?.role)) return currentUser?.id;
    return userId;
  }, [currentUser?.id, currentUser?.role, isOwner, selectedAdvertiserId, userId]);
  const rangeParams = useMemo(() => {
    if (!dateRange?.from) return null;
    return {
      from: format(dateRange.from, 'yyyy-MM-dd'),
      to: format(dateRange.to || dateRange.from, 'yyyy-MM-dd'),
    };
  }, [dateRange]);

  const activeAdvertiserAccounts = useMemo(() => {
    return adAccounts.filter((account) =>
      account.status === 'active' &&
      (!targetAdvertiserId || account.advertiserId === targetAdvertiserId) &&
      (platformFilter === 'all' || account.platformId === platformFilter) &&
      (accountFilter === 'all' || account.id === accountFilter),
    );
  }, [accountFilter, adAccounts, platformFilter, targetAdvertiserId]);

  const csAccountOptions = useMemo(() => {
    return adAccounts
      .filter((account) =>
        account.status === 'active' &&
        (!targetAdvertiserId || account.advertiserId === targetAdvertiserId) &&
        (platformFilter === 'all' || account.platformId === platformFilter),
      )
      .sort((left, right) => left.accountName.localeCompare(right.accountName, 'id-ID'));
  }, [adAccounts, platformFilter, targetAdvertiserId]);

  const csPlatformOptions = useMemo(() => {
    const platformIds = new Set(
      adAccounts
        .filter((account) =>
          account.status === 'active' &&
          (!targetAdvertiserId || account.advertiserId === targetAdvertiserId),
        )
        .map((account) => account.platformId)
        .filter(Boolean),
    );

    return platforms
      .filter((platform) => platformIds.has(platform.id))
      .sort((left, right) => left.name.localeCompare(right.name, 'id-ID'));
  }, [adAccounts, platforms, targetAdvertiserId]);

  // 1. Base Data (Filtered by Date & User Role ONLY) - Used for Dropdown Options
  const baseData = useMemo(() => {
    // If Owner is viewing, use selectedAdvertiserId. If it's 'all', show everything (targetUserId = undefined).
    // If actual Advertiser is viewing, force their ID.
    let targetUserId: string | undefined = undefined;

    if (isOwner) {
        if (selectedAdvertiserId !== 'all') {
            targetUserId = selectedAdvertiserId;
        }
    } else if (isAdvertiserRole(currentUser?.role)) {
        targetUserId = currentUser.id;
    }
    
    const checkDate = (dateStr: string) => {
        if (!dateRange?.from) return true;
        const d = new Date(dateStr);
        const start = startOfDay(dateRange.from);
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        return isWithinInterval(d, { start, end });
    };

    const ads = dailyAds.filter(d => {
        if (targetUserId && d.advertiserId !== targetUserId) return false;
        return checkDate(d.date);
    });

    const leadItems = leads.filter(l => {
        if (!l.timestamp) return false;
        if (targetUserId && l.advertiserId !== targetUserId) return false;
        let dateStr = '';
        try { dateStr = format(new Date(l.timestamp), 'yyyy-MM-dd'); } catch(e) { return false; }
        return checkDate(dateStr);
    });

    const orderItems = orders.filter(o => {
        if (!o.leadDate) return false;
        if (targetUserId && o.advertiserId !== targetUserId) return false;
        let dateStr = '';
        try { dateStr = format(new Date(o.leadDate), 'yyyy-MM-dd'); } catch(e) { return false; }
        return checkDate(dateStr);
    });

    return { ads, leads: leadItems, orders: orderItems };
  }, [dailyAds, leads, orders, dateRange, currentUser, isOwner, selectedAdvertiserId]);

  // 2. Dynamic Filter Options (Based on Base Data)
  const filterOptions = useMemo(() => {
    const { ads, leads, orders } = baseData;
    
    const getIds = (key: string) => new Set([
        ...ads.map((d: any) => d[key]),
        ...leads.map((l: any) => l[key]),
        ...orders.map((o: any) => o[key])
    ].filter(Boolean));

    const platformIds = getIds('platformId');
    const subChannelIds = getIds('subChannelId');
    const accountIds = getIds('adAccountId');
    const csIds = getIds('csId');

    // Filter Options
    const availPlatforms = platforms.filter(p => platformIds.has(p.id));
    
    // Sub Channels can be filtered by selected Platform if needed, but here we show all available in date range
    // matching the "Semua Sub" request logic which usually implies context awareness
    let availSubChannels = subChannels.filter(s => subChannelIds.has(s.id));
    if (platformFilter !== 'all') {
        availSubChannels = availSubChannels.filter(s => s.platformId === platformFilter);
    }

    const availAccounts = adAccounts.filter(a => accountIds.has(a.id));
    if (platformFilter !== 'all') {
         // Optional: filter accounts by platform too if desired, usually helpful
         // availAccounts = availAccounts.filter(a => a.platformId === platformFilter);
    }

    const availCs = users.filter(u => csIds.has(u.id));

    return {
        platforms: availPlatforms,
        subChannels: availSubChannels,
        accounts: availAccounts,
        cs: availCs
    };
  }, [baseData, platforms, subChannels, adAccounts, users, platformFilter]);

  // 3. Final Filtered & Aggregated Data (Table Data)
  const processedData = useMemo(() => {
    const { ads, leads, orders } = baseData;

    // Filter Functions
    const matchesFilters = (item: any) => {
        if (platformFilter !== 'all' && item.platformId !== platformFilter) return false;
        if (subChannelFilter !== 'all' && item.subChannelId !== subChannelFilter) return false;
        if (accountFilter !== 'all' && item.adAccountId !== accountFilter) return false;
        if (csFilter !== 'all' && item.csId !== csFilter) return false;
        return true;
    };

    const relevantAds = ads.filter(matchesFilters);
    const relevantLeads = leads.filter(matchesFilters);
    const relevantOrders = orders.filter(matchesFilters);
    
    // Search Filter (applied after category filters)
    const finalAds = search ? relevantAds.filter(d => 
        d.date.includes(search) ||
        getPlatformName(d.platformId).toLowerCase().includes(search.toLowerCase()) ||
        getAccountName(d.adAccountId).toLowerCase().includes(search.toLowerCase()) ||
        (d.csId && getCsName(d.csId).toLowerCase().includes(search.toLowerCase()))
    ) : relevantAds;

    const finalLeads = search ? relevantLeads.filter(l => {
        const dateStr = format(new Date(l.timestamp), 'yyyy-MM-dd');
        return dateStr.includes(search) || 
               getPlatformName(l.platformId).toLowerCase().includes(search.toLowerCase());
    }) : relevantLeads;

    // ... Orders search logic if needed, usually linked to Lead Date

    // D. Get Unique Dates Union
    const allDates = new Set<string>();
    finalAds.forEach(d => allDates.add(d.date));
    finalLeads.forEach(l => allDates.add(format(new Date(l.timestamp), 'yyyy-MM-dd')));
    relevantOrders.forEach(o => o.leadDate && allDates.add(format(new Date(o.leadDate), 'yyyy-MM-dd')));

    // D. Build Aggregated Rows
    const rows = Array.from(allDates).map(date => {
        // Ads for this date
        const dayAds = finalAds.filter(d => d.date === date);
        const spend = dayAds.reduce((sum, d) => sum + (Number(d.amountSpent) || 0), 0);
        const burn = dayAds.reduce((sum, d) => sum + (Number(d.amountSpent) || 0) + (Number(d.ppnAmount) || 0) + (Number(d.feeAmount) || 0), 0);
        const leadsDash = dayAds.reduce((sum, d) => sum + (Number(d.leadsDashboard) || 0), 0);
        
        // Leads for this date
        const dayLeads = finalLeads.filter(l => format(new Date(l.timestamp), 'yyyy-MM-dd') === date);
        const realLeadsCount = dayLeads.length;

        // Orders for this date (using relevantOrders to ensure counts are correct even if search strictly filters leads)
        // Note: Searching text might filter out "rows", but metric calculation consistency is tricky. 
        // For dashboard, usually search filters "rows displayed", metrics should match displayed rows.
        const dayOrders = relevantOrders.filter(o => {
            if (!o.leadDate) return false;
            const matchDate = format(new Date(o.leadDate), 'yyyy-MM-dd') === date;
            
            // Apply search logic to orders if search is active? 
            // Currently search logic above was specific to Ads/Leads text. 
            // Let's assume if the Date Row exists, we count orders matching the filters.
            return matchDate;
        });

        const realOrdersCount = dayOrders.length;
        const realOrdersDoneCount = dayOrders.filter(o => o.status === 'done').length;

        // Calculations
        const cplDash = leadsDash > 0 ? spend / leadsDash : 0;
        const cplReal = realLeadsCount > 0 ? spend / realLeadsCount : 0;
        const cprDone = realOrdersDoneCount > 0 ? spend / realOrdersDoneCount : 0;
        const cprDeal = realOrdersCount > 0 ? spend / realOrdersCount : 0;

        // Missing Report Logic
        const isMissingReport = dayLeads.length > 0 && dayAds.length === 0;

        // Aggregating Columns Info
        const getUniques = (key: string, source: any[]) => Array.from(new Set(source.map(s => s[key]).filter(Boolean)));
        
        const uniqueAdvertisers = Array.from(new Set([
            ...getUniques('advertiserId', dayAds),
            ...getUniques('advertiserId', dayLeads),
            ...getUniques('advertiserId', dayOrders)
        ]));

        const uniqueCS = Array.from(new Set([
            ...getUniques('csId', dayAds),
            ...getUniques('csId', dayLeads),
            ...getUniques('csId', dayOrders)
        ]));

        const uniquePlatforms = Array.from(new Set([
            ...getUniques('platformId', dayAds),
            ...getUniques('platformId', dayLeads),
            ...getUniques('platformId', dayOrders)
        ]));

        const uniqueSubChannels = Array.from(new Set([
            ...getUniques('subChannelId', dayAds),
            ...getUniques('subChannelId', dayLeads),
            ...getUniques('subChannelId', dayOrders)
        ]));

        const uniqueAccounts = getUniques('adAccountId', dayAds);

        return {
            id: date,
            date,
            spend,
            burn,
            leadsDashboard: leadsDash,
            realLeads: realLeadsCount,
            realOrders: realOrdersCount,
            realOrdersDone: realOrdersDoneCount,
            cplDash,
            cplReal,
            cprDone,
            cprDeal,
            isMissingReport,
            
            advertisers: uniqueAdvertisers,
            csIds: uniqueCS,
            platforms: uniquePlatforms,
            subChannels: uniqueSubChannels,
            accounts: uniqueAccounts,
        };
    });

    // E. Sort
    if (sortConfig) {
        rows.sort((a, b) => {
            let valA: any = a[sortConfig.key as keyof typeof a];
            let valB: any = b[sortConfig.key as keyof typeof b];

            if (sortConfig.key === 'spending') { valA = a.spend; valB = b.spend; }
            else if (sortConfig.key === 'leads_real') { valA = a.realLeads; valB = b.realLeads; }
            else if (sortConfig.key === 'orders_done') { valA = a.realOrdersDone; valB = b.realOrdersDone; }
            else if (sortConfig.key === 'cpl_real') { valA = a.cplReal; valB = b.cplReal; }
            else if (sortConfig.key === 'date') { valA = new Date(a.date).getTime(); valB = new Date(b.date).getTime(); }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    } else {
        rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return rows;
  }, [baseData, platformFilter, subChannelFilter, accountFilter, csFilter, search, sortConfig]);

  // 2. Summary Totals
  const totals = useMemo(() => {
    return processedData.reduce((acc, curr) => ({
      spend: acc.spend + curr.spend,
      burn: acc.burn + curr.burn,
      leadsDash: acc.leadsDash + curr.leadsDashboard,
      leadsReal: acc.leadsReal + curr.realLeads,
      orders: acc.orders + curr.realOrders,
      ordersDone: acc.ordersDone + curr.realOrdersDone
    }), { spend: 0, burn: 0, leadsDash: 0, leadsReal: 0, orders: 0, ordersDone: 0 });
  }, [processedData]);

  const avgCplAds = totals.leadsDash > 0 ? totals.spend / totals.leadsDash : 0;
  const avgCplReal = totals.leadsReal > 0 ? totals.spend / totals.leadsReal : 0;
  const avgCpr = totals.orders > 0 ? totals.spend / totals.orders : 0;
  const avgCprDone = totals.ordersDone > 0 ? totals.spend / totals.ordersDone : 0;

  // 3. Chart Data
  const chartData = useMemo(() => {
    return [...processedData]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(item => ({
            ...item,
            cpl: item.realLeads > 0 ? Math.round(item.spend / item.realLeads) : 0,
            cpr: item.realOrders > 0 ? Math.round(item.spend / item.realOrders) : 0,
            cprDone: item.realOrdersDone > 0 ? Math.round(item.spend / item.realOrdersDone) : 0
        }));
  }, [processedData]);

  const adAccountLookup = useMemo(() => {
    const byId = new Map<string, (typeof adAccounts)[number]>();
    const byName = new Map<string, (typeof adAccounts)[number]>();

    for (const account of adAccounts) {
      if (account.status !== 'active') continue;
      if (targetAdvertiserId && account.advertiserId !== targetAdvertiserId) continue;
      byId.set(account.id, account);
      byName.set(normalizeLookupKey(account.accountName), account);
    }

    return { byId, byName };
  }, [adAccounts, targetAdvertiserId]);

  const adAccountCsLookup = useMemo(() => {
    const resolveAssignment = (adAccountId?: string, date?: string) => {
      if (!adAccountId) return null;

      if (date) {
        const datedAssignment = adAccountAssignments
          .filter((assignment) =>
            assignment.adAccountId === adAccountId &&
            assignment.status === 'active' &&
            assignment.startDate <= date &&
            (!assignment.endDate || assignment.endDate >= date)
          )
          .sort((left, right) => right.startDate.localeCompare(left.startDate))[0];

        if (datedAssignment?.csId) return datedAssignment;
      }

      const openAssignment = adAccountAssignments
        .filter((assignment) =>
          assignment.adAccountId === adAccountId &&
          assignment.status === 'active' &&
          !assignment.endDate
        )
        .sort((left, right) => right.startDate.localeCompare(left.startDate))[0];

      return openAssignment || null;
    };

    return { resolveAssignment };
  }, [adAccountAssignments]);

  React.useEffect(() => {
    if (!rangeParams) {
      setApiAdsByDateAccount({});
      setApiAdsStatus('idle');
      return;
    }

    let cancelled = false;
    const forceRefresh = apiRefreshNonce !== lastApiRefreshNonceRef.current;
    if (forceRefresh) lastApiRefreshNonceRef.current = apiRefreshNonce;
    const cacheKey = `${rangeParams.from}:${rangeParams.to}:${targetAdvertiserId || 'all'}`;
    const cachedSnapshot = !forceRefresh ? advertiserCsPerfCache.get(cacheKey) : null;

    if (cachedSnapshot) {
      setApiAdsByDateAccount(cachedSnapshot.byDateAccount);
      setApiAdsStatus(cachedSnapshot.status);
      return;
    }

    const resolveAdAccount = (row: AdsSnapshotRowLike) => {
      const internalId = row.internalAdAccountId || '';
      if (internalId && adAccountLookup.byId.has(internalId)) return adAccountLookup.byId.get(internalId) || null;

      const externalId = row.externalAccountId || '';
      if (externalId && adAccountLookup.byId.has(externalId)) return adAccountLookup.byId.get(externalId) || null;

      return adAccountLookup.byName.get(normalizeLookupKey(row.externalAccountName)) || null;
    };

    const addSnapshotRows = (
      resultByDateAccount: Record<string, AdvertiserCsAccountMetric>,
      rows: AdsSnapshotRowLike[],
    ) => {
      for (const row of rows) {
        const date = row.snapshotDate;
        if (!date || date < rangeParams.from || date > rangeParams.to) continue;

        const adAccount = resolveAdAccount(row);
        if (!adAccount) continue;
        if (targetAdvertiserId && adAccount.advertiserId !== targetAdvertiserId) continue;

        const assignment = adAccountCsLookup.resolveAssignment(adAccount.id, date);
        const platformName = platforms.find((platform) => platform.id === (row.platformId || adAccount.platformId))?.name;
        const accountKey = `${date}::${adAccount.id}`;
        const current = resultByDateAccount[accountKey] || {
          date,
          adAccountId: adAccount.id,
          advertiserId: row.advertiserId || adAccount.advertiserId || null,
          csId: assignment?.csId || null,
          subChannelId: assignment?.subChannelId || null,
          platformId: row.platformId || adAccount.platformId || null,
          platformKey: row.platformKey || resolvePlatformKey(platformName),
          accountName: adAccount.accountName,
          ppn: adAccount.ppn || 0,
          fee: adAccount.fee || 0,
          spend: 0,
          leads: 0,
        };

        current.spend += Number(row.spend) || 0;
        current.leads += Number(row.conversions) || 0;
        resultByDateAccount[accountKey] = current;
      }
    };

    const loadApiAdsMetrics = async () => {
      setApiAdsStatus('loading');

      try {
        const [meta, google, tiktok] = await Promise.allSettled([
          syncMetaSnapshotDataset({ ...rangeParams, force: forceRefresh, minFreshMinutes: forceRefresh ? 0 : 10 }).catch(() =>
            fetchMetaSnapshotDataset(rangeParams),
          ),
          syncGoogleAdsSnapshotDataset({ ...rangeParams, force: forceRefresh, minFreshMinutes: forceRefresh ? 0 : 10 }).catch(() =>
            fetchGoogleAdsSnapshotDataset({ ...rangeParams, includeLastKnown: true }),
          ),
          syncTikTokAdsSnapshotDataset({ ...rangeParams, force: forceRefresh, minFreshMinutes: forceRefresh ? 0 : 10 }).catch(() =>
            fetchTikTokAdsSnapshotDataset(rangeParams),
          ),
        ]);

        const nextByAccount: Record<string, AdvertiserCsAccountMetric> = {};
        if (meta.status === 'fulfilled') addSnapshotRows(nextByAccount, meta.value.rows || []);
        if (google.status === 'fulfilled') addSnapshotRows(nextByAccount, google.value.rows || []);
        if (tiktok.status === 'fulfilled') addSnapshotRows(nextByAccount, tiktok.value.rows || []);

        if (cancelled) return;
        const nextStatus: ApiAdsStatus = Object.values(nextByAccount).some((row) => row.spend > 0 || row.leads > 0)
          ? 'ready'
          : 'empty';

        setApiAdsByDateAccount(nextByAccount);
        setApiAdsStatus(nextStatus);
        advertiserCsPerfCache.set(cacheKey, { byDateAccount: nextByAccount, status: nextStatus });
      } catch {
        if (cancelled) return;
        setApiAdsByDateAccount({});
        setApiAdsStatus('error');
      }
    };

    loadApiAdsMetrics();

    return () => {
      cancelled = true;
    };
  }, [adAccountCsLookup, adAccountLookup, apiRefreshNonce, platforms, rangeParams, targetAdvertiserId]);

  const csPerformanceRows = useMemo(() => {
    if (!rangeParams) return [];

    type CsPerformanceRow = {
      accountId: string;
      date: string;
      advertiserName: string;
      csName: string;
      platformKey: string;
      platformName: string;
      subChannelName: string;
      accountName: string;
      spendDashboard: number;
      spendTotal: number;
      leadsDash: number;
      leadsReal: number;
      spam: number;
      spamRate: number;
      orders: number;
      scheduled: number;
      done: number;
      cancelled: number;
      revenue: number;
      orderRate: number;
      cpl: number;
      cplTotal: number;
      cprClosing: number;
      cprClosingTotal: number;
      costPerDone: number;
      costPerDoneTotal: number;
      roas: number;
      roasTotal: number;
      source: 'api' | 'operational';
    };

    type AssignedAccountGroup = {
      date: string;
      account: (typeof activeAdvertiserAccounts)[number];
      assignment: ReturnType<typeof adAccountCsLookup.resolveAssignment>;
      apiMetrics: AdvertiserCsAccountMetric[];
      leads: typeof leads;
      orders: typeof orders;
    };

    const userNameById = new Map(users.map((user) => [user.id, user.name]));
    const platformNameById = new Map(platforms.map((platform) => [platform.id, platform.name]));
    const subChannelNameById = new Map(subChannels.map((subChannel) => [subChannel.id, subChannel.name]));
    const activeAccountById = new Map(activeAdvertiserAccounts.map((account) => [account.id, account]));
    const dates = eachDayOfInterval({
      start: parseISO(`${rangeParams.from}T00:00:00`),
      end: parseISO(`${rangeParams.to}T00:00:00`),
    }).map((date) => format(date, 'yyyy-MM-dd'));
    const groups = new Map<string, AssignedAccountGroup>();
    const candidatesByScope = new Map<string, AssignedAccountGroup[]>();
    const getScopeKey = (date: string, advertiserId?: string | null, platformId?: string | null, csId?: string | null) =>
      `${date}::${advertiserId || 'none'}::${platformId || 'none'}::${csId || 'none'}`;

    const getGroup = (date: string, account: (typeof activeAdvertiserAccounts)[number]) => {
      const assignment = adAccountCsLookup.resolveAssignment(account.id, date);
      if (csFilter !== 'all' && assignment?.csId !== csFilter) return null;

      const key = `${date}::${account.id}`;
      const current = groups.get(key) || {
        date,
        account,
        assignment,
        apiMetrics: [],
        leads: [],
        orders: [],
      };
      groups.set(key, current);
      return current;
    };

    for (const date of dates) {
      for (const account of activeAdvertiserAccounts) {
        const group = getGroup(date, account);
        if (!group) continue;
        const key = getScopeKey(date, account.advertiserId, account.platformId, group.assignment?.csId);
        const current = candidatesByScope.get(key) || [];
        current.push(group);
        candidatesByScope.set(key, current);
      }
    }

    for (const metric of Object.values(apiAdsByDateAccount)) {
      if (metric.date < rangeParams.from || metric.date > rangeParams.to) continue;
      if (platformFilter !== 'all' && metric.platformId !== platformFilter) continue;
      const account = activeAccountById.get(metric.adAccountId);
      if (!account) continue;
      const group = getGroup(metric.date, account);
      if (!group) continue;
      group.apiMetrics.push(metric);
    }

    const selectBestGroup = (candidates: AssignedAccountGroup[] | undefined, subChannelId?: string | null) => {
      if (!candidates?.length) return null;
      const exactSubChannel = subChannelId
        ? candidates.find((group) => group.assignment?.subChannelId === subChannelId)
        : null;
      if (exactSubChannel) return exactSubChannel;
      const defaultSubChannel = candidates.find((group) => !group.assignment?.subChannelId);
      return defaultSubChannel || candidates[0];
    };

    const getLeadDate = (lead: (typeof leads)[number]) => lead.timestamp?.slice(0, 10) || '';
    const getOrderLeadDate = (order: (typeof orders)[number]) => (order.leadDate || order.created_at || '').slice(0, 10);

    for (const lead of leads) {
      const date = getLeadDate(lead);
      if (!date || date < rangeParams.from || date > rangeParams.to) continue;
      if (targetAdvertiserId && lead.advertiserId !== targetAdvertiserId) continue;
      if (platformFilter !== 'all' && lead.platformId !== platformFilter) continue;
      if (csFilter !== 'all' && lead.csId !== csFilter) continue;
      const candidates = candidatesByScope.get(getScopeKey(date, lead.advertiserId, lead.platformId, lead.csId));
      const group = selectBestGroup(candidates, lead.subChannelId);
      if (!group) continue;
      group.leads.push(lead);
    }

    for (const order of orders) {
      const date = getOrderLeadDate(order);
      if (!date || date < rangeParams.from || date > rangeParams.to) continue;
      if (targetAdvertiserId && order.advertiserId !== targetAdvertiserId) continue;
      if (platformFilter !== 'all' && order.platformId !== platformFilter) continue;
      if (csFilter !== 'all' && order.csId !== csFilter) continue;
      const candidates = candidatesByScope.get(getScopeKey(date, order.advertiserId, order.platformId, order.csId));
      const group = selectBestGroup(candidates, order.subChannelId);
      if (!group) continue;
      group.orders.push(order);
    }

    const spamByScope = new Map<string, number>();
    for (const item of leadSpamDailyInputs) {
      if (!item.inputDate || item.inputDate < rangeParams.from || item.inputDate > rangeParams.to) continue;
      if (targetAdvertiserId && item.advertiserId !== targetAdvertiserId) continue;
      if (platformFilter !== 'all' && item.platformId !== platformFilter) continue;
      if (csFilter !== 'all' && item.csId !== csFilter) continue;
      const key = getScopeKey(item.inputDate, item.advertiserId, item.platformId, item.csId);
      spamByScope.set(key, (spamByScope.get(key) || 0) + (Number(item.spamCount) || 0));
    }

    const getGroupActivityScore = (group: AssignedAccountGroup) =>
      group.apiMetrics.reduce((sum, metric) => sum + metric.spend + metric.leads, 0) +
      group.leads.length +
      group.orders.length;
    const shouldAttachScopeSpam = (group: AssignedAccountGroup) => {
      const scopeKey = getScopeKey(group.date, group.account.advertiserId, group.account.platformId, group.assignment?.csId);
      const candidates = candidatesByScope.get(scopeKey);
      if (!candidates?.length) return false;

      const selected = [...candidates].sort((left, right) => {
        const scoreDelta = getGroupActivityScore(right) - getGroupActivityScore(left);
        if (scoreDelta !== 0) return scoreDelta;
        return left.account.accountName.localeCompare(right.account.accountName, 'id-ID');
      })[0];

      return selected.account.id === group.account.id;
    };

    const rows: CsPerformanceRow[] = [];
    for (const group of groups.values()) {
      const spendDashboard = group.apiMetrics.reduce((sum, metric) => sum + metric.spend, 0);
      const spendTotal = group.apiMetrics.reduce(
        (sum, metric) => sum + metric.spend * (1 + ((metric.ppn || 0) + (metric.fee || 0)) / 100),
        0,
      );
      const completedOrders = group.orders.filter((order) => order.status === 'done');
      const revenue = completedOrders.reduce((sum, order) => sum + (order.income || order.price || 0), 0);
      const leadsDashboard = group.apiMetrics.reduce((sum, metric) => sum + metric.leads, 0);
      const orderCount = group.orders.length;
      const doneCount = completedOrders.length;
      const spamCount = spamByScope.get(getScopeKey(
        group.date,
        group.account.advertiserId,
        group.account.platformId,
        group.assignment?.csId,
      )) || 0;
      const rowSpamCount = shouldAttachScopeSpam(group) ? spamCount : 0;

      rows.push({
        accountId: group.account.id,
        date: group.date,
        advertiserName: userNameById.get(group.account.advertiserId || '') || 'Advertiser belum terdaftar',
        csName: group.assignment?.csId ? userNameById.get(group.assignment.csId) || 'CS belum terdaftar' : 'CS belum diatur',
        platformKey: group.apiMetrics[0]?.platformKey || resolvePlatformKey(platformNameById.get(group.account.platformId || '')),
        platformName: platformNameById.get(group.account.platformId || '') || 'Platform belum terdaftar',
        subChannelName: group.assignment?.subChannelId ? subChannelNameById.get(group.assignment.subChannelId) || 'Subchannel belum terdaftar' : 'Tidak dikunci',
        accountName: group.account.accountName,
        spendDashboard,
        spendTotal,
        leadsDash: leadsDashboard,
        leadsReal: group.leads.length,
        spam: rowSpamCount,
        spamRate: leadsDashboard > 0 ? (rowSpamCount / leadsDashboard) * 100 : 0,
        orders: orderCount,
        scheduled: group.orders.filter((order) => order.status === 'pending').length,
        done: doneCount,
        cancelled: group.orders.filter((order) => order.status === 'cancelled').length,
        revenue,
        orderRate: leadsDashboard > 0 ? (orderCount / leadsDashboard) * 100 : 0,
        cpl: leadsDashboard > 0 ? spendDashboard / leadsDashboard : 0,
        cplTotal: leadsDashboard > 0 ? spendTotal / leadsDashboard : 0,
        cprClosing: orderCount > 0 ? spendDashboard / orderCount : 0,
        cprClosingTotal: orderCount > 0 ? spendTotal / orderCount : 0,
        costPerDone: doneCount > 0 ? spendDashboard / doneCount : 0,
        costPerDoneTotal: doneCount > 0 ? spendTotal / doneCount : 0,
        roas: spendDashboard > 0 ? revenue / spendDashboard : 0,
        roasTotal: spendTotal > 0 ? revenue / spendTotal : 0,
        source: group.apiMetrics.length > 0 ? 'api' : 'operational',
      });
    }

    return rows
      .filter((row) => row.spendDashboard > 0 || row.leadsDash > 0 || row.leadsReal > 0 || row.orders > 0 || row.spam > 0)
      .sort((left, right) => {
        if (right.date !== left.date) return right.date.localeCompare(left.date);
        if (left.csName !== right.csName) return left.csName.localeCompare(right.csName, 'id-ID');
        return right.spendTotal - left.spendTotal;
      });
  }, [
    activeAdvertiserAccounts,
    adAccountCsLookup,
    apiAdsByDateAccount,
    csFilter,
    leadSpamDailyInputs,
    leads,
    orders,
    platforms,
    platformFilter,
    rangeParams,
    subChannels,
    targetAdvertiserId,
    users,
  ]);

  const csPerformanceGroups = useMemo(() => {
    const groups = new Map<string, {
      date: string;
      rows: typeof csPerformanceRows;
      spendDashboard: number;
      spendTotal: number;
      leadsDash: number;
      leadsReal: number;
      spam: number;
      spamRate: number;
      orders: number;
      done: number;
      cancelled: number;
      revenue: number;
      cpl: number;
      cprClosing: number;
      roas: number;
    }>();

    for (const row of csPerformanceRows) {
      const current = groups.get(row.date) || {
        date: row.date,
        rows: [],
        spendDashboard: 0,
        spendTotal: 0,
        leadsDash: 0,
        leadsReal: 0,
        spam: 0,
        spamRate: 0,
        orders: 0,
        done: 0,
        cancelled: 0,
        revenue: 0,
        cpl: 0,
        cprClosing: 0,
        roas: 0,
      };

      current.rows.push(row);
      current.spendDashboard += row.spendDashboard;
      current.spendTotal += row.spendTotal;
      current.leadsDash += row.leadsDash;
      current.leadsReal += row.leadsReal;
      current.spam += row.spam;
      current.orders += row.orders;
      current.done += row.done;
      current.cancelled += row.cancelled;
      current.revenue += row.revenue;
      current.spamRate = current.leadsDash > 0 ? (current.spam / current.leadsDash) * 100 : 0;
      current.cpl = current.leadsDash > 0 ? current.spendDashboard / current.leadsDash : 0;
      current.cprClosing = current.orders > 0 ? current.spendDashboard / current.orders : 0;
      current.roas = current.spendDashboard > 0 ? current.revenue / current.spendDashboard : 0;
      groups.set(row.date, current);
    }

    return Array.from(groups.values()).sort((left, right) => right.date.localeCompare(left.date));
  }, [csPerformanceRows]);

  const csPerformanceTotals = useMemo(() => {
    return csPerformanceRows.reduce((acc, row) => ({
      spendDashboard: acc.spendDashboard + row.spendDashboard,
      spendTotal: acc.spendTotal + row.spendTotal,
      leadsDash: acc.leadsDash + row.leadsDash,
      leadsReal: acc.leadsReal + row.leadsReal,
      spam: acc.spam + row.spam,
      orders: acc.orders + row.orders,
      done: acc.done + row.done,
      cancelled: acc.cancelled + row.cancelled,
      revenue: acc.revenue + row.revenue,
    }), {
      spendDashboard: 0,
      spendTotal: 0,
      leadsDash: 0,
      leadsReal: 0,
      spam: 0,
      orders: 0,
      done: 0,
      cancelled: 0,
      revenue: 0,
    });
  }, [csPerformanceRows]);

  const csPerformanceSummary = useMemo(() => ({
    spamRate: csPerformanceTotals.leadsDash > 0 ? (csPerformanceTotals.spam / csPerformanceTotals.leadsDash) * 100 : 0,
    cpl: csPerformanceTotals.leadsDash > 0 ? csPerformanceTotals.spendDashboard / csPerformanceTotals.leadsDash : 0,
    cplTotal: csPerformanceTotals.leadsDash > 0 ? csPerformanceTotals.spendTotal / csPerformanceTotals.leadsDash : 0,
    costPerClosing: csPerformanceTotals.orders > 0 ? csPerformanceTotals.spendDashboard / csPerformanceTotals.orders : 0,
    costPerClosingTotal: csPerformanceTotals.orders > 0 ? csPerformanceTotals.spendTotal / csPerformanceTotals.orders : 0,
    costPerDone: csPerformanceTotals.done > 0 ? csPerformanceTotals.spendDashboard / csPerformanceTotals.done : 0,
    costPerDoneTotal: csPerformanceTotals.done > 0 ? csPerformanceTotals.spendTotal / csPerformanceTotals.done : 0,
    roas: csPerformanceTotals.spendDashboard > 0 ? csPerformanceTotals.revenue / csPerformanceTotals.spendDashboard : 0,
  }), [csPerformanceTotals]);

  const csPerformanceBreakdowns = useMemo(() => {
    type BreakdownRow = {
      key: string;
      label: string;
      secondary?: string;
      platformKey?: string;
      spendDashboard: number;
      spendTotal: number;
      leadsDash: number;
      leadsReal: number;
      spam: number;
      orders: number;
      done: number;
      revenue: number;
      cprClosing: number;
      cprDone: number;
      roas: number;
    };

    type BreakdownGroup = {
      title: string;
      totals: {
        spendDashboard: number;
        leadsDash: number;
        leadsReal: number;
        orders: number;
        done: number;
        cprClosing: number;
        cprDone: number;
      };
      rows: BreakdownRow[];
    };

    const buildBreakdown = (
      title: string,
      getKey: (row: (typeof csPerformanceRows)[number]) => string,
      getLabel: (row: (typeof csPerformanceRows)[number]) => string,
      getSecondary?: (row: (typeof csPerformanceRows)[number]) => string | undefined,
      getPlatformKey?: (row: (typeof csPerformanceRows)[number]) => string | undefined,
    ): BreakdownGroup => {
      const groups = new Map<string, BreakdownRow>();

      for (const row of csPerformanceRows) {
        const key = getKey(row);
        const current = groups.get(key) || {
          key,
          label: getLabel(row),
          secondary: getSecondary?.(row),
          platformKey: getPlatformKey?.(row),
          spendDashboard: 0,
          spendTotal: 0,
          leadsDash: 0,
          leadsReal: 0,
          spam: 0,
          orders: 0,
          done: 0,
          revenue: 0,
          cprClosing: 0,
          cprDone: 0,
          roas: 0,
        };

        current.spendDashboard += row.spendDashboard;
        current.spendTotal += row.spendTotal;
        current.leadsDash += row.leadsDash;
        current.leadsReal += row.leadsReal;
        current.spam += row.spam;
        current.orders += row.orders;
        current.done += row.done;
        current.revenue += row.revenue;
        current.secondary = current.secondary || getSecondary?.(row);
        current.platformKey = current.platformKey || getPlatformKey?.(row);
        groups.set(key, current);
      }

      const rows = Array.from(groups.values()).map((row) => ({
        ...row,
        cprClosing: row.orders > 0 ? row.spendDashboard / row.orders : 0,
        cprDone: row.done > 0 ? row.spendDashboard / row.done : 0,
        roas: row.spendDashboard > 0 ? row.revenue / row.spendDashboard : 0,
      }));
      const visibleRows = rows.filter((row) => row.spendDashboard > 0 || row.leadsDash > 0 || row.leadsReal > 0 || row.orders > 0 || row.spam > 0);

      return {
        title,
        totals: (() => {
          const totals = visibleRows.reduce((acc, row) => ({
            spendDashboard: acc.spendDashboard + row.spendDashboard,
            leadsDash: acc.leadsDash + row.leadsDash,
            leadsReal: acc.leadsReal + row.leadsReal,
            orders: acc.orders + row.orders,
            done: acc.done + row.done,
            cprClosing: 0,
            cprDone: 0,
          }), {
            spendDashboard: 0,
            leadsDash: 0,
            leadsReal: 0,
            orders: 0,
            done: 0,
            cprClosing: 0,
            cprDone: 0,
          });

          return {
            ...totals,
            cprClosing: totals.orders > 0 ? totals.spendDashboard / totals.orders : 0,
            cprDone: totals.done > 0 ? totals.spendDashboard / totals.done : 0,
          };
        })(),
        rows: visibleRows
          .sort((left, right) => {
            const leftCpr = left.cprDone > 0 ? left.cprDone : left.cprClosing > 0 ? left.cprClosing : Number.MAX_SAFE_INTEGER;
            const rightCpr = right.cprDone > 0 ? right.cprDone : right.cprClosing > 0 ? right.cprClosing : Number.MAX_SAFE_INTEGER;
            if (leftCpr !== rightCpr) return leftCpr - rightCpr;
            if (right.done !== left.done) return right.done - left.done;
            if (right.orders !== left.orders) return right.orders - left.orders;
            return right.spendDashboard - left.spendDashboard;
          }),
      };
    };

    return [
      buildBreakdown(
        'Advertiser',
        (row) => row.advertiserName,
        (row) => row.advertiserName,
      ),
      buildBreakdown(
        'CS',
        (row) => row.csName,
        (row) => row.csName,
      ),
      buildBreakdown(
        'Platform',
        (row) => row.platformName,
        (row) => row.platformName,
        undefined,
        (row) => row.platformKey,
      ),
      buildBreakdown(
        'Akun Iklan',
        (row) => row.accountId,
        (row) => row.accountName,
        (row) => `${row.platformName} / ${row.csName}`,
        (row) => row.platformKey,
      ),
    ];
  }, [csPerformanceRows]);

  const csFilterOptions = useMemo(() => {
    const csIds = new Set<string>();
    for (const account of activeAdvertiserAccounts) {
      for (const assignment of adAccountAssignments) {
        if (assignment.adAccountId !== account.id || assignment.status !== 'active' || !assignment.csId) continue;
        if (rangeParams && assignment.startDate > rangeParams.to) continue;
        if (rangeParams && assignment.endDate && assignment.endDate < rangeParams.from) continue;
        csIds.add(assignment.csId);
      }
    }

    return users
      .filter((user) => csIds.has(user.id))
      .sort((left, right) => left.name.localeCompare(right.name, 'id-ID'));
  }, [activeAdvertiserAccounts, adAccountAssignments, rangeParams, users]);

  React.useEffect(() => {
    setExpandedCsDates(csPerformanceGroups.slice(0, 1).map((group) => group.date));
  }, [csPerformanceGroups]);

  React.useEffect(() => {
    if (activeTab !== 'cs-performance') return;
    if (csFilter !== 'all' && !csFilterOptions.some((cs) => cs.id === csFilter)) {
      setCsFilter('all');
    }
    if (platformFilter !== 'all' && !csPlatformOptions.some((platform) => platform.id === platformFilter)) {
      setPlatformFilter('all');
    }
    if (accountFilter !== 'all' && !csAccountOptions.some((account) => account.id === accountFilter)) {
      setAccountFilter('all');
    }
  }, [accountFilter, activeTab, csAccountOptions, csFilter, csFilterOptions, csPlatformOptions, platformFilter]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Rendering Helpers
  const renderList = (ids: any[], lookupFn: (id: string) => string, emptyText = '-') => {
      if (!ids || ids.length === 0) return <span className="text-slate-400">{emptyText}</span>;
      if (ids.length === 1) return lookupFn(ids[0]);
      return (
          <Tooltip>
              <TooltipTrigger asChild>
                  <span className="cursor-help border-b border-dashed border-slate-300 dark:border-slate-600">
                      {ids.length} items
                  </span>
              </TooltipTrigger>
              <TooltipContent>
                  <ul className="text-xs list-disc pl-3">
                      {ids.map(id => <li key={id}>{lookupFn(id)}</li>)}
                  </ul>
              </TooltipContent>
          </Tooltip>
      );
  };
  
  // Specific Renderers using the generic renderList logic simplified for table cells
  const renderSimpleList = (ids: any[], lookupFn: (id: string) => string) => {
      if (!ids || ids.length === 0) return '-';
      if (ids.length > 2) return `${ids.length} Items`;
      return ids.map(id => lookupFn(id)).join(', ');
  };

  const renderMultilineList = (ids: any[], lookupFn: (id: string) => string) => {
      if (!ids || ids.length === 0) return '-';
      return (
          <div className="flex flex-col gap-1">
              {ids.map(id => (
                  <span key={id} className="whitespace-nowrap">{lookupFn(id)}</span>
              ))}
          </div>
      );
  };

  return (
    <TooltipProvider>
    <OperationalPageShell>
       <OperationalPageHeader
          title="Advertiser View"
          subtitle={`Halo, ${currentUser?.name || 'Advertiser'}. Pantau performa iklan harian Anda di sini.`}
          eyebrow="Dashboard"
          icon={BarChart3}
          actions={
            <div className="dashboardHeaderActions">
               {isOwner && (
                   <div className="dashboardHeaderControl">
                       <Select value={selectedAdvertiserId} onValueChange={setSelectedAdvertiserId}>
                          <SelectTrigger>
                             <SelectValue placeholder="Pilih Advertiser" />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="all">Semua Advertiser</SelectItem>
                             {users
                               .filter(u => isAdvertiserRole(u.role) && u.status === 'active')
                               .map(u => (
                                 <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                               ))
                             }
                          </SelectContent>
                       </Select>
                   </div>
               )}
               <div className="dashboardHeaderDate">
                  <DatePickerWithRange date={dateRange} setDate={setDateRange} />
               </div>
            </div>
          }
       />

       {/* Filters Section */}
       <OperationalFilterPanel className="adFilterPanel">
            <div className={cn('adFilterGrid', activeTab === 'cs-performance' && 'csMode')}>
                 {activeTab === 'ads-summary' && (
                 <div className="filterField adFilterSearch">
                    <span className="filterFieldLabel">Pencarian</span>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input 
                          placeholder="Cari tanggal, platform, akun, CS..." 
                          className="pl-10"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                 </div>
                 )}

                 <div className="filterField">
                    <span className="filterFieldLabel">Platform</span>
                    <Select value={platformFilter} onValueChange={setPlatformFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Platform" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Platform</SelectItem>
                            {(activeTab === 'cs-performance' ? csPlatformOptions : filterOptions.platforms).map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                 </div>

                      {activeTab === 'cs-performance' && (
                       <div className="filterField">
                       <span className="filterFieldLabel">Akun Iklan</span>
                       <Select value={accountFilter} onValueChange={setAccountFilter}>
                          <SelectTrigger>
                              <SelectValue placeholder="Akun Iklan" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">Semua Akun Iklan</SelectItem>
                              {csAccountOptions.map(account => (
                                  <SelectItem key={account.id} value={account.id}>{account.accountName}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                      </div>
                      )}

                      {activeTab === 'ads-summary' && (
                      <>
                       <div className="filterField">
                       <span className="filterFieldLabel">Sub Channel</span>
                       <Select value={subChannelFilter} onValueChange={setSubChannelFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Sub Channel" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Sub</SelectItem>
                            {filterOptions.subChannels.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    </div>

                     <div className="filterField">
                     <span className="filterFieldLabel">Akun Iklan</span>
                     <Select value={accountFilter} onValueChange={setAccountFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Akun Iklan" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Akun</SelectItem>
                            {filterOptions.accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.accountName}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    </div>
                    </>
                    )}

                     <div className="filterField">
                     <span className="filterFieldLabel">CS</span>
                     <Select value={csFilter} onValueChange={setCsFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="CS" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua CS</SelectItem>
                            {(activeTab === 'cs-performance' ? csFilterOptions : filterOptions.cs).map(cs => (
                                <SelectItem key={cs.id} value={cs.id}>{cs.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    </div>
            </div>
       </OperationalFilterPanel>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AdvertiserViewTab)} className="space-y-4">
          <TabsList className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <TabsTrigger value="ads-summary" className="px-4">Ringkasan Iklan</TabsTrigger>
            <TabsTrigger value="cs-performance" className="px-4">Performa CS</TabsTrigger>
          </TabsList>

          <TabsContent value="ads-summary" className="space-y-6">
        <div className="space-y-6">
            {/* Top Cards */}
            <OperationalKpiGrid>
              <OperationalKpiCard
                label="Total Spending"
                icon={DollarSign}
                tone="blue"
                value={
                  <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
                    <span className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totals.spend)}
                    </span>
                    <span>Burn: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totals.burn)}</span>
                  </div>
                }
              />

              <OperationalKpiCard
                label="Total Prospek"
                icon={Users}
                tone="blue"
                value={
                  <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
                    <span className="text-2xl font-semibold text-slate-950 dark:text-slate-100">{totals.leadsDash}</span>
                    <span>Real: {totals.leadsReal}</span>
                  </div>
                }
              />

              <OperationalKpiCard
                label="Total Orders"
                icon={ShoppingCart}
                tone="emerald"
                value={
                  <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
                    <span className="text-2xl font-semibold text-slate-950 dark:text-slate-100">{totals.orders}</span>
                    <span>Selesai: {totals.ordersDone}</span>
                  </div>
                }
              />

              <OperationalKpiCard
                label="CPR Done"
                icon={TrendingUp}
                tone="violet"
                value={
                  <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
                        <span className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(avgCprDone)}
                        </span>
                        <div className="text-xs h-5 flex items-center gap-2">
                            <span className="text-cyan-600 dark:text-cyan-400 font-medium whitespace-nowrap" title="Cost per Lead (Dashboard)">
                                CPL(D): {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(avgCplAds)}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap" title="Cost per Result (Deal)">
                                CPR(Deal): {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(avgCpr)}
                            </span>
                        </div>
                  </div>
                }
              />
            </OperationalKpiGrid>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart 1: Efficiency Trend */}
                <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            Tren Efisiensi Cost (CPL & CPR)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs key="defs">
                                        <linearGradient key="effCyan" id="effCyan" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient key="effBlue" id="effBlue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient key="effEmerald" id="effEmerald" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient key="effPurple" id="effPurple" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#9333ea" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                                    <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), 'dd MMM')} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={12} tickFormatter={(val) => `Rp ${(val/1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        labelFormatter={(val) => format(new Date(val), 'dd MMMM yyyy', { locale: idLocale })}
                                        formatter={(value: any, name: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, name]}
                                    />
                                    <Legend />
                                    <Area key="cplDash" type="monotone" dataKey="cplDash" name="CPL (Dash)" stroke="#06b6d4" fill="url(#effCyan)" strokeWidth={2} dot={{ r: 3, fill: "#06b6d4", strokeWidth: 1, stroke: "#fff" }} />
                                    <Area key="cplReal" type="monotone" dataKey="cplReal" name="CPL (Real)" stroke="#2563eb" fill="url(#effBlue)" strokeWidth={2} dot={{ r: 3, fill: "#2563eb", strokeWidth: 1, stroke: "#fff" }} />
                                    <Area key="cprDeal" type="monotone" dataKey="cprDeal" name="CPR (Deal)" stroke="#10b981" fill="url(#effEmerald)" strokeWidth={2} dot={{ r: 3, fill: "#10b981", strokeWidth: 1, stroke: "#fff" }} />
                                    <Area key="cprDone" type="monotone" dataKey="cprDone" name="CPR (Done)" stroke="#9333ea" fill="url(#effPurple)" strokeWidth={2} dot={{ r: 3, fill: "#9333ea", strokeWidth: 1, stroke: "#fff" }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Chart 2: Volume Trend */}
                <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            Tren Volume (Leads & Orders)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs key="defs">
                                        <linearGradient key="volCyan" id="volCyan" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient key="volBlue" id="volBlue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient key="volEmerald" id="volEmerald" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient key="volPurple" id="volPurple" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#9333ea" stopOpacity={0.2}/>
                                            <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                                    <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), 'dd MMM')} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        labelFormatter={(val) => format(new Date(val), 'dd MMMM yyyy', { locale: idLocale })}
                                    />
                                    <Legend />
                                    <Area key="leadsDash" type="monotone" dataKey="leadsDashboard" name="Leads (Dash)" stroke="#06b6d4" fill="url(#volCyan)" strokeWidth={2} dot={{ r: 3, fill: "#06b6d4", strokeWidth: 1, stroke: "#fff" }} />
                                    <Area key="realLeads" type="monotone" dataKey="realLeads" name="Leads (Real)" stroke="#2563eb" fill="url(#volBlue)" strokeWidth={2} dot={{ r: 3, fill: "#2563eb", strokeWidth: 1, stroke: "#fff" }} />
                                    <Area key="realOrders" type="monotone" dataKey="realOrders" name="Orders (Deal)" stroke="#10b981" fill="url(#volEmerald)" strokeWidth={2} dot={{ r: 3, fill: "#10b981", strokeWidth: 1, stroke: "#fff" }} />
                                    <Area key="realOrdersDone" type="monotone" dataKey="realOrdersDone" name="Orders (Done)" stroke="#9333ea" fill="url(#volPurple)" strokeWidth={2} dot={{ r: 3, fill: "#9333ea", strokeWidth: 1, stroke: "#fff" }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Table */}
            <OperationalTableCard>
                <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">Detail Performa Harian</h3>
                </div>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                            <TableRow className="border-b border-slate-100 dark:border-slate-700">
                                <TableHead className="py-4 pl-6 w-[130px] font-semibold cursor-pointer" onClick={() => handleSort('date')}>Tgl Lead <ArrowUpDown className="w-3 h-3 inline" /></TableHead>
                                <TableHead className="py-4 font-semibold text-center px-4">Advertiser</TableHead>
                                <TableHead className="py-4 font-semibold text-center px-4">CS</TableHead>
                                <TableHead className="py-4 font-semibold text-center px-4">Platform / Sub Channel</TableHead>
                                <TableHead className="py-4 font-semibold text-center px-4">Akun</TableHead>
                                <TableHead className="py-4 text-right font-semibold cursor-pointer px-4" onClick={() => handleSort('spending')}>Spending <ArrowUpDown className="w-3 h-3 inline" /></TableHead>
                                <TableHead className="py-4 text-right font-semibold cursor-pointer px-4" onClick={() => handleSort('leads_real')}>Leads (Dash | Real) <ArrowUpDown className="w-3 h-3 inline" /></TableHead>
                                <TableHead className="py-4 text-right font-semibold cursor-pointer px-4" onClick={() => handleSort('orders_done')}>Orders (Deal | Done) <ArrowUpDown className="w-3 h-3 inline" /></TableHead>
                                <TableHead className="py-4 text-right font-semibold cursor-pointer pr-6" onClick={() => handleSort('cpl_real')}>Efisiensi (CPL) <ArrowUpDown className="w-3 h-3 inline" /></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                           {processedData.length === 0 ? (
                               <TableRow>
                                   <TableCell colSpan={10} className="py-0">
                                       <OperationalEmptyState
                                          icon={BarChart3}
                                          title="Tidak ada data"
                                          description="Ubah filter atau rentang tanggal untuk melihat performa advertiser."
                                       />
                                   </TableCell>
                               </TableRow>
                           ) : (
                               processedData.map(item => (
                                   <TableRow key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                       <TableCell className="py-4 pl-6 align-top">
                                           <div className="flex flex-col">
                                               <span className="font-medium text-slate-900 dark:text-slate-200">{format(new Date(item.date), 'dd MMM yyyy', { locale: idLocale })}</span>
                                               <span className="text-[10px] text-slate-400">{format(new Date(item.date), 'EEEE', { locale: idLocale })}</span>
                                           </div>
                                       </TableCell>
                                       <TableCell className="py-4 align-top text-center text-xs text-slate-600 dark:text-slate-400 px-4">
                                           {renderSimpleList(item.advertisers, getAdvertiserName)}
                                       </TableCell>
                                       <TableCell className="py-4 align-top text-center text-xs text-slate-600 dark:text-slate-400 px-4">
                                            {renderMultilineList(item.csIds, getCsName)}
                                       </TableCell>
                                       <TableCell className="py-4 align-top text-center text-xs text-slate-600 dark:text-slate-400 px-4">
                                            <div className="flex flex-col gap-1 items-center">
                                                <Badge variant="outline" className="font-normal bg-slate-50 text-slate-600 border-slate-200">
                                                    {renderSimpleList(item.platforms, getPlatformName)}
                                                </Badge>
                                                {item.subChannels && item.subChannels.length > 0 && (
                                                    <span className="text-[10px] text-slate-500">
                                                        {renderSimpleList(item.subChannels, getSubChannelName)}
                                                    </span>
                                                )}
                                            </div>
                                       </TableCell>
                                       <TableCell className="py-4 align-top text-center text-xs text-slate-500 dark:text-slate-400 px-4">
                                            {item.isMissingReport ? (
                                                <span className="text-red-500 flex items-center justify-center gap-1">
                                                    <AlertCircle className="w-3 h-3" />
                                                    <span className="text-[10px] font-medium">Belum Laporan</span>
                                                </span>
                                            ) : (
                                                renderSimpleList(item.accounts, getAccountName)
                                            )}
                                       </TableCell>
                                       <TableCell className="py-4 text-right align-top px-4">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.spend)}
                                                </span>
                                                <span className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                    Burn: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.burn)}
                                                </span>
                                            </div>
                                       </TableCell>
                                       <TableCell className="py-4 text-right align-top px-4">
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
                                       <TableCell className="py-4 text-right align-top px-4">
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
                                       <TableCell className="py-4 text-right align-top pr-6">
                                            <div className="flex flex-col items-end gap-1.5">
                                                <div className="flex items-center justify-end gap-2 text-xs">
                                                    <span className="text-slate-400">CPL:</span>
                                                    <div className="flex gap-1">
                                                        <span className="font-medium text-cyan-700 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-900/40 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                                                            D: {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(item.cplDash)}
                                                        </span>
                                                        <span className="font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                                                            R: {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(item.cplReal)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-end gap-2 text-xs">
                                                    <span className="text-slate-400">CPR(Deal):</span>
                                                    <span className="font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                                                        {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(item.cprDeal)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-end gap-2 text-xs">
                                                    <span className="text-slate-400">CPR(Done):</span>
                                                    <span className="font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                                                        {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(item.cprDone)}
                                                    </span>
                                                </div>
                                            </div>
                                       </TableCell>
                                   </TableRow>
                               ))
                           )}
                        </TableBody>
                        <TableFooter className="bg-slate-100 dark:bg-slate-800/80 border-t-2 border-slate-200 dark:border-slate-700">
                            <TableRow>
                                <TableCell colSpan={5} className="pl-6 py-4 font-bold text-slate-900 dark:text-slate-100">Total Summary</TableCell>
                                <TableCell className="text-right py-4 align-top">
                                    <div className="flex flex-col items-end gap-0.5">
                                        <span className="font-bold text-slate-900 dark:text-slate-100">
                                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totals.spend)}
                                        </span>
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                            Burn: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totals.burn)}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right py-4 align-top">
                                     <div className="flex flex-col items-end gap-1">
                                        <div className="flex items-center justify-end gap-2 text-xs">
                                            <span className="text-slate-400 font-normal">Dash:</span>
                                            <span className="font-bold text-cyan-600 dark:text-cyan-400">{totals.leadsDash}</span>
                                        </div>
                                        <div className="flex items-center justify-end gap-2 text-xs">
                                            <span className="text-slate-400 font-normal">Real:</span>
                                            <span className="font-bold text-blue-600 dark:text-blue-400">{totals.leadsReal}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right py-4 align-top">
                                     <div className="flex flex-col items-end gap-1">
                                        <div className="flex items-center justify-end gap-2 text-xs">
                                            <span className="text-slate-400 font-normal">Deal:</span>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{totals.orders}</span>
                                        </div>
                                        <div className="flex items-center justify-end gap-2 text-xs">
                                            <span className="text-slate-400 font-normal">Done:</span>
                                            <span className="font-bold text-purple-600 dark:text-purple-400">{totals.ordersDone}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right py-4 align-top pr-6">
                                     <div className="flex flex-col items-end gap-1">
                                        <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400 whitespace-nowrap">
                                            CPL(D): {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(avgCplAds)}
                                        </span>
                                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                            CPL(R): {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(avgCplReal)}
                                        </span>
                                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">
                                            CPR: {new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(avgCprDone)}
                                        </span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </OperationalTableCard>
        </div>
          </TabsContent>

            <TabsContent value="cs-performance" className="space-y-4">
              <OperationalKpiGrid>
                <OperationalKpiCard
                  label="Spending"
                  icon={TrendingUp}
                  tone="blue"
                  value={
                    <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
                      <span className="text-2xl font-semibold text-slate-950 dark:text-slate-100">{formatCurrency(csPerformanceTotals.spendDashboard)}</span>
                      <span>{formatCurrency(csPerformanceTotals.spendTotal)}</span>
                    </div>
                  }
                />
                <OperationalKpiCard
                  label="Lead Dashboard"
                  icon={Users}
                  tone="blue"
                  value={
                    <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
                      <span className="text-2xl font-semibold text-slate-950 dark:text-slate-100">{formatNumber(csPerformanceTotals.leadsDash)}</span>
                      <span>Prospek {formatNumber(csPerformanceTotals.leadsReal)}</span>
                    </div>
                  }
                />
                <OperationalKpiCard
                  label="Spam"
                  icon={TriangleAlert}
                  tone="rose"
                  value={
                    <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
                      <span className="text-2xl font-semibold text-rose-600 dark:text-rose-300">{formatNumber(csPerformanceTotals.spam)}</span>
                      <span className="invisible">-</span>
                    </div>
                  }
                />
                <OperationalKpiCard
                  label="Spam Rate"
                  icon={TrendingUp}
                  tone="amber"
                  value={
                    <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
                      <span className="text-2xl font-semibold text-amber-500 dark:text-amber-300">
                        {formatPercentAllowZero(csPerformanceSummary.spamRate)}
                      </span>
                      <span className="invisible">-</span>
                    </div>
                  }
                />
                <OperationalKpiCard
                  label="Cost/Lead"
                  icon={CheckCircle2}
                  tone="emerald"
                  value={
                    <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
                      <span className={`text-2xl font-semibold ${getCostPerLeadTextClass(csPerformanceSummary.cpl)}`}>
                        {formatCurrency(csPerformanceSummary.cpl)}
                      </span>
                      <span>{formatCurrency(csPerformanceSummary.cplTotal)}</span>
                    </div>
                  }
                />
                <OperationalKpiCard
                  label="Closing"
                  icon={ShoppingCart}
                  tone="violet"
                  value={
                    <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
                      <span className="text-2xl font-semibold text-slate-950 dark:text-slate-100">{formatNumber(csPerformanceTotals.orders)}</span>
                      <span>Selesai: {formatNumber(csPerformanceTotals.done)}</span>
                    </div>
                  }
                />
                <OperationalKpiCard
                  label="Cost/Closing"
                  icon={ShoppingCart}
                  tone="amber"
                  value={
                    <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
                      <span className="text-2xl font-semibold text-slate-950 dark:text-slate-100">{formatCurrency(csPerformanceSummary.costPerClosing)}</span>
                      <span>{formatCurrency(csPerformanceSummary.costPerClosingTotal)}</span>
                    </div>
                  }
                />
                <OperationalKpiCard
                  label="Cost/Selesai"
                  icon={CheckCircle2}
                  tone="emerald"
                  value={
                    <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
                      <span className="text-2xl font-semibold text-slate-950 dark:text-slate-100">{formatCurrency(csPerformanceSummary.costPerDone)}</span>
                      <span>{formatCurrency(csPerformanceSummary.costPerDoneTotal)}</span>
                    </div>
                  }
                />
                <OperationalKpiCard
                  label="ROAS"
                  icon={TrendingUp}
                  tone="amber"
                  value={
                    <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
                      <span className="text-2xl font-semibold text-slate-950 dark:text-slate-100">
                        {csPerformanceSummary.roas > 0 ? `${csPerformanceSummary.roas.toFixed(2)}x` : '-'}
                      </span>
                      <span className="invisible">-</span>
                    </div>
                  }
                  />
                </OperationalKpiGrid>

                <OperationalTableCard>
                  <CardHeader className="border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div>
                      <CardTitle className="text-base text-slate-800 dark:text-slate-100">Performa CPR Terbaik</CardTitle>
                      <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
                        Seluruh advertiser, CS, platform, dan akun iklan aktif berdasarkan CPR closing dan selesai dari filter aktif.
                      </p>
                    </div>
                  </CardHeader>
                  <div className="grid gap-4 p-3 sm:p-5 xl:grid-cols-2">
                    {csPerformanceBreakdowns.map((breakdown) => (
                      <div key={breakdown.title} className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Performa {breakdown.title}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-400">
                              Menampilkan {breakdown.rows.length} data aktif by CPR selesai
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:flex-wrap sm:justify-end">
                          <div className="rounded-md bg-cyan-50 px-2.5 py-1.5 dark:bg-cyan-950/30">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Lead Dashboard</div>
                            <div className="mt-0.5 font-mono text-sm font-bold text-cyan-700 dark:text-cyan-300">{formatNumber(breakdown.totals.leadsDash)}</div>
                            </div>
                            <div className="rounded-md bg-blue-50 px-2.5 py-1.5 dark:bg-blue-950/30">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Lead Real</div>
                              <div className="mt-0.5 font-mono text-sm font-bold text-blue-700 dark:text-blue-300">{formatNumber(breakdown.totals.leadsReal)}</div>
                            </div>
                            <div className="rounded-md bg-violet-50 px-2.5 py-1.5 dark:bg-violet-950/30">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">Closing</div>
                              <div className="mt-0.5 font-mono text-sm font-bold text-violet-700 dark:text-violet-300">{formatNumber(breakdown.totals.orders)}</div>
                            </div>
                            <div className="rounded-md bg-emerald-50 px-2.5 py-1.5 dark:bg-emerald-950/30">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Done</div>
                              <div className="mt-0.5 font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatNumber(breakdown.totals.done)}</div>
                            </div>
                          </div>
                        </div>
                        {breakdown.rows.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] table-fixed text-xs">
                              <colgroup>
                                <col className="w-[230px]" />
                                <col className="w-[110px]" />
                                <col className="w-[110px]" />
                                <col className="w-[110px]" />
                                <col className="w-[75px]" />
                                <col className="w-[75px]" />
                                <col className="w-[75px]" />
                              </colgroup>
                              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
                                <tr>
                                  <th className="px-4 py-2.5 text-left font-medium">{breakdown.title}</th>
                                  <th className="px-3 py-2.5 text-right font-medium">CPR Closing</th>
                                  <th className="px-3 py-2.5 text-right font-medium">CPR Selesai</th>
                                  <th className="px-3 py-2.5 text-right font-medium">Spend</th>
                                  <th className="px-3 py-2.5 text-center font-medium">Closing</th>
                                  <th className="px-3 py-2.5 text-center font-medium">Done</th>
                                  <th className="px-3 py-2.5 text-center font-medium">ROAS</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {breakdown.rows.map((row) => (
                                  <tr key={row.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                    <td className="px-4 py-3 align-top">
                                      <div className="flex min-w-0 items-start gap-2">
                                        {row.platformKey && (
                                          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                                            <PlatformLogo platform={row.platformKey} size="sm" />
                                          </span>
                                        )}
                                        <div className="min-w-0">
                                          <div className="truncate font-semibold text-slate-900 dark:text-slate-100" title={row.label}>
                                            {row.label}
                                          </div>
                                          {row.secondary && (
                                            <div className="mt-1 truncate text-[11px] text-slate-500" title={row.secondary}>
                                              {row.secondary}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-3 py-3 text-right align-top font-mono font-semibold text-slate-900 dark:text-slate-100">
                                      {formatCurrency(row.cprClosing)}
                                    </td>
                                    <td className="px-3 py-3 text-right align-top font-mono font-semibold text-slate-900 dark:text-slate-100">
                                      {formatCurrency(row.cprDone)}
                                    </td>
                                    <td className="px-3 py-3 text-right align-top">
                                      <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(row.spendDashboard)}</div>
                                      <div className="mt-1 font-mono text-[10px] text-slate-500">{formatCurrency(row.spendTotal)}</div>
                                    </td>
                                    <td className="px-3 py-3 text-center align-top font-mono font-semibold text-violet-600">
                                      {formatNumber(row.orders)}
                                    </td>
                                    <td className="px-3 py-3 text-center align-top">
                                      <div className="font-mono font-semibold text-emerald-600">{formatNumber(row.done)}</div>
                                      <div className="mt-1 font-mono text-[10px] text-slate-500">Lead {formatNumber(row.leadsDash)}</div>
                                    </td>
                                    <td className="px-3 py-3 text-center align-top">
                                      <div className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                                        {row.roas > 0 ? `${row.roas.toFixed(2)}x` : '-'}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                            Belum ada data real untuk kategori ini.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </OperationalTableCard>

            <OperationalTableCard>
              <CardHeader className="border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-base text-slate-800 dark:text-slate-100">Performa CS dan Iklan</CardTitle>
                    <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
                      Monitoring read-only performa CS berdasarkan akun iklan advertiser, platform, dan periode aktif.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium ${apiStatusClassName(apiAdsStatus)}`}>
                      {apiAdsStatus === 'loading' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      {apiStatusLabel(apiAdsStatus)}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2 bg-white dark:bg-slate-900"
                      onClick={() => setApiRefreshNonce((value) => value + 1)}
                      disabled={!rangeParams || apiAdsStatus === 'loading'}
                    >
                      <RefreshCw className={`h-4 w-4 ${apiAdsStatus === 'loading' ? 'animate-spin' : ''}`} />
                      Muat Ulang API
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <div className="space-y-3 p-3 sm:p-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Advertiser</div>
                    <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">
                      {targetAdvertiserId ? getAdvertiserName(targetAdvertiserId) : 'Semua Advertiser'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">CS Termonitor</div>
                    <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">
                      {csFilter === 'all' ? `${csFilterOptions.length} CS` : getCsName(csFilter)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Akun Iklan</div>
                    <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">
                      {activeAdvertiserAccounts.length} akun aktif
                    </div>
                  </div>
                </div>

                {apiAdsStatus === 'loading' && csPerformanceGroups.length === 0 ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <div className="h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                        <div className="mt-4 grid grid-cols-2 gap-4">
                          <div className="h-3 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                          <div className="h-3 w-20 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : csPerformanceGroups.length > 0 ? (
                  csPerformanceGroups.map((group) => {
                    const isExpanded = expandedCsDates.includes(group.date);
                    return (
                      <div key={group.date} className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                        <button
                          type="button"
                          className="w-full px-4 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70"
                          onClick={() => setExpandedCsDates((current) =>
                            current.includes(group.date)
                              ? current.filter((date) => date !== group.date)
                              : [...current, group.date],
                          )}
                        >
                          <div className="flex flex-col gap-4 lg:hidden">
                            <div className="flex items-start gap-3">
                              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm ${
                                isExpanded ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'
                              }`}>
                                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                              </span>
                              <div>
                                <div className="font-mono text-sm font-bold text-slate-950 dark:text-slate-100">
                                  {format(new Date(`${group.date}T00:00:00`), 'dd MMM yyyy', { locale: idLocale })}
                                </div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {format(new Date(`${group.date}T00:00:00`), 'EEEE', { locale: idLocale })}
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-md bg-slate-50 px-2.5 py-2 dark:bg-slate-800/60">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Spend</div>
                                <div className="mt-1 font-mono text-[13px] font-bold">{formatCurrency(group.spendDashboard)}</div>
                                <div className="mt-1 font-mono text-[10px] text-slate-500">{formatCurrency(group.spendTotal)}</div>
                              </div>
                              <div className="rounded-md bg-slate-50 px-2.5 py-2 dark:bg-slate-800/60">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Lead Dashboard</div>
                                <div className="mt-1 font-mono text-[13px] font-bold text-cyan-600">{formatNumber(group.leadsDash)}</div>
                                <div className="mt-1 font-mono text-[10px] text-slate-500">CRM: {formatNumber(group.leadsReal)}</div>
                              </div>
                              <div className="rounded-md bg-slate-50 px-2.5 py-2 dark:bg-slate-800/60">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Spam</div>
                                <div className="mt-1 font-mono text-[13px] font-bold text-red-600">{formatNumber(group.spam)}</div>
                                <div className="mt-1 font-mono text-[10px] text-amber-500">{formatPercentAllowZero(group.spamRate)}</div>
                              </div>
                              <div className="rounded-md bg-slate-50 px-2.5 py-2 dark:bg-slate-800/60">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Order</div>
                                <div className="mt-1 font-mono text-[13px] font-bold text-blue-600">{formatNumber(group.orders)}</div>
                                <div className="mt-1 font-mono text-[10px] text-slate-500">Selesai: {formatNumber(group.done)}</div>
                              </div>
                            </div>
                          </div>

                              <div className="hidden grid-cols-[160px_130px_110px_90px_90px_110px_130px_130px_130px_120px_90px] items-stretch divide-x divide-slate-100 dark:divide-slate-800 lg:grid">
                            <div className="flex h-full min-w-0 items-center gap-3 pr-3">
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm ${
                                isExpanded ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'
                              }`}>
                                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                              </span>
                              <div className="min-w-0">
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Tanggal</div>
                                <div className="mt-1 truncate font-mono text-[14px] font-bold text-slate-950 dark:text-slate-100">
                                  {format(new Date(`${group.date}T00:00:00`), 'dd MMM yyyy', { locale: idLocale })}
                                </div>
                                <div className="mt-1 truncate text-[11px] text-slate-500">
                                  {format(new Date(`${group.date}T00:00:00`), 'EEEE', { locale: idLocale })}
                                </div>
                              </div>
                            </div>
                            {[
                              ['Spend', formatCurrency(group.spendDashboard), formatCurrency(group.spendTotal), 'text-slate-950 dark:text-slate-100'],
                              ['Lead Dash.', formatNumber(group.leadsDash), `CRM: ${formatNumber(group.leadsReal)}`, 'text-cyan-600'],
                              ['Spam', formatNumber(group.spam), formatPercentAllowZero(group.spamRate), 'text-red-600'],
                              ['Order', formatNumber(group.orders), `Selesai: ${formatNumber(group.done)}`, 'text-blue-600'],
                                ['CPL', formatCurrency(group.cpl), '', getCostPerLeadTextClass(group.cpl)],
                                ['Cost/Closing', formatCurrency(group.cprClosing), '', 'text-slate-950 dark:text-slate-100'],
                                ['Cost/Selesai', group.done > 0 ? formatCurrency(group.spendDashboard / group.done) : '-', '', 'text-slate-950 dark:text-slate-100'],
                                ['Revenue', formatCurrency(group.revenue), '', 'text-slate-950 dark:text-slate-100'],
                                ['ROAS', group.roas > 0 ? `${group.roas.toFixed(2)}x` : '-', '', 'text-slate-950 dark:text-slate-100'],
                                ['Rows', formatNumber(group.rows.length), '', 'text-slate-950 dark:text-slate-100'],
                            ].map(([label, primary, secondary, className]) => (
                              <div key={label} className="flex h-full min-w-0 flex-col justify-start px-2 pt-1.5 text-right">
                                <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
                                <div className={`mt-1 truncate font-mono text-[13px] font-bold leading-tight ${className}`}>{primary}</div>
                                <div className={`mt-1 truncate font-mono text-[10px] leading-tight text-slate-500 ${secondary ? '' : 'invisible'}`}>{secondary || '-'}</div>
                              </div>
                            ))}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="w-full max-w-full overflow-x-auto border-t border-slate-100 pb-2 dark:border-slate-800">
                              <table className="w-full min-w-[1910px] table-fixed text-xs">
                                <colgroup>
                                  <col className="w-[170px]" />
                                  <col className="w-[320px]" />
                                <col className="w-[130px]" />
                                <col className="w-[120px]" />
                                <col className="w-[85px]" />
                                <col className="w-[95px]" />
                                <col className="w-[90px]" />
                                  <col className="w-[110px]" />
                                  <col className="w-[130px]" />
                                  <col className="w-[130px]" />
                                  <col className="w-[130px]" />
                                  <col className="w-[95px]" />
                                  <col className="w-[95px]" />
                                  <col className="w-[120px]" />
                              </colgroup>
                              <thead className="bg-white text-slate-500 dark:bg-slate-900">
                                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide dark:border-slate-800">
                                  <th className="px-4 py-3 text-left font-medium">CS</th>
                                  <th className="px-4 py-3 text-left font-medium">Platform / Akun</th>
                                  <th className="px-4 py-3 text-right font-medium">Spending</th>
                                  <th className="px-4 py-3 text-center font-medium">Lead Dashboard</th>
                                  <th className="px-4 py-3 text-center font-medium">Spam</th>
                                  <th className="px-4 py-3 text-center font-medium">Spam Rate</th>
                                  <th className="px-4 py-3 text-center font-medium">Order</th>
                                    <th className="px-4 py-3 text-right font-medium">Konversi</th>
                                    <th className="px-4 py-3 text-right font-medium">Cost per Lead</th>
                                    <th className="px-4 py-3 text-right font-medium">Cost per Closing</th>
                                    <th className="px-4 py-3 text-right font-medium">Cost per Selesai</th>
                                    <th className="px-4 py-3 text-center font-medium">Selesai</th>
                                    <th className="px-4 py-3 text-center font-medium">Batal</th>
                                    <th className="px-4 py-3 text-right font-medium">ROAS</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {group.rows.map((row, index) => (
                                  <tr key={`${row.date}-${row.accountId}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                    <td className="px-4 py-3 align-top">
                                      <div className="font-semibold text-slate-800 dark:text-slate-100">{row.csName}</div>
                                      <div className="mt-1 max-w-[170px] truncate text-[11px] text-slate-400" title={row.advertiserName}>{row.advertiserName}</div>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                      <div className="flex items-start gap-3">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950">
                                          <PlatformLogo platform={row.platformKey} size="sm" />
                                        </span>
                                        <div className="min-w-0">
                                          <div className="max-w-[280px] truncate font-semibold text-slate-900 dark:text-slate-100" title={row.accountName}>{row.accountName}</div>
                                          <div className="mt-1 text-[11px] text-slate-500">{row.platformName} / {row.subChannelName}</div>
                                          <Badge variant="outline" className={row.source === 'api'
                                            ? 'mt-2 border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700'
                                            : 'mt-2 border-slate-200 bg-slate-50 text-[11px] text-slate-600'}
                                          >
                                            {row.source === 'api' ? 'Connected' : 'Operasional'}
                                          </Badge>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right align-top">
                                      <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(row.spendDashboard)}</div>
                                      <div className="mt-1 font-mono text-[11px] text-slate-500">{formatCurrency(row.spendTotal)}</div>
                                    </td>
                                    <td className="px-4 py-3 text-center align-top">
                                      <div className="font-mono font-semibold text-cyan-600">{formatNumber(row.leadsDash)}</div>
                                      <div className="mt-1 text-[11px] text-slate-500">Prospek CRM: {formatNumber(row.leadsReal)}</div>
                                    </td>
                                    <td className="px-4 py-3 text-center align-top font-mono font-semibold text-red-600">{formatNumber(row.spam)}</td>
                                    <td className="px-4 py-3 text-center align-top font-mono font-semibold text-amber-500">{formatPercentAllowZero(row.spamRate)}</td>
                                    <td className="px-4 py-3 text-center align-top font-mono font-semibold text-blue-600">{formatNumber(row.orders)}</td>
                                    <td className={`px-4 py-3 text-right align-top font-mono font-semibold ${getConversionRateTextClass(row.orderRate)}`}>{formatPercent(row.orderRate)}</td>
                                      <td className={`px-4 py-3 text-right align-top font-mono font-semibold ${getCostPerLeadTextClass(row.cpl)}`}>{formatCurrency(row.cpl)}</td>
                                      <td className="px-4 py-3 text-right align-top font-mono font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(row.cprClosing)}</td>
                                      <td className="px-4 py-3 text-right align-top font-mono font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(row.costPerDone)}</td>
                                      <td className="px-4 py-3 text-center align-top font-mono font-semibold text-emerald-600">{formatNumber(row.done)}</td>
                                    <td className="px-4 py-3 text-center align-top font-mono font-semibold text-red-500">{formatNumber(row.cancelled)}</td>
                                    <td className="px-4 py-3 text-right align-top">
                                      <div className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                        {row.roas > 0 ? `${row.roas.toFixed(2)}x` : '-'}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <OperationalEmptyState
                    icon={BarChart3}
                    title="Belum ada data performa CS"
                    description="Data akan muncul dari snapshot API, assignment akun iklan, prospek, order, dan input spam pada periode yang dipilih."
                  />
                )}
              </div>
            </OperationalTableCard>
          </TabsContent>
        </Tabs>
    </OperationalPageShell>
    </TooltipProvider>
  );
}
