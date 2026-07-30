export const WHATSAPP_MODULE_SIDEBAR_LABEL = 'WhatsApp';

export type WhatsAppWorkspaceId =
  | 'whatsapp-dashboard'
  | 'whatsapp-chats'
  | 'whatsapp-contacts'
  | 'whatsapp-templates'
  | 'whatsapp-broadcasts'
  | 'whatsapp-analytics'
  | 'whatsapp-storage'
  | 'whatsapp-inbox-settings'
  | 'whatsapp-accounts';

export type WhatsAppWorkspaceStatus = 'live' | 'coming-soon';

export type WhatsAppWorkspaceIconKey =
  | 'dashboard'
  | 'chats'
  | 'contacts'
  | 'templates'
  | 'broadcasts'
  | 'analytics'
  | 'storage'
  | 'settings'
  | 'accounts';

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
    id: 'whatsapp-dashboard',
    label: 'Dashboard',
    title: 'WhatsApp • Dashboard',
    description:
      'Ringkasan koneksi nomor WhatsApp, percakapan masuk, dan status provider (Meta langsung atau Kirimdev) dalam satu modul.',
    iconKey: 'dashboard',
    status: 'live',
  },
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
    label: 'Contacts',
    title: 'WhatsApp • Contacts',
    description:
      'Daftar kontak WhatsApp yang terkumpul dari webhook Kirimdev/Meta. Lihat nama, nomor, provider, dan kapan terakhir aktif.',
    iconKey: 'contacts',
    status: 'live',
  },
  {
    id: 'whatsapp-templates',
    label: 'Templates',
    title: 'WhatsApp • Templates',
    description:
      'Kelola template pesan WhatsApp untuk balasan cepat dan notifikasi terstruktur.',
    iconKey: 'templates',
    status: 'live',
  },
  {
    id: 'whatsapp-broadcasts',
    label: 'Broadcasts',
    title: 'WhatsApp • Broadcasts',
    description:
      'Kirim pesan massal terjadwal ke segmen kontak WhatsApp dengan pelacakan status pengiriman.',
    iconKey: 'broadcasts',
    status: 'live',
  },
  {
    id: 'whatsapp-analytics',
    label: 'Analytics',
    title: 'WhatsApp • Analytics',
    description:
      'Analisa volume percakapan, waktu respon, dan performa channel WhatsApp per periode.',
    iconKey: 'analytics',
    status: 'coming-soon',
  },
  {
    id: 'whatsapp-storage',
    label: 'Storage',
    title: 'WhatsApp • Storage',
    description:
      'Kelola media dan lampiran WhatsApp (gambar, dokumen, audio) yang diterima dari pelanggan.',
    iconKey: 'storage',
    status: 'coming-soon',
  },
  {
    id: 'whatsapp-inbox-settings',
    label: 'Inbox Settings',
    title: 'WhatsApp • Inbox Settings',
    description:
      'Konfigurasi koneksi Kirimdev: endpoint webhook, event yang disarankan, dan status kredensial server. Kredensial tetap di backend, tidak pernah di frontend.',
    iconKey: 'settings',
    status: 'live',
  },
  {
    id: 'whatsapp-accounts',
    label: 'Accounts',
    title: 'WhatsApp • Accounts',
    description:
      'Status nomor WhatsApp / phone_number_id yang terhubung, beserta provider dan kesehatan koneksinya.',
    iconKey: 'accounts',
    status: 'live',
  },
];

export const WHATSAPP_WORKSPACE_MAP = WHATSAPP_WORKSPACES.reduce<
  Record<string, WhatsAppWorkspaceDefinition>
>((accumulator, workspace) => {
  accumulator[workspace.id] = workspace;
  return accumulator;
}, {});
