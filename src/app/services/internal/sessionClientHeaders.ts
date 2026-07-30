import { supabase } from '@/lib/supabaseClient';
import { publicAnonKey } from '/utils/supabase/info';

type EdgeHeadersOptions = {
  headers?: HeadersInit;
  includeJsonContentType?: boolean;
};

async function refreshSessionAccessToken() {
  const {
    data: { session: refreshedSession },
    error: refreshError,
  } = await supabase.auth.refreshSession();

  if (refreshError) {
    await supabase.auth.signOut();
    throw new Error('Sesi login sudah kedaluwarsa. Silakan login ulang.');
  }

  if (!refreshedSession?.access_token) {
    await supabase.auth.signOut();
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
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  const session = data.session;

  if (!session?.access_token) {
    throw new Error('Session login tidak ditemukan. Silakan login ulang.');
  }

  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
  const shouldRefresh = !expiresAtMs || expiresAtMs - Date.now() < 60_000;

  if (shouldRefresh) {
    return refreshSessionAccessToken();
  }

  const { error: userError } = await supabase.auth.getUser(session.access_token);

  if (userError) {
    return refreshSessionAccessToken();
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
