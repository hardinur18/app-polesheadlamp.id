import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_ENV_FILE = path.resolve(process.cwd(), 'supabase/functions/.env.local');
const DEFAULT_STATE_KEY = 'meta:instagram:token:rhi-system';
const LEGACY_STATE_KEYS = [`meta:instagram:token:${['polesheadlamp', 'id'].join('.')}`];

function parseArgs(argv) {
  const args = {
    envFile: fs.existsSync(DEFAULT_ENV_FILE) ? DEFAULT_ENV_FILE : null,
    mirrorEnvFiles: [],
    minValidDays: null,
    stateKey: process.env.META_IG_STATE_KEY?.trim() || DEFAULT_STATE_KEY,
    syncState: false,
    writeEnv: false,
    syncSupabase: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--env-file') {
      args.envFile = path.resolve(process.cwd(), argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (value === '--no-env-file') {
      args.envFile = null;
      continue;
    }
    if (value === '--mirror-env') {
      args.mirrorEnvFiles.push(path.resolve(process.cwd(), argv[index + 1] || ''));
      index += 1;
      continue;
    }
    if (value === '--min-valid-days') {
      args.minValidDays = Number(argv[index + 1] || '0');
      index += 1;
      continue;
    }
    if (value === '--state-key') {
      args.stateKey = (argv[index + 1] || '').trim() || DEFAULT_STATE_KEY;
      index += 1;
      continue;
    }
    if (value === '--sync-state') {
      args.syncState = true;
      continue;
    }
    if (value === '--write-env') {
      args.writeEnv = true;
      continue;
    }
    if (value === '--sync-supabase') {
      args.syncSupabase = true;
    }
  }

  return args;
}

function readEnvFile(filePath) {
  if (!filePath) {
    return {};
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Env file tidak ditemukan: ${filePath}`);
  }

  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
    const [key, ...rest] = line.split('=');
    values[key] = rest.join('=').trim();
  }

  return values;
}

function resolveValues(envFile) {
  const fileValues = readEnvFile(envFile);
  return {
    ...process.env,
    ...fileValues,
  };
}

function requireValue(values, key) {
  const value = values[key]?.trim();
  if (!value) {
    throw new Error(`${key} belum diatur di env file.`);
  }
  return value;
}

function optionalValue(values, key) {
  return values[key]?.trim() || '';
}

function writeEnvValue(filePath, key, value) {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  let found = false;
  const updated = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) updated.push(`${key}=${value}`);
  fs.writeFileSync(filePath, `${updated.join('\n').replace(/\n+$/u, '')}\n`, 'utf8');
}

function syncSupabaseSecrets({ projectRef, secretPairs, accessToken }) {
  const args = ['supabase', 'secrets', 'set'];
  for (const [key, value] of secretPairs) {
    args.push(`${key}=${value}`);
  }
  args.push('--project-ref', projectRef);

  const result = spawnSync('npx', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      SUPABASE_ACCESS_TOKEN: accessToken || process.env.SUPABASE_ACCESS_TOKEN || '',
    },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || 'Gagal sync secret IG ke Supabase.');
  }
}

function createSupabaseAdmin({ supabaseUrl, serviceRoleKey }) {
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readStateFromSupabase({ supabaseUrl, serviceRoleKey, stateKey }) {
  if (!stateKey) return null;

  const supabase = createSupabaseAdmin({ supabaseUrl, serviceRoleKey });
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('kv_store_f781cd00')
    .select('value')
    .eq('key', stateKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Gagal membaca state IG dari Supabase: ${error.message}`);
  }

  return data?.value || null;
}

async function readStateWithFallback({ supabaseUrl, serviceRoleKey, stateKey }) {
  const keys = Array.from(new Set([stateKey, ...LEGACY_STATE_KEYS].filter(Boolean)));

  for (const key of keys) {
    const state = await readStateFromSupabase({ supabaseUrl, serviceRoleKey, stateKey: key });
    if (state) {
      return { state, sourceKey: key };
    }
  }

  return { state: null, sourceKey: stateKey };
}

