import type React from 'react';

export type ApiAdsStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export const formatShortCurrency = (value: number) =>
  Number.isFinite(value) && value > 0
    ? value.toLocaleString('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    })
    : Number.isFinite(value) && value === 0
      ? 'Rp 0'
      : '-';

export const formatNumber = (value: number) =>
  Number.isFinite(value) ? value.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '-';

export const formatCount = (value: number) =>
  Number.isFinite(value) ? value.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '0';

export const formatPercent = (value: number) =>
  Number.isFinite(value) && value > 0 ? `${value.toFixed(1)}%` : '-';

export const formatPercentAllowZero = (value: number) =>
  Number.isFinite(value) ? `${value.toFixed(1)}%` : '-';

export const getConversionRateTextClass = (value: number) => {
  if (!Number.isFinite(value)) return 'text-slate-950 dark:text-slate-100';
  if (value < 10) return 'text-red-600 dark:text-red-300';
  if (value <= 12) return 'text-amber-500 dark:text-amber-300';
  return 'text-emerald-600 dark:text-emerald-300';
};

export const getCostPerLeadTextClass = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 'text-slate-950 dark:text-slate-100';
  if (value < 8_000) return 'text-emerald-600 dark:text-emerald-300';
  if (value <= 10_000) return 'text-amber-500 dark:text-amber-300';
  return 'text-red-600 dark:text-red-300';
};

export type MetricTone = 'default' | 'blue' | 'cyan' | 'emerald' | 'amber' | 'red';

export const getCostPerLeadTone = (value: number): MetricTone => {
  if (!Number.isFinite(value) || value <= 0) return 'default';
  if (value < 8_000) return 'emerald';
  if (value <= 10_000) return 'amber';
  return 'red';
};

export const getApiStatusLabel = (status: ApiAdsStatus) => {
  if (status === 'ready') return 'Connected';
  if (status === 'loading') return 'Loading';
  if (status === 'empty') return 'Data kosong';
  if (status === 'error') return 'API error';
  if (status === 'idle') return 'Belum dimuat';
  return 'Unconnect';
};

export const apiStatusClassName = (status: ApiAdsStatus) => {
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

export function KpiMetricSkeleton({ withSubValue = true }: { withSubValue?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="h-7 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      {withSubValue && <span className="h-4 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />}
    </div>
  );
}

type SpendIndicatorTone = 'none' | 'low' | 'target' | 'high';
type CostIndicatorTone = 'none' | 'good' | 'target' | 'bad';
type RoasIndicatorTone = 'none' | 'bad' | 'target' | 'good';
type VolumeIndicatorTone = 'none' | 'active';

const getCostPerLeadIndicatorTone = (value: number): CostIndicatorTone => {
  if (!Number.isFinite(value) || value <= 0) return 'none';
  if (value < 8_000) return 'good';
  if (value <= 10_000) return 'target';
  return 'bad';
};

const getConversionRateIndicatorTone = (value: number): CostIndicatorTone => {
  if (!Number.isFinite(value) || value <= 0) return 'none';
  if (value < 10) return 'bad';
  if (value <= 12) return 'target';
  return 'good';
};

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

export const getCostIndicatorTextClass = (value: number) => {
  const tone = getCprClosingIndicatorTone(value);
  if (tone === 'good') return 'text-emerald-600 dark:text-emerald-300';
  if (tone === 'target') return 'text-amber-500 dark:text-amber-300';
  if (tone === 'bad') return 'text-red-600 dark:text-red-300';
  return 'text-slate-950 dark:text-slate-100';
};

