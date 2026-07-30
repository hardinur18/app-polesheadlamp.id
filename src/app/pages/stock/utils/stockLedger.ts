export type StockTransactionType = 'IN' | 'OUT' | 'ADJUST';

export interface StockTransactionLike {
  id?: string;
  product_id: string;
  type: StockTransactionType;
  quantity: number | string | null;
  unit_price?: number | string | null;
  total_value?: number | string | null;
  date?: string | null;
  created_at?: string | null;
}

export interface StockProductLike {
  id: string;
  current_qty: number | string | null;
  average_cost: number | string | null;
}

export interface StockLedgerState {
  qty: number;
  averageCost: number;
  totalIn: number;
  totalOut: number;
  totalAdjust: number;
  transactionCount: number;
}

export interface ReconciledStockState extends StockLedgerState {
  recordedQty: number;
  recordedAverageCost: number;
  effectiveQty: number;
  effectiveAverageCost: number;
  quantityDelta: number;
  averageCostDelta: number;
  hasTransactions: boolean;
  hasMismatch: boolean;
}

export const STOCK_UPDATED_EVENT = 'inventory:stock-updated';

const STOCK_PRECISION = 10000;

export function emitStockUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(STOCK_UPDATED_EVENT));
}

export function toStockNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return numeric;
}

export function roundStockQuantity(value: number) {
  return Math.round(value * STOCK_PRECISION) / STOCK_PRECISION;
}

export function roundCurrencyValue(value: number) {
  return Math.round(value);
}

function buildTransactionTimestamp(transaction: Pick<StockTransactionLike, 'date' | 'created_at'>) {
  const datePart = transaction.date || '1970-01-01';
  const createdAt = transaction.created_at || '';
  const timePart = createdAt.includes('T') ? createdAt.split('T')[1] : createdAt;
  return new Date(`${datePart}T${timePart || '00:00:00.000Z'}`).getTime();
}

export function sortStockTransactions<T extends Pick<StockTransactionLike, 'date' | 'created_at'>>(left: T, right: T) {
  return buildTransactionTimestamp(left) - buildTransactionTimestamp(right);
}

export function computeLedgerState(transactions: StockTransactionLike[]): StockLedgerState {
  const sorted = [...transactions].sort(sortStockTransactions);

  let qty = 0;
  let averageCost = 0;
  let totalIn = 0;
  let totalOut = 0;
  let totalAdjust = 0;

  for (const transaction of sorted) {
    const quantity = toStockNumber(transaction.quantity);
    const unitPrice = toStockNumber(transaction.unit_price);

    if (transaction.type === 'IN') {
      const oldValue = qty * averageCost;
      const incomingValue = quantity * unitPrice;
      qty += quantity;
      averageCost = qty > 0 ? (oldValue + incomingValue) / qty : 0;
      totalIn += quantity;
      continue;
    }

    if (transaction.type === 'OUT') {
      qty -= quantity;
      totalOut += quantity;
      continue;
    }

    qty += quantity;
    totalAdjust += quantity;
  }

  return {
    qty: roundStockQuantity(qty),
    averageCost: roundCurrencyValue(averageCost),
    totalIn: roundStockQuantity(totalIn),
    totalOut: roundStockQuantity(totalOut),
    totalAdjust: roundStockQuantity(totalAdjust),
    transactionCount: sorted.length,
  };
}

export function groupTransactionsByProduct<T extends StockTransactionLike>(transactions: T[]) {
  const grouped = new Map<string, T[]>();

  for (const transaction of transactions) {
    const current = grouped.get(transaction.product_id) || [];
    current.push(transaction);
    grouped.set(transaction.product_id, current);
  }

  return grouped;
}

export function reconcileProductStock<T extends StockProductLike>(
  product: T,
  transactions: StockTransactionLike[],
): ReconciledStockState {
  const recordedQty = roundStockQuantity(toStockNumber(product.current_qty));
  const recordedAverageCost = roundCurrencyValue(toStockNumber(product.average_cost));
  const ledger = computeLedgerState(transactions);
  const hasTransactions = ledger.transactionCount > 0;
  const effectiveQty = hasTransactions ? ledger.qty : recordedQty;
  const effectiveAverageCost = hasTransactions ? ledger.averageCost : recordedAverageCost;
  const quantityDelta = roundStockQuantity(recordedQty - ledger.qty);
  const averageCostDelta = roundCurrencyValue(recordedAverageCost - ledger.averageCost);
  const hasMismatch =
    hasTransactions &&
    (Math.abs(quantityDelta) > 0.0001 || Math.abs(averageCostDelta) > 0.01);

  return {
    ...ledger,
    recordedQty,
    recordedAverageCost,
    effectiveQty,
    effectiveAverageCost,
    quantityDelta,
    averageCostDelta,
    hasTransactions,
    hasMismatch,
  };
}
