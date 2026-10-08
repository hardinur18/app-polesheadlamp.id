import type { KirimdevOutboundMediaType } from "./meta_messaging_types.ts";
import { WHATSAPP_MEDIA_MAX_BYTES } from "./meta_messaging_config.ts";

export function isKirimdevOutboundMediaType(value: unknown): value is KirimdevOutboundMediaType {
  return value === "image" || value === "video" || value === "audio" || value === "document";
}

export function inferKirimdevMediaTypeFromMime(mimeType: string): KirimdevOutboundMediaType | null {
  const normalized = mimeType.toLowerCase();
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("video/")) return "video";
  if (normalized.startsWith("audio/")) return "audio";
  if (
    normalized === "application/pdf" ||
    normalized.startsWith("text/") ||
    normalized.includes("word") ||
    normalized.includes("excel") ||
    normalized.includes("powerpoint") ||
    normalized.includes("spreadsheet") ||
    normalized.includes("presentation") ||
    normalized.includes("officedocument")
  ) {
    return "document";
  }
  return null;
}

export function validateKirimdevMediaFile({
  type,
  mimeType,
  size,
}: {
  type: KirimdevOutboundMediaType;
  mimeType: string;
  size: number;
}) {
  const normalizedMime = mimeType.toLowerCase();
  const maxBytes = WHATSAPP_MEDIA_MAX_BYTES[type];
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("File lampiran kosong atau tidak valid.");
  }
  if (size > maxBytes) {
    throw new Error(`Ukuran file ${type} melebihi batas WhatsApp.`);
  }
  if (type === "image" && !["image/jpeg", "image/jpg", "image/png"].includes(normalizedMime)) {
    throw new Error("Gambar WhatsApp harus JPG atau PNG.");
  }
  if (type === "video" && !["video/mp4", "video/3gpp", "video/quicktime"].includes(normalizedMime)) {
    throw new Error("Video WhatsApp harus MP4 atau 3GPP.");
  }
  if (type === "audio" && !normalizedMime.startsWith("audio/")) {
    throw new Error("Audio WhatsApp harus berupa file audio.");
  }
  if (type === "document" && (normalizedMime.startsWith("image/") || normalizedMime.startsWith("video/") || normalizedMime.startsWith("audio/"))) {
    throw new Error("Gunakan tombol media khusus untuk gambar, video, atau audio.");
  }
}

export function sanitizeMediaFileName(fileName: string) {
  const cleaned = fileName
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);
  return cleaned || "attachment";
}