const getRoasIndicatorTone = (value: number): RoasIndicatorTone => {
  if (!Number.isFinite(value) || value <= 0) return 'none';
  if (value < 1) return 'bad';
  if (value < 2) return 'target';
  return 'good';
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

const cplIndicatorStyles: Record<CostIndicatorTone, { badge: string; dot: string; title: string }> = {
  none: {
    badge: 'border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400',
    dot: 'bg-slate-300',
    title: 'Belum ada CPL',
  },
  good: {
    badge: 'border border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    title: 'CPL di bawah Rp 8.000',
  },
  target: {
    badge: 'border border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
    dot: 'bg-amber-500',
    title: 'CPL Rp 8.000 sampai Rp 10.000',
  },
  bad: {
    badge: 'border border-red-100 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
    dot: 'bg-red-500',
    title: 'CPL di atas Rp 10.000',
  },
};

const conversionIndicatorStyles: Record<CostIndicatorTone, { badge: string; dot: string; title: string }> = {
  none: {
    badge: 'border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400',
    dot: 'bg-slate-300',
    title: 'Belum ada konversi',
  },
  good: {
    badge: 'border border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    title: 'Konversi di atas 12%',
  },
  target: {
    badge: 'border border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
    dot: 'bg-amber-500',
    title: 'Konversi 10% sampai 12%',
  },
  bad: {
    badge: 'border border-red-100 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
    dot: 'bg-red-500',
    title: 'Konversi di bawah 10%',
  },
};

const volumeIndicatorStyles: Record<VolumeIndicatorTone, { badge: string; dot: string; title: string }> = {
  none: {
    badge: 'border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400',
    dot: 'bg-slate-300',
    title: 'Belum ada order',
  },
  active: {
    badge: 'border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300',
    dot: 'bg-blue-500',
    title: 'Order tercatat',
  },
};

const roasIndicatorStyles: Record<RoasIndicatorTone, { badge: string; dot: string; title: string }> = {
  none: {
    badge: 'border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400',
    dot: 'bg-slate-300',
    title: 'Belum ada ROAS',
  },
  bad: {
    badge: 'border border-red-100 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
    dot: 'bg-red-500',
    title: 'ROAS di bawah 1x',
  },
  target: {
    badge: 'border border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
    dot: 'bg-amber-500',
    title: 'ROAS 1x sampai di bawah 2x',
  },
  good: {
    badge: 'border border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    title: 'ROAS 2x atau lebih',
  },
};

export function SpendingCellValue({
  spendDashboard,
  spendTotal,
  subtleTotal = false,
}: {
  spendDashboard: number;
  spendTotal: number;
  subtleTotal?: boolean;
}) {
  const tone = getSpendIndicatorTone(spendTotal);
  const indicator = spendIndicatorStyles[tone];
  const totalClassName = subtleTotal
    ? 'inline-flex items-center justify-end gap-1.5 font-mono text-[11px] leading-tight text-slate-500 dark:text-slate-400'
    : `inline-flex items-center justify-end gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] leading-tight ${indicator.badge}`;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
        {formatShortCurrency(spendDashboard)}
      </div>
      <div
        className={totalClassName}
        title={indicator.title}
      >
        {tone !== 'none' && <span className={`h-1.5 w-1.5 rounded-full ${indicator.dot}`} />}
        <span>{formatShortCurrency(spendTotal)}</span>
      </div>
    </div>
  );
}

export function CprClosingCellValue({
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

export function CostIndicatorBadge({ value }: { value: number }) {
  const tone = getCprClosingIndicatorTone(value);
  const indicator = cprClosingIndicatorStyles[tone];

  return (
    <div
      className={`inline-flex items-center justify-end gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold leading-tight ${indicator.badge}`}
      title={indicator.title}
    >
      {tone !== 'none' && <i className={`h-1.5 w-1.5 rounded-full ${indicator.dot}`} />}
      <b className="font-mono font-semibold">{formatShortCurrency(value)}</b>
    </div>
  );
}

export function CostPerLeadBadge({ value }: { value: number }) {
  const tone = getCostPerLeadIndicatorTone(value);
  const indicator = cplIndicatorStyles[tone];

  return (
    <div
      className={`inline-flex items-center justify-end gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold leading-tight ${indicator.badge}`}
      title={indicator.title}
    >
      {tone !== 'none' && <i className={`h-1.5 w-1.5 rounded-full ${indicator.dot}`} />}
      <b className="font-mono font-semibold">{formatShortCurrency(value)}</b>
    </div>
  );
}

export function ConversionRateBadge({ value }: { value: number }) {
  const tone = getConversionRateIndicatorTone(value);
  const indicator = conversionIndicatorStyles[tone];

  return (
    <div
      className={`inline-flex items-center justify-end gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold leading-tight ${indicator.badge}`}
      title={indicator.title}
    >
      {tone !== 'none' && <i className={`h-1.5 w-1.5 rounded-full ${indicator.dot}`} />}
      <b className="font-mono font-semibold">{formatPercent(value)}</b>
    </div>
  );
}

export function OrderVolumeBadge({ value }: { value: number }) {
  const tone: VolumeIndicatorTone = value > 0 ? 'active' : 'none';
  const indicator = volumeIndicatorStyles[tone];

  return (
    <div
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold leading-tight ${indicator.badge}`}
      title={indicator.title}
    >
      {tone !== 'none' && <i className={`h-1.5 w-1.5 rounded-full ${indicator.dot}`} />}
      <b className="font-mono font-semibold">{formatNumber(value)}</b>
    </div>
  );
}

export function RoasBadgeValue({ value }: { value: number }) {
  const tone = getRoasIndicatorTone(value);
  const indicator = roasIndicatorStyles[tone];

  return (
    <div
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold leading-tight ${indicator.badge}`}
      title={indicator.title}
    >
      {tone !== 'none' && <i className={`h-1.5 w-1.5 rounded-full ${indicator.dot}`} />}
      <b className="font-mono font-semibold">{value > 0 ? `${value.toFixed(2)}x` : '-'}</b>
    </div>
  );
}

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

export function SummaryCell({
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

export function DailySummaryMetric({
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

export function DailySummaryTableCell({
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

export function DailyRateMetric({ value }: { value: number }) {
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
