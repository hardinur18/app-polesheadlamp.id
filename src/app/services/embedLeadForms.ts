import { supabase } from '@/lib/supabaseClient';
import type { LeadStatus } from '@/app/pages/master-data/data';
import { buildMakeServerUrl } from '@/app/services/internal/functionsBaseUrl';
import { getSessionBackedEdgeHeaders } from '@/app/services/internal/sessionClientHeaders';
import { upsertCrmContactSnapshot } from '@/app/services/crmContactsService';

export type EmbedLeadRoutingMode = 'single_cs' | 'broadcast' | 'random' | 'round_robin';
export type EmbedLeadStatus = 'draft' | 'active' | 'paused' | 'archived';
export type EmbedLeadMode = 'iframe' | 'script' | 'both';

export type EmbedLeadFieldKey =
  | 'name'
  | 'phone'
  | 'platform_id'
  | 'sub_channel_id'
  | 'advertiser_id'
  | 'vehicle_id'
  | 'affiliate_id'
  | 'service_id'
  | 'notes'
  | 'social_platform'
  | 'social_username'
  | 'social_profile_url'
  | 'social_chat_url';

export type EmbedLeadInputType =
  | 'text'
  | 'tel'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'url'
  | 'hidden';

export type EmbedLeadFieldOption = {
  label: string;
  value: string;
};

export type EmbedLeadFieldDefinition = {
  key: EmbedLeadFieldKey;
  label: string;
  inputType: EmbedLeadInputType;
  placeholder?: string;
  lockedRequired?: boolean;
};

export type EmbedLeadForm = {
  id: string;
  name: string;
  slug: string;
  publicToken: string;
  description?: string | null;
  status: EmbedLeadStatus;
  embedMode: EmbedLeadMode;
  defaultStatus: LeadStatus;
  defaultServiceId?: string | null;
  defaultServiceName?: string | null;
  platformId?: string | null;
  subChannelId?: string | null;
  advertiserId?: string | null;
  adAccountId?: string | null;
  fallbackCsId?: string | null;
  routingMode: EmbedLeadRoutingMode;
  roundRobinCursor: number;
  lastRoutedCsId?: string | null;
  lastRoutedAt?: string | null;
  thankYouMessage?: string | null;
  redirectUrl?: string | null;
  submitButtonLabel: string;
  metaPixelId?: string | null;
  metaEventName: string;
  tiktokPixelId?: string | null;
  tiktokEventName: string;
  googleTagId?: string | null;
  googleAdsConversionId?: string | null;
  googleAdsConversionLabel?: string | null;
  googleEventName: string;
  trackingConfig: Record<string, unknown>;
  themeConfig: Record<string, unknown>;
  spamProtectionConfig: Record<string, unknown>;
  allowedEmbedOrigins: string[];
  metadata: Record<string, unknown>;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type EmbedLeadFormField = {
  id?: string;
  formId?: string;
  fieldKey: EmbedLeadFieldKey;
  label: string;
  placeholder?: string | null;
  helpText?: string | null;
  inputType: EmbedLeadInputType;
  isVisible: boolean;
  isRequired: boolean;
  sortOrder: number;
  options: EmbedLeadFieldOption[];
  validationConfig: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type EmbedLeadFormCsRoute = {
  id?: string;
  formId?: string;
  csId: string;
  status: 'active' | 'inactive';
  routeWeight: number;
  sortOrder: number;
  metadata: Record<string, unknown>;
};

export type EmbedLeadFormBundle = {
  form: EmbedLeadForm;
  fields: EmbedLeadFormField[];
  routes: EmbedLeadFormCsRoute[];
};

export type EmbedLeadFormSaveInput = {
  form: Partial<EmbedLeadForm> & Pick<EmbedLeadForm, 'name' | 'slug'>;
  fields: EmbedLeadFormField[];
  routes: EmbedLeadFormCsRoute[];
};

export type EmbedLeadSubmissionInput = {
  answers: Partial<Record<EmbedLeadFieldKey, string>>;
  landingPageUrl?: string;
  referrerUrl?: string;
  userAgent?: string;
  trackingContext?: Record<string, unknown>;
  utm?: Partial<Record<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term' | 'utm_content', string>>;
};

export const EMBED_LEAD_FIELD_DEFINITIONS: EmbedLeadFieldDefinition[] = [
  { key: 'name', label: 'Nama Customer', inputType: 'text', placeholder: 'Nama lengkap', lockedRequired: true },
  { key: 'phone', label: 'No. WhatsApp', inputType: 'tel', placeholder: '08xxxxxxxxxx', lockedRequired: true },
  { key: 'service_id', label: 'Produk/Layanan', inputType: 'select', placeholder: 'Pilih layanan' },
  { key: 'vehicle_id', label: 'Tipe Mobil', inputType: 'select', placeholder: 'Pilih tipe mobil' },
  { key: 'platform_id', label: 'Platform', inputType: 'select', placeholder: 'Pilih platform' },
  { key: 'sub_channel_id', label: 'Sub Channel', inputType: 'select', placeholder: 'Pilih sub channel' },
  { key: 'advertiser_id', label: 'Advertiser', inputType: 'select', placeholder: 'Pilih advertiser' },
  { key: 'affiliate_id', label: 'Affiliate', inputType: 'select', placeholder: 'Pilih affiliate' },
  { key: 'notes', label: 'Catatan/Keluhan', inputType: 'textarea', placeholder: 'Ceritakan kebutuhan customer' },
  { key: 'social_platform', label: 'Platform Sosial', inputType: 'select', placeholder: 'Instagram/TikTok' },
  { key: 'social_username', label: 'Username Sosial', inputType: 'text', placeholder: 'username customer' },
  { key: 'social_profile_url', label: 'Link Profil Sosial', inputType: 'url', placeholder: 'https://...' },
  { key: 'social_chat_url', label: 'Link Chat Sosial', inputType: 'url', placeholder: 'https://...' },
];

const REQUIRED_FIELD_KEYS: EmbedLeadFieldKey[] = ['name', 'phone'];
const EMBED_FORM_MASTER_TYPE = 'embed_lead_form';
const EMBED_SUBMISSION_MASTER_TYPE = 'embed_lead_form_submission';

type FallbackEmbedLeadFormRecord = EmbedLeadForm & {
  fields?: EmbedLeadFormField[];
  routes?: EmbedLeadFormCsRoute[];
};

type FallbackSubmissionRecord = Record<string, unknown> & {
  id: string;
  createdAt?: string;
  updatedAt?: string;
};

const cleanObject = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as Partial<T>;

const isMissingEmbedSchemaError = (error: any) => {
  const text = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    text.includes('pgrst205') ||
    text.includes('42p01') ||
    text.includes('schema cache') ||
    text.includes('could not find the table') ||
    text.includes('embed_lead_forms') ||
    text.includes('embed_lead_form_fields') ||
    text.includes('embed_lead_form_cs_routes') ||
    text.includes('embed_lead_form_submissions')
  );
};

const isLeadSchemaError = (error: any) => {
  const text = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    text.includes('pgrst204') ||
    text.includes('42703') ||
    text.includes('schema cache') ||
    text.includes('could not find') ||
    text.includes('embed_form') ||
    text.includes('service_id') ||
    text.includes('affiliate_id') ||
    text.includes('origin') ||
    text.includes('landing_page_url') ||
    text.includes('utm_')
  );
};

