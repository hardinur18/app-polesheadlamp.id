import { supabase } from '@/lib/supabaseClient';

const API_ACCOUNTS_CACHE_KEY = 'polesheadlamp_ad_api_accounts_cache_v1';
const API_MAPPINGS_CACHE_KEY = 'polesheadlamp_ad_account_api_mappings_cache_v1';

export type AdsPlatformKey = 'meta' | 'google' | 'tiktok';

export type AdApiAccount = {
  id: string;
  platformKey: AdsPlatformKey;
  externalAccountId: string;
  externalAccountName: string;
  externalGroupId?: string | null;
  externalGroupName?: string | null;
  externalAccountStatus?: string | null;
  currencyCode?: string | null;
  raw?: Record<string, unknown>;
  lastSyncedAt?: string;
};

export type AdAccountApiMapping = {
  id: string;
  internalAdAccountId: string;
  apiAccountId?: string | null;
  platformKey: AdsPlatformKey;
  externalAccountId: string;
  status: 'active' | 'inactive';
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AdApiAccountInput = Omit<AdApiAccount, 'id'> & { id?: string };

function readCache<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeCache<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function isMissingTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message || error || '');
  return (
    message.includes('Could not find the table') ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('ad_api_accounts') ||
    message.includes('ad_account_api_mappings')
  );
}

function createLocalId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

function isUuid(value?: string | null) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function mapApiAccountFromDb(row: any): AdApiAccount {
  return {
    id: row.id,
    platformKey: row.platform_key,
    externalAccountId: row.external_account_id,
    externalAccountName: row.external_account_name,
    externalGroupId: row.external_group_id,
    externalGroupName: row.external_group_name,
    externalAccountStatus: row.external_account_status,
    currencyCode: row.currency_code,
    raw: row.raw || {},
    lastSyncedAt: row.last_synced_at,
  };
}

