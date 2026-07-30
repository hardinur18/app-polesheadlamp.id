import type { Role } from '../pages/master-data/data';

type RoleInput = string | null | undefined;

const ROLE_ALIASES: Record<string, Role> = {
  owner: 'Owner',
  'super admin': 'Super Admin',
  super_admin: 'Super Admin',
  'admin pic': 'Admin PIC',
  admin_pic: 'Admin PIC',
  admin: 'Admin PIC',
  cs: 'CS',
  'customer service': 'CS',
  advertiser: 'Advertiser',
  teknisi: 'Teknisi',
  technician: 'Teknisi',
  finance: 'Finance',
};

export function normalizeRole(value: RoleInput): Role | undefined {
  if (!value) return undefined;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return undefined;

  return ROLE_ALIASES[normalized];
}

export function isRole(value: RoleInput, expected: Role) {
  return normalizeRole(value) === expected;
}

export function isAnyRole(value: RoleInput, expected: Role[]) {
  const resolvedRole = normalizeRole(value);
  return resolvedRole ? expected.includes(resolvedRole) : false;
}

export function isOwnerLikeRole(value: RoleInput) {
  return isAnyRole(value, ['Owner', 'Super Admin']);
}

export function isAdminManagementRole(value: RoleInput) {
  return isAnyRole(value, ['Owner', 'Super Admin', 'Admin PIC']);
}

export function isCsRole(value: RoleInput) {
  return isRole(value, 'CS');
}

export function isAdvertiserRole(value: RoleInput) {
  return isRole(value, 'Advertiser');
}

export function isTechnicianRole(value: RoleInput) {
  return isRole(value, 'Teknisi');
}

export function isFinanceRole(value: RoleInput) {
  return isRole(value, 'Finance');
}
