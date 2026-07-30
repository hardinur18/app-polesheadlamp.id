export const formatAdsCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0);

export const formatAdsNumber = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(value || 0);

export const formatAdsPercent = (
  value: number | null | undefined,
  options?: {
    fractionDigits?: number;
  },
) => {
  if (value == null || !Number.isFinite(value)) return '-';

  return `${new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: options?.fractionDigits ?? 0,
  }).format(value * 100)}%`;
};

export const formatAdsDateTime = (value: string | null | undefined) => {
  if (!value) return '-';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};
