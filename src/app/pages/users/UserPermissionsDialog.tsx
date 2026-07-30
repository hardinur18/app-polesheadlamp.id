import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { PERMISSIONS, PermissionKey, DEFAULT_ROLE_PERMISSIONS } from '@/app/data/permissions';
import { Role } from '../master-data/data';
import { usePermissions } from '@/app/hooks/usePermissions';
import { normalizeRole } from '@/app/data/roleHelpers';
import { 
  Loader2, ShieldAlert, RotateCcw, Save, 
  ShoppingCart, LayoutDashboard, Users, Megaphone, 
  Wallet, Settings, Calendar, Map, Phone, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';

interface UserPermissionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userRole: string;
}

const GROUP_CONFIG: Record<string, { icon: any, color: string, bg: string }> = {
  'Pesanan': { icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  'Pesanan Status': { icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  'Pesanan Pembayaran': { icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  'Dashboard': { icon: LayoutDashboard, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  'Prospek': { icon: Users, color: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-900/20' },
  'Iklan': { icon: Megaphone, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  'Operasional': { icon: Calendar, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
  'Keuangan': { icon: Wallet, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
  'Admin': { icon: Settings, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-900/20' },
  'Manajemen Stok': { icon: Settings, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  'Kontak': { icon: Phone, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/20' },
  'Peta': { icon: Map, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  'Affiliate': { icon: Users, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
};

export const UserPermissionsDialog: React.FC<UserPermissionsDialogProps> = ({
  isOpen, onClose, userId, userName, userRole
}) => {
  const { fetchUserCustomPermissions, setUserCustomPermissions, rolePermissions, hasPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [isCustom, setIsCustom] = useState(false);
  const canManagePermissions = hasPermission('role_permissions.manage');

  const getRoleDefaultPermissions = () => {
    const normalizedUserRole = normalizeRole(userRole);
    if (!normalizedUserRole) {
      return [] as PermissionKey[];
    }

    if (rolePermissions[normalizedUserRole]) {
      return rolePermissions[normalizedUserRole] || [];
    }

    return DEFAULT_ROLE_PERMISSIONS[normalizedUserRole] || [];
  };

  const hasSamePermissionSet = (left: PermissionKey[], right: PermissionKey[]) => {
    const leftSorted = [...new Set(left)].sort();
    const rightSorted = [...new Set(right)].sort();

    if (leftSorted.length !== rightSorted.length) return false;

    return leftSorted.every((permission, index) => permission === rightSorted[index]);
  };

  // Load initial state
  useEffect(() => {
    if (isOpen && userId) {
      loadPermissions();
    }
  }, [isOpen, userId, rolePermissions]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
        const custom = await fetchUserCustomPermissions(userId);
        
        if (custom) {
            setPermissions(custom);
            setIsCustom(true);
        } else {
            setIsCustom(false);
            const defaultPerms = getRoleDefaultPermissions();
            setPermissions(defaultPerms);
        }
    } catch (err) {
        console.error("Failed to load user permissions", err);
        toast.error("Gagal memuat permission user");
    } finally {
        setLoading(false);
    }
  };

  const handleToggle = (key: PermissionKey) => {
    if (!canManagePermissions) return;

    setPermissions(prev => {
        if (prev.includes(key)) return prev.filter(k => k !== key);
        return [...prev, key];
    });
    if (!isCustom) setIsCustom(true);
  };

  const handleSave = async () => {
      if (!canManagePermissions) return;

      setSaving(true);
      try {
          const roleDefaultPermissions = getRoleDefaultPermissions();
          const payload = isCustom && !hasSamePermissionSet(permissions, roleDefaultPermissions)
            ? permissions
            : null;
          await setUserCustomPermissions(userId, payload, { silent: true });
          if (payload === null && isCustom) {
            toast.success('Custom Access sama dengan role default, override dibersihkan');
          } else {
            toast.success('Permission user berhasil disimpan');
          }
          onClose();
      } catch (err) {
          console.error("Failed to save permissions in dialog:", err);
          // Toast handled in hook, but we keep the dialog open
      } finally {
          setSaving(false);
      }
  };

  const handleResetToRole = () => {
      if (!canManagePermissions) return;

      if (confirm(`Reset permission ${userName} kembali ke default role (${userRole})?`)) {
          setIsCustom(false);
          setPermissions(getRoleDefaultPermissions());
      }
  };

  const groups = Array.from(new Set(PERMISSIONS.map(p => p.group)));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0 bg-slate-50 dark:bg-slate-950 border-none shadow-2xl overflow-hidden rounded-xl">
        
        {/* Header */}
        <DialogHeader className="p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-start justify-between">
              <div>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    Custom Access
                  </DialogTitle>
                  <DialogDescription className="mt-1.5 flex items-center gap-2">
                    Mengatur hak akses khusus untuk <Badge variant="outline" className="font-mono">{userName}</Badge>
                    <span className="text-slate-300">|</span>
                    <span className="text-xs">Role Asli: <strong>{userRole}</strong></span>
                  </DialogDescription>
              </div>
              <div className="flex items-center gap-3">
                   <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                       <Checkbox 
                            id="enable-custom"
                            checked={isCustom}
                            onCheckedChange={(c) => canManagePermissions && setIsCustom(c === true)}
                            disabled={!canManagePermissions}
                            className="w-4 h-4 border-slate-400 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                       />
                       <label htmlFor="enable-custom" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                           Aktifkan Custom Mode
                       </label>
                   </div>
                   {isCustom && (
                       <Button variant="ghost" size="sm" onClick={handleResetToRole} className="h-8 text-xs text-slate-500 hover:text-red-600">
                           <RotateCcw className="w-3 h-3 mr-1" /> Reset
                       </Button>
                   )}
              </div>
          </div>
        </DialogHeader>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
           {loading ? (
               <div className="flex flex-col items-center justify-center h-full gap-3">
                   <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                   <p className="text-sm text-slate-500">Memuat permissions...</p>
               </div>
           ) : (
               <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-300 ${!isCustom || !canManagePermissions ? 'opacity-60 pointer-events-none grayscale-[0.5]' : ''}`}>
                   
                   {/* Summary / Header Info if needed */}
                   <div className="col-span-full mb-2">
                       <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800 mb-4 flex gap-2">
                           <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                           <div className="text-xs text-amber-700 dark:text-amber-400">
                               <strong>Perhatian:</strong> Perubahan "Custom Access" hanya berlaku untuk user ini secara spesifik dan akan menimpa pengaturan default Role.
                           </div>
                       </div>
                       
                       <div className="flex items-center justify-between">
                           <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Access Permissions</h3>
                           <span className="text-xs text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full font-medium">
                               Select modules visible to user
                           </span>
                       </div>
                   </div>

                   {groups.map(group => {
                       const config = GROUP_CONFIG[group] || { icon: Settings, color: 'text-slate-600', bg: 'bg-slate-100' };
                       const Icon = config.icon;
                       const groupPerms = PERMISSIONS.filter(p => p.group === group);
                       const activeCount = groupPerms.filter(p => permissions.includes(p.key)).length;
                       const allActive = activeCount === groupPerms.length;

                       return (
                           <Card key={group} className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                               <CardHeader className={`py-3 px-4 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between space-y-0 ${config.bg}`}>
                                   <div className="flex items-center gap-2">
                                       <Icon className={`w-4 h-4 ${config.color}`} />
                                       <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                           {group}
                                       </CardTitle>
                                   </div>
                                   <Badge variant="secondary" className="bg-white/80 text-[10px] h-5">
                                       {activeCount}/{groupPerms.length}
                                   </Badge>
                               </CardHeader>
                               <CardContent className="p-3 pt-2">
                                   <div className="space-y-1">
                                       {groupPerms.map(perm => (
                                           <div 
                                               key={perm.key} 
                                               className="flex items-start gap-3 p-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                                               onClick={() => handleToggle(perm.key)}
                                           >
                                                <Checkbox 
                                                    id={`perm-${perm.key}`}
                                                    checked={permissions.includes(perm.key)}
                                                    onCheckedChange={() => {}} // Handled by parent div
                                                    className="mt-0.5 w-4 h-4 border-slate-300 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-purple-700 dark:group-hover:text-purple-400 leading-none mb-1">
                                                        {perm.label}
                                                    </span>
                                                    {perm.description && (
                                                        <span className="text-[10px] text-slate-400 leading-tight">
                                                            {perm.description}
                                                        </span>
                                                    )}
                                                </div>
                                           </div>
                                       ))}
                                   </div>
                               </CardContent>
                           </Card>
                       );
                   })}
               </div>
           )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center">
            <div className="text-xs text-slate-400 italic">
                {isCustom ? "* Perubahan akan menimpa setting role default" : "* Menggunakan setting default dari role"}
            </div>
            <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} disabled={saving} className="h-9">
                    Cancel
                </Button>
                <Button onClick={handleSave} disabled={loading || saving || !canManagePermissions} className="h-9 bg-purple-600 hover:bg-purple-700 text-white min-w-[120px]">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Changes
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
