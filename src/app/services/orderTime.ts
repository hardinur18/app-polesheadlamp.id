export function normalizeOrderTime(value: unknown, fallback = "") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const rawValue = String(value).trim();
  if (!rawValue) {
    return fallback;
  }

  const normalizedSeparator = rawValue.replace(/\s+/g, "").replace(".", ":");
  const match = normalizedSeparator.match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return rawValue;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "00");
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return rawValue;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
