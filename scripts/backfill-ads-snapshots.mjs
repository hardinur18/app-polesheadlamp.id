import { createClient } from '@supabase/supabase-js';

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const parsed = {};

  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const [rawKey, rawValue] = item.slice(2).split('=');
    parsed[rawKey] = rawValue ?? 'true';
  }

  return parsed;
}

function buildMonthlyChunks(from, to) {
  const chunks = [];
  let cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);

  while (cursor.getTime() <= end.getTime()) {
    const chunkStart = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
    const chunkEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));

    if (chunkEnd.getTime() > end.getTime()) {
      chunkEnd.setTime(end.getTime());
    }

    chunks.push({
      from: formatDate(chunkStart),
      to: formatDate(chunkEnd),
    });

    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  return chunks.filter((chunk) => chunk.from <= chunk.to);
}

function addUtcDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildDayChunks(from, to, chunkSizeDays) {
  const chunks = [];
  let cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);

  while (cursor.getTime() <= end.getTime()) {
    const chunkEnd = addUtcDays(cursor, chunkSizeDays - 1);
    if (chunkEnd.getTime() > end.getTime()) {
      chunkEnd.setTime(end.getTime());
    }

    chunks.push({
      from: formatDate(cursor),
      to: formatDate(chunkEnd),
    });

    cursor = addUtcDays(chunkEnd, 1);
  }

  return chunks.filter((chunk) => chunk.from <= chunk.to);
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
  const now = new Date();
  const defaultFromDate = new Date(Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), 1));

  const from = args.from || formatDate(defaultFromDate);
  const to = args.to || formatDate(now);
  const only = args.only || 'all';

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const functionsBaseUrl =
    process.env.VITE_FUNCTIONS_BASE_URL ||
    `${supabaseUrl}/functions/v1/make-server-f781cd00`;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, dan SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY wajib tersedia.');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const publicClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tempEmail = `codex-backfill-${Date.now()}@polesheadlamp.local`;
  const tempPassword = `CodexBackfill!${Math.random().toString(36).slice(2, 10)}`;

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email: tempEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      name: 'Codex Backfill',
    },
  });

  if (createError || !createdUser.user) {
    throw createError || new Error('Gagal membuat user sementara untuk backfill.');
  }

  try {
    const { data: signInData, error: signInError } = await publicClient.auth.signInWithPassword({
      email: tempEmail,
      password: tempPassword,
    });

    if (signInError || !signInData.session?.access_token) {
      throw signInError || new Error('Gagal login user sementara untuk backfill.');
    }

    const userToken = signInData.session.access_token;

    if (only === 'all' || only === 'meta') {
      const metaChunks = buildMonthlyChunks(from, to);

      for (const chunk of metaChunks) {
        console.log(`\n== Backfill Meta ${chunk.from} s/d ${chunk.to} ==`);

        const metaPayload = await callFunction(
          `${functionsBaseUrl}/meta/sync-snapshots`,
          anonKey,
          userToken,
          {
            from: chunk.from,
            to: chunk.to,
            force: true,
            minFreshMinutes: 0,
          },
        );

        console.log(
          `Meta: rows=${metaPayload?.metadata?.rowCount || 0}, upserted=${metaPayload?.metadata?.upsertedCount || 0}, syncedAt=${metaPayload?.metadata?.lastSyncedAt || '-'}`,
        );
      }
    }

    if (only === 'all' || only === 'google') {
      const googleChunks = buildDayChunks(from, to, 365);

      for (const chunk of googleChunks) {
        console.log(`\n== Backfill Google ${chunk.from} s/d ${chunk.to} ==`);

        const googlePayload = await callFunction(
          `${functionsBaseUrl}/google/sync-snapshots`,
          anonKey,
          userToken,
          {
            from: chunk.from,
            to: chunk.to,
            force: true,
            minFreshMinutes: 0,
          },
        );

        console.log(
          `Google: rows=${googlePayload?.metadata?.rowCount || 0}, upserted=${googlePayload?.metadata?.upsertedCount || 0}, syncedAt=${googlePayload?.metadata?.lastSyncedAt || '-'}`,
        );
      }
    }
  } finally {
    await adminClient.auth.admin.deleteUser(createdUser.user.id).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
