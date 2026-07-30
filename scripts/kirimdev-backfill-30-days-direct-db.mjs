#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_ENV_FILE = process.env.POLESHEADLAMP_ENV_FILE || path.resolve(process.cwd(), '.env.supabase.local');
const DEFAULT_API_DOC_FILE =
  process.env.POLESHEADLAMP_API_DOC_FILE || path.join(os.homedir(), 'Documents', 'API polesheadlamp.md');
const DEFAULT_STATE_FILE = '/tmp/polesheadlamp-kirimdev-backfill-30d-state.json';

function clampInteger(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}

function parseArgs(argv) {
  const args = {
    envFile: DEFAULT_ENV_FILE,
    apiDocFile: DEFAULT_API_DOC_FILE,
    stateFile: DEFAULT_STATE_FILE,
    days: 30,
    conversationLimit: 100,
    messageLimit: 100,
    concurrency: 5,
    delayMs: 200,
    allHistory: false,
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
    } else if (value === '--concurrency' && next) {
      args.concurrency = Number(next);
      index += 1;
    } else if (value === '--delay-ms' && next) {
      args.delayMs = Number(next);
      index += 1;
    } else if (value === '--all-history') {
      args.allHistory = true;
    } else if (value === '--reset') {
      args.reset = true;
    }
  }

  args.days = clampInteger(args.days, 30, 1, 365);
  args.conversationLimit = clampInteger(args.conversationLimit, 100, 1, 100);
  args.messageLimit = clampInteger(args.messageLimit, 100, 1, 100);
  args.concurrency = clampInteger(args.concurrency, 5, 1, 12);
  args.delayMs = clampInteger(args.delayMs, 200, 0, 30_000);
  return args;
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
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '';
  const kirimdevApiBaseUrl = (env.KIRIMDEV_API_BASE_URL || 'https://api.kirimdev.com/v1').replace(/\/+$/, '');
  const kirimdevApiKey = env.KIRIMDEV_API_KEY || '';

  if (!supabaseUrl) throw new Error('SUPABASE_URL / VITE_SUPABASE_URL belum ada.');
  if (!supabaseServiceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum ada.');
  if (!kirimdevApiKey) throw new Error('KIRIMDEV_API_KEY belum ada.');

  return {
    supabaseUrl,
    supabaseServiceKey,
    kirimdevApiBaseUrl,
    kirimdevApiKey,
  };
}

function loadState(args) {
  if (args.reset && fs.existsSync(args.stateFile)) fs.rmSync(args.stateFile);
  if (fs.existsSync(args.stateFile)) {
    const state = JSON.parse(fs.readFileSync(args.stateFile, 'utf8'));
    if (state?.allHistory === args.allHistory && (args.allHistory || state?.days === args.days)) return state;
  }
  return {
    days: args.allHistory ? null : args.days,
    allHistory: args.allHistory,
    since: args.allHistory ? null : new Date(Date.now() - args.days * 24 * 60 * 60 * 1000).toISOString(),
    startedAt: new Date().toISOString(),
    completedPhoneNumberIds: [],
    cursorByPhoneNumberId: {},
    stats: { calls: 0, conversations: 0, messages: 0 },
  };
}

function saveState(args, state) {
  fs.mkdirSync(path.dirname(args.stateFile), { recursive: true });
  fs.writeFileSync(args.stateFile, `${JSON.stringify(state, null, 2)}\n`);
}

function buildQuery(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
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

async function withRetry(task, label) {
  let lastError = null;
  const maxAttempts = label.startsWith('upsert ') ? 20 : 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      const waitMs = label.startsWith('upsert ') ? Math.min(60_000, attempt * 5_000) : attempt * 1_500;
      console.log(
        `${label} retry ${attempt}/${maxAttempts - 1} after ${error?.status || 'network'}: ${error?.message || error}`,
      );
      await sleep(waitMs);
    }
  }
  throw lastError;
}

