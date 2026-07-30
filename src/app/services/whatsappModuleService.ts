import { buildMakeServerUrl } from './internal/functionsBaseUrl';
import { getSessionBackedEdgeHeaders } from './internal/sessionClientHeaders';
import type { ServiceErrorPayload } from './internal/serviceTypes';

/**
 * Service boundary for the dedicated WhatsApp module.
 *
 * The frontend ONLY talks to our own backend (the make-server edge function under
 * `/meta/messaging`). Kirimdev is a provider behind that backend — its API key and
 * webhook secret never reach the browser. These endpoints read the server's stored
 * WhatsApp data (populated by the Meta + Kirimdev webhooks).
 */
export const whatsappFunctionsBaseUrl = buildMakeServerUrl();

export type WhatsAppProvider = 'meta' | 'kirimdev';
export type WhatsAppDataSource = 'webhook' | 'api';
export type WhatsAppMessageDirection = 'inbound' | 'outbound';
export type WhatsAppMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type WhatsAppAccountStatus = 'connected' | 'configured' | 'not_configured';
export type WhatsAppTemplateStatus = 'pending' | 'approved' | 'rejected';
export type WhatsAppBroadcastStatus = 'completed' | 'partial_failed' | 'failed';
export type WhatsAppOutboundMediaType = 'image' | 'video' | 'audio' | 'document';

export interface WhatsAppAccount {
  id: string;
  provider: WhatsAppProvider;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  label: string;
  status: WhatsAppAccountStatus;
  subscribedFields: string[];
  conversationCount: number;
  csProfileId?: string | null;
  csDisplayName?: string | null;
  csWhatsappNumber?: string | null;
  csAssignmentStatus?: string | null;
  lastEventAt: string | null;
  updatedAt: string;
}

export interface WhatsAppConversation {
  id: string;
  channelId: string;
  provider: WhatsAppProvider;
  source: WhatsAppDataSource;
  contactId: string;
  contactName: string | null;
  contactPhone: string | null;
  contactAvatarUrl?: string | null;
  avatarUrl?: string | null;
  profilePictureUrl?: string | null;
  lastMessageAt: string;
  lastMessageText: string | null;
  lastDirection: WhatsAppMessageDirection;
  lastStatus: WhatsAppMessageStatus | null;
  unreadCount: number;
  hasAttachment: boolean;
  conversationStatus: string | null;
  updatedAt: string;
  messageCount?: number;
  mergedConversationIds?: string[];
  mergedConversationCount?: number;
}

export interface WhatsAppMessage {
  id: string;
  conversationId: string;
  channelId: string;
  provider: WhatsAppProvider;
  direction: WhatsAppMessageDirection;
  text: string | null;
  status: WhatsAppMessageStatus | null;
  attachments: unknown[];
  mediaUrl: string | null;
  timestamp: string;
  senderName: string | null;
}

