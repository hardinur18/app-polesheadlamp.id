#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_ENV_FILE = process.env.POLESHEADLAMP_ENV_FILE || path.resolve(process.cwd(), '.env.supabase.local');
const DEFAULT_API_DOC_FILE =
  process.env.POLESHEADLAMP_API_DOC_FILE || path.join(os.homedir(), 'Documents', 'API polesheadlamp.md');

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

function resolveConfig() {
  const env = {
    ...process.env,
    ...readKeyValueFile(DEFAULT_ENV_FILE),
    ...readKeyValueFile(DEFAULT_API_DOC_FILE),
  };
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '';
  const kirimdevApiBaseUrl = (env.KIRIMDEV_API_BASE_URL || 'https://api.kirimdev.com/v1').replace(/\/+$/, '');
  const kirimdevApiKey = env.KIRIMDEV_API_KEY || '';
  if (!supabaseUrl) throw new Error('SUPABASE_URL / VITE_SUPABASE_URL belum ada.');
  if (!supabaseServiceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum ada.');
  if (!kirimdevApiKey) throw new Error('KIRIMDEV_API_KEY belum ada.');
  return { supabaseUrl, supabaseServiceKey, kirimdevApiBaseUrl, kirimdevApiKey };
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
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = new Error(payload?.error?.message || payload?.error || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function withRetry(task, label) {
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
      console.log(`${label} retry ${attempt}/3 after ${error?.status || 'network'}: ${error?.message || error}`);
      await sleep(attempt * 1_500);
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

async function listAccounts(config) {
  const payload = await fetchJson(`${config.kirimdevApiBaseUrl}/accounts`, {
    headers: kirimdevHeaders(config),
  });
  return (Array.isArray(payload?.data) ? payload.data : [])
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

function toIso(value, fallback) {
  if (typeof value === 'string' && Number.isFinite(new Date(value).getTime())) {
    return new Date(value).toISOString();
  }
  return fallback;
}

function buildContactRow(row, account, receivedAt) {
  const phoneNumberId = firstString(row?.whatsapp_account?.phone_number_id, account.phoneNumberId);
  const channelId = `whatsapp:${phoneNumberId}`;
  const phoneNumber = normalizePhone(row?.phone_number);
  const contactId = phoneNumber || firstString(row?.id);
  if (!phoneNumberId || !contactId) return null;
  return {
    channel_id: channelId,
    contact_key: phoneNumber || contactId,
    id: contactId,
    provider: 'kirimdev',
    phone_number_id: phoneNumberId,
    phone_number: phoneNumber || null,
    name: firstString(row?.name) || null,
    email: firstString(row?.email) || null,
    created_at: toIso(row?.created_at, receivedAt),
    updated_at: toIso(row?.updated_at, receivedAt),
    raw: {
      source: 'kirimdev_contacts_api',
      contact: row,
    },
  };
}

async function upsertChunks(supabase, rows, size = 500) {
  for (let index = 0; index < rows.length; index += size) {
    const chunk = rows.slice(index, index + size);
    if (!chunk.length) continue;
    const { error } = await supabase
      .from('whatsapp_contacts')
      .upsert(chunk, { onConflict: 'channel_id,contact_key' });
    if (error) throw error;
  }
}

async function syncAccount(config, supabase, account, index, total) {
  let cursor = null;
  let page = 0;
  let synced = 0;
  while (true) {
    const receivedAt = new Date().toISOString();
    const payload = await withRetry(
      () =>
        fetchJson(
          `${config.kirimdevApiBaseUrl}/${encodeURIComponent(account.phoneNumberId)}/contacts${buildQuery({
            limit: 100,
            cursor,
          })}`,
          { headers: kirimdevHeaders(config) },
        ),
      `contacts ${account.phoneNumber || account.phoneNumberId}`,
    );
    const rows = (Array.isArray(payload?.data) ? payload.data : [])
      .map((row) => buildContactRow(row, account, receivedAt))
      .filter(Boolean);
    await upsertChunks(supabase, rows);
    page += 1;
    synced += rows.length;
    console.log(`[${index + 1}/${total}] ${account.phoneNumber || account.phoneNumberId} contacts page ${page}: +${rows.length}`);
    if (!payload?.has_more || !payload?.next_cursor) break;
    cursor = payload.next_cursor;
  }
  return synced;
}

async function run() {
  const config = resolveConfig();
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false },
  });
  const accounts = await listAccounts(config);
  let totalContacts = 0;
  for (let index = 0; index < accounts.length; index += 1) {
    totalContacts += await syncAccount(config, supabase, accounts[index], index, accounts.length);
  }
  console.log(`Kirimdev contacts sync complete: ${totalContacts} contacts processed`);
}

run().catch((error) => {
  console.error(`Kirimdev contacts sync failed: ${error?.message || error}`);
  process.exitCode = 1;
});
