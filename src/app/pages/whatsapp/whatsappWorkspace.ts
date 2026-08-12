export const WHATSAPP_MODULE_SIDEBAR_LABEL = 'WhatsApp';

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
    label: 'Chats',
    title: 'WhatsApp • Chats',
    description:
      'Baca percakapan WhatsApp dari Kirimdev maupun Meta langsung. Pilih thread untuk melihat isi pesan, arah, status pengiriman, dan lampiran.',
    iconKey: 'chats',
    status: 'live',
  },
  {
    id: 'whatsapp-contacts',
    label: 'Kontak',
    title: 'WhatsApp • Kontak',
    description:
      'Daftar kontak WhatsApp yang terkumpul dari webhook Kirimdev/Meta. Lihat nama, nomor, provider, dan kapan terakhir aktif.',
    iconKey: 'contacts',
    status: 'live',
  },
  {
    id: 'whatsapp-templates',
    label: 'Template Pesan',
    title: 'WhatsApp • Template Pesan',
    description:
      'Kelola template pesan WhatsApp untuk balasan cepat dan notifikasi terstruktur.',
    iconKey: 'templates',
    status: 'live',
  },
  {
    id: 'whatsapp-inbox-settings',
    label: 'Pengaturan WhatsApp',
    title: 'WhatsApp • Pengaturan WhatsApp',
    description:
      'Konfigurasi koneksi Kirimdev, endpoint webhook, nomor terhubung, dan status kredensial server.',
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
