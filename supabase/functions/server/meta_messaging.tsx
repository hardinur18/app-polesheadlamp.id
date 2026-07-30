import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import {
  getRequesterAccessContext,
  hasEffectivePermission,
} from "./requester_access.ts";
import type { RequesterAccessContext } from "./requester_access.ts";
import type { PermissionKey } from "../../../src/app/data/permissions.ts";

const app = new Hono();

const META_GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION")?.trim() || "v25.0";
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN")?.trim() || "";
const META_DM_USER_TOKEN = Deno.env.get("META_DM_USER_TOKEN")?.trim() || "";
const META_IG_ACCESS_TOKEN = Deno.env.get("META_IG_ACCESS_TOKEN")?.trim() || "";
const META_IG_ACCOUNT_ID = Deno.env.get("META_IG_ACCOUNT_ID")?.trim() || "";
const META_IG_USER_ID = Deno.env.get("META_IG_USER_ID")?.trim() || "";
const META_IG_USERNAME = Deno.env.get("META_IG_USERNAME")?.trim() || "";
const META_WA_PHONE_NUMBER_ID = Deno.env.get("META_WA_PHONE_NUMBER_ID")?.trim() || "";
const META_WA_DISPLAY_PHONE_NUMBER =
  Deno.env.get("META_WA_DISPLAY_PHONE_NUMBER")?.trim() || "";
const META_APP_ID = Deno.env.get("META_APP_ID")?.trim() || "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET")?.trim() || "";
const META_MESSAGING_VERIFY_TOKEN =
  Deno.env.get("META_MESSAGING_VERIFY_TOKEN")?.trim() || "";

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

const META_DM_PAGE_TOKEN_MAP = readSeedPageTokenMap();

// --- Kirimdev WhatsApp provider configuration ---------------------------------
// Kirimdev forwards WhatsApp webhooks (and exposes a List Messages API) so the
// inbox can read WhatsApp conversations without talking to Meta Graph directly.
// All credentials live here on the server only; nothing is exposed to the client.
const KIRIMDEV_API_BASE_URL =
  Deno.env.get("KIRIMDEV_API_BASE_URL")?.trim().replace(/\/+$/, "") ||
  "https://api.kirimdev.com/v1";
const KIRIMDEV_API_KEY = Deno.env.get("KIRIMDEV_API_KEY")?.trim() || "";
const KIRIMDEV_PHONE_NUMBER_ID = Deno.env.get("KIRIMDEV_PHONE_NUMBER_ID")?.trim() || "";
const KIRIMDEV_DISPLAY_PHONE_NUMBER =
  Deno.env.get("KIRIMDEV_DISPLAY_PHONE_NUMBER")?.trim() || "";
const KIRIMDEV_WEBHOOK_TOLERANCE_SECONDS = (() => {
  const raw = Number(Deno.env.get("KIRIMDEV_WEBHOOK_TOLERANCE_SECONDS")?.trim() || "300");
  return Number.isFinite(raw) && raw > 0 ? Math.min(900, Math.floor(raw)) : 300;
})();
const KIRIMDEV_BROADCAST_MAX_RECIPIENTS = (() => {
  const raw = Number(Deno.env.get("KIRIMDEV_BROADCAST_MAX_RECIPIENTS")?.trim() || "25");
  return Number.isFinite(raw) && raw > 0 ? Math.min(100, Math.floor(raw)) : 25;
})();
const KIRIMDEV_BROADCAST_SEND_DELAY_MS = (() => {
  const raw = Number(Deno.env.get("KIRIMDEV_BROADCAST_SEND_DELAY_MS")?.trim() || "150");
  return Number.isFinite(raw) && raw >= 0 ? Math.min(1000, Math.floor(raw)) : 150;
})();

// Comma-separated list supports zero-downtime secret rotation: accept a delivery
// if ANY active secret validates ANY signature segment.
function readKirimdevWebhookSecrets() {
  const raw = Deno.env.get("KIRIMDEV_WEBHOOK_SECRET")?.trim() || "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

const KIRIMDEV_WEBHOOK_SECRETS = readKirimdevWebhookSecrets();

// Events we recommend subscribing to from the Kirimdev dashboard/API. Surfaced
// read-only in the WhatsApp module's Inbox Settings panel.
const KIRIMDEV_RECOMMENDED_EVENTS = [
  "message.received",
  "message.status",
  "message.sent",
  "contact.created",
  "contact.updated",
  "conversation.assigned",
  "conversation.closed",
];

const KIRIMDEV_WEBHOOK_PATH = "/functions/v1/kirimdev-messaging-webhook";

type KirimdevOutboundMediaType = "image" | "video" | "audio" | "document";

const WHATSAPP_MEDIA_BUCKET =
  Deno.env.get("WHATSAPP_MEDIA_BUCKET")?.trim() || "whatsapp-media";
const WHATSAPP_MEDIA_MAX_BYTES: Record<KirimdevOutboundMediaType, number> = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
};

type MessagingProvider = "meta" | "kirimdev";
type MessageDeliveryStatus = "pending" | "sent" | "delivered" | "read" | "failed";

type MetaMessagingChannel = {
  id: string;
  platform: "facebook_page" | "instagram" | "whatsapp";
  provider?: MessagingProvider;
  pageId: string;
  pageName: string;
  instagramAccountId?: string | null;
  instagramUsername?: string | null;
  instagramName?: string | null;
  whatsappPhoneNumberId?: string | null;
  whatsappDisplayPhoneNumber?: string | null;
  tasks: string[];
  supportsMessaging: boolean;
  subscribedFields: string[];
  accessToken: string;
  updatedAt: string;
};

type MetaMessageRecord = {
  id: string;
  channelId: string;
  conversationId: string;
  source?: "webhook" | "api";
  contactId: string;
  entryId: string | null;
  objectType: string | null;
  provider?: MessagingProvider;
  direction: "inbound" | "outbound";
  eventType: string;
  text: string | null;
  attachments: unknown[];
  mediaUrl?: string | null;
  status?: MessageDeliveryStatus | null;
  timestamp: string;
  raw: unknown;
};

type MetaConversationRecord = {
  id: string;
  channelId: string;
  source?: "webhook" | "api";
  contactId: string;
  entryId: string | null;
  objectType: string | null;
  provider?: MessagingProvider;
  contactName?: string | null;
  contactPhone?: string | null;
  contactAvatarUrl?: string | null;
  lastMessageAt: string;
  lastMessageText: string | null;
  lastDirection: "inbound" | "outbound";
  lastStatus?: MessageDeliveryStatus | null;
  lastHasAttachment?: boolean;
  conversationStatus?: string | null;
  unreadCount: number;
  updatedAt: string;
  raw?: unknown;
};

// WhatsApp contacts captured from webhook payloads (Meta passthrough contacts[]
// and Kirimdev native contact.* events). Stored separately so the Contacts page
// can read them without scanning every conversation.
type WhatsAppContactRecord = {
  id: string;
  provider: MessagingProvider;
  channelId: string;
  phoneNumberId: string | null;
  phoneNumber: string | null;
  name: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  raw?: unknown;
  createdAt: string | null;
  updatedAt: string;
};

type WhatsAppContactView = WhatsAppContactRecord & {
  accountLabel: string | null;
  accountPhoneNumber: string | null;
  csProfileId: string | null;
  csDisplayName: string | null;
  csWhatsappNumber: string | null;
  csAssignmentStatus: string | null;
};

type WhatsAppAccountOwnerView = {
  id: string;
  displayName: string;
  whatsappNumber: string;
  assignmentStatus: string | null;
};

type KirimdevSendTextInput = {
  phoneNumberId: string;
  to: string;
  text: string;
  replyToMessageId?: string | null;
  idempotencyKey?: string | null;
};

type KirimdevSendMediaInput = {
  phoneNumberId: string;
  to: string;
  type: KirimdevOutboundMediaType;
  mediaUrl: string;
  caption?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  replyToMessageId?: string | null;
  idempotencyKey?: string | null;
};

type KirimdevTemplateParameter = {
  name?: string | null;
  text: string;
};

type KirimdevSendTemplateInput = {
  phoneNumberId: string;
  to: string;
  templateName: string;
  language: string;
  bodyParameters?: KirimdevTemplateParameter[];
  idempotencyKey?: string | null;
};

type KirimdevSendResult = {
  response: any;
  message: MetaMessageRecord;
  conversation: MetaConversationRecord;
};

type WhatsAppTemplateView = {
  id: string;
  name: string;
  language: string;
  status: "pending" | "approved" | "rejected";
  category: string | null;
  content: string | null;
  variables: string[];
  components: unknown[];
  phoneNumberId: string | null;
  phoneNumber: string | null;
  providerTemplateId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  raw: unknown;
};

type WhatsAppBroadcastRecipientResult = {
  contactId: string | null;
  phoneNumber: string;
  name: string | null;
  status: "sent" | "failed";
  messageId: string | null;
  error: string | null;
  sentAt: string | null;
};

type WhatsAppBroadcastRecord = {
  id: string;
  provider: "kirimdev";
  campaignName: string;
  phoneNumberId: string;
  templateName: string;
  language: string;
  bodyParameters: KirimdevTemplateParameter[];
  recipientCount: number;
  successCount: number;
  failureCount: number;
  status: "completed" | "partial_failed" | "failed";
  createdAt: string;
  createdBy: string | null;
  results: WhatsAppBroadcastRecipientResult[];
};

type KirimdevSyncOptions = {
  phoneNumberId?: string | null;
  cursor?: string | null;
  since?: string | null;
  until?: string | null;
  conversationLimit?: number;
  maxPages?: number;
  includeMessages?: boolean;
  messageLimit?: number;
  messageMaxPages?: number;
};

type LiveInboxConversation = {
  id: string;
  channelId: string;
  platform: "facebook_page" | "instagram" | "whatsapp";
  source: "meta-live" | "webhook-store";
  provider?: MessagingProvider;
  pageName: string;
  channelLabel: string;
  contactId: string;
  contactName: string | null;
  contactHandle: string | null;
  lastMessageAt: string;
  lastMessageText: string | null;
  unreadCount: number;
  messageCount: number | null;
  updatedAt: string;
  graphLink: string | null;
  objectType: string | null;
};

type LiveInboxMessage = {
  id: string;
  channelId: string;
  conversationId: string;
  source: "meta-live" | "webhook-store";
  provider?: MessagingProvider;
  direction: "inbound" | "outbound";
  senderId: string | null;
  senderName: string | null;
  text: string | null;
  attachments: unknown[];
  mediaUrl?: string | null;
  status?: MessageDeliveryStatus | null;
  timestamp: string;
};

app.options("/*", (c) => c.body(null, 204));

function buildChannelKey(channelId: string) {
  return `meta_messaging_channel:${channelId}`;
}

function buildConversationKey(channelId: string, contactId: string) {
  return `${channelId}:${contactId}`;
}

function buildConversationStorageKey(conversationId: string) {
  return `meta_messaging_conversation:${conversationId}`;
}

function buildMessageStorageKey(conversationId: string, messageId: string) {
  return `meta_messaging_message:${conversationId}:${messageId}`;
}

function buildWebhookEventKey() {
  return `meta_messaging_webhook:${Date.now()}:${crypto.randomUUID()}`;
}

function buildKirimdevWebhookEventKey() {
  return `kirimdev_messaging_webhook:${Date.now()}:${crypto.randomUUID()}`;
}

function buildKirimdevDedupKey(eventId: string) {
  return `kirimdev_messaging_dedup:${eventId}`;
}

function buildWhatsAppContactStorageKey(channelId: string, contactKey: string) {
  return `whatsapp_contact:${channelId}:${contactKey}`;
}

function buildWhatsAppBroadcastStorageKey(broadcastId: string) {
  return `whatsapp_broadcast:${broadcastId}`;
}

function sanitizeChannel(channel: MetaMessagingChannel) {
  const { accessToken, ...rest } = channel;
  return rest;
}

function toIsoTimestamp(value: unknown) {
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

function compareStrings(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

async function createHmacHex(secret: string, payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createAppSecretProof(accessToken: string) {
  if (!META_APP_SECRET) return null;
  return createHmacHex(META_APP_SECRET, accessToken);
}

async function verifyWebhookSignature(rawBody: string, signatureHeader: string | null) {
  if (!META_APP_SECRET) return false;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = await createHmacHex(META_APP_SECRET, rawBody);
  return compareStrings(expected, signatureHeader.slice("sha256=".length));
}

// Verifies a Kirimdev webhook signature.
// Header format: `X-Kirim-Signature: t=<unix_seconds>,v1=<hex>[,v1=<hex>...]`.
// Signed string is `${t}.${rawBody}`, HMAC-SHA256, lowercase hex.
// Unlike the Meta handler above this FAILS CLOSED when no secret is configured,
// because the Kirimdev webhook function is deployed with --no-verify-jwt and the
// signature is the only thing standing between the public internet and the store.
async function verifyKirimdevSignature(rawBody: string, signatureHeader: string | null) {
  if (KIRIMDEV_WEBHOOK_SECRETS.length === 0) {
    return { ok: false, reason: "KIRIMDEV_WEBHOOK_SECRET belum dikonfigurasi di server." };
  }
  if (!signatureHeader) {
    return { ok: false, reason: "Header X-Kirim-Signature tidak ada." };
  }

  let timestamp: number | null = null;
  const providedSignatures: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (key === "t") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) timestamp = parsed;
    } else if (key === "v1" && value) {
      providedSignatures.push(value.toLowerCase());
    }
  }

  if (timestamp === null || providedSignatures.length === 0) {
    return { ok: false, reason: "Format X-Kirim-Signature tidak valid." };
  }

  const nowSeconds = Date.now() / 1000;
  if (Math.abs(nowSeconds - timestamp) > KIRIMDEV_WEBHOOK_TOLERANCE_SECONDS) {
    return { ok: false, reason: "Timestamp signature di luar toleransi (replay protection)." };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  for (const secret of KIRIMDEV_WEBHOOK_SECRETS) {
    const expected = (await createHmacHex(secret, signedPayload)).toLowerCase();
    if (providedSignatures.some((candidate) => compareStrings(expected, candidate))) {
      return { ok: true as const };
    }
  }

  return { ok: false, reason: "Signature Kirimdev tidak cocok." };
}

async function fetchMetaJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    const error = new Error(
      payload?.error?.message || payload?.message || `Meta Graph API error (${response.status})`,
    ) as Error & { payload?: unknown };
    error.payload = payload;
    throw error;
  }
  return payload;
}

function buildKirimdevApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${KIRIMDEV_API_BASE_URL}${normalizedPath}`;
}

function buildQueryString(params: Record<string, string | number | boolean | null | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function asArray<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value === null || value === undefined) return [];
  return [value as T];
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function clampPositiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function readQueryBoolean(value: string | null | undefined, fallback: boolean) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchKirimdevJson(path: string, init?: RequestInit) {
  if (!KIRIMDEV_API_KEY) {
    throw new Error("KIRIMDEV_API_KEY belum dikonfigurasi di server.");
  }

  const response = await fetch(buildKirimdevApiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${KIRIMDEV_API_KEY}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    const upstreamError = payload?.error || {};
    const message =
      upstreamError?.message ||
      upstreamError?.code ||
      payload?.message ||
      `Kirimdev API error (${response.status})`;
    const error = new Error(message) as Error & { status?: number; payload?: unknown };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function fetchMetaPaged<T>(
  path: string,
  params: Record<string, string>,
  accessToken = META_DM_USER_TOKEN || META_ACCESS_TOKEN,
) {
  if (!accessToken) {
    throw new Error("META_DM_USER_TOKEN atau META_ACCESS_TOKEN belum dikonfigurasi di server.");
  }

  const authParams = new URLSearchParams({ access_token: accessToken });
  const appSecretProof = await createAppSecretProof(accessToken);
  if (appSecretProof) {
    authParams.set("appsecret_proof", appSecretProof);
  }

  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  authParams.forEach((value, key) => url.searchParams.set(key, value));

  const rows: T[] = [];
  let nextUrl: string | null = url.toString();
  while (nextUrl) {
    const currentUrl = new URL(nextUrl);
    if (!currentUrl.searchParams.get("access_token")) {
      authParams.forEach((value, key) => currentUrl.searchParams.set(key, value));
    } else if (!currentUrl.searchParams.get("appsecret_proof") && appSecretProof) {
      currentUrl.searchParams.set("appsecret_proof", appSecretProof);
    }

    const payload = await fetchMetaJson(currentUrl.toString());
    if (Array.isArray(payload?.data)) {
      rows.push(...payload.data);
    }
    nextUrl = payload?.paging?.next || null;
  }

  return rows;
}

async function fetchMetaAbsolutePaged<T>(
  initialUrl: string | URL,
  accessToken?: string,
  maxPages = 20,
) {
  const rows: T[] = [];
  let nextUrl: string | null = typeof initialUrl === "string" ? initialUrl : initialUrl.toString();
  const appSecretProof = accessToken ? await createAppSecretProof(accessToken) : null;
  let pageCount = 0;

  while (nextUrl && pageCount < maxPages) {
    const currentUrl = new URL(nextUrl);
    if (accessToken && !currentUrl.searchParams.get("access_token")) {
      currentUrl.searchParams.set("access_token", accessToken);
    }
    if (
      currentUrl.hostname === "graph.facebook.com" &&
      appSecretProof &&
      !currentUrl.searchParams.get("appsecret_proof")
    ) {
      currentUrl.searchParams.set("appsecret_proof", appSecretProof);
    }

    const payload = await fetchMetaJson(currentUrl.toString());
    if (Array.isArray(payload?.data)) {
      rows.push(...payload.data);
    }
    nextUrl = payload?.paging?.next || null;
    pageCount += 1;
  }

  return rows;
}

async function debugCurrentMetaToken() {
  const inputToken = META_DM_USER_TOKEN || META_ACCESS_TOKEN;
  if (!META_APP_ID || !META_APP_SECRET || !inputToken) {
    throw new Error(
      "META_APP_ID, META_APP_SECRET, atau META_DM_USER_TOKEN / META_ACCESS_TOKEN belum lengkap.",
    );
  }

  const url = new URL("https://graph.facebook.com/debug_token");
  url.searchParams.set("input_token", inputToken);
  url.searchParams.set("access_token", `${META_APP_ID}|${META_APP_SECRET}`);
  return fetchMetaJson(url.toString());
}

async function checkAuth(req: Request) {
  let token = req.headers.get("x-client-token");
  if (!token) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return { error: "Missing Authorization header" };
    token = authHeader.replace("Bearer ", "");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceOrAnonKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseServiceOrAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: `Invalid token: ${error?.message || "Unknown"}` };
  }

  return { user };
}

type MessagingPermissionAccess =
  | { requester: RequesterAccessContext; error?: never }
  | { error: Response; requester?: never };

type MessagingPermissionOrInternalSyncAccess =
  | MessagingPermissionAccess
  | { requester: null; internal: true; error?: never };

async function requireMessagingPermission(c: any, permission: PermissionKey): Promise<MessagingPermissionAccess> {
  const requester = await getRequesterAccessContext(c.req.raw.headers);
  if (!requester) {
    return { error: c.json({ error: "Missing or invalid Authorization header" }, 401) };
  }
  if (!hasEffectivePermission(requester, permission)) {
    return { error: c.json({ error: "Forbidden: Insufficient WhatsApp permission" }, 403) };
  }

  return { requester };
}

async function requireAnyMessagingPermission(c: any, permissions: PermissionKey[]): Promise<MessagingPermissionAccess> {
  const requester = await getRequesterAccessContext(c.req.raw.headers);
  if (!requester) {
    return { error: c.json({ error: "Missing or invalid Authorization header" }, 401) };
  }
  if (!permissions.some((permission) => hasEffectivePermission(requester, permission))) {
    return { error: c.json({ error: "Forbidden: Insufficient WhatsApp permission" }, 403) };
  }

  return { requester };
}

function isInternalMessagingSyncRequest(c: any) {
  const token =
    c.req.header("x-internal-sync-token")?.trim() ||
    c.req.header("x-sync-token")?.trim() ||
    "";
  const expectedToken =
    Deno.env.get("WHATSAPP_INTERNAL_SYNC_TOKEN")?.trim() ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
    "";

  return Boolean(expectedToken && token && token === expectedToken);
}

async function requireAnyMessagingPermissionOrInternalSync(
  c: any,
  permissions: PermissionKey[],
): Promise<MessagingPermissionOrInternalSyncAccess> {
  if (isInternalMessagingSyncRequest(c)) {
    return { requester: null, internal: true };
  }

  return requireAnyMessagingPermission(c, permissions);
}

function isKirimdevOutboundMediaType(value: unknown): value is KirimdevOutboundMediaType {
  return value === "image" || value === "video" || value === "audio" || value === "document";
}

function inferKirimdevMediaTypeFromMime(mimeType: string): KirimdevOutboundMediaType | null {
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

function validateKirimdevMediaFile({
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

function sanitizeMediaFileName(fileName: string) {
  const cleaned = fileName
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120);
  return cleaned || "attachment";
}

function resolveSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

type SupabaseAdminClient = ReturnType<typeof resolveSupabaseAdminClient>;

async function ensureWhatsAppMediaBucket(supabase: SupabaseAdminClient) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;
  const bucketExists = buckets?.some((bucket) => bucket.name === WHATSAPP_MEDIA_BUCKET);
  const options = {
    public: true,
    fileSizeLimit: WHATSAPP_MEDIA_MAX_BYTES.document,
  };

  if (!bucketExists) {
    const { error } = await supabase.storage.createBucket(WHATSAPP_MEDIA_BUCKET, options);
    if (error) throw error;
    return;
  }

  await supabase.storage.updateBucket(WHATSAPP_MEDIA_BUCKET, options).catch(() => undefined);
}

async function uploadWhatsAppOutboundMedia({
  file,
  requestedType,
  userId,
}: {
  file: File;
  requestedType?: string | null;
  userId: string;
}) {
  const mimeType = file.type || "application/octet-stream";
  const inferredType = inferKirimdevMediaTypeFromMime(mimeType);
  const mediaType = isKirimdevOutboundMediaType(requestedType) ? requestedType : inferredType;
  if (!mediaType) {
    throw new Error("Tipe file ini belum didukung untuk lampiran WhatsApp.");
  }

  validateKirimdevMediaFile({ type: mediaType, mimeType, size: file.size });

  const supabase = resolveSupabaseAdminClient();
  await ensureWhatsAppMediaBucket(supabase);

  const safeName = sanitizeMediaFileName(file.name || `${mediaType}-attachment`);
  const objectPath = [
    userId,
    mediaType,
    `${Date.now()}-${crypto.randomUUID()}-${safeName}`,
  ].join("/");
  const uploadBody = new Blob([await file.arrayBuffer()], { type: mimeType });
  const { error } = await supabase.storage
    .from(WHATSAPP_MEDIA_BUCKET)
    .upload(objectPath, uploadBody, {
      contentType: mimeType,
      upsert: false,
    });
  if (error) throw error;

  const { data } = supabase.storage.from(WHATSAPP_MEDIA_BUCKET).getPublicUrl(objectPath);
  if (!data.publicUrl || !data.publicUrl.startsWith("https://")) {
    throw new Error("URL media WhatsApp harus public HTTPS.");
  }

  return {
    type: mediaType,
    url: data.publicUrl,
    path: objectPath,
    fileName: safeName,
    mimeType,
    size: file.size,
  };
}

async function fetchSubscribedFields(pageId: string, pageAccessToken: string) {
  try {
    const rows = await fetchMetaPaged<{ subscribed_fields?: string[] }>(
      `/${pageId}/subscribed_apps`,
      {
        fields: "subscribed_fields",
        limit: "50",
      },
      pageAccessToken,
    );

    return rows.flatMap((row) => row.subscribed_fields || []);
  } catch {
    return [];
  }
}

function buildChannelsFromPage({
  page,
  accessToken,
  subscribedFields,
  updatedAt,
}: {
  page: {
    id: string;
    name?: string;
    tasks?: string[];
    instagram_business_account?: {
      id?: string;
      username?: string;
      name?: string;
    } | null;
  };
  accessToken: string;
  subscribedFields: string[];
  updatedAt: string;
}) {
  const tasks = Array.isArray(page.tasks) ? page.tasks : [];
  const channels: MetaMessagingChannel[] = [
    {
      id: `page:${page.id}`,
      platform: "facebook_page",
      pageId: page.id,
      pageName: page.name || page.id,
      tasks,
      supportsMessaging: tasks.includes("MESSAGING"),
      subscribedFields,
      accessToken,
      updatedAt,
    },
  ];

  if (page.instagram_business_account?.id) {
    channels.push({
      id: `instagram:${page.instagram_business_account.id}`,
      platform: "instagram",
      pageId: page.id,
      pageName: page.name || page.id,
      instagramAccountId: page.instagram_business_account.id,
      instagramUsername: page.instagram_business_account.username || null,
      instagramName: page.instagram_business_account.name || null,
      tasks,
      supportsMessaging: tasks.includes("MESSAGING"),
      subscribedFields,
      accessToken,
      updatedAt,
    });
  }

  return channels;
}

async function fetchPageProfileWithToken(pageId: string, pageAccessToken: string) {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}`);
  url.searchParams.set("fields", "id,name,instagram_business_account{id,username,name}");
  url.searchParams.set("access_token", pageAccessToken);

  const appSecretProof = await createAppSecretProof(pageAccessToken);
  if (appSecretProof) {
    url.searchParams.set("appsecret_proof", appSecretProof);
  }

  return fetchMetaJson(url.toString());
}

function buildSeedInstagramChannel(updatedAt: string): MetaMessagingChannel | null {
  if (!META_IG_ACCESS_TOKEN || !META_IG_ACCOUNT_ID) return null;

  return {
    id: `instagram:${META_IG_ACCOUNT_ID}`,
    platform: "instagram",
    pageId: "instagram-direct",
    pageName: META_IG_USERNAME || "Instagram",
    instagramAccountId: META_IG_ACCOUNT_ID,
    instagramUsername: META_IG_USERNAME || null,
    instagramName: META_IG_USERNAME || null,
    tasks: ["MESSAGING"],
    supportsMessaging: true,
    subscribedFields: ["messages"],
    accessToken: META_IG_ACCESS_TOKEN,
    updatedAt,
  };
}

function buildSeedWhatsAppChannel(updatedAt: string): MetaMessagingChannel | null {
  if (!META_WA_PHONE_NUMBER_ID) return null;

  return {
    id: `whatsapp:${META_WA_PHONE_NUMBER_ID}`,
    platform: "whatsapp",
    pageId: META_WA_PHONE_NUMBER_ID,
    pageName: META_WA_DISPLAY_PHONE_NUMBER || META_WA_PHONE_NUMBER_ID,
    whatsappPhoneNumberId: META_WA_PHONE_NUMBER_ID,
    whatsappDisplayPhoneNumber: META_WA_DISPLAY_PHONE_NUMBER || null,
    tasks: ["MESSAGING"],
    supportsMessaging: true,
    subscribedFields: ["messages"],
    accessToken: "",
    updatedAt,
  };
}

async function discoverMessagingChannels() {
  const pageRows = await fetchMetaPaged<{
    id: string;
    name?: string;
    access_token?: string;
    tasks?: string[];
    instagram_business_account?: {
      id?: string;
      username?: string;
      name?: string;
    } | null;
  }>("/me/accounts", {
    fields: "id,name,access_token,tasks,instagram_business_account{id,username,name}",
    limit: "200",
  });

  const channels: MetaMessagingChannel[] = [];
  const updatedAt = new Date().toISOString();
  const discoveredPageIds = new Set<string>();

  for (const page of pageRows) {
    if (!page.id || !page.access_token) continue;
    const subscribedFields = await fetchSubscribedFields(page.id, page.access_token);
    channels.push(
      ...buildChannelsFromPage({
        page,
        accessToken: page.access_token,
        subscribedFields,
        updatedAt,
      }),
    );
    discoveredPageIds.add(page.id);
  }

  for (const [pageId, pageAccessToken] of Object.entries(META_DM_PAGE_TOKEN_MAP)) {
    if (!pageId || !pageAccessToken || discoveredPageIds.has(pageId)) continue;

    try {
      const page = await fetchPageProfileWithToken(pageId, pageAccessToken);
      const subscribedFields = await fetchSubscribedFields(pageId, pageAccessToken);
      channels.push(
        ...buildChannelsFromPage({
          page: {
            ...page,
            tasks: ["MESSAGING"],
          },
          accessToken: pageAccessToken,
          subscribedFields,
          updatedAt,
        }),
      );
    } catch {
      continue;
    }
  }

  const instagramSeed = buildSeedInstagramChannel(updatedAt);
  if (instagramSeed && !channels.some((channel) => channel.id === instagramSeed.id)) {
    channels.push(instagramSeed);
  }

  const whatsappSeed = buildSeedWhatsAppChannel(updatedAt);
  if (whatsappSeed) {
    channels.push(whatsappSeed);
  }

  return Array.from(new Map(channels.map((channel) => [channel.id, channel])).values()).sort(
    (left, right) => left.id.localeCompare(right.id),
  );
}

