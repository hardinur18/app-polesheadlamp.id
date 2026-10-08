import type { Session } from '@supabase/supabase-js';
import type { User } from '../../data';

export const CURRENT_USER_PROFILE_TIMEOUT_MS = 4_000;
export const CURRENT_USER_PROFILE_FALLBACK_TIMEOUT_MS = 2_500;
export const CURRENT_USER_PROFILE_FALLBACK_MAX_PAGES = 1;
export const CURRENT_USER_PROFILE_FALLBACK_PAGE_SIZE = 500;

const CURRENT_USER_CACHE_KEY = 'rhi-v2-current-user-cache';

export const readCachedCurrentUser = (userId: string): User | undefined => {
  if (typeof window === 'undefined' || !userId) return undefined;

  try {
    const raw = window.localStorage.getItem(CURRENT_USER_CACHE_KEY);
    if (!raw) return undefined;

    const cached = JSON.parse(raw) as { user?: User; savedAt?: string };
    if (cached?.user?.id !== userId || cached.user.status === 'inactive') {
      return undefined;
    }

    return cached.user;
  } catch (error) {
    console.warn('[MasterData] Failed to read cached current user:', error);
    return undefined;
  }
};

export const writeCachedCurrentUser = (user: User) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(CURRENT_USER_CACHE_KEY, JSON.stringify({
      user,
      savedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.warn('[MasterData] Failed to cache current user:', error);
  }
};

export const clearCachedCurrentUser = (userId?: string) => {
  if (typeof window === 'undefined') return;

  try {
    if (userId && !readCachedCurrentUser(userId)) {
      return;
    }

    window.localStorage.removeItem(CURRENT_USER_CACHE_KEY);
  } catch (error) {
    console.warn('[MasterData] Failed to clear cached current user:', error);
  }
};

export const buildLocalProfileFallbackUser = (session: Session): User => ({
  id: session.user.id || 'local-owner',
  name:
    session.user.user_metadata?.name ||
    session.user.email?.split('@')[0] ||
    'Owner Polesheadlamp',
  email: session.user.email || 'owner@polesheadlamp.id',
  role: 'Owner',
  status: 'active',
  branchId: 'B1',
  joinDate: new Date().toISOString().slice(0, 10),
  phone: '',
});

export const buildSessionMetadataProfileFallback = (session: Session) => {
  const metadata = session.user.user_metadata || {};
  const role = typeof metadata.role === 'string' ? metadata.role.trim() : '';

  if (!role) {
    return null;
  }

  const name =
    typeof metadata.name === 'string' && metadata.name.trim()
      ? metadata.name.trim()
      : session.user.email?.split('@')[0] || 'User';
  const status =
    typeof metadata.status === 'string' && metadata.status.trim()
      ? metadata.status.trim()
      : 'active';
  const branchId =
    typeof metadata.branch_id === 'string' && metadata.branch_id.trim()
      ? metadata.branch_id.trim()
      : typeof metadata.branchId === 'string' && metadata.branchId.trim()
        ? metadata.branchId.trim()
        : 'B1';

  return {
    id: session.user.id,
    email: session.user.email || '',
    name,
    role,
    status,
    branch_id: branchId,
    phone: typeof metadata.phone === 'string' ? metadata.phone : '',
    join_date:
      typeof metadata.join_date === 'string'
        ? metadata.join_date
        : typeof metadata.joinDate === 'string'
          ? metadata.joinDate
          : new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
  };
};

export const mergeUsersById = (nextUsers: User[], previousUsers: User[]) => {
  const merged = new Map<string, User>();
  previousUsers.forEach((user) => merged.set(user.id, user));
  nextUsers.forEach((user) => merged.set(user.id, user));
  return Array.from(merged.values());
};
