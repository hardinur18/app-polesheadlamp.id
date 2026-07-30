import { Role, User } from '../../../data';

const ROLE_ALIASES: Record<string, Role> = {
  owner: 'Owner',
  'super admin': 'Super Admin',
  super_admin: 'Super Admin',
  'admin pic': 'Admin PIC',
  admin_pic: 'Admin PIC',
  cs: 'CS',
  'customer service': 'CS',
  advertiser: 'Advertiser',
  teknisi: 'Teknisi',
  technician: 'Teknisi',
  finance: 'Finance',
};

const normalizeStatus = (value: unknown): User['status'] => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized === 'inactive' ? 'inactive' : 'active';
};

const normalizeCsAssignmentStatus = (value: unknown): User['csAssignmentStatus'] => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'busy' || normalized === 'offline') return normalized;
  return 'available';
};

const normalizeCsMaxActiveChats = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 25;
  return Math.min(Math.trunc(numeric), 500);
};

const toDateInputValue = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.slice(0, 10);
};

export const normalizeRole = (value: unknown): Role | undefined => {
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim();
  if (!normalized) return undefined;

  return ROLE_ALIASES[normalized.toLowerCase()];
};

export const mapProfileToUser = (profile: any): User | null => {
  const role = normalizeRole(profile.role);

  if (!role) {
    console.warn('[MasterData] Ignoring profile with invalid role:', {
      id: profile.id,
      name: profile.name,
      role: profile.role,
    });
    return null;
  }

  return {
    id: profile.id,
    name: profile.name || 'User',
    email: profile.email || '',
    role,
    branchId: profile.branch_id || 'B1',
    avatar: profile.avatar_url,
    status: normalizeStatus(profile.status),
    joinDate: toDateInputValue(profile.join_date || profile.created_at),
    phone: profile.phone || '',
    employmentStatus: profile.employment_status || 'permanent',
    bankName: profile.bank_name || '',
    bankAccountNumber: profile.bank_account_number || '',
    emergencyPhone: profile.emergency_phone || '',
    parentUserId: profile.parent_user_id,
    csWhatsappNumber: profile.cs_whatsapp_number || '',
    csDisplayName: profile.cs_display_name || '',
    csAssignmentStatus: normalizeCsAssignmentStatus(profile.cs_assignment_status),
    csMaxActiveChats: normalizeCsMaxActiveChats(profile.cs_max_active_chats),
    csNotes: profile.cs_notes || '',
  };
};

export const mapProfilesToUsers = (profiles: any[]): User[] =>
  profiles
    .map(mapProfileToUser)
    .filter((user): user is User => Boolean(user));
