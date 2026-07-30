export type UserRole = 
  | 'owner' 
  | 'super_admin' 
  | 'admin_pic' 
  | 'cs' 
  | 'advertiser' 
  | 'technician' 
  | 'finance';

export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLogin: string;
  branch?: string; // Optional for multi-branch
  phone?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'password_reset' | 'status_change';
  target: string;
  details: string;
  timestamp: string;
  ipAddress: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  super_admin: 'Super Admin',
  admin_pic: 'Admin PIC',
  cs: 'Customer Service',
  advertiser: 'Advertiser',
  technician: 'Teknisi',
  finance: 'Finance',
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Aktif',
  inactive: 'Non-Aktif',
  suspended: 'Ditangguhkan',
};
