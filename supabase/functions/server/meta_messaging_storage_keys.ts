export function buildChannelKey(channelId: string) {
  return `meta_messaging_channel:${channelId}`;
}

export function buildConversationKey(channelId: string, contactId: string) {
  return `${channelId}:${contactId}`;
}

export function buildConversationStorageKey(conversationId: string) {
  return `meta_messaging_conversation:${conversationId}`;
}

export function buildMessageStorageKey(conversationId: string, messageId: string) {
  return `meta_messaging_message:${conversationId}:${messageId}`;
}

export function buildWebhookEventKey() {
  return `meta_messaging_webhook:${Date.now()}:${crypto.randomUUID()}`;
}

export function buildKirimdevWebhookEventKey() {
  return `kirimdev_messaging_webhook:${Date.now()}:${crypto.randomUUID()}`;
}

export function buildKirimdevDedupKey(eventId: string) {
  return `kirimdev_messaging_dedup:${eventId}`;
}

export function buildWhatsAppContactStorageKey(channelId: string, contactKey: string) {
  return `whatsapp_contact:${channelId}:${contactKey}`;
}

export function buildWhatsAppBroadcastStorageKey(broadcastId: string) {
  return `whatsapp_broadcast:${broadcastId}`;
}
