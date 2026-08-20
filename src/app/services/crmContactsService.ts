import { supabase } from '@/lib/supabaseClient';

const crmSupabase = supabase as any;

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
  search?: string;
  limit?: number;
}): Promise<{ contacts: CrmContact[]; available: boolean }> {
  let query = crmSupabase.from('crm_contacts').select('*');

  if (params?.status && params.status !== 'all') query = query.eq('status', params.status);
  if (params?.contactType && params.contactType !== 'all') query = query.eq('contact_type', params.contactType);

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

  const { data, error } = await query
    .order('last_interaction_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(params?.limit || 1000);

  if (error) {
    if (isMissingCrmContactsTableError(error)) return { contacts: [], available: false };
    throw error;
  }

  return { contacts: ((data || []) as CrmContactRow[]).map(mapCrmContact), available: true };
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
    display_name: existing?.display_name || displayName,
    phone_raw: existing?.phone_raw || input.phoneRaw || phoneNormalized,
    phone_normalized: existing?.phone_normalized || phoneNormalized,
    whatsapp_name: input.whatsappName || existing?.whatsapp_name || null,
    email: input.email || existing?.email || null,
    contact_type:
      existing?.contact_type && existing.contact_type !== 'other'
        ? existing.contact_type
        : input.contactType || existing?.contact_type || 'other',
    status: input.status || existing?.status || 'active',
    source_module: existing?.source_module || input.sourceModule || null,
    source_ref_id: existing?.source_ref_id || input.sourceRefId || null,
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

export async function snapshotCrmContacts(inputs: CrmContactSnapshotInput[]) {
  let available = true;
  let saved = 0;
  let failed = 0;

  const results = await Promise.allSettled(inputs.map((input) => upsertCrmContactSnapshot(input)));
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      if (!result.value.available) available = false;
      if (result.value.contact) saved += 1;
    } else {
      failed += 1;
    }
  });

  return { available, saved, failed };
}
