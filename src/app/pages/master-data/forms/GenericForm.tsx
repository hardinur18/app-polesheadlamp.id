import React, { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '../../../components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { Button } from '../../../components/ui/button';
import { MasterDataFieldLabel, MasterDataFormActions } from '../../../components/ui/master-data-ui';
import { PlatformLogo } from '../../../components/ui/platform-logo';
import { BankLogo } from '../../../components/ui/bank-logo';
import { SimpleMasterItem, VehicleType, PaymentMethod, Platform } from '../data';
import { getVehicleNameValidationMessage } from '../vehicleValidation';
import { validatePlatformLogoFile } from '@/app/services/platformLogoService';
import { validateBankLogoFile } from '@/app/services/bankLogoService';

interface GenericFormProps {
  type: 'vehicle' | 'payment' | 'simple' | 'sub_channel' | 'vendor' | 'platform'; // To determine extra fields
  item?: SimpleMasterItem | VehicleType | PaymentMethod | any | null;
  label?: string;
  onDirtyChange?: (isDirty: boolean) => void;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  hideDescription?: boolean;
  platforms?: Platform[];
}

export const GenericForm: React.FC<GenericFormProps> = ({ type, item, label, onDirtyChange, onSubmit, onCancel, hideDescription, platforms }) => {
  const logoInputId = React.useId();
  const isMediaForm = type === 'platform' || type === 'payment';
  const fieldLabel = label || (type === 'payment' ? 'Akun Bank' : 'Item');
  const inputClassName = 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm';
  const selectClassName = 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-slate-200 shadow-sm';
  const selectContentClassName = 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-[9999]';
  const selectItemClassName = 'focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer';
  
  const formSchema = useMemo(() => {
    let schema = z.object({
      name: z.string().min(1, "Nama wajib diisi"),
      description: z.string().optional(),
      status: z.enum(['active', 'inactive']),
      category: z.string().optional(),
      accountNumber: z.string().optional(),
      accountHolder: z.string().optional(),
      platformId: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      logoFile: z.any().optional(),
      removeLogo: z.boolean().optional(),
    });

    if (type === 'vehicle') {
      return schema.extend({
        name: z.string()
          .min(1, "Nama wajib diisi")
          .refine((value) => !getVehicleNameValidationMessage(value), {
            message: 'Nama tipe mobil terlihat seperti chat/catatan customer.',
          }),
        category: z.string().min(1, "Kategori wajib dipilih"),
      });
    }

    if (type === 'payment') {
      return schema.extend({
        accountNumber: z.string().min(1, "Nomor Rekening wajib diisi"),
        accountHolder: z.string().min(1, "Atas Nama wajib diisi"),
      });
    }

    if (type === 'sub_channel') {
      return schema.extend({
        platformId: z.string().min(1, "Platform wajib dipilih"),
      });
    }

    if (type === 'vendor') {
        return schema.extend({
            // Optional fields
        });
    }

    return schema;
  }, [type]);

  type GenericFormValues = z.infer<typeof formSchema>;

  const form = useForm<GenericFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: (item as any)?.name || (item as any)?.bankName || '',
      description: (item as any)?.description || '',
      category: (item as VehicleType)?.category || undefined,
      accountNumber: (item as PaymentMethod)?.accountNumber || '',
      accountHolder: (item as PaymentMethod)?.accountHolder || '',
      platformId: (item as any)?.platformId || undefined,
      phone: (item as any)?.phone || '',
      address: (item as any)?.address || '',
      status: item?.status || 'active',
    },
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = React.useState('');

  React.useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  React.useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    };
  }, [logoPreviewUrl]);

  const handleSubmit = async (values: GenericFormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="masterDataForm">
        <div className={type === 'payment' ? 'masterDataFormGrid' : undefined}>
          <FormField
            control={form.control}
            name="name"
            render={({field}) => (
              <FormItem className={isMediaForm ? 'md:col-span-2' : undefined}>
                <FormLabel asChild>
                  <MasterDataFieldLabel
                    required
                    info={type === 'payment' ? {
                      title: 'Nama akun bank',
                      description: 'Isi nama bank atau label akun bank yang muncul di table pembayaran.',
                    } : undefined}
                  >
                    Nama {fieldLabel}
                  </MasterDataFieldLabel>
                </FormLabel>
                <FormControl>
                  <Input placeholder={`Nama ${fieldLabel}...`} {...field} className={inputClassName} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        {isMediaForm && (
          <FormField
            control={form.control}
            name="logoFile"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel asChild>
                  <MasterDataFieldLabel
                    info={{
                      title: `Logo ${type === 'payment' ? 'bank' : 'platform'}`,
                      description: 'File baru akan mengganti logo lama pada path ID yang sama, sehingga storage tidak menumpuk gambar duplikat.',
                    }}
                  >
                    Logo {type === 'payment' ? 'Bank' : 'Platform'}
                  </MasterDataFieldLabel>
                </FormLabel>
                <div className="platformLogoUploader">
                  {type === 'payment' ? (
                    <BankLogo
                      logoPath={logoPreviewUrl || (form.watch('removeLogo') ? '' : (item as any)?.logoPath)}
                      name={form.watch('name') || (item as any)?.bankName || 'Bank'}
                    />
                  ) : (
                    <PlatformLogo
                      logoPath={logoPreviewUrl || (form.watch('removeLogo') ? '' : (item as any)?.logoPath)}
                      name={form.watch('name') || (item as any)?.name || 'Platform'}
                    />
                  )}
                  <div className="platformLogoUploaderText">
                    <strong>{field.value ? field.value.name : (item as any)?.logoPath && !form.watch('removeLogo') ? 'Logo sudah tersimpan' : 'Belum ada logo'}</strong>
                    <span>PNG, JPG, WebP, atau SVG. Maksimal 1.5 MB.</span>
                    <div className="platformLogoUploaderActions">
                      <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById(logoInputId)?.click()}>
                        Pilih Logo
                      </Button>
                      {(field.value || ((item as any)?.logoPath && !form.watch('removeLogo'))) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
                            setLogoPreviewUrl('');
                            field.onChange(undefined);
                            form.setValue('removeLogo', true as never, { shouldDirty: true });
                          }}
                        >
                          Hapus Logo
                        </Button>
                      )}
                    </div>
                  </div>
                  <input
                    id={logoInputId}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (!file) return;
                      const validationMessage = type === 'payment'
                        ? validateBankLogoFile(file)
                        : validatePlatformLogoFile(file);
                      if (validationMessage) {
                        form.setError('logoFile' as never, { message: validationMessage });
                        return;
                      }
                      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
                      setLogoPreviewUrl(URL.createObjectURL(file));
                      form.clearErrors('logoFile' as never);
                      form.setValue('removeLogo', false as never, { shouldDirty: true });
                      field.onChange(file);
                    }}
                  />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {type === 'sub_channel' && platforms && (
          <FormField
            control={form.control}
            name="platformId"
            render={({field}) => (
              <FormItem>
                <FormLabel>Platform Iklan <span className="text-red-500">*</span></FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className={selectClassName}>
                      <SelectValue placeholder="Pilih Platform" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className={selectContentClassName}>
                    {platforms.map((p) => (
                      <SelectItem key={p.id} value={p.id} className={selectItemClassName}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {type === 'vehicle' && (
          <FormField
            control={form.control}
            name="category"
            render={({field}) => (
              <FormItem>
                <FormLabel>Kategori Size <span className="text-red-500">*</span></FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className={selectClassName}>
                      <SelectValue placeholder="Pilih Kategori" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className={selectContentClassName}>
                    <SelectItem value="small" className={selectItemClassName}>Small (City Car)</SelectItem>
                    <SelectItem value="medium" className={selectItemClassName}>Medium (MPV/Sedan)</SelectItem>
                    <SelectItem value="large" className={selectItemClassName}>Large (SUV)</SelectItem>
                    <SelectItem value="luxury" className={selectItemClassName}>Luxury / Big MPV</SelectItem>
                    <SelectItem value="motor" className={selectItemClassName}>Motorcycle</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {type === 'payment' && (
          <>
            <FormField
              control={form.control}
              name="accountNumber"
              render={({field}) => (
                <FormItem>
                  <FormLabel asChild>
                    <MasterDataFieldLabel
                      required
                      info={{
                        title: 'Nomor rekening',
                        description: 'Nomor rekening disimpan sebagai referensi pembayaran internal. Gunakan angka tanpa spasi jika memungkinkan.',
                      }}
                    >
                      Nomor Rekening
                    </MasterDataFieldLabel>
                  </FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" placeholder="1234567890" {...field} className={inputClassName} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accountHolder"
              render={({field}) => (
                <FormItem>
                  <FormLabel asChild>
                    <MasterDataFieldLabel
                      required
                      info={{
                        title: 'Pemilik rekening',
                        description: 'Nama pemilik rekening yang dipakai untuk validasi transfer dan tampilan instruksi pembayaran.',
                      }}
                    >
                      Atas Nama
                    </MasterDataFieldLabel>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="PT RHI" {...field} className={inputClassName} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {type === 'vendor' && (
          <>
            <FormField
              control={form.control}
              name="phone"
              render={({field}) => (
                <FormItem>
                  <FormLabel>No. Telepon / WA</FormLabel>
                  <FormControl>
                    <Input placeholder="08123456789" {...field} className={inputClassName} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Alamat</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Alamat Lengkap" {...field} className={inputClassName} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {!hideDescription && type !== 'vendor' && type !== 'payment' && (
        <FormField
          control={form.control}
          name="description"
          render={({field}) => (
            <FormItem>
              <FormLabel>Deskripsi</FormLabel>
              <FormControl>
                <Textarea placeholder="Deskripsi (Opsional)" {...field} className={inputClassName} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        )}

        <FormField
          control={form.control}
          name="status"
          render={({field}) => (
            <FormItem className={isMediaForm ? 'md:col-span-2' : undefined}>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className={selectClassName}>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className={selectContentClassName}>
                  <SelectItem value="active" className={selectItemClassName}>Aktif</SelectItem>
                  <SelectItem value="inactive" className={selectItemClassName}>Non Aktif</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        </div>

        <MasterDataFormActions
          isSubmitting={isSubmitting}
          onCancel={onCancel}
          confirmOnCancel={form.formState.isDirty}
          saveLabel="Simpan Data"
        />
      </form>
    </Form>
  );
};
