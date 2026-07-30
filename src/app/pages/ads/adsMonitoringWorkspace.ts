export type AdsMonitoringWorkspaceId =
  | 'ads-monitoring-overview'
  | 'ads-monitoring-integrasi-iklan'
  | 'ads-monitoring-advertiser-matrix'
  | 'ads-monitoring-cs-matrix'
  | 'ads-monitoring-diagnostics'
  | 'ads-monitoring-openclaw'
  | 'ads-monitoring-action-sandbox';

export type AdsMonitoringWorkspaceDefinition = {
  id: AdsMonitoringWorkspaceId;
  label: string;
  title: string;
  description: string;
};

export const ADS_MONITORING_SIDEBAR_LABEL = 'Ads Monitoring';

export const ADS_MONITORING_WORKSPACES: AdsMonitoringWorkspaceDefinition[] = [
  {
    id: 'ads-monitoring-overview',
    label: 'Ringkasan',
    title: 'Ads Monitoring • Ringkasan',
    description:
      'Ringkasan utama untuk membaca performa iklan lintas advertiser, akun iklan, CS, dan order masuk.',
  },
  {
    id: 'ads-monitoring-integrasi-iklan',
    label: 'Integrasi Iklan',
    title: 'Ads Monitoring • Integrasi Iklan',
    description:
      'Workspace breakdown per akun iklan untuk spend, burn, klik, order, dan CPL lintas platform.',
  },
  {
    id: 'ads-monitoring-advertiser-matrix',
    label: 'Matriks Advertiser',
    title: 'Ads Monitoring • Matriks Advertiser',
    description:
      'Matriks advertiser untuk membaca spend, order, closing, burn, dan kontribusi per akun iklan.',
  },
  {
    id: 'ads-monitoring-cs-matrix',
    label: 'Matriks CS',
    title: 'Ads Monitoring • Matriks CS',
    description:
      'Matriks Customer Service untuk membaca order masuk, close rate, beban follow-up, dan bottleneck operasional.',
  },
  {
    id: 'ads-monitoring-diagnostics',
    label: 'Diagnostik',
    title: 'Ads Monitoring • Diagnostik',
    description:
      'Pusat diagnostik untuk anomali, gap atribusi, risiko burn, overload, dan temuan prioritas sistem.',
  },
  {
    id: 'ads-monitoring-openclaw',
    label: 'OpenClaw',
    title: 'Ads Monitoring • OpenClaw',
    description:
      'Konsol robot advertiser untuk rekomendasi, tingkat keyakinan, pagar kendali, dan mode kendali OpenClaw.',
  },
  {
    id: 'ads-monitoring-action-sandbox',
    label: 'Simulasi Aksi',
    title: 'Ads Monitoring • Simulasi Aksi',
    description:
      'Ruang aman untuk proposal aksi, approval, reject, dan simulasi tindakan tanpa mengganggu flow inti.',
  },
];

export const ADS_MONITORING_WORKSPACE_MAP = ADS_MONITORING_WORKSPACES.reduce<
  Record<string, AdsMonitoringWorkspaceDefinition>
>((acc, workspace) => {
  acc[workspace.id] = workspace;
  return acc;
}, {});