async function persistChannels(channels: MetaMessagingChannel[]) {
  for (const channel of channels) {
    await kv.set(buildChannelKey(channel.id), channel);
  }
}

async function listStoredChannels() {
  const rows = await kv.getByPrefix("meta_messaging_channel:");
  return (rows as MetaMessagingChannel[]).sort((left, right) => left.id.localeCompare(right.id));
}

function channelMatchesId(channel: MetaMessagingChannel, channelId: string) {
  if (!channelId) return false;
  if (channel.id === channelId) return true;

  if (channel.platform === "instagram" && channelId.startsWith("instagram:")) {
    const aliasIds = [channel.instagramAccountId, META_IG_USER_ID]
      .filter((value): value is string => Boolean(value && value.trim()))
      .map((value) => `instagram:${value.trim()}`);
    return aliasIds.includes(channelId);
  }

  return false;
}

async function getStoredChannel(channelId: string) {
  const channels = await listStoredChannels();
  return channels.find((channel) => channelMatchesId(channel, channelId)) || null;
}

function getChannelOwnIds(channel: MetaMessagingChannel) {
  const values = [channel.pageId, channel.instagramAccountId, channel.whatsappPhoneNumberId]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim());
  if (channel.platform === "instagram" && META_IG_USER_ID) {
    values.push(META_IG_USER_ID);
  }
  return new Set(values);
}

function getChannelGraphEdgeId(channel: MetaMessagingChannel) {
  if (channel.platform === "instagram") {
    return channel.instagramAccountId || null;
  }
  if (channel.platform === "facebook_page") {
    return channel.pageId || null;
  }
  return null;
}

function normalizePeopleCollection(value: any): Array<{ id: string | null; name: string | null; username: string | null }> {
  const rows = Array.isArray(value)
    ? value
    : Array.isArray(value?.data)
    ? value.data
    : [];

  return rows.map((row: any) => ({
    id: typeof row?.id === "string" ? row.id : null,
    name: typeof row?.name === "string" ? row.name : null,
    username: typeof row?.username === "string" ? row.username : null,
  }));
}

async function fetchLiveConversationRows(channel: MetaMessagingChannel) {
  if (channel.platform === "instagram" && channel.accessToken.startsWith("IG")) {
    const url = new URL("https://graph.instagram.com/v25.0/me/conversations");
    url.searchParams.set("fields", "id,updated_time,message_count,participants{id,username}");
    url.searchParams.set("limit", "100");
    url.searchParams.set("access_token", channel.accessToken);
    return await fetchMetaAbsolutePaged(url, channel.accessToken, 20);
  }

  const edgeId = getChannelGraphEdgeId(channel);
  if (!edgeId || !channel.accessToken) return [];

  const baseParams = {
    platform: channel.platform === "instagram" ? "instagram" : "messenger",
    limit: "100",
  };

  const primaryFields =
    "id,updated_time,message_count,unread_count,snippet,link,participants{id,name,username},senders{id,name,username}";
  const fallbackFields = "id,updated_time,message_count,unread_count,snippet,link";

  const buildUrl = async (fields: string) => {
    const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${edgeId}/conversations`);
    url.searchParams.set("platform", baseParams.platform);
    url.searchParams.set("limit", baseParams.limit);
    url.searchParams.set("fields", fields);
    url.searchParams.set("access_token", channel.accessToken);
    const appSecretProof = await createAppSecretProof(channel.accessToken);
    if (appSecretProof) {
      url.searchParams.set("appsecret_proof", appSecretProof);
    }
    return url;
  };

  try {
    return await fetchMetaAbsolutePaged(await buildUrl(primaryFields), channel.accessToken, 20);
  } catch {
    return await fetchMetaAbsolutePaged(await buildUrl(fallbackFields), channel.accessToken, 20);
  }
}

async function fetchLiveMessagesForChannelConversation(
  channel: MetaMessagingChannel,
  conversationId: string,
) {
  if (channel.platform === "instagram" && channel.accessToken.startsWith("IG")) {
    const url = new URL(`https://graph.instagram.com/v25.0/${conversationId}/messages`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("fields", "id,created_time,from,to,message");
    url.searchParams.set("access_token", channel.accessToken);
    const payload = await fetchMetaJson(url.toString());
    return Array.isArray(payload?.data) ? payload.data : [];
  }

  if (!channel.accessToken) return [];

  const primaryFields = "id,created_time,from,to,message,attachments,sticker";
  const fallbackFields = "id,created_time,from,message";

  const buildUrl = async (fields: string) => {
    const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${conversationId}/messages`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("fields", fields);
    url.searchParams.set("access_token", channel.accessToken);
    const appSecretProof = await createAppSecretProof(channel.accessToken);
    if (appSecretProof) {
      url.searchParams.set("appsecret_proof", appSecretProof);
    }
    return url;
  };

  try {
    const payload = await fetchMetaJson((await buildUrl(primaryFields)).toString());
    return Array.isArray(payload?.data) ? payload.data : [];
  } catch {
    const payload = await fetchMetaJson((await buildUrl(fallbackFields)).toString());
    return Array.isArray(payload?.data) ? payload.data : [];
  }
}

function formatChannelLabel(channel: MetaMessagingChannel) {
  if (channel.platform === "instagram") {
    return channel.instagramUsername ? `Instagram • @${channel.instagramUsername}` : "Instagram";
  }
  if (channel.platform === "facebook_page") {
    return `Messenger • ${channel.pageName}`;
  }
  if (channel.platform === "whatsapp") {
    return channel.whatsappDisplayPhoneNumber
      ? `WhatsApp • ${channel.whatsappDisplayPhoneNumber}`
      : "WhatsApp";
  }
  return channel.pageName;
}

function normalizeStoredConversation(
  conversation: MetaConversationRecord,
  channel: MetaMessagingChannel | null,
): LiveInboxConversation {
  const platform = channel?.platform || "whatsapp";
  return {
    id: conversation.id,
    channelId: conversation.channelId,
    platform,
    source: "webhook-store",
    provider: conversation.provider || channel?.provider || "meta",
    pageName: channel?.pageName || channel?.whatsappDisplayPhoneNumber || conversation.channelId,
    channelLabel: channel ? formatChannelLabel(channel) : conversation.channelId,
    contactId: conversation.contactId,
    contactName: conversation.contactName || null,
    contactHandle: null,
    lastMessageAt: conversation.lastMessageAt,
    lastMessageText: conversation.lastMessageText,
    unreadCount: conversation.unreadCount || 0,
    messageCount: null,
    updatedAt: conversation.updatedAt,
    graphLink: null,
    objectType: conversation.objectType,
  };
}

function resolveConversationChannel(
  channels: MetaMessagingChannel[],
  conversation: Pick<MetaConversationRecord, "channelId" | "objectType">,
) {
  const directMatch = channels.find((channel) => channelMatchesId(channel, conversation.channelId));
  if (directMatch) return directMatch;

  if (conversation.objectType === "instagram" && META_IG_ACCESS_TOKEN) {
    return channels.find((channel) => channel.platform === "instagram") || null;
  }

  return null;
}

function normalizeStoredMessage(message: MetaMessageRecord): LiveInboxMessage {
  return {
    id: message.id,
    channelId: message.channelId,
    conversationId: message.conversationId,
    source: "webhook-store",
    provider: message.provider || "meta",
    direction: message.direction,
    senderId: message.contactId,
    senderName: null,
    text: message.text,
    attachments: Array.isArray(message.attachments) ? message.attachments : [],
    mediaUrl: message.mediaUrl || null,
    status: message.status || null,
    timestamp: message.timestamp,
  };
}

function normalizeLiveConversation(
  channel: MetaMessagingChannel,
  row: any,
): LiveInboxConversation {
  const ownIds = getChannelOwnIds(channel);
  const participants = normalizePeopleCollection(row?.participants);
  const senders = normalizePeopleCollection(row?.senders);
  const people = [...participants, ...senders];
  const contact = people.find((item) => item.id && !ownIds.has(item.id)) || null;

  return {
    id: typeof row?.id === "string" ? row.id : crypto.randomUUID(),
    channelId: channel.id,
    platform: channel.platform,
    source: "meta-live",
    pageName: channel.pageName,
    channelLabel: formatChannelLabel(channel),
    contactId: contact?.id || `unknown:${channel.id}:${row?.id || crypto.randomUUID()}`,
    contactName: contact?.name || null,
    contactHandle: contact?.username || null,
    lastMessageAt:
      typeof row?.updated_time === "string" && row.updated_time ? row.updated_time : new Date().toISOString(),
    lastMessageText:
      typeof row?.snippet === "string" && row.snippet.trim() ? row.snippet.trim() : null,
    unreadCount: Number.isFinite(Number(row?.unread_count)) ? Number(row.unread_count) : 0,
    messageCount: Number.isFinite(Number(row?.message_count)) ? Number(row.message_count) : null,
    updatedAt:
      typeof row?.updated_time === "string" && row.updated_time ? row.updated_time : new Date().toISOString(),
    graphLink: typeof row?.link === "string" ? row.link : null,
    objectType: channel.platform,
  };
}

function normalizeLiveMessage(
  channel: MetaMessagingChannel,
  conversationId: string,
  row: any,
): LiveInboxMessage {
  const ownIds = getChannelOwnIds(channel);
  const fromId = typeof row?.from?.id === "string" ? row.from.id : null;
  const fromName =
    typeof row?.from?.name === "string"
      ? row.from.name
      : typeof row?.from?.username === "string"
      ? row.from.username
      : null;
  const direction: "inbound" | "outbound" =
    fromId && ownIds.has(fromId) ? "outbound" : "inbound";

  return {
    id: typeof row?.id === "string" ? row.id : `${conversationId}:${row?.created_time || Date.now()}`,
    channelId: channel.id,
    conversationId,
    source: "meta-live",
    direction,
    senderId: fromId,
    senderName: fromName,
    text: typeof row?.message === "string" && row.message.trim() ? row.message.trim() : null,
    attachments: Array.isArray(row?.attachments?.data)
      ? row.attachments.data
      : Array.isArray(row?.attachments)
      ? row.attachments
      : row?.sticker
      ? [{ type: "sticker", ...row.sticker }]
      : [],
    timestamp:
      typeof row?.created_time === "string" && row.created_time
        ? row.created_time
        : new Date().toISOString(),
  };
}

function normalizeStorageJsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function normalizeStorageJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readStringAtPath(value: unknown, path: string[]) {
  let current = value as any;
  for (const part of path) {
    if (!current || typeof current !== "object") return "";
    current = current[part];
  }
  return typeof current === "string" && current.trim() ? current.trim() : "";
}

function resolveWhatsAppProfilePhotoUrl(value: unknown) {
  const candidate = firstNonEmptyString(
    readStringAtPath(value, ["contactAvatarUrl"]),
    readStringAtPath(value, ["avatarUrl"]),
    readStringAtPath(value, ["avatar_url"]),
    readStringAtPath(value, ["profilePhotoUrl"]),
    readStringAtPath(value, ["profile_photo_url"]),
    readStringAtPath(value, ["profilePictureUrl"]),
    readStringAtPath(value, ["profile_picture_url"]),
    readStringAtPath(value, ["photoUrl"]),
    readStringAtPath(value, ["photo_url"]),
    readStringAtPath(value, ["imageUrl"]),
    readStringAtPath(value, ["image_url"]),
    readStringAtPath(value, ["picture"]),
    readStringAtPath(value, ["photo"]),
    readStringAtPath(value, ["metadata", "avatarUrl"]),
    readStringAtPath(value, ["metadata", "avatar_url"]),
    readStringAtPath(value, ["metadata", "profilePhotoUrl"]),
    readStringAtPath(value, ["metadata", "profile_photo_url"]),
    readStringAtPath(value, ["metadata", "profilePictureUrl"]),
    readStringAtPath(value, ["metadata", "profile_picture_url"]),
    readStringAtPath(value, ["metadata", "photoUrl"]),
    readStringAtPath(value, ["metadata", "photo_url"]),
    readStringAtPath(value, ["metadata", "imageUrl"]),
    readStringAtPath(value, ["metadata", "image_url"]),
    readStringAtPath(value, ["metadata", "picture"]),
    readStringAtPath(value, ["metadata", "photo"]),
    readStringAtPath(value, ["contact", "avatarUrl"]),
    readStringAtPath(value, ["contact", "avatar_url"]),
    readStringAtPath(value, ["contact", "profilePhotoUrl"]),
    readStringAtPath(value, ["contact", "profile_photo_url"]),
    readStringAtPath(value, ["contact", "profilePictureUrl"]),
    readStringAtPath(value, ["contact", "profile_picture_url"]),
    readStringAtPath(value, ["contact", "photoUrl"]),
    readStringAtPath(value, ["contact", "photo_url"]),
    readStringAtPath(value, ["contact", "imageUrl"]),
    readStringAtPath(value, ["contact", "image_url"]),
    readStringAtPath(value, ["contact", "picture"]),
    readStringAtPath(value, ["contact", "photo"]),
    readStringAtPath(value, ["contact", "metadata", "avatarUrl"]),
    readStringAtPath(value, ["contact", "metadata", "avatar_url"]),
    readStringAtPath(value, ["contact", "metadata", "profilePhotoUrl"]),
    readStringAtPath(value, ["contact", "metadata", "profile_photo_url"]),
    readStringAtPath(value, ["contact", "metadata", "profilePictureUrl"]),
    readStringAtPath(value, ["contact", "metadata", "profile_picture_url"]),
    readStringAtPath(value, ["contact", "metadata", "photoUrl"]),
    readStringAtPath(value, ["contact", "metadata", "photo_url"]),
    readStringAtPath(value, ["contact", "metadata", "imageUrl"]),
    readStringAtPath(value, ["contact", "metadata", "image_url"]),
    readStringAtPath(value, ["contact", "metadata", "picture"]),
    readStringAtPath(value, ["contact", "metadata", "photo"]),
    readStringAtPath(value, ["contact", "profile", "picture"]),
    readStringAtPath(value, ["contact", "profile", "photo_url"]),
    readStringAtPath(value, ["customer", "avatarUrl"]),
    readStringAtPath(value, ["customer", "avatar_url"]),
    readStringAtPath(value, ["customer", "profilePhotoUrl"]),
    readStringAtPath(value, ["customer", "profile_photo_url"]),
    readStringAtPath(value, ["customer", "profilePictureUrl"]),
    readStringAtPath(value, ["customer", "profile_picture_url"]),
    readStringAtPath(value, ["customer", "photoUrl"]),
    readStringAtPath(value, ["customer", "photo_url"]),
    readStringAtPath(value, ["customer", "imageUrl"]),
    readStringAtPath(value, ["customer", "image_url"]),
    readStringAtPath(value, ["profile", "picture"]),
    readStringAtPath(value, ["profile", "photo_url"]),
    readStringAtPath(value, ["contacts", "0", "profile", "picture"]),
    readStringAtPath(value, ["contacts", "0", "profile", "photo_url"]),
    readStringAtPath(value, ["conversation", "contactAvatarUrl"]),
    readStringAtPath(value, ["conversation", "avatarUrl"]),
    readStringAtPath(value, ["conversation", "avatar_url"]),
    readStringAtPath(value, ["conversation", "profilePhotoUrl"]),
    readStringAtPath(value, ["conversation", "profile_photo_url"]),
    readStringAtPath(value, ["conversation", "profilePictureUrl"]),
    readStringAtPath(value, ["conversation", "profile_picture_url"]),
    readStringAtPath(value, ["conversation", "contact", "avatarUrl"]),
    readStringAtPath(value, ["conversation", "contact", "avatar_url"]),
    readStringAtPath(value, ["conversation", "contact", "profilePhotoUrl"]),
    readStringAtPath(value, ["conversation", "contact", "profile_photo_url"]),
    readStringAtPath(value, ["conversation", "contact", "profilePictureUrl"]),
    readStringAtPath(value, ["conversation", "contact", "profile_picture_url"]),
    readStringAtPath(value, ["payload", "contact", "avatar_url"]),
    readStringAtPath(value, ["payload", "contact", "profile_photo_url"]),
    readStringAtPath(value, ["payload", "contact", "profile_picture_url"]),
  );

  if (!candidate) return null;
  if (
    candidate.startsWith("https://") ||
    candidate.startsWith("http://") ||
    candidate.startsWith("data:image/") ||
    candidate.startsWith("/")
  ) {
    return candidate;
  }
  return null;
}

function resolveWhatsAppContactNameFromRaw(value: unknown) {
  return firstNonEmptyString(
    readStringAtPath(value, ["conversation", "contact", "name"]),
    readStringAtPath(value, ["contact", "name"]),
    readStringAtPath(value, ["profile", "name"]),
  );
}

function resolveWhatsAppContactPhoneFromRaw(value: unknown) {
  const candidate = firstNonEmptyString(
    readStringAtPath(value, ["conversation", "contact", "phone_number"]),
    readStringAtPath(value, ["conversation", "contact", "phoneNumber"]),
    readStringAtPath(value, ["contact", "phone_number"]),
    readStringAtPath(value, ["contact", "phoneNumber"]),
    readStringAtPath(value, ["profile", "phone"]),
    readStringAtPath(value, ["profile", "phone_number"]),
  );
  return candidate ? normalizeWhatsAppPhoneNumber(candidate) : "";
}

function mergeStorageJsonObjects(...values: unknown[]): Record<string, unknown> {
  return values.reduce<Record<string, unknown>>((merged, value) => {
    const objectValue = normalizeStorageJsonObject(value) as Record<string, unknown>;
    return { ...merged, ...objectValue };
  }, {});
}

function normalizeStorageProvider(value: unknown): MessagingProvider {
  return value === "kirimdev" ? "kirimdev" : "meta";
}

function normalizeStorageSource(value: unknown): "webhook" | "api" {
  return value === "api" ? "api" : "webhook";
}

function normalizeStorageDirection(value: unknown): "inbound" | "outbound" {
  return value === "outbound" ? "outbound" : "inbound";
}

function mapConversationRecordToDbRow(record: MetaConversationRecord) {
  const raw = normalizeStorageJsonObject(record.raw) as Record<string, unknown>;
  const contactAvatarUrl = record.contactAvatarUrl || resolveWhatsAppProfilePhotoUrl(raw);
  const storageRaw = contactAvatarUrl ? { ...raw, contactAvatarUrl } : raw;

  return {
    id: record.id,
    channel_id: record.channelId,
    source: record.source || "webhook",
    contact_id: record.contactId,
    entry_id: record.entryId,
    object_type: record.objectType,
    provider: record.provider || "meta",
    contact_name: record.contactName || null,
    contact_phone: record.contactPhone || null,
    last_message_at: record.lastMessageAt,
    last_message_text: record.lastMessageText,
    last_direction: record.lastDirection,
    last_status: record.lastStatus || null,
    last_has_attachment: Boolean(record.lastHasAttachment),
    conversation_status: record.conversationStatus || null,
    unread_count: record.unreadCount || 0,
    raw: storageRaw,
    updated_at: record.updatedAt,
  };
}

function mapDbRowToConversationRecord(row: any): MetaConversationRecord {
  const raw = normalizeStorageJsonObject(row.raw);
  const contactPhone = row.contact_phone || resolveWhatsAppContactPhoneFromRaw(raw) || null;
  const contactId = row.contact_id || contactPhone || "";
  const contactName = row.contact_name || resolveWhatsAppContactNameFromRaw(raw) || null;
  return {
    id: row.id,
    channelId: row.channel_id,
    source: normalizeStorageSource(row.source),
    contactId,
    entryId: row.entry_id || null,
    objectType: row.object_type || null,
    provider: normalizeStorageProvider(row.provider),
    contactName,
    contactPhone,
    contactAvatarUrl: resolveWhatsAppProfilePhotoUrl(raw),
    lastMessageAt: row.last_message_at,
    lastMessageText: row.last_message_text || null,
    lastDirection: normalizeStorageDirection(row.last_direction),
    lastStatus: normalizeDeliveryStatus(row.last_status),
    lastHasAttachment: Boolean(row.last_has_attachment),
    conversationStatus: row.conversation_status || null,
    unreadCount: row.unread_count || 0,
    updatedAt: row.updated_at || row.last_message_at,
    raw,
  };
}

function mapMessageRecordToDbRow(record: MetaMessageRecord) {
  return {
    id: record.id,
    conversation_id: record.conversationId,
    channel_id: record.channelId,
    source: record.source || "webhook",
    contact_id: record.contactId,
    entry_id: record.entryId,
    object_type: record.objectType,
    provider: record.provider || "meta",
    direction: record.direction,
    event_type: record.eventType,
    text: record.text,
    attachments: normalizeStorageJsonArray(record.attachments),
    media_url: record.mediaUrl || null,
    status: record.status || null,
    timestamp: record.timestamp,
    raw: normalizeStorageJsonObject(record.raw),
  };
}

function mapDbRowToMessageRecord(row: any): MetaMessageRecord {
  return {
    id: row.id,
    channelId: row.channel_id,
    conversationId: row.conversation_id,
    source: normalizeStorageSource(row.source),
    contactId: row.contact_id,
    entryId: row.entry_id || null,
    objectType: row.object_type || null,
    provider: normalizeStorageProvider(row.provider),
    direction: normalizeStorageDirection(row.direction),
    eventType: row.event_type || "message",
    text: row.text || null,
    attachments: normalizeStorageJsonArray(row.attachments),
    mediaUrl: row.media_url || null,
    status: normalizeDeliveryStatus(row.status),
    timestamp: row.timestamp,
    raw: normalizeStorageJsonObject(row.raw),
  };
}

type StoredMessageReadOptions = {
  limit?: number;
  before?: string | null;
  since?: string | null;
  descending?: boolean;
};

function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function isValidTimestampFilter(value: string | null | undefined) {
  if (!value) return false;
  return Number.isFinite(new Date(value).getTime());
}

function normalizeIsoTimestampFilter(value: string | null | undefined) {
  if (!isValidTimestampFilter(value)) return null;
  return new Date(value as string).toISOString();
}

function getIsoTimestampDaysAgo(days: unknown, fallbackDays: number) {
  const parsed = Number(days);
  const finalDays =
    Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 365) : fallbackDays;
  return new Date(Date.now() - finalDays * 24 * 60 * 60 * 1000).toISOString();
}

function sortMessagesAscending(messages: MetaMessageRecord[]) {
  return [...messages].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function filterStoredMessages(
  messages: MetaMessageRecord[],
  options?: StoredMessageReadOptions,
) {
  return messages.filter((message) => {
    if (isValidTimestampFilter(options?.before) && message.timestamp >= String(options?.before)) {
      return false;
    }
    if (isValidTimestampFilter(options?.since) && message.timestamp < String(options?.since)) {
      return false;
    }
    return true;
  });
}

async function listConversationsFromDatabase() {
  try {
    const supabase = resolveSupabaseAdminClient();
    const rows: any[] = [];
    const pageSize = 1000;
    const maxRows = 50000;
    for (let from = 0; from < maxRows; from += pageSize) {
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .order("last_message_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    return rows.map(mapDbRowToConversationRecord);
  } catch (error: any) {
    if (!isSupabaseSchemaError(error)) {
      console.warn("WhatsApp DB conversation list fallback to KV.", error);
    }
    return [] as MetaConversationRecord[];
  }
}

async function getConversationFromDatabase(conversationId: string) {
  try {
    const supabase = resolveSupabaseAdminClient();
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapDbRowToConversationRecord(data) : null;
  } catch (error: any) {
    if (!isSupabaseSchemaError(error)) {
      console.warn("WhatsApp DB conversation lookup fallback to KV.", error);
    }
    return null;
  }
}

async function listMessagesFromDatabase(
  conversationId?: string,
  options?: StoredMessageReadOptions,
) {
  try {
    const supabase = resolveSupabaseAdminClient();
    const limit = clampPositiveInteger(options?.limit, 10000, 10000);
    let query = supabase
      .from("whatsapp_messages")
      .select("*")
      .order("timestamp", { ascending: !options?.descending })
      .limit(limit);
    if (conversationId) query = query.eq("conversation_id", conversationId);
    if (isValidTimestampFilter(options?.before)) {
      query = query.lt("timestamp", options?.before as string);
    }
    if (isValidTimestampFilter(options?.since)) {
      query = query.gte("timestamp", options?.since as string);
    }
    const { data, error } = await query;
    if (error) throw error;
    return sortMessagesAscending((data || []).map(mapDbRowToMessageRecord));
  } catch (error: any) {
    if (!isSupabaseSchemaError(error)) {
      console.warn("WhatsApp DB message list fallback to KV.", error);
    }
    return [] as MetaMessageRecord[];
  }
}

async function listMessagesForConversationsFromDatabase(
  conversationIds: string[],
  options?: StoredMessageReadOptions,
) {
  const uniqueConversationIds = Array.from(new Set(conversationIds.filter(Boolean)));
  if (uniqueConversationIds.length === 0) return [] as MetaMessageRecord[];

  try {
    const supabase = resolveSupabaseAdminClient();
    const chunks = chunkArray(uniqueConversationIds, 100);
    const rows: MetaMessageRecord[] = [];
    const limit = clampPositiveInteger(options?.limit, 20000, 50000);

    for (const chunk of chunks) {
      let query = supabase
        .from("whatsapp_messages")
        .select("*")
        .in("conversation_id", chunk)
        .order("timestamp", { ascending: !options?.descending })
        .limit(limit);
      if (isValidTimestampFilter(options?.before)) {
        query = query.lt("timestamp", options?.before as string);
      }
      if (isValidTimestampFilter(options?.since)) {
        query = query.gte("timestamp", options?.since as string);
      }
      const { data, error } = await query;
      if (error) throw error;
      rows.push(...(data || []).map(mapDbRowToMessageRecord));
    }

    return sortMessagesAscending(rows);
  } catch (error: any) {
    if (!isSupabaseSchemaError(error)) {
      console.warn("WhatsApp DB message batch list fallback to KV.", error);
    }
    return [] as MetaMessageRecord[];
  }
}

function mergeConversationRecords(
  primary: MetaConversationRecord[],
  fallback: MetaConversationRecord[],
) {
  const rows = new Map<string, MetaConversationRecord>();
  for (const row of fallback) rows.set(row.id, row);
  for (const row of primary) rows.set(row.id, row);
  return Array.from(rows.values()).sort((left, right) =>
    right.lastMessageAt.localeCompare(left.lastMessageAt),
  );
}

function mergeMessageRecords(primary: MetaMessageRecord[], fallback: MetaMessageRecord[]) {
  const rows = new Map<string, MetaMessageRecord>();
  for (const row of fallback) rows.set(`${row.conversationId}:${row.id}`, row);
  for (const row of primary) rows.set(`${row.conversationId}:${row.id}`, row);
  return Array.from(rows.values()).sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
}

function limitMergedMessages(messages: MetaMessageRecord[], limit?: number) {
  const finalLimit = clampPositiveInteger(limit, messages.length || 1, 10000);
  if (messages.length <= finalLimit) return messages;
  return sortMessagesAscending(messages).slice(-finalLimit);
}

async function listConversations() {
  const [dbRows, kvRows] = await Promise.all([
    listConversationsFromDatabase(),
    kv.getByPrefix("meta_messaging_conversation:"),
  ]);
  return mergeConversationRecords(dbRows, kvRows as MetaConversationRecord[]);
}

async function getStoredConversation(conversationId: string) {
  return (
    (await getConversationFromDatabase(conversationId)) ||
    ((await kv.get(buildConversationStorageKey(conversationId))) as MetaConversationRecord | null)
  );
}

async function listMessagesForConversation(
  conversationId: string,
  options?: StoredMessageReadOptions,
) {
  const queryLimit = options?.limit ? clampPositiveInteger(options.limit, 100, 10000) : undefined;
  const dbRows = await listMessagesFromDatabase(conversationId, {
    ...options,
    limit: queryLimit,
  });
  if (dbRows.length > 0) return limitMergedMessages(dbRows, options?.limit);

  const kvRows = await kv.getByPrefix(`meta_messaging_message:${conversationId}:`);
  const filteredKvRows = filterStoredMessages(kvRows as MetaMessageRecord[], options);
  return limitMergedMessages(filteredKvRows, options?.limit);
}

async function listMessagesForConversations(
  conversationIds: string[],
  options?: StoredMessageReadOptions,
) {
  const uniqueConversationIds = Array.from(new Set(conversationIds.filter(Boolean)));
  if (uniqueConversationIds.length === 0) return [] as MetaMessageRecord[];

  const dbRows = await listMessagesForConversationsFromDatabase(uniqueConversationIds, options);
  if (dbRows.length > 0) return dbRows;

  const conversationIdSet = new Set(uniqueConversationIds);
  const kvRows = filterStoredMessages(
    ((await kv.getByPrefix("meta_messaging_message:")) as MetaMessageRecord[])
      .filter((message) => conversationIdSet.has(message.conversationId)),
    options,
  );
  return sortMessagesAscending(kvRows);
}

type DailyTrackedPlatform = "instagram" | "facebook_page";

type DailyInboxBucket = {
  date: string;
  inboundMessages: number;
  newConversations: number;
  uniqueContacts: number;
  instagramInboundMessages: number;
  instagramNewConversations: number;
  instagramUniqueContacts: number;
  messengerInboundMessages: number;
  messengerNewConversations: number;
  messengerUniqueContacts: number;
};

type DailyInboxAccumulator = DailyInboxBucket & {
  uniqueContactSet: Set<string>;
  instagramUniqueContactSet: Set<string>;
  messengerUniqueContactSet: Set<string>;
};

function formatJakartaDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function shiftDateKey(dateKey: string, offsetDays: number) {
  const anchor = new Date(`${dateKey}T12:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() + offsetDays);
  return anchor.toISOString().slice(0, 10);
}

