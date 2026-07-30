import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';
import { User, UserRole, UserStatus, ROLE_LABELS, STATUS_LABELS } from '../../types/user';
import { UserIcon, Shield, Building2 } from 'lucide-react';

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User; // If provided, edit mode. If null, create mode.
  onSubmit: (data: Partial<User> & { password?: string }) => void;
}

export const UserFormDialog: React.FC<UserFormDialogProps> = ({ open, onOpenChange, user, onSubmit }) => {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<Partial<User> & { password?: string }>();

  useEffect(() => {
    if (open) {
      if (user) {
        // Edit mode
        reset({
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          status: user.status,
          branch: user.branch,
          phone: user.phone,
        });
      } else {
        // Create mode
        reset({
          role: 'technician',
          status: 'active',
          branch: 'Pusat',
        });
      }
    }
  }, [open, user, reset]);

  const onFormSubmit = (data: any) => {
    onSubmit(data);
    onOpenChange(false);
  };

  const isEditMode = !!user;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {isEditMode ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Perbarui informasi dan hak akses pengguna.' 
              : 'Lengkapi formulir di bawah untuk membuat akun pengguna baru.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-8 py-6">
          {/* Section: Personal Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 mb-2">
              <UserIcon className="w-4 h-4" />
              <h4>Informasi Pribadi</h4>
            </div>
            
            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nama Lengkap <span className="text-red-500">*</span></Label>
                <Input
                  id="fullName"
                  placeholder="Contoh: Budi Santoso"
                  className="h-10"
                  {...register('fullName', { required: 'Nama lengkap wajib diisi' })}
                />
                 {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message as string}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="email">Alamat Email <span className="text-red-500">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                   className="h-10"
                  {...register('email', { required: 'Email wajib diisi' })}
                />
                 {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message as string}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Nomor Telepon</Label>
                <Input
                  id="phone"
                  placeholder="0812xxxx"
                   className="h-10"
                  {...register('phone')}
                />
              </div>
            </div>
          </div>

          <Separator className="bg-slate-100 dark:bg-slate-800" />

          {/* Section: Access & Role */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 mb-2">
              <Shield className="w-4 h-4" />
              <h4>Akses & Keamanan</h4>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="username">Username <span className="text-red-500">*</span></Label>
                <Input
                  id="username"
                  placeholder="username_login"
                   className="h-10 bg-slate-50 dark:bg-slate-800/50"
                  {...register('username', { required: 'Username wajib diisi' })}
                  disabled={isEditMode}
                />
                {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message as string}</p>}
                {isEditMode && <p className="text-[10px] text-slate-400 dark:text-slate-500">Username tidak dapat diubah</p>}
              </div>

              {!isEditMode && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimal 8 karakter"
                     className="h-10"
                    {...register('password', { 
                      required: 'Password wajib diisi untuk pengguna baru',
                      minLength: { value: 8, message: 'Password minimal 8 karakter' }
                    })}
                  />
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message as string}</p>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="role">Role Pengguna <span className="text-red-500">*</span></Label>
                <Select
                  onValueChange={(val) => setValue('role', val as UserRole)}
                  defaultValue={user?.role || 'technician'}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Pilih Role" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900">
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status Akun <span className="text-red-500">*</span></Label>
                <Select
                  onValueChange={(val) => setValue('status', val as UserStatus)}
                  defaultValue={user?.status || 'active'}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Pilih Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900">
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
               <div className="flex items-center gap-2 mb-1">
                 <Building2 className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                 <Label htmlFor="branch">Cabang Operasional</Label>
               </div>
              <Input
                id="branch"
                placeholder="Contoh: Pusat, Jakarta Selatan, Bandung..."
                 className="h-10"
                {...register('branch')}
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Kosongkan jika berlaku untuk semua cabang (Global)</p>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-10 px-6">
              Batal
            </Button>
            <Button type="submit" className="h-10 px-6 bg-blue-600 hover:bg-blue-700">
              {isEditMode ? 'Simpan Perubahan' : 'Buat Pengguna'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
