import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { PermissionKey, DEFAULT_ROLE_PERMISSIONS } from '@/app/data/permissions';
import { normalizeStoredRolePermissions, sanitizePermissionList } from '@/app/data/permissionBackfill';
import { Role } from '@/app/pages/master-data/data';
import { useMasterData } from '@/app/pages/master-data/context';
import { getSessionBackedEdgeHeaders } from '../services/internal/sessionClientHeaders';
import { buildMakeServerUrl } from '../services/internal/functionsBaseUrl';
import { minutesToMs, useUsageControlSettings } from '../services/usageControlSettings';
import { toast } from 'sonner';

const PERMISSIONS_REFRESH_BROADCAST_KEY = 'rhi-permissions-updated-at';
const ROLE_KEYS = Object.keys(DEFAULT_ROLE_PERMISSIONS) as Role[];

const cloneDefaultRolePermissions = () =>
  Object.fromEntries(
    ROLE_KEYS.map((role) => [role, [...DEFAULT_ROLE_PERMISSIONS[role]]]),
  ) as Record<Role, PermissionKey[]>;

const normalizeRolePermissionsPayload = (permissions: Partial<Record<Role, unknown>>) =>
  Object.fromEntries(
    ROLE_KEYS.map((role) => [
      role,
      normalizeStoredRolePermissions(role, permissions[role] ?? []),
    ]),
  ) as Record<Role, PermissionKey[]>;

export interface RoleSettings {
  payroll_visible_roles?: Role[];
}

interface PermissionsContextType {
  rolePermissions: Record<Role, PermissionKey[]>;
  setRolePermissions: (permissions: Record<Role, PermissionKey[]>) => Promise<void>;
  roleSettings: Record<Role, RoleSettings>;
  setRoleSettings: (settings: Record<Role, RoleSettings>) => Promise<void>;
  togglePermission: (role: Role, permission: PermissionKey) => void;
  resetPermissions: () => Promise<void>;
  hasPermission: (permission: PermissionKey) => boolean;
  isOrderLocked: (orderStatus: string) => boolean;
  loading: boolean;
  refreshPermissions: () => Promise<void>;
  
  // New: User Specific Permissions
  userCustomPermissions: PermissionKey[] | null; 
  setUserCustomPermissions: (userId: string, permissions: PermissionKey[] | null, options?: { silent?: boolean }) => Promise<void>;
  fetchUserCustomPermissions: (userId: string) => Promise<PermissionKey[] | null>;

  // View As Feature
  viewAsRole: Role | null;
  setViewAsRole: (role: Role | null) => void;
}

