import { createClient } from "npm:@supabase/supabase-js@2";

export type AdsSnapshotPlatformKey = "meta" | "google" | "tiktok";

export type AdsDailySnapshotRecord = {
  platformKey: AdsSnapshotPlatformKey;
  snapshotDate: string;
  internalAdAccountId?: string | null;
  advertiserId?: string | null;
  platformId?: string | null;
  externalAccountId: string;
  externalAccountName: string;
  externalGroupId?: string | null;
  externalGroupName?: string | null;
  externalAccountStatus?: string | null;
  currencyCode?: string | null;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  conversions: number;
  ctr?: number | null;
  cpc?: number | null;
  cpm?: number | null;
  costPerConversion?: number | null;
  error?: string | null;
  syncedAt?: string;
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "",
);

function toNullableNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchAdsDailySnapshots(params: {
  platformKey: AdsSnapshotPlatformKey;
  from: string;
  to: string;
}) {
  const { data, error } = await supabase
    .from("ads_live_daily_snapshots")
    .select("*")
    .eq("platform_key", params.platformKey)
    .gte("snapshot_date", params.from)
    .lte("snapshot_date", params.to)
    .order("snapshot_date", { ascending: true })
    .order("external_account_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    id: row.id as string,
    platformKey: row.platform_key as AdsSnapshotPlatformKey,
    snapshotDate: row.snapshot_date as string,
    internalAdAccountId: row.internal_ad_account_id || null,
    advertiserId: row.advertiser_id || null,
    platformId: row.platform_id || null,
    externalAccountId: row.external_account_id as string,
    externalAccountName: row.external_account_name as string,
    externalGroupId: row.external_group_id || null,
    externalGroupName: row.external_group_name || null,
    externalAccountStatus: row.external_account_status || null,
    currencyCode: row.currency_code || null,
    spend: toNumber(row.spend),
    clicks: toNumber(row.clicks),
    impressions: toNumber(row.impressions),
    reach: toNumber(row.reach),
    conversions: toNumber(row.conversions),
    ctr: toNullableNumber(row.ctr),
    cpc: toNullableNumber(row.cpc),
    cpm: toNullableNumber(row.cpm),
    costPerConversion: toNullableNumber(row.cost_per_conversion),
    error: row.error || null,
    syncedAt: row.synced_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

export async function fetchLatestAdsDailySnapshotsBeforeOrOn(params: {
  platformKey: AdsSnapshotPlatformKey;
  onOrBefore: string;
  externalAccountIds?: string[];
  externalGroupId?: string | null;
}) {
  let query = supabase
    .from("ads_live_daily_snapshots")
    .select("*")
    .eq("platform_key", params.platformKey)
    .lte("snapshot_date", params.onOrBefore)
    .order("snapshot_date", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(5000);

  if (params.externalAccountIds && params.externalAccountIds.length > 0) {
    query = query.in("external_account_id", params.externalAccountIds);
  }

  if (params.externalGroupId) {
    query = query.eq("external_group_id", params.externalGroupId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const latestByAccountId = new Map<string, any>();
  for (const row of data || []) {
    const externalAccountId = row.external_account_id as string | undefined;
    if (!externalAccountId || latestByAccountId.has(externalAccountId)) continue;
    latestByAccountId.set(externalAccountId, row);
  }

  return Array.from(latestByAccountId.values()).map((row: any) => ({
    id: row.id as string,
    platformKey: row.platform_key as AdsSnapshotPlatformKey,
    snapshotDate: row.snapshot_date as string,
    internalAdAccountId: row.internal_ad_account_id || null,
    advertiserId: row.advertiser_id || null,
    platformId: row.platform_id || null,
    externalAccountId: row.external_account_id as string,
    externalAccountName: row.external_account_name as string,
    externalGroupId: row.external_group_id || null,
    externalGroupName: row.external_group_name || null,
    externalAccountStatus: row.external_account_status || null,
    currencyCode: row.currency_code || null,
    spend: toNumber(row.spend),
    clicks: toNumber(row.clicks),
    impressions: toNumber(row.impressions),
    reach: toNumber(row.reach),
    conversions: toNumber(row.conversions),
    ctr: toNullableNumber(row.ctr),
    cpc: toNullableNumber(row.cpc),
    cpm: toNullableNumber(row.cpm),
    costPerConversion: toNullableNumber(row.cost_per_conversion),
    error: row.error || null,
    syncedAt: row.synced_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

export async function getLatestAdsSnapshotSyncAt(params: {
  platformKey: AdsSnapshotPlatformKey;
  from: string;
  to: string;
}) {
  const { data, error } = await supabase
    .from("ads_live_daily_snapshots")
    .select("synced_at")
    .eq("platform_key", params.platformKey)
    .gte("snapshot_date", params.from)
    .lte("snapshot_date", params.to)
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.synced_at as string | undefined) || null;
}

export async function upsertAdsDailySnapshots(records: AdsDailySnapshotRecord[]) {
  if (records.length === 0) {
    return { upsertedCount: 0 };
  }

  const now = new Date().toISOString();
  const payload = records.map((record) => ({
    platform_key: record.platformKey,
    snapshot_date: record.snapshotDate,
    internal_ad_account_id: record.internalAdAccountId || null,
    advertiser_id: record.advertiserId || null,
    platform_id: record.platformId || null,
    external_account_id: record.externalAccountId,
    external_account_name: record.externalAccountName,
    external_group_id: record.externalGroupId || null,
    external_group_name: record.externalGroupName || null,
    external_account_status: record.externalAccountStatus || null,
    currency_code: record.currencyCode || null,
    spend: record.spend || 0,
    clicks: record.clicks || 0,
    impressions: record.impressions || 0,
    reach: record.reach || 0,
    conversions: record.conversions || 0,
    ctr: record.ctr ?? null,
    cpc: record.cpc ?? null,
    cpm: record.cpm ?? null,
    cost_per_conversion: record.costPerConversion ?? null,
    error: record.error || null,
    synced_at: record.syncedAt || now,
    updated_at: now,
  }));

  const { error } = await supabase
    .from("ads_live_daily_snapshots")
    .upsert(payload, {
      onConflict: "platform_key,snapshot_date,external_account_id",
    });

  if (error) {
    throw new Error(error.message);
  }

  return { upsertedCount: payload.length };
}

export async function loadInternalAdAccounts() {
  const { data, error } = await supabase
    .from("ad_accounts")
    .select("id, advertiser_id, platform_id, account_name, status, ppn, fee");

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    id: row.id as string,
    advertiserId: row.advertiser_id as string | null,
    platformId: row.platform_id as string | null,
    accountName: row.account_name as string,
    status: row.status as string | null,
    ppn: toNullableNumber(row.ppn),
    fee: toNullableNumber(row.fee),
  }));
}
