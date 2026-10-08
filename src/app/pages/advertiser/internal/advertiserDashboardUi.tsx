export type ApiAdsStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export const dashboardRangeIncludesToday = (range: { from: string; to: string }, today: string) =>
  range.from <= today && range.to >= today;

export const formatCurrency = (value: number) =>
  Number.isFinite(value) && value > 0
    ? value.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
    : Number.isFinite(value) && value === 0
      ? 'Rp 0'
      : '-';

export const formatNumber = (value: number) =>
  Number.isFinite(value) ? value.toLocaleString('id-ID', { maximumFractionDigits: 0 }) : '-';

export const formatPercent = (value: number) =>
  Number.isFinite(value) ? `${value.toFixed(1)}%` : '-';

export const formatPercentAllowZero = (value: number) =>
  Number.isFinite(value) ? `${value.toFixed(1)}%` : '-';

export const apiStatusClassName = (status: ApiAdsStatus) => {
  if (status === 'ready') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300';
  if (status === 'loading') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300';
  if (status === 'error') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300';
  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300';
};

export const getCostPerLeadTextClass = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 'text-slate-950 dark:text-slate-100';
  if (value < 8_000) return 'text-emerald-600 dark:text-emerald-300';
  if (value <= 10_000) return 'text-amber-500 dark:text-amber-300';
  return 'text-red-600 dark:text-red-300';
};

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

const getCostIndicatorTone = (value: number): CostIndicatorTone => {
  if (!Number.isFinite(value) || value <= 0) return 'none';
  if (value < 80_000) return 'good';
  if (value <= 100_000) return 'target';
  return 'bad';
};

export const getCostIndicatorTextClass = (value: number) => {
  const tone = getCostIndicatorTone(value);
  if (tone === 'good') return 'text-emerald-600 dark:text-emerald-300';
  if (tone === 'target') return 'text-amber-500 dark:text-amber-300';
  if (tone === 'bad') return 'text-red-600 dark:text-red-300';
  return 'text-slate-950 dark:text-slate-100';
};

const costIndicatorStyles: Record<CostIndicatorTone, { badge: string; dot: string; title: string }> = {
  none: {
    badge: 'text-slate-500 dark:text-slate-400',
    dot: 'bg-slate-300',
    title: 'Belum ada biaya per hasil',
  },
  good: {
    badge: 'border border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    title: 'Biaya per hasil di bawah Rp 80.000',
  },
  target: {
    badge: 'border border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
    dot: 'bg-amber-500',
    title: 'Biaya per hasil Rp 80.000 sampai Rp 100.000',
  },
  bad: {
    badge: 'border border-red-100 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300',
    dot: 'bg-red-500',
    title: 'Biaya per hasil di atas Rp 100.000',
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

const getRoasIndicatorTone = (value: number): RoasIndicatorTone => {
  if (!Number.isFinite(value) || value <= 0) return 'none';
  if (value < 1) return 'bad';
  if (value < 2) return 'target';
  return 'good';
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
        {formatCurrency(spendDashboard)}
      </div>
      <div
        className={totalClassName}
        title={indicator.title}
      >
        {tone !== 'none' && <span className={`h-1.5 w-1.5 rounded-full ${indicator.dot}`} />}
        <span>{formatCurrency(spendTotal)}</span>
      </div>
    </div>
  );
}

export function CostIndicatorBadge({ value }: { value: number }) {
  const tone = getCostIndicatorTone(value);
  const indicator = costIndicatorStyles[tone];

  return (
    <div
      className={`inline-flex items-center justify-end gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold leading-tight ${indicator.badge}`}
      title={indicator.title}
    >
      {tone !== 'none' && <i className={`h-1.5 w-1.5 rounded-full ${indicator.dot}`} />}
      <b className="font-mono font-semibold">{formatCurrency(value)}</b>
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
      {tone !== 'none' && <span className={`h-1.5 w-1.5 rounded-full ${indicator.dot}`} />}
      <span>{formatCurrency(value)}</span>
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
      {tone !== 'none' && <span className={`h-1.5 w-1.5 rounded-full ${indicator.dot}`} />}
      <span>{value > 0 ? `${value.toFixed(2)}x` : '-'}</span>
    </div>
  );
}

export function KpiMetricSkeleton({ withSubValue = true }: { withSubValue?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="h-7 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      {withSubValue && <span className="h-4 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />}
    </div>
  );
}
