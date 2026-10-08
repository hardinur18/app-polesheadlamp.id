import {
  KIRIMDEV_API_BASE_URL,
  KIRIMDEV_API_KEY,
  META_ACCESS_TOKEN,
  META_APP_ID,
  META_APP_SECRET,
  META_DM_USER_TOKEN,
  META_GRAPH_VERSION,
} from "./meta_messaging_config.ts";
import { createAppSecretProof } from "./meta_messaging_signature.ts";

export async function fetchMetaJson(url: string, init?: RequestInit) {
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

export async function fetchKirimdevJson(path: string, init?: RequestInit) {
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

export async function fetchMetaPaged<T>(
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

export async function fetchMetaAbsolutePaged<T>(
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

export async function debugCurrentMetaToken() {
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