async function writeStateToSupabase({ supabaseUrl, serviceRoleKey, stateKey, payload }) {
  if (!stateKey) {
    throw new Error('State key IG belum diatur.');
  }

  const supabase = createSupabaseAdmin({ supabaseUrl, serviceRoleKey });
  if (!supabase) {
    throw new Error('SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum ada untuk sync state IG.');
  }

  const { error } = await supabase.from('kv_store_f781cd00').upsert({
    key: stateKey,
    value: payload,
  });

  if (error) {
    throw new Error(`Gagal menyimpan state IG ke Supabase: ${error.message}`);
  }
}

async function refreshInstagramToken(accessToken) {
  const url = new URL('https://graph.instagram.com/refresh_access_token');
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || `Refresh token IG gagal (${response.status})`);
  }
  return payload;
}

async function fetchInstagramProfile(accessToken) {
  const url = new URL('https://graph.instagram.com/v25.0/me');
  url.searchParams.set('fields', 'id,user_id,username,account_type');
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || `Fetch profile IG gagal (${response.status})`);
  }
  return payload;
}

async function fetchConversationSample(accessToken) {
  const url = new URL('https://graph.instagram.com/v25.0/me/conversations');
  url.searchParams.set('fields', 'id,updated_time');
  url.searchParams.set('limit', '3');
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || `Fetch conversation IG gagal (${response.status})`);
  }
  return payload;
}

function formatJakartaIso(date) {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return `${formatter.format(date).replace(' ', 'T')}+07:00`;
}

