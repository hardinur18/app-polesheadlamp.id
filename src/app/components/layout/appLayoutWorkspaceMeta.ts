import {
  ADS_MONITORING_WORKSPACE_MAP,
  type AdsMonitoringWorkspaceId,
} from '../../pages/ads/adsMonitoringWorkspace';
import {
  CONVERSATION_CENTER_WORKSPACE_MAP,
  type ConversationWorkspaceId,
} from '../../pages/conversations/conversationWorkspace';
import {
  WHATSAPP_WORKSPACE_MAP,
  type WhatsAppWorkspaceId,
} from '../../pages/whatsapp/whatsappWorkspace';

export function getAppLayoutPlaceholderMeta(activeTab: string) {
  const adsWorkspace = ADS_MONITORING_WORKSPACE_MAP[activeTab as AdsMonitoringWorkspaceId];
  if (adsWorkspace) {
    return {
      title: adsWorkspace.title,
      description: adsWorkspace.description,
    };
  }

  const conversationWorkspace =
    CONVERSATION_CENTER_WORKSPACE_MAP[activeTab as ConversationWorkspaceId];
  if (conversationWorkspace) {
    return {
      title: conversationWorkspace.title,
      description: conversationWorkspace.description,
    };
  }

  const whatsappWorkspace = WHATSAPP_WORKSPACE_MAP[activeTab as WhatsAppWorkspaceId];
  if (whatsappWorkspace) {
    return {
      title: whatsappWorkspace.title,
      description: whatsappWorkspace.description,
    };
  }

  return null;
}