function createDailyInboxAccumulator(date: string): DailyInboxAccumulator {
  return {
    date,
    inboundMessages: 0,
    newConversations: 0,
    uniqueContacts: 0,
    instagramInboundMessages: 0,
    instagramNewConversations: 0,
    instagramUniqueContacts: 0,
    messengerInboundMessages: 0,
    messengerNewConversations: 0,
    messengerUniqueContacts: 0,
    uniqueContactSet: new Set<string>(),
    instagramUniqueContactSet: new Set<string>(),
    messengerUniqueContactSet: new Set<string>(),
  };
}

function finalizeDailyInboxBucket(accumulator: DailyInboxAccumulator): DailyInboxBucket {
  return {
    date: accumulator.date,
    inboundMessages: accumulator.inboundMessages,
    newConversations: accumulator.newConversations,
    uniqueContacts: accumulator.uniqueContactSet.size,
    instagramInboundMessages: accumulator.instagramInboundMessages,
    instagramNewConversations: accumulator.instagramNewConversations,
    instagramUniqueContacts: accumulator.instagramUniqueContactSet.size,
    messengerInboundMessages: accumulator.messengerInboundMessages,
    messengerNewConversations: accumulator.messengerNewConversations,
    messengerUniqueContacts: accumulator.messengerUniqueContactSet.size,
  };
}

function resolveStoredMessagePlatform(
  message: Pick<MetaMessageRecord, "channelId" | "objectType">,
  channels: MetaMessagingChannel[],
): DailyTrackedPlatform | null {
  const channel = resolveConversationChannel(channels, message);
  if (channel?.platform === "instagram" || channel?.platform === "facebook_page") {
    return channel.platform;
  }

  if (message.objectType === "instagram") return "instagram";
  if (message.objectType === "page" || message.channelId.startsWith("page:")) {
    return "facebook_page";
  }

  return null;
}

async function buildDailyInboxStats(days: number, channels: MetaMessagingChannel[]) {
  const clampedDays = Math.max(7, Math.min(90, Math.floor(days) || 30));
  const messageRows = await kv.getByPrefix("meta_messaging_message:");
  const messages = messageRows as MetaMessageRecord[];
  const todayKey = formatJakartaDateKey(new Date().toISOString()) || new Date().toISOString().slice(0, 10);

  const dateKeys = Array.from({ length: clampedDays }, (_, index) =>
    shiftDateKey(todayKey, -(clampedDays - index - 1))
  );
  const dateKeySet = new Set(dateKeys);
  const bucketMap = new Map<string, DailyInboxAccumulator>(
    dateKeys.map((dateKey) => [dateKey, createDailyInboxAccumulator(dateKey)]),
  );
  const todaySummaryAccumulator = createDailyInboxAccumulator(todayKey);
  const yesterdaySummaryAccumulator = createDailyInboxAccumulator(shiftDateKey(todayKey, -1));
  const last7SummaryAccumulator = createDailyInboxAccumulator(todayKey);
  const last7DateKeys = new Set(dateKeys.slice(-7));

  const firstInboundByConversation = new Map<
    string,
    { dateKey: string; platform: DailyTrackedPlatform; contactId: string; timestamp: string }
  >();

  let latestStoredEventAt: string | null = null;

  for (const message of messages) {
    if (message.direction !== "inbound") continue;

    const platform = resolveStoredMessagePlatform(message, channels);
    if (!platform) continue;

    if (!latestStoredEventAt || message.timestamp > latestStoredEventAt) {
      latestStoredEventAt = message.timestamp;
    }

    const dateKey = formatJakartaDateKey(message.timestamp);
    if (dateKey) {
      const existingFirstInbound = firstInboundByConversation.get(message.conversationId);
      if (!existingFirstInbound || message.timestamp < existingFirstInbound.timestamp) {
        firstInboundByConversation.set(message.conversationId, {
          dateKey,
          platform,
          contactId: message.contactId,
          timestamp: message.timestamp,
        });
      }
    }

    if (!dateKey || !dateKeySet.has(dateKey)) {
      continue;
    }

    const bucket = bucketMap.get(dateKey);
    if (!bucket) continue;

    bucket.inboundMessages += 1;
    bucket.uniqueContactSet.add(message.contactId);

    if (platform === "instagram") {
      bucket.instagramInboundMessages += 1;
      bucket.instagramUniqueContactSet.add(message.contactId);
    } else {
      bucket.messengerInboundMessages += 1;
      bucket.messengerUniqueContactSet.add(message.contactId);
    }

    const summaryTargets = [
      dateKey === todayKey ? todaySummaryAccumulator : null,
      dateKey === shiftDateKey(todayKey, -1) ? yesterdaySummaryAccumulator : null,
      last7DateKeys.has(dateKey) ? last7SummaryAccumulator : null,
    ].filter((item): item is DailyInboxAccumulator => Boolean(item));

    for (const summaryTarget of summaryTargets) {
      summaryTarget.inboundMessages += 1;
      summaryTarget.uniqueContactSet.add(message.contactId);

      if (platform === "instagram") {
        summaryTarget.instagramInboundMessages += 1;
        summaryTarget.instagramUniqueContactSet.add(message.contactId);
      } else {
        summaryTarget.messengerInboundMessages += 1;
        summaryTarget.messengerUniqueContactSet.add(message.contactId);
      }
    }

  }

  for (const firstInbound of firstInboundByConversation.values()) {
    if (!dateKeySet.has(firstInbound.dateKey)) continue;
    const bucket = bucketMap.get(firstInbound.dateKey);
    if (!bucket) continue;

    bucket.newConversations += 1;
    if (firstInbound.platform === "instagram") {
      bucket.instagramNewConversations += 1;
    } else {
      bucket.messengerNewConversations += 1;
    }

    if (firstInbound.dateKey === todayKey) {
      todaySummaryAccumulator.newConversations += 1;
      if (firstInbound.platform === "instagram") {
        todaySummaryAccumulator.instagramNewConversations += 1;
      } else {
        todaySummaryAccumulator.messengerNewConversations += 1;
      }
    }

    if (firstInbound.dateKey === shiftDateKey(todayKey, -1)) {
      yesterdaySummaryAccumulator.newConversations += 1;
      if (firstInbound.platform === "instagram") {
        yesterdaySummaryAccumulator.instagramNewConversations += 1;
      } else {
        yesterdaySummaryAccumulator.messengerNewConversations += 1;
      }
    }

    if (last7DateKeys.has(firstInbound.dateKey)) {
      last7SummaryAccumulator.newConversations += 1;
      if (firstInbound.platform === "instagram") {
        last7SummaryAccumulator.instagramNewConversations += 1;
      } else {
        last7SummaryAccumulator.messengerNewConversations += 1;
      }
    }
  }

  const dayBuckets = dateKeys
    .map((dateKey) => finalizeDailyInboxBucket(bucketMap.get(dateKey) || createDailyInboxAccumulator(dateKey)))
    .sort((left, right) => right.date.localeCompare(left.date));
  const today = finalizeDailyInboxBucket(todaySummaryAccumulator);
  const yesterday = finalizeDailyInboxBucket(yesterdaySummaryAccumulator);
  const last7Days = finalizeDailyInboxBucket(last7SummaryAccumulator);

  return {
    timezone: "Asia/Jakarta",
    generatedAt: new Date().toISOString(),
    rangeDays: clampedDays,
    latestStoredEventAt,
    summary: {
      today,
      yesterday,
      last7Days,
    },
    days: dayBuckets,
  };
}

async function upsertConversation(record: MetaConversationRecord) {
  const storageKey = buildConversationStorageKey(record.id);
  const existing = (await kv.get(storageKey)) as MetaConversationRecord | null;
  const raw = mergeStorageJsonObjects(existing?.raw, record.raw);
  const contactAvatarUrl =
    record.contactAvatarUrl ||
    resolveWhatsAppProfilePhotoUrl(record.raw) ||
    existing?.contactAvatarUrl ||
    resolveWhatsAppProfilePhotoUrl(existing?.raw) ||
    resolveWhatsAppProfilePhotoUrl(raw);
  const mergedRecord: MetaConversationRecord = {
    ...record,
    contactAvatarUrl,
    raw: contactAvatarUrl ? { ...raw, contactAvatarUrl } : raw,
  };

  try {
    const supabase = resolveSupabaseAdminClient();
    const { error } = await supabase
      .from("whatsapp_conversations")
      .upsert(mapConversationRecordToDbRow(mergedRecord), { onConflict: "id" });
    if (error) throw error;
  } catch (error: any) {
    if (!isSupabaseSchemaError(error)) {
      console.warn("WhatsApp DB conversation upsert skipped.", error);
    }
  }
  await kv.set(storageKey, mergedRecord);
}

async function upsertMessage(record: MetaMessageRecord) {
  try {
    const supabase = resolveSupabaseAdminClient();
    const { error } = await supabase
      .from("whatsapp_messages")
      .upsert(mapMessageRecordToDbRow(record), { onConflict: "conversation_id,id" });
    if (error) throw error;
  } catch (error: any) {
    if (!isSupabaseSchemaError(error)) {
      console.warn("WhatsApp DB message upsert skipped.", error);
    }
  }
  await kv.set(buildMessageStorageKey(record.conversationId, record.id), record);
}

function inferMessageText(event: any) {
  if (typeof event?.message?.text === "string" && event.message.text.trim()) {
    return event.message.text.trim();
  }
  if (typeof event?.postback?.title === "string" && event.postback.title.trim()) {
    return event.postback.title.trim();
  }
  return null;
}

function inferEventType(event: any) {
  if (event?.message) return "message";
  if (event?.postback) return "postback";
  if (event?.delivery) return "delivery";
  if (event?.read) return "read";
  if (event?.reaction) return "reaction";
  return "unknown";
}

function inferMessageId(event: any) {
  return (
    event?.message?.mid ||
    event?.postback?.mid ||
    event?.delivery?.mids?.[0] ||
    event?.reaction?.mid ||
    `${event?.sender?.id || "unknown"}:${event?.timestamp || Date.now()}`
  );
}

function inferAttachments(event: any) {
  if (Array.isArray(event?.message?.attachments)) return event.message.attachments;
  return [];
}

function inferWhatsAppMessageText(message: any) {
  if (typeof message?.text?.body === "string" && message.text.body.trim()) {
    return message.text.body.trim();
  }
  if (typeof message?.button?.text === "string" && message.button.text.trim()) {
    return message.button.text.trim();
  }
  if (typeof message?.button?.payload === "string" && message.button.payload.trim()) {
    return message.button.payload.trim();
  }
  if (
    typeof message?.interactive?.button_reply?.title === "string" &&
    message.interactive.button_reply.title.trim()
  ) {
    return message.interactive.button_reply.title.trim();
  }
  if (
    typeof message?.interactive?.list_reply?.title === "string" &&
    message.interactive.list_reply.title.trim()
  ) {
    return message.interactive.list_reply.title.trim();
  }
  if (typeof message?.image?.caption === "string" && message.image.caption.trim()) {
    return message.image.caption.trim();
  }
  if (typeof message?.document?.caption === "string" && message.document.caption.trim()) {
    return message.document.caption.trim();
  }
  if (typeof message?.video?.caption === "string" && message.video.caption.trim()) {
    return message.video.caption.trim();
  }
  return null;
}

function inferWhatsAppAttachments(message: any) {
  const type = typeof message?.type === "string" ? message.type : null;
  if (!type || type === "text") return [];
  const payload = message?.[type];
  if (payload && typeof payload === "object") {
    return [{ type, ...payload }];
  }
  return [{ type }];
}

async function ensureWhatsAppChannel({
  phoneNumberId,
  displayPhoneNumber,
  receivedAt,
  field,
  provider = "meta",
}: {
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  receivedAt: string;
  field: string | null;
  provider?: MessagingProvider;
}) {
  const channelId = `whatsapp:${phoneNumberId}`;
  const existingChannel = await kv.get(buildChannelKey(channelId)) as MetaMessagingChannel | null;
  const mergedFields = Array.from(
    new Set([...(existingChannel?.subscribedFields || []), ...(field ? [field] : [])]),
  );
  const nextChannel: MetaMessagingChannel = {
    id: channelId,
    platform: "whatsapp",
    // Once a number is seen via Kirimdev it stays attributed to Kirimdev; a plain
    // Meta webhook should not silently downgrade the provider label.
    provider: provider === "kirimdev" ? "kirimdev" : existingChannel?.provider || "meta",
    pageId: phoneNumberId,
    pageName: existingChannel?.pageName || displayPhoneNumber || phoneNumberId,
    whatsappPhoneNumberId: phoneNumberId,
    whatsappDisplayPhoneNumber: displayPhoneNumber || existingChannel?.whatsappDisplayPhoneNumber || null,
    tasks: existingChannel?.tasks || [],
    supportsMessaging: true,
    subscribedFields: mergedFields,
    accessToken: existingChannel?.accessToken || "",
    updatedAt: receivedAt,
  };
  await kv.set(buildChannelKey(channelId), nextChannel);
}

function mapWhatsAppContactRecordToDbRow(record: WhatsAppContactRecord, contactKey: string) {
  const raw = normalizeStorageJsonObject(record.raw) as Record<string, unknown>;
  const avatarUrl = record.avatarUrl || resolveWhatsAppProfilePhotoUrl(raw);
  const storageRaw = avatarUrl ? { ...raw, avatarUrl } : raw;

  return {
    channel_id: record.channelId,
    contact_key: contactKey,
    id: record.id,
    provider: record.provider,
    phone_number_id: record.phoneNumberId,
    phone_number: record.phoneNumber,
    name: record.name,
    email: record.email || null,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    raw: storageRaw,
  };
}

function mapDbRowToWhatsAppContactRecord(row: any): WhatsAppContactRecord {
  const raw = normalizeStorageJsonObject(row.raw);
  return {
    id: row.id,
    provider: normalizeStorageProvider(row.provider),
    channelId: row.channel_id,
    phoneNumberId: row.phone_number_id || null,
    phoneNumber: row.phone_number || null,
    name: row.name || null,
    email: row.email || null,
    avatarUrl: resolveWhatsAppProfilePhotoUrl(raw),
    raw,
    createdAt: row.created_at || row.updated_at || null,
    updatedAt: row.updated_at,
  };
}

async function getWhatsAppContactFromDatabase(channelId: string, contactKey: string) {
  try {
    const supabase = resolveSupabaseAdminClient();
    const { data, error } = await supabase
      .from("whatsapp_contacts")
      .select("*")
      .eq("channel_id", channelId)
      .eq("contact_key", contactKey)
      .maybeSingle();
    if (error) throw error;
    return data ? mapDbRowToWhatsAppContactRecord(data) : null;
  } catch (error: any) {
    if (!isSupabaseSchemaError(error)) {
      console.warn("WhatsApp DB contact lookup fallback to KV.", error);
    }
    return null;
  }
}

async function listWhatsAppContactsFromDatabase() {
  try {
    const supabase = resolveSupabaseAdminClient();
    const rows: any[] = [];
    const pageSize = 1000;
    const maxRows = 50000;
    for (let from = 0; from < maxRows; from += pageSize) {
      const { data, error } = await supabase
        .from("whatsapp_contacts")
        .select("*")
        .order("updated_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    return rows.map(mapDbRowToWhatsAppContactRecord);
  } catch (error: any) {
    if (!isSupabaseSchemaError(error)) {
      console.warn("WhatsApp DB contact list fallback to KV.", error);
    }
    return [] as WhatsAppContactRecord[];
  }
}

function mergeWhatsAppContactRecords(
  primary: WhatsAppContactRecord[],
  fallback: WhatsAppContactRecord[],
) {
  const rows = new Map<string, WhatsAppContactRecord>();
  const mergeContact = (
    existing: WhatsAppContactRecord | null | undefined,
    next: WhatsAppContactRecord,
  ): WhatsAppContactRecord => {
    const raw = mergeStorageJsonObjects(existing?.raw, next.raw);
    const avatarUrl =
      next.avatarUrl ||
      resolveWhatsAppProfilePhotoUrl(next.raw) ||
      existing?.avatarUrl ||
      resolveWhatsAppProfilePhotoUrl(existing?.raw) ||
      resolveWhatsAppProfilePhotoUrl(raw);

    return {
      ...existing,
      ...next,
      name: next.name || existing?.name || null,
      email: next.email ?? existing?.email ?? null,
      avatarUrl,
      raw: avatarUrl ? { ...raw, avatarUrl } : raw,
      createdAt: existing?.createdAt || next.createdAt || next.updatedAt,
      updatedAt:
        next.updatedAt && existing?.updatedAt
          ? next.updatedAt > existing.updatedAt
            ? next.updatedAt
            : existing.updatedAt
          : next.updatedAt || existing?.updatedAt || next.createdAt || new Date().toISOString(),
    };
  };

  for (const row of fallback) {
    const key = `${row.channelId}:${row.phoneNumber || row.id}`;
    rows.set(key, mergeContact(rows.get(key), row));
  }
  for (const row of primary) {
    const key = `${row.channelId}:${row.phoneNumber || row.id}`;
    rows.set(key, mergeContact(rows.get(key), row));
  }
  return Array.from(rows.values()).sort((left, right) =>
    (right.updatedAt || "").localeCompare(left.updatedAt || ""),
  );
}

async function upsertWhatsAppContact(record: WhatsAppContactRecord) {
  const contactKey = record.phoneNumber || record.id;
  if (!contactKey) return;
  const storageKey = buildWhatsAppContactStorageKey(record.channelId, contactKey);
  const existing =
    (await getWhatsAppContactFromDatabase(record.channelId, contactKey)) ||
    ((await kv.get(storageKey)) as WhatsAppContactRecord | null);
  const raw = mergeStorageJsonObjects(existing?.raw, record.raw);
  const avatarUrl =
    record.avatarUrl ||
    resolveWhatsAppProfilePhotoUrl(record.raw) ||
    existing?.avatarUrl ||
    resolveWhatsAppProfilePhotoUrl(existing?.raw) ||
    resolveWhatsAppProfilePhotoUrl(raw);
  const merged = {
    ...record,
    name: record.name || existing?.name || null,
    email: record.email ?? existing?.email ?? null,
    avatarUrl,
    raw: avatarUrl ? { ...raw, avatarUrl } : raw,
    createdAt: existing?.createdAt || record.createdAt || record.updatedAt,
  };
  try {
    const supabase = resolveSupabaseAdminClient();
    const { error } = await supabase
      .from("whatsapp_contacts")
      .upsert(mapWhatsAppContactRecordToDbRow(merged, contactKey), {
        onConflict: "channel_id,contact_key",
      });
    if (error) throw error;
  } catch (error: any) {
    if (!isSupabaseSchemaError(error)) {
      console.warn("WhatsApp DB contact upsert skipped.", error);
    }
  }
  await kv.set(storageKey, merged);
}

async function listWhatsAppContacts() {
  const [dbRows, kvRows] = await Promise.all([
    listWhatsAppContactsFromDatabase(),
    kv.getByPrefix("whatsapp_contact:"),
  ]);
  return mergeWhatsAppContactRecords(dbRows, kvRows as WhatsAppContactRecord[]);
}

function resolveWhatsAppAccountOwnerForChannel(
  channel: MetaMessagingChannel | null,
  ownerByPhoneNumber: Map<string, WhatsAppAccountOwnerView>,
) {
  if (!channel) return null;
  const ownerKey = firstComparableWhatsAppPhoneNumber(
    channel.whatsappDisplayPhoneNumber,
    channel.pageName,
    channel.whatsappPhoneNumberId,
    channel.pageId,
    getPhoneNumberIdFromChannelId(channel.id),
  );
  return ownerKey ? ownerByPhoneNumber.get(ownerKey) || null : null;
}

async function listWhatsAppContactViews() {
  const [contacts, channels, ownerByPhoneNumber] = await Promise.all([
    listWhatsAppContacts(),
    listStoredChannels(),
    buildWhatsAppAccountOwnerByPhoneNumber(),
  ]);
  const channelById = new Map(
    channels
      .filter((channel) => channel.platform === "whatsapp")
      .map((channel) => [channel.id, channel]),
  );

  return contacts.map((contact): WhatsAppContactView => {
    const { raw: _raw, ...publicContact } = contact;
    const channel = channelById.get(contact.channelId) || null;
    const accountOwner = resolveWhatsAppAccountOwnerForChannel(channel, ownerByPhoneNumber);
    return {
      ...publicContact,
      accountLabel: channel ? formatChannelLabel(channel) : null,
      accountPhoneNumber: channel?.whatsappDisplayPhoneNumber || null,
      csProfileId: accountOwner?.id || null,
      csDisplayName: accountOwner?.displayName || null,
      csWhatsappNumber: accountOwner?.whatsappNumber || null,
      csAssignmentStatus: accountOwner?.assignmentStatus || null,
    };
  });
}

function scopeWhatsAppContactViewsForRequester(
  contacts: WhatsAppContactView[],
  requester: RequesterAccessContext | null | undefined,
) {
  if (requester?.role !== "CS") return contacts;

  const requesterProfileId = requester.profile?.id || requester.authUser?.id || "";
  if (!requesterProfileId) return [];

  return contacts.filter((contact) => contact.csProfileId === requesterProfileId);
}

function scopeWhatsAppChannelsForRequester(
  channels: MetaMessagingChannel[],
  ownerByPhoneNumber: Map<string, WhatsAppAccountOwnerView>,
  requester: RequesterAccessContext | null | undefined,
) {
  if (requester?.role !== "CS") return channels;

  const requesterProfileId = requester.profile?.id || requester.authUser?.id || "";
  if (!requesterProfileId) return [];

  return channels.filter((channel) => {
    const owner = resolveWhatsAppAccountOwnerForChannel(channel, ownerByPhoneNumber);
    return owner?.id === requesterProfileId;
  });
}

function scopeWhatsAppConversationsForRequester(
  conversations: MetaConversationRecord[],
  channels: MetaMessagingChannel[],
  ownerByPhoneNumber: Map<string, WhatsAppAccountOwnerView>,
  requester: RequesterAccessContext | null | undefined,
) {
  if (requester?.role !== "CS") return conversations;

  const requesterProfileId = requester.profile?.id || requester.authUser?.id || "";
  if (!requesterProfileId) return [];

  const channelById = new Map(channels.map((channel) => [channel.id, channel]));
  return conversations.filter((conversation) => {
    const channel = channelById.get(conversation.channelId) || null;
    const owner = resolveWhatsAppAccountOwnerForChannel(channel, ownerByPhoneNumber);
    return owner?.id === requesterProfileId;
  });
}

async function listWhatsAppBroadcasts(limit = 25) {
  const rows = (await kv.getByPrefix("whatsapp_broadcast:")) as WhatsAppBroadcastRecord[];
  return rows
    .sort((left, right) => (right.createdAt || "").localeCompare(left.createdAt || ""))
    .slice(0, clampPositiveInteger(limit, 25, 100));
}

function normalizeWhatsAppPhoneNumber(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\D/g, "");
}

function normalizeComparableWhatsAppPhoneNumber(value: unknown) {
  const normalized = normalizeWhatsAppPhoneNumber(value);
  if (!normalized) return "";
  if (normalized.startsWith("0")) return `62${normalized.slice(1)}`;
  if (normalized.startsWith("8")) return `62${normalized}`;
  return normalized;
}

const AUTO_WHATSAPP_LEAD_ORIGIN = "auto_wa_api";
const AUTO_WHATSAPP_LEAD_LAST_CONTACT = "Auto WA API";
const AUTO_WHATSAPP_LEAD_START_AT = "2026-06-21T19:00:00.000Z";

function cleanObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as Partial<T>;
}

function isSupabaseSchemaError(error: any) {
  const text = [
    error?.message,
    error?.details,
    error?.hint,
    error?.error_description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("schema cache") ||
    text.includes("column") ||
    text.includes("relationship") ||
    text.includes("does not exist") ||
    text.includes("origin") ||
    text.includes("embed_form") ||
    text.includes("utm_")
  );
}

function buildAutoWhatsAppLeadId() {
  const timePart = Date.now().toString(36).toUpperCase().slice(-4);
  const randomPart = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `WA${timePart}${randomPart}`;
}

function formatPhoneForLead(comparablePhone: string) {
  if (comparablePhone.startsWith("62")) return `0${comparablePhone.slice(2)}`;
  return comparablePhone;
}

function truncateText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

async function resolveWhatsAppChannelOwnerId(channelId: string) {
  const channel = (await kv.get(buildChannelKey(channelId))) as MetaMessagingChannel | null;
  const ownerByPhoneNumber = await buildWhatsAppAccountOwnerByPhoneNumber();
  return resolveWhatsAppAccountOwnerForChannel(channel, ownerByPhoneNumber)?.id || null;
}

async function listLeadRowsByComparablePhone(
  supabase: SupabaseAdminClient,
  comparablePhone: string,
) {
  const phoneTail = comparablePhone.slice(-9);
  if (!phoneTail) return [] as any[];

  const queryByTail = (selectColumns: string) => supabase
    .from("leads")
    .select(selectColumns)
    .ilike("phone", `%${phoneTail}%`)
    .limit(100);

  let { data, error } = await queryByTail("id,name,phone,cs_id,status,created_at,origin,notes");
  if (error && isSupabaseSchemaError(error)) {
    const fallback = await queryByTail("id,name,phone,cs_id,status,created_at,notes");
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.warn("Auto WA API lead lookup skipped.", error);
    return [] as any[];
  }

  return (data || []).filter(
    (row: any) => normalizeComparableWhatsAppPhoneNumber(row?.phone) === comparablePhone,
  );
}

async function resolveProfileLabelsById(
  supabase: SupabaseAdminClient,
  ids: string[],
) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map<string, string>();

  const { data, error } = await supabase
    .from("profiles")
    .select("id,name,email,cs_display_name")
    .in("id", uniqueIds);

  if (error) {
    console.warn("Auto WA API CS label lookup skipped.", error);
    return new Map<string, string>();
  }

  return new Map(
    (data || []).map((row: any) => [
      String(row.id),
      (typeof row.cs_display_name === "string" && row.cs_display_name.trim()) ||
        (typeof row.name === "string" && row.name.trim()) ||
        (typeof row.email === "string" && row.email.trim()) ||
        "CS",
    ]),
  );
}

function leadSchemaFallbackPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return cleanObject({
    id: payload.id,
    name: payload.name,
    phone: payload.phone,
    status: payload.status,
    notes: payload.notes,
    cs_id: payload.cs_id,
    last_contact: payload.last_contact,
    template_history: payload.template_history,
    created_at: payload.created_at,
  });
}