const createClientId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
};

const createPublicToken = () => createClientId().replace(/-/g, '');

const normalizeNullable = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const normalizeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

export const createEmbedLeadSlug = (name: string) => {
  const slug = normalizeSlug(name);
  if (slug.length >= 3) return slug;
  return `form-${Date.now().toString(36)}`;
};

const mapFormFromDB = (row: any): EmbedLeadForm => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  publicToken: row.public_token,
  description: row.description,
  status: row.status,
  embedMode: row.embed_mode,
  defaultStatus: row.default_status,
  defaultServiceId: row.default_service_id,
  defaultServiceName: row.default_service_name,
  platformId: row.platform_id,
  subChannelId: row.sub_channel_id,
  advertiserId: row.advertiser_id,
  adAccountId: row.ad_account_id,
  fallbackCsId: row.fallback_cs_id,
  routingMode: row.routing_mode,
  roundRobinCursor: row.round_robin_cursor ?? 0,
  lastRoutedCsId: row.last_routed_cs_id,
  lastRoutedAt: row.last_routed_at,
  thankYouMessage: row.thank_you_message,
  redirectUrl: row.redirect_url,
  submitButtonLabel: row.submit_button_label || 'Kirim',
  metaPixelId: row.meta_pixel_id,
  metaEventName: row.meta_event_name || 'Lead',
  tiktokPixelId: row.tiktok_pixel_id,
  tiktokEventName: row.tiktok_event_name || 'SubmitForm',
  googleTagId: row.google_tag_id,
  googleAdsConversionId: row.google_ads_conversion_id,
  googleAdsConversionLabel: row.google_ads_conversion_label,
  googleEventName: row.google_event_name || 'conversion',
  trackingConfig: row.tracking_config || {},
  themeConfig: row.theme_config || {},
  spamProtectionConfig: row.spam_protection_config || {},
  allowedEmbedOrigins: row.allowed_embed_origins || [],
  metadata: row.metadata || {},
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapFormToDB = (form: Partial<EmbedLeadForm>) => cleanObject({
  id: form.id,
  name: form.name,
  slug: form.slug ? createEmbedLeadSlug(form.slug) : undefined,
  public_token: form.publicToken,
  description: normalizeNullable(form.description),
  status: form.status || 'draft',
  embed_mode: form.embedMode || 'both',
  default_status: form.defaultStatus || 'Pending',
  default_service_id: normalizeNullable(form.defaultServiceId),
  default_service_name: normalizeNullable(form.defaultServiceName),
  platform_id: normalizeNullable(form.platformId),
  sub_channel_id: normalizeNullable(form.subChannelId),
  advertiser_id: normalizeNullable(form.advertiserId),
  ad_account_id: normalizeNullable(form.adAccountId),
  fallback_cs_id: normalizeNullable(form.fallbackCsId),
  routing_mode: form.routingMode || 'single_cs',
  round_robin_cursor: form.roundRobinCursor ?? 0,
  last_routed_cs_id: form.lastRoutedCsId,
  last_routed_at: form.lastRoutedAt,
  thank_you_message: normalizeNullable(form.thankYouMessage),
  redirect_url: normalizeNullable(form.redirectUrl),
  submit_button_label: form.submitButtonLabel || 'Kirim',
  meta_pixel_id: normalizeNullable(form.metaPixelId),
  meta_event_name: form.metaEventName || 'Lead',
  tiktok_pixel_id: normalizeNullable(form.tiktokPixelId),
  tiktok_event_name: form.tiktokEventName || 'SubmitForm',
  google_tag_id: normalizeNullable(form.googleTagId),
  google_ads_conversion_id: normalizeNullable(form.googleAdsConversionId),
  google_ads_conversion_label: normalizeNullable(form.googleAdsConversionLabel),
  google_event_name: form.googleEventName || 'conversion',
  tracking_config: form.trackingConfig || {},
  theme_config: form.themeConfig || {},
  spam_protection_config: form.spamProtectionConfig || {},
  allowed_embed_origins: form.allowedEmbedOrigins || [],
  metadata: form.metadata || {},
  created_by: form.createdBy,
  updated_by: form.updatedBy,
});

