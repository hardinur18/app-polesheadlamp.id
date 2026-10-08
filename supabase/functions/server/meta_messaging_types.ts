export type KirimdevOutboundMediaType = "image" | "video" | "audio" | "document";

export type MessagingProvider = "meta" | "kirimdev";
export type MessageDeliveryStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export type MetaMessagingChannel = {
  id: string;
  platform: "facebook_page" | "instagram" | "whatsapp";
  provider?: MessagingProvider;
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
  accessToken: string;
  updatedAt: string;
};

export type MetaMessageRecord = {
  id: string;
  channelId: string;
  conversationId: string;
  source?: "webhook" | "api";
  contactId: string;
  entryId: string | null;
  objectType: string | null;
  provider?: MessagingProvider;
  direction: "inbound" | "outbound";
  eventType: string;
  text: string | null;
  attachments: unknown[];
  mediaUrl?: string | null;
  status?: MessageDeliveryStatus | null;
  timestamp: string;
  raw: unknown;
};

export type MetaConversationRecord = {
  id: string;
  channelId: string;
  source?: "webhook" | "api";
  contactId: string;
  entryId: string | null;
  objectType: string | null;
  provider?: MessagingProvider;
  contactName?: string | null;
  contactPhone?: string | null;
  contactAvatarUrl?: string | null;
  lastMessageAt: string;
  lastMessageText: string | null;
  lastDirection: "inbound" | "outbound";
  lastStatus?: MessageDeliveryStatus | null;
  lastHasAttachment?: boolean;
  conversationStatus?: string | null;
  unreadCount: number;
  updatedAt: string;
  raw?: unknown;
};

// WhatsApp contacts captured from webhook payloads (Meta passthrough contacts[]
// and Kirimdev native contact.* events). Stored separately so the Contacts page
// can read them without scanning every conversation.
export type WhatsAppContactRecord = {
  id: string;
  provider: MessagingProvider;
  channelId: string;
  phoneNumberId: string | null;
  phoneNumber: string | null;
  name: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  raw?: unknown;
  createdAt: string | null;
  updatedAt: string;
};

export type WhatsAppContactView = WhatsAppContactRecord & {
  accountLabel: string | null;
  accountPhoneNumber: string | null;
  csProfileId: string | null;
  csDisplayName: string | null;
  csWhatsappNumber: string | null;
  csAssignmentStatus: string | null;
};

export type WhatsAppAccountOwnerView = {
  id: string;
  displayName: string;
  whatsappNumber: string;
  assignmentStatus: string | null;
};

export type KirimdevSendTextInput = {
  phoneNumberId: string;
  to: string;
  text: string;
  replyToMessageId?: string | null;
  idempotencyKey?: string | null;
};

export type KirimdevSendMediaInput = {
  phoneNumberId: string;
  to: string;
  type: KirimdevOutboundMediaType;
  mediaUrl: string;
  caption?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  replyToMessageId?: string | null;
  idempotencyKey?: string | null;
};

export type KirimdevTemplateParameter = {
  name?: string | null;
  text: string;
};

export type KirimdevSendTemplateInput = {
  phoneNumberId: string;
  to: string;
  templateName: string;
  language: string;
  bodyParameters?: KirimdevTemplateParameter[];
  idempotencyKey?: string | null;
};

export type KirimdevSendResult = {
  response: any;
  message: MetaMessageRecord;
  conversation: MetaConversationRecord;
};

export type WhatsAppTemplateView = {
  id: string;
  name: string;
  language: string;
  status: "pending" | "approved" | "rejected";
  category: string | null;
  content: string | null;
  variables: string[];
  components: unknown[];
  phoneNumberId: string | null;
  phoneNumber: string | null;
  providerTemplateId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  raw: unknown;
};

export type WhatsAppBroadcastRecipientResult = {
  contactId: string | null;
  phoneNumber: string;
  name: string | null;
  status: "sent" | "failed";
  messageId: string | null;
  error: string | null;
  sentAt: string | null;
};

export type WhatsAppBroadcastRecord = {
  id: string;
  provider: "kirimdev";
  campaignName: string;
  phoneNumberId: string;
  templateName: string;
  language: string;
  bodyParameters: KirimdevTemplateParameter[];
  recipientCount: number;
  successCount: number;
  failureCount: number;
  status: "completed" | "partial_failed" | "failed";
  createdAt: string;
  createdBy: string | null;
  results: WhatsAppBroadcastRecipientResult[];
};

export type KirimdevSyncOptions = {
  phoneNumberId?: string | null;
  cursor?: string | null;
  since?: string | null;
  until?: string | null;
  conversationLimit?: number;
  maxPages?: number;
  includeMessages?: boolean;
  messageLimit?: number;
  messageMaxPages?: number;
};

export type LiveInboxConversation = {
  id: string;
  channelId: string;
  platform: "facebook_page" | "instagram" | "whatsapp";
  source: "meta-live" | "webhook-store";
  provider?: MessagingProvider;
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
};

export type LiveInboxMessage = {
  id: string;
  channelId: string;
  conversationId: string;
  source: "meta-live" | "webhook-store";
  provider?: MessagingProvider;
  direction: "inbound" | "outbound";
  senderId: string | null;
  senderName: string | null;
  text: string | null;
  attachments: unknown[];
  mediaUrl?: string | null;
  status?: MessageDeliveryStatus | null;
  timestamp: string;
};

export type StoredMessageReadOptions = {
  limit?: number;
  before?: string | null;
  since?: string | null;
  until?: string | null;
  descending?: boolean;
};

export type DailyTrackedPlatform = "instagram" | "facebook_page";

export type DailyInboxBucket = {
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
};

export type DailyInboxAccumulator = DailyInboxBucket & {
  uniqueContactSet: Set<string>;
  instagramUniqueContactSet: Set<string>;
  messengerUniqueContactSet: Set<string>;
};

export type WhatsAppConversationView = {
  id: string;
  channelId: string;
  provider: MessagingProvider;
  source: "webhook" | "api";
  contactId: string;
  contactName: string | null;
  contactPhone: string | null;
  contactAvatarUrl: string | null;
  lastMessageAt: string;
  lastMessageText: string | null;
  lastDirection: "inbound" | "outbound";
  lastStatus: MessageDeliveryStatus | null;
  unreadCount: number;
  hasAttachment: boolean;
  conversationStatus: string | null;
  updatedAt: string;
  messageCount: number;
  mergedConversationIds: string[];
  mergedConversationCount: number;
};

export type WhatsAppCsPerformanceStatus =
  | "performing"
  | "monitor"
  | "needs_attention"
  | "insufficient_data";

export type WhatsAppCsPerformanceView = {
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
};

export type WhatsAppPerformanceSummaryView = {
  windowDays: number;
  since: string;
  until: string;
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
  cs: WhatsAppCsPerformanceView[];
};