async function insertAutoWhatsAppLead(
  supabase: SupabaseAdminClient,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const result = await supabase.from("leads").insert(payload).select().single();
  if (!result.error) return result.data as Record<string, unknown> | null;

  if (!isSupabaseSchemaError(result.error)) {
    throw result.error;
  }

  const fallbackResult = await supabase
    .from("leads")
    .insert(leadSchemaFallbackPayload(payload))
    .select()
    .single();
  if (fallbackResult.error) throw fallbackResult.error;
  return fallbackResult.data as Record<string, unknown> | null;
}

async function autoCreateLeadFromWhatsAppInbound({
  provider,
  channelId,
  conversationId,
  contactName,
  contactPhone,
  messageText,
  timestamp,
}: {
  provider: MessagingProvider;
  channelId: string;
  conversationId: string;
  contactName: string | null;
  contactPhone: string | null;
  messageText: string | null;
  timestamp: string;
}) {
  try {
    const parsedTimestamp = Date.parse(timestamp);
    const parsedStartAt = Date.parse(AUTO_WHATSAPP_LEAD_START_AT);
    if (Number.isFinite(parsedTimestamp) && parsedTimestamp < parsedStartAt) {
      return { created: false, reason: "before_auto_wa_start" };
    }

    const comparablePhone = normalizeComparableWhatsAppPhoneNumber(contactPhone);
    if (!comparablePhone) return { created: false, reason: "missing_phone" };

    const supabase = resolveSupabaseAdminClient();
    const csOwnerId = await resolveWhatsAppChannelOwnerId(channelId);
    const existingLeads = await listLeadRowsByComparablePhone(supabase, comparablePhone);

    const hasSameCsOpenLead = existingLeads.some((lead: any) => {
      const sameCs = (lead?.cs_id || null) === (csOwnerId || null);
      const status = typeof lead?.status === "string" ? lead.status : "";
      return sameCs && status !== "Cancel" && status !== "Closing";
    });

    if (hasSameCsOpenLead) {
      return { created: false, reason: "existing_same_cs" };
    }

    const otherCsLeadRows = existingLeads.filter(
      (lead: any) => (lead?.cs_id || null) !== (csOwnerId || null),
    );
    const csLabels = await resolveProfileLabelsById(
      supabase,
      otherCsLeadRows.map((lead: any) => lead?.cs_id).filter(Boolean),
    );
    const duplicateLabels = Array.from(
      new Set(
        otherCsLeadRows.map((lead: any) => {
          const csLabel = lead?.cs_id ? csLabels.get(String(lead.cs_id)) : null;
          return csLabel || lead?.name || "CS lain";
        }),
      ),
    );

    const notes = [
      "Auto WA API - dibuat otomatis dari chat WhatsApp masuk.",
      `Provider: ${provider}. Conversation: ${conversationId}.`,
      messageText ? `Pesan awal: "${truncateText(messageText, 180)}"` : null,
      duplicateLabels.length > 0
        ? `Double client dengan ${duplicateLabels.join(", ")}. Nomor ini sudah pernah masuk sebagai prospek di CS lain.`
        : null,
      csOwnerId ? null : "CS belum terpetakan dari nomor WhatsApp penerima.",
    ]
      .filter(Boolean)
      .join("\n");

    const payload = cleanObject({
      id: buildAutoWhatsAppLeadId(),
      name: contactName || `WhatsApp ${formatPhoneForLead(comparablePhone)}`,
      phone: formatPhoneForLead(comparablePhone),
      status: "Pending",
      notes,
      cs_id: csOwnerId || null,
      last_contact: AUTO_WHATSAPP_LEAD_LAST_CONTACT,
      template_history: [],
      origin: AUTO_WHATSAPP_LEAD_ORIGIN,
      created_at: timestamp,
    });

    const lead = await insertAutoWhatsAppLead(supabase, payload);
    return { created: true, leadId: lead?.id || payload.id };
  } catch (error) {
    console.warn("Auto WA API lead create skipped.", error);
    return { created: false, reason: "error" };
  }
}

function firstNormalizedWhatsAppPhoneNumber(...values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeWhatsAppPhoneNumber(value);
    if (normalized) return normalized;
  }
  return "";
}

function firstComparableWhatsAppPhoneNumber(...values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeComparableWhatsAppPhoneNumber(value);
    if (normalized) return normalized;
  }
  return "";
}

async function buildWhatsAppAccountOwnerByPhoneNumber() {
  const result = new Map<string, WhatsAppAccountOwnerView>();
  try {
    const supabase = resolveSupabaseAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,email,phone,cs_whatsapp_number,cs_display_name,cs_assignment_status");
    if (error) throw error;

    for (const row of data || []) {
      const csWhatsappNumber = typeof row.cs_whatsapp_number === "string" ? row.cs_whatsapp_number.trim() : "";
      const fallbackPhone = typeof row.phone === "string" ? row.phone.trim() : "";
      const key = firstComparableWhatsAppPhoneNumber(csWhatsappNumber, fallbackPhone);
      if (!key) continue;

      const displayName =
        (typeof row.cs_display_name === "string" && row.cs_display_name.trim()) ||
        (typeof row.name === "string" && row.name.trim()) ||
        (typeof row.email === "string" && row.email.trim()) ||
        "CS";

      result.set(key, {
        id: String(row.id || ""),
        displayName,
        whatsappNumber: csWhatsappNumber || fallbackPhone,
        assignmentStatus:
          typeof row.cs_assignment_status === "string" && row.cs_assignment_status.trim()
            ? row.cs_assignment_status.trim()
            : null,
      });
    }
  } catch (error) {
    console.warn("Gagal memuat mapping CS WhatsApp untuk account dropdown.", error);
  }
  return result;
}

function getPhoneNumberIdFromChannelId(channelId: string) {
  return channelId.startsWith("whatsapp:") ? channelId.slice("whatsapp:".length).trim() : "";
}

function resolveKirimdevResponseData(payload: any) {
  return payload?.data && typeof payload.data === "object" ? payload.data : payload || {};
}

function resolveKirimdevMessageId(payload: any) {
  const data = resolveKirimdevResponseData(payload);
  return (
    (typeof data?.id === "string" && data.id.trim()) ||
    (typeof data?.message_id === "string" && data.message_id.trim()) ||
    (typeof data?.provider_message_id === "string" && data.provider_message_id.trim()) ||
    (Array.isArray(data?.messages) && typeof data.messages[0]?.id === "string"
      ? data.messages[0].id.trim()
      : "") ||
    `kirimdev:${crypto.randomUUID()}`
  );
}

function resolveKirimdevApiMessageId(row: any) {
  return (
    (typeof row?.message_id === "string" && row.message_id.trim()) ||
    (typeof row?.id === "string" && row.id.trim()) ||
    `kirimdev_api:${crypto.randomUUID()}`
  );
}

function inferKirimdevApiMessageText(row: any) {
  if (typeof row?.content === "string" && row.content.trim()) return row.content.trim();
  if (typeof row?.text === "string" && row.text.trim()) return row.text.trim();
  if (typeof row?.body === "string" && row.body.trim()) return row.body.trim();
  return null;
}

function inferKirimdevNativeMessageText(message: any, data: any) {
  return firstNonEmptyString(
    message?.body,
    message?.text,
    message?.content,
    message?.caption,
    message?.interactive?.button_reply?.title,
    message?.interactive?.list_reply?.title,
    data?.body,
    data?.text,
    data?.content,
  ) || null;
}

function inferKirimdevNativeMediaUrl(message: any, data: any) {
  return firstNonEmptyString(
    message?.media_url,
    message?.media?.url,
    message?.image?.url,
    message?.video?.url,
    message?.audio?.url,
    message?.document?.url,
    data?.media_url,
    data?.media?.url,
  ) || null;
}

function resolveKirimdevNativeMessageId(payload: any, message: any) {
  return firstNonEmptyString(
    message?.id,
    message?.message_id,
    message?.provider_id,
    message?.provider_message_id,
    payload?.message_id,
    payload?.id,
  ) || `kirimdev_native:${crypto.randomUUID()}`;
}

function resolveKirimdevNativePhoneNumberId(data: any) {
  return firstNonEmptyString(
    data?.meta?.phone_number_id,
    data?.phone_number_id,
    data?.account?.phone_number_id,
    data?.session?.phone_number_id,
    KIRIMDEV_PHONE_NUMBER_ID,
    data?.session,
  );
}

function resolveKirimdevNativeContactPhone(data: any, message: any) {
  return firstNormalizedWhatsAppPhoneNumber(
    data?.contact?.phone_number,
    data?.contact?.phone,
    data?.contact?.wa_id,
    data?.contact?.whatsapp_number,
    data?.customer?.phone_number,
    data?.customer?.phone,
    message?.from,
    message?.sender,
    data?.from,
  );
}

function resolveKirimdevNativeContactName(data: any) {
  return firstNonEmptyString(
    data?.contact?.name,
    data?.customer?.name,
    data?.profile?.name,
  ) || null;
}

function inferKirimdevApiMessageDirection(
  row: any,
  conversation: MetaConversationRecord,
): "inbound" | "outbound" {
  const rawDirection = typeof row?.direction === "string" ? row.direction.trim().toLowerCase() : "";
  if (rawDirection === "outbound" || rawDirection === "outgoing" || rawDirection === "sent") {
    return "outbound";
  }
  if (rawDirection === "inbound" || rawDirection === "incoming" || rawDirection === "received") {
    return "inbound";
  }

  if (row?.from_me === true || row?.is_from_me === true || row?.is_outbound === true) {
    return "outbound";
  }
  if (row?.from_me === false || row?.is_from_me === false || row?.is_inbound === true) {
    return "inbound";
  }

  const contactKey = getWhatsAppConversationContactKey(conversation);
  const toKey = firstNormalizedWhatsAppPhoneNumber(row?.to, row?.recipient, row?.recipient_phone_number);
  if (contactKey && toKey && contactKey === toKey) return "outbound";

  return "inbound";
}

function normalizeKirimdevTemplateStatus(value: unknown): WhatsAppTemplateView["status"] {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "pending" || normalized === "rejected") return normalized;
  return "approved";
}

function normalizeKirimdevTemplateVariables(row: any) {
  const fromVariables = asArray<string>(row?.variables)
    .map((value) => String(value || "").replace(/[{}]/g, "").trim())
    .filter(Boolean);
  if (fromVariables.length > 0) return Array.from(new Set(fromVariables));

  const content =
    typeof row?.content === "string"
      ? row.content
      : asArray<any>(row?.components)
          .map((component) => (typeof component?.text === "string" ? component.text : ""))
          .join("\n");
  const variables: string[] = [];
  const pattern = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
  let match: RegExpExecArray | null = null;
  while ((match = pattern.exec(content)) !== null) {
    if (match[1]) variables.push(match[1]);
  }
  return Array.from(new Set(variables));
}

function normalizeKirimdevTemplate(row: any, fallbackPhoneNumberId: string): WhatsAppTemplateView {
  const whatsappAccount = row?.whatsapp_account || {};
  const phoneNumberId =
    typeof whatsappAccount?.phone_number_id === "string" && whatsappAccount.phone_number_id.trim()
      ? whatsappAccount.phone_number_id.trim()
      : fallbackPhoneNumberId || null;
  const components = asArray(row?.components);
  const bodyComponent = components.find((component: any) => {
    const type = typeof component?.type === "string" ? component.type.toLowerCase() : "";
    return type === "body";
  });
  const content =
    typeof row?.content === "string" && row.content.trim()
      ? row.content.trim()
      : typeof bodyComponent?.text === "string" && bodyComponent.text.trim()
      ? bodyComponent.text.trim()
      : null;

  return {
    id:
      (typeof row?.id === "string" && row.id.trim()) ||
      `${phoneNumberId || "template"}:${row?.name || crypto.randomUUID()}:${row?.language || "id"}`,
    name: typeof row?.name === "string" ? row.name : "",
    language: typeof row?.language === "string" && row.language.trim() ? row.language.trim() : "id",
    status: normalizeKirimdevTemplateStatus(row?.status),
    category: typeof row?.category === "string" && row.category.trim() ? row.category.trim() : null,
    content,
    variables: normalizeKirimdevTemplateVariables({ ...row, content, components }),
    components,
    phoneNumberId,
    phoneNumber:
      typeof whatsappAccount?.phone_number === "string" && whatsappAccount.phone_number.trim()
        ? whatsappAccount.phone_number.trim()
        : KIRIMDEV_DISPLAY_PHONE_NUMBER || null,
    providerTemplateId:
      typeof row?.provider_template_id === "string" && row.provider_template_id.trim()
        ? row.provider_template_id.trim()
        : null,
    createdAt: typeof row?.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row?.updated_at === "string" ? row.updated_at : null,
    raw: row,
  };
}

async function listKirimdevTemplates(options: {
  phoneNumberId?: string | null;
  status?: string | null;
  language?: string | null;
  limit?: number;
  cursor?: string | null;
}) {
  const phoneNumberId = options.phoneNumberId?.trim() || KIRIMDEV_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error("KIRIMDEV_PHONE_NUMBER_ID belum dikonfigurasi di server.");
  }
  const status =
    typeof options.status === "string" && ["approved", "pending", "rejected", "all"].includes(options.status)
      ? options.status
      : "all";
  const payload = await fetchKirimdevJson(
    `/${encodeURIComponent(phoneNumberId)}/templates${buildQueryString({
      status,
      language: options.language?.trim() || null,
      limit: clampPositiveInteger(options.limit, 100, 100),
      cursor: options.cursor?.trim() || null,
    })}`,
  );
  const templates = asArray(payload?.data).map((row) => normalizeKirimdevTemplate(row, phoneNumberId));
  return {
    templates,
    hasMore: Boolean(payload?.has_more),
    nextCursor: typeof payload?.next_cursor === "string" ? payload.next_cursor : null,
    requestId: typeof payload?.request_id === "string" ? payload.request_id : null,
  };
}

function getKirimdevConversationId(conversation: MetaConversationRecord | null) {
  const raw = conversation?.raw as any;
  return (
    (typeof raw?.kirimdevConversationId === "string" && raw.kirimdevConversationId.trim()) ||
    (typeof raw?.conversation?.id === "string" && raw.conversation.id.trim()) ||
    ""
  );
}

function resolveKirimdevConversationContact(row: any) {
  const contact = row?.contact || {};
  const phoneNumber = firstNormalizedWhatsAppPhoneNumber(
    contact?.phone_number,
    contact?.phone,
    contact?.wa_id,
    contact?.whatsapp_number,
    row?.phone_number,
    row?.contact_phone_number,
    row?.customer?.phone_number,
  );
  const contactId =
    phoneNumber ||
    (typeof contact?.id === "string" && contact.id.trim() ? contact.id.trim() : "");
  const contactName =
    typeof contact?.name === "string" && contact.name.trim() ? contact.name.trim() : null;
  const contactAvatarUrl =
    resolveWhatsAppProfilePhotoUrl(row) ||
    resolveWhatsAppProfilePhotoUrl(contact) ||
    null;

  return { contactId, phoneNumber: phoneNumber || null, contactName, contactAvatarUrl };
}

async function ingestKirimdevApiConversation(
  row: any,
  fallbackPhoneNumberId: string,
  receivedAt: string,
) {
  const phoneNumberId =
    (typeof row?.whatsapp_account?.phone_number_id === "string" &&
      row.whatsapp_account.phone_number_id.trim()) ||
    fallbackPhoneNumberId ||
    "";
  if (!phoneNumberId) return null;

  const displayPhoneNumber =
    typeof row?.whatsapp_account?.phone_number === "string" && row.whatsapp_account.phone_number
      ? row.whatsapp_account.phone_number
      : KIRIMDEV_DISPLAY_PHONE_NUMBER || null;
  const { contactId, phoneNumber, contactName, contactAvatarUrl } =
    resolveKirimdevConversationContact(row);
  if (!contactId) return null;

  const channelId = `whatsapp:${phoneNumberId}`;
  const conversationId = buildConversationKey(channelId, contactId);
  const kirimdevConversationId =
    typeof row?.id === "string" && row.id.trim() ? row.id.trim() : null;
  const timestamp =
    typeof row?.last_message_at === "string" && row.last_message_at
      ? row.last_message_at
      : typeof row?.updated_at === "string" && row.updated_at
      ? row.updated_at
      : typeof row?.created_at === "string" && row.created_at
      ? row.created_at
      : receivedAt;

  await ensureWhatsAppChannel({
    phoneNumberId,
    displayPhoneNumber,
    receivedAt,
    field: "messages",
    provider: "kirimdev",
  });

  const existingConversation = await getStoredConversation(conversationId);
  const resolvedContactAvatarUrl =
    contactAvatarUrl ||
    existingConversation?.contactAvatarUrl ||
    resolveWhatsAppProfilePhotoUrl(existingConversation?.raw) ||
    null;
  const keepExistingLast =
    Boolean(existingConversation?.lastMessageAt) &&
    existingConversation!.lastMessageAt > timestamp &&
    Boolean(existingConversation?.lastMessageText);

  const conversationRecord: MetaConversationRecord = {
    id: conversationId,
    channelId,
    source: existingConversation?.source || "api",
    contactId,
    entryId: phoneNumberId,
    objectType: "whatsapp_business_account",
    provider: "kirimdev",
    contactName: contactName || existingConversation?.contactName || null,
    contactPhone: phoneNumber || existingConversation?.contactPhone || contactId,
    contactAvatarUrl: resolvedContactAvatarUrl,
    lastMessageAt: keepExistingLast ? existingConversation!.lastMessageAt : timestamp,
    lastMessageText: keepExistingLast ? existingConversation!.lastMessageText : existingConversation?.lastMessageText || null,
    lastDirection: keepExistingLast ? existingConversation!.lastDirection : existingConversation?.lastDirection || "inbound",
    lastStatus: keepExistingLast ? existingConversation!.lastStatus || null : existingConversation?.lastStatus || null,
    lastHasAttachment: existingConversation?.lastHasAttachment || false,
    conversationStatus:
      typeof row?.status === "string" && row.status.trim()
        ? row.status.trim()
        : existingConversation?.conversationStatus || null,
    unreadCount: Number.isFinite(Number(row?.unread_count))
      ? Number(row.unread_count)
      : existingConversation?.unreadCount || 0,
    updatedAt: receivedAt,
    raw: {
      ...(typeof existingConversation?.raw === "object" && existingConversation.raw
        ? (existingConversation.raw as Record<string, unknown>)
        : {}),
      source: "kirimdev_api",
      kirimdevConversationId,
      contactAvatarUrl: resolvedContactAvatarUrl,
      conversation: row,
    },
  };

  await upsertConversation(conversationRecord);
  await upsertWhatsAppContact({
    id: contactId,
    provider: "kirimdev",
    channelId,
    phoneNumberId,
    phoneNumber: phoneNumber || contactId,
    name: contactName,
    avatarUrl: resolvedContactAvatarUrl,
    raw: {
      source: "kirimdev_api",
      contact: row?.contact || null,
      avatarUrl: resolvedContactAvatarUrl,
    },
    createdAt: typeof row?.created_at === "string" ? row.created_at : timestamp,
    updatedAt: receivedAt,
  });

  return conversationRecord;
}

async function ingestKirimdevApiMessage(
  row: any,
  conversation: MetaConversationRecord,
  receivedAt: string,
) {
  const timestamp =
    typeof row?.created_at === "string" && row.created_at ? row.created_at : receivedAt;
  const direction = inferKirimdevApiMessageDirection(row, conversation);
  const mediaUrl =
    typeof row?.media_url === "string" && row.media_url.trim() ? row.media_url.trim() : null;
  const type = typeof row?.type === "string" && row.type.trim() ? row.type.trim() : "message";
  const text = inferKirimdevApiMessageText(row);
  const attachments = mediaUrl ? [{ type, url: mediaUrl }] : [];
  const status = normalizeDeliveryStatus(row?.status) || null;

  const messageRecord: MetaMessageRecord = {
    id: resolveKirimdevApiMessageId(row),
    channelId: conversation.channelId,
    conversationId: conversation.id,
    source: "api",
    contactId: conversation.contactId,
    entryId: conversation.entryId,
    objectType: "whatsapp_business_account",
    provider: "kirimdev",
    direction,
    eventType: `kirimdev_api_${type}`,
    text,
    attachments,
    mediaUrl,
    status,
    timestamp,
    raw: {
      source: "kirimdev_api",
      kirimdevConversationId: getKirimdevConversationId(conversation),
      message: row,
    },
  };

  await upsertMessage(messageRecord);

  const existingConversation = await getStoredConversation(conversation.id);
  const shouldUpdateLast =
    !existingConversation?.lastMessageAt || timestamp >= existingConversation.lastMessageAt;

  if (shouldUpdateLast) {
    await upsertConversation({
      ...(existingConversation || conversation),
      source: existingConversation?.source || conversation.source || "api",
      lastMessageAt: timestamp,
      lastMessageText: text,
      lastDirection: direction,
      lastStatus: status,
      lastHasAttachment: attachments.length > 0,
      updatedAt: receivedAt,
    });
  }

  if (direction === "inbound") {
    await autoCreateLeadFromWhatsAppInbound({
      provider: "kirimdev",
      channelId: conversation.channelId,
      conversationId: conversation.id,
      contactName: conversation.contactName || null,
      contactPhone: conversation.contactPhone || conversation.contactId,
      messageText: text,
      timestamp,
    });
  }

  return messageRecord;
}

async function syncKirimdevMessagesForConversation(
  conversation: MetaConversationRecord,
  options?: { limit?: number; maxPages?: number; since?: string | null; until?: string | null },
) {
  const phoneNumberId =
    getPhoneNumberIdFromChannelId(conversation.channelId) || KIRIMDEV_PHONE_NUMBER_ID;
  const kirimdevConversationId = getKirimdevConversationId(conversation);
  if (!phoneNumberId || !kirimdevConversationId) {
    return { synced: 0, hasMore: false, nextCursor: null as string | null };
  }

  const limit = clampPositiveInteger(options?.limit, 50, 100);
  const maxPages = clampPositiveInteger(options?.maxPages, 1, 100);
  const since = normalizeIsoTimestampFilter(options?.since);
  const until = normalizeIsoTimestampFilter(options?.until);
  let cursor: string | null = null;
  let synced = 0;
  let hasMore = false;
  let nextCursor: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const payload = await fetchKirimdevJson(
      `/${encodeURIComponent(phoneNumberId)}/messages${buildQueryString({
        conversation_id: kirimdevConversationId,
        created_after: since,
        created_before: until,
        limit,
        cursor,
      })}`,
    );
    const rows = asArray(payload?.data);
    for (const row of rows) {
      await ingestKirimdevApiMessage(row, conversation, new Date().toISOString());
      synced += 1;
    }
    hasMore = Boolean(payload?.has_more);
    nextCursor = typeof payload?.next_cursor === "string" ? payload.next_cursor : null;
    if (!hasMore || !nextCursor) break;
    cursor = nextCursor;
  }

  return { synced, hasMore, nextCursor };
}

async function syncKirimdevConversations(options: KirimdevSyncOptions = {}) {
  const receivedAt = new Date().toISOString();
  const accountPayload = await fetchKirimdevJson("/accounts");
  const accountRows = asArray(accountPayload?.data);
  const requestedPhoneNumberId = options.phoneNumberId?.trim() || null;
  const accounts = accountRows.filter((row: any) => {
    const phoneNumberId =
      typeof row?.phone_number_id === "string" && row.phone_number_id.trim()
        ? row.phone_number_id.trim()
        : "";
    return requestedPhoneNumberId ? phoneNumberId === requestedPhoneNumberId : Boolean(phoneNumberId);
  });

  const fallbackPhoneNumberId = requestedPhoneNumberId || KIRIMDEV_PHONE_NUMBER_ID;
  if (!accounts.length && fallbackPhoneNumberId) {
    accounts.push({
      phone_number_id: fallbackPhoneNumberId,
      phone_number: KIRIMDEV_DISPLAY_PHONE_NUMBER || null,
      status: "configured",
    });
  }

  const conversationLimit = clampPositiveInteger(options.conversationLimit, 100, 100);
  const maxPages = clampPositiveInteger(options.maxPages, 1, 100);
  const messageLimit = clampPositiveInteger(options.messageLimit, 25, 100);
  const messageMaxPages = clampPositiveInteger(options.messageMaxPages, 1, 100);
  const includeMessages = options.includeMessages === true;
  const since = normalizeIsoTimestampFilter(options.since);
  const until = normalizeIsoTimestampFilter(options.until);
  const requestedCursor = options.cursor?.trim() || null;
  let conversationCount = 0;
  let messageCount = 0;
  let hasMore = false;
  let nextCursor: string | null = null;

  for (const account of accounts) {
    const phoneNumberId =
      typeof account?.phone_number_id === "string" && account.phone_number_id.trim()
        ? account.phone_number_id.trim()
        : fallbackPhoneNumberId || "";
    if (!phoneNumberId) continue;

    await ensureWhatsAppChannel({
      phoneNumberId,
      displayPhoneNumber:
        typeof account?.phone_number === "string" && account.phone_number
          ? account.phone_number
          : KIRIMDEV_DISPLAY_PHONE_NUMBER || null,
      receivedAt,
      field: "messages",
      provider: "kirimdev",
    });

    let cursor = requestedPhoneNumberId ? requestedCursor : null;
    for (let page = 0; page < maxPages; page += 1) {
      const payload = await fetchKirimdevJson(
        `/${encodeURIComponent(phoneNumberId)}/conversations${buildQueryString({
          updated_since: since,
          limit: conversationLimit,
          cursor,
        })}`,
      );
      const rows = asArray(payload?.data);
      for (const row of rows) {
        const conversation = await ingestKirimdevApiConversation(row, phoneNumberId, receivedAt);
        if (!conversation) continue;
        conversationCount += 1;
        if (includeMessages) {
          const result = await syncKirimdevMessagesForConversation(conversation, {
            limit: messageLimit,
            maxPages: messageMaxPages,
            since,
            until,
          });
          messageCount += result.synced;
        }
      }
      const pageHasMore = Boolean(payload?.has_more);
      hasMore = hasMore || pageHasMore;
      const accountNextCursor = typeof payload?.next_cursor === "string" ? payload.next_cursor : null;
      nextCursor = requestedPhoneNumberId ? accountNextCursor : nextCursor || accountNextCursor;
      if (!pageHasMore || !accountNextCursor) break;
      cursor = accountNextCursor;
    }
  }

  return {
    receivedAt,
    accounts: accounts.length,
    conversations: conversationCount,
    messages: messageCount,
    hasMore,
    nextCursor,
  };
}

async function hydrateKirimdevConversationForContact(
  conversation: MetaConversationRecord,
  options?: { maxPages?: number },
) {
  const phoneNumberId =
    getPhoneNumberIdFromChannelId(conversation.channelId) || KIRIMDEV_PHONE_NUMBER_ID;
  const contactKey = getWhatsAppConversationContactKey(conversation);
  if (!phoneNumberId || !contactKey) return null;

  const limit = 100;
  const maxPages = clampPositiveInteger(options?.maxPages, 6, 10);
  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const payload = await fetchKirimdevJson(
      `/${encodeURIComponent(phoneNumberId)}/conversations${buildQueryString({
        limit,
        cursor,
      })}`,
    );
    const rows = asArray(payload?.data);
    for (const row of rows) {
      const candidateContact = resolveKirimdevConversationContact(row);
      const candidateKey =
        normalizeWhatsAppPhoneNumber(candidateContact.phoneNumber) ||
        normalizeWhatsAppPhoneNumber(candidateContact.contactId) ||
        String(candidateContact.contactId || "").trim().toLowerCase();
      if (candidateKey !== contactKey) continue;

      return await ingestKirimdevApiConversation(row, phoneNumberId, new Date().toISOString());
    }

    const hasMore = Boolean(payload?.has_more);
    const nextCursor = typeof payload?.next_cursor === "string" ? payload.next_cursor : null;
    if (!hasMore || !nextCursor) break;
    cursor = nextCursor;
  }

  return null;
}

