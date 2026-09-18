import { createClient } from '@supabase/supabase-js';
import {
  isSupabaseConfigured,
  publicAnonKey,
  supabaseUrl,
} from '/utils/supabase/info';

const SUPABASE_REQUEST_TIMEOUT_MS = 45_000;

const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  let didTimeout = false;

  const handleUpstreamAbort = () => {
    controller.abort(upstreamSignal?.reason);
  };

  if (upstreamSignal?.aborted) {
    handleUpstreamAbort();
  } else {
    upstreamSignal?.addEventListener('abort', handleUpstreamAbort, { once: true });
  }

  const timeoutId = globalThis.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, SUPABASE_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (didTimeout) {
      throw new Error('Koneksi Supabase timeout. Coba ulang beberapa detik lagi.');
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    upstreamSignal?.removeEventListener('abort', handleUpstreamAbort);
  }
};

// Inisialisasi Client
// Client ini akan digunakan di seluruh aplikasi untuk interaksi DB, Auth, dan Storage
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? publicAnonKey : 'missing-supabase-anon-key',
  {
    global: {
      fetch: fetchWithTimeout,
    },
  },
);
