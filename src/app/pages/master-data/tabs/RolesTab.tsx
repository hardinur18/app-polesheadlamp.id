import React, { useState, useEffect } from 'react';
import { Shield, RotateCcw, Save, Check, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { DataTable } from '../../../components/ui/data-table';
import { Checkbox } from '../../../components/ui/checkbox';
import { Switch } from '../../../components/ui/switch';
import { Badge } from '../../../components/ui/badge';
import { AlertDialog } from '../../../components/ui/alert-dialog';
import { MasterDataConfirmContent } from '../../../components/ui/master-data-ui';
import { Role, MOCK_ROLES } from '../data';
import { toast } from 'sonner';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, PermissionKey } from '@/app/data/permissions';

interface RolesTabProps {
  currentRole: Role;
}

export const RolesTab: React.FC<RolesTabProps> = ({ currentRole }) => {
  const { rolePermissions, setRolePermissions, loading, refreshPermissions, hasPermission } = usePermissions();
  
  // Local state for editing before saving
  const [localPermissions, setLocalPermissions] = useState<Record<Role, PermissionKey[]>>(DEFAULT_ROLE_PERMISSIONS);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedMobileRole, setSelectedMobileRole] = useState<string>('Admin PIC');
  const [isResetOpen, setIsResetOpen] = useState(false);

  // Sync local state with context when loaded
  useEffect(() => {
    if (rolePermissions) {
        setLocalPermissions(rolePermissions);
    }
  }, [rolePermissions]);

  // Helper to toggle permission
  const togglePermission = (roleName: string, permissionKey: PermissionKey) => {
    if (roleName === 'Owner') return; // Owner is immutable

    setLocalPermissions(prev => {
      const current = prev[roleName as Role] || [];
      const hasPermission = current.includes(permissionKey);
      
      let updated;
      if (hasPermission) {
        updated = current.filter(k => k !== permissionKey);
      } else {
        updated = [...current, permissionKey];
      }

      return {
        ...prev,
        [roleName]: updated
      };
    });
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setRolePermissions(localPermissions);
      toast.success("Pengaturan Role & Permission berhasil disimpan");
      setIsDirty(false);
    } catch (error) {
      console.error("Failed to save permissions", error);
      toast.error("Gagal menyimpan perubahan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
      setLocalPermissions(DEFAULT_ROLE_PERMISSIONS);
      setIsDirty(true);
      setIsResetOpen(false);
      toast.info("Permission dikembalikan ke default (Klik Simpan untuk menerapkan)");
  };

  const canEdit = hasPermission('role_permissions.manage');

  // Group permissions for display
  const groupedPermissions = PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.group]) acc[perm.group] = [];
    acc[perm.group].push(perm);
    return acc;
  }, {} as Record<string, typeof PERMISSIONS[number][]>);

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
              <p className="text-slate-500">Memuat data permission...</p>
          </div>
      );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      
      {/* Header Section */}
      <div className="masterDataRoleHero">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div className="space-y-2 max-w-lg">
                  <h2>Manajemen Role & Akses</h2>
                  <p>
                    Atur hak akses (permission) aplikasi untuk setiap role pengguna.
                    Perubahan akan mempengaruhi semua user dengan role terkait.
                  </p>
              </div>
              
              {/* Action Buttons */}
              {canEdit && (
                 <div className="flex items-center gap-2 pt-2 md:pt-0 w-full md:w-auto">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsResetOpen(true)}
                      icon={<RotateCcw className="h-4 w-4" />}
                      className="flex-1 md:flex-none"
                    >
                        Reset Default
                    </Button>
                    <Button 
                      onClick={handleSave} 
                      disabled={!isDirty || isSaving}
                      size="icon"
                      className="shrink-0"
                      aria-label="Simpan permission"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </Button>
                 </div>
              )}
          </div>
      </div>

      {/* MOBILE & TABLET VIEW: Tab/Card Based Layout (Visible up to XL screens) */}
      <div className="xl:hidden space-y-4">
          
          {/* Role Selector Tabs */}
          <div className="masterDataRoleSelector p-4">
             <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 block">
                Pilih Role untuk Diedit
             </label>
             <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {MOCK_ROLES.map(role => {
                  const isActive = selectedMobileRole === role.name;
                  return (
                    <button
                        key={role.id}
                        onClick={() => setSelectedMobileRole(role.name)}
                        className={`masterDataRoleChip ${isActive ? 'isActive' : ''}`}
                    >
                        {role.name}
                    </button>
                  );
                })}
             </div>
          </div>

          {/* Permission Cards by Group */}
          <div className="masterDataRolePanel">
              <div className="p-4 border-b border-slate-100 bg-indigo-50/30 dark:bg-indigo-900/20">
                <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">Akses: {selectedMobileRole}</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed pl-6">
                  Atur fitur apa saja yang bisa diakses oleh role ini.
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {Object.entries(groupedPermissions).map(([group, permissions]) => (
                    <div key={group}>
                        {/* Group Header */}
                        <div className="bg-slate-50/80 dark:bg-slate-800/50 px-4 py-2 border-y border-slate-100 dark:border-slate-800">
                            <h3 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{group}</h3>
                        </div>

                        {/* Items */}
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {permissions.map(perm => {
                                const currentList = localPermissions[selectedMobileRole as Role] || [];
                                const isChecked = currentList.includes(perm.key);
                                const isOwner = selectedMobileRole === 'Owner';
                                
                                return (
                                    <div key={perm.key} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                                                    {perm.label}
                                                </span>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-1">
                                                    {perm.description || perm.key}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="shrink-0">
                                            <Switch 
                                                checked={isChecked}
                                                disabled={isOwner || !canEdit}
                                                onCheckedChange={() => togglePermission(selectedMobileRole, perm.key)}
                                                className="data-[state=checked]:bg-primary scale-90"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
              </div>
          </div>
      </div>

      {/* DESKTOP VIEW: Matrix Table (Only visible on XL screens > 1280px) */}
      <div className="masterDataMatrixPanel hidden xl:block">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Permission Matrix</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tabel matriks lengkap untuk membandingkan hak akses antar role.
          </p>
        </div>
        <DataTable
          cellY={12}
          columns={[320, ...MOCK_ROLES.map(() => 108)]}
          minWidth={320 + MOCK_ROLES.length * 108}
          rowMinHeight={66}
        >
          <table>
            <thead>
              <tr>
                <th>Fitur / Permission</th>
                {MOCK_ROLES.map(role => (
                  <th key={role.id} className="text-center">
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedPermissions).map(([group, permissions]) => (
                <React.Fragment key={group}>
                  <tr className="bg-slate-50/45 hover:bg-slate-50/45 dark:bg-slate-950/30 dark:hover:bg-slate-950/30">
                    <td colSpan={MOCK_ROLES.length + 1}>
                      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                      {group}
                      </span>
                    </td>
                  </tr>
                  {permissions.map((perm) => (
                    <tr key={perm.key}>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className="text-[0.94rem] font-semibold leading-tight text-slate-950 dark:text-slate-100">{perm.label}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700">{perm.key}</Badge>
                          </div>
                          {perm.description && <span className="text-xs text-slate-400 dark:text-slate-500 mt-1">{perm.description}</span>}
                        </div>
                      </td>
                      {MOCK_ROLES.map(role => {
                        const currentList = localPermissions[role.name as Role] || [];
                        const isChecked = currentList.includes(perm.key);
                        const isOwner = role.name === 'Owner';
                        
                        return (
                          <td key={role.id} className="text-center">
                            <div className="flex justify-center">
                              <Checkbox 
                                checked={isChecked}
                                disabled={isOwner || !canEdit}
                                onCheckedChange={() => togglePermission(role.name, perm.key)}
                                className={isOwner ? "data-[state=checked]:bg-slate-300 data-[state=checked]:border-slate-300 cursor-not-allowed opacity-70" : "data-[state=checked]:bg-primary data-[state=checked]:border-primary"}
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </DataTable>
      </div>
      <AlertDialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <MasterDataConfirmContent
          actionLabel="Reset"
          onConfirm={handleReset}
          title="Reset permission ke default?"
          tone="default"
        >
          Perubahan lokal akan diganti ke konfigurasi default sistem. Klik Simpan setelah reset untuk menerapkan.
        </MasterDataConfirmContent>
      </AlertDialog>
    </div>
  );
};