const mapFieldFromDB = (row: any): EmbedLeadFormField => ({
  id: row.id,
  formId: row.form_id,
  fieldKey: row.field_key,
  label: row.label,
  placeholder: row.placeholder,
  helpText: row.help_text,
  inputType: row.input_type,
  isVisible: row.is_visible,
  isRequired: row.is_required,
  sortOrder: row.sort_order ?? 0,
  options: Array.isArray(row.options) ? row.options : [],
  validationConfig: row.validation_config || {},
  metadata: row.metadata || {},
});

const mapFieldToDB = (formId: string, field: EmbedLeadFormField) => cleanObject({
  form_id: formId,
  field_key: field.fieldKey,
  label: field.label,
  placeholder: normalizeNullable(field.placeholder),
  help_text: normalizeNullable(field.helpText),
  input_type: field.inputType,
  is_visible: field.isVisible,
  is_required: REQUIRED_FIELD_KEYS.includes(field.fieldKey) ? true : field.isRequired,
  sort_order: field.sortOrder,
  options: field.options || [],
  validation_config: field.validationConfig || {},
  metadata: field.metadata || {},
});

const mapRouteFromDB = (row: any): EmbedLeadFormCsRoute => ({
  id: row.id,
  formId: row.form_id,
  csId: row.cs_id,
  status: row.status || 'active',
  routeWeight: row.route_weight ?? 1,
  sortOrder: row.sort_order ?? 0,
  metadata: row.metadata || {},
});

const mapRouteToDB = (formId: string, route: EmbedLeadFormCsRoute) => cleanObject({
  form_id: formId,
  cs_id: route.csId,
  status: route.status || 'active',
  route_weight: route.routeWeight || 1,
  sort_order: route.sortOrder || 0,
  metadata: route.metadata || {},
});

const fetchMasterItems = async <T,>(type: string): Promise<T[]> => {
  const response = await fetch(buildMakeServerUrl(`/master/${type}`), {
    headers: await getSessionBackedEdgeHeaders(),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Gagal memuat ${type}`);
  }

  return (await response.json()) as T[];
};

const saveMasterItem = async <T extends { id: string }>(type: string, item: T): Promise<T> => {
  const response = await fetch(buildMakeServerUrl(`/master/${type}`), {
    method: 'POST',
    headers: await getSessionBackedEdgeHeaders({ includeJsonContentType: true }),
    body: JSON.stringify(item),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Gagal menyimpan ${type}`);
  }

  return (await response.json()) as T;
};

const deleteMasterItem = async (type: string, id: string) => {
  const response = await fetch(buildMakeServerUrl(`/master/${type}/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: await getSessionBackedEdgeHeaders(),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Gagal menghapus ${type}`);
  }
};

const normalizeFallbackBundle = (row: FallbackEmbedLeadFormRecord): EmbedLeadFormBundle => ({
  form: {
    ...row,
    trackingConfig: row.trackingConfig || {},
    themeConfig: row.themeConfig || {},
    spamProtectionConfig: row.spamProtectionConfig || {},
    allowedEmbedOrigins: row.allowedEmbedOrigins || [],
    metadata: row.metadata || {},
  },
  fields: normalizeRequiredFields(row.fields || []),
  routes: row.routes || [],
});

const listEmbedLeadFormsFallback = async () => {
  const rows = await fetchMasterItems<FallbackEmbedLeadFormRecord>(EMBED_FORM_MASTER_TYPE);
  return rows.map((row) => normalizeFallbackBundle(row).form);
};

