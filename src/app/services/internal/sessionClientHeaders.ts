import { supabase } from '@/lib/supabaseClient';
import { projectId, publicAnonKey, supabaseUrl } from '/utils/supabase/info';
import { isRetryableAuthError } from './authErrorUtils';

type EdgeHeadersOptions = {
  headers?: HeadersInit;
  includeJsonContentType?: boolean;
};

let inFlightAccessTokenRefresh: Promise<string> | null = null;
const TOKEN_REFRESH_GRACE_MS = 15_000;
const SESSION_READ_TIMEOUT_MS = 3_000;
const SESSION_REFRESH_TIMEOUT_MS = 8_000;
const CACHED_TOKEN_SKEW_MS = 30_000;
const AUTH_SERVER_UNAVAILABLE_MESSAGE =
  'Server auth Supabase belum merespons. Ini bukan indikasi password salah; coba lagi setelah koneksi server normal.';

let lastKnownAccessToken: {
  token: string;
  expiresAtMs: number;
} | null = null;

function withAuthTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) globalThis.clearTimeout(timeoutId);
  });
}

function rememberAccessToken(session?: { access_token?: string | null; expires_at?: number | null } | null) {
  if (!session?.access_token) return;
  if (!isSessionTokenForCurrentProject(session.access_token)) return;

  lastKnownAccessToken = {
    token: session.access_token,
    expiresAtMs: session.expires_at ? session.expires_at * 1000 : Date.now() + 5 * 60_000,
  };
}

function getUsableCachedAccessToken() {
  if (!lastKnownAccessToken) return null;
  if (!isSessionTokenForCurrentProject(lastKnownAccessToken.token)) {
    lastKnownAccessToken = null;
    return null;
  }
  if (lastKnownAccessToken.expiresAtMs - Date.now() <= CACHED_TOKEN_SKEW_MS) return null;
  return lastKnownAccessToken.token;
}

function decodeJwtPayload(token?: string | null) {
  if (!token) return null;

  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '=',
    );
    return JSON.parse(globalThis.atob(paddedPayload)) as { iss?: string; exp?: number };
  } catch {
    return null;
  }
}

function isSessionTokenForCurrentProject(token?: string | null) {
  const expectedIssuer = supabaseUrl ? `${supabaseUrl.replace(/\/+$/, '')}/auth/v1` : '';
  if (!expectedIssuer) return true;

  return decodeJwtPayload(token)?.iss === expectedIssuer;
}

function readStoredSupabaseSession() {
  if (typeof window === 'undefined') return null;

  const candidateKeys = [
    projectId ? `sb-${projectId}-auth-token` : '',
    ...Object.keys(window.localStorage || {}).filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token')),
  ].filter(Boolean);

  for (const key of Array.from(new Set(candidateKeys))) {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || 'null');
      const session = parsed?.currentSession || parsed?.session || parsed;
      if (!session?.access_token) continue;
      if (!isSessionTokenForCurrentProject(session.access_token)) continue;

      const expiresAtMs = session.expires_at ? Number(session.expires_at) * 1000 : 0;
      if (expiresAtMs && expiresAtMs - Date.now() <= CACHED_TOKEN_SKEW_MS) continue;

      rememberAccessToken(session);
      return session as { access_token: string; expires_at?: number | null };
    } catch {
      // Ignore malformed or unrelated storage records.
    }
  }

  return null;
}

async function refreshSessionAccessToken() {
  if (inFlightAccessTokenRefresh) {
    return inFlightAccessTokenRefresh;
  }

  inFlightAccessTokenRefresh = refreshSessionAccessTokenNow().finally(() => {
    inFlightAccessTokenRefresh = null;
  });

  return inFlightAccessTokenRefresh;
}

