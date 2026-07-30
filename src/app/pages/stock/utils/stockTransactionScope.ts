function getErrorText(error: unknown) {
  if (!error || typeof error !== "object") return "";

  const maybeError = error as Record<string, unknown>;
  return [
    maybeError.message,
    maybeError.details,
    maybeError.hint,
    maybeError.error_description,
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

const STOCK_SCOPE_FIELDS = ["branch_id", "technician_id"] as const;

export type StockScopeField = (typeof STOCK_SCOPE_FIELDS)[number];

export function isMissingStockTransactionScopeColumnError(error: unknown) {
  const text = getErrorText(error);

  return (
    text.includes("stock_transactions.branch_id") ||
    text.includes("stock_transactions.technician_id") ||
    (text.includes("stock_transactions") &&
      text.includes("schema cache") &&
      (text.includes("'branch_id'") ||
        text.includes("\"branch_id\"") ||
        text.includes("'technician_id'") ||
        text.includes("\"technician_id\"") ||
        text.includes("branch_id") ||
        text.includes("technician_id"))) ||
    (text.includes("stock_transactions") &&
      text.includes("does not exist") &&
      (text.includes("branch_id") || text.includes("technician_id")))
  );
}

export function getInvalidUuidStockScopeFields<T extends Partial<Record<StockScopeField, unknown>>>(
  error: unknown,
  payload: T,
) {
  const text = getErrorText(error);

  if (!text.includes("invalid input syntax for type uuid")) {
    return [] as StockScopeField[];
  }

  return STOCK_SCOPE_FIELDS.filter((field) => {
    const value = payload[field];
    return typeof value === "string" && value.length > 0 && text.includes(value.toLowerCase());
  });
}

export function omitStockScopeFields<T extends Record<string, unknown>, K extends keyof T>(
  payload: T,
  fields: readonly K[],
) {
  const next = { ...payload };

  for (const field of fields) {
    delete next[field];
  }

  return next as Omit<T, K>;
}

export function omitStockTransactionScope<T extends Record<string, unknown>>(payload: T) {
  return omitStockScopeFields(payload, STOCK_SCOPE_FIELDS);
}

export async function retryWithoutInvalidStockScope<
  TPayload extends Record<string, unknown>,
  TResult extends { error: unknown }
>(
  payload: TPayload,
  run: (payload: Partial<TPayload>) => PromiseLike<TResult>,
) {
  let result = await run(payload);
  const omittedScopeFields = result.error
    ? getInvalidUuidStockScopeFields(result.error, payload)
    : [];

  if (!result.error || omittedScopeFields.length === 0) {
    return { ...result, omittedScopeFields: [] as StockScopeField[] };
  }

  result = await run(omitStockScopeFields(payload, omittedScopeFields) as Partial<TPayload>);

  return { ...result, omittedScopeFields };
}
