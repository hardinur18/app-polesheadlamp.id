import { normalizeOrderTime } from '@/app/services/orderTime';
import type { Order } from '../../data';

const ORDER_CRM_SYNC_FIELDS: (keyof Order)[] = [
  'customerName',
  'customerPhone',
  'address',
  'mapsUrl',
  'notes',
];

const ORDER_LIFECYCLE_SYNC_FIELDS: (keyof Order)[] = [
  'leadId',
  'status',
  'serviceDate',
  'serviceTime',
  'technicianId',
  'branchId',
  'areaId',
];

const getOrderSideEffectComparableValue = (
  order: Partial<Order> | null | undefined,
  field: keyof Order,
) => {
  const value = order?.[field];
  if (field === 'serviceTime') {
    return normalizeOrderTime(typeof value === 'string' ? value : undefined);
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return value ?? null;
};

const orderChangedAnyField = (
  previousOrder: Order | null | undefined,
  nextOrder: Partial<Order>,
  fields: (keyof Order)[],
) => {
  if (!previousOrder) return true;

  return fields.some((field) =>
    getOrderSideEffectComparableValue(previousOrder, field) !==
      getOrderSideEffectComparableValue(nextOrder, field),
  );
};

const orderPatchChangedAnyField = (
  previousOrder: Order,
  patch: Partial<Order>,
  fields: (keyof Order)[],
) => fields.some((field) =>
  Object.prototype.hasOwnProperty.call(patch, field) &&
    getOrderSideEffectComparableValue(previousOrder, field) !==
      getOrderSideEffectComparableValue({ ...previousOrder, ...patch }, field),
);

export const shouldSyncOrderCrmForOrder = (
  previousOrder: Order | null | undefined,
  nextOrder: Partial<Order>,
) => orderChangedAnyField(previousOrder, nextOrder, ORDER_CRM_SYNC_FIELDS);

export const shouldSyncOrderLifecycleForOrder = (
  previousOrder: Order | null | undefined,
  nextOrder: Partial<Order>,
) => orderChangedAnyField(previousOrder, nextOrder, ORDER_LIFECYCLE_SYNC_FIELDS);

export const shouldSyncOrderCrmForPatch = (
  previousOrder: Order,
  patch: Partial<Order>,
) => orderPatchChangedAnyField(previousOrder, patch, ORDER_CRM_SYNC_FIELDS);

export const shouldSyncOrderLifecycleForPatch = (
  previousOrder: Order,
  patch: Partial<Order>,
) => orderPatchChangedAnyField(previousOrder, patch, ORDER_LIFECYCLE_SYNC_FIELDS);