function shouldSkipRefresh({ values, state, minValidDays }) {
  if (!minValidDays || minValidDays <= 0) {
    return null;
  }

  const expiresAtRaw =
    state?.expiresAt?.trim() ||
    state?.tokenExpiresAt?.trim() ||
    values.META_IG_TOKEN_EXPIRES_AT?.trim() ||
    '';
  if (!expiresAtRaw) {
    return null;
  }

  const expiresAt = new Date(expiresAtRaw);
  if (Number.isNaN(expiresAt.getTime())) {
    return null;
  }

  const thresholdAt = new Date(Date.now() + minValidDays * 24 * 60 * 60 * 1000);
  if (expiresAt > thresholdAt) {
    return {
      expiresAt,
      minValidDays,
    };
  }

  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const values = resolveValues(args.envFile);
  const supabaseUrl = optionalValue(values, 'SUPABASE_URL');
  const serviceRoleKey =
    optionalValue(values, 'SUPABASE_SERVICE_ROLE_KEY') || optionalValue(values, 'SUPABASE_SECRET_KEY');
  const { state, sourceKey } = await readStateWithFallback({
    supabaseUrl,
    serviceRoleKey,
    stateKey: args.stateKey,
  });
  if (state && sourceKey !== args.stateKey) {
    console.log(`IG state dibaca dari legacy KV key. Refresh berikutnya akan memakai ${args.stateKey}.`);
  }

  const skipState = shouldSkipRefresh({ values, state, minValidDays: args.minValidDays });
  if (skipState) {
    console.log(
      `IG token masih aman sampai ${formatJakartaIso(skipState.expiresAt)}. Skip refresh karena masih lebih dari ${skipState.minValidDays} hari.`,
    );
    return;
  }

  const currentToken =
    state?.accessToken?.trim() ||
    state?.token?.trim() ||
    requireValue(values, 'META_IG_ACCESS_TOKEN');
  const projectRef = optionalValue(values, 'SUPABASE_PROJECT_REF');
  const supabaseAccessToken = optionalValue(values, 'SUPABASE_ACCESS_TOKEN');

  const refreshed = await refreshInstagramToken(currentToken);
  const nextToken = refreshed.access_token;
  const expiresIn = Number(refreshed.expires_in || 0);
  const refreshedAt = new Date();
  const expiresAt = new Date(refreshedAt.getTime() + expiresIn * 1000);

  const profile = await fetchInstagramProfile(nextToken);
  const conversations = await fetchConversationSample(nextToken);
  const conversationCount = Array.isArray(conversations?.data) ? conversations.data.length : 0;

  console.log('IG token refreshed.');
  console.log(`Username       : ${profile.username}`);
  console.log(`User ID        : ${profile.user_id}`);
  console.log(`Account ID     : ${profile.id}`);
  console.log(`Account Type   : ${profile.account_type}`);
  console.log(`Expires In     : ${expiresIn} detik`);
  console.log(`Refreshed At   : ${formatJakartaIso(refreshedAt)}`);
  console.log(`Expires At     : ${formatJakartaIso(expiresAt)}`);
  console.log(`Conversations  : ${conversationCount}`);

  if (args.writeEnv) {
    if (!args.envFile) {
      throw new Error('`--write-env` butuh `--env-file` atau default env file yang valid.');
    }

    const envTargets = Array.from(new Set([args.envFile, ...args.mirrorEnvFiles]));
    for (const target of envTargets) {
      writeEnvValue(target, 'META_IG_ACCESS_TOKEN', nextToken);
      writeEnvValue(target, 'META_IG_USER_ID', profile.user_id);
      writeEnvValue(target, 'META_IG_ACCOUNT_ID', profile.id);
      writeEnvValue(target, 'META_IG_USERNAME', profile.username);
      writeEnvValue(target, 'META_IG_ACCOUNT_TYPE', profile.account_type);
      writeEnvValue(
        target,
        'META_IG_SCOPES',
        'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights',
      );
      writeEnvValue(target, 'META_IG_TOKEN_REFRESHED_AT', formatJakartaIso(refreshedAt));
      writeEnvValue(target, 'META_IG_TOKEN_EXPIRES_AT', formatJakartaIso(expiresAt));
      writeEnvValue(target, 'META_IG_TOKEN_EXPIRES_IN', String(expiresIn));
      console.log(`\nMETA_IG_ACCESS_TOKEN berhasil diperbarui di ${target}`);
    }
  } else {
    console.log('\nTambahkan `--write-env` kalau ingin token baru langsung ditulis ke env file.');
  }

  if (args.syncState) {
    await writeStateToSupabase({
      supabaseUrl,
      serviceRoleKey,
      stateKey: args.stateKey,
      payload: {
        token: nextToken,
        accessToken: nextToken,
        userId: profile.user_id,
        accountId: profile.id,
        username: profile.username,
        accountType: profile.account_type,
        scopes:
          'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights',
        refreshedAt: formatJakartaIso(refreshedAt),
        expiresAt: formatJakartaIso(expiresAt),
        expiresIn,
        conversationCount,
        updatedAt: new Date().toISOString(),
      },
    });
    console.log(`\nState IG berhasil disimpan ke Supabase KV (${args.stateKey}).`);
  }

  if (args.syncSupabase) {
    if (!projectRef) {
      throw new Error('SUPABASE_PROJECT_REF belum ada, jadi secret live belum bisa disinkronkan.');
    }

    syncSupabaseSecrets({
      projectRef,
      accessToken: supabaseAccessToken,
      secretPairs: [
        ['META_IG_ACCESS_TOKEN', nextToken],
        ['META_IG_USER_ID', profile.user_id],
        ['META_IG_ACCOUNT_ID', profile.id],
        ['META_IG_USERNAME', profile.username],
        ['META_IG_ACCOUNT_TYPE', profile.account_type],
        [
          'META_IG_SCOPES',
          'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights',
        ],
        ['META_IG_TOKEN_REFRESHED_AT', formatJakartaIso(refreshedAt)],
        ['META_IG_TOKEN_EXPIRES_AT', formatJakartaIso(expiresAt)],
        ['META_IG_TOKEN_EXPIRES_IN', String(expiresIn)],
      ],
    });
    console.log(`\nSecret IG berhasil disinkronkan ke Supabase project ${projectRef}`);
  }
}

main().catch((error) => {
  console.error(`\n[meta-ig-refresh] ${error.message}`);
  process.exitCode = 1;
});
