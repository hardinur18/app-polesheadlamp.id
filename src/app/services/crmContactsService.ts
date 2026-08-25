import { supabase } from '@/lib/supabaseClient';
import type { Order } from '@/app/pages/master-data/data';

const crmSupabase = supabase as any;
const CRM_SAVED_METADATA_KEY = 'crmSaved';
const CRM_CONTACTS_FETCH_PAGE_SIZE = 1000;
const CRM_CONTACTS_FETCH_CONCURRENCY = 3;

export type CrmContactType = 'prospect' | 'customer' | 'vendor' | 'staff' | 'technician' | 'other';
export type CrmContactStatus = 'active' | 'archived' | 'blocked';

export interface CrmContact {
  id: string;
  displayName: string;
  phoneRaw: string | null;
  phoneNormalized: string | null;
  whatsappName: string | null;
  email: string | null;
  contactType: CrmContactType;
  status: CrmContactStatus;
  sourceModule: string | null;
  sourceRefId: string | null;
  lastInteractionAt: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CrmContactSnapshotInput {
  displayName?: string | null;
  phoneRaw?: string | null;
  whatsappName?: string | null;
  email?: string | null;
  contactType?: CrmContactType;
  status?: CrmContactStatus;
  sourceModule?: string | null;
  sourceLabel?: string | null;
  sourceRefId?: string | null;
  lastInteractionAt?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CrmContactUpdateInput {
  displayName?: string | null;
  email?: string | null;
  notes?: string | null;
  phoneRaw?: string | null;
  status?: CrmContactStatus;
  contactType?: CrmContactType;
  metadata?: Record<string, unknown> | null;
}

type CrmContactRow = {
  id: string;
  display_name: string;
  phone_raw: string | null;
  phone_normalized: string | null;
  whatsapp_name: string | null;
  email: string | null;
  contact_type: CrmContactType;
  status: CrmContactStatus;
  source_module: string | null;
  source_ref_id: string | null;
  last_interaction_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export function normalizeCrmContactPhone(value: string | null | undefined) {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

function getPreferredCrmContactType(
  existingType: CrmContactType | null | undefined,
  incomingType: CrmContactType | null | undefined,
) {
  if (incomingType === 'customer') return 'customer';
  if (existingType === 'customer') return 'customer';
  if (existingType && existingType !== 'other') return existingType;
  return incomingType || existingType || 'other';
}

function getPreferredCrmContactStatus(
  existingStatus: CrmContactStatus | null | undefined,
  incomingStatus: CrmContactStatus | null | undefined,
) {
  if (existingStatus === 'blocked') return 'blocked';
  if (incomingStatus === 'active' || existingStatus === 'active') return 'active';
  return incomingStatus || existingStatus || 'active';
}

function getPreferredCrmContactDisplayName(
  existingName: string | null | undefined,
  incomingName: string,
  incomingSourceModule: string | null | undefined,
) {
  const cleanIncoming = incomingName.trim();
  const cleanExisting = existingName?.trim();
  if (incomingSourceModule === 'pesanan' && cleanIncoming) return cleanIncoming;
  return cleanExisting || cleanIncoming || 'Kontak';
}

function getPreferredCrmContactSourceModule(
  existingSourceModule: string | null | undefined,
  incomingSourceModule: string | null | undefined,
) {
  if (incomingSourceModule === 'pesanan') return 'pesanan';
  return existingSourceModule || incomingSourceModule || null;
}

function getPreferredCrmContactSourceRefId(
  existingSourceRefId: string | null | undefined,
  incomingSourceRefId: string | null | undefined,
  incomingSourceModule: string | null | undefined,
) {
  if (incomingSourceModule === 'pesanan' && incomingSourceRefId) return incomingSourceRefId;
  return existingSourceRefId || incomingSourceRefId || null;
}

export function isSavedCrmContact(contact: Pick<CrmContact, 'contactType' | 'metadata' | 'sourceModule' | 'status'>) {
  const metadata = contact.metadata || {};
  const savedSource = typeof metadata.savedToContactsSource === 'string' ? metadata.savedToContactsSource : '';
  return (
    contact.status === 'active' &&
    contact.contactType === 'customer' &&
    (
      contact.sourceModule === 'pesanan' ||
      contact.sourceModule === 'kontak' ||
      typeof metadata.orderId === 'string' ||
      metadata.savedToContacts === true ||
      metadata.crmSaved === true ||
      savedSource.startsWith('pesanan') ||
      savedSource.startsWith('kontak')
    )
  );
}

function mapCrmContact(row: CrmContactRow): CrmContact {
  return {
    id: row.id,
    displayName: row.display_name,
    phoneRaw: row.phone_raw,
    phoneNormalized: row.phone_normalized,
    whatsappName: row.whatsapp_name,
    email: row.email,
    contactType: row.contact_type,
    status: row.status,
    sourceModule: row.source_module,
    sourceRefId: row.source_ref_id,
    lastInteractionAt: row.last_interaction_at,
    notes: row.notes,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isMissingCrmContactsTableError(error: unknown) {
  const record = error as { code?: string; message?: string; details?: string; hint?: string } | null;
  const text = `${record?.message || ''} ${record?.details || ''} ${record?.hint || ''}`.toLowerCase();
  const mentionsCrmContacts = text.includes('crm_contacts') || text.includes('crm_contact_links');
  return (
    (record?.code === '42P01' && mentionsCrmContacts) ||
    (record?.code === 'PGRST205' && mentionsCrmContacts) ||
    (mentionsCrmContacts && (text.includes('schema cache') || text.includes('relation')))
  );
}

export async function fetchCrmContacts(params?: {
  status?: CrmContactStatus | 'all';
  contactType?: CrmContactType | 'all';
  sourceModule?: string | 'all';
  search?: string;
  limit?: number;
}): Promise<{ contacts: CrmContact[]; available: boolean }> {
  const limit = params?.limit || 1000;
  const pageSize = Math.min(CRM_CONTACTS_FETCH_PAGE_SIZE, limit);
  const contacts: CrmContact[] = [];
  const pageRanges: Array<{ from: number; to: number }> = [];

  for (let from = 0; from < limit; from += pageSize) {
    pageRanges.push({ from, to: Math.min(from + pageSize - 1, limit - 1) });
  }

  for (let index = 0; index < pageRanges.length; index += CRM_CONTACTS_FETCH_CONCURRENCY) {
    const batch = pageRanges.slice(index, index + CRM_CONTACTS_FETCH_CONCURRENCY);
    const results = await Promise.all(
      batch.map(({ from, to }) =>
        fetchCrmContactsPage({
          ...params,
          limit: to - from + 1,
          offset: from,
        }),
      ),
    );

    let reachedEnd = false;
    for (const result of results) {
      if (!result.available) return { contacts: [], available: false };
      contacts.push(...result.contacts);
      if (result.reachedEnd) reachedEnd = true;
    }

    if (reachedEnd) break;
  }

  return { contacts: contacts.slice(0, limit), available: true };
}

export async function fetchCrmContactsPage(params?: {
  status?: CrmContactStatus | 'all';
  contactType?: CrmContactType | 'all';
  sourceModule?: string | 'all';
  search?: string;
  limit?: number;
  offset?: number;
  includeCount?: boolean;
}): Promise<{
  contacts: CrmContact[];
  available: boolean;
  count: number | null;
  reachedEnd: boolean;
}> {
  const limit = Math.max(1, params?.limit || CRM_CONTACTS_FETCH_PAGE_SIZE);
  const offset = Math.max(0, params?.offset || 0);
  const selectOptions = params?.includeCount ? { count: 'exact' as const } : undefined;
  let query = selectOptions
    ? crmSupabase.from('crm_contacts').select('*', selectOptions)
    : crmSupabase.from('crm_contacts').select('*');

  if (params?.status && params.status !== 'all') query = query.eq('status', params.status);
  if (params?.contactType && params.contactType !== 'all') query = query.eq('contact_type', params.contactType);
  if (params?.sourceModule && params.sourceModule !== 'all') query = query.eq('source_module', params.sourceModule);

  const search = params?.search?.trim();
  if (search) {
    const safeSearch = search.replace(/[%_]/g, '\\$&');
    query = query.or(
      [
        `display_name.ilike.%${safeSearch}%`,
        `phone_raw.ilike.%${safeSearch}%`,
        `phone_normalized.ilike.%${safeSearch}%`,
        `whatsapp_name.ilike.%${safeSearch}%`,
        `email.ilike.%${safeSearch}%`,
      ].join(','),
    );
  }

  const { data, error, count } = await query
    .order('last_interaction_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    if (isMissingCrmContactsTableError(error)) {
      return { contacts: [], available: false, count: null, reachedEnd: true };
    }
    throw error;
  }

  const rows = (data || []) as CrmContactRow[];
  return {
    contacts: rows.map(mapCrmContact),
    available: true,
    count: typeof count === 'number' ? count : null,
    reachedEnd: rows.length < limit,
  };
}

export async function upsertCrmContactSnapshot(
  input: CrmContactSnapshotInput,
): Promise<{ contact: CrmContact | null; available: boolean }> {
  const phoneNormalized = normalizeCrmContactPhone(input.phoneRaw);
  const displayName =
    input.displayName?.trim() ||
    input.whatsappName?.trim() ||
    input.phoneRaw?.trim() ||
    input.email?.trim() ||
    'Kontak';

  let existing: CrmContactRow | null = null;

  if (phoneNormalized) {
    const { data, error } = await crmSupabase
      .from('crm_contacts')
      .select('*')
      .eq('phone_normalized', phoneNormalized)
      .maybeSingle();
    if (error) {
      if (isMissingCrmContactsTableError(error)) return { contact: null, available: false };
      throw error;
    }
    existing = data as CrmContactRow | null;
  }

  if (!existing && input.sourceModule && input.sourceRefId) {
    const { data: link, error: linkError } = await crmSupabase
      .from('crm_contact_links')
      .select('contact_id')
      .eq('module', input.sourceModule)
      .eq('ref_id', input.sourceRefId)
      .maybeSingle();
    if (linkError) {
      if (isMissingCrmContactsTableError(linkError)) return { contact: null, available: false };
      throw linkError;
    }

    if (link?.contact_id) {
      const { data, error } = await crmSupabase.from('crm_contacts').select('*').eq('id', link.contact_id).maybeSingle();
      if (error) {
        if (isMissingCrmContactsTableError(error)) return { contact: null, available: false };
        throw error;
      }
      existing = data as CrmContactRow | null;
    }
  }

  const payload = {
    display_name: getPreferredCrmContactDisplayName(existing?.display_name, displayName, input.sourceModule),
    phone_raw: input.sourceModule === 'pesanan' ? input.phoneRaw || existing?.phone_raw || phoneNormalized : existing?.phone_raw || input.phoneRaw || phoneNormalized,
    phone_normalized: existing?.phone_normalized || phoneNormalized,
    whatsapp_name: input.whatsappName || existing?.whatsapp_name || null,
    email: input.email || existing?.email || null,
    contact_type: getPreferredCrmContactType(existing?.contact_type, input.contactType),
    status: getPreferredCrmContactStatus(existing?.status, input.status),
    source_module: getPreferredCrmContactSourceModule(existing?.source_module, input.sourceModule),
    source_ref_id: getPreferredCrmContactSourceRefId(existing?.source_ref_id, input.sourceRefId, input.sourceModule),
    last_interaction_at: input.lastInteractionAt || existing?.last_interaction_at || null,
    notes: input.notes || existing?.notes || null,
    metadata: {
      ...(existing?.metadata || {}),
      ...(input.metadata || {}),
    },
  };

  const { data, error } = existing
    ? await crmSupabase.from('crm_contacts').update(payload).eq('id', existing.id).select('*').single()
    : await crmSupabase.from('crm_contacts').insert(payload).select('*').single();

  if (error) {
    if (isMissingCrmContactsTableError(error)) return { contact: null, available: false };
    throw error;
  }

  const contact = mapCrmContact(data as CrmContactRow);

  if (input.sourceModule && input.sourceRefId) {
    const { error: linkError } = await crmSupabase.from('crm_contact_links').upsert(
      {
        contact_id: contact.id,
        module: input.sourceModule,
        ref_id: input.sourceRefId,
        label: input.sourceLabel || input.sourceModule,
        metadata: input.metadata || {},
      },
      { onConflict: 'module,ref_id' },
    );
    if (linkError && !isMissingCrmContactsTableError(linkError)) throw linkError;
  }

  return { contact, available: true };
}

export async function updateCrmContact(
  id: string,
  input: CrmContactUpdateInput,
): Promise<{ contact: CrmContact | null; available: boolean }> {
  const payload = {
    ...(input.displayName !== undefined ? { display_name: input.displayName?.trim() || 'Kontak' } : {}),
    ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
    ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    ...(input.phoneRaw !== undefined ? { phone_raw: input.phoneRaw?.trim() || null } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.contactType !== undefined ? { contact_type: input.contactType } : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata || {} } : {}),
  };

  const { data, error } = await crmSupabase.from('crm_contacts').update(payload).eq('id', id).select('*').single();

  if (error) {
    if (isMissingCrmContactsTableError(error)) return { contact: null, available: false };
    throw error;
  }

  return { contact: mapCrmContact(data as CrmContactRow), available: true };
}

export async function createManualCrmContact(input: {
  displayName: string;
  phoneRaw: string;
  email?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const savedAt = new Date().toISOString();
  const result = await upsertCrmContactSnapshot({
    displayName: input.displayName,
    phoneRaw: input.phoneRaw,
    email: input.email || null,
    notes: input.notes || null,
    contactType: 'customer',
    status: 'active',
    sourceModule: 'kontak',
    sourceLabel: 'Kontak CRM',
    sourceRefId: `manual:${savedAt}:${Math.random().toString(36).slice(2, 8)}`,
    lastInteractionAt: savedAt,
    metadata: {
      [CRM_SAVED_METADATA_KEY]: true,
      savedToContacts: true,
      savedToContactsAt: savedAt,
      savedToContactsSource: 'kontak_manual',
      ...(input.metadata || {}),
    },
  });

  if (!result.contact) return result;

  return updateCrmContact(result.contact.id, {
    displayName: input.displayName,
    email: input.email || null,
    notes: input.notes || null,
    contactType: 'customer',
    status: 'active',
    metadata: {
      ...result.contact.metadata,
      [CRM_SAVED_METADATA_KEY]: true,
      savedToContacts: true,
      savedToContactsAt: savedAt,
      savedToContactsSource: 'kontak_manual',
      ...(input.metadata || {}),
    },
  });
}

export async function archiveCrmContact(id: string) {
  return updateCrmContact(id, { status: 'archived' });
}

export async function snapshotCrmContacts(inputs: CrmContactSnapshotInput[]) {
  let available = true;
  let saved = 0;
  let failed = 0;

  for (const input of inputs) {
    try {
      const result = await upsertCrmContactSnapshot(input);
      if (!result.available) available = false;
      if (result.contact) saved += 1;
    } catch {
      failed += 1;
    }
  }

  return { available, saved, failed };
}

export function buildOrderCrmContactSnapshot(
  order: Order,
  options?: { savedBy?: string | null; savedAt?: string; savedFrom?: string },
): CrmContactSnapshotInput {
  const savedAt = options?.savedAt || new Date().toISOString();
  const savedFrom = options?.savedFrom || 'pesanan';
  return {
    displayName: order.customerName || order.customerPhone || 'Customer',
    phoneRaw: order.customerPhone,
    contactType: 'customer',
    status: order.status === 'cancelled' ? 'archived' : 'active',
    sourceModule: 'pesanan',
    sourceLabel: 'Pesanan',
    sourceRefId: order.id,
    lastInteractionAt: order.serviceDate || order.created_at || savedAt,
    notes: order.notes || null,
    metadata: {
      [CRM_SAVED_METADATA_KEY]: true,
      savedToContacts: true,
      savedToContactsAt: savedAt,
      savedToContactsBy: options?.savedBy || null,
      savedToContactsSource: savedFrom,
      orderId: order.id,
      orderStatus: order.status,
      leadId: order.leadId ?? null,
      paymentStatus: order.paymentStatus ?? null,
      serviceDate: order.serviceDate ?? null,
      serviceTime: order.serviceTime ?? null,
      serviceId: order.serviceId ?? null,
      serviceCategory: order.serviceCategory ?? null,
      vehicleId: order.vehicleId ?? null,
      branchId: order.branchId ?? null,
      areaId: order.areaId ?? null,
      platformId: order.platformId ?? null,
      subChannelId: order.subChannelId ?? null,
      advertiserId: order.advertiserId ?? null,
      csId: order.csId ?? null,
      technicianId: order.technicianId ?? null,
    },
  };
}

export async function saveOrderToCrmContact(
  order: Order,
  options?: { savedBy?: string | null; savedFrom?: string },
) {
  return upsertCrmContactSnapshot(buildOrderCrmContactSnapshot(order, options));
}

export async function saveOrdersToCrmContacts(
  orders: Order[],
  options?: { savedBy?: string | null; savedFrom?: string },
) {
  const savedAt = new Date().toISOString();
  return snapshotCrmContacts(orders.map((order) => buildOrderCrmContactSnapshot(order, { ...options, savedAt })));
}
