import type { PermissionKey } from '../../data/permissions';

export const DEFAULT_APP_LAYOUT_TAB = 'dashboard';

export const ACCESS_DENIED_FALLBACK_TAB = 'profile';

export const TEKNISI_ALLOWED_TABS = ['teknisi-mobile', 'dashboard', 'profile', 'orders'] as const;

export const APP_LAYOUT_ACCESS_FALLBACKS: Array<{ permission: PermissionKey; tab: string }> = [
  { permission: 'dashboard.view', tab: 'dashboard' },
  { permission: 'teknisi.view_mobile', tab: 'teknisi-mobile' },
  { permission: 'leads.view', tab: 'leads' },
];