export interface WhatsAppContact {
  id: string;
  provider: WhatsAppProvider;
  channelId: string;
  phoneNumberId: string | null;
  phoneNumber: string | null;
  name: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  profilePictureUrl?: string | null;
  accountLabel?: string | null;
  accountPhoneNumber?: string | null;
  csProfileId?: string | null;
  csDisplayName?: string | null;
  csWhatsappNumber?: string | null;
  csAssignmentStatus?: string | null;
  createdAt: string | null;
  updatedAt: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  status: WhatsAppTemplateStatus;
  category: string | null;
  content: string | null;
  variables: string[];
  components: unknown[];
  phoneNumberId: string | null;
  phoneNumber: string | null;
  providerTemplateId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WhatsAppTemplateListResponse {
  templates: WhatsAppTemplate[];
  hasMore: boolean;
  nextCursor: string | null;
  requestId: string | null;
}

export interface CreateWhatsAppTemplateInput {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  bodyText: string;
  exampleValues: string[];
}

export interface WhatsAppBroadcastRecipientInput {
  contactId?: string | null;
  phoneNumber: string;
  name?: string | null;
}

export interface WhatsAppBroadcastTemplateParameter {
  name?: string | null;
  text: string;
}

export interface WhatsAppBroadcastRecipientResult {
  contactId: string | null;
  phoneNumber: string;
  name: string | null;
  status: 'sent' | 'failed';
  messageId: string | null;
  error: string | null;
  sentAt: string | null;
}

export interface WhatsAppBroadcastRecord {
  id: string;
  provider: 'kirimdev';
  campaignName: string;
  phoneNumberId: string;
  templateName: string;
  language: string;
  bodyParameters: WhatsAppBroadcastTemplateParameter[];
  recipientCount: number;
  successCount: number;
  failureCount: number;
  status: WhatsAppBroadcastStatus;
  createdAt: string;
  createdBy: string | null;
  results: WhatsAppBroadcastRecipientResult[];
}

export interface WhatsAppBroadcastListResponse {
  broadcasts: WhatsAppBroadcastRecord[];
  maxRecipientsPerRun: number;
  sendDelayMs: number;
}

export interface SendWhatsAppBroadcastInput {
  campaignName: string;
  templateName: string;
  language: string;
  phoneNumberId?: string | null;
  bodyParameters: WhatsAppBroadcastTemplateParameter[];
  recipients: WhatsAppBroadcastRecipientInput[];
  acknowledgedOptIn: boolean;
}

export interface SendWhatsAppBroadcastResponse {
  success: boolean;
  broadcast: WhatsAppBroadcastRecord;
  maxRecipientsPerRun: number;
}

export interface KirimdevStatus {
  configured: boolean;
  apiKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  webhookPath: string;
  apiBaseUrl: string;
  recommendedEvents: string[];
  toleranceSeconds: number;
  latestEventAt: string | null;
  eventCount: number;
}

export type WhatsAppCsPerformanceStatus =
  | 'performing'
  | 'monitor'
  | 'needs_attention'
  | 'insufficient_data';

export interface WhatsAppCsPerformance {
  csProfileId: string | null;
  csDisplayName: string;
  csWhatsappNumber: string | null;
  accountCount: number;
  conversationCount: number;
  inboundMessages: number;
  outboundMessages: number;
  responseSampleCount: number;
  firstResponseSampleCount: number;
  avgFirstResponseSeconds: number | null;
  medianFirstResponseSeconds: number | null;
  avgResponseSeconds: number | null;
  medianResponseSeconds: number | null;
  slaTargetSeconds: number;
  slaHitRate: number | null;
  slaBreachedCount: number;
  unansweredConversationCount: number;
  leads: number;
  closing: number;
  conversionRate: number | null;
  score: number | null;
  status: WhatsAppCsPerformanceStatus;
  evaluation: string[];
  lastActivityAt: string | null;
}

export interface WhatsAppPerformanceSummary {
  windowDays: number;
  since: string;
  slaTargetSeconds: number;
  totals: {
    csCount: number;
    needsAttentionCount: number;
    conversationCount: number;
    leads: number;
    closing: number;
    avgResponseSeconds: number | null;
    slaHitRate: number | null;
  };
  cs: WhatsAppCsPerformance[];
}

export interface WhatsAppOverviewResponse {
  generatedAt: string;
  accounts: WhatsAppAccount[];
  conversations: WhatsAppConversation[];
  performance?: WhatsAppPerformanceSummary;
  kirimdev: KirimdevStatus;
  diagnostics: {
    conversationCount: number;
    contactCount: number;
    accountCount: number;
    providerCounts: {
      meta: number;
      kirimdev: number;
    };
    latestEventAt: string | null;
  };
}

export interface WhatsAppContactsResponse {
  contacts: WhatsAppContact[];
}

export interface WhatsAppMessagesResponse {
  messages: WhatsAppMessage[];
  mergedConversationIds?: string[];
  synced?: number;
  hasMore?: boolean;
  nextCursor?: string | null;
  syncHasMore?: boolean;
  syncNextCursor?: string | null;
}

export interface SendWhatsAppMessageInput {
  conversationId?: string;
  channelId: string;
  to: string;
  text?: string;
  media?: {
    type: WhatsAppOutboundMediaType;
    url: string;
    fileName?: string | null;
    mimeType?: string | null;
  } | null;
  replyToMessageId?: string | null;
}

export interface SendWhatsAppMessageResponse {
  success: boolean;
  provider: WhatsAppProvider;
  response: Record<string, unknown>;
  message: WhatsAppMessage;
  conversation?: WhatsAppConversation;
}

export interface SyncKirimdevInboxResponse {
  success: boolean;
  receivedAt: string;
  accounts: number;
  conversations: number;
  messages: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface SyncKirimdevInboxInput {
  phoneNumberId?: string | null;
  cursor?: string | null;
  since?: string | null;
  until?: string | null;
  sinceDays?: number | null;
  conversationLimit?: number;
  maxPages?: number;
  includeMessages?: boolean;
  messageLimit?: number;
  messageMaxPages?: number;
}

export interface UploadWhatsAppMediaResponse {
  success: boolean;
  media: {
    type: WhatsAppOutboundMediaType;
    url: string;
    path: string;
    fileName: string;
    mimeType: string;
    size: number;
  };
}

export interface SyncKirimdevTemplatesResponse extends WhatsAppTemplateListResponse {
  success: boolean;
  response: Record<string, unknown>;
}

function resolveWhatsAppServiceError(response: Response, payload: ServiceErrorPayload) {
  if (response.status === 401 && /authorization|unauthorized|token/i.test(payload.error || '')) {
    return 'Sesi login WhatsApp tidak valid atau sudah kedaluwarsa. Silakan refresh dan login ulang.';
  }

  return payload.error || 'Permintaan modul WhatsApp gagal.';
}

async function fetchWhatsAppJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${whatsappFunctionsBaseUrl}/meta/messaging${path}`, {
    ...init,
    headers: await getSessionBackedEdgeHeaders({
      includeJsonContentType: true,
      headers: init?.headers,
    }),
  });

  const payload = await response.json().catch(() => ({} as ServiceErrorPayload));
  if (!response.ok) {
    throw new Error(resolveWhatsAppServiceError(response, payload));
  }

  return payload as T;
}

async function fetchWhatsAppForm<T>(path: string, formData: FormData) {
  const response = await fetch(`${whatsappFunctionsBaseUrl}/meta/messaging${path}`, {
    method: 'POST',
    headers: await getSessionBackedEdgeHeaders(),
    body: formData,
  });

  const payload = await response.json().catch(() => ({} as ServiceErrorPayload));
  if (!response.ok) {
    throw new Error(resolveWhatsAppServiceError(response, payload));
  }

  return payload as T;
}

export async function fetchWhatsAppOverview(params?: {
  includePerformance?: boolean;
  includeContacts?: boolean;
  includeMessageCounts?: boolean;
  includeConversations?: boolean;
}) {
  const searchParams = new URLSearchParams();
  if (typeof params?.includePerformance === 'boolean') {
    searchParams.set('includePerformance', String(params.includePerformance));
  }
  if (typeof params?.includeContacts === 'boolean') {
    searchParams.set('includeContacts', String(params.includeContacts));
  }
  if (typeof params?.includeMessageCounts === 'boolean') {
    searchParams.set('includeMessageCounts', String(params.includeMessageCounts));
  }
  if (typeof params?.includeConversations === 'boolean') {
    searchParams.set('includeConversations', String(params.includeConversations));
  }
  const query = searchParams.toString();
  return fetchWhatsAppJson<WhatsAppOverviewResponse>(
    `/whatsapp/overview${query ? `?${query}` : ''}`,
  );
}

export type WhatsAppConversationsPageResponse = {
  generatedAt: string;
  conversations: WhatsAppConversation[];
  nextCursor: string | null;
  hasMore: boolean;
  counts: { total: number; unread: number; slaBreached: number };
  filterCounts?: {
    status: { all: number; open: number; unread: number; pending: number; resolved: number };
    sla: { all: number; atRisk: number; breached: number };
  } | null;
  accountCounts?: Record<string, number> | null;
  allAccountCount?: number | null;
  countsApproximate?: boolean;
};

/**
 * Keyset-paginated, date-filterable inbox page. Loads only `limit` rows so the
 * UI stays instant regardless of how many conversations exist in the DB.
 */
export async function fetchWhatsAppConversationsPage(params?: {
  limit?: number;
  before?: string | null;
  from?: string | null;
  to?: string | null;
  channelId?: string | null;
  provider?: WhatsAppProvider | 'all' | null;
  status?: string | null;
  sla?: string | null;
  query?: string | null;
  includeCounts?: boolean;
  includeFilterCounts?: boolean;
  includeAccountCounts?: boolean;
}) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.before) searchParams.set('before', params.before);
  if (params?.from) searchParams.set('from', params.from);
  if (params?.to) searchParams.set('to', params.to);
  if (params?.channelId) searchParams.set('channelId', params.channelId);
  if (params?.provider && params.provider !== 'all') searchParams.set('provider', params.provider);
  if (params?.status && params.status !== 'all') searchParams.set('status', params.status);
  if (params?.sla && params.sla !== 'all') searchParams.set('sla', params.sla);
  if (params?.query) searchParams.set('query', params.query);
  if (typeof params?.includeCounts === 'boolean') {
    searchParams.set('includeCounts', String(params.includeCounts));
  }
  if (typeof params?.includeFilterCounts === 'boolean') {
    searchParams.set('includeFilterCounts', String(params.includeFilterCounts));
  }
  if (typeof params?.includeAccountCounts === 'boolean') {
    searchParams.set('includeAccountCounts', String(params.includeAccountCounts));
  }
  const query = searchParams.toString();
  return fetchWhatsAppJson<WhatsAppConversationsPageResponse>(
    `/whatsapp/conversations${query ? `?${query}` : ''}`,
  );
}

export async function fetchWhatsAppContacts() {
  return fetchWhatsAppJson<WhatsAppContactsResponse>('/whatsapp/contacts');
}

export async function fetchWhatsAppMessages(params: {
  conversationId: string;
  limit?: number;
  maxPages?: number;
  sync?: boolean;
  before?: string | null;
  syncLimit?: number;
}) {
  const searchParams = new URLSearchParams({ conversationId: params.conversationId });
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.maxPages) searchParams.set('maxPages', String(params.maxPages));
  if (typeof params.sync === 'boolean') searchParams.set('sync', String(params.sync));
  if (params.before) searchParams.set('before', params.before);
  if (params.syncLimit) searchParams.set('syncLimit', String(params.syncLimit));
  return fetchWhatsAppJson<WhatsAppMessagesResponse>(
    `/whatsapp/messages?${searchParams.toString()}`,
  );
}

export async function fetchKirimdevStatus() {
  return fetchWhatsAppJson<KirimdevStatus>('/kirimdev/status');
}

export async function fetchKirimdevTemplates(params?: {
  status?: WhatsAppTemplateStatus | 'all';
  language?: string;
  cursor?: string;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set('status', params?.status || 'all');
  if (params?.language) searchParams.set('language', params.language);
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  return fetchWhatsAppJson<WhatsAppTemplateListResponse>(
    `/kirimdev/templates?${searchParams.toString()}`,
  );
}

export async function syncKirimdevTemplates() {
  return fetchWhatsAppJson<SyncKirimdevTemplatesResponse>('/kirimdev/templates/sync', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function createKirimdevTemplate(payload: CreateWhatsAppTemplateInput) {
  return fetchWhatsAppJson<{ success: boolean; template: WhatsAppTemplate; response: unknown }>(
    '/kirimdev/templates',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function sendWhatsAppMessage(payload: SendWhatsAppMessageInput) {
  return fetchWhatsAppJson<SendWhatsAppMessageResponse>('/whatsapp/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadWhatsAppMedia(params: {
  file: File;
  type?: WhatsAppOutboundMediaType | null;
}) {
  const formData = new FormData();
  formData.set('file', params.file);
  if (params.type) formData.set('type', params.type);
  return fetchWhatsAppForm<UploadWhatsAppMediaResponse>('/whatsapp/media-upload', formData);
}

export async function syncKirimdevInbox(params: SyncKirimdevInboxInput = {}) {
  return fetchWhatsAppJson<SyncKirimdevInboxResponse>('/kirimdev/sync', {
    method: 'POST',
    body: JSON.stringify({
      phoneNumberId: params.phoneNumberId || undefined,
      cursor: params.cursor || undefined,
      since: params.since || undefined,
      until: params.until || undefined,
      sinceDays: params.sinceDays || undefined,
      conversationLimit: params.conversationLimit ?? 50,
      maxPages: params.maxPages ?? 2,
      includeMessages: params.includeMessages ?? true,
      messageLimit: params.messageLimit ?? 20,
      messageMaxPages: params.messageMaxPages ?? 1,
    }),
  });
}

export async function fetchWhatsAppBroadcasts(params?: { limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const query = searchParams.toString();
  return fetchWhatsAppJson<WhatsAppBroadcastListResponse>(
    `/whatsapp/broadcasts${query ? `?${query}` : ''}`,
  );
}

export async function sendWhatsAppBroadcast(payload: SendWhatsAppBroadcastInput) {
  return fetchWhatsAppJson<SendWhatsAppBroadcastResponse>('/whatsapp/broadcasts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
