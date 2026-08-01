import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Camera, Upload, Eye, EyeOff } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { MasterDataFieldLabel, MasterDataFormActions } from '../../components/ui/master-data-ui';
import { User, Role, MOCK_ROLES, Branch } from '../master-data/data';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { supabase } from '../../../lib/supabaseClient';
import { toast } from 'sonner';

import { buildMakeServerUrl } from '@/app/services/internal/functionsBaseUrl';
import { getSessionBackedEdgeHeaders } from '@/app/services/internal/sessionClientHeaders';

const getUserSchema = (isEdit: boolean) => z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  role: z.string().min(1, "Role wajib dipilih"),
  status: z.enum(['active', 'inactive']),
  employmentStatus: z.enum(['permanent', 'freelance', 'training']).optional(),
  password: isEdit  
    ? z.string().optional() 
    : z.string().min(6, "Password minimal 6 karakter"),
  branchId: z.string().optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().optional(),
  joinDate: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  emergencyPhone: z.string().optional(),
  csWhatsappNumber: z.string().optional(),
});

type UserFormValues = z.infer<ReturnType<typeof getUserSchema>>;

interface UserFormProps {
  id?: string; // Add ID prop for form linkage
  initialData?: User | null; // Changed from item to initialData to match usage
  item?: User | null; // Keep for compatibility if needed, but prefer initialData
  branches: Branch[];
  existingEmails?: string[]; // For client-side uniqueness check
  onSubmit: (data: any) => void;
  onCancel?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  isSubmitting?: boolean;
  canResetPassword?: boolean;
}