async function sendKirimdevTextMessage(input: KirimdevSendTextInput): Promise<KirimdevSendResult> {
  const phoneNumberId = input.phoneNumberId.trim();
  const to = normalizeWhatsAppPhoneNumber(input.to);
  const text = input.text.trim();
  if (!phoneNumberId || !to || !text) {
    throw new Error("phoneNumberId, tujuan, dan isi pesan WhatsApp wajib diisi.");
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body: text },
  };
  if (input.replyToMessageId && input.replyToMessageId.trim()) {
    payload.context = { message_id: input.replyToMessageId.trim() };
  }

  const response = await fetchKirimdevJson(`/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      "Idempotency-Key": input.idempotencyKey?.trim() || crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  });

  const now = new Date().toISOString();
  const channelId = `whatsapp:${phoneNumberId}`;
  const conversationId = buildConversationKey(channelId, to);
  const messageData = resolveKirimdevResponseData(response);
  const status = normalizeDeliveryStatus(messageData?.status) || "pending";

  await ensureWhatsAppChannel({
    phoneNumberId,
    displayPhoneNumber: KIRIMDEV_DISPLAY_PHONE_NUMBER || null,
    receivedAt: now,
    field: "messages",
    provider: "kirimdev",
  });

  const existingConversation = await getStoredConversation(conversationId);

  const messageRecord: MetaMessageRecord = {
    id: resolveKirimdevMessageId(response),
    channelId,
    conversationId,
    contactId: to,
    entryId: phoneNumberId,
    objectType: "whatsapp_business_account",
    provider: "kirimdev",
    direction: "outbound",
    eventType: "kirimdev_text_send",
    text,
    attachments: [],
    mediaUrl: null,
    status,
    timestamp: now,
    raw: {
      sentAt: now,
      request: {
        ...payload,
        text: { body: text },
      },
      response,
    },
  };

  const conversationRecord: MetaConversationRecord = {
    id: conversationId,
    channelId,
    contactId: to,
    entryId: phoneNumberId,
    objectType: "whatsapp_business_account",
    provider: "kirimdev",
    contactName: existingConversation?.contactName || null,
    contactPhone: existingConversation?.contactPhone || to,
    lastMessageAt: now,
    lastMessageText: text,
    lastDirection: "outbound",
    lastStatus: status,
    lastHasAttachment: false,
    conversationStatus: existingConversation?.conversationStatus || null,
    unreadCount: existingConversation?.unreadCount || 0,
    updatedAt: now,
  };

  await upsertMessage(messageRecord);
  await upsertConversation(conversationRecord);
  await upsertWhatsAppContact({
    id: to,
    provider: "kirimdev",
    channelId,
    phoneNumberId,
    phoneNumber: to,
    name: existingConversation?.contactName || null,
    createdAt: existingConversation?.lastMessageAt || now,
    updatedAt: now,
  });

  return {
    response,
    message: messageRecord,
    conversation: conversationRecord,
  };
}

async function sendKirimdevMediaMessage(input: KirimdevSendMediaInput): Promise<KirimdevSendResult> {
  const phoneNumberId = input.phoneNumberId.trim();
  const to = normalizeWhatsAppPhoneNumber(input.to);
  const mediaUrl = input.mediaUrl.trim();
  const caption = input.caption?.trim() || "";
  const fileName = input.fileName?.trim() || "";
  const mimeType = input.mimeType?.trim() || null;
  if (!phoneNumberId || !to || !mediaUrl || !mediaUrl.startsWith("https://")) {
    throw new Error("phoneNumberId, tujuan, dan URL media WhatsApp wajib valid.");
  }

  const mediaPayload: Record<string, unknown> = {
    link: mediaUrl,
  };
  if (input.type !== "audio" && caption) {
    mediaPayload.caption = caption.slice(0, 1024);
  }
  if (input.type === "document" && fileName) {
    mediaPayload.filename = fileName.slice(0, 255);
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: input.type,
    [input.type]: mediaPayload,
  };
  if (input.replyToMessageId && input.replyToMessageId.trim()) {
    payload.context = { message_id: input.replyToMessageId.trim() };
  }

  const response = await fetchKirimdevJson(`/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      "Idempotency-Key": input.idempotencyKey?.trim() || crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  });

  const now = new Date().toISOString();
  const channelId = `whatsapp:${phoneNumberId}`;
  const conversationId = buildConversationKey(channelId, to);
  const messageData = resolveKirimdevResponseData(response);
  const status = normalizeDeliveryStatus(messageData?.status) || "pending";
  const label =
    caption ||
    fileName ||
    (input.type === "image"
      ? "Gambar"
      : input.type === "video"
      ? "Video"
      : input.type === "audio"
      ? "Audio"
      : "Dokumen");

  await ensureWhatsAppChannel({
    phoneNumberId,
    displayPhoneNumber: KIRIMDEV_DISPLAY_PHONE_NUMBER || null,
    receivedAt: now,
    field: "messages",
    provider: "kirimdev",
  });

  const existingConversation = await getStoredConversation(conversationId);

  const attachment = {
    type: input.type,
    url: mediaUrl,
    mime_type: mimeType,
    filename: fileName || null,
    caption: caption || null,
  };

  const messageRecord: MetaMessageRecord = {
    id: resolveKirimdevMessageId(response),
    channelId,
    conversationId,
    contactId: to,
    entryId: phoneNumberId,
    objectType: "whatsapp_business_account",
    provider: "kirimdev",
    direction: "outbound",
    eventType: `kirimdev_${input.type}_send`,
    text: caption || null,
    attachments: [attachment],
    mediaUrl,
    status,
    timestamp: now,
    raw: {
      sentAt: now,
      request: payload,
      response,
    },
  };

  const conversationRecord: MetaConversationRecord = {
    id: conversationId,
    channelId,
    contactId: to,
    entryId: phoneNumberId,
    objectType: "whatsapp_business_account",
    provider: "kirimdev",
    contactName: existingConversation?.contactName || null,
    contactPhone: existingConversation?.contactPhone || to,
    lastMessageAt: now,
    lastMessageText: label,
    lastDirection: "outbound",
    lastStatus: status,
    lastHasAttachment: true,
    conversationStatus: existingConversation?.conversationStatus || null,
    unreadCount: existingConversation?.unreadCount || 0,
    updatedAt: now,
  };

  await upsertMessage(messageRecord);
  await upsertConversation(conversationRecord);
  await upsertWhatsAppContact({
    id: to,
    provider: "kirimdev",
    channelId,
    phoneNumberId,
    phoneNumber: to,
    name: existingConversation?.contactName || null,
    createdAt: existingConversation?.lastMessageAt || now,
    updatedAt: now,
  });

  return {
    response,
    message: messageRecord,
    conversation: conversationRecord,
  };
}

function buildKirimdevTemplateComponents(parameters: KirimdevTemplateParameter[] = []) {
  const normalized = parameters
    .map((parameter) => ({
      name: typeof parameter.name === "string" ? parameter.name.replace(/[{}]/g, "").trim() : "",
      text: typeof parameter.text === "string" ? parameter.text.trim() : "",
    }))
    .filter((parameter) => parameter.text);

  if (normalized.length === 0) return undefined;

  const useNamedParameters = normalized.every(
    (parameter) => parameter.name && !/^\d+$/.test(parameter.name),
  );

  return [
    {
      type: "body",
      parameters: normalized.map((parameter) => {
        const base = { type: "text", text: parameter.text };
        return useNamedParameters
          ? { ...base, parameter_name: parameter.name }
          : base;
      }),
    },
  ];
}

function resolveBroadcastBodyParametersForRecipient(
  parameters: KirimdevTemplateParameter[],
  recipient: { phoneNumber: string; name: string | null },
  campaignName: string,
) {
  return parameters.map((parameter) => ({
    ...parameter,
    text: parameter.text
      .replace(/{{\s*contact_name\s*}}/gi, recipient.name || recipient.phoneNumber)
      .replace(/{{\s*phone_number\s*}}/gi, recipient.phoneNumber)
      .replace(/{{\s*campaign_name\s*}}/gi, campaignName),
  }));
}

