import React, { useState, useEffect } from 'react';
import { Shield, RotateCcw, Save, Check, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../../../components/ui/table';
import { Checkbox } from '../../../components/ui/checkbox';
import { Switch } from '../../../components/ui/switch';
import { Badge } from '../../../components/ui/badge';
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
      if (confirm("Kembalikan semua pengaturan permission ke default sistem?")) {
        setLocalPermissions(DEFAULT_ROLE_PERMISSIONS);
        setIsDirty(true);
        toast.info("Permission dikembalikan ke default (Klik Simpan untuk menerapkan)");
      }
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
      <div className="bg-white dark:bg-slate-900 p-4 lg:p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div className="space-y-2 max-w-lg">
                  <h2 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Manajemen Role & Akses</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    Atur hak akses (permission) aplikasi untuk setiap role pengguna.
                    Perubahan akan mempengaruhi semua user dengan role terkait.
                  </p>
              </div>
              
              {/* Action Buttons */}
              {canEdit && (
                 <div className="flex items-center gap-2 pt-2 md:pt-0 w-full md:w-auto">
                    <Button 
                      variant="outline" 
                      onClick={handleReset} 
                      className="border-slate-200 text-slate-600 hover:bg-slate-50 h-10 px-4 flex-1 md:flex-none"
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset Default
                    </Button>
                    <Button 
                      onClick={handleSave} 
                      disabled={!isDirty || isSaving}
                      size="icon"
                      className={`h-10 w-10 shrink-0 rounded-lg shadow-sm transition-all ${isDirty ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
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
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
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
                        className={`
                          px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border
                          ${isActive 
                              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700/40 shadow-sm ring-1 ring-indigo-200' 
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}
                        `}
                    >
                        {role.name}
                    </button>
                  );
                })}
             </div>
          </div>

          {/* Permission Cards by Group */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
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
                                                className="data-[state=checked]:bg-indigo-600 scale-90"
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
      <div className="hidden xl:block bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Permission Matrix</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tabel matriks lengkap untuk membandingkan hak akses antar role.
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-b border-slate-100">
                <TableHead className="w-[300px] font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 pl-6">Fitur / Permission</TableHead>
                {MOCK_ROLES.map(role => (
                  <TableHead key={role.id} className="text-center font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider py-4 px-2 min-w-[80px]">
                    {role.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(groupedPermissions).map(([group, permissions]) => (
                <React.Fragment key={group}>
                  <TableRow className="bg-slate-50/30 dark:bg-slate-800/30">
                    <TableCell colSpan={MOCK_ROLES.length + 1} className="py-2 px-6 font-semibold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {group}
                    </TableCell>
                  </TableRow>
                  {permissions.map((perm) => (
                    <TableRow key={perm.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors">
                      <TableCell className="py-4 pl-6">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{perm.label}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700">{perm.key}</Badge>
                          </div>
                          {perm.description && <span className="text-xs text-slate-400 dark:text-slate-500 mt-1">{perm.description}</span>}
                        </div>
                      </TableCell>
                      {MOCK_ROLES.map(role => {
                        const currentList = localPermissions[role.name as Role] || [];
                        const isChecked = currentList.includes(perm.key);
                        const isOwner = role.name === 'Owner';
                        
                        return (
                          <TableCell key={role.id} className="text-center py-4">
                            <div className="flex justify-center">
                              <Checkbox 
                                checked={isChecked}
                                disabled={isOwner || !canEdit}
                                onCheckedChange={() => togglePermission(role.name, perm.key)}
                                className={isOwner ? "data-[state=checked]:bg-slate-300 data-[state=checked]:border-slate-300 cursor-not-allowed opacity-70" : "data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"}
                              />
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
