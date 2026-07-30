import { createClient } from '@supabase/supabase-js';

function parseArgs(argv) {
  const parsed = {};

  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const [rawKey, rawValue] = item.slice(2).split('=');
    parsed[rawKey] = rawValue ?? 'true';
  }

  return parsed;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseRetryAfterSeconds(message) {
  const matched = String(message).match(/retry in\s+(\d+)\s+seconds?/i);
  if (!matched) return null;

  const seconds = Number(matched[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function formatRetryDelay(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}j ${Math.max(minutes, 0)}m`;
  }

  return `${Math.max(minutes, 1)}m`;
}

function formatError(error) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const status = error.status || error.code;
  return status ? `${error.message} (${status})` : error.message;
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function isGoogleAuthDisconnectError(error) {
  const message = error instanceof Error ? error.message : String(error);

  return /invalid_grant/i.test(message) || /google.+oauth.+refresh/i.test(message);
}

function escapeGithubCommand(value) {
  return String(value).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

function emitGithubWarning(title, message) {
  if (!process.env.GITHUB_ACTIONS) return;

  console.warn(
    `::warning title=${escapeGithubCommand(title)}::${escapeGithubCommand(message)}`,
  );
}

async function callFunction(url, anonKey, userToken, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${anonKey}`,
      'x-client-token': userToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  const payload = (() => {
    try {
      return rawText ? JSON.parse(rawText) : {};
    } catch {
      return {};
    }
  })();

  if (!response.ok) {
    const detail =
      payload?.error ||
      payload?.message ||
      rawText ||
      `Function call gagal (${response.status})`;
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  return payload;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const historyDays = Math.max(1, Number(args['history-days'] || 90));
  const historyMinFreshMinutes = Math.max(0, Number(args['history-min-fresh'] || 720));
  const todayMinFreshMinutes = Math.max(0, Number(args['today-min-fresh'] || 10));
  const authSoftFail =
    isTruthy(args['auth-soft-fail']) ||
    isTruthy(process.env.GOOGLE_ADS_SNAPSHOT_AUTH_SOFT_FAIL);

  const now = new Date();
  const today = formatDate(now);
  const yesterday = formatDate(addUtcDays(now, -1));
  const historyFrom = formatDate(addUtcDays(now, -historyDays));

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  const functionsBaseUrl =
    process.env.VITE_FUNCTIONS_BASE_URL ||
    `${supabaseUrl}/functions/v1/make-server-f781cd00`;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error(
      'SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, dan SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY wajib tersedia.',
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const publicClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tempEmail = `codex-google-refresh-${Date.now()}@polesheadlamp.local`;
  const tempPassword = `CodexGoogle!${Math.random().toString(36).slice(2, 10)}`;

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email: tempEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      name: 'Codex Google Snapshot Refresh',
    },
  });

  if (createError || !createdUser.user) {
    throw new Error(
      `Supabase Auth admin createUser gagal: ${
        createError ? formatError(createError) : 'user tidak terbentuk'
      }`,
    );
  }

  const summaries = [];

  try {
    const { data: signInData, error: signInError } = await publicClient.auth.signInWithPassword({
      email: tempEmail,
      password: tempPassword,
    });

    if (signInError || !signInData.session?.access_token) {
      throw new Error(
        `Supabase Auth signInWithPassword gagal: ${
          signInError ? formatError(signInError) : 'session token kosong'
        }`,
      );
    }

    const userToken = signInData.session.access_token;

    const windows = [
      {
        label: 'history',
        from: historyFrom,
        to: yesterday,
        minFreshMinutes: historyMinFreshMinutes,
      },
      {
        label: 'today',
        from: today,
        to: today,
        minFreshMinutes: todayMinFreshMinutes,
      },
    ].filter((window) => window.from <= window.to);

    for (const window of windows) {
      try {
        const payload = await callFunction(
          `${functionsBaseUrl}/google/sync-snapshots`,
          anonKey,
          userToken,
          {
            from: window.from,
            to: window.to,
            force: false,
            minFreshMinutes: window.minFreshMinutes,
          },
        );

        summaries.push({
          label: window.label,
          from: window.from,
          to: window.to,
          status: 'ok',
          rowCount: payload?.metadata?.rowCount || 0,
          upsertedCount: payload?.metadata?.upsertedCount || 0,
          servedFrom: payload?.metadata?.servedFrom || 'unknown',
          lastSyncedAt: payload?.metadata?.lastSyncedAt || null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const retryAfterSeconds = parseRetryAfterSeconds(message);

        if (retryAfterSeconds) {
          summaries.push({
            label: window.label,
            from: window.from,
            to: window.to,
            status: 'rate-limited',
            retryAfterSeconds,
            retryAfterLabel: formatRetryDelay(retryAfterSeconds),
            message,
          });
          break;
        }

        if (authSoftFail && isGoogleAuthDisconnectError(error)) {
          const message =
            'Google Ads OAuth perlu reconnect. Snapshot lama tetap dipakai sampai token diperbarui.';

          emitGithubWarning('Google Ads OAuth disconnected', message);
          summaries.push({
            label: window.label,
            from: window.from,
            to: window.to,
            status: 'auth-disconnected',
            message,
          });
          break;
        }

        throw error;
      }
    }
  } finally {
    await adminClient.auth.admin.deleteUser(createdUser.user.id).catch(() => undefined);
  }

  console.log(JSON.stringify({ ok: true, summaries }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
