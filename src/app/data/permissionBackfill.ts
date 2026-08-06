import type { Role } from '../pages/master-data/data.ts';
import {
  DASHBOARD_VIEW_PERMISSION_MAP,
  DEFAULT_DASHBOARD_VIEW_BY_ROLE,
  PERMISSIONS,
  type PermissionKey,
} from './permissions.ts';

const VALID_PERMISSION_KEYS = new Set<string>(PERMISSIONS.map(permission => permission.key));
const ALL_PERMISSION_KEYS = PERMISSIONS.map(permission => permission.key);

export const ensurePermission = (permissions: PermissionKey[], permission: PermissionKey) => {
  if (!permissions.includes(permission)) {
    permissions.push(permission);
  }
};

export const sanitizePermissionList = (permissions: unknown): PermissionKey[] => {
  if (!Array.isArray(permissions)) return [];

  const normalized = permissions
    .map(permission => (typeof permission === 'string' ? permission.trim() : ''))
    .filter((permission): permission is PermissionKey => Boolean(permission) && VALID_PERMISSION_KEYS.has(permission));

  return Array.from(new Set(normalized));
};

export const normalizeStoredRolePermissions = (role: Role, permissions: unknown): PermissionKey[] => {
  if (role === 'Owner' || role === 'Super Admin') {
    return [...ALL_PERMISSION_KEYS];
  }

  return sanitizePermissionList(permissions);
};

export const backfillRolePermissions = (role: Role, permissions: PermissionKey[]) => {
  const updated = [...permissions];
  const dashboardViewPermissions = Object.values(DASHBOARD_VIEW_PERMISSION_MAP);

  if (updated.includes('dashboard.view')) {
    ensurePermission(updated, 'audit_logs.view');

    const hasAnyDashboardView = dashboardViewPermissions.some(permission => updated.includes(permission));
    if (!hasAnyDashboardView) {
      if (role === 'Owner' || role === 'Super Admin') {
        dashboardViewPermissions.forEach(permission => ensurePermission(updated, permission));
      } else {
        ensurePermission(updated, DASHBOARD_VIEW_PERMISSION_MAP[DEFAULT_DASHBOARD_VIEW_BY_ROLE[role]]);
      }
    }
  }

  if (updated.includes('finance.view')) {
    ensurePermission(updated, 'operational_expenses.view');
    ensurePermission(updated, 'debts.view');
    ensurePermission(updated, 'finance_report.view');
  }

  if (updated.includes('payroll.manage')) {
    ensurePermission(updated, 'payroll.view');
  }

  if (
    updated.includes('whatsapp.chats.reply') ||
    updated.includes('whatsapp.broadcast.manage') ||
    updated.includes('whatsapp.templates.manage') ||
    updated.includes('whatsapp.settings.manage')
  ) {
    ensurePermission(updated, 'whatsapp.view');
  }

  if (updated.includes('finance.manage')) {
    ensurePermission(updated, 'operational_expenses.create');
    ensurePermission(updated, 'operational_expenses.edit');
    ensurePermission(updated, 'operational_expenses.delete');
  }

  if (role === 'Finance' && updated.includes('finance.manage')) {
    ensurePermission(updated, 'payroll.view');
    ensurePermission(updated, 'payroll.manage');
  }

  if (updated.includes('monitoring.activity_view') || updated.includes('finance.manage')) {
    ensurePermission(updated, 'targets.manage');
  }

  if (updated.includes('monitoring.marketing.view')) {
    ensurePermission(updated, 'cs_okr.view');
  }

  if (updated.includes('targets.manage') && (role === 'Owner' || role === 'Super Admin' || role === 'Admin PIC' || role === 'Finance')) {
    ensurePermission(updated, 'cs_okr.manage');
  }

  if (updated.includes('cs_okr.manage')) {
    ensurePermission(updated, 'cs_okr.view');
  }

  if (updated.includes('stock.transaction.create')) {
    ensurePermission(updated, 'stock.transaction.cancel');
  }

  if (updated.includes('inventory.view') && updated.includes('stock.transaction.view')) {
    ensurePermission(updated, 'stock.card.view');
  }

  if (updated.includes('users.view')) {
    ensurePermission(updated, 'technician_schedule.view');
    ensurePermission(updated, 'technician_schedule.manage');
  }

  if (role === 'Owner' || role === 'Super Admin') {
    ensurePermission(updated, 'users.reset_password');
    ensurePermission(updated, 'role_permissions.view');
    ensurePermission(updated, 'role_permissions.manage');
    ensurePermission(updated, 'technician_schedule.view');
    ensurePermission(updated, 'technician_schedule.manage');
    ensurePermission(updated, 'stock.settings.manage');
    ensurePermission(updated, 'targets.manage');
    ensurePermission(updated, 'cs_okr.view');
    ensurePermission(updated, 'cs_okr.manage');
    dashboardViewPermissions.forEach(permission => ensurePermission(updated, permission));
  }

  return updated;
};