function mapApiAccountToDb(account: AdApiAccountInput) {
  return {
    platform_key: account.platformKey,
    external_account_id: account.externalAccountId,
    external_account_name: account.externalAccountName,
    external_group_id: account.externalGroupId || null,
    external_group_name: account.externalGroupName || null,
    external_account_status: account.externalAccountStatus || null,
    currency_code: account.currencyCode || null,
    raw: account.raw || {},
    last_synced_at: account.lastSyncedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function mapMappingFromDb(row: any): AdAccountApiMapping {
  return {
    id: row.id,
    internalAdAccountId: row.internal_ad_account_id,
    apiAccountId: row.api_account_id,
    platformKey: row.platform_key,
    externalAccountId: row.external_account_id,
    status: row.status || 'active',
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mergeApiAccounts(current: AdApiAccount[], next: AdApiAccount[]) {
  const map = new Map<string, AdApiAccount>();
  for (const account of current) {
    map.set(`${account.platformKey}:${account.externalAccountId}`, account);
  }
  for (const account of next) {
    map.set(`${account.platformKey}:${account.externalAccountId}`, account);
  }
  return Array.from(map.values()).sort((left, right) =>
    left.platformKey.localeCompare(right.platformKey) ||
    left.externalAccountName.localeCompare(right.externalAccountName),
  );
}

export function getCachedAdApiAccounts() {
  return readCache<AdApiAccount[]>(API_ACCOUNTS_CACHE_KEY, []);
}

export function getCachedAdAccountApiMappings() {
  return readCache<AdAccountApiMapping[]>(API_MAPPINGS_CACHE_KEY, []);
}

export async function fetchAdApiAccounts() {
  try {
    const { data, error } = await supabase
      .from('ad_api_accounts')
      .select('*')
      .order('platform_key', { ascending: true })
      .order('external_account_name', { ascending: true });

    if (error) throw new Error(error.message);
    const rows = (data || []).map(mapApiAccountFromDb);
    writeCache(API_ACCOUNTS_CACHE_KEY, rows);
    return rows;
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    return getCachedAdApiAccounts();
  }
}

export async function upsertAdApiAccounts(accounts: AdApiAccountInput[]) {
  const normalized = accounts.filter((account) => account.platformKey && account.externalAccountId);
  if (normalized.length === 0) return getCachedAdApiAccounts();

  const localRows = normalized.map((account) => ({
    id: account.id || createLocalId('api'),
    ...account,
  }));

  writeCache(API_ACCOUNTS_CACHE_KEY, mergeApiAccounts(getCachedAdApiAccounts(), localRows));

  try {
    const { data, error } = await supabase
      .from('ad_api_accounts')
      .upsert(normalized.map(mapApiAccountToDb), {
        onConflict: 'platform_key,external_account_id',
      })
      .select('*');

    if (error) throw new Error(error.message);
    const rows = mergeApiAccounts(getCachedAdApiAccounts(), (data || []).map(mapApiAccountFromDb));
    writeCache(API_ACCOUNTS_CACHE_KEY, rows);
    return rows;
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    return getCachedAdApiAccounts();
  }
}

export async function saveAdApiAccount(account: AdApiAccountInput) {
  const now = new Date().toISOString();
  const localAccount: AdApiAccount = {
    id: account.id || createLocalId('api'),
    ...account,
    externalAccountName: account.externalAccountName.trim(),
    externalAccountId: account.externalAccountId.trim(),
    externalGroupId: account.externalGroupId?.trim() || null,
    externalGroupName: account.externalGroupName?.trim() || null,
    externalAccountStatus: account.externalAccountStatus?.trim() || null,
    currencyCode: account.currencyCode?.trim() || null,
    raw: {
      source: 'manual',
      ...(account.raw || {}),
    },
    lastSyncedAt: account.lastSyncedAt || now,
  };

  writeCache(API_ACCOUNTS_CACHE_KEY, mergeApiAccounts(getCachedAdApiAccounts(), [localAccount]));

  try {
    const { data, error } = await supabase
      .from('ad_api_accounts')
      .upsert(mapApiAccountToDb(localAccount), {
        onConflict: 'platform_key,external_account_id',
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    const saved = mapApiAccountFromDb(data);
    writeCache(API_ACCOUNTS_CACHE_KEY, mergeApiAccounts(getCachedAdApiAccounts(), [saved]));
    return saved;
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    return localAccount;
  }
}

export async function deleteAdApiAccount(account: AdApiAccount) {
  const now = new Date().toISOString();
  const nextAccounts = getCachedAdApiAccounts().filter(
    (item) => !(item.platformKey === account.platformKey && item.externalAccountId === account.externalAccountId),
  );
  const nextMappings = getCachedAdAccountApiMappings().filter(
    (item) => !(item.platformKey === account.platformKey && item.externalAccountId === account.externalAccountId),
  );

  writeCache(API_ACCOUNTS_CACHE_KEY, nextAccounts);
  writeCache(API_MAPPINGS_CACHE_KEY, nextMappings);

  try {
    const { error: mappingError } = await supabase
      .from('ad_account_api_mappings')
      .update({ status: 'inactive', updated_at: now })
      .eq('platform_key', account.platformKey)
      .eq('external_account_id', account.externalAccountId)
      .eq('status', 'active');

    if (mappingError) throw new Error(mappingError.message);

    let query = supabase.from('ad_api_accounts').delete();
    if (isUuid(account.id)) {
      query = query.eq('id', account.id);
    } else {
      query = query
        .eq('platform_key', account.platformKey)
        .eq('external_account_id', account.externalAccountId);
    }

    const { error } = await query;
    if (error) throw new Error(error.message);
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }
}

export async function fetchAdAccountApiMappings() {
  try {
    const { data, error } = await supabase
      .from('ad_account_api_mappings')
      .select('*')
      .eq('status', 'active')
      .order('updated_at', { ascending: false });

    if (error) throw new Error(error.message);
    const rows = (data || []).map(mapMappingFromDb);
    writeCache(API_MAPPINGS_CACHE_KEY, rows);
    return rows;
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    return getCachedAdAccountApiMappings();
  }
}

export async function saveAdAccountApiMapping(input: {
  internalAdAccountId: string;
  apiAccount: AdApiAccount;
  notes?: string | null;
}) {
  const now = new Date().toISOString();
  const localMappings = getCachedAdAccountApiMappings()
    .filter((mapping) =>
      mapping.internalAdAccountId !== input.internalAdAccountId &&
      !(mapping.platformKey === input.apiAccount.platformKey && mapping.externalAccountId === input.apiAccount.externalAccountId),
    );

  const localMapping: AdAccountApiMapping = {
    id: createLocalId('mapping'),
    internalAdAccountId: input.internalAdAccountId,
    apiAccountId: input.apiAccount.id,
    platformKey: input.apiAccount.platformKey,
    externalAccountId: input.apiAccount.externalAccountId,
    status: 'active',
    notes: input.notes || null,
    createdAt: now,
    updatedAt: now,
  };

  writeCache(API_MAPPINGS_CACHE_KEY, [localMapping, ...localMappings]);

  try {
    await supabase
      .from('ad_account_api_mappings')
      .update({ status: 'inactive', updated_at: now })
      .or(`internal_ad_account_id.eq.${input.internalAdAccountId},and(platform_key.eq.${input.apiAccount.platformKey},external_account_id.eq.${input.apiAccount.externalAccountId})`)
      .eq('status', 'active');

    const { data, error } = await supabase
      .from('ad_account_api_mappings')
      .insert({
        internal_ad_account_id: input.internalAdAccountId,
        api_account_id: isUuid(input.apiAccount.id) ? input.apiAccount.id : null,
        platform_key: input.apiAccount.platformKey,
        external_account_id: input.apiAccount.externalAccountId,
        status: 'active',
        notes: input.notes || null,
        updated_at: now,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    const saved = mapMappingFromDb(data);
    const rows = [saved, ...localMappings];
    writeCache(API_MAPPINGS_CACHE_KEY, rows);
    return saved;
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
    return localMapping;
  }
}

export async function removeAdAccountApiMapping(mapping: AdAccountApiMapping) {
  const now = new Date().toISOString();
  const rows = getCachedAdAccountApiMappings().filter((item) => item.id !== mapping.id);
  writeCache(API_MAPPINGS_CACHE_KEY, rows);

  try {
    const { error } = await supabase
      .from('ad_account_api_mappings')
      .update({ status: 'inactive', updated_at: now })
      .eq('id', mapping.id);

    if (error) throw new Error(error.message);
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }
}