async function sendKirimdevTemplateMessage(
  input: KirimdevSendTemplateInput,
): Promise<KirimdevSendResult> {
  const phoneNumberId = input.phoneNumberId.trim();
  const to = normalizeWhatsAppPhoneNumber(input.to);
  const templateName = input.templateName.trim();
  const language = input.language.trim() || "id";
  if (!phoneNumberId || !to || !templateName) {
    throw new Error("phoneNumberId, tujuan, dan template WhatsApp wajib diisi.");
  }

  const template: Record<string, unknown> = {
    name: templateName,
    language,
  };
  const components = buildKirimdevTemplateComponents(input.bodyParameters || []);
  if (components) {
    template.components = components;
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template,
  };

  const response = await fetchKirimdevJson(`/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      "Idempotency-Key": input.idempotencyKey?.trim() || crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  });

  const now = new Date().toISOString();
  const channelId = `whatsapp:${phoneNumberId}`;
  const conversationId = buildConversationKey(channelId, to);
  const messageData = resolveKirimdevResponseData(response);
  const status = normalizeDeliveryStatus(messageData?.status) || "pending";
  const text = `Template: ${templateName}`;

  await ensureWhatsAppChannel({
    phoneNumberId,
    displayPhoneNumber: KIRIMDEV_DISPLAY_PHONE_NUMBER || null,
    receivedAt: now,
    field: "messages",
    provider: "kirimdev",
  });

  const existingConversation = await getStoredConversation(conversationId);

  const messageRecord: MetaMessageRecord = {
    id: resolveKirimdevMessageId(response),
    channelId,
    conversationId,
    contactId: to,
    entryId: phoneNumberId,
    objectType: "whatsapp_business_account",
    provider: "kirimdev",
    direction: "outbound",
    eventType: "kirimdev_template_send",
    text,
    attachments: [],
    mediaUrl: null,
    status,
    timestamp: now,
    raw: {
      sentAt: now,
      request: payload,
      response,
    },
  };

  const conversationRecord: MetaConversationRecord = {
    id: conversationId,
    channelId,
    contactId: to,
    entryId: phoneNumberId,
    objectType: "whatsapp_business_account",
    provider: "kirimdev",
    contactName: existingConversation?.contactName || null,
    contactPhone: existingConversation?.contactPhone || to,
    lastMessageAt: now,
    lastMessageText: text,
    lastDirection: "outbound",
    lastStatus: status,
    lastHasAttachment: false,
    conversationStatus: existingConversation?.conversationStatus || null,
    unreadCount: existingConversation?.unreadCount || 0,
    updatedAt: now,
  };

  await upsertMessage(messageRecord);
  await upsertConversation(conversationRecord);
  await upsertWhatsAppContact({
    id: to,
    provider: "kirimdev",
    channelId,
    phoneNumberId,
    phoneNumber: to,
    name: existingConversation?.contactName || null,
    createdAt: existingConversation?.lastMessageAt || now,
    updatedAt: now,
  });

  return {
    response,
    message: messageRecord,
    conversation: conversationRecord,
  };
}

async function ingestMessagingEvent({
  objectType,
  entry,
  event,
  receivedAt,
}: {
  objectType: string | null;
  entry: any;
  event: any;
  receivedAt: string;
}) {
  const entryId = entry?.id ? String(entry.id) : null;
  const senderId = event?.sender?.id ? String(event.sender.id) : null;
  const recipientId = event?.recipient?.id ? String(event.recipient.id) : null;
  const channelId = objectType === "instagram"
    ? `instagram:${entryId || recipientId || ""}`
    : `page:${entryId || recipientId || ""}`;

  const isOutbound = recipientId === entryId || Boolean(event?.message?.is_echo);
  const contactId = isOutbound ? recipientId : senderId;
  if (!entryId || !contactId) {
    return false;
  }

  const conversationId = buildConversationKey(channelId, contactId);
  const timestamp = toIsoTimestamp(event?.timestamp);
  const text = inferMessageText(event);

  const messageRecord: MetaMessageRecord = {
    id: inferMessageId(event),
    channelId,
    conversationId,
    contactId,
    entryId,
    objectType,
    direction: isOutbound ? "outbound" : "inbound",
    eventType: inferEventType(event),
    text,
    attachments: inferAttachments(event),
    timestamp,
    raw: {
      receivedAt,
      event,
    },
  };

  const existingConversation = await getStoredConversation(conversationId);

  const conversationRecord: MetaConversationRecord = {
    id: conversationId,
    channelId,
    contactId,
    entryId,
    objectType,
    lastMessageAt: timestamp,
    lastMessageText: text,
    lastDirection: messageRecord.direction,
    unreadCount: isOutbound ? 0 : (existingConversation?.unreadCount || 0) + 1,
    updatedAt: receivedAt,
  };

  await upsertMessage(messageRecord);
  await upsertConversation(conversationRecord);
  return true;
}

function normalizeDeliveryStatus(value: unknown): MessageDeliveryStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "pending" ||
    normalized === "sent" ||
    normalized === "delivered" ||
    normalized === "read" ||
    normalized === "failed"
  ) {
    return normalized;
  }
  return null;
}

// Pulls a contact's display name from the Meta value.contacts[] block, optionally
// overridden by Kirimdev's `kirim.contact` enrichment (which carries a cleaner name).
function resolveWhatsAppContactProfile(
  value: any,
  contactId: string,
  enrichment: any,
): { name: string | null; phone: string | null; avatarUrl: string | null } {
  const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
  const matched =
    contacts.find((entry: any) => typeof entry?.wa_id === "string" && entry.wa_id === contactId) ||
    contacts[0] ||
    null;

  const enrichmentName =
    typeof enrichment?.contact?.name === "string" && enrichment.contact.name.trim()
      ? enrichment.contact.name.trim()
      : null;
  const profileName =
    typeof matched?.profile?.name === "string" && matched.profile.name.trim()
      ? matched.profile.name.trim()
      : null;
  const enrichmentPhone =
    typeof enrichment?.contact?.phone_number === "string" && enrichment.contact.phone_number.trim()
      ? enrichment.contact.phone_number.trim()
      : null;

  return {
    name: enrichmentName || profileName || null,
    phone: enrichmentPhone || contactId || null,
    avatarUrl:
      resolveWhatsAppProfilePhotoUrl(enrichment) ||
      resolveWhatsAppProfilePhotoUrl(matched) ||
      resolveWhatsAppProfilePhotoUrl(value) ||
      null,
  };
}

async function ingestMetaWebhookPayload(
  payload: any,
  receivedAt: string,
  options?: { provider?: MessagingProvider; enrichment?: any },
) {
  const provider: MessagingProvider = options?.provider === "kirimdev" ? "kirimdev" : "meta";
  const enrichment = options?.enrichment || payload?.kirim || null;
  let processedEvents = 0;
  let processedStatuses = 0;

  if (!Array.isArray(payload?.entry)) {
    return { processedEvents, processedStatuses };
  }

  if (payload?.object === "whatsapp_business_account") {
    for (const entry of payload.entry) {
      if (!Array.isArray(entry?.changes)) continue;

      for (const change of entry.changes) {
        const field = typeof change?.field === "string" ? change.field : null;
        const value = change?.value || {};
        const metadata = value?.metadata || {};
        const phoneNumberId =
          typeof metadata?.phone_number_id === "string" && metadata.phone_number_id.trim()
            ? metadata.phone_number_id.trim()
            : typeof entry?.id === "string" && entry.id.trim()
            ? entry.id.trim()
            : null;

        if (!phoneNumberId) continue;

        const displayPhoneNumber =
          typeof metadata?.display_phone_number === "string"
            ? metadata.display_phone_number
            : null;

        await ensureWhatsAppChannel({
          phoneNumberId,
          displayPhoneNumber,
          receivedAt,
          field,
          provider,
        });

        const channelId = `whatsapp:${phoneNumberId}`;

        if (Array.isArray(value?.messages)) {
          for (const message of value.messages) {
            const contactId =
              typeof message?.from === "string" && message.from.trim() ? message.from.trim() : null;
            const messageId =
              typeof message?.id === "string" && message.id.trim() ? message.id.trim() : null;
            if (!contactId || !messageId) continue;

            const conversationId = buildConversationKey(channelId, contactId);
            const timestamp = toIsoTimestamp(message?.timestamp);
            const text = inferWhatsAppMessageText(message);
            const attachments = inferWhatsAppAttachments(message);
            const mediaUrl =
              typeof enrichment?.media_url === "string" && enrichment.media_url.trim()
                ? enrichment.media_url.trim()
                : null;
            const hasAttachment =
              (Array.isArray(attachments) && attachments.length > 0) || Boolean(mediaUrl);
            const profile = resolveWhatsAppContactProfile(value, contactId, enrichment);

            const messageRecord: MetaMessageRecord = {
              id: messageId,
              channelId,
              conversationId,
              contactId,
              entryId: typeof entry?.id === "string" ? entry.id : phoneNumberId,
              objectType: "whatsapp_business_account",
              provider,
              direction: "inbound",
              eventType: `whatsapp_${typeof message?.type === "string" ? message.type : "message"}`,
              text,
              attachments,
              mediaUrl,
              status: null,
              timestamp,
              raw: {
                receivedAt,
                entry,
                change,
                message,
                contacts: Array.isArray(value?.contacts) ? value.contacts : [],
                kirim: enrichment || undefined,
              },
            };

            const existingConversation = await getStoredConversation(conversationId);

            const conversationRecord: MetaConversationRecord = {
              id: conversationId,
              channelId,
              contactId,
              entryId: typeof entry?.id === "string" ? entry.id : phoneNumberId,
              objectType: "whatsapp_business_account",
              provider,
              contactName: profile.name || existingConversation?.contactName || null,
              contactPhone: profile.phone || existingConversation?.contactPhone || contactId,
              contactAvatarUrl:
                profile.avatarUrl ||
                existingConversation?.contactAvatarUrl ||
                resolveWhatsAppProfilePhotoUrl(existingConversation?.raw) ||
                null,
              lastMessageAt: timestamp,
              lastMessageText: text,
              lastDirection: "inbound",
              lastStatus: null,
              lastHasAttachment: hasAttachment,
              conversationStatus:
                typeof enrichment?.conversation?.status === "string"
                  ? enrichment.conversation.status
                  : existingConversation?.conversationStatus || null,
              unreadCount: (existingConversation?.unreadCount || 0) + 1,
              updatedAt: receivedAt,
            };

            await upsertMessage(messageRecord);
            await upsertConversation(conversationRecord);
            await upsertWhatsAppContact({
              id: contactId,
              provider,
              channelId,
              phoneNumberId,
              phoneNumber: profile.phone || contactId,
              name: profile.name,
              avatarUrl: profile.avatarUrl,
              raw: {
                source: "meta_webhook",
                contacts: Array.isArray(value?.contacts) ? value.contacts : [],
                kirim: enrichment || undefined,
                avatarUrl: profile.avatarUrl,
              },
              createdAt: timestamp,
              updatedAt: receivedAt,
            });
            await autoCreateLeadFromWhatsAppInbound({
              provider,
              channelId,
              conversationId,
              contactName: profile.name,
              contactPhone: profile.phone || contactId,
              messageText: text,
              timestamp,
            });
            processedEvents += 1;
          }
        }

        if (Array.isArray(value?.statuses)) {
          for (const status of value.statuses) {
            const contactId =
              typeof status?.recipient_id === "string" && status.recipient_id.trim()
                ? status.recipient_id.trim()
                : null;
            if (!contactId) continue;

            const conversationId = buildConversationKey(channelId, contactId);
            const timestamp = toIsoTimestamp(status?.timestamp);
            const statusValue = normalizeDeliveryStatus(status?.status) || "sent";

            const statusRecord: MetaMessageRecord = {
              id: `${status?.id || crypto.randomUUID()}:status:${statusValue}:${timestamp}`,
              channelId,
              conversationId,
              contactId,
              entryId: typeof entry?.id === "string" ? entry.id : phoneNumberId,
              objectType: "whatsapp_business_account",
              provider,
              direction: "outbound",
              eventType: `whatsapp_status_${statusValue}`,
              text: null,
              attachments: [],
              status: statusValue,
              timestamp,
              raw: {
                receivedAt,
                entry,
                change,
                status,
              },
            };

            const existingConversation = await getStoredConversation(conversationId);

            const conversationRecord: MetaConversationRecord = {
              id: conversationId,
              channelId,
              contactId,
              entryId: typeof entry?.id === "string" ? entry.id : phoneNumberId,
              objectType: "whatsapp_business_account",
              provider: existingConversation?.provider || provider,
              contactName: existingConversation?.contactName || null,
              contactPhone: existingConversation?.contactPhone || contactId,
              lastMessageAt: timestamp,
              lastMessageText: existingConversation?.lastMessageText || null,
              lastDirection: "outbound",
              lastStatus: statusValue,
              lastHasAttachment: existingConversation?.lastHasAttachment || false,
              conversationStatus: existingConversation?.conversationStatus || null,
              unreadCount: existingConversation?.unreadCount || 0,
              updatedAt: receivedAt,
            };

            await upsertMessage(statusRecord);
            await upsertConversation(conversationRecord);
            processedStatuses += 1;
          }
        }
      }
    }

    return { processedEvents, processedStatuses };
  }

  for (const entry of payload.entry) {
    if (Array.isArray(entry?.messaging)) {
      for (const event of entry.messaging) {
        const ingested = await ingestMessagingEvent({
          objectType: payload?.object ? String(payload.object) : null,
          entry,
          event,
          receivedAt,
        });
        if (ingested) processedEvents += 1;
      }
    }
  }

  return { processedEvents, processedStatuses };
}

// Handles Kirimdev "native" envelopes ({ id, type, created_at, data }) — i.e. the
// events Kirimdev does NOT forward as a raw Meta passthrough. The Meta-passthrough
// events (message.received / message.status) are routed through
// ingestMetaWebhookPayload instead so we reuse the existing WhatsApp ingestion.
async function ingestKirimdevNativeEvent(payload: any, receivedAt: string) {
  const type = typeof payload?.type === "string" ? payload.type : null;
  const data = payload?.data || {};
  if (!type) return { handled: false, type: null as string | null };

  if (type === "message.received" || type === "message.incoming") {
    const message = data?.message || asArray(data?.messages)[0] || {};
    const phoneNumberId = resolveKirimdevNativePhoneNumberId(data);
    const contactId = resolveKirimdevNativeContactPhone(data, message);
    const messageId = resolveKirimdevNativeMessageId(payload, message);
    if (!phoneNumberId || !contactId || !messageId) {
      return { handled: false, type };
    }

    const channelId = `whatsapp:${phoneNumberId}`;
    const conversationId = buildConversationKey(channelId, contactId);
    const timestamp = toIsoTimestamp(
      firstNonEmptyString(message?.timestamp, message?.created_at, data?.timestamp, data?.created_at, payload?.created_at),
    );
    const messageType = firstNonEmptyString(message?.type, data?.message_type) || "message";
    const text = inferKirimdevNativeMessageText(message, data);
    const mediaUrl = inferKirimdevNativeMediaUrl(message, data);
    const attachments = mediaUrl ? [{ type: messageType, url: mediaUrl }] : [];
    const contactName = resolveKirimdevNativeContactName(data);
    const contactAvatarUrl =
      resolveWhatsAppProfilePhotoUrl(data) ||
      resolveWhatsAppProfilePhotoUrl(payload) ||
      null;

    await ensureWhatsAppChannel({
      phoneNumberId,
      displayPhoneNumber:
        firstNonEmptyString(data?.meta?.display_phone_number, data?.account?.phone_number) ||
        KIRIMDEV_DISPLAY_PHONE_NUMBER ||
        null,
      receivedAt,
      field: "messages",
      provider: "kirimdev",
    });

    const existingConversation = await getStoredConversation(conversationId);

    const messageRecord: MetaMessageRecord = {
      id: messageId,
      channelId,
      conversationId,
      contactId,
      entryId: phoneNumberId,
      objectType: "whatsapp_business_account",
      provider: "kirimdev",
      direction: "inbound",
      eventType: `kirimdev_message_received_${messageType}`,
      text,
      attachments,
      mediaUrl,
      status: null,
      timestamp,
      raw: { receivedAt, payload },
    };

    const conversationRecord: MetaConversationRecord = {
      id: conversationId,
      channelId,
      contactId,
      entryId: phoneNumberId,
      objectType: "whatsapp_business_account",
      provider: "kirimdev",
      contactName: contactName || existingConversation?.contactName || null,
      contactPhone: existingConversation?.contactPhone || contactId,
      contactAvatarUrl:
        contactAvatarUrl ||
        existingConversation?.contactAvatarUrl ||
        resolveWhatsAppProfilePhotoUrl(existingConversation?.raw) ||
        null,
      lastMessageAt: timestamp,
      lastMessageText: text,
      lastDirection: "inbound",
      lastStatus: null,
      lastHasAttachment: attachments.length > 0,
      conversationStatus:
        typeof data?.conversation?.status === "string"
          ? data.conversation.status
          : existingConversation?.conversationStatus || null,
      unreadCount: (existingConversation?.unreadCount || 0) + 1,
      updatedAt: receivedAt,
    };

    await upsertMessage(messageRecord);
    await upsertConversation(conversationRecord);
    await upsertWhatsAppContact({
      id: contactId,
      provider: "kirimdev",
      channelId,
      phoneNumberId,
      phoneNumber: contactId,
      name: contactName,
      avatarUrl: contactAvatarUrl,
      raw: {
        source: "kirimdev_webhook",
        contact: data?.contact || null,
        avatarUrl: contactAvatarUrl,
      },
      createdAt: timestamp,
      updatedAt: receivedAt,
    });
    await autoCreateLeadFromWhatsAppInbound({
      provider: "kirimdev",
      channelId,
      conversationId,
      contactName,
      contactPhone: contactId,
      messageText: text,
      timestamp,
    });
    return { handled: true, type };
  }

  if (type === "message.sent") {
    const message = data?.message || {};
    // Prefer the real WhatsApp phone_number_id so outbound messages land on the
    // SAME channel as inbound (whatsapp:<phone_number_id>). data.session is only a
    // fallback — keep it below meta.phone_number_id to avoid splitting threads.
    const phoneNumberId =
      (typeof data?.meta?.phone_number_id === "string" && data.meta.phone_number_id.trim()) ||
      KIRIMDEV_PHONE_NUMBER_ID ||
      (typeof data?.session === "string" && data.session.trim()) ||
      "";
    const contactId =
      (typeof data?.contact?.phone_number === "string" && data.contact.phone_number.trim()) ||
      (typeof message?.to === "string" && message.to.trim()) ||
      null;
    const messageId =
      (typeof message?.id === "string" && message.id.trim()) ||
      (typeof message?.provider_id === "string" && message.provider_id.trim()) ||
      null;
    if (!phoneNumberId || !contactId || !messageId) {
      return { handled: false, type };
    }

    const channelId = `whatsapp:${phoneNumberId}`;
    const conversationId = buildConversationKey(channelId, contactId);
    const timestamp =
      typeof data?.timestamp === "string" && data.timestamp ? data.timestamp : receivedAt;
    const text =
      typeof message?.body === "string" && message.body.trim() ? message.body.trim() : null;
    const status = normalizeDeliveryStatus(message?.status) || "sent";
    const contactName =
      typeof data?.contact?.name === "string" && data.contact.name.trim()
        ? data.contact.name.trim()
        : null;
    const contactAvatarUrl =
      resolveWhatsAppProfilePhotoUrl(data) ||
      resolveWhatsAppProfilePhotoUrl(payload) ||
      null;

    await ensureWhatsAppChannel({
      phoneNumberId,
      displayPhoneNumber:
        typeof data?.meta?.display_phone_number === "string"
          ? data.meta.display_phone_number
          : null,
      receivedAt,
      field: "messages",
      provider: "kirimdev",
    });

    const messageRecord: MetaMessageRecord = {
      id: messageId,
      channelId,
      conversationId,
      contactId,
      entryId: phoneNumberId,
      objectType: "whatsapp_business_account",
      provider: "kirimdev",
      direction: "outbound",
      eventType: `kirimdev_message_sent_${typeof message?.type === "string" ? message.type : "text"}`,
      text,
      attachments: [],
      mediaUrl: null,
      status,
      timestamp,
      raw: { receivedAt, payload },
    };

    const existingConversation = await getStoredConversation(conversationId);

    const conversationRecord: MetaConversationRecord = {
      id: conversationId,
      channelId,
      contactId,
      entryId: phoneNumberId,
      objectType: "whatsapp_business_account",
      provider: "kirimdev",
      contactName: contactName || existingConversation?.contactName || null,
      contactPhone: existingConversation?.contactPhone || contactId,
      contactAvatarUrl:
        contactAvatarUrl ||
        existingConversation?.contactAvatarUrl ||
        resolveWhatsAppProfilePhotoUrl(existingConversation?.raw) ||
        null,
      lastMessageAt: timestamp,
      lastMessageText: text || existingConversation?.lastMessageText || null,
      lastDirection: "outbound",
      lastStatus: status,
      lastHasAttachment: existingConversation?.lastHasAttachment || false,
      conversationStatus:
        typeof data?.conversation?.status === "string"
          ? data.conversation.status
          : existingConversation?.conversationStatus || null,
      unreadCount: existingConversation?.unreadCount || 0,
      updatedAt: receivedAt,
    };

    await upsertMessage(messageRecord);
    await upsertConversation(conversationRecord);
    if (contactName || contactAvatarUrl) {
      await upsertWhatsAppContact({
        id: contactId,
        provider: "kirimdev",
        channelId,
        phoneNumberId,
        phoneNumber: contactId,
        name: contactName,
        avatarUrl: contactAvatarUrl,
        raw: {
          source: "kirimdev_webhook",
          contact: data?.contact || null,
          avatarUrl: contactAvatarUrl,
        },
        createdAt: timestamp,
        updatedAt: receivedAt,
      });
    }
    return { handled: true, type };
  }

  if (type === "contact.created" || type === "contact.updated") {
    const contact = data?.contact || {};
    const phoneNumber =
      typeof contact?.phone_number === "string" && contact.phone_number.trim()
        ? contact.phone_number.trim()
        : null;
    const phoneNumberId =
      (typeof contact?.phone_number_id === "string" && contact.phone_number_id.trim()) ||
      KIRIMDEV_PHONE_NUMBER_ID ||
      "";
    if (!phoneNumber || !phoneNumberId) {
      return { handled: false, type };
    }

    const channelId = `whatsapp:${phoneNumberId}`;
    const avatarUrl =
      resolveWhatsAppProfilePhotoUrl(contact) ||
      resolveWhatsAppProfilePhotoUrl(data) ||
      resolveWhatsAppProfilePhotoUrl(payload) ||
      null;
    await upsertWhatsAppContact({
      id: typeof contact?.id === "string" ? contact.id : phoneNumber,
      provider: "kirimdev",
      channelId,
      phoneNumberId,
      phoneNumber,
      name:
        typeof contact?.name === "string" && contact.name.trim() ? contact.name.trim() : null,
      email: typeof contact?.email === "string" ? contact.email : null,
      avatarUrl,
      raw: {
        source: "kirimdev_contact_webhook",
        contact,
        avatarUrl,
      },
      createdAt: typeof contact?.created_at === "string" ? contact.created_at : receivedAt,
      updatedAt: receivedAt,
    });
    return { handled: true, type };
  }

  // conversation.assigned / conversation.closed are keyed by Kirimdev's cnv_ id,
  // which we do not use as our conversation key (we key by channel:contact). They
  // are acknowledged and stored as raw webhook events for audit; mapping them into
  // inbox state would require a cnv_id index and is deferred to a later iteration.
  // customer.* events are likewise acknowledged without inbox mutation.
  return { handled: false, type };
}

export function handleKirimdevWebhookVerify(c: any) {
  // Kirimdev does not use Meta's hub.challenge handshake; expose a lightweight
  // health probe so the endpoint can be sanity-checked without leaking config.
  return c.json({
    ok: true,
    provider: "kirimdev",
    configured: Boolean(KIRIMDEV_PHONE_NUMBER_ID),
    signatureEnforced: KIRIMDEV_WEBHOOK_SECRETS.length > 0,
  });
}

export async function handleKirimdevWebhookReceive(c: any) {
  try {
    const rawBody = await c.req.raw.text();
    const signatureHeader =
      c.req.header("x-kirim-signature") || c.req.header("X-Kirim-Signature") || null;

    const verification = await verifyKirimdevSignature(rawBody, signatureHeader);
    if (!verification.ok) {
      return c.json({ error: verification.reason || "Invalid Kirimdev webhook signature." }, 401);
    }

    const eventId =
      c.req.header("x-kirim-event-id") || c.req.header("X-Kirim-Event-Id") || null;
    const source = c.req.header("x-kirim-source") || c.req.header("X-Kirim-Source") || null;
    const eventHeader = c.req.header("x-kirim-event") || c.req.header("X-Kirim-Event") || null;

    // Idempotency: Kirimdev may retry deliveries; drop duplicates by event id.
    // Only READ here — the dedup marker is written AFTER successful processing so a
    // transient failure (HTTP 500) is safely retried instead of being dropped.
    if (eventId) {
      const seen = await kv.get(buildKirimdevDedupKey(eventId));
      if (seen) {
        return c.json({ success: true, duplicate: true });
      }
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const receivedAt = new Date().toISOString();

    await kv.set(buildKirimdevWebhookEventKey(), {
      receivedAt,
      provider: "kirimdev",
      headers: { source, event: eventHeader, eventId },
      payload,
    });

    // Branch on envelope shape: Meta passthrough has a top-level `object`, native
    // Kirimdev events have a top-level `type`. The X-Kirim-Source header is a hint
    // but the body shape is authoritative.
    const isMetaPassthrough =
      payload?.object === "whatsapp_business_account" || Array.isArray(payload?.entry);

    const result = isMetaPassthrough
      ? await ingestMetaWebhookPayload(payload, receivedAt, {
          provider: "kirimdev",
          enrichment: payload?.kirim || null,
        })
      : await ingestKirimdevNativeEvent(payload, receivedAt);

    // Record the dedup marker only now that processing succeeded.
    if (eventId) {
      await kv.set(buildKirimdevDedupKey(eventId), { receivedAt });
    }

    return c.json({
      success: true,
      mode: isMetaPassthrough ? "passthrough" : "native",
      result,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
}

app.get("/readiness", async (c) => {
  try {
    const auth = await checkAuth(c.req.raw);
    if (auth.error) return c.json({ error: auth.error }, 401);

    const channels = await listStoredChannels();
    const debugPayload = await debugCurrentMetaToken();
    const tokenData = debugPayload?.data || {};
    const scopes = Array.isArray(tokenData?.scopes) ? tokenData.scopes : [];
    const requiredScopes = [
      "pages_messaging",
      "instagram_manage_messages",
      "pages_manage_metadata",
      "pages_show_list",
    ];

    return c.json({
      ok: requiredScopes.every((scope) => scopes.includes(scope)),
      tokenType: tokenData?.type || null,
      application: tokenData?.application || null,
      scopes,
      requiredScopes,
      missingScopes: requiredScopes.filter((scope) => !scopes.includes(scope)),
      channelCount: channels.length,
      pageChannelCount: channels.filter((item) => item.platform === "facebook_page").length,
      instagramChannelCount: channels.filter((item) => item.platform === "instagram").length,
      webhookVerifyTokenConfigured: Boolean(META_MESSAGING_VERIFY_TOKEN),
      appSecretConfigured: Boolean(META_APP_SECRET),
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.get("/assets/live", async (c) => {
  try {
    const auth = await checkAuth(c.req.raw);
    if (auth.error) return c.json({ error: auth.error }, 401);

    const channels = await discoverMessagingChannels();
    return c.json({
      channels: channels.map(sanitizeChannel),
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.post("/assets/sync", async (c) => {
  try {
    const auth = await checkAuth(c.req.raw);
    if (auth.error) return c.json({ error: auth.error }, 401);

    const channels = await discoverMessagingChannels();
    await persistChannels(channels);

    return c.json({
      success: true,
      channelCount: channels.length,
      channels: channels.map(sanitizeChannel),
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.get("/channels", async (c) => {
  try {
    const auth = await checkAuth(c.req.raw);
    if (auth.error) return c.json({ error: auth.error }, 401);

    const channels = await listStoredChannels();
    return c.json({
      channels: channels.map(sanitizeChannel),
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.get("/conversations", async (c) => {
  try {
    const auth = await checkAuth(c.req.raw);
    if (auth.error) return c.json({ error: auth.error }, 401);

    const channelId = c.req.query("channelId");
    const conversations = await listConversations();

    return c.json({
      conversations: conversations.filter((conversation) =>
        channelId ? conversation.channelId === channelId : true
      ),
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.get("/inbox/overview", async (c) => {
  try {
    const auth = await checkAuth(c.req.raw);
    if (auth.error) return c.json({ error: auth.error }, 401);

    let channels = await listStoredChannels();
    const needsInstagramSeed = Boolean(
      META_IG_ACCESS_TOKEN &&
        META_IG_ACCOUNT_ID &&
        !channels.some(
          (channel) =>
            channel.platform === "instagram" &&
            channelMatchesId(channel, `instagram:${META_IG_ACCOUNT_ID}`),
        ),
    );
    const needsWhatsAppSeed = Boolean(
      META_WA_PHONE_NUMBER_ID && !channels.some((channel) => channel.platform === "whatsapp"),
    );

    if (channels.length === 0 || needsInstagramSeed || needsWhatsAppSeed) {
      const discoveredChannels = await discoverMessagingChannels();
      channels = Array.from(
        new Map([...channels, ...discoveredChannels].map((channel) => [channel.id, channel])).values(),
      ).sort((left, right) => left.id.localeCompare(right.id));
      await persistChannels(channels);
    }

    const storedConversations = await listConversations();
    const liveErrors: Array<{ channelId: string; error: string }> = [];
    const liveConversations: LiveInboxConversation[] = [];

    for (const channel of channels) {
      if (channel.platform === "whatsapp") continue;
      if (!channel.supportsMessaging) continue;

      try {
        const rows = await fetchLiveConversationRows(channel);
        liveConversations.push(...rows.map((row) => normalizeLiveConversation(channel, row)));
      } catch (err: any) {
        liveErrors.push({
          channelId: channel.id,
          error: err?.message || "Gagal mengambil percakapan live.",
        });
      }
    }

    const liveErrorChannelIds = new Set(liveErrors.map((item) => item.channelId));
    const liveChannelIds = new Set(liveConversations.map((conversation) => conversation.channelId));

    const storedFallbackConversations = storedConversations
      .filter((conversation) => {
        const channel = resolveConversationChannel(channels, conversation);
        if (!channel) return true;
        if (channel.platform === "whatsapp") return true;
        if (liveErrorChannelIds.has(channel.id)) return true;
        return !liveChannelIds.has(channel.id);
      })
      .map((conversation) =>
        normalizeStoredConversation(
          conversation,
          resolveConversationChannel(channels, conversation),
        )
      );

    const conversations = [...liveConversations, ...storedFallbackConversations].sort((left, right) =>
      right.lastMessageAt.localeCompare(left.lastMessageAt)
    );

    return c.json({
      channels: channels.map(sanitizeChannel),
      conversations,
      diagnostics: {
        storedConversationCount: storedConversations.length,
        liveConversationCount: liveConversations.length,
        liveErrors,
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.get("/inbox/daily-stats", async (c) => {
  try {
    const auth = await checkAuth(c.req.raw);
    if (auth.error) return c.json({ error: auth.error }, 401);

    let channels = await listStoredChannels();
    const needsInstagramSeed = Boolean(
      META_IG_ACCESS_TOKEN &&
        (!channels.some((channel) => channel.platform === "instagram") ||
          (META_IG_USER_ID &&
            !channels.some(
              (channel) =>
                channel.platform === "instagram" &&
                channelMatchesId(channel, `instagram:${META_IG_USER_ID}`),
            ))),
    );
    const needsWhatsAppSeed = Boolean(
      META_WA_PHONE_NUMBER_ID && !channels.some((channel) => channel.platform === "whatsapp"),
    );

    if (channels.length === 0 || needsInstagramSeed || needsWhatsAppSeed) {
      const discoveredChannels = await discoverMessagingChannels();
      channels = Array.from(
        new Map([...channels, ...discoveredChannels].map((channel) => [channel.id, channel])).values(),
      ).sort((left, right) => left.id.localeCompare(right.id));
      await persistChannels(channels);
    }

    const days = Number(c.req.query("days") || "30");
    const payload = await buildDailyInboxStats(days, channels);
    return c.json(payload);
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.get("/messages", async (c) => {
  try {
    const auth = await checkAuth(c.req.raw);
    if (auth.error) return c.json({ error: auth.error }, 401);

    const conversationId = c.req.query("conversationId");
    if (!conversationId) {
      return c.json({ error: "conversationId wajib diisi." }, 400);
    }

    const messages = await listMessagesForConversation(conversationId);
    return c.json({ messages });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.get("/inbox/messages", async (c) => {
  try {
    const auth = await checkAuth(c.req.raw);
    if (auth.error) return c.json({ error: auth.error }, 401);

    const conversationId = c.req.query("conversationId");
    const channelId = c.req.query("channelId");
    if (!conversationId || !channelId) {
      return c.json({ error: "conversationId dan channelId wajib diisi." }, 400);
    }

    const channel = await getStoredChannel(channelId);
    if (!channel) {
      return c.json({ error: "Channel tidak ditemukan. Jalankan sync assets terlebih dahulu." }, 404);
    }

    if (channel.platform === "whatsapp") {
      const messages = await listMessagesForConversation(conversationId);
      return c.json({
        messages: messages.map(normalizeStoredMessage),
      });
    }

    const liveRows = await fetchLiveMessagesForChannelConversation(channel, conversationId);
    return c.json({
      messages: liveRows
        .map((row: any) => normalizeLiveMessage(channel, conversationId, row))
        .sort((left: LiveInboxMessage, right: LiveInboxMessage) =>
          left.timestamp.localeCompare(right.timestamp)
        ),
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.post("/send", async (c) => {
  try {
    const auth = await checkAuth(c.req.raw);
    if (auth.error) return c.json({ error: auth.error }, 401);

    const body = await c.req.json();
    const channelId = typeof body?.channelId === "string" ? body.channelId.trim() : "";
    const recipientId = typeof body?.recipientId === "string" ? body.recipientId.trim() : "";
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const tag = typeof body?.tag === "string" ? body.tag.trim() : "";

    if (!channelId || !recipientId || !text) {
      return c.json({ error: "channelId, recipientId, dan text wajib diisi." }, 400);
    }

    const channel = await getStoredChannel(channelId);
    if (!channel) {
      return c.json({ error: "Channel tidak ditemukan. Jalankan sync assets terlebih dahulu." }, 404);
    }

    if (channel.platform === "whatsapp") {
      const phoneNumberId =
        channel.whatsappPhoneNumberId || getPhoneNumberIdFromChannelId(channel.id) || KIRIMDEV_PHONE_NUMBER_ID;
      const result = await sendKirimdevTextMessage({
        phoneNumberId,
        to: recipientId,
        text,
      });

      return c.json({
        success: true,
        provider: "kirimdev",
        response: result.response,
        message: normalizeWhatsAppMessageView(result.message),
      });
    }

    const payload: Record<string, unknown> = {
      recipient: { id: recipientId },
      message: { text },
      messaging_type: tag ? "MESSAGE_TAG" : "RESPONSE",
    };
    if (tag) {
      payload.tag = tag;
    }

    let url: URL;

    if (channel.platform === "instagram") {
      const instagramEdgeId = channel.instagramAccountId || META_IG_ACCOUNT_ID;
      if (!instagramEdgeId) {
        return c.json({ error: "Instagram account ID belum tersedia untuk channel ini." }, 400);
      }

      if (channel.accessToken.startsWith("IG")) {
        url = new URL(`https://graph.instagram.com/${META_GRAPH_VERSION}/${instagramEdgeId}/messages`);
        url.searchParams.set("access_token", channel.accessToken);
      } else {
        const proof = await createAppSecretProof(channel.accessToken);
        url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${instagramEdgeId}/messages`);
        url.searchParams.set("access_token", channel.accessToken);
        if (proof) {
          url.searchParams.set("appsecret_proof", proof);
        }
      }
    } else {
      const pageEdgeId = channel.pageId;
      const proof = await createAppSecretProof(channel.accessToken);
      url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageEdgeId}/messages`);
      url.searchParams.set("access_token", channel.accessToken);
      if (proof) {
        url.searchParams.set("appsecret_proof", proof);
      }
    }

    const response = await fetchMetaJson(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return c.json({
      success: true,
      response,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

// --- WhatsApp module (provider-aware) read endpoints -------------------------
// These power the dedicated WhatsApp module UI (Chats / Contacts / Accounts /
// Inbox Settings). They only READ the KV store (no Meta Graph live calls), so the
// WhatsApp-only module stays fast and never depends on Instagram/Messenger tokens.

type WhatsAppConversationView = {
  id: string;
  channelId: string;
  provider: MessagingProvider;
  source: "webhook" | "api";
  contactId: string;
  contactName: string | null;
  contactPhone: string | null;
  contactAvatarUrl: string | null;
  lastMessageAt: string;
  lastMessageText: string | null;
  lastDirection: "inbound" | "outbound";
  lastStatus: MessageDeliveryStatus | null;
  unreadCount: number;
  hasAttachment: boolean;
  conversationStatus: string | null;
  updatedAt: string;
  messageCount: number;
  mergedConversationIds: string[];
  mergedConversationCount: number;
};

type WhatsAppCsPerformanceStatus =
  | "performing"
  | "monitor"
  | "needs_attention"
  | "insufficient_data";

type WhatsAppCsPerformanceView = {
  csProfileId: string | null;
  csDisplayName: string;
  csWhatsappNumber: string | null;
  accountCount: number;
  conversationCount: number;
  inboundMessages: number;
  outboundMessages: number;
  responseSampleCount: number;
  firstResponseSampleCount: number;
  avgFirstResponseSeconds: number | null;
  medianFirstResponseSeconds: number | null;
  avgResponseSeconds: number | null;
  medianResponseSeconds: number | null;
  slaTargetSeconds: number;
  slaHitRate: number | null;
  slaBreachedCount: number;
  unansweredConversationCount: number;
  leads: number;
  closing: number;
  conversionRate: number | null;
  score: number | null;
  status: WhatsAppCsPerformanceStatus;
  evaluation: string[];
  lastActivityAt: string | null;
};

type WhatsAppPerformanceSummaryView = {
  windowDays: number;
  since: string;
  slaTargetSeconds: number;
  totals: {
    csCount: number;
    needsAttentionCount: number;
    conversationCount: number;
    leads: number;
    closing: number;
    avgResponseSeconds: number | null;
    slaHitRate: number | null;
  };
  cs: WhatsAppCsPerformanceView[];
};

const WHATSAPP_CS_PERFORMANCE_WINDOW_DAYS = 30;
const WHATSAPP_CS_RESPONSE_SLA_SECONDS = 10 * 60;
const UNASSIGNED_WHATSAPP_CS_ID = "__unassigned_whatsapp_cs";

function normalizeWhatsAppConversationView(
  conversation: MetaConversationRecord,
  channel: MetaMessagingChannel | null,
  messageCount = 0,
): WhatsAppConversationView {
  return {
    id: conversation.id,
    channelId: conversation.channelId,
    provider: conversation.provider || channel?.provider || "meta",
    source: conversation.source || "webhook",
    contactId: conversation.contactId,
    contactName: conversation.contactName || null,
    contactPhone: conversation.contactPhone || conversation.contactId,
    contactAvatarUrl:
      conversation.contactAvatarUrl ||
      resolveWhatsAppProfilePhotoUrl(conversation.raw) ||
      null,
    lastMessageAt: conversation.lastMessageAt,
    lastMessageText: conversation.lastMessageText,
    lastDirection: conversation.lastDirection,
    lastStatus: conversation.lastStatus || null,
    unreadCount: conversation.unreadCount || 0,
    hasAttachment: Boolean(conversation.lastHasAttachment),
    conversationStatus: conversation.conversationStatus || null,
    updatedAt: conversation.updatedAt,
    messageCount,
    mergedConversationIds: [conversation.id],
    mergedConversationCount: 1,
  };
}

function getWhatsAppConversationContactKey(
  conversation: { contactPhone?: string | null; contactId?: string | null },
) {
  return (
    normalizeWhatsAppPhoneNumber(conversation.contactPhone) ||
    normalizeWhatsAppPhoneNumber(conversation.contactId) ||
    String(conversation.contactId || conversation.contactPhone || "").trim().toLowerCase()
  );
}

async function buildWhatsAppMessageCountByConversation(
  conversations: MetaConversationRecord[],
) {
  const countByConversation = new Map<string, number>();
  const conversationIds = Array.from(new Set(conversations.map((conversation) => conversation.id)));
  if (conversationIds.length === 0) return countByConversation;

  try {
    const supabase = resolveSupabaseAdminClient();
    const { data, error } = await supabase.rpc("get_whatsapp_message_counts", {
      p_conversation_ids: conversationIds,
    });
    if (error) throw error;

    for (const row of asArray<any>(data)) {
      const conversationId =
        typeof row?.conversation_id === "string" ? row.conversation_id : "";
      if (!conversationId) continue;
      countByConversation.set(conversationId, Number(row?.message_count || 0));
    }
    return countByConversation;
  } catch (error: any) {
    if (!isSupabaseSchemaError(error)) {
      console.warn("WhatsApp DB message count fallback to lightweight scan.", error);
    }
  }

  try {
    const supabase = resolveSupabaseAdminClient();
    for (const chunk of chunkArray(conversationIds, 100)) {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("conversation_id,event_type")
        .in("conversation_id", chunk)
        .limit(50000);
      if (error) throw error;

      for (const row of asArray<any>(data)) {
        const conversationId =
          typeof row?.conversation_id === "string" ? row.conversation_id : "";
        if (!conversationId || (row?.event_type || "").startsWith("whatsapp_status_")) {
          continue;
        }
        countByConversation.set(
          conversationId,
          (countByConversation.get(conversationId) || 0) + 1,
        );
      }
    }
    return countByConversation;
  } catch (error: any) {
    if (!isSupabaseSchemaError(error)) {
      console.warn("WhatsApp DB message count fallback to KV.", error);
    }
  }

  const conversationIdSet = new Set(conversationIds);
  const rows = (await kv.getByPrefix("meta_messaging_message:")) as MetaMessageRecord[];
  for (const row of rows) {
    if (!conversationIdSet.has(row.conversationId)) continue;
    if ((row.eventType || "").startsWith("whatsapp_status_")) continue;
    countByConversation.set(
      row.conversationId,
      (countByConversation.get(row.conversationId) || 0) + 1,
    );
  }
  return countByConversation;
}

function toTimestampMs(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index];
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function secondsFromMs(value: number | null) {
  return value === null ? null : Math.max(0, Math.round(value / 1000));
}

function getPerformanceWindowSince(now = new Date()) {
  return new Date(
    now.getTime() - WHATSAPP_CS_PERFORMANCE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function getPerformanceOwnerKey(owner: WhatsAppAccountOwnerView | null) {
  return owner?.id || UNASSIGNED_WHATSAPP_CS_ID;
}

function createPerformanceAccumulator(owner: WhatsAppAccountOwnerView | null) {
  return {
    csProfileId: owner?.id || null,
    csDisplayName: owner?.displayName || "Belum terpetakan",
    csWhatsappNumber: owner?.whatsappNumber || null,
    accountIds: new Set<string>(),
    conversationIds: new Set<string>(),
    inboundMessages: 0,
    outboundMessages: 0,
    firstResponseMs: [] as number[],
    responseMs: [] as number[],
    slaBreachedCount: 0,
    unansweredConversationIds: new Set<string>(),
    leads: 0,
    closing: 0,
    lastActivityAt: null as string | null,
  };
}

function updateLatestActivity(
  current: string | null,
  candidate: string | null | undefined,
) {
  if (!candidate) return current;
  if (!current || candidate > current) return candidate;
  return current;
}

function addConversationResponseMetrics(
  accumulator: ReturnType<typeof createPerformanceAccumulator>,
  messages: MetaMessageRecord[],
  sinceMs: number,
) {
  const sortedMessages = messages
    .filter((message) => !(message.eventType || "").startsWith("whatsapp_status_"))
    .filter((message) => message.direction === "inbound" || message.direction === "outbound")
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  const windowMessages = sortedMessages.filter((message) => {
    const timestamp = toTimestampMs(message.timestamp);
    return timestamp !== null && timestamp >= sinceMs;
  });

  for (const message of windowMessages) {
    if (message.direction === "inbound") accumulator.inboundMessages += 1;
    if (message.direction === "outbound") accumulator.outboundMessages += 1;
    accumulator.lastActivityAt = updateLatestActivity(accumulator.lastActivityAt, message.timestamp);
  }

  let firstInboundMs: number | null = null;
  let firstResponseMs: number | null = null;
  let waitingInboundMs: number | null = null;
  let latestInboundMs: number | null = null;
  let latestOutboundAfterInboundMs: number | null = null;

  for (const message of windowMessages) {
    const timestamp = toTimestampMs(message.timestamp);
    if (timestamp === null) continue;

    if (message.direction === "inbound") {
      if (firstInboundMs === null) firstInboundMs = timestamp;
      if (waitingInboundMs === null) waitingInboundMs = timestamp;
      latestInboundMs = timestamp;
      latestOutboundAfterInboundMs = null;
      continue;
    }

    if (firstInboundMs !== null && firstResponseMs === null && timestamp >= firstInboundMs) {
      firstResponseMs = timestamp - firstInboundMs;
      accumulator.firstResponseMs.push(firstResponseMs);
    }

    if (waitingInboundMs !== null && timestamp >= waitingInboundMs) {
      const responseMs = timestamp - waitingInboundMs;
      accumulator.responseMs.push(responseMs);
      if (responseMs > WHATSAPP_CS_RESPONSE_SLA_SECONDS * 1000) {
        accumulator.slaBreachedCount += 1;
      }
      waitingInboundMs = null;
    }

    if (latestInboundMs !== null && timestamp >= latestInboundMs) {
      latestOutboundAfterInboundMs = timestamp;
    }
  }

  if (
    latestInboundMs !== null &&
    (latestOutboundAfterInboundMs === null || latestOutboundAfterInboundMs < latestInboundMs)
  ) {
    accumulator.unansweredConversationIds.add(messages[0]?.conversationId || crypto.randomUUID());
  }
}

function normalizeLeadStatus(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isClosingLead(row: any) {
  return normalizeLeadStatus(row?.status) === "closing";
}

async function listAutoWhatsAppLeadRows(sinceIso: string) {
  try {
    const supabase = resolveSupabaseAdminClient();
    const { data, error } = await supabase
      .from("leads")
      .select("id,status,cs_id,created_at,origin,last_contact")
      .gte("created_at", sinceIso)
      .or(`origin.eq.${AUTO_WHATSAPP_LEAD_ORIGIN},last_contact.eq.${AUTO_WHATSAPP_LEAD_LAST_CONTACT}`)
      .limit(5000);

    if (!error) return data || [];
    if (!isSupabaseSchemaError(error)) throw error;

    const fallback = await supabase
      .from("leads")
      .select("id,status,cs_id,created_at,last_contact")
      .gte("created_at", sinceIso)
      .eq("last_contact", AUTO_WHATSAPP_LEAD_LAST_CONTACT)
      .limit(5000);

    if (fallback.error) throw fallback.error;
    return fallback.data || [];
  } catch (error) {
    console.warn("WhatsApp CS performance lead lookup skipped.", error);
    return [] as any[];
  }
}

function calculatePerformanceScore({
  slaHitRate,
  conversionRate,
  unansweredConversationCount,
  conversationCount,
  leads,
}: {
  slaHitRate: number | null;
  conversionRate: number | null;
  unansweredConversationCount: number;
  conversationCount: number;
  leads: number;
}) {
  if (conversationCount < 3 && leads < 3) return null;

  const slaScore = Math.round((slaHitRate ?? 0) * 40);
  const conversionScore = Math.round(Math.min(conversionRate ?? 0, 0.5) / 0.5 * 35);
  const unansweredPenalty =
    conversationCount > 0 ? Math.min(unansweredConversationCount / conversationCount, 1) * 15 : 0;
  const activityScore = Math.min(Math.max(conversationCount + leads, 0), 20) / 20 * 10;

  return Math.max(0, Math.min(100, Math.round(slaScore + conversionScore + activityScore - unansweredPenalty)));
}

function buildPerformanceEvaluation({
  csProfileId,
  conversationCount,
  leads,
  closing,
  slaHitRate,
  avgResponseSeconds,
  unansweredConversationCount,
  conversionRate,
  score,
}: {
  csProfileId: string | null;
  conversationCount: number;
  leads: number;
  closing: number;
  slaHitRate: number | null;
  avgResponseSeconds: number | null;
  unansweredConversationCount: number;
  conversionRate: number | null;
  score: number | null;
}) {
  const evaluation: string[] = [];
  let status: WhatsAppCsPerformanceStatus = "monitor";

  if (!csProfileId) {
    return {
      status: "needs_attention" as WhatsAppCsPerformanceStatus,
      evaluation: ["Mapping CS belum lengkap untuk nomor WhatsApp ini."],
    };
  }

  if (conversationCount < 3 && leads < 3) {
    return {
      status: "insufficient_data" as WhatsAppCsPerformanceStatus,
      evaluation: ["Data 30 hari terakhir masih minim untuk dinilai."],
    };
  }

  if (slaHitRate !== null && slaHitRate < 0.7) {
    evaluation.push("Kecepatan balas perlu dievaluasi.");
    status = "needs_attention";
  }
  if (avgResponseSeconds !== null && avgResponseSeconds > WHATSAPP_CS_RESPONSE_SLA_SECONDS) {
    evaluation.push("Rata-rata balasan melewati SLA 10 menit.");
    status = "needs_attention";
  }
  if (unansweredConversationCount > 0) {
    evaluation.push(`${unansweredConversationCount} chat belum terbalas.`);
    status = "needs_attention";
  }
  if (leads >= 3 && closing === 0) {
    evaluation.push("Belum ada closing dari lead WhatsApp.");
    status = "needs_attention";
  } else if (leads >= 5 && conversionRate !== null && conversionRate < 0.15) {
    evaluation.push("Conversion rate perlu ditingkatkan.");
    status = status === "needs_attention" ? status : "monitor";
  }

  if (evaluation.length === 0) {
    if ((score ?? 0) >= 75 || ((slaHitRate ?? 0) >= 0.85 && (conversionRate ?? 0) >= 0.2)) {
      status = "performing";
      evaluation.push("Performa sehat: respons cepat dan closing terukur.");
    } else {
      status = "monitor";
      evaluation.push("Performa cukup, tetap monitor kualitas follow up.");
    }
  }

  return { status, evaluation };
}

async function buildWhatsAppCsPerformanceSummary({
  conversations,
  channels,
  ownerByPhoneNumber,
}: {
  conversations: MetaConversationRecord[];
  channels: MetaMessagingChannel[];
  ownerByPhoneNumber: Map<string, WhatsAppAccountOwnerView>;
}): Promise<WhatsAppPerformanceSummaryView> {
  const now = new Date();
  const since = getPerformanceWindowSince(now);
  const sinceMs = new Date(since).getTime();
  const whatsappChannels = channels.filter((channel) => channel.platform === "whatsapp");
  const channelById = new Map(whatsappChannels.map((channel) => [channel.id, channel]));
  const ownerByChannelId = new Map<string, WhatsAppAccountOwnerView | null>();
  const accumulators = new Map<string, ReturnType<typeof createPerformanceAccumulator>>();

  const ensureAccumulator = (owner: WhatsAppAccountOwnerView | null) => {
    const key = getPerformanceOwnerKey(owner);
    let accumulator = accumulators.get(key);
    if (!accumulator) {
      accumulator = createPerformanceAccumulator(owner);
      accumulators.set(key, accumulator);
    }
    return accumulator;
  };

  for (const channel of whatsappChannels) {
    const owner = resolveWhatsAppAccountOwnerForChannel(channel, ownerByPhoneNumber);
    ownerByChannelId.set(channel.id, owner);
    ensureAccumulator(owner).accountIds.add(channel.id);
  }

  const whatsappConversations = conversations.filter((conversation) =>
    conversation.channelId.startsWith("whatsapp:"),
  );
  const messagesByConversation = new Map<string, MetaMessageRecord[]>();
  const messageRows = await listMessagesForConversations(
    whatsappConversations.map((conversation) => conversation.id),
    {
      since,
      limit: 50000,
    },
  );

  for (const message of messageRows) {
    if (!message.channelId.startsWith("whatsapp:")) continue;
    if ((message.eventType || "").startsWith("whatsapp_status_")) continue;
    const bucket = messagesByConversation.get(message.conversationId) || [];
    bucket.push(message);
    messagesByConversation.set(message.conversationId, bucket);
  }

  for (const conversation of whatsappConversations) {
    const channel = channelById.get(conversation.channelId) || null;
    const owner =
      ownerByChannelId.get(conversation.channelId) ??
      resolveWhatsAppAccountOwnerForChannel(channel, ownerByPhoneNumber);
    const accumulator = ensureAccumulator(owner);
    const lastMessageMs = toTimestampMs(conversation.lastMessageAt);

    if (lastMessageMs !== null && lastMessageMs >= sinceMs) {
      accumulator.conversationIds.add(conversation.id);
      accumulator.lastActivityAt = updateLatestActivity(
        accumulator.lastActivityAt,
        conversation.lastMessageAt,
      );
    }

    addConversationResponseMetrics(
      accumulator,
      messagesByConversation.get(conversation.id) || [],
      sinceMs,
    );
  }

  const leadRows = await listAutoWhatsAppLeadRows(since);
  const missingLeadProfileIds = new Set<string>();
  for (const row of leadRows) {
    const csId = typeof row?.cs_id === "string" && row.cs_id.trim() ? row.cs_id.trim() : null;
    const key = csId || UNASSIGNED_WHATSAPP_CS_ID;
    let accumulator = accumulators.get(key);

    if (!accumulator) {
      if (csId) missingLeadProfileIds.add(csId);
      accumulator = createPerformanceAccumulator(
        csId
          ? {
              id: csId,
              displayName: "CS",
              whatsappNumber: "",
              assignmentStatus: null,
            }
          : null,
      );
      accumulators.set(key, accumulator);
    }

    accumulator.leads += 1;
    if (isClosingLead(row)) accumulator.closing += 1;
    accumulator.lastActivityAt = updateLatestActivity(
      accumulator.lastActivityAt,
      typeof row?.created_at === "string" ? row.created_at : null,
    );
  }

  const profileLabels =
    missingLeadProfileIds.size > 0
      ? await resolveProfileLabelsById(resolveSupabaseAdminClient(), Array.from(missingLeadProfileIds))
      : new Map<string, string>();

  const rows = Array.from(accumulators.values()).map((accumulator) => {
    if (accumulator.csProfileId && accumulator.csDisplayName === "CS") {
      accumulator.csDisplayName = profileLabels.get(accumulator.csProfileId) || "CS";
    }

    const avgFirstResponseSeconds = secondsFromMs(average(accumulator.firstResponseMs));
    const medianFirstResponseSeconds = secondsFromMs(percentile(accumulator.firstResponseMs, 0.5));
    const avgResponseMs = average(accumulator.responseMs);
    const avgResponseSeconds = secondsFromMs(avgResponseMs);
    const medianResponseSeconds = secondsFromMs(percentile(accumulator.responseMs, 0.5));
    const responseSampleCount = accumulator.responseMs.length;
    const slaHitRate =
      responseSampleCount > 0
        ? (responseSampleCount - accumulator.slaBreachedCount) / responseSampleCount
        : null;
    const conversationCount = accumulator.conversationIds.size;
    const unansweredConversationCount = accumulator.unansweredConversationIds.size;
    const conversionRate =
      accumulator.leads > 0 ? accumulator.closing / accumulator.leads : null;
    const score = calculatePerformanceScore({
      slaHitRate,
      conversionRate,
      unansweredConversationCount,
      conversationCount,
      leads: accumulator.leads,
    });
    const evaluation = buildPerformanceEvaluation({
      csProfileId: accumulator.csProfileId,
      conversationCount,
      leads: accumulator.leads,
      closing: accumulator.closing,
      slaHitRate,
      avgResponseSeconds,
      unansweredConversationCount,
      conversionRate,
      score,
    });

    return {
      csProfileId: accumulator.csProfileId,
      csDisplayName: accumulator.csDisplayName,
      csWhatsappNumber: accumulator.csWhatsappNumber,
      accountCount: accumulator.accountIds.size,
      conversationCount,
      inboundMessages: accumulator.inboundMessages,
      outboundMessages: accumulator.outboundMessages,
      responseSampleCount,
      firstResponseSampleCount: accumulator.firstResponseMs.length,
      avgFirstResponseSeconds,
      medianFirstResponseSeconds,
      avgResponseSeconds,
      medianResponseSeconds,
      slaTargetSeconds: WHATSAPP_CS_RESPONSE_SLA_SECONDS,
      slaHitRate,
      slaBreachedCount: accumulator.slaBreachedCount,
      unansweredConversationCount,
      leads: accumulator.leads,
      closing: accumulator.closing,
      conversionRate,
      score,
      status: evaluation.status,
      evaluation: evaluation.evaluation,
      lastActivityAt: accumulator.lastActivityAt,
    };
  });

  const sortedRows = rows.sort((left, right) => {
    const byStatus =
      ["needs_attention", "monitor", "performing", "insufficient_data"].indexOf(left.status) -
      ["needs_attention", "monitor", "performing", "insufficient_data"].indexOf(right.status);
    if (byStatus !== 0) return byStatus;
    return (right.score ?? -1) - (left.score ?? -1);
  });

  const allResponseSamples = Array.from(accumulators.values()).flatMap(
    (accumulator) => accumulator.responseMs,
  );
  const totalSlaBreached = Array.from(accumulators.values()).reduce(
    (sum, accumulator) => sum + accumulator.slaBreachedCount,
    0,
  );
  const totalResponseSamples = allResponseSamples.length;

  return {
    windowDays: WHATSAPP_CS_PERFORMANCE_WINDOW_DAYS,
    since,
    slaTargetSeconds: WHATSAPP_CS_RESPONSE_SLA_SECONDS,
    totals: {
      csCount: sortedRows.filter((row) => row.csProfileId).length,
      needsAttentionCount: sortedRows.filter((row) => row.status === "needs_attention").length,
      conversationCount: sortedRows.reduce((sum, row) => sum + row.conversationCount, 0),
      leads: sortedRows.reduce((sum, row) => sum + row.leads, 0),
      closing: sortedRows.reduce((sum, row) => sum + row.closing, 0),
      avgResponseSeconds: secondsFromMs(average(allResponseSamples)),
      slaHitRate:
        totalResponseSamples > 0
          ? (totalResponseSamples - totalSlaBreached) / totalResponseSamples
          : null,
    },
    cs: sortedRows,
  };
}

function choosePrimaryWhatsAppConversation(
  conversations: WhatsAppConversationView[],
) {
  return [...conversations].sort((left, right) => {
    const byLatest = right.lastMessageAt.localeCompare(left.lastMessageAt);
    if (byLatest !== 0) return byLatest;
    return right.updatedAt.localeCompare(left.updatedAt);
  })[0];
}

function mergeWhatsAppConversationViews(conversations: WhatsAppConversationView[]) {
  const primary = choosePrimaryWhatsAppConversation(conversations);
  const mergedConversationIds = Array.from(new Set(conversations.map((conversation) => conversation.id)));
  const messageCount = conversations.reduce((sum, conversation) => sum + conversation.messageCount, 0);
  const unreadCount = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);
  const latestWithText =
    conversations
      .filter((conversation) => conversation.lastMessageText)
      .sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt))[0] || null;

  return {
    ...primary,
    contactName:
      primary.contactName ||
      conversations.find((conversation) => conversation.contactName)?.contactName ||
      null,
    contactPhone:
      primary.contactPhone ||
      conversations.find((conversation) => conversation.contactPhone)?.contactPhone ||
      primary.contactId,
    contactAvatarUrl:
      primary.contactAvatarUrl ||
      conversations.find((conversation) => conversation.contactAvatarUrl)?.contactAvatarUrl ||
      null,
    lastMessageText: latestWithText?.lastMessageText || primary.lastMessageText,
    unreadCount,
    hasAttachment: conversations.some((conversation) => conversation.hasAttachment),
    messageCount,
    mergedConversationIds,
    mergedConversationCount: mergedConversationIds.length,
  };
}

function dedupeWhatsAppConversationViews(conversations: WhatsAppConversationView[]) {
  const grouped = new Map<string, WhatsAppConversationView[]>();
  for (const conversation of conversations) {
    const contactKey = getWhatsAppConversationContactKey(conversation);
    const groupKey = `${conversation.channelId}:${contactKey || conversation.id}`;
    const bucket = grouped.get(groupKey) || [];
    bucket.push(conversation);
    grouped.set(groupKey, bucket);
  }

  return Array.from(grouped.values())
    .map((bucket) =>
      bucket.length === 1 ? bucket[0] : mergeWhatsAppConversationViews(bucket),
    )
    .sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt));
}

function dedupeWhatsAppMessageViews(messages: ReturnType<typeof normalizeWhatsAppMessageView>[]) {
  const seen = new Set<string>();
  const result: ReturnType<typeof normalizeWhatsAppMessageView>[] = [];

  for (const message of messages.sort((left, right) => left.timestamp.localeCompare(right.timestamp))) {
    const bodyKey = [
      message.channelId,
      message.direction,
      message.timestamp,
      message.text || "",
      message.mediaUrl || "",
      JSON.stringify(message.attachments || []),
    ].join("|");
    const key = message.id.startsWith("wamid.")
      ? `${message.channelId}:${message.id}`
      : `${message.channelId}:${message.id}:${bodyKey}`;
    if (seen.has(key) || seen.has(bodyKey)) continue;
    seen.add(key);
    seen.add(bodyKey);
    result.push(message);
  }

  return result;
}

function sliceLatestWhatsAppMessageViews(
  messages: ReturnType<typeof normalizeWhatsAppMessageView>[],
  limit: number,
) {
  const sorted = [...messages].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  if (sorted.length <= limit) {
    return {
      messages: sorted,
      hasMore: false,
      nextCursor: null as string | null,
    };
  }

  const page = sorted.slice(-limit);
  return {
    messages: page,
    hasMore: true,
    nextCursor: page[0]?.timestamp || null,
  };
}

async function findSiblingWhatsAppConversations(conversation: MetaConversationRecord) {
  const contactKey = getWhatsAppConversationContactKey(conversation);
  if (!contactKey) return [conversation];

  const dbSiblings = await listSiblingConversationsFromDatabase(conversation);
  if (dbSiblings.length > 0) return dbSiblings;

  const conversations = await listConversations();
  const siblings = conversations.filter((candidate) => {
    if (candidate.channelId !== conversation.channelId) return false;
    return getWhatsAppConversationContactKey(candidate) === contactKey;
  });

  return siblings.length ? siblings : [conversation];
}

function normalizeWhatsAppMessageView(message: MetaMessageRecord) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    channelId: message.channelId,
    provider: message.provider || "meta",
    direction: message.direction,
    text: message.text,
    status: message.status || null,
    attachments: Array.isArray(message.attachments) ? message.attachments : [],
    mediaUrl: message.mediaUrl || null,
    timestamp: message.timestamp,
    senderName: null as string | null,
  };
}

