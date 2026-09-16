import type { LeadStatus } from '@/app/pages/master-data/data';
import { buildMakeServerUrl } from '@/app/services/internal/functionsBaseUrl';
import {
  getPublicEdgeHeaders,
  getSessionBackedEdgeHeaders,
} from '@/app/services/internal/sessionClientHeaders';

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

type FallbackEmbedLeadFormRecord = EmbedLeadForm & {
  fields?: EmbedLeadFormField[];
  routes?: EmbedLeadFormCsRoute[];
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

type EmbedLeadApiBundlePayload = {
  form: any;
  fields: any[];
  routes: any[];
};

const mapBundleFromApi = (bundle: EmbedLeadApiBundlePayload): EmbedLeadFormBundle => ({
  form: mapFormFromDB(bundle.form),
  fields: normalizeRequiredFields((bundle.fields || []).map(mapFieldFromDB)),
  routes: (bundle.routes || []).map(mapRouteFromDB),
});

const readEmbedApiError = async (response: Response, fallback: string) => {
  const body = await response.json().catch(() => ({}));
  return new Error(body.error || fallback);
};

const fetchEmbedApiJson = async <T,>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    publicRequest?: boolean;
    body?: unknown;
  } = {},
) => {
  const includeJsonContentType = typeof options.body !== 'undefined';
  const headers = options.publicRequest
    ? getPublicEdgeHeaders({ includeJsonContentType })
    : await getSessionBackedEdgeHeaders({ includeJsonContentType });

  const response = await fetch(buildMakeServerUrl(path), {
    method: options.method || 'GET',
    headers,
    body: typeof options.body === 'undefined' ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    throw await readEmbedApiError(response, `Request embed form gagal (${response.status})`);
  }

  return (await response.json()) as T;
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
    const payload = await fetchEmbedApiJson<{ forms: any[] }>('/embed/admin/forms');
    return (payload.forms || []).map(mapFormFromDB);
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
    const path = activeOnly
      ? `/embed/public/forms/${encodeURIComponent(normalizedIdentifier)}`
      : `/embed/admin/forms/${encodeURIComponent(normalizedIdentifier)}`;
    const payload = await fetchEmbedApiJson<{ bundle: EmbedLeadApiBundlePayload | null }>(path, {
      publicRequest: activeOnly,
    });

    return payload.bundle ? mapBundleFromApi(payload.bundle) : null;
  } catch (error) {
    if (!activeOnly && isMissingEmbedSchemaError(error)) {
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

    const normalizedFields = normalizeRequiredFields(input.fields);
    const normalizedRoutes = input.routes
      .filter((route) => route.csId)
      .map((route, index) => ({
        ...route,
        status: route.status || 'active',
        routeWeight: route.routeWeight || 1,
        sortOrder: index * 10,
      }));

    const fieldRows = normalizedFields
      .filter((field) => field.isVisible)
      .map((field, index) => mapFieldToDB(input.form.id || '', { ...field, sortOrder: index * 10 }));
    const routeRows = normalizedRoutes.map((route) => mapRouteToDB(input.form.id || '', route));

    const result = await fetchEmbedApiJson<{ bundle: EmbedLeadApiBundlePayload | null }>('/embed/admin/forms', {
      method: 'POST',
      body: {
        form: payload,
        fields: fieldRows,
        routes: routeRows,
      },
    });

    if (!result.bundle) throw new Error('Form tersimpan, tapi gagal dimuat ulang.');
    return mapBundleFromApi(result.bundle);
  } catch (error) {
    if (isMissingEmbedSchemaError(error)) {
      return saveEmbedLeadFormFallback(input);
    }
    throw error;
  }
}

export async function deleteEmbedLeadForm(id: string) {
  try {
    await fetchEmbedApiJson(`/embed/admin/forms/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
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

export async function submitEmbedLeadForm(bundle: EmbedLeadFormBundle, input: EmbedLeadSubmissionInput) {
  const identifier = bundle.form.publicToken || bundle.form.slug;
  return fetchEmbedApiJson<{
    submissionId: string;
    leadId: string;
    routedCsIds: string[];
  }>(`/embed/public/forms/${encodeURIComponent(identifier)}/submit`, {
    method: 'POST',
    publicRequest: true,
    body: input,
  });
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