const fetchEmbedLeadFormBundleFallback = async (identifier: string, activeOnly = false) => {
  const rows = await fetchMasterItems<FallbackEmbedLeadFormRecord>(EMBED_FORM_MASTER_TYPE);
  const row = rows.find((item) =>
    item.id === identifier ||
    item.slug === identifier ||
    item.publicToken === identifier
  );

  if (!row) return null;
  if (activeOnly && row.status !== 'active') return null;
  return normalizeFallbackBundle(row);
};

const saveEmbedLeadFormFallback = async (input: EmbedLeadFormSaveInput): Promise<EmbedLeadFormBundle> => {
  const existingRows = await fetchMasterItems<FallbackEmbedLeadFormRecord>(EMBED_FORM_MASTER_TYPE);
  const existing = input.form.id
    ? existingRows.find((row) => row.id === input.form.id)
    : existingRows.find((row) => row.slug === input.form.slug);
  const now = new Date().toISOString();
  const id = input.form.id || existing?.id || createClientId();
  const publicToken = input.form.publicToken || existing?.publicToken || createPublicToken();
  const slug = createEmbedLeadSlug(input.form.slug || input.form.name);

  const form: EmbedLeadForm = {
    id,
    name: input.form.name,
    slug,
    publicToken,
    description: input.form.description || null,
    status: input.form.status || 'draft',
    embedMode: input.form.embedMode || 'both',
    defaultStatus: input.form.defaultStatus || 'Pending',
    defaultServiceId: input.form.defaultServiceId || null,
    defaultServiceName: input.form.defaultServiceName || null,
    platformId: input.form.platformId || null,
    subChannelId: input.form.subChannelId || null,
    advertiserId: input.form.advertiserId || null,
    adAccountId: input.form.adAccountId || null,
    fallbackCsId: input.form.fallbackCsId || null,
    routingMode: input.form.routingMode || 'single_cs',
    roundRobinCursor: input.form.roundRobinCursor ?? existing?.roundRobinCursor ?? 0,
    lastRoutedCsId: input.form.lastRoutedCsId || existing?.lastRoutedCsId || null,
    lastRoutedAt: input.form.lastRoutedAt || existing?.lastRoutedAt || null,
    thankYouMessage: input.form.thankYouMessage || null,
    redirectUrl: input.form.redirectUrl || null,
    submitButtonLabel: input.form.submitButtonLabel || 'Kirim',
    metaPixelId: input.form.metaPixelId || null,
    metaEventName: input.form.metaEventName || 'Lead',
    tiktokPixelId: input.form.tiktokPixelId || null,
    tiktokEventName: input.form.tiktokEventName || 'SubmitForm',
    googleTagId: input.form.googleTagId || null,
    googleAdsConversionId: input.form.googleAdsConversionId || null,
    googleAdsConversionLabel: input.form.googleAdsConversionLabel || null,
    googleEventName: input.form.googleEventName || 'conversion',
    trackingConfig: input.form.trackingConfig || {},
    themeConfig: input.form.themeConfig || {},
    spamProtectionConfig: input.form.spamProtectionConfig || {},
    allowedEmbedOrigins: input.form.allowedEmbedOrigins || [],
    metadata: input.form.metadata || {},
    createdBy: input.form.createdBy || existing?.createdBy || null,
    updatedBy: input.form.updatedBy || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const record: FallbackEmbedLeadFormRecord = {
    ...form,
    fields: normalizeRequiredFields(input.fields),
    routes: input.routes
      .filter((route) => route.csId)
      .map((route, index) => ({
        ...route,
        formId: id,
        status: route.status || 'active',
        routeWeight: route.routeWeight || 1,
        sortOrder: index * 10,
        metadata: route.metadata || {},
      })),
  };

  const saved = await saveMasterItem(EMBED_FORM_MASTER_TYPE, record);
  return normalizeFallbackBundle(saved);
};

export async function listEmbedLeadForms() {
  try {
    const { data, error } = await supabase
      .from('embed_lead_forms')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapFormFromDB);
  } catch (error) {
    if (isMissingEmbedSchemaError(error)) {
      return listEmbedLeadFormsFallback();
    }
    throw error;
  }
}