async function refreshSessionAccessTokenNow() {
  const {
    data: { session: cachedSession },
  } = await withAuthTimeout(
    supabase.auth.getSession(),
    SESSION_READ_TIMEOUT_MS,
    'Koneksi auth terlalu lama saat membaca session.',
  );
  rememberAccessToken(cachedSession);

  const {
    data: { session: refreshedSession },
    error: refreshError,
  } = await withAuthTimeout(
    supabase.auth.refreshSession(),
    SESSION_REFRESH_TIMEOUT_MS,
    'Koneksi auth terlalu lama saat memperbarui session.',
  );

  if (refreshError) {
    if (isRetryableAuthError(refreshError) && cachedSession?.access_token) {
      console.warn('[Auth] Session refresh temporarily failed; reusing cached token for this request.');
      return cachedSession.access_token;
    }

    throw new Error('Sesi login sudah kedaluwarsa. Silakan login ulang.');
  }

  rememberAccessToken(refreshedSession);

  if (!refreshedSession?.access_token) {
    if (cachedSession?.access_token) {
      console.warn('[Auth] Session refresh returned no token; reusing cached token for this request.');
      return cachedSession.access_token;
    }

    throw new Error('Session login tidak ditemukan. Silakan login ulang.');
  }

  return refreshedSession.access_token;
}

function mergeHeaders(...parts: Array<HeadersInit | undefined>) {
  const headers = new Headers();

  for (const part of parts) {
    if (!part) continue;

    const nextHeaders = new Headers(part);
    nextHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return Object.fromEntries(headers.entries());
}

export async function getSessionAccessToken() {
  const storedSession = readStoredSupabaseSession();
  if (storedSession?.access_token) {
    return storedSession.access_token;
  }

  let data: Awaited<ReturnType<typeof supabase.auth.getSession>>['data'];
  let error: Awaited<ReturnType<typeof supabase.auth.getSession>>['error'];

  try {
    const response = await withAuthTimeout(
      supabase.auth.getSession(),
      SESSION_READ_TIMEOUT_MS,
      'Koneksi auth terlalu lama saat membaca session.',
    );
    data = response.data;
    error = response.error;
  } catch (sessionError) {
    const cachedToken = getUsableCachedAccessToken();
    if (cachedToken) {
      console.warn('[Auth] Session read temporarily failed; reusing cached token for this request.');
      return cachedToken;
    }

    throw sessionError instanceof Error
      ? sessionError
      : new Error(AUTH_SERVER_UNAVAILABLE_MESSAGE);
  }

  if (error) {
    const cachedToken = getUsableCachedAccessToken();
    if (isRetryableAuthError(error) && cachedToken) {
      console.warn('[Auth] Session read returned a retryable error; reusing cached token for this request.');
      return cachedToken;
    }

    throw new Error(error.message);
  }

  const session = data.session;
  rememberAccessToken(session);

  if (!session?.access_token) {
    const cachedToken = getUsableCachedAccessToken();
    if (cachedToken) {
      console.warn('[Auth] Session read returned no token; reusing cached token for this request.');
      return cachedToken;
    }

    throw new Error('Session login tidak ditemukan. Silakan login ulang.');
  }

  if (!isSessionTokenForCurrentProject(session.access_token)) {
    throw new Error('Session login tidak cocok dengan project aplikasi ini. Silakan login ulang.');
  }

  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
  const shouldRefresh = Boolean(expiresAtMs) && expiresAtMs - Date.now() < TOKEN_REFRESH_GRACE_MS;

  if (shouldRefresh) {
    try {
      return await refreshSessionAccessToken();
    } catch (refreshError) {
      const cachedToken = getUsableCachedAccessToken();
      if (cachedToken) {
        console.warn('[Auth] Session refresh failed temporarily; reusing cached token for this request.');
        return cachedToken;
      }

      throw refreshError instanceof Error
        ? refreshError
        : new Error(AUTH_SERVER_UNAVAILABLE_MESSAGE);
    }
  }

  return session.access_token;
}

export function getPublicEdgeHeaders(options: EdgeHeadersOptions = {}) {
  return mergeHeaders(
    options.includeJsonContentType ? { 'Content-Type': 'application/json' } : undefined,
    { Authorization: `Bearer ${publicAnonKey}` },
    options.headers,
  );
}

export async function getSessionBackedEdgeHeaders(options: EdgeHeadersOptions = {}) {
  const token = await getSessionAccessToken();

  return mergeHeaders(
    options.includeJsonContentType ? { 'Content-Type': 'application/json' } : undefined,
    {
      Authorization: `Bearer ${publicAnonKey}`,
      'x-client-token': token,
    },
    options.headers,
  );
}
