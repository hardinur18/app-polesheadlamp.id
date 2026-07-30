export const CONVERSATION_CENTER_SIDEBAR_LABEL = 'Pusat Percakapan';

export type ConversationWorkspaceId =
  | 'conversation-live-inbox'
  | 'conversation-automation'
  | 'conversation-routing'
  | 'conversation-history'
  | 'conversation-channel-settings';

type ConversationWorkspaceDefinition = {
  id: ConversationWorkspaceId;
  label: string;
  title: string;
  description: string;
};

export const CONVERSATION_CENTER_WORKSPACES: ConversationWorkspaceDefinition[] = [
  {
    id: 'conversation-live-inbox',
    label: 'Kotak Masuk Live',
    title: 'Pusat Percakapan / Kotak Masuk Live',
    description:
      'Inbox realtime omnichannel untuk WhatsApp, Instagram DM, Messenger, dan TikTok DM dalam satu workspace.',
  },
  {
    id: 'conversation-automation',
    label: 'Bot & Automasi',
    title: 'Pusat Percakapan / Bot & Automasi',
    description:
      'Atur auto-reply, handoff ke manusia, SLA bot, dan rule automasi per channel atau intent pelanggan.',
  },
  {
    id: 'conversation-routing',
    label: 'Routing CS',
    title: 'Pusat Percakapan / Routing CS',
    description:
      'Kelola distribusi percakapan ke CS berdasarkan channel, akun, jam kerja, campaign, atau priority queue.',
  },
  {
    id: 'conversation-history',
    label: 'Riwayat Percakapan',
    title: 'Pusat Percakapan / Riwayat Percakapan',
    description:
      'Lihat histori chat, jejak template, perpindahan bot ke human, dan konteks pelanggan lintas channel.',
  },
  {
    id: 'conversation-channel-settings',
    label: 'Pengaturan Channel',
    title: 'Pusat Percakapan / Pengaturan Channel',
    description:
      'Pantau koneksi channel, webhook, token health, template, identitas akun, dan status sinkronisasi tiap platform.',
  },
];

export const CONVERSATION_CENTER_WORKSPACE_MAP = Object.fromEntries(
  CONVERSATION_CENTER_WORKSPACES.map((workspace) => [workspace.id, workspace]),
) as Record<ConversationWorkspaceId, ConversationWorkspaceDefinition>;
