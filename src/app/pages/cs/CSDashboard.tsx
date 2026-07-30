import React, { useState, useMemo } from 'react';
import { useMasterData } from '../master-data/context';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { SmartFilterDate } from '@/app/components/SmartFilterDate';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { DateRange } from "react-day-picker";
import { addDays, differenceInCalendarDays, startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { 
  Users, 
  ShoppingCart, 
  CheckCircle, 
  TrendingUp, 
  AlertTriangle,
  Loader2,
  ChevronDown,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Legend, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { usePermissions } from '@/app/hooks/usePermissions';
import { isCsRole } from '@/app/data/roleHelpers';
import {
  fetchAdsIntegrationConfigs,
  fetchMetaSnapshotDataset,
  syncMetaSnapshotDataset,
  type AdsIntegrationConfig,
} from '@/app/services/liveAdsService';
import {
  fetchGoogleAdsIntegrationConfigs,
  fetchGoogleAdsSnapshotDataset,
  syncGoogleAdsSnapshotDataset,
  type GoogleAdsIntegrationConfig,
} from '@/app/services/googleAdsLiveService';
import {
  fetchTikTokAdsIntegrationConfigs,
  fetchTikTokAdsSnapshotDataset,
  syncTikTokAdsSnapshotDataset,
  type TikTokAdsIntegrationConfig,
} from '@/app/services/tiktokAdsLiveService';
import { PlatformLogo } from '@/app/components/ui/PlatformLogo';
import {
  OperationalEmptyState,
  OperationalKpiCard,
  OperationalKpiGrid,
  OperationalFilterPanel,
  RequiredLabel,
  OperationalPageHeader,
  OperationalPageShell,
  OperationalTableCard,
} from '@/app/components/ui/operational-page';
import { toast } from 'sonner';

type SpamInputFormState = {
  id?: string;
  inputDate: string;
  csId: string;
  platformId: string;
  advertiserId: string;
  spamCount: string;
  notes: string;
};

type CsAdsDailyMetric = {
  date: string;
  spend: number;
  leads: number;
  source: 'api';
};

type CsAdsAccountMetric = CsAdsDailyMetric & {
  adAccountId?: string;
  advertiserId?: string | null;
  csId?: string | null;
  subChannelId?: string | null;
  platformId?: string | null;
  platformKey: string;
  accountName: string;
  ppn: number;
  fee: number;
};

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

type ApiAdsStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

type CsViewApiCacheEntry = {
  metrics: Record<string, CsAdsDailyMetric>;
  byDateAccount: Record<string, CsAdsAccountMetric>;
  status: ApiAdsStatus;
};

type CsViewFilterState = {
  selectedCsId?: string;
  selectedPlatformId?: string;
  dateRange?: {
    from?: string;
    to?: string;
  };
};

type CsViewTab = 'performance' | 'spam-inputs';

const CS_VIEW_FILTER_STORAGE_KEY = 'polesheadlamp_cs_view_filters_v1';
const CS_VIEW_MAX_RANGE_DAYS = 62;
const CS_VIEW_DEFAULT_ITEMS_PER_PAGE = 31;
const csViewApiCache = new Map<string, CsViewApiCacheEntry>();

const formatShortCurrency = (value: number) =>
  value > 0
    ? value.toLocaleString('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    })
    : '-';

const formatNumber = (value: number) =>
  value > 0 ? value.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '-';

const formatCount = (value: number) =>
  Number.isFinite(value) ? value.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '0';

const getConversionRateTextClass = (value: number) => {
  if (!Number.isFinite(value)) return 'text-slate-950 dark:text-slate-100';
  if (value < 10) return 'text-red-600 dark:text-red-300';
  if (value <= 12) return 'text-amber-500 dark:text-amber-300';
  return 'text-emerald-600 dark:text-emerald-300';
};

const getCostPerLeadTextClass = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 'text-slate-950 dark:text-slate-100';
  if (value < 8_000) return 'text-emerald-600 dark:text-emerald-300';
  if (value <= 10_000) return 'text-amber-500 dark:text-amber-300';
  return 'text-red-600 dark:text-red-300';
};

type MetricTone = 'default' | 'blue' | 'cyan' | 'emerald' | 'amber' | 'red';

const getCostPerLeadTone = (value: number): MetricTone => {
  if (!Number.isFinite(value) || value <= 0) return 'default';
  if (value < 8_000) return 'emerald';
  if (value <= 10_000) return 'amber';
  return 'red';
};

type SpendIndicatorTone = 'none' | 'low' | 'target' | 'high';
type CostIndicatorTone = 'none' | 'good' | 'target' | 'bad';

const getSpendIndicatorTone = (spendTotal: number): SpendIndicatorTone => {
  if (spendTotal <= 0) return 'none';
  if (spendTotal < 1_000_000) return 'low';
  if (spendTotal <= 1_200_000) return 'target';
  return 'high';
};

const spendIndicatorStyles: Record<SpendIndicatorTone, { badge: string; dot: string; title: string }> = {
  none: {
    badge: 'text-slate-500 dark:text-slate-400',
    dot: 'bg-slate-300',
    title: 'Belum ada total spending',
  },
  low: {
    badge: 'border border-red-100 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
    dot: 'bg-red-500',
    title: 'Total spending di bawah Rp 1.000.000',
  },
  target: {
    badge: 'border border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
    dot: 'bg-amber-500',
    title: 'Total spending Rp 1.000.000 sampai Rp 1.200.000',
  },
  high: {
    badge: 'border border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    title: 'Total spending di atas Rp 1.200.000',
  },
};

const getCprClosingIndicatorTone = (value: number): CostIndicatorTone => {
  if (value <= 0) return 'none';
  if (value < 80_000) return 'good';
  if (value <= 100_000) return 'target';
  return 'bad';
};

const cprClosingIndicatorStyles: Record<CostIndicatorTone, { badge: string; dot: string; title: string }> = {
  none: {
    badge: 'text-slate-500 dark:text-slate-400',
    dot: 'bg-slate-300',
    title: 'Belum ada CPR closing',
  },
  good: {
    badge: 'border border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    title: 'CPR closing di bawah Rp 80.000',
  },
  target: {
    badge: 'border border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
    dot: 'bg-amber-500',
    title: 'CPR closing Rp 80.000 sampai Rp 100.000',
  },
  bad: {
    badge: 'border border-red-100 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
    dot: 'bg-red-500',
    title: 'CPR closing di atas Rp 100.000',
  },
};

function SpendingCellValue({
  spendDashboard,
  spendTotal,
}: {
  spendDashboard: number;
  spendTotal: number;
}) {
  const tone = getSpendIndicatorTone(spendTotal);
  const indicator = spendIndicatorStyles[tone];

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
        {formatShortCurrency(spendDashboard)}
      </div>
      <div
        className={`inline-flex items-center justify-end gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] leading-tight ${indicator.badge}`}
        title={indicator.title}
      >
        {tone !== 'none' && <span className={`h-1.5 w-1.5 rounded-full ${indicator.dot}`} />}
        <span>{formatShortCurrency(spendTotal)}</span>
      </div>
    </div>
  );
}

function CprClosingCellValue({
  cprClosing,
  cprClosingTotal,
}: {
  cprClosing: number;
  cprClosingTotal: number;
}) {
  const tone = getCprClosingIndicatorTone(cprClosingTotal);
  const indicator = cprClosingIndicatorStyles[tone];

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
        {formatShortCurrency(cprClosing)}
      </div>
      <div
        className={`inline-flex items-center justify-end gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] leading-tight ${indicator.badge}`}
        title={indicator.title}
      >
        {tone !== 'none' && <span className={`h-1.5 w-1.5 rounded-full ${indicator.dot}`} />}
        <span>{formatShortCurrency(cprClosingTotal)}</span>
      </div>
    </div>
  );
}

const readCsViewFilterState = (): CsViewFilterState => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.sessionStorage.getItem(CS_VIEW_FILTER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeCsViewFilterState = (state: CsViewFilterState) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(CS_VIEW_FILTER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be blocked in some browser modes; the page should still render.
  }
};

const sanitizeCsViewDateRange = (range: DateRange | undefined): DateRange | undefined => {
  if (!range?.from) return range;

  const from = range.from;
  const rawTo = range.to || range.from;
  const to = differenceInCalendarDays(rawTo, from) > CS_VIEW_MAX_RANGE_DAYS
    ? addDays(from, CS_VIEW_MAX_RANGE_DAYS)
    : rawTo;

  return { from, to };
};

const readInitialDateRange = (): DateRange => {
  const storedRange = readCsViewFilterState().dateRange;
  const from = storedRange?.from ? parseISO(`${storedRange.from}T00:00:00`) : null;
  const to = storedRange?.to ? parseISO(`${storedRange.to}T00:00:00`) : null;

  if (from && !Number.isNaN(from.getTime())) {
    return sanitizeCsViewDateRange({
      from,
      to: to && !Number.isNaN(to.getTime()) ? to : from,
    }) || {
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    };
  }

  return {
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  };
};

const buildApiCacheKey = (range: { from: string; to: string } | null) =>
  range ? `${range.from}:${range.to}` : null;