export const UserForm: React.FC<UserFormProps> = ({ id, initialData, item, branches, existingEmails = [], onSubmit, onCancel, onDirtyChange, isSubmitting, canResetPassword = true }) => {
  // Use initialData or item
  const dataToEdit = initialData || item;
  
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid' | 'taken'>('idle');
  const [emailMessage, setEmailMessage] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(dataToEdit?.avatar || null);
  
  const form = useForm<UserFormValues>({
    resolver: zodResolver(getUserSchema(!!dataToEdit)),
    defaultValues: {
      name: dataToEdit?.name || '',
      email: dataToEdit?.email || '',
      role: dataToEdit?.role || '',
      status: dataToEdit?.status || 'active',
      employmentStatus: dataToEdit?.employmentStatus || 'permanent',
      password: '',
      branchId: dataToEdit?.branchId || '',
      phone: dataToEdit?.phone || '',
      avatarUrl: dataToEdit?.avatar || '',
      joinDate: dataToEdit?.joinDate || '',
      bankName: dataToEdit?.bankName || '',
      bankAccountNumber: dataToEdit?.bankAccountNumber || '',
      emergencyPhone: dataToEdit?.emergencyPhone || '',
      csWhatsappNumber: dataToEdit?.csWhatsappNumber || '',
    },
  });

  // Update form values when dataToEdit prop changes
  useEffect(() => {
    if (dataToEdit) {
      form.reset({
        name: dataToEdit.name || '',
        email: dataToEdit.email || '',
        role: dataToEdit.role || '',
        status: dataToEdit.status || 'active',
        employmentStatus: dataToEdit.employmentStatus || 'permanent',
        password: '',
        branchId: dataToEdit.branchId || '',
        phone: dataToEdit.phone || '',
        avatarUrl: dataToEdit.avatar || '',
        joinDate: dataToEdit.joinDate || '',
        bankName: dataToEdit.bankName || '',
        bankAccountNumber: dataToEdit.bankAccountNumber || '',
        emergencyPhone: dataToEdit.emergencyPhone || '',
        csWhatsappNumber: dataToEdit.csWhatsappNumber || '',
      });
      setAvatarPreview(dataToEdit.avatar || null);
      // Reset email verification status when opening edit form
      setEmailStatus('idle');
      setEmailMessage('');
    } else {
      form.reset({
        name: '',
        email: '',
        role: '',
        status: 'active',
        employmentStatus: 'permanent',
        password: '',
        branchId: '',
        phone: '',
        avatarUrl: '',
        joinDate: '',
        bankName: '',
        bankAccountNumber: '',
        emergencyPhone: '',
        csWhatsappNumber: '',
      });
      setAvatarPreview(null);
      setEmailStatus('idle');
      setEmailMessage('');
    }
  }, [dataToEdit, form]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran foto maksimal 2MB");
      return;
    }

    setIsUploading(true);
    try {
      // 1. DELETE OLD AVATAR IF EXISTS
      const currentAvatarUrl = form.getValues('avatarUrl');
      if (currentAvatarUrl && currentAvatarUrl.includes('/avatars/')) {
          try {
              // Extract filename robustly
              const urlObj = new URL(currentAvatarUrl);
              const pathParts = urlObj.pathname.split('/avatars/');
              if (pathParts.length > 1) {
                  const oldPath = decodeURIComponent(pathParts[1]); // Handle spaces/special chars
                  console.log("Menghapus foto lama:", oldPath);
                  
                  const { error: delError } = await supabase.storage.from('avatars').remove([oldPath]);
                  
                  if (delError) {
                      console.error("Gagal hapus foto lama (Check Storage Policies):", delError);
                  }
              }
          } catch (err) {
              console.error("Error processing old avatar URL:", err);
          }
      }

      // 2. UPLOAD NEW AVATAR
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      setAvatarPreview(data.publicUrl);
      form.setValue('avatarUrl', data.publicUrl);
      toast.success("Foto berhasil diupload");
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error("Gagal mengupload foto", { description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const checkEmail = async (email: string) => {
    if (!email) {
      setEmailStatus('idle');
      setEmailMessage('');
      return;
    }

    // 1. Syntax Check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailStatus('invalid');
      setEmailMessage('Format email tidak valid');
      return;
    }

    // 2. Uniqueness Check (Client-side from props)
    if (existingEmails.includes(email) && email !== dataToEdit?.email) {
      setEmailStatus('taken');
      setEmailMessage('Email sudah terdaftar');
      return;
    }

    setEmailStatus('checking');
    
    // 3. Server-side MX Record Check (Real verification)
    try {
        const res = await fetch(buildMakeServerUrl('/verify-email'), {
            method: 'POST',
            headers: await getSessionBackedEdgeHeaders({ includeJsonContentType: true }),
            body: JSON.stringify({ email })
        });
        
        const data = await res.json();
        
        if (data.valid) {
            setEmailStatus('valid');
            setEmailMessage('✓ Email valid dan aktif (MX Record ditemukan)');
        } else {
            setEmailStatus('invalid');
            // Give specific reason if available
            if (data.reason === 'Disposable email detected') {
                 setEmailMessage('✕ Gunakan email resmi (Temporary email ditolak)');
            } else if (data.reason && data.reason.includes('MX')) {
                 setEmailMessage('✕ Domain tidak valid atau tidak bisa menerima email');
            } else {
                 setEmailMessage('✕ Email tidak valid');
            }
        }

    } catch (e) {
        // Fallback if server error (don't block user)
        console.error("Verification failed", e);
        setEmailStatus('valid'); // Assume valid to not block
        setEmailMessage('✓ Format valid (Pengecekan server gagal)');
    }
  };

  const selectedRole = form.watch('role');
  const isCsRole = selectedRole === 'CS';

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  const handleFormSubmit = (values: UserFormValues) => {
    const payload =
      values.role === 'CS'
        ? {
            ...values,
            csDisplayName: '',
            csAssignmentStatus: 'available' as const,
            csMaxActiveChats: 25,
            csNotes: '',
          }
        : {
            ...values,
            csWhatsappNumber: '',
            csDisplayName: '',
            csAssignmentStatus: 'available' as const,
            csMaxActiveChats: 25,
            csNotes: '',
          };

    onSubmit(payload);
  };

  return (
    <Form {...form}>
      <form id={id} onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4" autoComplete="off">
        
        {/* Avatar Upload Section */}
        <div className="flex flex-col items-center justify-center mb-6 gap-3">
            <div className="relative group cursor-pointer" onClick={() => document.getElementById('avatar-upload')?.click()}>
                <Avatar className="w-24 h-24 border-4 border-slate-100 dark:border-slate-800 shadow-sm">
                    <AvatarImage src={avatarPreview || ''} className="object-cover" />
                    <AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 text-3xl">
                        {form.getValues('name') ? form.getValues('name').substring(0, 1).toUpperCase() : <Camera className="w-8 h-8 opacity-50" />}
                    </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-8 h-8 text-white" />
                </div>
                {isUploading && (
                  <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
            </div>
            <div className="flex flex-col items-center">
                <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs gap-2"
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                    disabled={isUploading}
                >
                    <Upload className="w-3 h-3" />
                    {avatarPreview ? 'Ganti Foto' : 'Upload Foto'}
                </Button>
                <p className="text-[10px] text-slate-400 mt-1">Maks. 2MB (JPG, PNG)</p>
            </div>
            <Input 
                id="avatar-upload" 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleImageUpload}
            />
            {/* Hidden field for form data */}
            <input type="hidden" {...form.register('avatarUrl')} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({field}) => (
              <FormItem>
                <FormLabel>Nama Lengkap <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input placeholder="Contoh: Budi Santoso" {...field} className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm" autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({field}) => (
              <FormItem>
                <FormLabel>Email <span className="text-red-500">*</span></FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="Contoh: budi@rhi.id" 
                      {...field} 
                      className={`bg-white shadow-sm pr-10 ${
                        emailStatus === 'valid' ? 'border-green-500 focus:ring-green-500' :
                        emailStatus === 'invalid' || emailStatus === 'taken' ? 'border-red-500 focus:ring-red-500' :
                        'border-slate-200'
                      }`}
                      autoComplete="new-password" 
                      onBlur={(e) => {
                        field.onBlur();
                        checkEmail(e.target.value);
                      }}
                      onChange={(e) => {
                        field.onChange(e);
                        if (emailStatus !== 'idle') setEmailStatus('idle');
                      }}
                    />
                  </FormControl>
                  <div className="absolute right-3 top-2.5">
                    {emailStatus === 'checking' && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
                    {emailStatus === 'valid' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    {emailStatus === 'invalid' && <XCircle className="h-5 w-5 text-red-500" />}
                    {emailStatus === 'taken' && <AlertCircle className="h-5 w-5 text-orange-500" />}
                  </div>
                </div>
                {emailStatus !== 'idle' && (
                  <p className={`text-[11px] mt-1 ${
                    emailStatus === 'valid' ? 'text-green-600' : 
                    emailStatus === 'taken' ? 'text-orange-600' : 'text-red-600'
                  }`}>
                    {emailMessage}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({field}) => (
              <FormItem>
                <FormLabel>No. WhatsApp</FormLabel>
                <FormControl>
                  <Input placeholder="Contoh: 081234567890" {...field} className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm" autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="emergencyPhone"
            render={({field}) => (
              <FormItem>
                <FormLabel>No. HP Darurat</FormLabel>
                <FormControl>
                  <Input placeholder="Contoh: 081234567890" {...field} className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm" autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="joinDate"
            render={({field}) => (
              <FormItem>
                <FormLabel>Tanggal Masuk</FormLabel>
                <FormControl>
                  <Input type="date" {...field} className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="employmentStatus"
            render={({field}) => (
              <FormItem>
                <FormLabel>Status Kepegawaian</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-slate-200 shadow-sm">
                      <SelectValue placeholder="Pilih Status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-xl rounded-xl z-[9999]">
                    <SelectItem value="permanent" className="focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer">
                       Karyawan Tetap
                    </SelectItem>
                    <SelectItem value="freelance" className="focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer">
                       Freelance / Mitra
                    </SelectItem>
                    <SelectItem value="training" className="focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer">
                       Training
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="bankName"
            render={({field}) => (
              <FormItem>
                <FormLabel>Nama Bank</FormLabel>
                <FormControl>
                   <Input placeholder="Contoh: BCA / Mandiri" {...field} className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm" autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bankAccountNumber"
            render={({field}) => (
              <FormItem>
                <FormLabel>No. Rekening</FormLabel>
                <FormControl>
                   <Input placeholder="Contoh: 1234567890" {...field} className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm" autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <FormField
            control={form.control}
            name="role"
            render={({field}) => (
              <FormItem>
                <FormLabel>Role <span className="text-red-500">*</span></FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-slate-200 shadow-sm">
                      <SelectValue placeholder="Pilih Role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-xl rounded-xl z-[9999]">
                    {MOCK_ROLES.map((role) => (
                      <SelectItem key={role.id} value={role.name} className="focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer">
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="branchId"
            render={({field}) => (
              <FormItem>
                <FormLabel>Cabang (Opsional)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-slate-200 shadow-sm">
                      <SelectValue placeholder="Pilih Cabang" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-xl rounded-xl z-[9999]">
                    <SelectItem value="none_branch" className="text-slate-500 focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer italic">
                      -- Tidak ada cabang --
                    </SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id} className="focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer">
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="status"
          render={({field}) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:ring-slate-200 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-xl rounded-xl z-[9999]">
                  <SelectItem value="active" className="focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer">Aktif</SelectItem>
                  <SelectItem value="inactive" className="focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer">Non Aktif</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {isCsRole && (
          <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
            <FormField
              control={form.control}
              name="csWhatsappNumber"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Nomor WA CS Kantor</FormLabel>
                  <FormControl>
                    <Input placeholder="Contoh: 6285700000000" {...field} className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm" autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

          {!dataToEdit && (
             <FormField
             control={form.control}
             name="password"
             render={({field}) => (
               <FormItem>
                 <MasterDataFieldLabel required>Password</MasterDataFieldLabel>
                 <div className="relative">
                   <FormControl>
                     <Input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="Masukan password" 
                        {...field} 
                        className="bg-white border-slate-200 shadow-sm pr-10" 
                        autoComplete="new-password" 
                     />
                   </FormControl>
                   <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-slate-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-slate-400" />
                      )}
                    </Button>
                 </div>
                 <FormMessage />
               </FormItem>
             )}
           />
          )}

          {dataToEdit && canResetPassword && (
             <FormField
             control={form.control}
             name="password"
             render={({field}) => (
               <FormItem>
                 <MasterDataFieldLabel
                  info={{
                    title: 'Reset Password',
                    description: 'Isi hanya jika ingin mengganti password pengguna ini. Kosongkan agar password lama tetap dipakai.',
                  }}
                 >
                  Reset Password
                 </MasterDataFieldLabel>
                 <div className="relative">
                   <FormControl>
                     <Input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="Kosongkan jika tidak ingin mengubah password" 
                        {...field} 
                        className="bg-white border-slate-200 shadow-sm pr-10" 
                        autoComplete="new-password" 
                     />
                   </FormControl>
                   <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-slate-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-slate-400" />
                      )}
                    </Button>
                 </div>
                 <FormMessage />
               </FormItem>
             )}
           />
          )}
        
        {onCancel && (
          <MasterDataFormActions
            className="mt-8"
            isSubmitting={isSubmitting}
            onCancel={onCancel}
            submitDisabled={emailStatus === 'invalid' || emailStatus === 'taken'}
          />
        )}

      </form>
    </Form>
  );
};
