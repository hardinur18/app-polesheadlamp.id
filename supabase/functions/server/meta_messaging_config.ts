import type { KirimdevOutboundMediaType } from "./meta_messaging_types.ts";

function readSeedPageTokenMap() {
  const raw = Deno.env.get("META_DM_PAGE_TOKEN_MAP")?.trim() || "";
  if (!raw) return {} as Record<string, string>;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {} as Record<string, string>;
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .flatMap(([pageId, accessToken]) => {
          if (
            typeof pageId !== "string" ||
            !pageId.trim() ||
            typeof accessToken !== "string" ||
            !accessToken.trim()
          ) {
            return [];
          }

          return [[pageId.trim(), accessToken.trim()] as const];
        }),
    ) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
}

// Comma-separated list supports zero-downtime secret rotation: accept a delivery
// if ANY active secret validates ANY signature segment.
function readKirimdevWebhookSecrets() {
  const raw = Deno.env.get("KIRIMDEV_WEBHOOK_SECRET")?.trim() || "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export const META_GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION")?.trim() || "v25.0";
export const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN")?.trim() || "";
export const META_DM_USER_TOKEN = Deno.env.get("META_DM_USER_TOKEN")?.trim() || "";
export const META_IG_ACCESS_TOKEN = Deno.env.get("META_IG_ACCESS_TOKEN")?.trim() || "";
export const META_IG_ACCOUNT_ID = Deno.env.get("META_IG_ACCOUNT_ID")?.trim() || "";
export const META_IG_USER_ID = Deno.env.get("META_IG_USER_ID")?.trim() || "";
export const META_IG_USERNAME = Deno.env.get("META_IG_USERNAME")?.trim() || "";
export const META_WA_PHONE_NUMBER_ID = Deno.env.get("META_WA_PHONE_NUMBER_ID")?.trim() || "";
export const META_WA_DISPLAY_PHONE_NUMBER =
  Deno.env.get("META_WA_DISPLAY_PHONE_NUMBER")?.trim() || "";
export const META_APP_ID = Deno.env.get("META_APP_ID")?.trim() || "";
export const META_APP_SECRET = Deno.env.get("META_APP_SECRET")?.trim() || "";
export const META_MESSAGING_VERIFY_TOKEN =
  Deno.env.get("META_MESSAGING_VERIFY_TOKEN")?.trim() || "";
export const META_DM_PAGE_TOKEN_MAP = readSeedPageTokenMap();

// --- Kirimdev WhatsApp provider configuration ---------------------------------
// Kirimdev forwards WhatsApp webhooks (and exposes a List Messages API) so the
// inbox can read WhatsApp conversations without talking to Meta Graph directly.
// All credentials live here on the server only; nothing is exposed to the client.
export const KIRIMDEV_API_BASE_URL =
  Deno.env.get("KIRIMDEV_API_BASE_URL")?.trim().replace(/\/+$/, "") ||
  "https://api.kirimdev.com/v1";
export const KIRIMDEV_API_KEY = Deno.env.get("KIRIMDEV_API_KEY")?.trim() || "";
export const KIRIMDEV_PHONE_NUMBER_ID = Deno.env.get("KIRIMDEV_PHONE_NUMBER_ID")?.trim() || "";
export const KIRIMDEV_DISPLAY_PHONE_NUMBER =
  Deno.env.get("KIRIMDEV_DISPLAY_PHONE_NUMBER")?.trim() || "";
export const KIRIMDEV_WEBHOOK_TOLERANCE_SECONDS = (() => {
  const raw = Number(Deno.env.get("KIRIMDEV_WEBHOOK_TOLERANCE_SECONDS")?.trim() || "300");
  return Number.isFinite(raw) && raw > 0 ? Math.min(900, Math.floor(raw)) : 300;
})();
export const KIRIMDEV_BROADCAST_MAX_RECIPIENTS = (() => {
  const raw = Number(Deno.env.get("KIRIMDEV_BROADCAST_MAX_RECIPIENTS")?.trim() || "25");
  return Number.isFinite(raw) && raw > 0 ? Math.min(100, Math.floor(raw)) : 25;
})();
export const KIRIMDEV_BROADCAST_SEND_DELAY_MS = (() => {
  const raw = Number(Deno.env.get("KIRIMDEV_BROADCAST_SEND_DELAY_MS")?.trim() || "150");
  return Number.isFinite(raw) && raw >= 0 ? Math.min(1000, Math.floor(raw)) : 150;
})();
export const KIRIMDEV_WEBHOOK_SECRETS = readKirimdevWebhookSecrets();

// Events we recommend subscribing to from the Kirimdev dashboard/API. Surfaced
// read-only in the WhatsApp module's Inbox Settings panel.
export const KIRIMDEV_RECOMMENDED_EVENTS = [
  "message.received",
  "message.status",
  "message.sent",
  "contact.created",
  "contact.updated",
  "conversation.assigned",
  "conversation.closed",
];

export const KIRIMDEV_WEBHOOK_PATH = "/functions/v1/kirimdev-messaging-webhook";

export const WHATSAPP_MEDIA_BUCKET =
  Deno.env.get("WHATSAPP_MEDIA_BUCKET")?.trim() || "whatsapp-media";
export const WHATSAPP_MEDIA_MAX_BYTES: Record<KirimdevOutboundMediaType, number> = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
};