function buildKirimdevStatus(latestEventAt: string | null, eventCount: number) {
  // NOTE: phoneNumberId / displayPhoneNumber / apiBaseUrl are NOT secrets (the
  // phone number id is a public Meta identifier). The API key and webhook secret
  // are deliberately surfaced only as booleans — never their values.
  return {
    configured: Boolean(KIRIMDEV_PHONE_NUMBER_ID),
    apiKeyConfigured: Boolean(KIRIMDEV_API_KEY),
    webhookSecretConfigured: KIRIMDEV_WEBHOOK_SECRETS.length > 0,
    phoneNumberId: KIRIMDEV_PHONE_NUMBER_ID || null,
    displayPhoneNumber: KIRIMDEV_DISPLAY_PHONE_NUMBER || null,
    webhookPath: KIRIMDEV_WEBHOOK_PATH,
    apiBaseUrl: KIRIMDEV_API_BASE_URL,
    recommendedEvents: KIRIMDEV_RECOMMENDED_EVENTS,
    toleranceSeconds: KIRIMDEV_WEBHOOK_TOLERANCE_SECONDS,
    latestEventAt,
    eventCount,
  };
}

app.get("/kirimdev/status", async (c) => {
  try {
    const access = await requireMessagingPermission(c, "whatsapp.settings.manage");
    if (access.error) return access.error;

    const conversations = await listConversations();
    const kirimdevConversations = conversations.filter(
      (conversation) => (conversation.provider || "meta") === "kirimdev",
    );
    const latestEventAt = kirimdevConversations.reduce<string | null>((latest, conversation) => {
      if (!latest || conversation.lastMessageAt > latest) return conversation.lastMessageAt;
      return latest;
    }, null);

    return c.json(buildKirimdevStatus(latestEventAt, kirimdevConversations.length));
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.post("/kirimdev/sync", async (c) => {
  try {
    const access = await requireAnyMessagingPermissionOrInternalSync(c, [
      "whatsapp.settings.manage",
      "whatsapp.view",
    ]);
    if (access.error) return access.error;

    const body = await c.req.json().catch(() => ({}));
    const since =
      normalizeIsoTimestampFilter(typeof body?.since === "string" ? body.since : null) ||
      (body?.sinceDays ? getIsoTimestampDaysAgo(body.sinceDays, 30) : null);
    const until = normalizeIsoTimestampFilter(typeof body?.until === "string" ? body.until : null);
    const result = await syncKirimdevConversations({
      phoneNumberId: typeof body?.phoneNumberId === "string" ? body.phoneNumberId : null,
      cursor: typeof body?.cursor === "string" ? body.cursor : null,
      since,
      until,
      conversationLimit: clampPositiveInteger(body?.conversationLimit, 100, 100),
      maxPages: clampPositiveInteger(body?.maxPages, 5, 100),
      includeMessages: body?.includeMessages === true,
      messageLimit: clampPositiveInteger(body?.messageLimit, 25, 100),
      messageMaxPages: clampPositiveInteger(body?.messageMaxPages, 1, 100),
    });

    return c.json({ success: true, ...result });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.get("/kirimdev/templates", async (c) => {
  try {
    const access = await requireAnyMessagingPermission(c, [
      "whatsapp.templates.manage",
      "whatsapp.broadcast.manage",
    ]);
    if (access.error) return access.error;

    const result = await listKirimdevTemplates({
      phoneNumberId: c.req.query("phoneNumberId") || null,
      status: c.req.query("status") || "all",
      language: c.req.query("language") || null,
      limit: clampPositiveInteger(c.req.query("limit"), 100, 100),
      cursor: c.req.query("cursor") || null,
    });

    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.post("/kirimdev/templates/sync", async (c) => {
  try {
    const access = await requireMessagingPermission(c, "whatsapp.templates.manage");
    if (access.error) return access.error;

    const body = await c.req.json().catch(() => ({}));
    const phoneNumberId =
      typeof body?.phoneNumberId === "string" && body.phoneNumberId.trim()
        ? body.phoneNumberId.trim()
        : KIRIMDEV_PHONE_NUMBER_ID;
    if (!phoneNumberId) {
      return c.json({ error: "KIRIMDEV_PHONE_NUMBER_ID belum dikonfigurasi di server." }, 400);
    }

    const response = await fetchKirimdevJson(
      `/${encodeURIComponent(phoneNumberId)}/templates/sync`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );

    return c.json({
      success: true,
      response,
      ...(await listKirimdevTemplates({ phoneNumberId, status: "all", limit: 100 })),
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.post("/kirimdev/templates", async (c) => {
  try {
    const access = await requireMessagingPermission(c, "whatsapp.templates.manage");
    if (access.error) return access.error;

    const body = await c.req.json();
    const phoneNumberId =
      typeof body?.phoneNumberId === "string" && body.phoneNumberId.trim()
        ? body.phoneNumberId.trim()
        : KIRIMDEV_PHONE_NUMBER_ID;
    const name = typeof body?.name === "string" ? body.name.trim().toLowerCase() : "";
    const category = typeof body?.category === "string" ? body.category.trim().toUpperCase() : "";
    const language = typeof body?.language === "string" && body.language.trim() ? body.language.trim() : "id";
    const bodyText = typeof body?.bodyText === "string" ? body.bodyText.trim() : "";
    const examples = asArray<string>(body?.exampleValues)
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    if (!phoneNumberId) {
      return c.json({ error: "KIRIMDEV_PHONE_NUMBER_ID belum dikonfigurasi di server." }, 400);
    }
    if (!/^[a-z0-9_]{3,512}$/.test(name)) {
      return c.json({
        error: "Nama template wajib 3-512 karakter, huruf kecil/angka/underscore.",
      }, 400);
    }
    if (!["MARKETING", "UTILITY", "AUTHENTICATION"].includes(category)) {
      return c.json({ error: "Kategori template harus MARKETING, UTILITY, atau AUTHENTICATION." }, 400);
    }
    if (!bodyText) {
      return c.json({ error: "Isi BODY template wajib diisi." }, 400);
    }

    const variables = normalizeKirimdevTemplateVariables({ content: bodyText });
    const bodyComponent: Record<string, unknown> = {
      type: "BODY",
      text: bodyText,
    };
    if (variables.length > 0) {
      bodyComponent.example = {
        body_text: [variables.map((_, index) => examples[index] || `Contoh ${index + 1}`)],
      };
    }

    const response = await fetchKirimdevJson(`/${encodeURIComponent(phoneNumberId)}/templates`, {
      method: "POST",
      body: JSON.stringify({
        name,
        category,
        language,
        components: [bodyComponent],
        variables,
      }),
    });

    const template = normalizeKirimdevTemplate(resolveKirimdevResponseData(response), phoneNumberId);
    return c.json({ success: true, template, response });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

async function listConversationsPageFromDatabase(options: {
  limit: number;
  before?: string | null;
  from?: string | null;
  to?: string | null;
  channelId?: string | null;
  provider?: string | null;
  status?: string | null;
  sla?: string | null;
  query?: string | null;
}) {
  try {
    const supabase = resolveSupabaseAdminClient();
    let query = supabase
      .from("whatsapp_conversations")
      .select("*")
      .like("channel_id", "whatsapp:%")
      .order("last_message_at", { ascending: false })
      .limit(options.limit);
    if (isValidTimestampFilter(options.before)) {
      query = query.lt("last_message_at", options.before as string);
    }
    if (isValidTimestampFilter(options.from)) {
      query = query.gte("last_message_at", options.from as string);
    }
    if (isValidTimestampFilter(options.to)) {
      query = query.lte("last_message_at", options.to as string);
    }
    query = applyWhatsAppConversationQueryFilters(query, options);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapDbRowToConversationRecord);
  } catch (error: any) {
    if (!isSupabaseSchemaError(error)) {
      console.warn("WhatsApp DB conversation page fallback.", error);
    }
    return [] as MetaConversationRecord[];
  }
}

function normalizeWhatsAppConversationSearch(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[%,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function applyWhatsAppConversationQueryFilters(
  query: any,
  options: {
    channelId?: string | null;
    provider?: string | null;
    status?: string | null;
    sla?: string | null;
    query?: string | null;
  },
) {
  if (options.channelId?.startsWith("whatsapp:")) {
    query = query.eq("channel_id", options.channelId);
  }
  if (options.provider === "kirimdev" || options.provider === "meta") {
    query = query.eq("provider", options.provider);
  }

  if (options.status === "unread") {
    query = query.gt("unread_count", 0);
  } else if (options.status === "open") {
    query = query.or(
      "conversation_status.is.null,and(conversation_status.not.ilike.%pending%,conversation_status.not.ilike.%resolved%,conversation_status.not.ilike.%closed%)",
    );
  } else if (options.status === "pending") {
    query = query.ilike("conversation_status", "%pending%");
  } else if (options.status === "resolved") {
    query = query.or("conversation_status.ilike.%resolved%,conversation_status.ilike.%closed%");
  }

  if (options.sla === "breached") {
    query = query.lt("last_message_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  } else if (options.sla === "at_risk") {
    const oldestOpen = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const atRiskStart = new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString();
    query = query.gte("last_message_at", oldestOpen).lte("last_message_at", atRiskStart);
  }

  const search = normalizeWhatsAppConversationSearch(options.query);
  if (search) {
    const pattern = `%${search}%`;
    query = query.or(
      `contact_name.ilike.${pattern},contact_phone.ilike.${pattern},last_message_text.ilike.${pattern}`,
    );
  }

  return query;
}

async function listSiblingConversationsFromDatabase(conversation: MetaConversationRecord) {
  const contactKey = getWhatsAppConversationContactKey(conversation);
  if (!contactKey) return [] as MetaConversationRecord[];

  try {
    const supabase = resolveSupabaseAdminClient();
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("channel_id", conversation.channelId)
      .or(`contact_id.eq.${contactKey},contact_phone.eq.${contactKey}`)
      .order("last_message_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data || []).map(mapDbRowToConversationRecord);
  } catch (error: any) {
    if (!isSupabaseSchemaError(error)) {
      console.warn("WhatsApp DB sibling conversation lookup fallback.", error);
    }
    return [] as MetaConversationRecord[];
  }
}

async function countWhatsAppConversations(
  build: (query: any) => any,
  options: {
    from?: string | null;
    to?: string | null;
    channelId?: string | null;
    provider?: string | null;
    status?: string | null;
    sla?: string | null;
    query?: string | null;
  },
) {
  try {
    const supabase = resolveSupabaseAdminClient();
    let query = supabase
      .from("whatsapp_conversations")
      .select("id", { count: "exact", head: true })
      .like("channel_id", "whatsapp:%");
    if (isValidTimestampFilter(options.from)) {
      query = query.gte("last_message_at", options.from as string);
    }
    if (isValidTimestampFilter(options.to)) {
      query = query.lte("last_message_at", options.to as string);
    }
    query = applyWhatsAppConversationQueryFilters(query, options);
    query = build(query);
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  } catch (error: any) {
    if (!isSupabaseSchemaError(error)) {
      console.warn("WhatsApp conversation count failed.", error);
    }
    return 0;
  }
}

async function buildWhatsAppConversationCounts(options: {
  from?: string | null;
  to?: string | null;
  channelId?: string | null;
  provider?: string | null;
  status?: string | null;
  sla?: string | null;
  query?: string | null;
}) {
  const slaThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [total, unread, slaBreached] = await Promise.all([
    countWhatsAppConversations((q) => q, options),
    countWhatsAppConversations((q) => q.gt("unread_count", 0), options),
    countWhatsAppConversations((q) => q.lt("last_message_at", slaThreshold), options),
  ]);
  return { total, unread, slaBreached };
}

async function buildWhatsAppFilterConversationCounts(options: {
  from?: string | null;
  to?: string | null;
  channelId?: string | null;
  provider?: string | null;
  status?: string | null;
  sla?: string | null;
  query?: string | null;
}) {
  const statusBaseOptions = { ...options, status: null };
  const slaBaseOptions = { ...options, sla: null };
  const slaThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const atRiskStart = new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString();

  const [
    statusAll,
    statusUnread,
    statusPending,
    statusResolved,
    slaAll,
    slaAtRisk,
    slaBreached,
  ] = await Promise.all([
    countWhatsAppConversations((q) => q, statusBaseOptions),
    countWhatsAppConversations((q) => q.gt("unread_count", 0), statusBaseOptions),
    countWhatsAppConversations((q) => q.ilike("conversation_status", "%pending%"), statusBaseOptions),
    countWhatsAppConversations(
      (q) => q.or("conversation_status.ilike.%resolved%,conversation_status.ilike.%closed%"),
      statusBaseOptions,
    ),
    countWhatsAppConversations((q) => q, slaBaseOptions),
    countWhatsAppConversations(
      (q) => q.gte("last_message_at", slaThreshold).lte("last_message_at", atRiskStart),
      slaBaseOptions,
    ),
    countWhatsAppConversations((q) => q.lt("last_message_at", slaThreshold), slaBaseOptions),
  ]);

  return {
    status: {
      all: statusAll,
      open: Math.max(0, statusAll - statusPending - statusResolved),
      unread: statusUnread,
      pending: statusPending,
      resolved: statusResolved,
    },
    sla: {
      all: slaAll,
      atRisk: slaAtRisk,
      breached: slaBreached,
    },
  };
}

async function buildWhatsAppAccountConversationCounts(
  options: {
    from?: string | null;
    to?: string | null;
    provider?: string | null;
    status?: string | null;
    sla?: string | null;
    query?: string | null;
  },
  channelIds: string[],
) {
  const entries = await Promise.all(
    channelIds.map(async (channelId) => [
      channelId,
      await countWhatsAppConversations((q) => q, {
        ...options,
        channelId,
      }),
    ] as const),
  );
  return Object.fromEntries(entries);
}

// Keyset-paginated, date-filterable WhatsApp inbox. Returns only one page so the
// client never has to load tens of thousands of conversations at once.
app.get("/whatsapp/conversations", async (c) => {
  try {
    const access = await requireMessagingPermission(c, "whatsapp.view");
    if ("error" in access && access.error) return access.error;

    const requestedLimit = Number.parseInt(c.req.query("limit") || "", 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(500, Math.max(1, requestedLimit))
      : 30;
    const before = c.req.query("before") || null;
    const from = c.req.query("from") || null;
    const to = c.req.query("to") || null;
    const channelId = c.req.query("channelId") || null;
    const provider = c.req.query("provider") || null;
    const status = c.req.query("status") || null;
    const sla = c.req.query("sla") || null;
    const searchQuery = c.req.query("query") || null;
    const includeCounts = readQueryBoolean(c.req.query("includeCounts"), true);
    const includeFilterCounts = includeCounts && readQueryBoolean(c.req.query("includeFilterCounts"), true);
    const includeAccountCounts = includeCounts && readQueryBoolean(c.req.query("includeAccountCounts"), true);

    const channels = await listStoredChannels();
    const allWhatsAppChannels = channels.filter((channel) => channel.platform === "whatsapp");
    const ownerByPhoneNumber = await buildWhatsAppAccountOwnerByPhoneNumber();
    const whatsappChannels = scopeWhatsAppChannelsForRequester(
      allWhatsAppChannels,
      ownerByPhoneNumber,
      access.requester,
    );
    const channelById = new Map(whatsappChannels.map((channel) => [channel.id, channel]));

    // Pull one extra row to know whether another page exists.
    const rawPage = await listConversationsPageFromDatabase({
      limit: limit + 1,
      before,
      from,
      to,
      channelId,
      provider,
      status,
      sla,
      query: searchQuery,
    });
    const scopedPage = scopeWhatsAppConversationsForRequester(
      rawPage.filter((conversation) =>
        conversation.channelId.startsWith("whatsapp:") &&
        Boolean(getWhatsAppConversationContactKey(conversation) || conversation.lastMessageText)
      ),
      allWhatsAppChannels,
      ownerByPhoneNumber,
      access.requester,
    );
    const hasMore = scopedPage.length > limit;
    const pageRows = scopedPage.slice(0, limit);
    const conversations = dedupeWhatsAppConversationViews(
      pageRows.map((conversation) =>
        normalizeWhatsAppConversationView(
          conversation,
          channelById.get(conversation.channelId) || null,
          0,
        ),
      ),
    );
    const nextCursor =
      hasMore && conversations.length > 0
        ? conversations[conversations.length - 1].lastMessageAt
        : null;

    const countSlaThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const approximateCounts = {
      total: conversations.length,
      unread: conversations.filter((conversation) => conversation.unreadCount > 0).length,
      slaBreached: conversations.filter((conversation) =>
        conversation.lastMessageAt < countSlaThreshold
      ).length,
    };
    const countOptions = {
      from,
      to,
      channelId,
      provider,
      status,
      sla,
      query: searchQuery,
    };
    const accountCountOptions = {
      from,
      to,
      provider,
      status,
      sla,
      query: searchQuery,
    };
    const [filterCounts, explicitCounts, accountCounts] = await Promise.all([
      includeFilterCounts ? buildWhatsAppFilterConversationCounts(countOptions) : Promise.resolve(null),
      includeCounts && !includeFilterCounts
        ? buildWhatsAppConversationCounts(countOptions)
        : Promise.resolve(null),
      includeAccountCounts
        ? buildWhatsAppAccountConversationCounts(
            accountCountOptions,
            whatsappChannels.map((channel) => channel.id),
          )
        : Promise.resolve(null),
    ]);
    const counts = includeCounts
      ? explicitCounts ||
        (filterCounts
          ? {
              total:
                status === "unread"
                  ? filterCounts.status.unread
                  : status === "open"
                  ? filterCounts.status.open
                  : status === "pending"
                  ? filterCounts.status.pending
                  : status === "resolved"
                  ? filterCounts.status.resolved
                  : filterCounts.status.all,
              unread: filterCounts.status.unread,
              slaBreached: filterCounts.sla.breached,
            }
          : approximateCounts)
      : approximateCounts;
    const allAccountCount = accountCounts
      ? Object.values(accountCounts).reduce((sum, count) => sum + count, 0)
      : null;

    return c.json({
      generatedAt: new Date().toISOString(),
      conversations,
      nextCursor,
      hasMore,
      counts,
      filterCounts,
      accountCounts,
      allAccountCount,
      countsApproximate: !includeCounts,
    });
  } catch (error: any) {
    console.error("WhatsApp conversations page error", error);
    return c.json({ error: error?.message || "Gagal memuat percakapan." }, 500);
  }
});

app.get("/whatsapp/overview", async (c) => {
  try {
    const access = await requireMessagingPermission(c, "whatsapp.view");
    if (access.error) return access.error;
    const requester = access.requester;

    const includePerformance = readQueryBoolean(c.req.query("includePerformance"), true);
    const includeContacts = readQueryBoolean(c.req.query("includeContacts"), true);
    const includeMessageCounts = readQueryBoolean(c.req.query("includeMessageCounts"), true);
    const includeConversations = readQueryBoolean(c.req.query("includeConversations"), true);

    const channels = await listStoredChannels();
    const allWhatsAppChannels = channels.filter((channel) => channel.platform === "whatsapp");
    const ownerByPhoneNumber = await buildWhatsAppAccountOwnerByPhoneNumber();
    const whatsappChannels = scopeWhatsAppChannelsForRequester(
      allWhatsAppChannels,
      ownerByPhoneNumber,
      requester,
    );
    const channelById = new Map(whatsappChannels.map((channel) => [channel.id, channel]));

    const conversations = includeConversations ? await listConversations() : [];
    const whatsappConversations = includeConversations
      ? scopeWhatsAppConversationsForRequester(
          conversations.filter((conversation) => conversation.channelId.startsWith("whatsapp:")),
          allWhatsAppChannels,
          ownerByPhoneNumber,
          requester,
        )
      : [];
    const contacts = includeContacts
      ? scopeWhatsAppContactViewsForRequester(
          await listWhatsAppContactViews(),
          requester,
        )
      : [];
    const contactAvatarByConversationKey = new Map<string, string>();
    for (const contact of contacts) {
      const avatarUrl = contact.avatarUrl;
      const contactKey = getWhatsAppConversationContactKey({
        contactPhone: contact.phoneNumber,
        contactId: contact.id,
      });
      if (!avatarUrl || !contactKey) continue;
      contactAvatarByConversationKey.set(`${contact.channelId}:${contactKey}`, avatarUrl);
    }
    const messageCountByConversation = includeMessageCounts
      ? await buildWhatsAppMessageCountByConversation(whatsappConversations)
      : new Map<string, number>();

    const conversationViews = dedupeWhatsAppConversationViews(
      whatsappConversations.map((conversation) => {
        const view = normalizeWhatsAppConversationView(
          conversation,
          channelById.get(conversation.channelId) || null,
          messageCountByConversation.get(conversation.id) || 0,
        );
        const contactKey = getWhatsAppConversationContactKey(view);
        const avatarUrl = contactKey
          ? contactAvatarByConversationKey.get(`${view.channelId}:${contactKey}`)
          : null;
        return {
          ...view,
          contactAvatarUrl: view.contactAvatarUrl || avatarUrl || null,
        };
      }),
    );

    const lastEventByChannel = new Map<string, string>();
    const countByChannel = new Map<string, number>();
    for (const conversation of conversationViews) {
      const current = lastEventByChannel.get(conversation.channelId);
      if (!current || conversation.lastMessageAt > current) {
        lastEventByChannel.set(conversation.channelId, conversation.lastMessageAt);
      }
      countByChannel.set(
        conversation.channelId,
        (countByChannel.get(conversation.channelId) || 0) + 1,
      );
    }

    const accounts = whatsappChannels.map((channel) => {
      const provider = channel.provider || "meta";
      const lastEventAt = lastEventByChannel.get(channel.id) || null;
      const accountOwner =
        ownerByPhoneNumber.get(
          firstComparableWhatsAppPhoneNumber(
            channel.whatsappDisplayPhoneNumber,
            channel.whatsappPhoneNumberId,
            channel.pageId,
          ),
        ) || null;
      const status = lastEventAt
        ? "connected"
        : provider === "kirimdev" && !(KIRIMDEV_WEBHOOK_SECRETS.length > 0)
        ? "not_configured"
        : "configured";
      return {
        id: channel.id,
        provider,
        phoneNumberId: channel.whatsappPhoneNumberId || channel.pageId,
        displayPhoneNumber: channel.whatsappDisplayPhoneNumber || null,
        label: formatChannelLabel(channel),
        status,
        subscribedFields: channel.subscribedFields || [],
        conversationCount: countByChannel.get(channel.id) || 0,
        csProfileId: accountOwner?.id || null,
        csDisplayName: accountOwner?.displayName || null,
        csWhatsappNumber: accountOwner?.whatsappNumber || null,
        csAssignmentStatus: accountOwner?.assignmentStatus || null,
        lastEventAt,
        updatedAt: channel.updatedAt,
      };
    });

    // Surface the configured Kirimdev number even if no event has arrived yet, so
    // the Accounts/Inbox Settings pages can show "configured / waiting for webhook".
    if (
      KIRIMDEV_PHONE_NUMBER_ID &&
      !channelById.has(`whatsapp:${KIRIMDEV_PHONE_NUMBER_ID}`)
    ) {
      const requesterProfileId = requester.profile?.id || requester.authUser?.id || "";
      const accountOwner =
        ownerByPhoneNumber.get(
          firstComparableWhatsAppPhoneNumber(
            KIRIMDEV_DISPLAY_PHONE_NUMBER,
            KIRIMDEV_PHONE_NUMBER_ID,
          ),
        ) || null;
      const canSurfaceConfiguredAccount =
        requester.role !== "CS" ||
        (requesterProfileId && accountOwner?.id === requesterProfileId);
      if (canSurfaceConfiguredAccount) {
        accounts.push({
        id: `whatsapp:${KIRIMDEV_PHONE_NUMBER_ID}`,
        provider: "kirimdev",
        phoneNumberId: KIRIMDEV_PHONE_NUMBER_ID,
        displayPhoneNumber: KIRIMDEV_DISPLAY_PHONE_NUMBER || null,
        label: KIRIMDEV_DISPLAY_PHONE_NUMBER
          ? `WhatsApp • ${KIRIMDEV_DISPLAY_PHONE_NUMBER}`
          : "WhatsApp • Kirimdev",
        status: KIRIMDEV_WEBHOOK_SECRETS.length > 0 ? "configured" : "not_configured",
        subscribedFields: [],
        conversationCount: 0,
        csProfileId: accountOwner?.id || null,
        csDisplayName: accountOwner?.displayName || null,
        csWhatsappNumber: accountOwner?.whatsappNumber || null,
        csAssignmentStatus: accountOwner?.assignmentStatus || null,
        lastEventAt: null,
        updatedAt: new Date().toISOString(),
        });
      }
    }

    const latestEventAt = conversationViews.reduce<string | null>((latest, conversation) => {
      if (!latest || conversation.lastMessageAt > latest) return conversation.lastMessageAt;
      return latest;
    }, null);

    const kirimdevCount = conversationViews.filter((row) => row.provider === "kirimdev").length;
    const performance = includePerformance
      ? await buildWhatsAppCsPerformanceSummary({
          conversations: includeConversations
            ? whatsappConversations
            : scopeWhatsAppConversationsForRequester(
                (await listConversations()).filter((conversation) => conversation.channelId.startsWith("whatsapp:")),
                allWhatsAppChannels,
                ownerByPhoneNumber,
                requester,
              ),
          channels: whatsappChannels,
          ownerByPhoneNumber,
        })
      : undefined;

    return c.json({
      generatedAt: new Date().toISOString(),
      accounts,
      conversations: conversationViews,
      ...(performance ? { performance } : {}),
      kirimdev: buildKirimdevStatus(
        kirimdevCount
          ? conversationViews
              .filter((row) => row.provider === "kirimdev")
              .reduce<string | null>(
                (latest, row) =>
                  !latest || row.lastMessageAt > latest ? row.lastMessageAt : latest,
                null,
              )
          : null,
        kirimdevCount,
      ),
      diagnostics: {
        conversationCount: conversationViews.length,
        contactCount: contacts.length,
        accountCount: accounts.length,
        providerCounts: {
          meta: conversationViews.length - kirimdevCount,
          kirimdev: kirimdevCount,
        },
        latestEventAt,
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.get("/whatsapp/contacts", async (c) => {
  try {
    const access = await requireMessagingPermission(c, "whatsapp.view");
    if (access.error) return access.error;

    const contacts = scopeWhatsAppContactViewsForRequester(
      await listWhatsAppContactViews(),
      access.requester,
    );
    return c.json({ contacts });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.get("/whatsapp/broadcasts", async (c) => {
  try {
    const access = await requireMessagingPermission(c, "whatsapp.broadcast.manage");
    if (access.error) return access.error;

    const limit = clampPositiveInteger(c.req.query("limit"), 25, 100);
    return c.json({
      broadcasts: await listWhatsAppBroadcasts(limit),
      maxRecipientsPerRun: KIRIMDEV_BROADCAST_MAX_RECIPIENTS,
      sendDelayMs: KIRIMDEV_BROADCAST_SEND_DELAY_MS,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.post("/whatsapp/broadcasts", async (c) => {
  try {
    const access = await requireMessagingPermission(c, "whatsapp.broadcast.manage");
    if (access.error) return access.error;

    const body = await c.req.json();
    const campaignName =
      typeof body?.campaignName === "string" && body.campaignName.trim()
        ? body.campaignName.trim()
        : `Broadcast ${new Date().toISOString()}`;
    const templateName =
      typeof body?.templateName === "string" ? body.templateName.trim() : "";
    const language =
      typeof body?.language === "string" && body.language.trim() ? body.language.trim() : "id";
    const phoneNumberId =
      typeof body?.phoneNumberId === "string" && body.phoneNumberId.trim()
        ? body.phoneNumberId.trim()
        : KIRIMDEV_PHONE_NUMBER_ID;
    const acknowledgedOptIn = body?.acknowledgedOptIn === true;
    const bodyParameters = asArray<KirimdevTemplateParameter>(body?.bodyParameters)
      .map((parameter) => ({
        name:
          typeof parameter?.name === "string"
            ? parameter.name.replace(/[{}]/g, "").trim() || null
            : null,
        text: typeof parameter?.text === "string" ? parameter.text.trim() : "",
      }))
      .filter((parameter) => parameter.text);

    if (!acknowledgedOptIn) {
      return c.json({
        error: "Konfirmasi opt-in wajib dicentang sebelum mengirim broadcast WhatsApp.",
      }, 400);
    }
    if (!phoneNumberId) {
      return c.json({ error: "KIRIMDEV_PHONE_NUMBER_ID belum dikonfigurasi di server." }, 400);
    }
    if (!templateName) {
      return c.json({ error: "Template broadcast wajib dipilih." }, 400);
    }

    const templates = await listKirimdevTemplates({
      phoneNumberId,
      status: "all",
      limit: 100,
    });
    const selectedTemplate = templates.templates.find(
      (template) => template.name === templateName && template.language === language,
    );
    if (!selectedTemplate) {
      return c.json({ error: "Template tidak ditemukan di Kirimdev untuk nomor ini." }, 404);
    }
    if (selectedTemplate.status !== "approved") {
      return c.json({ error: "Broadcast hanya boleh memakai template yang sudah approved." }, 400);
    }

    const recipients = asArray<any>(body?.recipients)
      .map((recipient) => ({
        contactId: typeof recipient?.contactId === "string" ? recipient.contactId.trim() : null,
        phoneNumber: normalizeWhatsAppPhoneNumber(recipient?.phoneNumber),
        name:
          typeof recipient?.name === "string" && recipient.name.trim()
            ? recipient.name.trim()
            : null,
      }))
      .filter((recipient) => recipient.phoneNumber);
    const uniqueRecipients = Array.from(
      new Map(recipients.map((recipient) => [recipient.phoneNumber, recipient])).values(),
    );

    if (uniqueRecipients.length === 0) {
      return c.json({ error: "Pilih minimal satu kontak dengan nomor WhatsApp valid." }, 400);
    }
    if (uniqueRecipients.length > KIRIMDEV_BROADCAST_MAX_RECIPIENTS) {
      return c.json({
        error: `Maksimal ${KIRIMDEV_BROADCAST_MAX_RECIPIENTS} penerima per sekali broadcast dari app.`,
      }, 400);
    }

    const broadcastId = `wab_${Date.now()}_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const results: WhatsAppBroadcastRecipientResult[] = [];

    for (let index = 0; index < uniqueRecipients.length; index += 1) {
      const recipient = uniqueRecipients[index];
      try {
        const result = await sendKirimdevTemplateMessage({
          phoneNumberId,
          to: recipient.phoneNumber,
          templateName,
          language,
          bodyParameters: resolveBroadcastBodyParametersForRecipient(
            bodyParameters,
            recipient,
            campaignName,
          ),
          idempotencyKey: `${broadcastId}:${recipient.phoneNumber}`,
        });
        results.push({
          contactId: recipient.contactId,
          phoneNumber: recipient.phoneNumber,
          name: recipient.name,
          status: "sent",
          messageId: result.message.id,
          error: null,
          sentAt: result.message.timestamp,
        });
      } catch (err: any) {
        results.push({
          contactId: recipient.contactId,
          phoneNumber: recipient.phoneNumber,
          name: recipient.name,
          status: "failed",
          messageId: null,
          error: err?.message || "Gagal mengirim template.",
          sentAt: null,
        });
      }

      if (KIRIMDEV_BROADCAST_SEND_DELAY_MS > 0 && index < uniqueRecipients.length - 1) {
        await sleep(KIRIMDEV_BROADCAST_SEND_DELAY_MS);
      }
    }

    const successCount = results.filter((result) => result.status === "sent").length;
    const failureCount = results.length - successCount;
    const record: WhatsAppBroadcastRecord = {
      id: broadcastId,
      provider: "kirimdev",
      campaignName,
      phoneNumberId,
      templateName,
      language,
      bodyParameters,
      recipientCount: uniqueRecipients.length,
      successCount,
      failureCount,
      status:
        failureCount === 0
          ? "completed"
          : successCount > 0
          ? "partial_failed"
          : "failed",
      createdAt,
      createdBy: access.requester?.authUser.id || null,
      results,
    };

    await kv.set(buildWhatsAppBroadcastStorageKey(broadcastId), record);

    return c.json({
      success: failureCount === 0,
      broadcast: record,
      maxRecipientsPerRun: KIRIMDEV_BROADCAST_MAX_RECIPIENTS,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.get("/whatsapp/messages", async (c) => {
  try {
    const access = await requireMessagingPermission(c, "whatsapp.view");
    if (access.error) return access.error;

    const conversationId = c.req.query("conversationId");
    if (!conversationId) {
      return c.json({ error: "conversationId wajib diisi." }, 400);
    }

    const shouldSync = c.req.query("sync") === "true";
    const messageLimit = clampPositiveInteger(c.req.query("limit"), 50, 100);
    const beforeCursor = c.req.query("before") || c.req.query("cursor") || null;
    const syncLimit = clampPositiveInteger(c.req.query("syncLimit"), 25, 100);
    const syncMaxPages = clampPositiveInteger(c.req.query("maxPages"), 5, 10);
    const conversation = await getStoredConversation(conversationId);
    if (!conversation) {
      return c.json({ error: "Percakapan WhatsApp tidak ditemukan." }, 404);
    }
    if (!conversation.channelId.startsWith("whatsapp:")) {
      return c.json({ error: "Endpoint ini hanya untuk percakapan WhatsApp." }, 400);
    }

    const channels = await listStoredChannels();
    const ownerByPhoneNumber = await buildWhatsAppAccountOwnerByPhoneNumber();
    const requesterScopedConversation = scopeWhatsAppConversationsForRequester(
      [conversation],
      channels.filter((channel) => channel.platform === "whatsapp"),
      ownerByPhoneNumber,
      access.requester,
    )[0];
    if (!requesterScopedConversation) {
      return c.json({ error: "Forbidden: Percakapan ini bukan handle CS Anda." }, 403);
    }

    let siblingConversations = await findSiblingWhatsAppConversations(conversation);
    siblingConversations = scopeWhatsAppConversationsForRequester(
      siblingConversations,
      channels.filter((channel) => channel.platform === "whatsapp"),
      ownerByPhoneNumber,
      access.requester,
    );
    const hasKirimdevHistoryCursor = siblingConversations.some(
      (siblingConversation) =>
        siblingConversation.provider === "kirimdev" &&
        Boolean(getKirimdevConversationId(siblingConversation)),
    );
    const shouldRecoverKirimdevHistory =
      shouldSync &&
      siblingConversations.some((siblingConversation) => siblingConversation.provider === "kirimdev") &&
      !hasKirimdevHistoryCursor;
    if (shouldRecoverKirimdevHistory) {
      let recoveredConversation: MetaConversationRecord | null = null;
      try {
        recoveredConversation = await hydrateKirimdevConversationForContact(conversation);
      } catch (error) {
        console.warn("Gagal backfill conversation Kirimdev untuk WhatsApp thread.", error);
      }
      if (recoveredConversation) {
        siblingConversations = await findSiblingWhatsAppConversations(recoveredConversation);
        siblingConversations = scopeWhatsAppConversationsForRequester(
          siblingConversations,
          channels.filter((channel) => channel.platform === "whatsapp"),
          ownerByPhoneNumber,
          access.requester,
        );
      }
    }

    let syncResult = { synced: 0, hasMore: false, nextCursor: null as string | null };
    if (shouldSync) {
      for (const siblingConversation of siblingConversations) {
        if (siblingConversation.provider !== "kirimdev") continue;
        const result = await syncKirimdevMessagesForConversation(siblingConversation, {
          limit: syncLimit,
          maxPages: syncMaxPages,
        });
        syncResult = {
          synced: syncResult.synced + result.synced,
          hasMore: syncResult.hasMore || result.hasMore,
          nextCursor: result.nextCursor || syncResult.nextCursor,
        };
      }
    }

    const rows = (
      await Promise.all(
        siblingConversations.map((siblingConversation) =>
          listMessagesForConversation(siblingConversation.id, {
            before: beforeCursor,
            descending: true,
            limit: messageLimit + 1,
          }),
        ),
      )
    ).flat();
    // Delivery-callback-only records (whatsapp_status_*) carry no body; they update
    // the conversation's lastStatus instead of showing as empty chat bubbles.
    const page = sliceLatestWhatsAppMessageViews(
      dedupeWhatsAppMessageViews(
        rows
          .filter((row) => !(row.eventType || "").startsWith("whatsapp_status_"))
          .map(normalizeWhatsAppMessageView),
      ),
      messageLimit,
    );

    return c.json({
      messages: page.messages,
      mergedConversationIds: siblingConversations.map((siblingConversation) => siblingConversation.id),
      synced: syncResult.synced,
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
      syncHasMore: syncResult.hasMore,
      syncNextCursor: syncResult.nextCursor,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.post("/whatsapp/media-upload", async (c) => {
  try {
    const access = await requireMessagingPermission(c, "whatsapp.chats.reply");
    if (access.error) return access.error;
    const requester = access.requester;

    const formData = await c.req.raw.formData();
    const file = formData.get("file");
    const requestedType = formData.get("type");
    if (!(file instanceof File)) {
      return c.json({ error: "File lampiran WhatsApp wajib diisi." }, 400);
    }

    const media = await uploadWhatsAppOutboundMedia({
      file,
      requestedType: typeof requestedType === "string" ? requestedType : null,
      userId: requester.authUser.id,
    });

    return c.json({
      success: true,
      media,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.post("/whatsapp/send", async (c) => {
  try {
    const access = await requireMessagingPermission(c, "whatsapp.chats.reply");
    if (access.error) return access.error;

    const body = await c.req.json();
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId.trim() : "";
    const channelId = typeof body?.channelId === "string" ? body.channelId.trim() : "";
    const explicitTo = typeof body?.to === "string" ? body.to.trim() : "";
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const replyToMessageId =
      typeof body?.replyToMessageId === "string" ? body.replyToMessageId.trim() : "";
    const idempotencyKey =
      typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    const mediaInput =
      body?.media && typeof body.media === "object" && !Array.isArray(body.media)
        ? (body.media as Record<string, unknown>)
        : null;
    const mediaType = isKirimdevOutboundMediaType(mediaInput?.type) ? mediaInput.type : null;
    const mediaUrl = typeof mediaInput?.url === "string" ? mediaInput.url.trim() : "";
    const mediaFileName =
      typeof mediaInput?.fileName === "string" ? mediaInput.fileName.trim() : "";
    const mediaMimeType =
      typeof mediaInput?.mimeType === "string" ? mediaInput.mimeType.trim() : "";

    if (!text && !mediaInput) {
      return c.json({ error: "Isi pesan WhatsApp wajib diisi." }, 400);
    }
    if (mediaInput && (!mediaType || !mediaUrl)) {
      return c.json({ error: "Tipe dan URL media WhatsApp wajib diisi." }, 400);
    }

    let conversation: MetaConversationRecord | null = null;
    if (conversationId) {
      conversation = await getStoredConversation(conversationId);
      if (!conversation) {
        return c.json({ error: "Percakapan WhatsApp tidak ditemukan." }, 404);
      }
      if (!conversation.channelId.startsWith("whatsapp:")) {
        return c.json({ error: "Endpoint ini hanya untuk percakapan WhatsApp." }, 400);
      }

      const channels = await listStoredChannels();
      const ownerByPhoneNumber = await buildWhatsAppAccountOwnerByPhoneNumber();
      const scopedConversation = scopeWhatsAppConversationsForRequester(
        [conversation],
        channels.filter((channel) => channel.platform === "whatsapp"),
        ownerByPhoneNumber,
        access.requester,
      )[0];
      if (!scopedConversation) {
        return c.json({ error: "Forbidden: Percakapan ini bukan handle CS Anda." }, 403);
      }
    }

    const resolvedChannelId = channelId || conversation?.channelId || "";
    const phoneNumberId =
      getPhoneNumberIdFromChannelId(resolvedChannelId) || KIRIMDEV_PHONE_NUMBER_ID;
    const to = explicitTo || conversation?.contactPhone || conversation?.contactId || "";

    const result = mediaType
      ? await sendKirimdevMediaMessage({
          phoneNumberId,
          to,
          type: mediaType,
          mediaUrl,
          caption: text,
          fileName: mediaFileName,
          mimeType: mediaMimeType,
          replyToMessageId,
          idempotencyKey,
        })
      : await sendKirimdevTextMessage({
          phoneNumberId,
          to,
          text,
          replyToMessageId,
          idempotencyKey,
        });

    return c.json({
      success: true,
      provider: "kirimdev",
      response: result.response,
      message: normalizeWhatsAppMessageView(result.message),
      conversation: normalizeWhatsAppConversationView(result.conversation, null, 1),
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

export function handleMetaMessagingWebhookVerify(c: any) {
  const mode = c.req.query("hub.mode");
  const verifyToken = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (!META_MESSAGING_VERIFY_TOKEN) {
    return c.text("META_MESSAGING_VERIFY_TOKEN belum diatur.", 503);
  }

  if (mode === "subscribe" && verifyToken === META_MESSAGING_VERIFY_TOKEN && challenge) {
    return c.text(challenge, 200);
  }

  return c.text("Forbidden", 403);
}

export async function handleMetaMessagingWebhookReceive(c: any) {
  try {
    const rawBody = await c.req.raw.text();
    const signatureHeader =
      c.req.header("x-hub-signature-256") || c.req.header("X-Hub-Signature-256") || null;

    const isValid = await verifyWebhookSignature(rawBody, signatureHeader);
    if (!isValid) {
      return c.json({ error: "Invalid Meta webhook signature." }, 401);
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const receivedAt = new Date().toISOString();

    await kv.set(buildWebhookEventKey(), {
      receivedAt,
      headers: {
        signature: signatureHeader,
      },
      payload,
    });

    const result = await ingestMetaWebhookPayload(payload, receivedAt);
    return c.json({
      success: true,
      result,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
}

app.get("/webhook", handleMetaMessagingWebhookVerify);
app.post("/webhook", handleMetaMessagingWebhookReceive);

// Kirimdev WhatsApp webhook (separate signing scheme: X-Kirim-Signature).
app.get("/webhook/kirimdev", handleKirimdevWebhookVerify);
app.post("/webhook/kirimdev", handleKirimdevWebhookReceive);

export default app;
