export function parseBooleanFlag(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return fallback;
}

export function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function parseUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function diffInDaysInclusive(from: string, to: string) {
  const fromDate = parseUtcDate(from).getTime();
  const toDate = parseUtcDate(to).getTime();
  return Math.floor((toDate - fromDate) / 86_400_000) + 1;
}

export function listDateChunks(from: string, to: string, chunkDays: number) {
  const chunks: Array<{ from: string; to: string }> = [];
  let cursor = parseUtcDate(from);
  const end = parseUtcDate(to);

  while (cursor.getTime() <= end.getTime()) {
    const chunkStart = new Date(cursor);
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + chunkDays - 1);

    if (chunkEnd.getTime() > end.getTime()) {
      chunkEnd.setTime(end.getTime());
    }

    chunks.push({
      from: formatUtcDate(chunkStart),
      to: formatUtcDate(chunkEnd),
    });

    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return chunks;
}

export function isSyncFresh(latestSyncedAt: string | null, minFreshMinutes: number) {
  if (!latestSyncedAt || minFreshMinutes <= 0) return false;

  const syncedAtMs = new Date(latestSyncedAt).getTime();
  if (!Number.isFinite(syncedAtMs)) return false;

  return Date.now() - syncedAtMs <= minFreshMinutes * 60_000;
}

export function getMaxTimestamp(rows: Array<{ syncedAt?: string | null }>) {
  const timestamps = rows
    .map((row) => (row.syncedAt ? new Date(row.syncedAt).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}
