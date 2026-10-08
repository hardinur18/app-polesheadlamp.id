export function toIsoTimestamp(value: unknown) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    const normalized = parsed < 1_000_000_000_000 ? parsed * 1000 : parsed;
    return new Date(normalized).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsedDate = Date.parse(value);
    if (Number.isFinite(parsedDate)) return new Date(parsedDate).toISOString();
  }
  return new Date().toISOString();
}

export function compareStrings(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export function buildQueryString(params: Record<string, string | number | boolean | null | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function asArray<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value === null || value === undefined) return [];
  return [value as T];
}

export function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

export function clampPositiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export function readQueryBoolean(value: string | null | undefined, fallback: boolean) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export function isValidTimestampFilter(value: string | null | undefined) {
  if (!value) return false;
  return Number.isFinite(new Date(value).getTime());
}

export function normalizeIsoTimestampFilter(value: string | null | undefined) {
  if (!isValidTimestampFilter(value)) return null;
  return new Date(value as string).toISOString();
}

export function getIsoTimestampDaysAgo(days: unknown, fallbackDays: number) {
  const parsed = Number(days);
  const finalDays =
    Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 365) : fallbackDays;
  return new Date(Date.now() - finalDays * 24 * 60 * 60 * 1000).toISOString();
}
