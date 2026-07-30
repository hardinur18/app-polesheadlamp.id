#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const DEFAULT_ENV_FILE = process.env.POLESHEADLAMP_ENV_FILE || path.resolve(process.cwd(), '.env.supabase.local');
const DEFAULT_API_DOC_FILE =
  process.env.POLESHEADLAMP_API_DOC_FILE || path.join(os.homedir(), 'Documents', 'API polesheadlamp.md');
const DEFAULT_STATE_FILE = '/tmp/polesheadlamp-kirimdev-backfill-30d-state.json';

function parseArgs(argv) {
  const args = {
    envFile: DEFAULT_ENV_FILE,
    apiDocFile: DEFAULT_API_DOC_FILE,
    stateFile: DEFAULT_STATE_FILE,
    days: 30,
    conversationLimit: 5,
    messageLimit: 100,
    messageMaxPages: 100,
    delayMs: 800,
    reset: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === '--env' && next) {
      args.envFile = next;
      index += 1;
    } else if (value === '--api-doc' && next) {
      args.apiDocFile = next;
      index += 1;
    } else if (value === '--state' && next) {
      args.stateFile = next;
      index += 1;
    } else if (value === '--days' && next) {
      args.days = Number(next);
      index += 1;
    } else if (value === '--conversation-limit' && next) {
      args.conversationLimit = Number(next);
      index += 1;
    } else if (value === '--message-limit' && next) {
      args.messageLimit = Number(next);
      index += 1;
    } else if (value === '--message-max-pages' && next) {
      args.messageMaxPages = Number(next);
      index += 1;
    } else if (value === '--delay-ms' && next) {
      args.delayMs = Number(next);
      index += 1;
    } else if (value === '--reset') {
      args.reset = true;
    }
  }

  args.days = clampInteger(args.days, 30, 1, 365);
  args.conversationLimit = clampInteger(args.conversationLimit, 5, 1, 100);
  args.messageLimit = clampInteger(args.messageLimit, 100, 1, 100);
  args.messageMaxPages = clampInteger(args.messageMaxPages, 100, 1, 100);
  args.delayMs = clampInteger(args.delayMs, 800, 0, 30_000);
  return args;
}

function clampInteger(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}

function readKeyValueFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return {};
  const values = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function resolveConfig(args) {
  const fileEnv = readKeyValueFile(args.envFile);
  const docEnv = readKeyValueFile(args.apiDocFile);
  const env = { ...process.env, ...fileEnv, ...docEnv };
  const functionsBaseUrl =
    env.VITE_FUNCTIONS_BASE_URL ||
    (env.SUPABASE_URL ? `${env.SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/make-server-f781cd00` : '');
  const internalSyncToken =
    env.WHATSAPP_INTERNAL_SYNC_TOKEN ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_SECRET_KEY ||
    '';
  const kirimdevApiBaseUrl = (env.KIRIMDEV_API_BASE_URL || 'https://api.kirimdev.com/v1').replace(/\/+$/, '');
  const kirimdevApiKey = env.KIRIMDEV_API_KEY || '';

  if (!functionsBaseUrl) throw new Error('VITE_FUNCTIONS_BASE_URL atau SUPABASE_URL belum ada.');
  if (!internalSyncToken) throw new Error('SUPABASE_SERVICE_ROLE_KEY / WHATSAPP_INTERNAL_SYNC_TOKEN belum ada.');
  if (!kirimdevApiKey) throw new Error('KIRIMDEV_API_KEY belum ada.');

  return {
    functionsBaseUrl: functionsBaseUrl.replace(/\/+$/, ''),
    internalSyncToken,
    kirimdevApiBaseUrl,
    kirimdevApiKey,
  };
}

