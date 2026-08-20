export const WHATSAPP_MODULE_SIDEBAR_LABEL = 'Live Chat';

export type WhatsAppWorkspaceId =
  | 'whatsapp-chats'
  | 'whatsapp-contacts'
  | 'whatsapp-templates'
  | 'whatsapp-inbox-settings';

export type WhatsAppWorkspaceStatus = 'live' | 'coming-soon';

export type WhatsAppWorkspaceIconKey =
  | 'chats'
  | 'contacts'
  | 'templates'
  | 'settings';

export type WhatsAppWorkspaceDefinition = {
  id: WhatsAppWorkspaceId;
  label: string;
  title: string;
  description: string;
  iconKey: WhatsAppWorkspaceIconKey;
  status: WhatsAppWorkspaceStatus;
};

export const WHATSAPP_WORKSPACES: WhatsAppWorkspaceDefinition[] = [
  {
    id: 'whatsapp-chats',
    label: 'Live Chat',
    title: 'Live Chat',
    description:
      'Pantau dan balas percakapan pelanggan dari Kirimdev maupun Meta langsung.',
    iconKey: 'chats',
    status: 'live',
  },
  {
    id: 'whatsapp-contacts',
    label: 'Kontak',
    title: 'CRM • Kontak',
    description:
      'Database kontak pelanggan dari prospek, chat, dan riwayat komunikasi yang tersimpan.',
    iconKey: 'contacts',
    status: 'live',
  },
  {
    id: 'whatsapp-templates',
    label: 'Template Pesan',
    title: 'Live Chat • Template Pesan',
    description:
      'Kelola template pesan untuk balasan cepat dan follow up pelanggan.',
    iconKey: 'templates',
    status: 'live',
  },
  {
    id: 'whatsapp-inbox-settings',
    label: 'Akun WA',
    title: 'Live Chat • Akun WA',
    description:
      'Konfigurasi koneksi Kirimdev, endpoint webhook, nomor terhubung, dan status kredensial server live chat.',
    iconKey: 'settings',
    status: 'live',
  },
];

export const WHATSAPP_WORKSPACE_MAP = WHATSAPP_WORKSPACES.reduce<
  Record<string, WhatsAppWorkspaceDefinition>
>((accumulator, workspace) => {
  accumulator[workspace.id] = workspace;
  return accumulator;
}, {});
