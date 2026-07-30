import { CancelReason, Order } from '../master-data/data';

export type ReasonStatus = Extract<Order['status'], 'cancelled' | 'reschedule'>;

const normalizeReasonLabel = (value?: string | null) => (value || '').trim().toLowerCase();

const FALLBACK_CANCEL_REASON_PRESETS: Record<CancelReason['type'], Array<Pick<CancelReason, 'label' | 'sort_order'>>> = {
  cancel: [
    { label: 'Cancel Kondisi', sort_order: 10 },
    { label: 'Cancel Tindak Lanjut', sort_order: 20 },
    { label: 'Cancel Jarak Tempuh', sort_order: 30 },
    { label: 'Lainnya', sort_order: 999 },
  ],
  reschedule: [
    { label: 'Lainnya', sort_order: 999 },
  ],
};

export const isReasonRequiredStatus = (status?: string | null): status is ReasonStatus =>
  status === 'cancelled' || status === 'reschedule';

export const getReasonTypeFromStatus = (status: ReasonStatus): CancelReason['type'] =>
  status === 'cancelled' ? 'cancel' : 'reschedule';

export const getReasonSectionLabel = (status: ReasonStatus) =>
  status === 'cancelled' ? 'Alasan Pembatalan' : 'Alasan Jadwal Ulang';

export const getCancelReasonOptions = (
  status: ReasonStatus,
  cancelReasons: CancelReason[] = [],
  currentValue?: string | null,
): CancelReason[] => {
  const reasonType = getReasonTypeFromStatus(status);
  const mergedReasons = new Map<string, CancelReason>();

  cancelReasons
    .filter((reason) => reason.is_active && reason.type === reasonType)
    .forEach((reason) => {
      mergedReasons.set(normalizeReasonLabel(reason.label), reason);
    });

  FALLBACK_CANCEL_REASON_PRESETS[reasonType].forEach((preset) => {
    const normalizedLabel = normalizeReasonLabel(preset.label);
    if (!mergedReasons.has(normalizedLabel)) {
      mergedReasons.set(normalizedLabel, {
        id: `fallback-${reasonType}-${normalizedLabel.replace(/\s+/g, '-')}`,
        type: reasonType,
        label: preset.label,
        sort_order: preset.sort_order,
        is_active: true,
      });
    }
  });

  const normalizedCurrentValue = normalizeReasonLabel(currentValue);
  if (normalizedCurrentValue && !mergedReasons.has(normalizedCurrentValue)) {
    mergedReasons.set(normalizedCurrentValue, {
      id: `legacy-${reasonType}-${normalizedCurrentValue.replace(/\s+/g, '-')}`,
      type: reasonType,
      label: currentValue!.trim(),
      sort_order: 900,
      is_active: true,
    });
  }

  return Array.from(mergedReasons.values()).sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }
    return left.label.localeCompare(right.label, 'id');
  });
};
