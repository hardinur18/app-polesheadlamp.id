import React, { useEffect, useMemo, useState } from 'react';
import { 
  Search, Plus, MoreVertical, Edit, Trash2, Lock, Shield, Calendar, Loader2, Users, Headphones, Wrench, Briefcase, Target, Banknote, UserCog, ShieldAlert, Crown, History, RotateCcw, Filter, Download, ChevronDown, ChevronUp, MapPin
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Badge } from '../../components/ui/badge';
import { useMasterData } from '@/app/pages/master-data/context';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { usePermissions } from '@/app/hooks/usePermissions';
import { isAdvertiserRole, isCsRole, isRole, normalizeRole } from '@/app/data/roleHelpers';
import { logActivity } from '@/app/services/auditService';
import { User, Role } from '../master-data/data';
import { toast } from 'sonner';
import { UserForm } from './UserForm';
import { PasswordResetDialog } from './PasswordResetDialog';
import { UserPermissionsDialog } from './UserPermissionsDialog';
import { AdvertiserAccessModal } from '../master-data/modals/AdvertiserAccessModal';
import { cn } from '../../components/ui/utils';

// Inner component that uses the context
const UserManagementContent = () => {
  const { users, currentRole, createSystemUser, updateSystemUser, deleteSystemUser, resetUserPassword, branches, platforms, subChannels, currentUser } = useMasterData();
  const { hasPermission, fetchUserCustomPermissions } = usePermissions();
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<User['status'] | 'all'>('active');
  
  // Advertiser Config Dialog State
  const [isAdvertiserConfigOpen, setIsAdvertiserConfigOpen] = useState(false);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<User | null>(null);

  // Permissions Dialog State
  const [isPermOpen, setIsPermOpen] = useState(false);
  const [permUser, setPermUser] = useState<{id: string, name: string, role: string} | null>(null);

  // Edit/Add/Delete State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [customAccessMap, setCustomAccessMap] = useState<Record<string, boolean>>({});

  // Expanded/Collapsed state for role cards (optional, all expanded by default)
  const [expandedRoles, setExpandedRoles] = useState<Record<string, boolean>>({});

  const toggleRoleExpand = (label: string) => {
      setExpandedRoles(prev => ({...prev, [label]: !prev[label]}));
  };

  // Dashboard Stats & Group Configuration
  const roleGroups = [
    { label: 'Owner', role: 'Owner', icon: Crown, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', headerBg: 'bg-white dark:bg-slate-900' },
    { label: 'Super Admin', role: 'Super Admin', icon: ShieldAlert, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', headerBg: 'bg-white dark:bg-slate-900' },
    { label: 'Admin PIC', role: 'Admin PIC', icon: UserCog, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-200 dark:border-pink-800', headerBg: 'bg-white dark:bg-slate-900' },
    { label: 'Finance', role: 'Finance', icon: Banknote, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', headerBg: 'bg-white dark:bg-slate-900' },
    { label: 'Advertiser', role: 'Advertiser', icon: Target, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-200 dark:border-cyan-800', headerBg: 'bg-white dark:bg-slate-900' },
    { label: 'CS', role: 'CS', icon: Headphones, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', headerBg: 'bg-white dark:bg-slate-900' },
    { label: 'Teknisi', role: ['Teknisi', 'Technician'], icon: Wrench, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', headerBg: 'bg-white dark:bg-slate-900' },
  ];

  const visibleRoleGroups = roleGroups.filter(group => {
     if (!isRole(currentRole, 'Owner') && group.label === 'Owner') return false;
     return true;
  });

  const matchesRoleDefinition = (itemRole: string, roleDef: string | string[]) => {
    const normalizedItemRole = normalizeRole(itemRole);
    if (!normalizedItemRole) return false;

    if (Array.isArray(roleDef)) {
      return roleDef.some((role) => normalizeRole(role) === normalizedItemRole);
    }

    return normalizeRole(roleDef) === normalizedItemRole;
  };

  const visibleUsers = useMemo(
    () => users.filter((u) => isRole(currentRole, 'Owner') || normalizeRole(u.role) !== 'Owner'),
    [currentRole, users],
  );
  const visibleUserIdsKey = useMemo(
    () => visibleUsers.map((user) => user.id).sort().join('|'),
    [visibleUsers],
  );
  const canCreateUsers = hasPermission('users.create');
  const canEditUsers = hasPermission('users.edit');
  const canResetPasswords = hasPermission('users.reset_password');
  const canDeleteUsers = hasPermission('users.delete');
  const canManageCustomAccess = hasPermission('role_permissions.manage');
  const canOpenAnyUserActionMenu = canEditUsers || canResetPasswords || canDeleteUsers || canManageCustomAccess;
  const canManageAdvertiserConfig = canEditUsers;

  useEffect(() => {
    if (!canManageCustomAccess) {
      setCustomAccessMap({});
      return;
    }

    let isCancelled = false;

    const loadCustomAccessMap = async () => {
      if (visibleUsers.length === 0) {
        setCustomAccessMap({});
        return;
      }

      const nextEntries = await Promise.all(
        visibleUsers.map(async (user) => {
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
  }, [canManageCustomAccess, fetchUserCustomPermissions, visibleUserIdsKey, isPermOpen]);

  const getBranchName = (branchId?: string) => {
    if (!branchId) return '-';
    return branches.find(b => b.id === branchId)?.name || '-';
  };

  const getRoleForFilter = (statRole: string | string[]) => {
    if (Array.isArray(statRole)) return statRole[0];
    return statRole;
  };

  const matchesToolbarFilters = (item: User) => {
    const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;
    if (!matchesStatus) return false;

    const searchLower = search.toLowerCase().trim();
    if (!searchLower) return true;

    return (
      item.name.toLowerCase().includes(searchLower) ||
      item.role.toLowerCase().includes(searchLower) ||
      (item.email || '').toLowerCase().includes(searchLower) ||
      getBranchName(item.branchId).toLowerCase().includes(searchLower) ||
      (item.phone || '').includes(searchLower) ||
      (item.csWhatsappNumber || '').includes(searchLower)
    );
  };

  const filteredSummaryUsers = visibleUsers.filter(matchesToolbarFilters);

  const getRoleCount = (role: string | string[]) => {
    return filteredSummaryUsers.filter((u) => matchesRoleDefinition(u.role, role)).length;
  };

  // Access Control
  if (!hasPermission('users.view')) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8">
        <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full mb-4">
           <ShieldAlert className="w-12 h-12 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Akses Ditolak</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md">
          Anda tidak memiliki izin untuk mengakses halaman Manajemen User.
        </p>
      </div>
    );
  }

  const getFilteredUsersByRole = (roleDef: string | string[]) => {
    return visibleUsers.filter(item => {
        // Role Match
        const isRoleMatch = matchesRoleDefinition(item.role, roleDef);
        
        if (!isRoleMatch) return false;
        return matchesToolbarFilters(item);
    });
  };

  const hasToolbarFilters = search !== '' || selectedStatus !== 'all';
  const hasVisibleRoleResults = visibleRoleGroups.some((group) => {
    if (selectedRole !== 'all') {
      const filterValue = getRoleForFilter(group.role);
      const isSelected = selectedRole === filterValue;
      if (!isSelected) return false;
    }

    return getFilteredUsersByRole(group.role).length > 0;
  });

  const handleSubmit = async (formData: any) => {
    if (editingItem && !canEditUsers) {
      toast.error("Anda tidak memiliki izin untuk mengedit pengguna");
      return;
    }

    if (!editingItem && !canCreateUsers) {
      toast.error("Anda tidak memiliki izin untuk menambah pengguna");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingItem) {
        await updateSystemUser(editingItem.id, formData);

        // Handle Password Reset
        if (formData.password && formData.password.trim() !== '') {
             if (!canResetPasswords) {
                 throw new Error("Anda tidak memiliki izin untuk mereset password pengguna");
             }
             try {
                 await resetUserPassword(editingItem.id, formData.password);
                 toast.success("Password berhasil direset");
             } catch (pwdError: any) {
                 console.error("Failed to reset password during edit:", pwdError);
                 toast.error(`Gagal mereset password: ${pwdError.message}`);
             }
        }

        if (currentUser) {
          logActivity(
            { id: currentUser.id, name: currentUser.name, role: currentUser.role },
            'UPDATE', 'Pengguna',
            `Memperbarui data pengguna: ${formData.name} (${formData.role})`,
            editingItem.id
          );
        }
      } else {
        // Create New User
        const payload = {
            ...formData,
            branchId: (formData.branchId === 'none_branch' || formData.branchId === '') ? null : formData.branchId
        };
        await createSystemUser(payload);
        if (currentUser) {
          logActivity(
            { id: currentUser.id, name: currentUser.name, role: currentUser.role },
            'CREATE', 'Pengguna',
            `Menambahkan pengguna baru: ${formData.name} (${formData.role})`,
            ''
          );
        }
      }
      setIsAddOpen(false);
      setEditingItem(null);
    } catch (error: any) {
      console.error("Error saving user:", error);
      toast.error(error.message || "Gagal menyimpan data pengguna");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!canDeleteUsers) {
      toast.error("Anda tidak memiliki izin untuk menghapus pengguna");
      setDeleteId(null);
      return;
    }

    if (deleteId) {
      try {
        const userToDelete = users.find(u => u.id === deleteId);
        await deleteSystemUser(deleteId);
        if (currentUser && userToDelete) {
          logActivity(
            { id: currentUser.id, name: currentUser.name, role: currentUser.role },
            'DELETE', 'Pengguna',
            `Menghapus pengguna: ${userToDelete.name} (${userToDelete.role})`,
            deleteId
          );
        }
        setDeleteId(null);
      } catch (error: any) {
         console.error("Error deleting user:", error);
         toast.error(error.message || "Gagal menghapus pengguna");
      }
    }
  };

  const handlePasswordReset = async (password: string) => {
    if (!userToReset) return;
    if (!canResetPasswords) {
      toast.error("Anda tidak memiliki izin untuk mereset password pengguna");
      return;
    }

    setIsResetSubmitting(true);
    try {
      await resetUserPassword(userToReset.id, password);
      toast.success("Password berhasil direset");
      if (currentUser) {
        logActivity(
          { id: currentUser.id, name: currentUser.name, role: currentUser.role },
          'UPDATE', 'Pengguna',
          `Mereset password pengguna: ${userToReset.name} (${userToReset.role})`,
          userToReset.id
        );
      }
      setIsResetOpen(false);
      setUserToReset(null);
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast.error(error.message || "Gagal mereset password");
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const getRoleBadgeColor = (role: Role) => {
    switch(normalizeRole(role) || role) {
      case 'Owner': return 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
      case 'Super Admin': return 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      case 'Admin PIC': return 'bg-pink-50 text-pink-700 border-pink-100 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800';
      case 'Teknisi': return 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
      case 'Finance': return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
      case 'CS': return 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'Advertiser': return 'bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800';
      default: return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  const getEmploymentStatusBadge = (status?: string) => {
    if (status === 'freelance') {
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800 text-[10px] px-1.5 ml-2">Freelance</Badge>;
    }
    return <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800 text-[10px] px-1.5 ml-2">Tetap</Badge>;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const formatDisplayId = (id: string) => {
    if (!id) return '-';
    if (id.length > 20 && id.includes('-')) {
       return `ID-${id.slice(-4).toUpperCase()}`;
    }
    if (id.startsWith('u')) {
       const num = id.substring(1);
       return `ID-${num.padStart(4, '0')}`;
    }
    return `ID-${id.toUpperCase()}`;
  };

  const handleWhatsAppRedirect = (user: User, targetNumber?: string) => {
    const whatsappNumber = targetNumber || user.phone || '';
    if (!whatsappNumber) {
        toast.error("Nomor WhatsApp tidak tersedia");
        return;
    }
    let formatted = whatsappNumber.replace(/\D/g, '');
    if (formatted.startsWith('0')) formatted = '62' + formatted.slice(1);
    
    const message = `Selamat Bergabung di RHI System
akses
URL : https://polesheadlamp-id.pages.dev/
Email : ${user.email || '-'}
Password : `;

    window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const renderContact = (item: User, compact = false) => {
    const whatsappNumber = item.phone || '';

    if (!whatsappNumber) {
      return compact ? null : <span className="text-xs text-slate-400 px-2">-</span>;
    }

    return (
      <div className={cn("flex flex-col", compact ? "items-end gap-1" : "items-start gap-1")}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleWhatsAppRedirect(item, whatsappNumber);
          }}
          className={cn(
            "group flex items-center gap-2 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-slate-600 dark:text-slate-400 hover:text-green-700 dark:hover:text-green-400",
            compact ? "px-2 py-1 text-xs font-medium" : "px-2 py-1",
          )}
        >
          <span className="text-xs font-mono">{whatsappNumber}</span>
          <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className={cn("opacity-70 group-hover:opacity-100 transition-opacity", compact ? "w-3.5 h-3.5" : "w-4 h-4")} alt="WA" />
        </button>
      </div>
    );
  };

  const renderCsOfficeContact = (item: User) => {
    const whatsappNumber = item.csWhatsappNumber || '';

    if (!whatsappNumber) {
      return <span className="text-xs text-slate-400 px-2">-</span>;
    }

    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleWhatsAppRedirect(item, whatsappNumber);
        }}
        className="group flex items-center gap-2 rounded-md px-2 py-1 text-slate-600 transition-colors hover:bg-green-50 hover:text-green-700 dark:text-slate-400 dark:hover:bg-green-900/20 dark:hover:text-green-400"
      >
        <span className="text-xs font-mono">{whatsappNumber}</span>
        <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="h-4 w-4 opacity-70 transition-opacity group-hover:opacity-100" alt="WA" />
      </button>
    );
  };

  const hasCustomAccess = (userId: string) => customAccessMap[userId] === true;

  const renderUserActionMenu = (item: User, triggerClassName: string) => {
    if (!canOpenAnyUserActionMenu) return null;

    const canEditThisUser = canEditUsers;
    const canResetThisUserPassword = canResetPasswords;
    const canDeleteThisUser = canDeleteUsers;
    const canManageThisUserAccess = canManageCustomAccess;
    const canConfigureAdvertiser = canManageAdvertiserConfig && isAdvertiserRole(item.role);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className={triggerClassName}>
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl p-1 z-50">
          <DropdownMenuLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-1.5">Aksi User</DropdownMenuLabel>
          {(canEditThisUser || canResetThisUserPassword || canManageThisUserAccess || canDeleteThisUser) && (
            <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
          )}

          {canEditThisUser && (
            <DropdownMenuItem onClick={() => { setEditingItem(item); setIsAddOpen(true); }} className="cursor-pointer text-slate-600 dark:text-slate-300 focus:bg-slate-50 dark:focus:bg-slate-800 rounded-lg px-2 py-2 mb-0.5">
              <Edit className="w-4 h-4 mr-2.5 text-blue-500" />
              <span className="font-medium">Edit Profil</span>
            </DropdownMenuItem>
          )}

          {canResetThisUserPassword && (
            <DropdownMenuItem onClick={() => { setUserToReset(item); setIsResetOpen(true); }} className="cursor-pointer text-slate-600 dark:text-slate-300 focus:bg-slate-50 dark:focus:bg-slate-800 rounded-lg px-2 py-2 mb-0.5">
              <Lock className="w-4 h-4 mr-2.5 text-slate-500" />
              <span className="font-medium">Reset Password</span>
            </DropdownMenuItem>
          )}

          {canConfigureAdvertiser && (
            <DropdownMenuItem onClick={() => {
              setSelectedAdvertiser(item);
              setIsAdvertiserConfigOpen(true);
            }} className="cursor-pointer text-slate-600 dark:text-slate-300 focus:bg-slate-50 dark:focus:bg-slate-800 rounded-lg px-2 py-2 mb-0.5">
              <Target className="w-4 h-4 mr-2.5 text-cyan-600" />
              <span className="font-medium">Konfigurasi Platform</span>
            </DropdownMenuItem>
          )}

          {canManageThisUserAccess && (
            <DropdownMenuItem onClick={() => {
              setPermUser({ id: item.id, name: item.name, role: item.role });
              setIsPermOpen(true);
            }} className="cursor-pointer text-slate-600 dark:text-slate-300 focus:bg-slate-50 dark:focus:bg-slate-800 rounded-lg px-2 py-2 mb-0.5">
              <Shield className="w-4 h-4 mr-2.5 text-purple-600" />
              <span className="font-medium">Custom Access</span>
            </DropdownMenuItem>
          )}

          {canDeleteThisUser && (
            <>
              <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
              <DropdownMenuItem className="text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-900/20 cursor-pointer rounded-lg px-2 py-2" onClick={() => setDeleteId(item.id)}>
                <Trash2 className="w-4 h-4 mr-2.5" />
                <span className="font-medium">Hapus User</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-8 pb-48 md:pb-32 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4 md:pb-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Pengguna & Akses</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-slate-500 text-xs md:text-sm">Manajemen akun staff dan hak akses sistem.</p>
                    <span className="hidden md:inline text-slate-300 mx-2">|</span>
                    <span className="text-slate-400 text-[10px] md:text-xs flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        <Users className="w-3 h-3" />
                        Total: {filteredSummaryUsers.length} Users
                    </span>
                </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                 {canCreateUsers && (
                    <Button 
                      className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white shadow-lg shadow-blue-200/50 dark:shadow-none"
                      onClick={() => {
                        setEditingItem(null);
                        setIsAddOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Tambah Pengguna
                    </Button>
                 )}
            </div>
        </div>

        {/* Global Stats Grid (Click to filter) */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 md:gap-4">
           {visibleRoleGroups.map((stat, index) => {
             const filterValue = getRoleForFilter(stat.role);
             const isActive = selectedRole === filterValue;
             const count = getRoleCount(stat.role);

             return (
                <button
                    key={index}
                    onClick={() => setSelectedRole(prev => prev === filterValue ? 'all' : filterValue)}
                    className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200 relative overflow-hidden group",
                        isActive 
                            ? `bg-white dark:bg-slate-900 ring-2 ring-blue-500 border-transparent shadow-md`
                            : `bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm`
                    )}
                >
                    <div className={cn("p-2 rounded-full mb-2 transition-colors", stat.bg, stat.color)}>
                        <stat.icon className="w-5 h-5" />
                    </div>
                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-0.5">{count}</span>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 tracking-wider text-center line-clamp-1">{stat.label}</span>
                    
                    {isActive && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    )}
                </button>
             )
           })}
        </div>

        {/* Global Toolbar */}
        <div className="flex flex-col md:flex-row justify-between gap-4 sticky top-4 z-30 bg-slate-50/95 dark:bg-slate-950/95 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row gap-3 w-full md:max-w-4xl">
                <div className="relative w-full sm:flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Cari user (nama, email, role, nomor)..."
                        className="pl-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-blue-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                        <Filter className="w-3.5 h-3.5 mr-2 text-slate-400" />
                        <SelectValue placeholder="Filter Role" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Role</SelectItem>
                        {visibleRoleGroups.map(s => (
                            <SelectItem key={s.label} value={getRoleForFilter(s.role)}>{s.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as User['status'] | 'all')}>
                    <SelectTrigger className="w-full sm:w-[200px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                        <Users className="w-3.5 h-3.5 mr-2 text-slate-400" />
                        <SelectValue placeholder="Status Karyawan" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="active">Aktif</SelectItem>
                        <SelectItem value="inactive">Nonaktif</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="icon" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600">
                    <Download className="w-4 h-4" />
                </Button>
            </div>
        </div>

        {/* Role Cards Section */}
        <div className="space-y-8">
            {visibleRoleGroups.map((group) => {
                const filterValue = getRoleForFilter(group.role);
                const isSelected = selectedRole === filterValue;
                
                // Show if "All" is selected OR if specifically selected
                if (selectedRole !== 'all' && !isSelected) return null;

                const groupUsers = getFilteredUsersByRole(group.role);

                // If searching, hide empty cards to reduce clutter. 
                // If not searching, hide empty cards unless specifically selected (to show "No data" state).
                if (groupUsers.length === 0 && search !== '') return null;
                if (groupUsers.length === 0 && selectedRole === 'all') return null;

                const isExpanded = expandedRoles[group.label] !== false; // Default true
                const isCsGroup = normalizeRole(getRoleForFilter(group.role)) === 'CS';

                return (
                    <Card key={group.label} className={cn("overflow-hidden border transition-shadow hover:shadow-md bg-white dark:bg-slate-900", group.border)}>
                        <CardHeader 
                            className={cn("py-4 px-6 flex flex-row items-center justify-between cursor-pointer select-none", group.headerBg)}
                            onClick={() => toggleRoleExpand(group.label)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-lg bg-white dark:bg-slate-900 shadow-sm", group.color)}>
                                    <group.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                                        {group.label}
                                        <Badge variant="secondary" className="bg-white/80 dark:bg-black/20 text-slate-600 dark:text-slate-300 ml-2">
                                            {groupUsers.length} User
                                        </Badge>
                                    </CardTitle>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-white/50 dark:hover:bg-black/20">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                        </CardHeader>
                        
                        {isExpanded && (
                            <CardContent className="p-0">
                                {/* Desktop Table View */}
                                <div className="hidden md:block overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="py-3 pl-6 w-[72px] font-semibold text-xs text-slate-500 uppercase">No</TableHead>
                                                <TableHead className="py-3 pl-6 w-[120px] font-semibold text-xs text-slate-500 uppercase">ID</TableHead>
                                                <TableHead className="py-3 w-[280px] font-semibold text-xs text-slate-500 uppercase">User Info</TableHead>
                                                <TableHead className="py-3 font-semibold text-xs text-slate-500 uppercase">Status</TableHead>
                                                <TableHead className="py-3 font-semibold text-xs text-slate-500 uppercase">Cabang</TableHead>
                                                <TableHead className="py-3 font-semibold text-xs text-slate-500 uppercase">Kontak</TableHead>
                                                {isCsGroup && (
                                                    <TableHead className="py-3 font-semibold text-xs text-slate-500 uppercase">No CS Kantor</TableHead>
                                                )}
                                                <TableHead className="py-3 font-semibold text-xs text-slate-500 uppercase text-right pr-6">Aksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {groupUsers.length > 0 ? (
                                                groupUsers.map((item, index) => (
                                                    <TableRow 
                                                        key={item.id} 
                                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer"
                                                        onClick={() => {
                                                            // Optional: Scroll to top or just open detail? For now just simple log or no-op
                                                        }}
                                                    >
                                                        <TableCell className="pl-6 py-4">
                                                            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                                                {index + 1}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="pl-6 py-4">
                                                            <span className="font-mono text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                                                {formatDisplayId(item.id)}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <div className="flex items-center gap-3">
                                                                <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-700">
                                                                    <AvatarImage src={item.avatar || ''} />
                                                                    <AvatarFallback className={cn("text-xs font-bold", group.bg, group.color)}>
                                                                        {getInitials(item.name)}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div className="flex flex-col min-w-0">
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <span className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{item.name}</span>
                                                                        {hasCustomAccess(item.id) && (
                                                                            <Badge variant="outline" className="h-5 shrink-0 border-amber-200 bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                                                                                Custom Access
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-xs text-slate-500 truncate">{item.email}</span>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 font-medium border", getRoleBadgeColor(item.role))}>
                                                                    {item.role}
                                                                </Badge>
                                                                {getEmploymentStatusBadge(item.employmentStatus)}
                                                                <span className={cn(
                                                                    "ml-1 inline-flex w-2 h-2 rounded-full",
                                                                    item.status === 'active' ? "bg-emerald-500" : "bg-slate-300"
                                                                )} title={item.status} />
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-400">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={cn("w-1.5 h-1.5 rounded-full", item.branchId ? "bg-blue-400" : "bg-slate-300")} />
                                                                {getBranchName(item.branchId)}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            {renderContact(item)}
                                                        </TableCell>
                                                        {isCsGroup && (
                                                            <TableCell className="py-4">
                                                                {renderCsOfficeContact(item)}
                                                            </TableCell>
                                                        )}
                                                        <TableCell className="py-4 pr-6 text-right">
                                                            {renderUserActionMenu(item, 'h-8 w-8 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200')}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={isCsGroup ? 8 : 7} className="h-24 text-center text-slate-400 italic bg-slate-50/20 dark:bg-slate-900/20">
                                                        Belum ada user untuk role ini.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Mobile List View */}
                                <div className="md:hidden">
                                    {groupUsers.length > 0 ? (
                                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {groupUsers.map((item, index) => (
                                                <div key={item.id} className="p-4 flex items-start gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                                                    <Avatar className="h-10 w-10 border border-slate-100 dark:border-slate-700 flex-shrink-0">
                                                        <AvatarImage src={item.avatar || ''} />
                                                        <AvatarFallback className={cn("text-xs font-bold", group.bg, group.color)}>
                                                            {getInitials(item.name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0 space-y-2">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate max-w-[140px] sm:max-w-xs">{item.name}</h4>
                                                                    {hasCustomAccess(item.id) && (
                                                                        <Badge variant="outline" className="h-5 shrink-0 border-amber-200 bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                                                                            Custom Access
                                                                        </Badge>
                                                                    )}
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 font-semibold border border-blue-100 dark:border-blue-900/40">
                                                                        #{index + 1}
                                                                    </span>
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono border border-slate-200 dark:border-slate-700">
                                                                        {formatDisplayId(item.id).replace('ID-', '')}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-500 truncate mt-0.5">{item.email}</p>
                                                            </div>
                                                            {renderUserActionMenu(item, 'h-7 w-7 -mr-2 text-slate-400')}
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 h-auto font-medium border", getRoleBadgeColor(item.role))}>
                                                                {item.role}
                                                            </Badge>
                                                            {getEmploymentStatusBadge(item.employmentStatus)}
                                                            <div className={cn("flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border", 
                                                                item.status === 'active' 
                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900" 
                                                                    : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                                                            )}>
                                                                <span className={cn("w-1.5 h-1.5 rounded-full", item.status === 'active' ? "bg-emerald-500" : "bg-slate-400")} />
                                                                {item.status === 'active' ? 'Aktif' : 'Nonaktif'}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-between pt-1">
                                                            <div className="flex items-center gap-3">
                                                                {item.branchId && (
                                                                    <span className="text-[11px] text-slate-500 flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                                                        {getBranchName(item.branchId)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {renderContact(item, true)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center text-slate-400 italic bg-slate-50/20 dark:bg-slate-900/20">
                                            Belum ada user untuk role ini.
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        )}
                    </Card>
                );
            })}
            
            {/* Empty State if no cards are shown */}
            {users.length > 0 && selectedRole === 'all' && hasToolbarFilters && !hasVisibleRoleResults && visibleRoleGroups.every(g => {
                const filtered = getFilteredUsersByRole(g.role);
                return filtered.length === 0;
            }) && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-3">
                        <Search className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Tidak ada hasil ditemukan</h3>
                    <p className="text-slate-500 max-w-sm">
                        Coba sesuaikan kata kunci pencarian atau ubah filter role dan status karyawan.
                    </p>
                </div>
            )}
        </div>

        {/* Dialogs */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
           <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-none shadow-2xl">
              <DialogHeader>
                 <DialogTitle>{editingItem ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}</DialogTitle>
                 <DialogDescription>
                    {editingItem ? 'Perbarui informasi profil pengguna.' : 'Lengkapi formulir untuk membuat akun baru.'}
                 </DialogDescription>
              </DialogHeader>
              <UserForm 
                  initialData={editingItem || undefined}
                  onSubmit={handleSubmit}
                  onCancel={() => setIsAddOpen(false)}
                  isSubmitting={isSubmitting}
                  branches={branches}
                  canResetPassword={canResetPasswords}
                  existingEmails={users
                    .filter((user) => user.id !== editingItem?.id)
                    .map((user) => user.email || '')
                    .filter(Boolean)}
              />
           </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
            <AlertDialogContent className="border-none shadow-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus Pengguna?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tindakan ini tidak dapat dibatalkan. Data pengguna dan hak akses akan dihapus permanen dari sistem.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} disabled={!canDeleteUsers} className="bg-red-600 hover:bg-red-700">
                  Hapus
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <PasswordResetDialog
            open={isResetOpen}
            onOpenChange={(open) => {
              setIsResetOpen(open);
              if (!open) setUserToReset(null);
            }}
            username={userToReset?.name || ''}
            onSubmit={handlePasswordReset}
            isSubmitting={isResetSubmitting}
        />
        
        {/* Permission Dialog */}
        <UserPermissionsDialog 
            isOpen={isPermOpen}
            onClose={() => setIsPermOpen(false)}
            userId={permUser?.id || ''}
            userName={permUser?.name || ''}
            userRole={permUser?.role || ''}
        />

        {/* Advertiser Access Modal */}
        <AdvertiserAccessModal 
            isOpen={isAdvertiserConfigOpen}
            onClose={() => setIsAdvertiserConfigOpen(false)}
            advertiser={selectedAdvertiser}
            platforms={platforms || []}
            subChannels={subChannels || []}
            users={users || []}
        />

      </div>
    </div>
  );
};

// Main Export
export default function UserManagementPage() {
    return <UserManagementContent />;
}
