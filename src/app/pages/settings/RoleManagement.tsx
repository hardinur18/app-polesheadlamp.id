import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS, PermissionKey } from '@/app/data/permissions';
import { normalizeRole } from '@/app/data/roleHelpers';
import { Role } from '../master-data/data';
import { useMasterData } from '@/app/pages/master-data/context';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Tabs, TabsRail, TabsTrigger, TabsViewport } from '../../components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
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
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

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

    setIsResetConfirmOpen(true);
  };

  const confirmReset = async () => {
    if (!canManageRolePermissions) return;

    setIsSaving(true);
    try {
      await resetPermissions();
      setHasChanges(false);
      setIsResetConfirmOpen(false);
      toast.success('Permission di-reset ke default');
    } catch (error) {
      console.error('[RoleManagement] Reset error:', error);
      toast.error('Gagal reset permission');
    } finally {
      setIsSaving(false);
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
  
  const activeUsers = useMemo(
    () => users.filter((u) => isActiveUserStatus(u.status)),
    [users],
  );

  // Get users for selected role
  // Only show active users
  const roleUsers = useMemo(
    () => activeUsers.filter((u) => normalizeRole(u.role) === selectedRole),
    [activeUsers, selectedRole],
  );
  const customAccessCount = roleUsers.filter((user) => customAccessMap[user.id]).length;
  const isBootstrapping = contextLoading && !hasCompletedInitialSync;
  const isRoleReadOnly = selectedRole === 'Owner';
  const isInteractionDisabled = isSaving || !canManageRolePermissions;
  const actionDock = (
    <div className="rolePermissionActionDock">
      <div className="rolePermissionActionBar">
        <div className="rolePermissionActionStatus">
          {hasChanges ? <div className="isDirty" /> : <div />}
          <span className={cn(
            "transition-colors",
            hasChanges ? "text-slate-700 dark:text-slate-200" : "text-slate-500",
          )}>
            {hasChanges ? 'Perubahan belum disimpan.' : 'Tidak ada perubahan.'}
          </span>
        </div>

        <div className="rolePermissionActionButtons">
          <Button
            variant="ghost"
            onClick={() => {
              setLocalPermissions(rolePermissions);
              setLocalSettings(roleSettings);
              setHasChanges(false);
              toast.info("Perubahan dibatalkan");
            }}
            disabled={!hasChanges || isSaving}
            className="rolePermissionCancelButton"
          >
            Batal
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isInteractionDisabled}
            className="rolePermissionSaveButton"
          >
            {isSaving ? <><Loader2 className="w-4 h-4 animate-spin"/> Menyimpan</> : <><Save className="w-4 h-4" /> Simpan</>}
          </Button>

          <div className="rolePermissionActionDivider" />

          <Button
            variant="ghost"
            size="icon"
            className="rolePermissionHelpButton"
            onClick={() => toast.info('Bantuan permission belum tersedia')}
          >
            <HelpCircle className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (!canManageRolePermissions) {
      setCustomAccessMap({});
      return;
    }

    let isCancelled = false;

    const loadCustomAccessMap = async () => {
      const nextEntries = await Promise.all(
        activeUsers.map(async (user) => {
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
  }, [activeUsers, canManageRolePermissions, fetchUserCustomPermissions]);

  if (!canViewRolePermissions) {
    return (
      <div className="opsPageShell rolePermissionPage">
        <div className="rolePermissionState">
          <div className="rolePermissionStateIcon isDanger">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1>Akses Dibatasi</h1>
          <p>Anda tidak memiliki izin untuk membuka halaman role permission.</p>
        </div>
      </div>
    );
  }

  // Show loading ONLY if context is loading AND we don't have local data yet
  if (isBootstrapping) {
      return (
          <div className="opsPageShell rolePermissionPage">
              <div className="rolePermissionState">
                  <div className="rolePermissionStateIcon">
                      <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                  <h1>Memuat Permission</h1>
                  <p>Menyiapkan konfigurasi role dan custom access.</p>
              </div>
          </div>
      );
  }

  return (
    <div className="opsPageShell rolePermissionPage pb-48 md:pb-32">
      <div className="rolePermissionInner">
        <div className="topbar rolePermissionTopbar">
            <div className="topbarTitle">
                <div className="eyebrowLine">
                    <Shield className="h-4 w-4" />
                    Sistem & Akses
                </div>
                <h1>Role Permission</h1>
                <p>
                    Atur role default, akses menu, dan batas permission pengguna.
                    <span className="rolePermissionHeaderBadge">
                        <History className="h-3.5 w-3.5" />
                        {contextLoading ? 'Syncing' : 'Ready'}
                    </span>
                    {!canManageRolePermissions && (
                        <span className="rolePermissionHeaderBadge isWarning">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            View Only
                        </span>
                    )}
                </p>
            </div>
            <div className="topbarActions">
                 <Button variant="outline" onClick={() => toast.info('Log history akan segera hadir')}>
                    <History className="h-4 w-4" /> History
                 </Button>
                 <Button variant="outline" onClick={handleReset} disabled={isInteractionDisabled}>
                    <RotateCcw className="h-4 w-4" /> Reset
                 </Button>
            </div>
        </div>

        <Tabs value={selectedRole} onValueChange={(value) => setSelectedRole(value as Role)} className="rolePermissionTabsShell">
            <TabsViewport>
                <TabsRail className="masterDataTabs rolePermissionTabs min-w-max">
                    {ROLES.map(role => {
                        const count = users.filter((user) => normalizeRole(user.role) === role && isActiveUserStatus(user.status)).length;
                        const customCount = users.filter((user) => normalizeRole(user.role) === role && customAccessMap[user.id]).length;

                        return (
                            <TabsTrigger key={role} value={role} className="masterDataTab rolePermissionTab">
                                <Shield className="h-4 w-4" />
                                <span>{role}</span>
                                <strong>{count}</strong>
                                {customCount > 0 && <em>{customCount}</em>}
                            </TabsTrigger>
                        );
                    })}
                </TabsRail>
            </TabsViewport>
        </Tabs>

        <div className="rolePermissionLayout">
            <div className="rolePermissionNotice lg:hidden">
                Role Permission berlaku sebagai default role. Jika suatu akun memakai <strong>Custom Access</strong>, perubahan role tidak akan langsung mengubah permission akun itu sampai custom access-nya direset.
            </div>

            {/* Desktop: Sidebar Role Selector (Vertical) */}
            <div className="hidden lg:block rolePermissionSidebarWrap">
                <div className="rolePermissionSidebar">
                    <div className="rolePermissionSidebarBody">
                        <div className="rolePermissionNotice">
                            Role Permission berlaku sebagai default role. Akun dengan <strong>Custom Access</strong> tetap mengikuti override user sampai custom access tersebut direset.
                        </div>

                        <div className="rolePermissionSelectedRole">
                            <span>Role Aktif</span>
                            <strong>{selectedRole}</strong>
                            <small>
                                {roleUsers.length} user aktif
                                {customAccessCount > 0 ? `, ${customAccessCount} custom access` : ''}
                            </small>
                        </div>

                        {/* Users List Preview */}
                        <div className="rolePermissionUserPanel">
                            <div className="rolePermissionUserPanelHeader">
                                <label>User Aktif</label>
                                <span>{roleUsers.length}</span>
                                {customAccessCount > 0 ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={isBulkResettingCustom}
                                        onClick={() => void handleResetAllCustomAccessForRole()}
                                        className="rolePermissionTinyAction"
                                    >
                                        {isBulkResettingCustom ? 'Reset...' : 'Reset Semua Custom'}
                                    </Button>
                                ) : (
                                    <Button variant="ghost" size="icon" className="rolePermissionMoreButton">
                                        <MoreHorizontal className="w-3.5 h-3.5" />
                                    </Button>
                                )}
                            </div>
                            
                            <div className="rolePermissionUserList">
                                {roleUsers.length > 0 ? (
                                    roleUsers.slice(0, 10).map(user => (
                                        <div key={user.id} className="rolePermissionUserItem">
                                            <div className="rolePermissionUserAvatar">
                                                {user.avatar ? (
                                                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>
                                                        {user.name.substring(0,2).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="rolePermissionUserText">
                                                <div>
                                                    <p>{user.name}</p>
                                                    {customAccessMap[user.id] && (
                                                        <span>
                                                            Custom
                                                        </span>
                                                    )}
                                                </div>
                                                <small>{user.email}</small>
                                            </div>
                                            {customAccessMap[user.id] && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={resettingUserId === user.id}
                                                    onClick={() => void handleResetUserCustomAccess(user.id, user.name)}
                                                    className="rolePermissionTinyAction"
                                                >
                                                    {resettingUserId === user.id ? 'Reset...' : 'Reset Custom'}
                                                </Button>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="rolePermissionEmptyUsers">
                                        Tidak ada user aktif
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Cards Grid */}
            <div className="rolePermissionContent">
                <div className="rolePermissionGrid">
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
                            <div key={group} className="rolePermissionCard">
                                {/* Card Header */}
                                <div className="rolePermissionCardHeader">
                                    <div className="rolePermissionCardIcon">
                                        <GroupIcon className="w-5 h-5" />
                                    </div>
                                    <div className="rolePermissionCardTitle">
                                        <h3>{groupLabel}</h3>
                                        {groupDesc && (
                                            <p>{groupDesc}</p>
                                        )}
                                    </div>
                                    <div className="rolePermissionCheckboxSlot">
                                       <Checkbox 
                                            checked={isGroupFullyChecked}
                                            disabled={isRoleReadOnly || isInteractionDisabled}
                                            onCheckedChange={(checked) => setRolePermissionKeys(selectedRole, groupPermissionKeys, checked === true)}
                                            className="rolePermissionCheckbox"
                                       />
                                    </div>
                                </div>

                                {/* Card Body */}
                                <div className="rolePermissionCardBody">
                                    {features.map(({ main, subs }) => {
                                        const isMainChecked = localPermissions[selectedRole]?.includes(main.key);
                                        const isMenuToggle = main.key.endsWith('.view') || main.key.endsWith('.view_daily') || main.key.endsWith('.view_global');
                                        
                                        return (
                                            <div key={main.key} className="rolePermissionFeature">
                                                {/* Main Row */}
                                                <div className="rolePermissionFeatureMain">
                                                    <div className="rolePermissionFeatureText">
                                                        <div>
                                                            <p>
                                                                {main.label}
                                                            </p>
                                                            {isMenuToggle && (
                                                                <span className="rolePermissionMenuBadge">
                                                                    <MenuSquare className="w-3 h-3" /> Menu
                                                                </span>
                                                            )}
                                                        </div>
                                                        {main.description && (
                                                            <small>
                                                                {main.description}
                                                            </small>
                                                        )}
                                                    </div>
                                                    <div className="rolePermissionCheckboxSlot">
                                                        <Checkbox 
                                                            checked={isMainChecked}
                                                            onCheckedChange={() => handleToggle(selectedRole, main.key)}
                                                            disabled={isRoleReadOnly || isInteractionDisabled}
                                                            className="rolePermissionCheckbox"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Sub Permissions (Buttons) */}
                                                {subs.length > 0 && (
                                                    <div className={cn(
                                                        "rolePermissionChipGroup",
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
                                                                        "rolePermissionChip",
                                                                        isSubChecked
                                                                            ? "isActive"
                                                                            : ""
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
                                        <div className="rolePermissionPayrollBlock">
                                            <div className="rolePermissionPayrollHeader">
                                                <div className="rolePermissionPayrollIcon">
                                                    <ShieldAlert className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p>Akses Data Divisi</p>
                                                    <small>Pilih role yang data gajinya boleh dilihat oleh {selectedRole}.</small>
                                                </div>
                                            </div>
                                            
                                            <div className={cn(
                                                "rolePermissionPayrollGrid",
                                                !localPermissions[selectedRole]?.includes('payroll.view') && "isDisabled"
                                            )}>
                                                {ROLES.map(r => {
                                                    const currentVisibleRoles = localSettings[selectedRole]?.payroll_visible_roles || [];
                                                    const isChecked = currentVisibleRoles.includes(r) || selectedRole === 'Owner';
                                                    
                                                    return (
                                                        <label 
                                                            key={r} 
                                                            className={cn(
                                                                "rolePermissionPayrollOption",
                                                                isChecked && "isActive"
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
                                                                className="rolePermissionCheckbox"
                                                            />
                                                            <span>{r}</span>
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

        {typeof document !== 'undefined' ? createPortal(actionDock, document.body) : actionDock}
        <AlertDialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
            <AlertDialogContent className="masterDataConfirmDialog">
                <AlertDialogHeader>
                    <AlertDialogTitle>Reset permission role?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Semua konfigurasi role akan dikembalikan ke default sistem. Custom Access user tetap terpisah dan tidak ikut dihapus dari aksi ini.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="masterDataConfirmActions">
                    <AlertDialogCancel disabled={isSaving}>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmReset} disabled={isSaving} className="rolePermissionDialogAction">
                        {isSaving ? 'Reset...' : 'Reset Permission'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