export async function fetchEmbedLeadFormBundle(identifier: string, activeOnly = false): Promise<EmbedLeadFormBundle | null> {
  const normalizedIdentifier = identifier.trim();
  if (!normalizedIdentifier) return null;

  try {
    let query = supabase
      .from('embed_lead_forms')
      .select('*')
      .eq('slug', normalizedIdentifier);

    if (activeOnly) {
      query = query.eq('status', 'active');
    }

    let { data: formRow, error } = await query.maybeSingle();
    if (error) throw error;

    if (!formRow) {
      let tokenQuery = supabase
        .from('embed_lead_forms')
        .select('*')
        .eq('public_token', normalizedIdentifier);

      if (activeOnly) {
        tokenQuery = tokenQuery.eq('status', 'active');
      }

      const tokenResult = await tokenQuery.maybeSingle();
      if (tokenResult.error) throw tokenResult.error;
      formRow = tokenResult.data;
    }

    if (!formRow) return null;

    const form = mapFormFromDB(formRow);
    const [fieldsResult, routesResult] = await Promise.all([
      supabase
        .from('embed_lead_form_fields')
        .select('*')
        .eq('form_id', form.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('embed_lead_form_cs_routes')
        .select('*')
        .eq('form_id', form.id)
        .order('sort_order', { ascending: true }),
    ]);

    if (fieldsResult.error) throw fieldsResult.error;
    if (routesResult.error) throw routesResult.error;

    return {
      form,
      fields: normalizeRequiredFields((fieldsResult.data || []).map(mapFieldFromDB)),
      routes: (routesResult.data || []).map(mapRouteFromDB),
    };
  } catch (error) {
    if (isMissingEmbedSchemaError(error)) {
      return fetchEmbedLeadFormBundleFallback(normalizedIdentifier, activeOnly);
    }
    throw error;
  }
}

export async function saveEmbedLeadForm(input: EmbedLeadFormSaveInput): Promise<EmbedLeadFormBundle> {
  try {
    const payload = mapFormToDB({
      ...input.form,
      slug: createEmbedLeadSlug(input.form.slug || input.form.name),
    });

    const formResult = input.form.id
      ? await supabase
          .from('embed_lead_forms')
          .update(payload)
          .eq('id', input.form.id)
          .select()
          .single()
      : await supabase
          .from('embed_lead_forms')
          .insert(payload)
          .select()
          .single();

    if (formResult.error) throw formResult.error;

    const form = mapFormFromDB(formResult.data);
    const normalizedFields = normalizeRequiredFields(input.fields);
    const normalizedRoutes = input.routes
      .filter((route) => route.csId)
      .map((route, index) => ({
        ...route,
        status: route.status || 'active',
        routeWeight: route.routeWeight || 1,
        sortOrder: index * 10,
      }));

    const deleteFields = await supabase.from('embed_lead_form_fields').delete().eq('form_id', form.id);
    if (deleteFields.error) throw deleteFields.error;

    const fieldRows = normalizedFields
      .filter((field) => field.isVisible)
      .map((field, index) => mapFieldToDB(form.id, { ...field, sortOrder: index * 10 }));

    if (fieldRows.length > 0) {
      const insertFields = await supabase.from('embed_lead_form_fields').insert(fieldRows);
      if (insertFields.error) throw insertFields.error;
    }

    const deleteRoutes = await supabase.from('embed_lead_form_cs_routes').delete().eq('form_id', form.id);
    if (deleteRoutes.error) throw deleteRoutes.error;

    if (normalizedRoutes.length > 0) {
      const insertRoutes = await supabase
        .from('embed_lead_form_cs_routes')
        .insert(normalizedRoutes.map((route) => mapRouteToDB(form.id, route)));
      if (insertRoutes.error) throw insertRoutes.error;
    }

    const refreshed = await fetchEmbedLeadFormBundle(form.slug);
    if (!refreshed) {
      throw new Error('Form tersimpan, tapi gagal dimuat ulang.');
    }

    return refreshed;
  } catch (error) {
    if (isMissingEmbedSchemaError(error)) {
      return saveEmbedLeadFormFallback(input);
    }
    throw error;
  }
}

export async function deleteEmbedLeadForm(id: string) {
  try {
    const { error } = await supabase.from('embed_lead_forms').delete().eq('id', id);
    if (error) throw error;
  } catch (error) {
    if (isMissingEmbedSchemaError(error)) {
      await deleteMasterItem(EMBED_FORM_MASTER_TYPE, id);
      return;
    }
    throw error;
  }
}

export function normalizeRequiredFields(fields: EmbedLeadFormField[]) {
  const map = new Map<EmbedLeadFieldKey, EmbedLeadFormField>();
  fields.forEach((field) => {
    map.set(field.fieldKey, field);
  });

  REQUIRED_FIELD_KEYS.forEach((fieldKey, index) => {
    const definition = EMBED_LEAD_FIELD_DEFINITIONS.find((field) => field.key === fieldKey)!;
    const existing = map.get(fieldKey);
    map.set(fieldKey, {
      fieldKey,
      label: existing?.label || definition.label,
      placeholder: existing?.placeholder || definition.placeholder,
      helpText: existing?.helpText || null,
      inputType: definition.inputType,
      isVisible: true,
      isRequired: true,
      sortOrder: existing?.sortOrder ?? index * 10,
      options: existing?.options || [],
      validationConfig: existing?.validationConfig || {},
      metadata: existing?.metadata || {},
      id: existing?.id,
      formId: existing?.formId,
    });
  });

  return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}

const generateShortLeadId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const selectRoute = (bundle: EmbedLeadFormBundle) => {
  const activeRoutes = bundle.routes
    .filter((route) => route.status === 'active' && route.csId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const routeCsIds = activeRoutes.map((route) => route.csId);
  const fallbackCsId = bundle.form.fallbackCsId || routeCsIds[0] || null;

  if (bundle.form.routingMode === 'broadcast') {
    return {
      primaryCsId: fallbackCsId,
      routedCsIds: routeCsIds.length > 0 ? routeCsIds : fallbackCsId ? [fallbackCsId] : [],
      nextCursor: bundle.form.roundRobinCursor,
    };
  }

  if (bundle.form.routingMode === 'random' && routeCsIds.length > 0) {
    const index = Math.floor(Math.random() * routeCsIds.length);
    return {
      primaryCsId: routeCsIds[index],
      routedCsIds: [routeCsIds[index]],
      nextCursor: bundle.form.roundRobinCursor,
    };
  }

  if (bundle.form.routingMode === 'round_robin' && routeCsIds.length > 0) {
    const index = bundle.form.roundRobinCursor % routeCsIds.length;
    return {
      primaryCsId: routeCsIds[index],
      routedCsIds: [routeCsIds[index]],
      nextCursor: bundle.form.roundRobinCursor + 1,
    };
  }

  return {
    primaryCsId: fallbackCsId,
    routedCsIds: fallbackCsId ? [fallbackCsId] : [],
    nextCursor: bundle.form.roundRobinCursor,
  };
};

const normalizeAnswer = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const createSubmissionRecord = async (payload: Record<string, unknown>) => {
  try {
    const submissionResult = await supabase
      .from('embed_lead_form_submissions')
      .insert(payload)
      .select()
      .single();

    if (submissionResult.error) throw submissionResult.error;
    return {
      submission: submissionResult.data as Record<string, unknown> & { id: string },
      storage: 'db' as const,
    };
  } catch (error) {
    if (!isMissingEmbedSchemaError(error)) throw error;

    const now = new Date().toISOString();
    const fallbackSubmission: FallbackSubmissionRecord = {
      id: createClientId(),
      ...payload,
      createdAt: now,
      updatedAt: now,
    };
    const saved = await saveMasterItem(EMBED_SUBMISSION_MASTER_TYPE, fallbackSubmission);
    return {
      submission: saved as Record<string, unknown> & { id: string },
      storage: 'fallback' as const,
    };
  }
};

const updateSubmissionRecord = async (
  storage: 'db' | 'fallback',
  submission: Record<string, unknown> & { id: string },
  patch: Record<string, unknown>,
) => {
  if (storage === 'db') {
    const result = await supabase
      .from('embed_lead_form_submissions')
      .update(patch)
      .eq('id', submission.id);
    if (result.error && !isMissingEmbedSchemaError(result.error)) throw result.error;
    return;
  }

  await saveMasterItem(EMBED_SUBMISSION_MASTER_TYPE, {
    ...submission,
    ...patch,
    updatedAt: new Date().toISOString(),
  } as FallbackSubmissionRecord);
};

const updateFormRoutingSnapshot = async (
  bundle: EmbedLeadFormBundle,
  patch: Partial<EmbedLeadForm>,
) => {
  const dbPatch = cleanObject({
    round_robin_cursor: patch.roundRobinCursor,
    last_routed_cs_id: patch.lastRoutedCsId,
    last_routed_at: patch.lastRoutedAt,
  });

  try {
    const result = await supabase
      .from('embed_lead_forms')
      .update(dbPatch)
      .eq('id', bundle.form.id);
    if (result.error) throw result.error;
  } catch (error) {
    if (!isMissingEmbedSchemaError(error)) throw error;

    await saveMasterItem(EMBED_FORM_MASTER_TYPE, {
      ...bundle.form,
      ...patch,
      fields: bundle.fields,
      routes: bundle.routes,
      updatedAt: new Date().toISOString(),
    } as FallbackEmbedLeadFormRecord);
  }
};

const legacyLeadPayload = (payload: Record<string, unknown>) => cleanObject({
  id: payload.id,
  name: payload.name,
  phone: payload.phone,
  status: payload.status,
  notes: payload.notes,
  platform_id: payload.platform_id,
  sub_channel_id: payload.sub_channel_id,
  advertiser_id: payload.advertiser_id,
  cs_id: payload.cs_id,
  vehicle_id: payload.vehicle_id,
  last_contact: payload.last_contact,
  template_history: payload.template_history,
  social_platform: payload.social_platform,
  social_username: payload.social_username,
  social_profile_url: payload.social_profile_url,
  social_chat_url: payload.social_chat_url,
  created_at: payload.created_at,
});

const minimalLeadPayload = (payload: Record<string, unknown>) => cleanObject({
  id: payload.id,
  name: payload.name,
  phone: payload.phone,
  status: payload.status,
  notes: payload.notes,
  platform_id: payload.platform_id,
  sub_channel_id: payload.sub_channel_id,
  advertiser_id: payload.advertiser_id,
  cs_id: payload.cs_id,
  vehicle_id: payload.vehicle_id,
  last_contact: payload.last_contact,
  template_history: payload.template_history,
  created_at: payload.created_at,
});

const insertLeadWithSchemaFallback = async (payload: Record<string, unknown>) => {
  const fullResult = await supabase.from('leads').insert(payload).select().single();
  if (!fullResult.error) return fullResult.data;

  if (!isLeadSchemaError(fullResult.error)) {
    throw fullResult.error;
  }

  const legacyResult = await supabase.from('leads').insert(legacyLeadPayload(payload)).select().single();
  if (!legacyResult.error) return legacyResult.data;

  if (!isLeadSchemaError(legacyResult.error)) {
    throw legacyResult.error;
  }

  const minimalResult = await supabase.from('leads').insert(minimalLeadPayload(payload)).select().single();
  if (minimalResult.error) throw minimalResult.error;
  return minimalResult.data;
};

export async function submitEmbedLeadForm(bundle: EmbedLeadFormBundle, input: EmbedLeadSubmissionInput) {
  const answers = input.answers || {};
  const customerName = normalizeAnswer(answers.name);
  const customerPhone = normalizeAnswer(answers.phone);

  if (!customerName || !customerPhone) {
    throw new Error('Nama customer dan No. WhatsApp wajib diisi.');
  }

  const route = selectRoute(bundle);
  const form = bundle.form;
  const serviceId = normalizeAnswer(answers.service_id) || form.defaultServiceId || null;
  const serviceField = bundle.fields.find((field) => field.fieldKey === 'service_id');
  const serviceName = serviceField?.options.find((option) => option.value === serviceId)?.label || form.defaultServiceName || null;

  const submissionPayload = cleanObject({
    form_id: form.id,
    form_slug: form.slug,
    form_name: form.name,
    public_token: form.publicToken,
    customer_name: customerName,
    customer_phone: customerPhone,
    service_id: serviceId,
    service_name: serviceName,
    platform_id: normalizeAnswer(answers.platform_id) || form.platformId || null,
    sub_channel_id: normalizeAnswer(answers.sub_channel_id) || form.subChannelId || null,
    advertiser_id: normalizeAnswer(answers.advertiser_id) || form.advertiserId || null,
    ad_account_id: form.adAccountId || null,
    vehicle_id: normalizeAnswer(answers.vehicle_id) || null,
    affiliate_id: normalizeAnswer(answers.affiliate_id) || null,
    notes: normalizeAnswer(answers.notes) || null,
    field_answers: answers,
    raw_payload: {
      answers,
      landingPageUrl: input.landingPageUrl,
      referrerUrl: input.referrerUrl,
      submittedAt: new Date().toISOString(),
    },
    tracking_context: input.trackingContext || {},
    routing_context: {
      routingMode: form.routingMode,
      fallbackCsId: form.fallbackCsId,
      activeRouteCount: bundle.routes.filter((item) => item.status === 'active').length,
    },
    utm_source: input.utm?.utm_source || null,
    utm_medium: input.utm?.utm_medium || null,
    utm_campaign: input.utm?.utm_campaign || null,
    utm_term: input.utm?.utm_term || null,
    utm_content: input.utm?.utm_content || null,
    landing_page_url: input.landingPageUrl || null,
    referrer_url: input.referrerUrl || null,
    user_agent: input.userAgent || null,
    status: 'received',
    routing_mode: form.routingMode,
    routed_cs_id: route.primaryCsId,
    routed_cs_ids: route.routedCsIds,
  });

  const { submission, storage } = await createSubmissionRecord(submissionPayload);

  const leadPayload = cleanObject({
    id: generateShortLeadId(),
    name: customerName,
    phone: customerPhone,
    status: form.defaultStatus || 'Pending',
    notes: normalizeAnswer(answers.notes) || null,
    platform_id: normalizeAnswer(answers.platform_id) || form.platformId || null,
    sub_channel_id: normalizeAnswer(answers.sub_channel_id) || form.subChannelId || null,
    advertiser_id: normalizeAnswer(answers.advertiser_id) || form.advertiserId || null,
    cs_id: route.primaryCsId,
    vehicle_id: normalizeAnswer(answers.vehicle_id) || null,
    service_id: serviceId,
    affiliate_id: normalizeAnswer(answers.affiliate_id) || null,
    social_platform: normalizeAnswer(answers.social_platform) || null,
    social_username: normalizeAnswer(answers.social_username) || null,
    social_profile_url: normalizeAnswer(answers.social_profile_url) || null,
    social_chat_url: normalizeAnswer(answers.social_chat_url) || null,
    embed_form_id: form.id,
    embed_form_submission_id: submission.id,
    embed_form_slug: form.slug,
    embed_form_name: form.name,
    origin: 'embed_form',
    landing_page_url: input.landingPageUrl || null,
    utm_source: input.utm?.utm_source || null,
    utm_medium: input.utm?.utm_medium || null,
    utm_campaign: input.utm?.utm_campaign || null,
    utm_term: input.utm?.utm_term || null,
    utm_content: input.utm?.utm_content || null,
    created_at: new Date().toISOString(),
    last_contact: 'Baru saja',
    template_history: [],
  });

  try {
    const lead = await insertLeadWithSchemaFallback(leadPayload);
    const leadRecord = lead as Record<string, unknown>;
    const snapshotName = customerName || customerPhone;

    if (snapshotName) {
      void upsertCrmContactSnapshot({
        displayName: snapshotName,
        phoneRaw: customerPhone,
        contactType: 'prospect',
        status: 'active',
        sourceModule: 'form_embed',
        sourceLabel: 'Form Embed',
        sourceRefId: leadRecord.id ? String(leadRecord.id) : null,
        lastInteractionAt: new Date().toISOString(),
        notes: normalizeAnswer(answers.notes) || null,
        metadata: {
          formId: form.id,
          formSlug: form.slug,
          formName: form.name,
          submissionId: submission.id,
          assignedCsId: leadRecord.cs_id ?? route.primaryCsId ?? null,
          platformId: leadRecord.platform_id ?? null,
          subChannelId: leadRecord.sub_channel_id ?? null,
          advertiserId: leadRecord.advertiser_id ?? null,
          vehicleId: leadRecord.vehicle_id ?? null,
          serviceId: leadRecord.service_id ?? null,
          source: 'embed_lead_form',
        },
      }).catch((error) => console.warn('Gagal sinkron kontak CRM dari form embed:', error));
    }

    await updateSubmissionRecord(storage, submission, {
      lead_id: lead.id,
      lead_payload: leadPayload,
      status: 'lead_created',
      processed_at: new Date().toISOString(),
    });

    if (form.routingMode === 'round_robin' && route.nextCursor !== form.roundRobinCursor) {
      await updateFormRoutingSnapshot(bundle, {
        roundRobinCursor: route.nextCursor,
        lastRoutedCsId: route.primaryCsId,
        lastRoutedAt: new Date().toISOString(),
      });
    } else if (route.primaryCsId) {
      await updateFormRoutingSnapshot(bundle, {
        lastRoutedCsId: route.primaryCsId,
        lastRoutedAt: new Date().toISOString(),
      });
    }

    return {
      submissionId: submission.id as string,
      leadId: lead.id as string,
      routedCsIds: route.routedCsIds,
    };
  } catch (error: any) {
    await updateSubmissionRecord(storage, submission, {
      status: 'failed',
      error_message: error?.message || 'Gagal membuat Prospek.',
      processed_at: new Date().toISOString(),
    });
    throw error;
  }
}

export function getEmbedBaseUrl() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export function getEmbedFormUrl(form: Pick<EmbedLeadForm, 'slug' | 'publicToken'>, baseUrl = getEmbedBaseUrl()) {
  const identifier = form.slug || form.publicToken;
  return `${baseUrl}/embed/form/${encodeURIComponent(identifier)}`;
}

export function getIframeEmbedCode(form: Pick<EmbedLeadForm, 'slug' | 'publicToken'>, baseUrl = getEmbedBaseUrl()) {
  const src = getEmbedFormUrl(form, baseUrl);
  return `<iframe src="${src}" width="100%" height="720" style="border:0;width:100%;max-width:100%;" loading="lazy"></iframe>`;
}

export function getScriptEmbedCode(form: Pick<EmbedLeadForm, 'slug' | 'publicToken'>, baseUrl = getEmbedBaseUrl()) {
  const identifier = form.slug || form.publicToken;
  return `<div data-poles-lead-form="${identifier}"></div>\n<script src="${baseUrl}/embed/form.js" data-form="${identifier}" async></script>`;
}

const appendScriptOnce = (id: string, src: string) =>
  new Promise<void>((resolve) => {
    if (typeof document === 'undefined') {
      resolve();
      return;
    }

    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if ((existing as any).dataset.loaded === 'true') resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.src = src;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    ttq?: any;
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

export async function fireEmbedLeadTracking(form: EmbedLeadForm) {
  if (typeof window === 'undefined') return;

  if (form.metaPixelId) {
    window.fbq = window.fbq || function fbqShim(...args: any[]) {
      (window.fbq as any).queue = (window.fbq as any).queue || [];
      (window.fbq as any).queue.push(args);
    };
    (window.fbq as any).loaded = true;
    (window.fbq as any).version = '2.0';
    await appendScriptOnce('facebook-jssdk-pixel', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', form.metaPixelId);
    window.fbq('track', form.metaEventName || 'Lead');
  }

  if (form.tiktokPixelId) {
    window.ttq = window.ttq || [];
    if (!window.ttq.load) {
      window.ttq.load = (...args: any[]) => window.ttq.push(['load', ...args]);
      window.ttq.track = (...args: any[]) => window.ttq.push(['track', ...args]);
    }
    await appendScriptOnce('tiktok-pixel-sdk', 'https://analytics.tiktok.com/i18n/pixel/events.js');
    window.ttq.load(form.tiktokPixelId);
    window.ttq.track(form.tiktokEventName || 'SubmitForm');
  }

  if (form.googleTagId) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtagShim(...args: any[]) {
      window.dataLayer!.push(args);
    };
    await appendScriptOnce('google-gtag-sdk', `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(form.googleTagId)}`);
    window.gtag('js', new Date());
    window.gtag('config', form.googleTagId);

    const sendTo = form.googleAdsConversionId && form.googleAdsConversionLabel
      ? `${form.googleAdsConversionId}/${form.googleAdsConversionLabel}`
      : undefined;

    window.gtag('event', form.googleEventName || 'conversion', cleanObject({
      send_to: sendTo,
    }));
  }
}
