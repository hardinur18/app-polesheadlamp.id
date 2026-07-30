import React, { useState, useEffect, useMemo } from 'react';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS, PermissionKey } from '@/app/data/permissions';
import { normalizeRole } from '@/app/data/roleHelpers';
import { Role } from '../master-data/data';
import { useMasterData } from '@/app/pages/master-data/context';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Card } from '../../components/ui/card';
import { 
  Shield, Save, RotateCcw, Check, LayoutDashboard, 
  Users, ShoppingCart, Calendar, MapPin, Wallet, 
  Settings, Box, Briefcase, ShieldAlert, History, MoreHorizontal, HelpCircle,
  MenuSquare, Loader2, TrendingUp, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../components/ui/utils';

const ROLES: Role[] = ['Owner', 'Super Admin', 'Admin PIC', 'Finance', 'CS', 'Advertiser', 'Teknisi'];

const isActiveUserStatus = (status: unknown) =>
  String(status || '').trim().toLowerCase() === 'active';

// Mapping groups to icons and better titles
const GROUP_CONFIG: Record<string, { icon: any, label: string, description?: string }> = {
  'Dashboard': { icon: LayoutDashboard, label: 'Dashboard & Statistik', description: 'Akses halaman utama dan widget statistik' },
  'Monitoring Marketing': { icon: TrendingUp, label: 'Monitoring Marketing', description: 'Dashboard performa marketing harian (Target vs Real)' },
  'Pesanan': { icon: ShoppingCart, label: 'Manajemen Pesanan', description: 'Hak akses untuk membuat dan mengelola data pesanan' },
  'Pesanan Status': { icon: Check, label: 'Status Pesanan', description: 'Kontrol perpindahan status pesanan (Pending -> Selesai)' },
  'Pesanan Pembayaran': { icon: Wallet, label: 'Pembayaran', description: 'Akses informasi pembayaran dan validasi keuangan' },
  'Kontak': { icon: Users, label: 'Kontak & Pelanggan', description: 'Akses data sensitif pelanggan dan staff' },
  'Peta': { icon: MapPin, label: 'Peta & Rute', description: 'Fitur pemetaan lokasi dan rute kunjungan' },
  'Prospek': { icon: Briefcase, label: 'Prospek (Leads)', description: 'Manajemen data calon pelanggan potensial' },
  'Iklan': { icon: LayoutDashboard, label: 'Iklan & Analytics', description: 'Monitoring performa iklan harian' },
  'Affiliate': { icon: Users, label: 'Affiliate', description: 'Manajemen data partner affiliate' },
  'Operasional': { icon: Calendar, label: 'Operasional & Jadwal', description: 'Jadwal kunjungan teknisi dan monitoring' },
  'Operasional Teknisi': { icon: Calendar, label: 'Operasional Teknisi', description: 'Laporan operasional dan aktivitas teknisi' },
  'Keuangan': { icon: Wallet, label: 'Keuangan', description: 'Laporan keuangan dan arus kas perusahaan' },
  'Keuangan - Biaya Operasional': { icon: Wallet, label: 'Biaya Operasional', description: 'Input dan validasi biaya operasional' },
  'Keuangan - Pengeluaran': { icon: Wallet, label: 'Pengeluaran Rutin', description: 'Daftar pengeluaran rutin dan pembayaran berkala' },
  'Gaji & Payroll': { icon: DollarSign, label: 'Payroll & Gaji', description: 'Akses dan pengaturan data penggajian' },
  'Admin': { icon: Settings, label: 'Pengaturan Admin', description: 'Konfigurasi sistem, user, dan master data' },
  'Manajemen Stok': { icon: Box, label: 'Stok & Inventaris', description: 'Manajemen barang, hpp, dan transaksi gudang' },
};

export const RoleManagement = () => {
  const { currentRole, users } = useMasterData();
  const { rolePermissions, setRolePermissions, roleSettings, setRoleSettings, resetPermissions, loading: contextLoading, refreshPermissions, hasPermission, fetchUserCustomPermissions, setUserCustomPermissions } = usePermissions();
  const canViewRolePermissions = hasPermission('role_permissions.view');
  const canManageRolePermissions = hasPermission('role_permissions.manage');
  
  const [localPermissions, setLocalPermissions] = useState<Record<Role, PermissionKey[]>>(rolePermissions);
  const [localSettings, setLocalSettings] = useState<Record<Role, any>>((roleSettings || {}) as Record<Role, any>);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>('Admin PIC');
  const [hasCompletedInitialSync, setHasCompletedInitialSync] = useState(false);
  const [customAccessMap, setCustomAccessMap] = useState<Record<string, boolean>>({});
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [isBulkResettingCustom, setIsBulkResettingCustom] = useState(false);

  // Refresh permissions on mount to ensure we are not editing stale data
  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  // Sync local state ONLY if no unsaved changes
  useEffect(() => {
    if (!hasChanges && rolePermissions) {
        setLocalPermissions(rolePermissions);
    }
  }, [rolePermissions, hasChanges]);

  useEffect(() => {
    if (!hasChanges && roleSettings) {
        setLocalSettings(roleSettings);
    }
  }, [roleSettings, hasChanges]);

  useEffect(() => {
    if (!contextLoading) {
      setHasCompletedInitialSync(true);
    }
  }, [contextLoading]);

  const handleToggle = (role: Role, key: PermissionKey) => {
    if (!canManageRolePermissions || role === 'Owner') return;
    
    setLocalPermissions(prev => {
      const current = prev[role] || [];
      const has = current.includes(key);
      const updated = has ? current.filter(p => p !== key) : Array.from(new Set([...current, key]));
      return { ...prev, [role]: updated };
    });
    setHasChanges(true);
  };

  const setRolePermissionKeys = (role: Role, keys: PermissionKey[], checked: boolean) => {
    if (!canManageRolePermissions || role === 'Owner') return;

    setLocalPermissions(prev => {
      const current = prev[role] || [];
      const keySet = new Set(keys);
      const updated = checked
        ? Array.from(new Set([...current, ...keys]))
        : current.filter(permission => !keySet.has(permission));

      return { ...prev, [role]: updated };
    });
    setHasChanges(true);
  };

  const handleSettingChange = (role: Role, settingKey: string, value: any) => {
    if (!canManageRolePermissions || role === 'Owner') return;
    setLocalSettings(prev => ({
        ...prev,
        [role]: {
            ...(prev[role] || {}),
            [settingKey]: value
        }
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!canManageRolePermissions) return;

    setIsSaving(true);
    try {
      await Promise.all([
          setRolePermissions(localPermissions),
          setRoleSettings(localSettings)
      ]);
      setHasChanges(false);
      toast.success('Pengaturan permission berhasil disimpan');
    } catch (error: any) {
      console.error("[RoleManagement] Save error:", error?.message || error);
      toast.error('Gagal menyimpan pengaturan permission');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!canManageRolePermissions) return;

    if (confirm('Reset semua permission ke default?')) {
      setIsSaving(true);
      try {
        await resetPermissions();
        setHasChanges(false);
        toast.success('Permission di-reset ke default');
      } catch (error) {
        console.error('[RoleManagement] Reset error:', error);
        toast.error('Gagal reset permission');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleResetUserCustomAccess = async (userId: string, userName: string) => {
    if (!canManageRolePermissions) return;

    setResettingUserId(userId);
    try {
      await setUserCustomPermissions(userId, null);
      setCustomAccessMap((prev) => ({ ...prev, [userId]: false }));
      await refreshPermissions();
      toast.success(`Custom Access ${userName} berhasil direset ke role default`);
    } catch (error) {
      console.error('[RoleManagement] Failed to reset custom access:', error);
    } finally {
      setResettingUserId(null);
    }
  };

  const handleResetAllCustomAccessForRole = async () => {
    if (!canManageRolePermissions) return;

    const targetUsers = roleUsers.filter((user) => customAccessMap[user.id]);
    if (targetUsers.length === 0) return;

    setIsBulkResettingCustom(true);
    try {
      await Promise.all(
        targetUsers.map((user) => setUserCustomPermissions(user.id, null, { silent: true })),
      );

      setCustomAccessMap((prev) => ({
        ...prev,
        ...Object.fromEntries(targetUsers.map((user) => [user.id, false])),
      }));

      await refreshPermissions();
      toast.success(`Semua Custom Access role ${selectedRole} berhasil direset`);
    } catch (error) {
      console.error('[RoleManagement] Failed to bulk reset custom access:', error);
      toast.error('Gagal mereset semua Custom Access di role ini');
    } finally {
      setIsBulkResettingCustom(false);
    }
  };

  // Helper to categorize permissions inside a group
  // We want to bundle "View" as the main toggle, and others as chips
  const organizePermissions = (groupName: string) => {
    const groupPerms = PERMISSIONS.filter(p => p.group === groupName);
    
    // Special handling for groups where we want flat list (no nesting)
    const FLAT_GROUPS = ['Pesanan Status', 'Peta', 'Kontak'];
    if (FLAT_GROUPS.includes(groupName)) {
        return groupPerms.map(perm => ({
            main: perm,
            subs: []
        }));
    }

    // 1. Identify "Parent" permissions (usually .view)
    // If no .view exists, we treat the first one as parent or group them differently
    const features: { 
        main: typeof groupPerms[0], 
        subs: typeof groupPerms 
    }[] = [];

    // Custom grouping logic based on keys
    // Example: users.view is parent of users.manage
    const processedKeys = new Set<string>();

    groupPerms.forEach(perm => {
        if (processedKeys.has(perm.key)) return;

        // Heuristic: If key ends in .view, it's a main feature that likely controls Sidebar visibility
        if (perm.key.endsWith('.view') || perm.key.endsWith('.view_daily') || perm.key.endsWith('.view_global') || perm.key.endsWith('activity_view')) {
            // Find related subs (share same prefix)
            const prefix = perm.key.split('.').slice(0, -1).join('.');
            const subs = groupPerms.filter(p => 
                p.key !== perm.key && 
                p.key.startsWith(`${prefix}.`) &&
                !p.key.includes('activity_view') && // Prevent activity_view from being a sub of generic view
                !processedKeys.has(p.key)
            );
            
            features.push({ main: perm, subs });
            processedKeys.add(perm.key);
            subs.forEach(s => processedKeys.add(s.key));
        }
    });

    // Handle orphans (permissions that didn't match the .view pattern)
    groupPerms.forEach(perm => {
        if (!processedKeys.has(perm.key)) {
            features.push({ main: perm, subs: [] });
            processedKeys.add(perm.key);
        }
    });

    return features;
  };

  // Groups to display based on the screenshot order
  const ORDERED_GROUPS = [
    'Dashboard', 'Monitoring Marketing', 'Prospek', 'Iklan', 'Affiliate',
    'Pesanan', 'Pesanan Status', 'Pesanan Pembayaran', 'Kontak', 'Peta',
    'Operasional', 'Operasional Teknisi', 'Keuangan', 'Keuangan - Biaya Operasional', 'Keuangan - Pengeluaran',
    'Gaji & Payroll', 'Manajemen Stok', 'Admin'
  ];

  // Define groups first
  const groups = Array.from(new Set(PERMISSIONS.map(p => p.group)));
  
  // Combine with other groups that might exist but aren't in the main view of screenshot
  const otherGroups = groups.filter(g => !ORDERED_GROUPS.includes(g));
  const displayGroups = [...ORDERED_GROUPS, ...otherGroups];
  
  // Get users for selected role
  // Only show active users
  const roleUsers = useMemo(
    () => users.filter((u) => normalizeRole(u.role) === selectedRole && isActiveUserStatus(u.status)),
    [selectedRole, users],
  );
  const customAccessCount = roleUsers.filter((user) => customAccessMap[user.id]).length;
  const isBootstrapping = contextLoading && !hasCompletedInitialSync;
  const isRoleReadOnly = selectedRole === 'Owner';
  const isInteractionDisabled = isSaving || !canManageRolePermissions;

  useEffect(() => {
    if (!canManageRolePermissions) {
      setCustomAccessMap({});
      return;
    }

    let isCancelled = false;

    const loadCustomAccessMap = async () => {
      const nextEntries = await Promise.all(
        roleUsers.map(async (user) => {
          const customPermissions = await fetchUserCustomPermissions(user.id);
          return [user.id, Array.isArray(customPermissions)] as const;
        }),
      );

      if (isCancelled) return;

      setCustomAccessMap(Object.fromEntries(nextEntries));
    };

    void loadCustomAccessMap();

    return () => {
      isCancelled = true;
    };
  }, [canManageRolePermissions, fetchUserCustomPermissions, roleUsers]);

  if (!canViewRolePermissions) {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-4 text-center p-8">
        <div className="bg-red-50 p-4 rounded-full text-red-600"><ShieldAlert className="w-12 h-12" /></div>
        <h1 className="text-2xl font-bold">Akses Dibatasi</h1>
        <p className="text-slate-500">Anda tidak memiliki izin untuk membuka halaman role permission.</p>
      </div>
    );
  }

  // Show loading ONLY if context is loading AND we don't have local data yet
  if (isBootstrapping) {
      return (
          <div className="flex h-screen items-center justify-center flex-col">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
              <p className="text-slate-500 animate-pulse">Memuat konfigurasi permission...</p>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-8 pb-48 md:pb-32 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* Mobile-optimized Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4 md:pb-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Role Permission</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-slate-500 text-xs md:text-sm">Atur hak akses pengguna.</p>
                    <span className="hidden md:inline text-slate-300 mx-2">|</span>
                    <span className="text-slate-400 text-[10px] md:text-xs flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        <History className="w-3 h-3" />
                        Updated: {contextLoading ? 'Syncing...' : 'Ready'}
                    </span>
                    {!canManageRolePermissions && (
                        <span className="text-amber-600 text-[10px] md:text-xs flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900">
                            <ShieldAlert className="w-3 h-3" />
                            View Only
                        </span>
                    )}
                </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                 <Button variant="outline" size="sm" onClick={() => toast.info('Log history akan segera hadir')} className="flex-1 md:flex-none h-9 text-xs text-slate-600 border-slate-300 hover:bg-slate-100">
                    <History className="w-3.5 h-3.5 mr-2" /> History
                 </Button>
                 <Button variant="outline" size="sm" onClick={handleReset} disabled={isInteractionDisabled} className="flex-1 md:flex-none h-9 text-xs text-slate-600 border-slate-300 hover:bg-slate-100">
                    <RotateCcw className="w-3.5 h-3.5 mr-2" /> Reset
                 </Button>
            </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start relative">
            <div className="w-full lg:hidden rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
                Role Permission berlaku sebagai default role. Jika suatu akun memakai <strong>Custom Access</strong>, perubahan role tidak akan langsung mengubah permission akun itu sampai custom access-nya direset.
            </div>
            
            {/* Mobile: Sticky Role Selector (Horizontal) */}
            <div className="lg:hidden w-full sticky top-0 z-40 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 -mx-4 px-4 py-3 mb-2 transition-all">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x mask-linear-gradient">
                    {ROLES.map(role => (
                        <button
                            key={role}
                            onClick={() => setSelectedRole(role)}
                            className={cn(
                                "flex-shrink-0 snap-start px-4 py-2 rounded-full text-xs font-semibold transition-all border flex items-center gap-1.5 shadow-sm",
                                selectedRole === role 
                                    ? "bg-blue-600 text-white border-blue-600 shadow-blue-200 dark:shadow-none ring-2 ring-blue-100 dark:ring-blue-900" 
                                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                            )}
                        >
                            {role}
                            {selectedRole === role && <Check className="w-3 h-3" />}
                        </button>
                    ))}
                </div>
                
                {/* Mobile User Summary */}
                <div className="mt-2 flex items-center justify-between text-xs px-1">
                    <span className="text-slate-500 font-medium">
                        {roleUsers.length} User Active
                    </span>
                    {selectedRole === 'Owner' ? (
                        <span className="text-amber-600 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                            <ShieldAlert className="w-3 h-3" /> Full Access
                        </span>
                    ) : customAccessCount > 0 ? (
                        <span className="text-amber-700 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <ShieldAlert className="w-3 h-3" /> {customAccessCount} Custom
                        </span>
                    ) : null}
                </div>
                {customAccessCount > 0 && (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                        <div>Ada user di role ini yang memakai <strong>Custom Access</strong>, jadi menu mereka bisa berbeda dari role default.</div>
                        {canManageRolePermissions && (
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={isBulkResettingCustom}
                                onClick={() => void handleResetAllCustomAccessForRole()}
                                className="mt-2 h-7 px-2 text-[10px] font-semibold text-amber-700 hover:bg-amber-100"
                            >
                                {isBulkResettingCustom ? 'Reset...' : 'Reset Semua Custom'}
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Desktop: Sidebar Role Selector (Vertical) */}
            <div className="hidden lg:block w-72 shrink-0 sticky top-6">
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-[calc(100vh-140px)] flex flex-col">
                    <div className="p-4 flex-1 overflow-y-auto">
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[11px] leading-relaxed text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
                            Role Permission berlaku sebagai default role. Akun dengan <strong>Custom Access</strong> tetap mengikuti override user sampai custom access tersebut direset.
                        </div>
                        {/* Role List */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between px-3 mb-4">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pilih Role</label>
                            </div>
                            
                            <div className="flex flex-col gap-1">
                                {ROLES.map(role => (
                                    <button
                                        key={role}
                                        onClick={() => setSelectedRole(role)}
                                        className={cn(
                                            "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between relative",
                                            selectedRole === role 
                                                ? "bg-blue-600 text-white font-medium shadow-md shadow-blue-200 dark:shadow-none" 
                                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-normal"
                                        )}
                                    >
                                        <span>{role}</span>
                                        {selectedRole === role && <Check className="w-4 h-4 text-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Users List Preview */}
                        <div className="mt-8">
                            <div className="flex items-center justify-between px-3 mb-3">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                    User ({roleUsers.length})
                                </label>
                                {customAccessCount > 0 ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={isBulkResettingCustom}
                                        onClick={() => void handleResetAllCustomAccessForRole()}
                                        className="h-7 px-2 text-[10px] font-semibold text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                                    >
                                        {isBulkResettingCustom ? 'Reset...' : 'Reset Semua Custom'}
                                    </Button>
                                ) : (
                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-400 hover:text-slate-600">
                                        <MoreHorizontal className="w-3.5 h-3.5" />
                                    </Button>
                                )}
                            </div>
                            
                            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
                                {roleUsers.length > 0 ? (
                                    roleUsers.slice(0, 10).map(user => (
                                        <div key={user.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-default group">
                                            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0 border-2 border-white dark:border-slate-600 shadow-sm">
                                                {user.avatar ? (
                                                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300">
                                                        {user.name.substring(0,2).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="overflow-hidden min-w-0 flex-1">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate group-hover:text-blue-600 transition-colors">{user.name}</p>
                                                    {customAccessMap[user.id] && (
                                                        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                                                            Custom
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                                            </div>
                                            {customAccessMap[user.id] && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={resettingUserId === user.id}
                                                    onClick={() => void handleResetUserCustomAccess(user.id, user.name)}
                                                    className="h-7 shrink-0 border-amber-200 bg-white px-2 text-[10px] font-semibold text-amber-700 hover:bg-amber-50"
                                                >
                                                    {resettingUserId === user.id ? 'Reset...' : 'Reset Custom'}
                                                </Button>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-6">
                                        <p className="text-xs text-slate-400 italic">Tidak ada user aktif</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Right: Cards Grid */}
            <div className="flex-1 w-full pb-20">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {displayGroups.map(group => {
                        const features = organizePermissions(group);
                        const GroupIcon = GROUP_CONFIG[group]?.icon || Box;
                        const groupLabel = GROUP_CONFIG[group]?.label || group;
                        const groupDesc = GROUP_CONFIG[group]?.description;

                        // Skip empty groups
                        if (features.length === 0) return null;

                        const groupPermissionKeys = Array.from(new Set(
                            features.flatMap(({ main, subs }) => [main.key, ...subs.map(sub => sub.key)]),
                        )) as PermissionKey[];
                        const selectedRolePermissions = localPermissions[selectedRole] || [];
                        const isGroupFullyChecked =
                            groupPermissionKeys.length > 0 &&
                            groupPermissionKeys.every(permission => selectedRolePermissions.includes(permission));

                        return (
                            <div key={group} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden h-full">
                                {/* Card Header */}
                                <div className="p-5 flex items-start gap-4">
                                    <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
                                        <GroupIcon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{groupLabel}</h3>
                                        {groupDesc && (
                                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{groupDesc}</p>
                                        )}
                                    </div>
                                    <div className="h-6 w-6">
                                       <Checkbox 
                                            checked={isGroupFullyChecked}
                                            disabled={isRoleReadOnly || isInteractionDisabled}
                                            onCheckedChange={(checked) => setRolePermissionKeys(selectedRole, groupPermissionKeys, checked === true)}
                                            className="data-[state=checked]:bg-blue-600 border-slate-300 rounded"
                                       />
                                    </div>
                                </div>

                                {/* Card Body */}
                                <div className="px-5 pb-5 space-y-6 flex-1">
                                    {features.map(({ main, subs }) => {
                                        const isMainChecked = localPermissions[selectedRole]?.includes(main.key);
                                        const isMenuToggle = main.key.endsWith('.view') || main.key.endsWith('.view_daily') || main.key.endsWith('.view_global');
                                        
                                        return (
                                            <div key={main.key} className="group/item">
                                                {/* Main Row */}
                                                <div className="flex items-start justify-between gap-4 mb-3">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                                                                {main.label}
                                                            </p>
                                                            {isMenuToggle && (
                                                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                                                                    <MenuSquare className="w-3 h-3" /> Menu
                                                                </span>
                                                            )}
                                                        </div>
                                                        {main.description && (
                                                            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                                                                {main.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="pt-0.5">
                                                        <Checkbox 
                                                            checked={isMainChecked}
                                                            onCheckedChange={() => handleToggle(selectedRole, main.key)}
                                                            disabled={isRoleReadOnly || isInteractionDisabled}
                                                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 w-5 h-5 border-slate-300 dark:border-slate-600 rounded"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Sub Permissions (Buttons) */}
                                                {subs.length > 0 && (
                                                    <div className={cn(
                                                        "flex flex-wrap gap-2 transition-all pl-0",
                                                        !isMainChecked && "opacity-50 pointer-events-none grayscale"
                                                    )}>
                                                        {subs.map(sub => {
                                                            const isSubChecked = localPermissions[selectedRole]?.includes(sub.key);
                                                            // Simplify label
                                                            let label = sub.label;
                                                            if (sub.key.includes('create') || sub.key.includes('add')) label = 'Tambah';
                                                            else if (sub.key.includes('edit')) label = 'Edit';
                                                            else if (sub.key.includes('delete')) label = 'Hapus';
                                                            else if (sub.key.includes('export')) label = 'Export';
                                                            else if (sub.key.includes('detail')) label = 'Detail';
                                                            else if (sub.key.includes('assign')) label = 'Ubah Teknisi';
                                                            else if (sub.key.includes('manage')) label = 'Kelola Full';
                                                            
                                                            return (
                                                                <button
                                                                    key={sub.key}
                                                                    onClick={() => handleToggle(selectedRole, sub.key)}
                                                                    disabled={isRoleReadOnly || isInteractionDisabled}
                                                                    className={cn(
                                                                        "px-3 py-1 rounded-[6px] text-[11px] font-medium transition-all border flex items-center gap-1.5 shadow-sm",
                                                                        isSubChecked 
                                                                            ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 ring-1 ring-blue-100 dark:ring-blue-900" 
                                                                            : "bg-white text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:border-slate-300"
                                                                    )}
                                                                >
                                                                    {isSubChecked && <Check className="w-3 h-3" />}
                                                                    {label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    
                                    {/* TARGET-BASED PERMISSION FOR PAYROLL */}
                                    {group === 'Gaji & Payroll' && (
                                        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-md text-indigo-600 dark:text-indigo-400">
                                                    <ShieldAlert className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">Akses Data Divisi (Whitelist)</p>
                                                    <p className="text-[11px] text-slate-500">Pilih role mana saja yang data gajinya boleh dilihat oleh {selectedRole}.</p>
                                                </div>
                                            </div>
                                            
                                            <div className={cn(
                                                "grid grid-cols-2 gap-2 transition-all",
                                                !localPermissions[selectedRole]?.includes('payroll.view') && "opacity-50 pointer-events-none grayscale"
                                            )}>
                                                {ROLES.map(r => {
                                                    const currentVisibleRoles = localSettings[selectedRole]?.payroll_visible_roles || [];
                                                    const isChecked = currentVisibleRoles.includes(r) || selectedRole === 'Owner';
                                                    
                                                    return (
                                                        <label 
                                                            key={r} 
                                                            className={cn(
                                                                "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all",
                                                                isChecked 
                                                                    ? "bg-indigo-50/50 border-indigo-200 dark:bg-indigo-900/10 dark:border-indigo-800" 
                                                                    : "bg-slate-50 border-slate-200 hover:border-slate-300 dark:bg-slate-800/50 dark:border-slate-700"
                                                            )}
                                                        >
                                                            <Checkbox 
                                                                checked={isChecked}
                                                                disabled={isRoleReadOnly || isInteractionDisabled}
                                                                onCheckedChange={(checked) => {
                                                                    const newVisibleRoles = checked 
                                                                        ? [...currentVisibleRoles, r]
                                                                        : currentVisibleRoles.filter((v: string) => v !== r);
                                                                    handleSettingChange(selectedRole, 'payroll_visible_roles', newVisibleRoles);
                                                                }}
                                                                className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                                            />
                                                            <span className={cn(
                                                                "text-[11px] font-medium",
                                                                isChecked ? "text-indigo-700 dark:text-indigo-300" : "text-slate-600 dark:text-slate-400"
                                                            )}>
                                                                {r}
                                                            </span>
                                                        </label>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* Floating Footer - Island Style */}
        <div className="fixed bottom-[90px] md:bottom-6 left-0 right-0 lg:pl-72 z-40 flex justify-center pointer-events-none px-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-black/50 rounded-2xl p-4 md:px-6 md:py-3 flex items-center justify-between gap-6 pointer-events-auto w-full max-w-4xl transition-all duration-300">
                
                <div className="flex items-center gap-3">
                    {hasChanges ? (
                        <div className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    ) : (
                        <div className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                    )}
                    <span className={cn(
                        "text-sm font-medium transition-colors",
                        hasChanges ? "text-slate-700 dark:text-slate-200" : "text-slate-500"
                    )}>
                        {hasChanges ? 'Perubahan belum disimpan.' : 'Tidak ada perubahan.'}
                    </span>
                </div>
                
                <div className="flex items-center gap-3">
                    <Button 
                        variant="ghost" 
                        onClick={() => {
                             setLocalPermissions(rolePermissions);
                             setLocalSettings(roleSettings);
                             setHasChanges(false);
                             toast.info("Perubahan dibatalkan");
                        }} 
                        disabled={!hasChanges || isSaving}
                        className="h-9 px-4 text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-lg"
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={!hasChanges || isInteractionDisabled}
                        className={cn(
                            "h-9 px-6 min-w-[120px] font-semibold transition-all rounded-lg",
                            hasChanges && canManageRolePermissions
                                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200/50" 
                                : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed"
                        )}
                    >
                        {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Saving...</> : 'Save Changes'}
                    </Button>
                    
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
                    
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                        onClick={() => toast.info('Bantuan permission belum tersedia')}
                    >
                        <HelpCircle className="w-5 h-5" />
                    </Button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
