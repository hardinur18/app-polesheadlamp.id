import type { Order } from '../master-data/data';

export function normalizeCustomerPhone(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

export type OrderSourceMode = 'organic' | 'repeat_order' | 'paid_ads';

export const ORDER_SOURCE_MODE_LABEL: Record<OrderSourceMode, string> = {
  organic: 'Organik',
  repeat_order: 'Repeat Order',
  paid_ads: 'Iklan',
};

export const ORDER_SOURCE_PLATFORM_NAME: Partial<Record<OrderSourceMode, string>> = {
  organic: 'organik',
  repeat_order: 'repeat order',
};

export const uniqueById = <T extends { id: string }>(items: T[]) =>
  Array.from(new Map(items.map((item) => [item.id, item])).values());

const ORDER_FORM_PATCH_FIELDS: (keyof Order)[] = [
  'leadDate',
  'customerName',
  'customerPhone',
  'address',
  'serviceDate',
  'serviceTime',
  'serviceId',
  'serviceCategory',
  'mapsUrl',
  'vehicleId',
  'units',
  'price',
  'platformId',
  'subChannelId',
  'csId',
  'advertiserId',
  'notes',
  'technicianId',
  'branchId',
  'areaId',
  'status',
  'paymentType',
  'paymentMethodId',
  'income',
  'paymentStatus',
  'paymentValidation',
  'affiliateName',
  'lat',
  'lng',
  'leadId',
  'cancelReason',
  'cancelReasonNote',
  'isFollowedUp',
  'followedUpBy',
  'followedUpAt',
  'followUpNote',
];

const normalizeOrderPatchCompareValue = (value: unknown) => value === undefined ? null : value;

const areOrderPatchValuesEqual = (left: unknown, right: unknown) => {
  const normalizedLeft = normalizeOrderPatchCompareValue(left);
  const normalizedRight = normalizeOrderPatchCompareValue(right);

  if (typeof normalizedLeft === 'object' || typeof normalizedRight === 'object') {
    return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
  }

  return normalizedLeft === normalizedRight;
};

export const buildOrderFormPatch = (previous: Order, next: Partial<Order>) => {
  const patch: Partial<Order> = {};

  ORDER_FORM_PATCH_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(next, field) && !areOrderPatchValuesEqual(previous[field], next[field])) {
      patch[field] = next[field] as never;
    }
  });

  return patch;
};
