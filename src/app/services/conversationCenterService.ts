import { buildMakeServerUrl } from './internal/functionsBaseUrl';
import { getSessionBackedEdgeHeaders } from './internal/sessionClientHeaders';
import type { ServiceErrorPayload } from './internal/serviceTypes';

export const conversationFunctionsBaseUrl = buildMakeServerUrl();

export type ConversationPlatform = 'facebook_page' | 'instagram' | 'whatsapp';

// Optional provider metadata (backward compatible). WhatsApp conversations may be
// served either directly from Meta or via the Kirimdev provider.
export type ConversationProvider = 'meta' | 'kirimdev';

export interface ConversationChannel {
  id: string;
  platform: ConversationPlatform;
  pageId: string;
  pageName: string;
  instagramAccountId?: string | null;
  instagramUsername?: string | null;
  instagramName?: string | null;
  whatsappPhoneNumberId?: string | null;
  whatsappDisplayPhoneNumber?: string | null;
  tasks: string[];
  supportsMessaging: boolean;
  subscribedFields: string[];
  updatedAt: string;
}

export interface ConversationOverviewItem {
  id: string;
  channelId: string;
  platform: ConversationPlatform;
  source: 'meta-live' | 'webhook-store';
  provider?: ConversationProvider;
  pageName: string;
  channelLabel: string;
  contactId: string;
  contactName: string | null;
  contactHandle: string | null;
  lastMessageAt: string;
  lastMessageText: string | null;
  unreadCount: number;
  messageCount: number | null;
  updatedAt: string;
  graphLink: string | null;
  objectType: string | null;
}

export interface ConversationMessage {
  id: string;
  channelId: string;
  conversationId: string;
  source: 'meta-live' | 'webhook-store';
  provider?: ConversationProvider;
  direction: 'inbound' | 'outbound';
  senderId: string | null;
  senderName: string | null;
  text: string | null;
  attachments: unknown[];
  timestamp: string;
}

export interface ConversationInboxOverviewResponse {
  channels: ConversationChannel[];
  conversations: ConversationOverviewItem[];
  diagnostics: {
    storedConversationCount: number;
    liveConversationCount: number;
    liveErrors: Array<{
      channelId: string;
      error: string;
    }>;
  };
}

export interface ConversationMessagesResponse {
  messages: ConversationMessage[];
}

export interface ConversationDailyInboxBucket {
  date: string;
  inboundMessages: number;
  newConversations: number;
  uniqueContacts: number;
  instagramInboundMessages: number;
  instagramNewConversations: number;
  instagramUniqueContacts: number;
  messengerInboundMessages: number;
  messengerNewConversations: number;
  messengerUniqueContacts: number;
}

export interface ConversationDailyInboxStatsResponse {
  timezone: string;
  generatedAt: string;
  rangeDays: number;
  latestStoredEventAt: string | null;
  summary: {
    today: ConversationDailyInboxBucket;
    yesterday: ConversationDailyInboxBucket;
    last7Days: ConversationDailyInboxBucket;
  };
  days: ConversationDailyInboxBucket[];
}

export interface ConversationReadinessResponse {
  ok: boolean;
  tokenType: string | null;
  application: string | null;
  scopes: string[];
  requiredScopes: string[];
  missingScopes: string[];
  channelCount: number;
  pageChannelCount: number;
  instagramChannelCount: number;
  webhookVerifyTokenConfigured: boolean;
  appSecretConfigured: boolean;
}

async function fetchConversationJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${conversationFunctionsBaseUrl}/meta/messaging${path}`, {
    ...init,
    headers: await getSessionBackedEdgeHeaders({
      includeJsonContentType: true,
      headers: init?.headers,
    }),
  });

  const payload = await response.json().catch(() => ({} as ServiceErrorPayload));
  if (!response.ok) {
    throw new Error(payload.error || 'Request Pusat Percakapan gagal.');
  }

  return payload as T;
}

export async function fetchConversationReadiness() {
  return fetchConversationJson<ConversationReadinessResponse>('/readiness');
}

export async function fetchConversationInboxOverview() {
  return fetchConversationJson<ConversationInboxOverviewResponse>('/inbox/overview');
}

export async function fetchConversationDailyInboxStats(days = 30) {
  const searchParams = new URLSearchParams({
    days: String(days),
  });
  return fetchConversationJson<ConversationDailyInboxStatsResponse>(
    `/inbox/daily-stats?${searchParams.toString()}`,
  );
}

export async function fetchConversationMessages(params: {
  conversationId: string;
  channelId: string;
}) {
  const searchParams = new URLSearchParams({
    conversationId: params.conversationId,
    channelId: params.channelId,
  });
  return fetchConversationJson<ConversationMessagesResponse>(`/inbox/messages?${searchParams.toString()}`);
}

export async function syncConversationChannels() {
  return fetchConversationJson<{ success: boolean; channelCount: number; channels: ConversationChannel[] }>(
    '/assets/sync',
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
}

export async function sendConversationMessage(payload: {
  channelId: string;
  recipientId: string;
  text: string;
  tag?: string;
}) {
  return fetchConversationJson<{ success: boolean; response: Record<string, unknown> }>('/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