const normalizeLookupKey = (value?: string | null) =>
  (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();

const resolvePlatformKey = (value?: string | null) => {
  const normalized = normalizeLookupKey(value);
  if (normalized.includes('google')) return 'google';
  if (normalized.includes('tiktok')) return 'tiktok';
  if (normalized.includes('meta') || normalized.includes('facebook') || normalized.includes('instagram')) {
    return 'meta';
  }
  return 'meta';
};

const formatPercent = (value: number) =>
  Number.isFinite(value) && value > 0 ? `${value.toFixed(1)}%` : '-';

const formatPercentAllowZero = (value: number) =>
  Number.isFinite(value) ? `${value.toFixed(1)}%` : '-';

type SummaryCellProps = {
  label: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  primaryClassName?: string;
  showLabel?: boolean;
};

const summaryAlignClass = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

function SummaryCell({
  label,
  primary,
  secondary,
  align = 'right',
  primaryClassName = 'text-slate-950 dark:text-slate-100',
  showLabel = false,
}: SummaryCellProps) {
  return (
    <th className={`px-4 py-4 align-top font-normal ${summaryAlignClass[align]}`}>
      {showLabel && (
        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {label}
        </div>
      )}
      <div className={`${showLabel ? 'mt-1' : ''} font-mono text-[12px] font-semibold leading-tight ${primaryClassName}`}>
        {primary}
      </div>
      {secondary && (
        <div className="mt-1 font-mono text-[10px] leading-tight text-slate-500 dark:text-slate-400">
          {secondary}
        </div>
      )}
    </th>
  );
}

type DailySummaryMetricProps = {
  label: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  tone?: MetricTone;
  align?: 'left' | 'center' | 'right';
};

const dailyMetricToneClass: Record<NonNullable<DailySummaryMetricProps['tone']>, string> = {
  default: 'text-slate-950 dark:text-slate-100',
  blue: 'text-blue-600 dark:text-blue-300',
  cyan: 'text-cyan-600 dark:text-cyan-300',
  emerald: 'text-emerald-600 dark:text-emerald-300',
  amber: 'text-amber-500 dark:text-amber-300',
  red: 'text-red-500 dark:text-red-300',
};

function DailySummaryMetric({
  label,
  primary,
  secondary,
  tone = 'default',
  align = 'left',
}: DailySummaryMetricProps) {
  return (
    <div
      className={`min-w-0 rounded-md bg-slate-50 px-2.5 py-2 dark:bg-slate-800/60 sm:rounded-none sm:bg-transparent sm:p-0 sm:dark:bg-transparent ${
        align === 'right' ? 'text-left sm:text-right' : 'text-left'
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div className={`mt-1 break-words font-mono text-[13px] font-bold leading-tight sm:whitespace-nowrap ${dailyMetricToneClass[tone]}`}>
        {primary}
      </div>
      {secondary && (
        <div className="mt-1 break-words font-mono text-[10px] leading-tight text-slate-500 dark:text-slate-400 sm:whitespace-nowrap">
          {secondary}
        </div>
      )}
    </div>
  );
}

function DailySummaryTableCell({
  label,
  primary,
  secondary,
  tone = 'default',
  align = 'right',
}: DailySummaryMetricProps & { align?: 'left' | 'center' | 'right' }) {
  const alignClass = align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right';

  return (
    <div className={`flex h-full min-w-0 flex-col justify-start px-2 pt-1.5 ${alignClass}`}>
      <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div className={`mt-1 truncate font-mono text-[13px] font-bold leading-tight ${dailyMetricToneClass[tone]}`}>
        {primary}
      </div>
      <div className={`mt-1 truncate font-mono text-[10px] leading-tight text-slate-500 dark:text-slate-400 ${secondary ? '' : 'invisible'}`}>
        {secondary || '-'}
      </div>
    </div>
  );
}

function DailyRateMetric({ value }: { value: number }) {
  const progress = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const conversionRateTextClass = getConversionRateTextClass(value);

  return (
    <div className="rounded-md bg-slate-50 px-2.5 py-2 dark:bg-slate-800/60 sm:rounded-none sm:bg-transparent sm:p-0 sm:dark:bg-transparent">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Konversi
        </div>
        <div className={`font-mono text-[12px] font-bold ${conversionRateTextClass}`}>
          {formatPercent(value)}
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-50 dark:bg-blue-950/30">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function HorizontalDragScroll({ children }: { children: React.ReactNode }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const isDraggingRef = React.useRef(false);
  const startXRef = React.useRef(0);
  const scrollLeftRef = React.useRef(0);
  const [isDragging, setIsDragging] = React.useState(false);

  React.useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      event.preventDefault();
      containerRef.current.scrollLeft = scrollLeftRef.current - (event.clientX - startXRef.current);
    };

    const stopDragging = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      containerRef.current?.style.removeProperty('user-select');
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);
    window.addEventListener('blur', stopDragging);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('blur', stopDragging);
    };
  }, []);

  const scrollByAmount = (amount: number) => {
    containerRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 sm:hidden">
        <span>Geser tabel ke kiri/kanan</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            aria-label="Geser tabel ke kiri"
            onClick={() => scrollByAmount(-360)}
          >
            &lt;
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            aria-label="Geser tabel ke kanan"
            onClick={() => scrollByAmount(360)}
          >
            &gt;
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className={`w-full max-w-full touch-pan-x overflow-x-auto overscroll-x-contain border-t border-slate-100 pb-2 [-webkit-overflow-scrolling:touch] dark:border-slate-800 ${
          isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
        }`}
        onMouseDown={(event) => {
          if (!containerRef.current || containerRef.current.scrollWidth <= containerRef.current.clientWidth) return;
          isDraggingRef.current = true;
          setIsDragging(true);
          startXRef.current = event.clientX;
          scrollLeftRef.current = containerRef.current.scrollLeft;
          containerRef.current.style.userSelect = 'none';
        }}
      >
        {children}
      </div>
    </>
  );
}

const getApiStatusLabel = (status: ApiAdsStatus) => {
  if (status === 'ready') return 'Connected';
  if (status === 'loading') return 'Loading';
  return 'Unconnect';
};

const apiStatusClassName = (status: ApiAdsStatus) => {
  if (status === 'ready') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300';
  }
  if (status === 'loading') {
    return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300';
  }
  if (status === 'error') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300';
  }
  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300';
};

export function CSDashboard({ userId }: { userId?: string }) {
  const {
    currentUser,
    orders,
    leads,
    leadSpamDailyInputs,
    users,
    adAccounts,
    adAccountAssignments,
    platforms,
    subChannels,
    addLeadSpamDailyInput,
    updateLeadSpamDailyInput,
    deleteLeadSpamDailyInput,
  } = useMasterData();
  const { hasPermission } = usePermissions();
  
  // Internal selection state for Owner viewing this dashboard
  const isOwner = hasPermission('dashboard.view_owner');
  const canManageSpamInputs = hasPermission('leads.edit') || isOwner || isCsRole(currentUser?.role);
  const [selectedCsId, setSelectedCsId] = useState<string>(() => (
    userId || readCsViewFilterState().selectedCsId || 'all'
  ));
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>(() => (
    readCsViewFilterState().selectedPlatformId || 'all'
  ));

  // Update selection if prop changes
  React.useEffect(() => {
     if (userId) setSelectedCsId(userId);
  }, [userId]);

  const targetId = useMemo(() => {
     if (isOwner) {
         return selectedCsId === 'all' ? undefined : selectedCsId;
     }
     return userId || currentUser?.id;
  }, [isOwner, selectedCsId, userId, currentUser]);
  const targetPlatformId = useMemo(() => (
    selectedPlatformId === 'all' ? undefined : selectedPlatformId
  ), [selectedPlatformId]);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => readInitialDateRange());
  const [apiAdsMetrics, setApiAdsMetrics] = useState<Record<string, CsAdsDailyMetric>>({});
  const [apiAdsByDateAccount, setApiAdsByDateAccount] = useState<Record<string, CsAdsAccountMetric>>({});
  const [apiAdsStatus, setApiAdsStatus] = useState<ApiAdsStatus>('idle');
  const [metaIntegrationConfigs, setMetaIntegrationConfigs] = useState<AdsIntegrationConfig[]>([]);
  const [googleIntegrationConfigs, setGoogleIntegrationConfigs] = useState<GoogleAdsIntegrationConfig[]>([]);
  const [tiktokIntegrationConfigs, setTikTokIntegrationConfigs] = useState<TikTokAdsIntegrationConfig[]>([]);
  const [apiRefreshNonce, setApiRefreshNonce] = useState(0);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(CS_VIEW_DEFAULT_ITEMS_PER_PAGE);
  const [isSpamDialogOpen, setIsSpamDialogOpen] = useState(false);
  const [isSavingSpamInput, setIsSavingSpamInput] = useState(false);
  const [activeTab, setActiveTab] = useState<CsViewTab>('performance');
  const [spamInputToDelete, setSpamInputToDelete] = useState<string | null>(null);
  const [isSpamFormMobile, setIsSpamFormMobile] = useState(false);
  const [spamForm, setSpamForm] = useState<SpamInputFormState>({
    inputDate: '',
    csId: '',
    platformId: '',
    advertiserId: '',
    spamCount: '',
    notes: '',
  });
  const [expandedDateGroups, setExpandedDateGroups] = useState<string[]>(() => [
    format(new Date(), 'yyyy-MM-dd'),
  ]);
  const lastApiRefreshNonceRef = React.useRef(0);
  const lastSpamScopeKeyRef = React.useRef('');
  React.useEffect(() => {
    const checkMobile = () => setIsSpamFormMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  React.useEffect(() => {
    setItemsPerPage((current) => current === 25 ? CS_VIEW_DEFAULT_ITEMS_PER_PAGE : current);
  }, []);
  const handleDateRangeChange = React.useCallback((range: DateRange | undefined) => {
    setDateRange(sanitizeCsViewDateRange(range));
  }, []);
  const toggleDateGroup = React.useCallback((dateKey: string) => {
    setExpandedDateGroups((current) =>
      current.includes(dateKey)
        ? current.filter((date) => date !== dateKey)
        : [...current, dateKey],
    );
  }, []);

  const rangeParams = useMemo(() => {
    if (!dateRange?.from) return null;

    return {
      from: format(dateRange.from, 'yyyy-MM-dd'),
      to: format(dateRange.to || dateRange.from, 'yyyy-MM-dd'),
    };
  }, [dateRange]);

  React.useEffect(() => {
    writeCsViewFilterState({
      selectedCsId,
      selectedPlatformId,
      dateRange: rangeParams || undefined,
    });
  }, [rangeParams, selectedCsId, selectedPlatformId]);

  const platformFilterOptions = useMemo(() => {
    const activePlatformIds = new Set(
      adAccounts
        .filter((account) => account.status === 'active' && account.platformId)
        .map((account) => account.platformId as string),
    );

    return platforms
      .filter((platform) => activePlatformIds.has(platform.id))
      .sort((left, right) => left.name.localeCompare(right.name, 'id-ID'));
  }, [adAccounts, platforms]);

  const spamCsOptions = useMemo(() => (
    users
      .filter((user) => isCsRole(user.role) && user.status === 'active')
      .sort((left, right) => left.name.localeCompare(right.name, 'id-ID'))
  ), [users]);

  const spamAdvertiserOptions = useMemo(() => {
    const spamCsScopeId = spamForm.csId || targetId;
    const spamDateScope = spamForm.inputDate || rangeParams?.to || rangeParams?.from;
    const activeAdvertiserIds = new Set(
      adAccounts
        .filter((account) => {
          if (account.status !== 'active') return false;
          if (!spamCsScopeId) return false;

          const matchedAssignment = adAccountAssignments
            .filter((assignment) =>
              assignment.adAccountId === account.id &&
              assignment.status === 'active' &&
              assignment.csId === spamCsScopeId &&
              (!spamDateScope ||
                (assignment.startDate <= spamDateScope &&
                  (!assignment.endDate || assignment.endDate >= spamDateScope))),
            )
            .sort((left, right) => right.startDate.localeCompare(left.startDate))[0];

          return Boolean(matchedAssignment);
        })
        .map((account) => account.advertiserId)
        .filter(Boolean),
    );

    return users
      .filter((user) => user.role === 'Advertiser' && user.status === 'active' && activeAdvertiserIds.has(user.id))
      .sort((left, right) => left.name.localeCompare(right.name, 'id-ID'));
  }, [
    adAccountAssignments,
    adAccounts,
    rangeParams?.from,
    rangeParams?.to,
    spamForm.csId,
    spamForm.inputDate,
    targetId,
    users,
  ]);

  const spamPlatformOptions = useMemo(() => {
    const spamCsScopeId = spamForm.csId || targetId;
    const spamDateScope = spamForm.inputDate || rangeParams?.to || rangeParams?.from;
    const assignedPlatformIds = new Set(
      adAccounts
        .filter((account) => {
          if (account.status !== 'active') return false;
          if (!spamCsScopeId) return false;
          if (spamForm.advertiserId && account.advertiserId !== spamForm.advertiserId) return false;

          const matchedAssignment = adAccountAssignments
            .filter((assignment) =>
              assignment.adAccountId === account.id &&
              assignment.status === 'active' &&
              assignment.csId === spamCsScopeId &&
              (!spamDateScope ||
                (assignment.startDate <= spamDateScope &&
                  (!assignment.endDate || assignment.endDate >= spamDateScope))),
            )
            .sort((left, right) => right.startDate.localeCompare(left.startDate))[0];

          return Boolean(matchedAssignment);
        })
        .map((account) => account.platformId)
        .filter(Boolean),
    );

    return platforms
      .filter((platform) => assignedPlatformIds.has(platform.id))
      .sort((left, right) => left.name.localeCompare(right.name, 'id-ID'));
  }, [
    adAccountAssignments,
    adAccounts,
    platforms,
    rangeParams?.from,
    rangeParams?.to,
    spamForm.advertiserId,
    spamForm.csId,
    spamForm.inputDate,
    targetId,
  ]);

  React.useEffect(() => {
    if (selectedPlatformId === 'all') return;
    if (platformFilterOptions.some((platform) => platform.id === selectedPlatformId)) return;
    setSelectedPlatformId('all');
  }, [platformFilterOptions, selectedPlatformId]);

  React.useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      fetchAdsIntegrationConfigs(),
      fetchGoogleAdsIntegrationConfigs(),
      fetchTikTokAdsIntegrationConfigs(),
    ])
      .then(([meta, google, tiktok]) => {
        if (cancelled) return;

        setMetaIntegrationConfigs(meta.status === 'fulfilled' ? meta.value : []);
        setGoogleIntegrationConfigs(google.status === 'fulfilled' ? google.value : []);
        setTikTokIntegrationConfigs(tiktok.status === 'fulfilled' ? tiktok.value : []);
      })
      .catch(() => {
        if (!cancelled) {
          setMetaIntegrationConfigs([]);
          setGoogleIntegrationConfigs([]);
          setTikTokIntegrationConfigs([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const googleIntegrationConfigByAdAccountId = useMemo(() => {
    return new Map(googleIntegrationConfigs.map((config) => [config.adAccountId, config]));
  }, [googleIntegrationConfigs]);

  const metaIntegrationConfigByAdAccountId = useMemo(() => {
    return new Map(metaIntegrationConfigs.map((config) => [config.adAccountId, config]));
  }, [metaIntegrationConfigs]);

  const tiktokIntegrationConfigByAdAccountId = useMemo(() => {
    return new Map(tiktokIntegrationConfigs.map((config) => [config.adAccountId, config]));
  }, [tiktokIntegrationConfigs]);

  const isConnectedAdAccount = React.useCallback(
    (account: (typeof adAccounts)[number]) => {
      const platformKey = resolvePlatformKey(
        platforms.find((platform) => platform.id === account.platformId)?.name,
      );

      if (platformKey === 'google') {
        return googleIntegrationConfigByAdAccountId.get(account.id)?.enabled === true;
      }

      if (platformKey === 'tiktok') {
        return tiktokIntegrationConfigByAdAccountId.get(account.id)?.enabled === true;
      }

      return metaIntegrationConfigByAdAccountId.get(account.id)?.enabled === true;
    },
    [
      googleIntegrationConfigByAdAccountId,
      metaIntegrationConfigByAdAccountId,
      platforms,
      tiktokIntegrationConfigByAdAccountId,
    ],
  );

  const shouldShowAdAccountInCsView = React.useCallback(
    (account: (typeof adAccounts)[number]) => {
      const platformKey = resolvePlatformKey(
        platforms.find((platform) => platform.id === account.platformId)?.name,
      );
      if (platformKey !== 'google') return true;
      if (googleIntegrationConfigs.length === 0) return true;

      return googleIntegrationConfigByAdAccountId.get(account.id)?.enabled === true;
    },
    [googleIntegrationConfigByAdAccountId, googleIntegrationConfigs.length, platforms],
  );

  const buildInitialSpamFormState = React.useCallback((dateKey?: string): SpamInputFormState => {
    const defaultCsId = targetId
      || (currentUser && isCsRole(currentUser.role) ? currentUser.id : '')
      || spamCsOptions[0]?.id
      || '';

    return {
      inputDate: dateKey || rangeParams?.to || rangeParams?.from || format(new Date(), 'yyyy-MM-dd'),
      csId: defaultCsId,
      platformId: targetPlatformId || platformFilterOptions[0]?.id || '',
      advertiserId: '',
      spamCount: '',
      notes: '',
    };
  }, [currentUser, platformFilterOptions, rangeParams, spamCsOptions, targetId, targetPlatformId]);

  const openSpamInputDialog = React.useCallback((dateKey?: string) => {
    lastSpamScopeKeyRef.current = '';
    setSpamForm(buildInitialSpamFormState(dateKey));
    setIsSpamDialogOpen(true);
  }, [buildInitialSpamFormState]);

  const openSpamInputEditDialog = React.useCallback((item: (typeof leadSpamDailyInputs)[number]) => {
    lastSpamScopeKeyRef.current = '';
    setSpamForm({
      id: item.id,
      inputDate: item.inputDate,
      csId: item.csId,
      platformId: item.platformId,
      advertiserId: item.advertiserId,
      spamCount: String(item.spamCount),
      notes: item.notes || '',
    });
    setIsSpamDialogOpen(true);
  }, []);

  const spamFormScopeKey = `${spamForm.inputDate}::${spamForm.csId}::${spamForm.platformId}::${spamForm.advertiserId}`;

  React.useEffect(() => {
    if (!isSpamDialogOpen) return;
    if (spamFormScopeKey === lastSpamScopeKeyRef.current) return;
    lastSpamScopeKeyRef.current = spamFormScopeKey;

    if (!spamForm.inputDate || !spamForm.csId || !spamForm.platformId || !spamForm.advertiserId) {
      setSpamForm((current) => ({ ...current, id: undefined, spamCount: '', notes: '' }));
      return;
    }

    const existing = leadSpamDailyInputs.find((item) =>
      item.inputDate === spamForm.inputDate &&
      item.csId === spamForm.csId &&
      item.platformId === spamForm.platformId &&
      item.advertiserId === spamForm.advertiserId,
    );

    setSpamForm((current) => ({
      ...current,
      id: existing?.id,
      spamCount: existing ? String(existing.spamCount) : '',
      notes: existing?.notes || '',
    }));
  }, [isSpamDialogOpen, leadSpamDailyInputs, spamForm.advertiserId, spamForm.csId, spamForm.inputDate, spamForm.platformId, spamFormScopeKey]);

  React.useEffect(() => {
    if (!isSpamDialogOpen) return;
    if (spamForm.advertiserId && !spamAdvertiserOptions.some((advertiser) => advertiser.id === spamForm.advertiserId)) {
      setSpamForm((current) => ({ ...current, advertiserId: '', platformId: '', id: undefined, spamCount: '', notes: '' }));
    }
  }, [isSpamDialogOpen, spamAdvertiserOptions, spamForm.advertiserId]);

  React.useEffect(() => {
    if (!isSpamDialogOpen) return;
    if (spamForm.platformId && !spamPlatformOptions.some((platform) => platform.id === spamForm.platformId)) {
      setSpamForm((current) => ({ ...current, platformId: '', id: undefined, spamCount: '', notes: '' }));
    }
  }, [isSpamDialogOpen, spamForm.platformId, spamPlatformOptions]);

  const adAccountLookup = useMemo(() => {
    const byId = new Map<string, (typeof adAccounts)[number]>();
    const byName = new Map<string, (typeof adAccounts)[number]>();

    for (const account of adAccounts) {
      if (account.status !== 'active') continue;
      if (!shouldShowAdAccountInCsView(account)) continue;
      byId.set(account.id, account);
      byName.set(normalizeLookupKey(account.accountName), account);
    }

    return { byId, byName };
  }, [adAccounts, shouldShowAdAccountInCsView]);

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
      setApiAdsMetrics({});
      setApiAdsByDateAccount({});
      setApiAdsStatus('idle');
      return;
    }

    let cancelled = false;
    const forceRefresh = apiRefreshNonce !== lastApiRefreshNonceRef.current;
    if (forceRefresh) {
      lastApiRefreshNonceRef.current = apiRefreshNonce;
    }
    const cacheKey = buildApiCacheKey(rangeParams);
    const cachedSnapshot = !forceRefresh && cacheKey ? csViewApiCache.get(cacheKey) : null;

    if (cachedSnapshot) {
      setApiAdsMetrics(cachedSnapshot.metrics);
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
      resultByDate: Record<string, CsAdsDailyMetric>,
      resultByDateAccount: Record<string, CsAdsAccountMetric>,
      rows: AdsSnapshotRowLike[],
    ) => {
      for (const row of rows) {
        const date = row.snapshotDate;
        if (!date) continue;
        if (date < rangeParams.from || date > rangeParams.to) continue;

        const adAccount = resolveAdAccount(row);
        if (!adAccount) continue;

        const assignment = adAccountCsLookup.resolveAssignment(adAccount.id, date);

        const spend = Number(row.spend) || 0;
        const conversions = Number(row.conversions) || 0;
        const current = resultByDate[date] || {
          date,
          spend: 0,
          leads: 0,
          source: 'api' as const,
        };
        current.spend += spend;
        current.leads += conversions;
        resultByDate[date] = current;

        const accountKey = `${date}::${adAccount?.id || row.externalAccountId || row.externalAccountName || row.id || 'unmapped-api-account'}`;
        const platformName = platforms.find((platform) => platform.id === (row.platformId || adAccount?.platformId))?.name;
        const currentAccount = resultByDateAccount[accountKey] || {
          date,
          adAccountId: adAccount.id,
          advertiserId: row.advertiserId || adAccount?.advertiserId || null,
          csId: assignment?.csId || null,
          subChannelId: assignment?.subChannelId || null,
          platformId: row.platformId || adAccount?.platformId || null,
          platformKey: row.platformKey || resolvePlatformKey(platformName),
          accountName: adAccount?.accountName || row.externalAccountName || 'Akun API belum dipetakan',
          ppn: adAccount?.ppn || 0,
          fee: adAccount?.fee || 0,
          spend: 0,
          leads: 0,
          source: 'api' as const,
        };
        currentAccount.spend += spend;
        currentAccount.leads += conversions;
        resultByDateAccount[accountKey] = currentAccount;
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

        const next: Record<string, CsAdsDailyMetric> = {};
        const nextByAccount: Record<string, CsAdsAccountMetric> = {};

        if (meta.status === 'fulfilled') addSnapshotRows(next, nextByAccount, meta.value.rows || []);
        if (google.status === 'fulfilled') addSnapshotRows(next, nextByAccount, google.value.rows || []);
        if (tiktok.status === 'fulfilled') addSnapshotRows(next, nextByAccount, tiktok.value.rows || []);

        if (cancelled) return;

        const hasUsefulApiMetrics = Object.values(next).some((row) => row.spend > 0 || row.leads > 0);
        const hasUsefulApiAccountMetrics = Object.values(nextByAccount).some(
          (row) => row.spend > 0 || row.leads > 0,
        );

        setApiAdsMetrics(next);
        setApiAdsByDateAccount(nextByAccount);
        const nextStatus: ApiAdsStatus = hasUsefulApiMetrics || hasUsefulApiAccountMetrics ? 'ready' : 'empty';
        setApiAdsStatus(nextStatus);
        if (cacheKey) {
          csViewApiCache.set(cacheKey, {
            metrics: next,
            byDateAccount: nextByAccount,
            status: nextStatus,
          });
        }
      } catch {
        if (cancelled) return;
        setApiAdsMetrics({});
        setApiAdsByDateAccount({});
        setApiAdsStatus('error');
      }
    };

    loadApiAdsMetrics();

    return () => {
      cancelled = true;
    };
  }, [adAccountCsLookup, adAccountLookup, apiRefreshNonce, platforms, rangeParams]);

  // Filter Logic
  const filteredData = useMemo(() => {
    if (!dateRange?.from) return { orders: [], leads: [] };

    const from = dateRange.from;
    const to = dateRange.to || dateRange.from; // Handle single day selection

    const filteredOrders = orders.filter(o => {
        // If targetId is defined, filter by it. If undefined (Owner view all), show all.
        if (targetId && o.csId !== targetId) return false;
        if (targetPlatformId && o.platformId !== targetPlatformId) return false;
        
        // Use leadDate or serviceDate or createdAt logic? Usually leadDate for sales performance
        const dateStr = o.leadDate || o.serviceDate || ''; 
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d >= from && d <= to;
    });

    const filteredLeads = leads.filter(l => {
        // If targetId is defined, filter by it. If undefined (Owner view all), show all.
        if (targetId && l.csId !== targetId) return false;
        if (targetPlatformId && l.platformId !== targetPlatformId) return false;

        const d = new Date(l.timestamp);
        return d >= from && d <= to;
    });

    return { orders: filteredOrders, leads: filteredLeads };
  }, [orders, leads, targetId, targetPlatformId, dateRange]);

  const spamScopeInputs = useMemo(() => {
    if (!rangeParams) return [];

    return leadSpamDailyInputs.filter((item) => {
      if (!item.inputDate || item.inputDate < rangeParams.from || item.inputDate > rangeParams.to) return false;
      if (targetId && item.csId !== targetId) return false;
      if (targetPlatformId && item.platformId !== targetPlatformId) return false;
      return true;
    });
  }, [leadSpamDailyInputs, rangeParams, targetId, targetPlatformId]);

  const spamInputRows = useMemo(() => {
    const userNameById = new Map(users.map((user) => [user.id, user.name]));
    const platformNameById = new Map(platforms.map((platform) => [platform.id, platform.name]));

    return spamScopeInputs
      .map((item) => ({
        ...item,
        csName: userNameById.get(item.csId) || 'CS tidak ditemukan',
        platformName: platformNameById.get(item.platformId) || 'Platform tidak ditemukan',
        advertiserName: userNameById.get(item.advertiserId) || 'Advertiser tidak ditemukan',
      }))
      .sort((left, right) => {
        const dateCompare = right.inputDate.localeCompare(left.inputDate);
        if (dateCompare !== 0) return dateCompare;
        const csCompare = left.csName.localeCompare(right.csName, 'id-ID');
        if (csCompare !== 0) return csCompare;
        return left.advertiserName.localeCompare(right.advertiserName, 'id-ID');
      });
  }, [platforms, spamScopeInputs, users]);

  const spamByDate = useMemo(() => {
    const grouped: Record<string, number> = {};

    for (const item of spamScopeInputs) {
      grouped[item.inputDate] = (grouped[item.inputDate] || 0) + (Number(item.spamCount) || 0);
    }

    return grouped;
  }, [spamScopeInputs]);

  const { orders: myOrders, leads: myLeads } = filteredData;

  // Generate Daily Stats for Table & Chart
  const dailyStats = useMemo(() => {
      if (!dateRange?.from) return [];
      
      const from = dateRange.from;
      const to = dateRange.to || dateRange.from;
      
      // Limit range to prevent crashing if user selects "All Time" with huge range
      // But for "All Time", we might just want to show actual data points instead of filling gaps?
      // For now, assume reasonable range or specific filling behavior.
      // If range > 365 days, maybe group by month? The requirement asked for "1-31" table.
      
      const days = eachDayOfInterval({ start: from, end: to });
      
      return days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          
          // Orders on this day (based on leadDate for consistency with sales funnel)
          const dayOrders = myOrders.filter(o => (o.leadDate || '').startsWith(dateStr));
          // Leads on this day
          const dayLeads = myLeads.filter(l => l.timestamp.startsWith(dateStr));
          const apiMetric = apiAdsMetrics[dateStr];
          const adsMetric = apiMetric && (apiMetric.spend > 0 || apiMetric.leads > 0) ? apiMetric : undefined;
          const adsSpend = adsMetric?.spend || 0;
          const adsLeads = adsMetric?.leads || 0;

          return {
              date: day,
              dateLabel: format(day, 'd MMM yyyy', { locale: id }),
              dayNum: format(day, 'd'),
              adsSpend,
              adsLeads,
              adsCpl: adsLeads > 0 ? adsSpend / adsLeads : 0,
              leads: dayLeads.length,
              orders: dayOrders.length,
              pending: dayOrders.filter(o => o.status === 'pending').length,
              process: dayOrders.filter(o => ['processing', 'otw', 'working', 'qc'].includes(o.status)).length,
              done: dayOrders.filter(o => o.status === 'done').length,
              cancel: dayOrders.filter(o => o.status === 'cancelled').length,
              revenue: dayOrders.filter(o => o.status === 'done').reduce((acc, curr) => acc + (curr.price || 0), 0)
          };
      });
  }, [apiAdsMetrics, dateRange, myOrders, myLeads]);

  const chartData = dailyStats.map(stat => ({
      name: format(stat.date, 'd/M'),
      date: stat.date,
      Leads: stat.leads,
      Orders: stat.orders
  }));

  const detailRows = useMemo(() => {
    if (!rangeParams) return [];

    const userName = new Map(users.map((user) => [user.id, user.name]));
    const platformName = new Map(platforms.map((platform) => [platform.id, platform.name]));
    const subChannelName = new Map(subChannels.map((subChannel) => [subChannel.id, subChannel.name]));
    const activeAdAccounts = adAccounts.filter(
      (account) =>
        account.status === 'active' &&
        (!targetPlatformId || account.platformId === targetPlatformId) &&
        shouldShowAdAccountInCsView(account),
    );
    const activeAdAccountById = new Map(activeAdAccounts.map((account) => [account.id, account]));

    type DetailRow = {
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
      cprClosing: number;
      cprClosingTotal: number;
      costPerDone: number;
      costPerDoneTotal: number;
      roas: number;
      roasTotal: number;
      cpl: number;
      cplTotal: number;
      source: 'api' | 'connected' | 'operational';
    };

    type AssignedAccountGroup = {
      date: string;
      account: (typeof activeAdAccounts)[number];
      assignment: ReturnType<typeof adAccountCsLookup.resolveAssignment>;
      apiMetrics: CsAdsAccountMetric[];
      leads: typeof leads;
      orders: typeof orders;
    };

    const groups = new Map<string, AssignedAccountGroup>();
    const getDateRange = () => eachDayOfInterval({
      start: parseISO(`${rangeParams.from}T00:00:00`),
      end: parseISO(`${rangeParams.to}T00:00:00`),
    }).map((date) => format(date, 'yyyy-MM-dd'));
    const dates = getDateRange();

    const getGroup = (date: string, account: (typeof activeAdAccounts)[number]) => {
      const assignment = adAccountCsLookup.resolveAssignment(account.id, date);
      if (targetId && assignment?.csId !== targetId) return null;

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

    for (const metric of Object.values(apiAdsByDateAccount)) {
      if (metric.date < rangeParams.from || metric.date > rangeParams.to) continue;
      if (!metric.adAccountId) continue;
      const account = activeAdAccountById.get(metric.adAccountId);
      if (!account) continue;
      const group = getGroup(metric.date, account);
      if (!group) continue;
      group.apiMetrics.push(metric);
    }

    const candidatesByScope = new Map<string, AssignedAccountGroup[]>();
    const getScopeKey = (date: string, advertiserId?: string | null, platformId?: string | null, csId?: string | null) =>
      `${date}::${advertiserId || 'none'}::${platformId || 'none'}::${csId || 'none'}`;
    const spamByScope = new Map<string, number>();
    for (const item of spamScopeInputs) {
      const key = getScopeKey(item.inputDate, item.advertiserId, item.platformId, item.csId);
      spamByScope.set(key, (spamByScope.get(key) || 0) + (Number(item.spamCount) || 0));
    }

    for (const date of dates) {
      for (const account of activeAdAccounts) {
        const group = getGroup(date, account);
        if (!group) continue;
        const key = getScopeKey(date, account.advertiserId, account.platformId, group.assignment?.csId);
        const current = candidatesByScope.get(key) || [];
        current.push(group);
        candidatesByScope.set(key, current);
      }
    }

    const selectBestGroup = (
      candidates: AssignedAccountGroup[] | undefined,
      subChannelId?: string | null,
    ) => {
      if (!candidates?.length) return null;

      const isGoogleScope = candidates.some(
        (group) => resolvePlatformKey(platformName.get(group.account.platformId || '')) === 'google',
      );

      if (isGoogleScope) {
        const sortedByApiActivity = [...candidates].sort((left, right) => {
          const leftScore = left.apiMetrics.reduce(
            (sum, metric) => sum + (metric.spend || 0) + (metric.leads || 0),
            0,
          );
          const rightScore = right.apiMetrics.reduce(
            (sum, metric) => sum + (metric.spend || 0) + (metric.leads || 0),
            0,
          );

          if (rightScore !== leftScore) return rightScore - leftScore;
          return left.account.accountName.localeCompare(right.account.accountName, 'id-ID');
        });
        const candidatesWithApiActivity = sortedByApiActivity.filter((group) =>
          group.apiMetrics.some((metric) => (metric.spend || 0) > 0 || (metric.leads || 0) > 0),
        );
        const preferredCandidates = candidatesWithApiActivity.length > 0
          ? candidatesWithApiActivity
          : sortedByApiActivity;

        const exactSubChannel = subChannelId
          ? preferredCandidates.find((group) => group.assignment?.subChannelId === subChannelId)
          : null;
        if (exactSubChannel) return exactSubChannel;

        const defaultSubChannel = preferredCandidates.find((group) => !group.assignment?.subChannelId);
        return defaultSubChannel || preferredCandidates[0];
      }

      const exactSubChannel = subChannelId
        ? candidates.find((group) => group.assignment?.subChannelId === subChannelId)
        : null;
      if (exactSubChannel) return exactSubChannel;

      const defaultSubChannel = candidates.find((group) => !group.assignment?.subChannelId);
      return defaultSubChannel || candidates[0];
    };

    const getLeadDate = (lead: (typeof leads)[number]) => lead.timestamp?.slice(0, 10) || '';
    const getOrderLeadDate = (order: (typeof orders)[number]) => (order.leadDate || order.created_at || '').slice(0, 10);

    for (const order of orders) {
      const date = getOrderLeadDate(order);
      if (!date || date < rangeParams.from || date > rangeParams.to) continue;
      if (targetId && order.csId !== targetId) continue;
      if (targetPlatformId && order.platformId !== targetPlatformId) continue;

      const candidates = candidatesByScope.get(getScopeKey(date, order.advertiserId, order.platformId, order.csId));
      const group = selectBestGroup(candidates, order.subChannelId);
      if (!group) continue;
      group.orders.push(order);
    }

    for (const lead of leads) {
      const date = getLeadDate(lead);
      if (!date || date < rangeParams.from || date > rangeParams.to) continue;
      if (targetId && lead.csId !== targetId) continue;
      if (targetPlatformId && lead.platformId !== targetPlatformId) continue;

      const candidates = candidatesByScope.get(getScopeKey(date, lead.advertiserId, lead.platformId, lead.csId));
      const group = selectBestGroup(candidates, lead.subChannelId);
      if (!group) continue;
      group.leads.push(lead);
    }

    const getGroupActivityScore = (group: AssignedAccountGroup) =>
      group.apiMetrics.reduce((sum, metric) => sum + metric.spend + metric.leads, 0) +
      group.leads.length +
      group.orders.length;
    const getGroupSource = (group: AssignedAccountGroup): DetailRow['source'] => {
      const hasApiActivity = group.apiMetrics.some(
        (metric) => (metric.spend || 0) > 0 || (metric.leads || 0) > 0,
      );
      if (hasApiActivity) return 'api';
      if (group.apiMetrics.length > 0 || isConnectedAdAccount(group.account)) return 'connected';

      return 'operational';
    };
    const shouldAttachScopeSpam = (group: AssignedAccountGroup) => {
      const scopeKey = getScopeKey(
        group.date,
        group.account.advertiserId,
        group.account.platformId,
        group.assignment?.csId,
      );
      const candidates = candidatesByScope.get(scopeKey);
      if (!candidates?.length) return false;

      const selected = [...candidates].sort((left, right) => {
        const scoreDelta = getGroupActivityScore(right) - getGroupActivityScore(left);
        if (scoreDelta !== 0) return scoreDelta;
        return left.account.accountName.localeCompare(right.account.accountName, 'id-ID');
      })[0];

      return selected.account.id === group.account.id;
    };

    const rows: DetailRow[] = [];
    for (const group of groups.values()) {
      const spendDashboard = group.apiMetrics.reduce((sum, metric) => sum + metric.spend, 0);
      const spendTotal = group.apiMetrics.reduce(
        (sum, metric) => sum + metric.spend * (1 + ((metric.ppn || 0) + (metric.fee || 0)) / 100),
        0,
      );
      const completedOrders = group.orders.filter((order) => order.status === 'done');
      const revenue = completedOrders.reduce((sum, order) => sum + (order.income || order.price || 0), 0);
      const orderCount = group.orders.length;
      const doneCount = completedOrders.length;
      const apiLeads = group.apiMetrics.reduce((sum, metric) => sum + metric.leads, 0);
      const leadsDashboard = apiLeads;
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
        advertiserName: userName.get(group.account.advertiserId || '') || 'Advertiser belum terdaftar',
        csName: group.assignment?.csId
          ? userName.get(group.assignment.csId) || 'CS belum terdaftar'
          : 'CS belum diatur',
        platformKey: group.apiMetrics[0]?.platformKey || resolvePlatformKey(platformName.get(group.account.platformId || '')),
        platformName: platformName.get(group.account.platformId || '') || 'Platform belum terdaftar',
        subChannelName: group.assignment?.subChannelId
          ? subChannelName.get(group.assignment.subChannelId) || 'Subchannel belum terdaftar'
          : '',
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
        cprClosing: orderCount > 0 ? spendDashboard / orderCount : 0,
        cprClosingTotal: orderCount > 0 ? spendTotal / orderCount : 0,
        costPerDone: doneCount > 0 ? spendDashboard / doneCount : 0,
        costPerDoneTotal: doneCount > 0 ? spendTotal / doneCount : 0,
        roas: spendDashboard > 0 ? revenue / spendDashboard : 0,
        roasTotal: spendTotal > 0 ? revenue / spendTotal : 0,
        cpl: leadsDashboard > 0 ? spendDashboard / leadsDashboard : 0,
        cplTotal: leadsDashboard > 0 ? spendTotal / leadsDashboard : 0,
        source: getGroupSource(group),
      });
    }

    return rows.sort((left, right) => {
      if (right.date !== left.date) return right.date.localeCompare(left.date);
      const leftUnassigned = left.csName === 'CS belum diatur';
      const rightUnassigned = right.csName === 'CS belum diatur';
      if (leftUnassigned !== rightUnassigned) return leftUnassigned ? 1 : -1;
      if (left.csName !== right.csName) return left.csName.localeCompare(right.csName);
      return right.spendTotal - left.spendTotal;
    });
  }, [
    apiAdsByDateAccount,
    adAccountCsLookup,
    adAccounts,
    isConnectedAdAccount,
    leads,
    orders,
    platforms,
    rangeParams,
    shouldShowAdAccountInCsView,
    spamScopeInputs,
    subChannels,
    targetId,
    targetPlatformId,
    users,
  ]);

  const csKpis = useMemo(() => {
    const activeAccountIds = new Set<string>();
    const mappedAccountIds = new Set<string>();
    let prospects = 0;
    let orders = 0;
    let activeOrders = 0;
    let done = 0;
    let cancelled = 0;
    let spendDashboard = 0;
    let spendTotal = 0;
    let leadsDashboard = 0;
    let revenue = 0;
    const spamCount = spamScopeInputs.reduce((sum, item) => sum + (Number(item.spamCount) || 0), 0);

    for (const row of detailRows) {
      activeAccountIds.add(row.accountId);
      if (row.csName !== 'CS belum diatur') {
        mappedAccountIds.add(row.accountId);
      }

      prospects += row.leadsReal;
      orders += row.orders;
      activeOrders += Math.max(0, row.orders - row.done - row.cancelled);
      done += row.done;
      cancelled += row.cancelled;
      spendDashboard += row.spendDashboard;
      spendTotal += row.spendTotal;
      leadsDashboard += row.leadsDash;
      revenue += row.revenue;
    }

    return {
      accountCount: activeAccountIds.size,
      mappedAccountCount: mappedAccountIds.size,
      prospects,
      orders,
      activeOrders,
      done,
      cancelled,
      spendDashboard,
      spendTotal,
      leadsDashboard,
      revenue,
      spamCount,
      spamRate: leadsDashboard > 0 ? (spamCount / leadsDashboard) * 100 : 0,
      conversionRate: leadsDashboard > 0 ? (orders / leadsDashboard) * 100 : 0,
      cprDashboard: leadsDashboard > 0 ? spendDashboard / leadsDashboard : 0,
      cprDashboardTotal: leadsDashboard > 0 ? spendTotal / leadsDashboard : 0,
      costPerClosing: orders > 0 ? spendDashboard / orders : 0,
      costPerClosingTotal: orders > 0 ? spendTotal / orders : 0,
      costPerDone: done > 0 ? spendDashboard / done : 0,
      costPerDoneTotal: done > 0 ? spendTotal / done : 0,
      roas: spendDashboard > 0 ? revenue / spendDashboard : 0,
      roasTotal: spendTotal > 0 ? revenue / spendTotal : 0,
    };
  }, [detailRows, spamScopeInputs]);
  const isApiLoading = apiAdsStatus === 'loading';
  const hasVisibleApiData = useMemo(
    () => detailRows.some((row) => row.spendDashboard > 0 || row.leadsDash > 0),
    [detailRows],
  );
  const isApiScopeMismatch = apiAdsStatus === 'ready' && detailRows.length > 0 && !hasVisibleApiData;
  const resolvedApiStatusClassName = isApiScopeMismatch
    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
    : apiStatusClassName(apiAdsStatus);
  const resolvedApiStatusLabel = isApiScopeMismatch
    ? 'Unconnect'
    : getApiStatusLabel(apiAdsStatus);
  const dateGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        date: string;
        rows: typeof detailRows;
        spendDashboard: number;
        spendTotal: number;
        leadsDash: number;
        leadsReal: number;
        orders: number;
        scheduled: number;
        done: number;
        cancelled: number;
        revenue: number;
        spam: number;
        spamRate: number;
        closingRate: number;
        cpl: number;
        cplTotal: number;
        cprClosing: number;
        cprClosingTotal: number;
        costPerDone: number;
        costPerDoneTotal: number;
        roas: number;
        roasTotal: number;
      }
    >();

    const ensureGroup = (date: string) => {
      const current = groups.get(date) || {
        date,
        rows: [],
        spendDashboard: 0,
        spendTotal: 0,
        leadsDash: 0,
        leadsReal: 0,
        orders: 0,
        scheduled: 0,
        done: 0,
        cancelled: 0,
        revenue: 0,
        spam: spamByDate[date] || 0,
        spamRate: 0,
        closingRate: 0,
        cpl: 0,
        cplTotal: 0,
        cprClosing: 0,
        cprClosingTotal: 0,
        costPerDone: 0,
        costPerDoneTotal: 0,
        roas: 0,
        roasTotal: 0,
      };
      groups.set(date, current);
      return current;
    };

    Object.keys(spamByDate).forEach((date) => {
      ensureGroup(date);
    });

    for (const row of detailRows) {
      const current = ensureGroup(row.date);

      current.rows.push(row);
      current.spendDashboard += row.spendDashboard;
      current.spendTotal += row.spendTotal;
      current.leadsDash += row.leadsDash;
      current.leadsReal += row.leadsReal;
      current.orders += row.orders;
      current.scheduled += row.scheduled;
      current.done += row.done;
      current.cancelled += row.cancelled;
      current.revenue += row.revenue;
      current.spam = spamByDate[row.date] || current.spam || 0;
      current.spamRate = current.leadsDash > 0 ? (current.spam / current.leadsDash) * 100 : 0;
      current.closingRate = current.leadsDash > 0 ? (current.orders / current.leadsDash) * 100 : 0;
      current.cpl = current.leadsDash > 0 ? current.spendDashboard / current.leadsDash : 0;
      current.cplTotal = current.leadsDash > 0 ? current.spendTotal / current.leadsDash : 0;
      current.cprClosing = current.orders > 0 ? current.spendDashboard / current.orders : 0;
      current.cprClosingTotal = current.orders > 0 ? current.spendTotal / current.orders : 0;
      current.costPerDone = current.done > 0 ? current.spendDashboard / current.done : 0;
      current.costPerDoneTotal = current.done > 0 ? current.spendTotal / current.done : 0;
      current.roas = current.spendDashboard > 0 ? current.revenue / current.spendDashboard : 0;
      current.roasTotal = current.spendTotal > 0 ? current.revenue / current.spendTotal : 0;
      groups.set(row.date, current);
    }

    for (const current of groups.values()) {
      current.spam = spamByDate[current.date] || current.spam || 0;
      current.spamRate = current.leadsDash > 0 ? (current.spam / current.leadsDash) * 100 : 0;
    }

    return Array.from(groups.values()).sort((left, right) => left.date.localeCompare(right.date));
  }, [detailRows, spamByDate]);
  const totalPages = Math.max(1, Math.ceil(dateGroups.length / itemsPerPage));
  const paginatedDateGroups = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return dateGroups.slice(start, start + itemsPerPage);
  }, [currentPage, dateGroups, itemsPerPage]);
  const selectedCsLabel = targetId
    ? users.find((user) => user.id === targetId)?.name || 'CS terpilih'
    : 'Semua CS';
  const selectedPlatformLabel = targetPlatformId
    ? platformFilterOptions.find((platform) => platform.id === targetPlatformId)?.name || 'Platform terpilih'
    : 'Semua Platform';

  React.useEffect(() => {
    setCurrentPage(1);
  }, [rangeParams?.from, rangeParams?.to, targetId, targetPlatformId, itemsPerPage]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleSaveSpamInput = React.useCallback(async () => {
    if (!spamForm.inputDate || !spamForm.csId || !spamForm.platformId || !spamForm.advertiserId) {
      toast.error('Tanggal, CS, platform, dan advertiser wajib dipilih.');
      return;
    }

    const spamCount = Number.parseInt(spamForm.spamCount, 10);
    if (!Number.isFinite(spamCount) || spamCount < 0) {
      toast.error('Jumlah spam harus berupa angka 0 atau lebih.');
      return;
    }

    setIsSavingSpamInput(true);
    try {
      if (spamCount === 0) {
        if (spamForm.id) {
          await deleteLeadSpamDailyInput(spamForm.id);
          setIsSpamDialogOpen(false);
          setSpamForm(buildInitialSpamFormState());
          return;
        }

        toast.error('Jumlah spam harus diisi lebih dari 0 untuk membuat data baru.');
        return;
      }

      const payload = {
        id: spamForm.id || crypto.randomUUID(),
        inputDate: spamForm.inputDate,
        csId: spamForm.csId,
        platformId: spamForm.platformId,
        advertiserId: spamForm.advertiserId,
        spamCount,
        notes: spamForm.notes.trim() || undefined,
        createdBy: spamForm.id ? undefined : currentUser?.id,
        updatedBy: currentUser?.id || undefined,
      };

      if (spamForm.id) {
        await updateLeadSpamDailyInput(payload);
      } else {
        await addLeadSpamDailyInput(payload);
      }

      setIsSpamDialogOpen(false);
      setSpamForm(buildInitialSpamFormState());
    } catch (error) {
      console.error('Failed to save lead spam daily input:', error);
    } finally {
      setIsSavingSpamInput(false);
    }
  }, [
    addLeadSpamDailyInput,
    buildInitialSpamFormState,
    currentUser?.id,
    deleteLeadSpamDailyInput,
    spamForm.advertiserId,
    spamForm.csId,
    spamForm.id,
    spamForm.inputDate,
    spamForm.notes,
    spamForm.platformId,
    spamForm.spamCount,
    updateLeadSpamDailyInput,
  ]);

  const handleDeleteSpamInput = React.useCallback(async () => {
    if (!spamInputToDelete) return;

    try {
      await deleteLeadSpamDailyInput(spamInputToDelete);
      setSpamInputToDelete(null);
    } catch {
      // Error toast is handled by context mutation helpers.
    }
  }, [deleteLeadSpamDailyInput, spamInputToDelete]);

  return (
    <OperationalPageShell>
      <OperationalPageHeader
        title="CS View"
        subtitle={`Ringkasan performa ${selectedCsLabel} pada ${selectedPlatformLabel} berdasarkan tanggal lead dashboard dan spend iklan.`}
        eyebrow="Dashboard"
        icon={Users}
      />

      <OperationalFilterPanel>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,240px)_minmax(180px,240px)_minmax(260px,360px)]">
            {isOwner && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">CS</div>
                <Select value={selectedCsId} onValueChange={setSelectedCsId}>
                  <SelectTrigger className="h-10 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <SelectValue placeholder="Pilih CS" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                    <SelectItem value="all">Semua CS</SelectItem>
                    {users
                      .filter(u => isCsRole(u.role) && u.status === 'active')
                      .map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Platform</div>
              <Select value={selectedPlatformId} onValueChange={setSelectedPlatformId}>
                <SelectTrigger className="h-10 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <SelectValue placeholder="Pilih platform" />
                </SelectTrigger>
                <SelectContent className="border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                  <SelectItem value="all">Semua Platform</SelectItem>
                  {platformFilterOptions.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>{platform.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Periode</div>
              <SmartFilterDate date={dateRange} setDate={handleDateRangeChange} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            {canManageSpamInputs && (
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-2 border-slate-200 bg-white shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                onClick={() => openSpamInputDialog()}
              >
                <Plus className="h-4 w-4" />
                Input Spam
              </Button>
            )}
            <Button
              type="button"
              className="h-10 gap-2 bg-blue-600 text-white shadow-sm hover:bg-blue-700"
              disabled={!rangeParams || apiAdsStatus === 'loading'}
              onClick={() => setApiRefreshNonce((value) => value + 1)}
            >
              <RefreshCw className={`h-4 w-4 ${apiAdsStatus === 'loading' ? 'animate-spin' : ''}`} />
              Muat Ulang API
            </Button>
          </div>
        </div>
      </OperationalFilterPanel>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as CsViewTab)} className="space-y-4">
        <TabsList className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <TabsTrigger value="performance" className="px-4">Performa</TabsTrigger>
          <TabsTrigger value="spam-inputs" className="px-4">Input Spam</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Periode</div>
          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {rangeParams
              ? `${format(parseISO(`${rangeParams.from}T00:00:00`), 'dd MMM yyyy', { locale: id })} - ${format(parseISO(`${rangeParams.to}T00:00:00`), 'dd MMM yyyy', { locale: id })}`
              : 'Belum dipilih'}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Akun Iklan Terpetakan</div>
          <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {formatCount(csKpis.mappedAccountCount)} dari {formatCount(csKpis.accountCount)} akun aktif
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Status Data</div>
          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium ${resolvedApiStatusClassName}`}>
              {apiAdsStatus === 'loading' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {resolvedApiStatusLabel}
            </span>
          </div>
        </div>
      </div>

      <OperationalKpiGrid>
        <OperationalKpiCard
          label="Spending"
          value={
            <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
              <span className="text-2xl font-semibold text-slate-950 dark:text-slate-100">{formatShortCurrency(csKpis.spendDashboard)}</span>
              <span>{formatShortCurrency(csKpis.spendTotal)}</span>
            </div>
          }
          icon={TrendingUp}
          tone="blue"
        />
        <OperationalKpiCard
          label="Lead Dashboard"
          value={
            <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
              <span className="text-2xl font-semibold text-slate-950 dark:text-slate-100">{formatCount(csKpis.leadsDashboard)}</span>
              <span>Prospek {formatCount(csKpis.prospects)}</span>
            </div>
          }
          icon={Users}
          tone="violet"
        />
        <OperationalKpiCard
          label="Spam"
          value={
            <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
              <span className="text-2xl font-semibold text-rose-600 dark:text-rose-300">{formatCount(csKpis.spamCount)}</span>
            </div>
          }
          icon={AlertTriangle}
          tone="rose"
        />
        <OperationalKpiCard
          label="Spam Rate"
          value={
            <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
              <span className="text-2xl font-semibold text-amber-500 dark:text-amber-300">{formatPercentAllowZero(csKpis.spamRate)}</span>
            </div>
          }
          icon={TrendingUp}
          tone="amber"
        />
        <OperationalKpiCard
          label="Cost/Lead"
          value={
            <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
              <span className={`text-2xl font-semibold ${getCostPerLeadTextClass(csKpis.cprDashboard)}`}>{formatShortCurrency(csKpis.cprDashboard)}</span>
              <span>{formatShortCurrency(csKpis.cprDashboardTotal)}</span>
            </div>
          }
          icon={CheckCircle}
          tone="emerald"
        />
        <OperationalKpiCard
          label="Closing"
          value={
            <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
              <span className="text-2xl font-semibold text-slate-950 dark:text-slate-100">{formatCount(csKpis.orders)}</span>
              <span className="text-emerald-600 dark:text-emerald-300">Selesai: {formatCount(csKpis.done)}</span>
            </div>
          }
          icon={ShoppingCart}
          tone="violet"
        />
        <OperationalKpiCard
          label="Cost/Closing"
          value={
            <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
              <span className="text-2xl font-semibold text-slate-950 dark:text-slate-100">{formatShortCurrency(csKpis.costPerClosing)}</span>
              <span>{formatShortCurrency(csKpis.costPerClosingTotal)}</span>
            </div>
          }
          icon={ShoppingCart}
          tone="amber"
        />
        <OperationalKpiCard
          label="Cost/Selesai"
          value={
            <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
              <span className="text-2xl font-semibold text-slate-950 dark:text-slate-100">{formatShortCurrency(csKpis.costPerDone)}</span>
              <span>{formatShortCurrency(csKpis.costPerDoneTotal)}</span>
            </div>
          }
          icon={CheckCircle}
          tone="emerald"
        />
        <OperationalKpiCard
          label="ROAS"
          value={
            <div className="flex flex-col gap-1 text-sm font-normal text-slate-500 dark:text-slate-400">
              <span className="text-2xl font-semibold text-slate-950 dark:text-slate-100">{csKpis.roas > 0 ? `${csKpis.roas.toFixed(2)}x` : '-'}</span>
            </div>
          }
          icon={TrendingUp}
          tone="amber"
        />
      </OperationalKpiGrid>

      <div className="grid gap-4 md:grid-cols-1">
        {/* Chart */}
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base text-slate-800 dark:text-slate-100">Grafik Lead Dashboard dan Order</CardTitle>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tren harian berdasarkan tanggal lead dashboard.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="hidden w-fit border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:inline-flex">
                  {chartData.length} hari
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  onClick={() => setIsChartOpen((value) => !value)}
                  aria-label={isChartOpen ? 'Tutup grafik' : 'Buka grafik'}
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${isChartOpen ? '' : '-rotate-90'}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          {isChartOpen && (
          <CardContent className="px-4 pt-5">
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="csLeadsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="csOrdersGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => format(value, 'd/M')}
                      stroke="#64748b"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 12px 24px -16px rgb(15 23 42 / 0.35)' }}
                        labelFormatter={(value) => format(value as Date, 'dd MMMM yyyy', { locale: id })}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="Leads"
                      name="Lead Dashboard"
                      stroke="#06b6d4"
                      fill="url(#csLeadsGradient)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#06b6d4', strokeWidth: 1, stroke: '#fff' }}
                      activeDot={{ r: 5 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Orders"
                      name="Orders"
                      stroke="#2563eb"
                      fill="url(#csOrdersGradient)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#2563eb', strokeWidth: 1, stroke: '#fff' }}
                      activeDot={{ r: 5 }}
                    />
                </ComposedChart>
                </ResponsiveContainer>
            </div>
          </CardContent>
          )}
        </Card>

        <OperationalTableCard>
          <CardHeader className="border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base text-slate-800 dark:text-slate-100">Performa CS dan Iklan</CardTitle>
                <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
                  Monitoring performa Customer Service dari akun iklan aktif, termasuk data iklan harian yang belum terhubung ke CS.
                </p>
                {isApiScopeMismatch && (
                  <p className="mt-2 max-w-3xl text-xs text-amber-700 dark:text-amber-200">
                    Snapshot API ada pada periode ini, tetapi tidak ada yang cocok dengan filter CS/platform atau mapping akun iklan aktif. Cek assignment CS dan integrasi akun iklan di Master Data.
                  </p>
                )}
              </div>
              <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-medium ${resolvedApiStatusClassName}`}>
                {apiAdsStatus === 'loading' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {resolvedApiStatusLabel}
              </span>
            </div>
          </CardHeader>
          <div className="space-y-3 p-3 sm:p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Rincian Performa
            </div>
                {isApiLoading && dateGroups.length === 0 ? (
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
                ) : dateGroups.length > 0 ? (
                  paginatedDateGroups.map((group) => {
                    const isExpanded = expandedDateGroups.includes(group.date);

                    return (
                    <div key={group.date} className="transition-colors">
                        <div className={`overflow-hidden rounded-lg border bg-white transition-colors dark:bg-slate-900 ${
                          isExpanded
                            ? 'border-blue-200 shadow-sm dark:border-blue-900/60'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}>
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            onClick={() => toggleDateGroup(group.date)}
                            className="w-full bg-white px-3 py-4 text-left transition-colors hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/70 sm:px-4 lg:p-0"
                          >
                            <div className="lg:hidden">
                              <div className="flex items-start gap-3">
                                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-colors ${
                                  isExpanded
                                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'
                                    : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                                }`}>
                                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                                </span>
                                <div className="min-w-0">
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Tanggal</div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-sm font-bold text-slate-950 dark:text-slate-100">
                                      {format(new Date(`${group.date}T00:00:00`), 'dd MMM yyyy', { locale: id })}
                                    </span>
                                    {group.date === format(new Date(), 'yyyy-MM-dd') && (
                                      <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                                        Today
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {format(new Date(`${group.date}T00:00:00`), 'EEEE', { locale: id })}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 grid grid-cols-2 gap-2">
                                <DailySummaryMetric
                                  label="Spend"
                                  primary={formatShortCurrency(group.spendDashboard)}
                                  secondary={formatShortCurrency(group.spendTotal)}
                                />
                                <DailySummaryMetric
                                  label="Lead Dashboard"
                                  primary={formatNumber(group.leadsDash)}
                                  secondary={`Prospek CRM: ${formatNumber(group.leadsReal)}`}
                                  tone="cyan"
                                />
                                <DailySummaryMetric
                                  label="Spam"
                                  primary={formatNumber(group.spam)}
                                  tone="red"
                                />
                                <DailySummaryMetric
                                  label="Spam Rate"
                                  primary={formatPercentAllowZero(group.spamRate)}
                                  tone="amber"
                                />
                                <DailySummaryMetric
                                  label="Order"
                                  primary={formatNumber(group.orders)}
                                  tone="blue"
                                />
                                <DailySummaryMetric
                                  label="Selesai"
                                  primary={formatNumber(group.done)}
                                  secondary={`Batal: ${formatNumber(group.cancelled)}`}
                                  tone="emerald"
                                />
                                <DailySummaryMetric
                                  label="Cost per Lead"
                                  primary={formatShortCurrency(group.cpl)}
                                  secondary={group.leadsDash > 0 ? formatShortCurrency(group.cplTotal) : undefined}
                                  tone={getCostPerLeadTone(group.cpl)}
                                />
                                <DailySummaryMetric
                                  label="Cost per Closing"
                                  primary={formatShortCurrency(group.cprClosing)}
                                  secondary={group.orders > 0 ? formatShortCurrency(group.cprClosingTotal) : undefined}
                                />
                                <DailySummaryMetric
                                  label="Revenue"
                                  primary={formatShortCurrency(group.revenue)}
                                />
                                <div className="rounded-md bg-slate-50 px-2.5 py-2 dark:bg-slate-800/60">
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">ROAS</div>
                                  <div className="mt-1 inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                    {group.roas > 0 ? `${group.roas.toFixed(2)}x` : '-'}
                                  </div>
                                  <div className="mt-1 font-mono text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                                    {group.roasTotal > 0 ? `${group.roasTotal.toFixed(2)}x` : '-'}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-2">
                                <DailyRateMetric value={group.closingRate} />
                              </div>
                            </div>

                            <div className="hidden min-h-[96px] grid-cols-[160px_118px_96px_72px_92px_54px_78px_102px_118px_130px_138px_82px] items-stretch divide-x divide-slate-100 px-2 py-3 dark:divide-slate-800 lg:grid">
                              <div className="flex h-full min-w-0 items-center gap-3 pr-3">
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-colors ${
                                  isExpanded
                                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'
                                    : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                                }`}>
                                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                                </span>
                                <div className="min-w-0">
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Tanggal</div>
                                  <div className="mt-1 truncate font-mono text-[14px] font-bold text-slate-950 dark:text-slate-100">
                                    {format(new Date(`${group.date}T00:00:00`), 'dd MMM yyyy', { locale: id })}
                                  </div>
                                  <div className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">
                                    {format(new Date(`${group.date}T00:00:00`), 'EEEE', { locale: id })}
                                  </div>
                                </div>
                              </div>
                              <DailySummaryTableCell
                                label="Spend"
                                primary={formatShortCurrency(group.spendDashboard)}
                                secondary={formatShortCurrency(group.spendTotal)}
                              />
                              <DailySummaryTableCell
                                label="Lead Dashboard"
                                primary={formatNumber(group.leadsDash)}
                                secondary={`Prospek CRM: ${formatNumber(group.leadsReal)}`}
                                tone="cyan"
                                align="center"
                              />
                              <DailySummaryTableCell
                                label="Spam"
                                primary={formatNumber(group.spam)}
                                tone="red"
                                align="center"
                              />
                              <DailySummaryTableCell
                                label="Spam Rate"
                                primary={formatPercentAllowZero(group.spamRate)}
                                tone="amber"
                                align="center"
                              />
                              <DailySummaryTableCell
                                label="Order"
                                primary={formatNumber(group.orders)}
                                tone="blue"
                                align="center"
                              />
                              <DailySummaryTableCell
                                label="Selesai"
                                primary={formatNumber(group.done)}
                                secondary={`Batal: ${formatNumber(group.cancelled)}`}
                                tone="emerald"
                                align="center"
                              />
                              <DailySummaryTableCell
                                label="Cost/Lead"
                                primary={formatShortCurrency(group.cpl)}
                                secondary={group.leadsDash > 0 ? formatShortCurrency(group.cplTotal) : undefined}
                                tone={getCostPerLeadTone(group.cpl)}
                              />
                              <DailySummaryTableCell
                                label="Cost/Closing"
                                primary={formatShortCurrency(group.cprClosing)}
                                secondary={group.orders > 0 ? formatShortCurrency(group.cprClosingTotal) : undefined}
                              />
                              <DailySummaryTableCell
                                label="Revenue"
                                primary={formatShortCurrency(group.revenue)}
                              />
                              <div className="flex h-full min-w-0 flex-col justify-start px-3 pt-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                    Konversi
                                  </div>
                                  <div className="font-mono text-[12px] font-bold text-slate-950 dark:text-slate-100">
                                    {formatPercent(group.closingRate)}
                                  </div>
                                </div>
                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-50 dark:bg-blue-950/30">
                                  <div
                                    className="h-full rounded-full bg-blue-500 transition-all"
                                    style={{ width: `${Math.max(0, Math.min(100, Number.isFinite(group.closingRate) ? group.closingRate : 0))}%` }}
                                  />
                                </div>
                                <div className="invisible mt-1 font-mono text-[10px] leading-tight">-</div>
                              </div>
                              <div className="flex h-full min-w-0 flex-col justify-start px-2 pt-1.5 text-right">
                                <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">ROAS</div>
                                <div className="mt-1 inline-flex self-end rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold leading-tight text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                  {group.roas > 0 ? `${group.roas.toFixed(2)}x` : '-'}
                                </div>
                                <div className="mt-1 truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                  {group.roasTotal > 0 ? `${group.roasTotal.toFixed(2)}x burn` : '-'}
                                </div>
                              </div>
                            </div>
                          </button>
                          <div className="hidden grid-cols-2 gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-800/60 md:grid-cols-4 xl:grid-cols-12">
                            <div>
                              <div className="text-slate-500">Tanggal</div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {format(new Date(`${group.date}T00:00:00`), 'dd MMM yyyy', { locale: id })}
                              </div>
                              <div className="mt-1 text-[11px] text-slate-500">
                                {format(new Date(`${group.date}T00:00:00`), 'EEEE', { locale: id })}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500">Spend</div>
                              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatShortCurrency(group.spendDashboard)}</div>
                              <div className="mt-1 font-mono text-[11px] text-slate-500">{formatShortCurrency(group.spendTotal)}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Lead Dashboard</div>
                              <div className="font-mono font-semibold text-cyan-600">{formatNumber(group.leadsDash)}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Prospek CRM</div>
                              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatNumber(group.leadsReal)}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Spam</div>
                              <div className="font-mono font-semibold text-red-600 dark:text-red-300">{formatNumber(group.spam)}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Spam Rate</div>
                              <div className="font-mono font-semibold text-amber-500 dark:text-amber-300">{formatPercentAllowZero(group.spamRate)}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Order</div>
                              <div className="font-mono font-semibold text-blue-600">{formatNumber(group.orders)}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Konversi</div>
                              <div className={`font-mono font-semibold ${getConversionRateTextClass(group.closingRate)}`}>{formatPercent(group.closingRate)}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Cost per Lead</div>
                              <div className={`font-mono font-semibold ${getCostPerLeadTextClass(group.cpl)}`}>{formatShortCurrency(group.cpl)}</div>
                              {group.leadsDash > 0 && (
                                <div className="mt-1 font-mono text-[11px] text-slate-500">
                                  {formatShortCurrency(group.cplTotal)}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-slate-500">Cost per Closing</div>
                              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatShortCurrency(group.cprClosing)}</div>
                              {group.orders > 0 && (
                                <div className="mt-1 font-mono text-[11px] text-slate-500">
                                  {formatShortCurrency(group.cprClosingTotal)}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-slate-500">Biaya/Selesai</div>
                              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatShortCurrency(group.costPerDone)}</div>
                              {group.done > 0 && (
                                <div className="mt-1 font-mono text-[11px] text-slate-500">
                                  {formatShortCurrency(group.costPerDoneTotal)}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-slate-500">Revenue</div>
                              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatShortCurrency(group.revenue)}</div>
                            </div>
                          </div>

                          {isExpanded && (
                          <>
                            <HorizontalDragScroll>
                            <table className="w-full min-w-[1980px] table-fixed text-xs">
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
                                <col className="w-[95px]" />
                                <col className="w-[85px]" />
                                <col className="w-[75px]" />
                                <col className="w-[130px]" />
                                <col className="w-[130px]" />
                                <col className="w-[85px]" />
                              </colgroup>
                              <thead className="bg-white text-slate-500 dark:bg-slate-900">
                                <tr
                                  className="hidden cursor-pointer border-b border-slate-100 bg-slate-50/80 text-xs normal-case shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition-colors hover:bg-slate-100/80 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                                  onClick={() => toggleDateGroup(group.date)}
                                >
                                  <SummaryCell
                                    align="left"
                                    label="Tanggal"
                                    primary={(
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          aria-label={isExpanded ? 'Tutup rincian tanggal' : 'Buka rincian tanggal'}
                                          aria-expanded={isExpanded}
                                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                            isExpanded
                                              ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'
                                              : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                                          }`}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            toggleDateGroup(group.date);
                                          }}
                                        >
                                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                                        </button>
                                        <span>{format(new Date(`${group.date}T00:00:00`), 'dd MMM yyyy', { locale: id })}</span>
                                      </div>
                                    )}
                                    secondary={format(new Date(`${group.date}T00:00:00`), 'EEEE', { locale: id })}
                                    showLabel
                                  />
                                  <SummaryCell
                                    align="left"
                                    label="Rincian"
                                    primary={`${formatNumber(group.rows.length)} rincian`}
                                    showLabel
                                  />
                                  <SummaryCell
                                    label="Spend"
                                    primary={formatShortCurrency(group.spendDashboard)}
                                    secondary={formatShortCurrency(group.spendTotal)}
                                  />
                                  <SummaryCell
                                    align="center"
                                    label="Lead Dashboard"
                                    primary={formatNumber(group.leadsDash)}
                                    secondary={`Prospek CRM: ${formatNumber(group.leadsReal)}`}
                                    primaryClassName="text-cyan-600"
                                  />
                                  <SummaryCell
                                    align="center"
                                    label="Spam"
                                    primary={formatNumber(group.spam)}
                                    primaryClassName="text-red-600"
                                  />
                                  <SummaryCell
                                    align="center"
                                    label="Spam Rate"
                                    primary={formatPercentAllowZero(group.spamRate)}
                                    primaryClassName="text-amber-500"
                                  />
                                  <SummaryCell
                                    align="center"
                                    label="Order"
                                    primary={formatNumber(group.orders)}
                                    primaryClassName="text-blue-600"
                                  />
                                  <SummaryCell
                                    label="Konversi"
                                    primary={formatPercent(group.closingRate)}
                                    primaryClassName={getConversionRateTextClass(group.closingRate)}
                                  />
                                  <SummaryCell
                                    label="Cost per Lead"
                                    primary={formatShortCurrency(group.cpl)}
                                    secondary={group.leadsDash > 0 ? formatShortCurrency(group.cplTotal) : undefined}
                                    primaryClassName={getCostPerLeadTextClass(group.cpl)}
                                  />
                                  <SummaryCell
                                    label="Cost per Closing"
                                    primary={formatShortCurrency(group.cprClosing)}
                                    secondary={group.orders > 0 ? formatShortCurrency(group.cprClosingTotal) : undefined}
                                  />
                                  <SummaryCell align="center" label="Terjadwal" primary={formatNumber(group.scheduled)} />
                                  <SummaryCell
                                    align="center"
                                    label="Selesai"
                                    primary={formatNumber(group.done)}
                                    primaryClassName="text-emerald-600"
                                  />
                                  <SummaryCell
                                    align="center"
                                    label="Batal"
                                    primary={formatNumber(group.cancelled)}
                                    primaryClassName="text-red-500"
                                  />
                                  <SummaryCell
                                    label="Biaya/Selesai"
                                    primary={formatShortCurrency(group.costPerDone)}
                                    secondary={group.done > 0 ? formatShortCurrency(group.costPerDoneTotal) : undefined}
                                  />
                                  <SummaryCell label="Revenue" primary={formatShortCurrency(group.revenue)} />
                                  <th className="px-4 py-4 text-right align-top font-normal">
                                    <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">ROAS</div>
                                    <div className="mt-1 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold leading-tight text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                      {group.roas > 0 ? `${group.roas.toFixed(2)}x` : '-'}
                                    </div>
                                    {group.roasTotal > 0 && (
                                      <div className="mt-1 font-mono text-[10px] leading-tight text-slate-500 dark:text-slate-400">{group.roasTotal.toFixed(2)}x</div>
                                    )}
                                  </th>
                                </tr>
                                {isExpanded && (
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
                                  <th className="px-4 py-3 text-center font-medium">Terjadwal</th>
                                  <th className="px-4 py-3 text-center font-medium">Selesai</th>
                                  <th className="px-4 py-3 text-center font-medium">Batal</th>
                                  <th className="px-4 py-3 text-right font-medium">Biaya/Selesai</th>
                                  <th className="px-4 py-3 text-right font-medium">Revenue</th>
                                  <th className="px-4 py-3 text-right font-medium">ROAS</th>
                                </tr>
                                )}
                              </thead>
                              {isExpanded && (
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {group.rows.map((row, index) => (
                                  <tr key={`${row.date}-${row.accountName}-${row.csName}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                    <td className="px-4 py-3 align-top">
                                      <div className="mb-2">
                                        <div className="font-medium text-slate-700 dark:text-slate-200">
                                          {format(new Date(`${row.date}T00:00:00`), 'dd MMM yyyy', { locale: id })}
                                        </div>
                                        <div className="mt-0.5 text-[11px] font-normal text-slate-400">
                                          {format(new Date(`${row.date}T00:00:00`), 'EEEE', { locale: id })}
                                        </div>
                                      </div>
                                      <div className="font-semibold text-slate-800 dark:text-slate-100">{row.csName}</div>
                                      <div className="mt-1 max-w-[170px] truncate text-[11px] font-normal text-slate-400 dark:text-slate-500" title={row.advertiserName}>
                                        {row.advertiserName}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                      <div className="flex items-start gap-3">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950">
                                          <PlatformLogo platform={row.platformKey} size="sm" />
                                        </span>
                                        <div className="min-w-0">
                                          <div className="max-w-[280px] truncate font-semibold text-slate-900 dark:text-slate-100" title={row.accountName}>{row.accountName}</div>
                                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                            {row.subChannelName ? `${row.platformName} / ${row.subChannelName}` : row.platformName}
                                          </div>
                                          <Badge
                                            variant="outline"
                                            className={row.source === 'api' || row.source === 'connected'
                                              ? 'mt-2 border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                                              : 'mt-2 border-slate-200 bg-slate-50 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}
                                          >
                                            {row.source === 'api' || row.source === 'connected' ? 'Connected' : 'Operasional'}
                                          </Badge>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right align-top">
                                      <SpendingCellValue
                                        spendDashboard={row.spendDashboard}
                                        spendTotal={row.spendTotal}
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-center align-top">
                                      <div className="font-mono font-semibold text-cyan-600">{formatNumber(row.leadsDash)}</div>
                                      <div className="mt-1 text-[11px] text-slate-500">Prospek CRM: {formatNumber(row.leadsReal)}</div>
                                    </td>
                                    <td className="px-4 py-3 text-center align-top font-mono font-semibold text-red-600 dark:text-red-300">{formatNumber(row.spam)}</td>
                                    <td className="px-4 py-3 text-center align-top font-mono font-semibold text-amber-500 dark:text-amber-300">{formatPercentAllowZero(row.spamRate)}</td>
                                    <td className="px-4 py-3 text-center align-top font-mono font-semibold text-blue-600">{formatNumber(row.orders)}</td>
                                    <td className={`px-4 py-3 text-right align-top font-mono font-semibold ${getConversionRateTextClass(row.orderRate)}`}>{formatPercent(row.orderRate)}</td>
                                    <td className="px-4 py-3 text-right align-top">
                                      <div className={`font-mono font-semibold ${getCostPerLeadTextClass(row.cpl)}`}>{formatShortCurrency(row.cpl)}</div>
                                      {row.leadsDash > 0 && (
                                        <div className="mt-1 font-mono text-[11px] text-slate-500">
                                          {formatShortCurrency(row.cplTotal)}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-right align-top">
                                      <CprClosingCellValue
                                        cprClosing={row.cprClosing}
                                        cprClosingTotal={row.cprClosingTotal}
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-center align-top font-mono">{formatNumber(row.scheduled)}</td>
                                    <td className="px-4 py-3 text-center align-top font-mono font-semibold text-emerald-600">{formatNumber(row.done)}</td>
                                    <td className="px-4 py-3 text-center align-top font-mono font-semibold text-red-500">{formatNumber(row.cancelled)}</td>
                                    <td className="px-4 py-3 text-right align-top">
                                      <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">{formatShortCurrency(row.costPerDone)}</div>
                                      {row.done > 0 && (
                                        <div className="mt-1 font-mono text-[11px] text-slate-500">
                                          {formatShortCurrency(row.costPerDoneTotal)}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-right align-top font-mono font-semibold text-slate-900 dark:text-slate-100">{formatShortCurrency(row.revenue)}</td>
                                    <td className="px-4 py-3 text-right align-top">
                                      <div className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                        {row.roas > 0 ? `${row.roas.toFixed(2)}x` : '-'}
                                      </div>
                                      {row.revenue > 0 && row.spendTotal > 0 && (
                                        <div className="mt-1 font-mono text-[11px] text-slate-500">
                                          {row.roasTotal.toFixed(2)}x
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              )}
                            </table>
                            </HorizontalDragScroll>
                          </>
                          )}
                        </div>
                    </div>
                    );
                  })
                ) : (
                  <OperationalEmptyState
                    icon={TrendingUp}
                    title="Belum ada data performa"
                    description="Data akan muncul dari prospek/order CS dan snapshot API pada rentang tanggal yang dipilih."
                  />
                )}
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Menampilkan {dateGroups.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1}
              {' - '}
              {Math.min(currentPage * itemsPerPage, dateGroups.length)}
              {' dari '}
              {dateGroups.length} tanggal ({detailRows.length} rincian)
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage === 1 || dateGroups.length === 0}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                >
                  &lt;
                </Button>
                <span className="min-w-[56px] text-center text-xs font-medium">
                  {dateGroups.length === 0 ? 0 : currentPage} / {dateGroups.length === 0 ? 0 : totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage === totalPages || dateGroups.length === 0}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                >
                  &gt;
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tampilkan:</span>
                <Select
                  value={String(itemsPerPage)}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[132px] bg-white text-xs dark:border-slate-700 dark:bg-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 Tanggal</SelectItem>
                    <SelectItem value="10">10 Tanggal</SelectItem>
                    <SelectItem value={String(CS_VIEW_DEFAULT_ITEMS_PER_PAGE)}>1 Bulan</SelectItem>
                    <SelectItem value="50">50 Tanggal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </OperationalTableCard>
      </div>
        </TabsContent>

        <TabsContent value="spam-inputs" className="space-y-4">
          <OperationalTableCard>
            <CardHeader className="border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base text-slate-800 dark:text-slate-100">Riwayat Input Spam</CardTitle>
                  <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
                    Data mengikuti filter CS, platform, dan periode yang aktif di CS View.
                  </p>
                </div>
                {canManageSpamInputs && (
                  <Button
                    type="button"
                    className="h-9 gap-2 bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                    onClick={() => openSpamInputDialog()}
                  >
                    <Plus className="h-4 w-4" />
                    Input Spam
                  </Button>
                )}
              </div>
            </CardHeader>

            {spamInputRows.length > 0 ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[980px]">
                  <TableHeader className="bg-slate-50 dark:bg-slate-900">
                    <TableRow className="border-b border-slate-200 hover:bg-transparent dark:border-slate-800">
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">CS</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Platform</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Advertiser</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Spam</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Catatan</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Update</TableHead>
                      <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {spamInputRows.map((item) => (
                      <TableRow key={item.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        <TableCell className="whitespace-nowrap align-top">
                          <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                            {format(new Date(`${item.inputDate}T00:00:00`), 'dd MMM yyyy', { locale: id })}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {format(new Date(`${item.inputDate}T00:00:00`), 'EEEE', { locale: id })}
                          </div>
                        </TableCell>
                        <TableCell className="align-top font-medium text-slate-800 dark:text-slate-100">{item.csName}</TableCell>
                        <TableCell className="align-top text-slate-600 dark:text-slate-300">{item.platformName}</TableCell>
                        <TableCell className="align-top text-slate-600 dark:text-slate-300">{item.advertiserName}</TableCell>
                        <TableCell className="text-right align-top font-mono font-semibold text-rose-600 dark:text-rose-300">
                          {formatNumber(item.spamCount)}
                        </TableCell>
                        <TableCell className="max-w-[280px] align-top text-slate-600 dark:text-slate-300">
                          <div className="line-clamp-2">{item.notes || '-'}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap align-top text-xs text-slate-500 dark:text-slate-400">
                          {item.updatedAt
                            ? format(new Date(item.updatedAt), 'dd MMM yyyy HH:mm', { locale: id })
                            : '-'}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 bg-white dark:bg-slate-900"
                              onClick={() => openSpamInputEditDialog(item)}
                              disabled={!canManageSpamInputs}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 border-rose-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/20"
                              onClick={() => setSpamInputToDelete(item.id)}
                              disabled={!canManageSpamInputs}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Hapus
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <OperationalEmptyState
                icon={AlertTriangle}
                title="Belum ada input spam"
                description="Input spam yang sesuai filter aktif akan muncul di sini dan bisa diedit jika ada kesalahan."
              />
            )}
          </OperationalTableCard>
        </TabsContent>
      </Tabs>

      <Sheet
        open={isSpamDialogOpen}
        onOpenChange={(open) => {
          setIsSpamDialogOpen(open);
          if (!open) {
            lastSpamScopeKeyRef.current = '';
            setSpamForm(buildInitialSpamFormState());
          }
        }}
      >
        <SheetContent
          side={isSpamFormMobile ? 'bottom' : 'right'}
          className={`flex flex-col gap-0 border-slate-200 bg-slate-50 p-0 dark:border-slate-800 dark:bg-slate-950 ${
            isSpamFormMobile ? 'h-[90vh] rounded-t-xl' : 'h-full w-full sm:max-w-xl'
          }`}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <SheetHeader className="sticky top-0 z-10 shrink-0 rounded-t-xl border-b border-slate-200 bg-white p-4 text-left dark:border-slate-800 dark:bg-slate-900 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <SheetTitle className="text-left text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {spamForm.id ? 'Edit Input Spam Harian' : 'Input Spam Harian'}
                </SheetTitle>
                <SheetDescription className="text-left text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  Data disimpan per kombinasi tanggal, CS, advertiser, dan platform.
                </SheetDescription>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsSpamDialogOpen(false)}
                className="-mr-2 -mt-1 h-8 w-8 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Tutup</span>
              </Button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 border-b border-slate-100 pb-3 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Data Spam</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Pilihan advertiser dan platform mengikuti assignment akun iklan pada tanggal yang dipilih.
                </p>
              </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="spam-input-date">
                <RequiredLabel>Tanggal</RequiredLabel>
              </Label>
              <Input
                id="spam-input-date"
                type="date"
                className="h-10 bg-white dark:border-slate-700 dark:bg-slate-900"
                value={spamForm.inputDate}
                onChange={(event) => setSpamForm((current) => ({ ...current, inputDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>
                <RequiredLabel>CS</RequiredLabel>
              </Label>
              <Select
                value={spamForm.csId || undefined}
                onValueChange={(value) => setSpamForm((current) => ({ ...current, csId: value, advertiserId: '', platformId: '' }))}
                disabled={!isOwner}
              >
                <SelectTrigger className="h-10 bg-white dark:border-slate-700 dark:bg-slate-900">
                  <SelectValue placeholder="Pilih CS" />
                </SelectTrigger>
                <SelectContent>
                  {spamCsOptions.map((cs) => (
                    <SelectItem key={cs.id} value={cs.id}>{cs.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                <RequiredLabel>Advertiser</RequiredLabel>
              </Label>
              <Select
                value={spamForm.advertiserId || undefined}
                onValueChange={(value) => setSpamForm((current) => ({ ...current, advertiserId: value, platformId: '' }))}
                disabled={!spamForm.csId || spamAdvertiserOptions.length === 0}
              >
                <SelectTrigger className="h-10 bg-white dark:border-slate-700 dark:bg-slate-900">
                  <SelectValue placeholder={!spamForm.csId ? 'Pilih CS dulu' : 'Pilih advertiser'} />
                </SelectTrigger>
                <SelectContent>
                  {spamAdvertiserOptions.map((advertiser) => (
                    <SelectItem key={advertiser.id} value={advertiser.id}>{advertiser.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {spamForm.csId && spamAdvertiserOptions.length === 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Belum ada advertiser aktif yang assignment akunnya cocok dengan CS dan tanggal ini.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                <RequiredLabel>Platform</RequiredLabel>
              </Label>
              <Select
                value={spamForm.platformId || undefined}
                onValueChange={(value) => setSpamForm((current) => ({ ...current, platformId: value }))}
                disabled={!spamForm.advertiserId || spamPlatformOptions.length === 0}
              >
                <SelectTrigger className="h-10 bg-white dark:border-slate-700 dark:bg-slate-900">
                  <SelectValue placeholder={spamForm.advertiserId ? 'Pilih platform' : 'Pilih advertiser dulu'} />
                </SelectTrigger>
                <SelectContent>
                  {spamPlatformOptions.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>{platform.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {spamForm.advertiserId && spamPlatformOptions.length === 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Belum ada platform aktif yang cocok dengan advertiser, CS, dan tanggal ini.
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="spam-count">
                <RequiredLabel>Jumlah Spam</RequiredLabel>
              </Label>
              <Input
                id="spam-count"
                type="number"
                min="0"
                inputMode="numeric"
                className="h-10 bg-white dark:border-slate-700 dark:bg-slate-900"
                value={spamForm.spamCount}
                onChange={(event) => setSpamForm((current) => ({ ...current, spamCount: event.target.value }))}
                placeholder="Contoh: 5"
              />
              {spamForm.id && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Isi `0` lalu simpan jika ingin menghapus input yang sudah ada.
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="spam-notes" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Catatan
              </Label>
              <Textarea
                id="spam-notes"
                className="min-h-[88px] bg-white text-sm dark:border-slate-700 dark:bg-slate-900"
                value={spamForm.notes}
                onChange={(event) => setSpamForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Opsional: keterangan sumber spam atau catatan follow up."
                rows={3}
              />
            </div>
          </div>
            </section>
          </div>
          </div>

          <SheetFooter className="sticky bottom-0 z-10 shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row md:p-6">
            <Button
              type="button"
              variant="outline"
              className="mt-2 h-10 w-full bg-white sm:mt-0 sm:w-auto dark:bg-slate-900"
              onClick={() => setIsSpamDialogOpen(false)}
              disabled={isSavingSpamInput}
            >
              Batal
            </Button>
            <Button
              type="button"
              className="h-10 w-full min-w-[140px] bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
              onClick={handleSaveSpamInput}
              disabled={isSavingSpamInput}
            >
              {isSavingSpamInput ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Simpan...</> : 'Simpan'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(spamInputToDelete)} onOpenChange={(open) => !open && setSpamInputToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus input spam?</AlertDialogTitle>
            <AlertDialogDescription>
              Data spam ini akan dihapus dari CS View dan perhitungan spam pada periode terkait ikut berubah.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={handleDeleteSpamInput}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </OperationalPageShell>
  );
}