function kirimdevHeaders(config) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${config.kirimdevApiKey}`,
  };
}

async function listKirimdevAccounts(config) {
  const payload = await withRetry(
    () => fetchJson(`${config.kirimdevApiBaseUrl}/accounts`, { headers: kirimdevHeaders(config) }),
    'accounts',
  );
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows
    .map((row) => ({
      phoneNumberId: typeof row?.phone_number_id === 'string' ? row.phone_number_id.trim() : '',
      phoneNumber: typeof row?.phone_number === 'string' ? row.phone_number.trim() : '',
    }))
    .filter((row) => row.phoneNumberId);
}

function normalizePhone(value) {
  return typeof value === 'string' ? value.trim().replace(/\D/g, '') : '';
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function firstPhone(...values) {
  for (const value of values) {
    const normalized = normalizePhone(value);
    if (normalized) return normalized;
  }
  return '';
}

function toIso(value, fallback) {
  if (typeof value === 'string' && Number.isFinite(new Date(value).getTime())) {
    return new Date(value).toISOString();
  }
  return fallback;
}

function normalizeStatus(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ['pending', 'sent', 'delivered', 'read', 'failed'].includes(normalized) ? normalized : null;
}

function resolveAvatar(value) {
  if (!value || typeof value !== 'object') return null;
  const candidates = [
    value.contactAvatarUrl,
    value.avatarUrl,
    value.avatar_url,
    value.profilePhotoUrl,
    value.profile_photo_url,
    value.profilePictureUrl,
    value.profile_picture_url,
    value.photoUrl,
    value.photo_url,
    value.picture,
    value.photo,
    value.contact?.avatarUrl,
    value.contact?.avatar_url,
    value.contact?.profilePhotoUrl,
    value.contact?.profile_photo_url,
    value.contact?.profilePictureUrl,
    value.contact?.profile_picture_url,
    value.contact?.photoUrl,
    value.contact?.photo_url,
    value.contact?.picture,
    value.contact?.photo,
    value.customer?.avatarUrl,
    value.customer?.avatar_url,
    value.customer?.profilePictureUrl,
    value.customer?.profile_picture_url,
    value.profile?.picture,
    value.profile?.photo_url,
  ];
  const candidate = firstString(...candidates);
  if (
    candidate.startsWith('https://') ||
    candidate.startsWith('http://') ||
    candidate.startsWith('data:image/') ||
    candidate.startsWith('/')
  ) {
    return candidate;
  }
  return null;
}

function resolveConversationContact(row) {
  const contact = row?.contact || {};
  const phoneNumber = firstPhone(
    contact?.phone_number,
    contact?.phone,
    contact?.wa_id,
    contact?.whatsapp_number,
    row?.phone_number,
    row?.contact_phone_number,
    row?.customer?.phone_number,
  );
  const contactId = phoneNumber || firstString(contact?.id);
  const contactName = firstString(contact?.name) || null;
  const avatarUrl = resolveAvatar(row) || resolveAvatar(contact) || null;
  return { contactId, phoneNumber: phoneNumber || null, contactName, avatarUrl };
}

function buildConversationRow(row, account, receivedAt) {
  const phoneNumberId = firstString(row?.whatsapp_account?.phone_number_id, account.phoneNumberId);
  const { contactId, phoneNumber, contactName, avatarUrl } = resolveConversationContact(row);
  if (!phoneNumberId || !contactId) return null;

  const channelId = `whatsapp:${phoneNumberId}`;
  const conversationId = `${channelId}:${contactId}`;
  const timestamp = toIso(row?.last_message_at, toIso(row?.updated_at, toIso(row?.created_at, receivedAt)));
  const kirimdevConversationId = firstString(row?.id) || null;
  const raw = {
    source: 'kirimdev_api',
    kirimdevConversationId,
    contactAvatarUrl: avatarUrl,
    conversation: row,
  };

  return {
    id: conversationId,
    channel_id: channelId,
    source: 'api',
    contact_id: contactId,
    entry_id: phoneNumberId,
    object_type: 'whatsapp_business_account',
    provider: 'kirimdev',
    contact_name: contactName,
    contact_phone: phoneNumber || contactId,
    last_message_at: timestamp,
    last_message_text: null,
    last_direction: 'inbound',
    last_status: null,
    last_has_attachment: false,
    conversation_status: firstString(row?.status) || null,
    unread_count: Number.isFinite(Number(row?.unread_count)) ? Number(row.unread_count) : 0,
    raw,
    updated_at: receivedAt,
    kirimdevConversationId,
  };
}

function buildContactRow(conversationRow, row, receivedAt) {
  const contactKey = conversationRow.contact_phone || conversationRow.contact_id;
  return {
    channel_id: conversationRow.channel_id,
    contact_key: contactKey,
    id: conversationRow.contact_id,
    provider: 'kirimdev',
    phone_number_id: conversationRow.entry_id,
    phone_number: conversationRow.contact_phone,
    name: conversationRow.contact_name,
    email: null,
    created_at: toIso(row?.created_at, conversationRow.last_message_at),
    updated_at: receivedAt,
    raw: {
      source: 'kirimdev_api',
      contact: row?.contact || null,
      avatarUrl: conversationRow.raw?.contactAvatarUrl || null,
    },
  };
}

function inferMessageText(row) {
  return firstString(row?.content, row?.text, row?.body) || null;
}

function resolveMessageId(row) {
  return firstString(row?.message_id, row?.id) || `kirimdev_api:${crypto.randomUUID()}`;
}

function inferDirection(row, conversationRow) {
  const rawDirection = typeof row?.direction === 'string' ? row.direction.trim().toLowerCase() : '';
  if (['outbound', 'outgoing', 'sent'].includes(rawDirection)) return 'outbound';
  if (['inbound', 'incoming', 'received'].includes(rawDirection)) return 'inbound';
  if (row?.from_me === true || row?.is_from_me === true || row?.is_outbound === true) return 'outbound';
  if (row?.from_me === false || row?.is_from_me === false || row?.is_inbound === true) return 'inbound';
  const toKey = firstPhone(row?.to, row?.recipient, row?.recipient_phone_number);
  if (conversationRow.contact_id && toKey && conversationRow.contact_id === toKey) return 'outbound';
  return 'inbound';
}

function buildMessageRow(row, conversationRow, receivedAt) {
  const timestamp = toIso(row?.created_at, receivedAt);
  const direction = inferDirection(row, conversationRow);
  const mediaUrl = firstString(row?.media_url) || null;
  const type = firstString(row?.type) || 'message';
  const text = inferMessageText(row);
  const attachments = mediaUrl ? [{ type, url: mediaUrl }] : [];
  return {
    id: resolveMessageId(row),
    conversation_id: conversationRow.id,
    channel_id: conversationRow.channel_id,
    source: 'api',
    contact_id: conversationRow.contact_id,
    entry_id: conversationRow.entry_id,
    object_type: 'whatsapp_business_account',
    provider: 'kirimdev',
    direction,
    event_type: `kirimdev_api_${type}`,
    text,
    attachments,
    media_url: mediaUrl,
    status: normalizeStatus(row?.status),
    timestamp,
    raw: {
      source: 'kirimdev_api',
      kirimdevConversationId: conversationRow.kirimdevConversationId,
      message: row,
    },
  };
}

async function fetchConversationMessages(config, account, conversationRow, since, limit) {
  if (!conversationRow.kirimdevConversationId) return [];
  const rows = [];
  let cursor = null;
  while (true) {
    const payload = await withRetry(
      () =>
        fetchJson(
          `${config.kirimdevApiBaseUrl}/${encodeURIComponent(account.phoneNumberId)}/messages${buildQuery({
            conversation_id: conversationRow.kirimdevConversationId,
            created_after: since || undefined,
            limit,
            cursor,
          })}`,
          { headers: kirimdevHeaders(config) },
        ),
      `messages ${account.phoneNumber || account.phoneNumberId}`,
    );
    if (Array.isArray(payload?.data)) rows.push(...payload.data);
    if (!payload?.has_more || !payload?.next_cursor) break;
    cursor = payload.next_cursor;
  }
  return rows;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
  return results;
}

function applyLatestMessage(conversationRow, messages) {
  if (!messages.length) return conversationRow;
  const latest = messages.reduce((selected, message) =>
    !selected || message.timestamp > selected.timestamp ? message : selected,
  null);
  if (!latest) return conversationRow;
  return {
    ...conversationRow,
    last_message_at: latest.timestamp,
    last_message_text: latest.text,
    last_direction: latest.direction,
    last_status: latest.status,
    last_has_attachment: latest.attachments.length > 0,
  };
}

async function upsertChunks(supabase, table, rows, options, size = 25) {
  for (let index = 0; index < rows.length; index += size) {
    const chunk = rows.slice(index, index + size);
    if (!chunk.length) continue;
    await withRetry(async () => {
      const { error } = await supabase.from(table).upsert(chunk, options);
      if (error) throw error;
    }, `upsert ${table}`);
    if (table === 'whatsapp_messages') await sleep(200);
  }
}

async function syncAccount(config, supabase, args, state, account, accountIndex, accountCount) {
  let cursor = state.cursorByPhoneNumberId?.[account.phoneNumberId] || null;
  let page = 0;

  while (true) {
    const receivedAt = new Date().toISOString();
    const payload = await withRetry(
      () =>
        fetchJson(
          `${config.kirimdevApiBaseUrl}/${encodeURIComponent(account.phoneNumberId)}/conversations${buildQuery({
            updated_since: state.since,
            limit: args.conversationLimit,
            cursor,
          })}`,
          { headers: kirimdevHeaders(config) },
        ),
      `conversations ${account.phoneNumber || account.phoneNumberId}`,
    );
    const conversationSourceRows = Array.isArray(payload?.data) ? payload.data : [];
    const baseConversationRows = conversationSourceRows
      .map((row) => buildConversationRow(row, account, receivedAt))
      .filter(Boolean);
    const contactRows = baseConversationRows.map((conversationRow, index) =>
      buildContactRow(conversationRow, conversationSourceRows[index], receivedAt),
    );

    const messageRowsByConversation = await mapLimit(
      baseConversationRows,
      args.concurrency,
      async (conversationRow) => {
        const messageSourceRows = await fetchConversationMessages(
          config,
          account,
          conversationRow,
          state.since,
          args.messageLimit,
        );
        return messageSourceRows.map((row) => buildMessageRow(row, conversationRow, receivedAt));
      },
    );
    const messageRows = messageRowsByConversation.flat();
    const conversationRows = baseConversationRows.map((conversationRow, index) =>
      applyLatestMessage(conversationRow, messageRowsByConversation[index] || []),
    );
    const dbConversationRows = conversationRows.map(({ kirimdevConversationId, ...row }) => row);

    await upsertChunks(supabase, 'whatsapp_contacts', contactRows, {
      onConflict: 'channel_id,contact_key',
    });
    await upsertChunks(supabase, 'whatsapp_conversations', dbConversationRows, {
      onConflict: 'id',
    });
    await upsertChunks(supabase, 'whatsapp_messages', messageRows, {
      onConflict: 'conversation_id,id',
    });

    page += 1;
    state.stats.calls += 1;
    state.stats.conversations += conversationRows.length;
    state.stats.messages += messageRows.length;

    console.log(
      `[${accountIndex + 1}/${accountCount}] ${account.phoneNumber || account.phoneNumberId} page ${page}: ` +
        `+${conversationRows.length} conversations, +${messageRows.length} messages`,
    );

    if (payload?.has_more && payload?.next_cursor) {
      cursor = payload.next_cursor;
      state.cursorByPhoneNumberId[account.phoneNumberId] = cursor;
      saveState(args, state);
      if (args.delayMs > 0) await sleep(args.delayMs);
      continue;
    }

    delete state.cursorByPhoneNumberId[account.phoneNumberId];
    state.completedPhoneNumberIds = Array.from(
      new Set([...(state.completedPhoneNumberIds || []), account.phoneNumberId]),
    );
    saveState(args, state);
    break;
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const config = resolveConfig(args);
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false },
  });
  const accounts = await listKirimdevAccounts(config);
  const state = loadState(args);
  const completed = new Set(state.completedPhoneNumberIds || []);

  console.log(`Kirimdev direct DB 30d backfill start: ${accounts.length} accounts, since ${state.since}`);
  console.log(`State file: ${args.stateFile}`);

  for (let index = 0; index < accounts.length; index += 1) {
    const account = accounts[index];
    if (completed.has(account.phoneNumberId)) {
      console.log(`[${index + 1}/${accounts.length}] ${account.phoneNumber || account.phoneNumberId} already complete`);
      continue;
    }
    await syncAccount(config, supabase, args, state, account, index, accounts.length);
    completed.add(account.phoneNumberId);
  }

  state.finishedAt = new Date().toISOString();
  saveState(args, state);
  console.log(
    `Kirimdev direct DB 30d backfill complete: ${state.stats.conversations} conversations, ` +
      `${state.stats.messages} messages, ${state.stats.calls} conversation pages`,
  );
}

run().catch((error) => {
  console.error(`Kirimdev direct DB 30d backfill failed: ${error?.message || error}`);
  process.exitCode = 1;
});
