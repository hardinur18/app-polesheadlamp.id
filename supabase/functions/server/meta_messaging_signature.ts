import {
  KIRIMDEV_WEBHOOK_SECRETS,
  KIRIMDEV_WEBHOOK_TOLERANCE_SECONDS,
  META_APP_SECRET,
} from "./meta_messaging_config.ts";
import { compareStrings } from "./meta_messaging_utils.ts";

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

export async function createAppSecretProof(accessToken: string) {
  if (!META_APP_SECRET) return null;
  return createHmacHex(META_APP_SECRET, accessToken);
}

export async function verifyWebhookSignature(rawBody: string, signatureHeader: string | null) {
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
export async function verifyKirimdevSignature(rawBody: string, signatureHeader: string | null) {
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
