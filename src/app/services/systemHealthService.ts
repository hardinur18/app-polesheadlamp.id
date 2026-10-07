import { publicAnonKey, supabaseUrl } from '/utils/supabase/info';
import { buildMakeServerUrl } from './internal/functionsBaseUrl';
import { fetchWithTimeout } from './internal/fetchWithTimeout';

export type SystemHealthCheckKey = 'auth' | 'edge';

export type SystemHealthCheck = {
  key: SystemHealthCheckKey;
  label: string;
  ok: boolean;
  ms: number;
  detail?: string;
};

const HEALTH_TIMEOUT_MS = 4_000;

const measure = async (
  key: SystemHealthCheckKey,
  label: string,
  run: () => Promise<Response>,
): Promise<SystemHealthCheck> => {
  const startedAt = Date.now();

  try {
    const response = await run();
    const ms = Date.now() - startedAt;

    return {
      key,
      label,
      ok: response.ok,
      ms,
      detail: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      key,
      label,
      ok: false,
      ms: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : 'Tidak merespons',
    };
  }
};

export async function probeSystemHealth() {
  const checks = await Promise.all([
    measure('auth', 'Auth', () =>
      fetchWithTimeout(
        `${supabaseUrl}/auth/v1/settings`,
        {
          headers: {
            apikey: publicAnonKey,
          },
        },
        HEALTH_TIMEOUT_MS,
        'Auth Supabase timeout',
      ),
    ),
    measure('edge', 'Edge Function', () =>
      fetchWithTimeout(
        buildMakeServerUrl('/health'),
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
        HEALTH_TIMEOUT_MS,
        'Edge Function timeout',
      ),
    ),
  ]);

  return {
    checkedAt: new Date().toISOString(),
    checks,
    ok: checks.every((check) => check.ok),
  };
}