type CurrentPermissionSnapshot = {
  customPermissions: PermissionKey[] | null;
  effectivePermissions: PermissionKey[];
};

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const context = useMasterData();
  const usageControlSettings = useUsageControlSettings();
  // Safe access to context properties in case MasterDataProvider is missing
  const currentRole = context?.currentRole;
  const currentUser = context?.currentUser;

  const [rolePermissions, setLocalRolePermissions] = useState<Record<Role, PermissionKey[]>>(DEFAULT_ROLE_PERMISSIONS);
  const [roleSettings, setLocalRoleSettings] = useState<Record<Role, RoleSettings>>({} as Record<Role, RoleSettings>);
  const [userCustomPermissions, setLocalUserCustomPermissions] = useState<PermissionKey[] | null>(null);
  const [currentEffectivePermissions, setCurrentEffectivePermissions] = useState<PermissionKey[] | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  
  // "View As" Feature State (Only for Owner)
  const [viewAsRole, setViewAsRole] = useState<Role | null>(null);
  const lastPermissionRefreshAtRef = useRef(0);

  // 1. Fetch Global Role Permissions
  const fetchRolePermissions = useCallback(async () => {
    try {
      const mergedPermissions = cloneDefaultRolePermissions();
      const headers = await getSessionBackedEdgeHeaders();
      
      const response = await fetch(buildMakeServerUrl('/permissions/global'), {
          headers,
          cache: 'no-store'
      });
      
      let resData: any = {};
      let rawText = '';
      try {
          rawText = await response.text();
          resData = JSON.parse(rawText);
      } catch (e) {
          console.warn('Failed to parse global permissions response:', rawText);
          throw new Error(`Server returned non-JSON: ${response.status} ${response.statusText}`);
      }
      
      if (!response.ok) {
          if (response.status === 403) {
              return;
          }
          throw new Error(resData.error || resData.message || `HTTP ${response.status} ${response.statusText}`);
      }

      const val = resData.data;

      if (val) {
          const sysKeys = ['id', 'type'];
          Object.keys(val).forEach(key => {
              if (!sysKeys.includes(key) && Array.isArray(val[key])) {
                  const role = ROLE_KEYS.find((roleKey) => roleKey.toLowerCase() === key.toLowerCase());
                  if (role) {
                    mergedPermissions[role] = normalizeStoredRolePermissions(role, val[key]);
                  }
              }
          });
      }
      
      setLocalRolePermissions(mergedPermissions);
    } catch (err) {
      console.error("Error fetching global permissions via server", err);
      setLocalRolePermissions(DEFAULT_ROLE_PERMISSIONS);
    }
  }, []);

  // 1b. Fetch Global Role Settings
  const fetchRoleSettings = useCallback(async () => {
    try {
      const headers = await getSessionBackedEdgeHeaders();
      const response = await fetch(buildMakeServerUrl('/permissions/settings'), {
          headers,
          cache: 'no-store'
      });
      
      let resData: any = {};
      try {
          resData = await response.json();
      } catch (e) {
          console.warn('Failed to parse global settings response');
      }
      
      if (response.status === 403) {
          setLocalRoleSettings({} as Record<Role, RoleSettings>);
          return;
      }

      if (response.ok && resData.data) {
          setLocalRoleSettings(resData.data);
      }
    } catch (err) {
      console.error("Error fetching global settings via server", err);
    }
  }, []);

  // 2. Fetch current user effective permission snapshot
  const fetchCurrentPermissionSnapshot = useCallback(async (): Promise<CurrentPermissionSnapshot> => {
      if (!currentUser?.id) {
          setLocalUserCustomPermissions(null);
          setCurrentEffectivePermissions(null);
          return {
            customPermissions: null,
            effectivePermissions: [],
          };
      }

      if (currentRole === 'Owner') {
          const ownerPermissions = [...DEFAULT_ROLE_PERMISSIONS.Owner];
          setLocalUserCustomPermissions(null);
          setCurrentEffectivePermissions(ownerPermissions);
          return {
            customPermissions: null,
            effectivePermissions: ownerPermissions,
          };
      }
      
      try {
          const headers = await getSessionBackedEdgeHeaders();
          const response = await fetch(buildMakeServerUrl('/permissions/me'), {
              headers,
              cache: 'no-store'
          });
          
          let resData: any = {};
          let rawText = '';
          try {
              rawText = await response.text();
              resData = JSON.parse(rawText);
          } catch (e) {
              console.warn('Failed to parse user permissions response:', rawText);
              throw new Error(`Server returned non-JSON: ${response.status} ${response.statusText}`);
          }
          
          if (!response.ok) {
              throw new Error(resData.error || resData.message || `HTTP ${response.status} ${response.statusText}`);
          }
          
          const val = resData.data;

          const nextCustomPermissions =
            val?.customPermissions && Array.isArray(val.customPermissions)
              ? sanitizePermissionList(val.customPermissions)
              : null;
          const nextEffectivePermissions =
            val?.effectivePermissions && Array.isArray(val.effectivePermissions)
              ? sanitizePermissionList(val.effectivePermissions)
              : [];

          setLocalUserCustomPermissions(nextCustomPermissions);
          setCurrentEffectivePermissions(nextEffectivePermissions);

          return {
            customPermissions: nextCustomPermissions,
            effectivePermissions: nextEffectivePermissions,
          };
      } catch (err: any) {
          console.error("Error fetching user custom perms via server:", err.message || err);
          setLocalUserCustomPermissions(null);
          setCurrentEffectivePermissions(null);
          return {
            customPermissions: null,
            effectivePermissions: [],
          };
      }
  }, [currentRole, currentUser?.id]);

  const refreshPermissions = useCallback(async () => {
    const snapshot = await fetchCurrentPermissionSnapshot();
    const canReadRoleConfiguration =
      currentRole === 'Owner' ||
      snapshot.effectivePermissions.includes('role_permissions.view') ||
      snapshot.effectivePermissions.includes('role_permissions.manage');

    if (canReadRoleConfiguration) {
      void Promise.all([fetchRolePermissions(), fetchRoleSettings()]).catch((error) => {
        console.error('[Permissions] Background role configuration refresh failed:', error);
      });
    } else {
      setLocalRoleSettings({} as Record<Role, RoleSettings>);
    }
  }, [currentRole, fetchCurrentPermissionSnapshot, fetchRolePermissions, fetchRoleSettings]);

  const runPermissionRefresh = useCallback(async (options?: { force?: boolean }) => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const now = Date.now();
    if (
      !options?.force &&
      currentUser?.id &&
      now - lastPermissionRefreshAtRef.current < minutesToMs(usageControlSettings.permissionResumeRefreshMinutes)
    ) {
      return;
    }

    const nextRefresh = refreshPermissions().finally(() => {
      if (currentUser?.id) {
        lastPermissionRefreshAtRef.current = Date.now();
      }
      refreshInFlightRef.current = null;
    });

    refreshInFlightRef.current = nextRefresh;
    return nextRefresh;
  }, [currentUser?.id, refreshPermissions, usageControlSettings.permissionResumeRefreshMinutes]);

  const broadcastPermissionRefresh = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(PERMISSIONS_REFRESH_BROADCAST_KEY, String(Date.now()));
    } catch (error) {
      console.warn('[Permissions] Failed to broadcast permission update', error);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    let isActive = true;
    const loadingTimeoutId = window.setTimeout(() => {
      if (!isActive) return;
      console.warn('[Permissions] Initial refresh timed out; continuing with cached/default permissions.');
      setLoading(false);
    }, 3500);

    const init = async () => {
        setLoading(true);
        await runPermissionRefresh({ force: true });
        if (isActive) {
          window.clearTimeout(loadingTimeoutId);
          setLoading(false);
        }
    };
    init();

    return () => {
      isActive = false;
      window.clearTimeout(loadingTimeoutId);
    };
  }, [runPermissionRefresh]);

  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser?.id) return;

    const refreshOnResume = () => {
      if (document.visibilityState === 'hidden') return;
      void runPermissionRefresh();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PERMISSIONS_REFRESH_BROADCAST_KEY) return;
      void runPermissionRefresh({ force: true });
    };

    window.addEventListener('focus', refreshOnResume);
    window.addEventListener('online', refreshOnResume);
    document.addEventListener('visibilitychange', refreshOnResume);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('focus', refreshOnResume);
      window.removeEventListener('online', refreshOnResume);
      document.removeEventListener('visibilitychange', refreshOnResume);
      window.removeEventListener('storage', handleStorage);
    };
  }, [currentUser?.id, runPermissionRefresh]);

  // Save Role Permissions
  const saveRolePermissions = async (newPermissions: Record<Role, PermissionKey[]>) => {
    if (!currentUser?.id) {
      toast.error('User not authenticated');
      return;
    }
    
    const sanitizedPermissions = normalizeRolePermissionsPayload(newPermissions);
    setLocalRolePermissions(sanitizedPermissions);
    try {
      const payload = {
          ...sanitizedPermissions,
          id: '11111111-1111-4111-a111-111111111111',
          type: 'global_roles'
      };
      const headers = await getSessionBackedEdgeHeaders({ includeJsonContentType: true });

      const response = await fetch(buildMakeServerUrl('/permissions/global'), {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
      });
      
      let result: any = {};
      let rawText = '';
      try {
          rawText = await response.text();
          if (rawText) {
              result = JSON.parse(rawText);
          }
      } catch (e) {
          console.error('[saveRolePermissions] Failed to parse response:', rawText);
          throw new Error(`Server returned non-JSON: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
          throw new Error(result.error || result.message || `HTTP ${response.status} ${response.statusText}: ${rawText}`);
      }
      
      await runPermissionRefresh();
      broadcastPermissionRefresh();
      
    } catch (err: any) {
      console.error('[saveRolePermissions] Error saving permissions:', err);
      toast.error(`Gagal menyimpan permission: ${err.message || 'Unknown error'}`);
      fetchRolePermissions();
      throw err;
    }
  };

  // Save Role Settings
  const saveRoleSettings = async (newSettings: Record<Role, RoleSettings>) => {
    if (!currentUser?.id) {
      toast.error('User not authenticated');
      return;
    }
    
    setLocalRoleSettings(newSettings);
    try {
      const payload = {
          ...newSettings,
          _meta: { lastUpdatedBy: currentUser.id, lastUpdatedAt: new Date().toISOString() }
      };
      const headers = await getSessionBackedEdgeHeaders({ includeJsonContentType: true });
      
      const response = await fetch(buildMakeServerUrl('/permissions/settings'), {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      await runPermissionRefresh();
      broadcastPermissionRefresh();
    } catch (err: any) {
      console.error('[saveRoleSettings] Error saving settings:', err);
      toast.error(`Gagal menyimpan settings: ${err.message || 'Unknown error'}`);
      fetchRoleSettings();
      throw err;
    }
  };

  // Helper: Fetch ANY User's custom permissions (for Admin UI)
  const fetchUserCustomPermissions = useCallback(async (userId: string): Promise<PermissionKey[] | null> => {
      try {
          const headers = await getSessionBackedEdgeHeaders();
          const response = await fetch(buildMakeServerUrl(`/permissions/user/${userId}`), {
              headers,
              cache: 'no-store'
          });
          
          let resData: any = {};
          let rawText = '';
          try {
              rawText = await response.text();
              resData = JSON.parse(rawText);
          } catch (e) {
              console.warn('Failed to parse any user permissions response:', rawText);
              throw new Error(`Server returned non-JSON: ${response.status} ${response.statusText}`);
          }
          
          if (!response.ok) {
              throw new Error(resData.error || resData.message || `HTTP ${response.status} ${response.statusText}`);
          }

          const val = resData.data;

          if (val) {
              if (val.perms && Array.isArray(val.perms)) {
                  return sanitizePermissionList(val.perms);
              } else if (val.permissions && Array.isArray(val.permissions)) {
                  return sanitizePermissionList(val.permissions);
              } else if (Array.isArray(val)) {
                  return sanitizePermissionList(val);
              }
          }
          return null;
      } catch (e) {
          console.error("Error fetching other user custom permissions", e);
          return null;
      }
  }, []);

  // Helper: Set ANY User's custom permissions
  const setUserCustomPermissions = async (
      userId: string,
      permissions: PermissionKey[] | null,
      options?: { silent?: boolean }
  ) => {
      if (!userId) {
          throw new Error("User ID is required");
      }
      if (!currentUser?.id) {
          throw new Error("Current user not authenticated");
      }
      try {
          const headers = await getSessionBackedEdgeHeaders({ includeJsonContentType: true });
          const sanitizedPermissions = permissions === null ? null : sanitizePermissionList(permissions);
          
          const response = await fetch(buildMakeServerUrl(`/permissions/user/${userId}`), {
              method: 'POST',
              headers,
              body: JSON.stringify({ perms: sanitizedPermissions })
          });
          
          let result: any = {};
          let rawText = '';
          try {
              rawText = await response.text();
              result = JSON.parse(rawText);
          } catch (e) {
              console.error('Failed to parse response:', rawText);
              throw new Error(`Server returned non-JSON: ${response.status} ${response.statusText}`);
          }
          
          if (!response.ok) {
              throw new Error(result.error || result.message || `HTTP ${response.status} ${response.statusText}: ${rawText}`);
          }

          // If we updated CURRENT user, update local state
          if (userId === currentUser?.id) {
              await runPermissionRefresh();
          }

          broadcastPermissionRefresh();
          
          if (!options?.silent) {
            toast.success('Permission user berhasil disimpan');
          }
      } catch (err: any) {
          console.error("Error setting user permissions:", err);
          if (!options?.silent) {
            toast.error(`Gagal menyimpan permission user: ${err.message || 'Terjadi kesalahan'}`);
          }
          throw err;
      }
  };

  const togglePermission = (role: Role, permission: PermissionKey) => {
    const current = rolePermissions[role] || [];
    const has = current.includes(permission);
    const updated = has ? current.filter(p => p !== permission) : [...current, permission];
    
    saveRolePermissions({ ...rolePermissions, [role]: updated }).catch(() => {});
  };

  const resetPermissions = async () => {
    await saveRolePermissions(cloneDefaultRolePermissions());
  };

  // MAIN CHECK LOGIC
  const hasPermission = useCallback((permission: PermissionKey) => {
    // 0. Handle View As Override (ONLY for Owner)
    // When "View As" is active, we simulate the target role permissions completely
    // We intentionally ignore User Custom Permissions here to simulate the "Generic Role"
    if (currentRole === 'Owner' && viewAsRole) {
        // Find the role config key (handle case sensitivity)
        const roleKey = Object.keys(rolePermissions).find(k => k.toLowerCase() === viewAsRole.toLowerCase()) as Role | undefined;
        
        if (roleKey) {
            const allowed = rolePermissions[roleKey]?.includes(permission);
            return allowed ?? false;
        }
        return false; // Role not found? Default to blocked
    }

    // 1. Owner always has access (if not viewing as)
    if (currentRole === 'Owner') return true;
    if (!currentRole) return false;

    // 2. Prefer current effective permissions snapshot from the server
    if (currentEffectivePermissions !== null) {
        return currentEffectivePermissions.includes(permission);
    }

    // 3. Check Custom User Permissions First
    if (userCustomPermissions !== null) {
        return userCustomPermissions.includes(permission);
    }

    // 4. Fallback to Role Permissions/defaults while snapshot is loading
    let roleKey = Object.keys(rolePermissions).find(k => k === currentRole) as Role | undefined;
    if (!roleKey) {
        roleKey = Object.keys(rolePermissions).find(k => k.toLowerCase() === currentRole.toLowerCase()) as Role | undefined;
    }
    
    if (!roleKey) {
        // Warning if role key not found in permissions map at all
        // console.warn(`[Permission] Role ${currentRole} not found in permissions map.`);
        return false;
    }

    const allowed = rolePermissions[roleKey]?.includes(permission);
    // console.log(`[Permission Check] ${currentRole} -> ${permission}: ${allowed}`);
    return allowed ?? false;
  }, [currentRole, currentEffectivePermissions, rolePermissions, userCustomPermissions, viewAsRole]);

  const isOrderLocked = useCallback((orderStatus: string) => {
    if (orderStatus !== 'done') return false;
    return !hasPermission('order.status.edit_completed');
  }, [hasPermission]);

  return (
    <PermissionsContext.Provider value={{
      rolePermissions,
      setRolePermissions: saveRolePermissions,
      roleSettings,
      setRoleSettings: saveRoleSettings,
      togglePermission,
      resetPermissions,
      hasPermission,
      isOrderLocked,
      loading,
      refreshPermissions,
      userCustomPermissions,
      setUserCustomPermissions,
      fetchUserCustomPermissions,
      viewAsRole,
      setViewAsRole
    }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    // console.warn('usePermissions used outside PermissionsProvider. Using fallback.');
    return {
      rolePermissions: DEFAULT_ROLE_PERMISSIONS,
      setRolePermissions: async () => {},
      roleSettings: {} as Record<Role, RoleSettings>,
      setRoleSettings: async () => {},
      togglePermission: () => {},
      resetPermissions: async () => {},
      hasPermission: () => false,
      isOrderLocked: () => true,
      loading: false,
      refreshPermissions: async () => {},
      userCustomPermissions: null,
      setUserCustomPermissions: async () => {},
      fetchUserCustomPermissions: async () => null,
      viewAsRole: null,
      setViewAsRole: () => {}
    };
  }
  return context;
}