async function fetchJson(url, init = {}, timeoutMs = 120_000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }
    if (!response.ok) {
      const error = new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function listKirimdevAccounts(config) {
  const payload = await fetchJson(`${config.kirimdevApiBaseUrl}/accounts`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${config.kirimdevApiKey}`,
    },
  });
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows
    .map((row) => ({
      phoneNumberId: typeof row?.phone_number_id === 'string' ? row.phone_number_id.trim() : '',
      phoneNumber: typeof row?.phone_number === 'string' ? row.phone_number.trim() : '',
    }))
    .filter((row) => row.phoneNumberId);
}

function loadState(args) {
  if (args.reset && fs.existsSync(args.stateFile)) {
    fs.rmSync(args.stateFile);
  }
  if (fs.existsSync(args.stateFile)) {
    const state = JSON.parse(fs.readFileSync(args.stateFile, 'utf8'));
    if (state?.days === args.days && typeof state?.since === 'string') {
      return state;
    }
  }

  return {
    days: args.days,
    since: new Date(Date.now() - args.days * 24 * 60 * 60 * 1000).toISOString(),
    startedAt: new Date().toISOString(),
    completedPhoneNumberIds: [],
    cursorByPhoneNumberId: {},
    stats: {
      calls: 0,
      conversations: 0,
      messages: 0,
    },
  };
}

function saveState(args, state) {
  fs.mkdirSync(path.dirname(args.stateFile), { recursive: true });
  fs.writeFileSync(args.stateFile, `${JSON.stringify(state, null, 2)}\n`);
}

async function syncPage(config, body, conversationLimit) {
  return fetchJson(
    `${config.functionsBaseUrl}/meta/messaging/kirimdev/sync`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.internalSyncToken}`,
        'x-internal-sync-token': config.internalSyncToken,
      },
      body: JSON.stringify({ ...body, conversationLimit }),
    },
    180_000,
  );
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const config = resolveConfig(args);
  const accounts = await listKirimdevAccounts(config);
  const state = loadState(args);
  const completed = new Set(state.completedPhoneNumberIds || []);
  let conversationLimit = args.conversationLimit;

  console.log(`Kirimdev 30d backfill start: ${accounts.length} accounts, since ${state.since}`);
  console.log(`State file: ${args.stateFile}`);

  for (let accountIndex = 0; accountIndex < accounts.length; accountIndex += 1) {
    const account = accounts[accountIndex];
    if (completed.has(account.phoneNumberId)) {
      console.log(`[${accountIndex + 1}/${accounts.length}] ${account.phoneNumber || account.phoneNumberId} already complete`);
      continue;
    }

    let cursor = state.cursorByPhoneNumberId?.[account.phoneNumberId] || null;
    let page = 0;
    let retries = 0;

    while (true) {
      const body = {
        phoneNumberId: account.phoneNumberId,
        cursor: cursor || undefined,
        since: state.since,
        maxPages: 1,
        includeMessages: true,
        messageLimit: args.messageLimit,
        messageMaxPages: args.messageMaxPages,
      };

      try {
        const result = await syncPage(config, body, conversationLimit);
        retries = 0;
        page += 1;
        state.stats.calls += 1;
        state.stats.conversations += Number(result?.conversations || 0);
        state.stats.messages += Number(result?.messages || 0);

        console.log(
          `[${accountIndex + 1}/${accounts.length}] ${account.phoneNumber || account.phoneNumberId} page ${page}: ` +
            `+${result?.conversations || 0} conversations, +${result?.messages || 0} messages`,
        );

        if (result?.hasMore && result?.nextCursor) {
          cursor = result.nextCursor;
          state.cursorByPhoneNumberId[account.phoneNumberId] = cursor;
          saveState(args, state);
          if (args.delayMs > 0) await sleep(args.delayMs);
          continue;
        }

        completed.add(account.phoneNumberId);
        state.completedPhoneNumberIds = Array.from(completed);
        delete state.cursorByPhoneNumberId[account.phoneNumberId];
        saveState(args, state);
        break;
      } catch (error) {
        retries += 1;
        const status = error?.status || 'network';
        if (
          (status === 546 || status === 504 || status === 502 || status === 503 || status === 'network') &&
          conversationLimit > 1
        ) {
          conversationLimit = Math.max(1, Math.floor(conversationLimit / 2));
          console.log(
            `[${accountIndex + 1}/${accounts.length}] timeout/edge error, retry with conversationLimit=${conversationLimit}`,
          );
          await sleep(2_000);
          continue;
        }
        if (retries <= 3) {
          console.log(
            `[${accountIndex + 1}/${accounts.length}] retry ${retries}/3 after ${status}: ${error?.message || error}`,
          );
          await sleep(3_000 * retries);
          continue;
        }
        saveState(args, state);
        throw error;
      }
    }
  }

  state.finishedAt = new Date().toISOString();
  saveState(args, state);
  console.log(
    `Kirimdev 30d backfill complete: ${state.stats.conversations} conversations, ${state.stats.messages} messages, ${state.stats.calls} calls`,
  );
}

run().catch((error) => {
  console.error(`Kirimdev 30d backfill failed: ${error?.message || error}`);
  process.exitCode = 1;
});
