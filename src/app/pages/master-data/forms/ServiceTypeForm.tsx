import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '../../../components/ui/input';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '../../../components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../../components/ui/select';
import { MasterDataFormActions } from '../../../components/ui/master-data-ui';
import { ServiceType } from '../data';

const formSchema = z.object({
  name: z.string().min(1, "Nama layanan wajib diisi"),
  category: z.string().min(1, "Kategori wajib dipilih"),
  price: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  status: z.enum(['active', 'inactive']),
});

type FormValues = z.infer<typeof formSchema>;

interface ServiceTypeFormProps {
  item?: ServiceType | null;
  onSubmit: (data: FormValues) => void;
  onCancel: () => void;
}

export const ServiceTypeForm: React.FC<ServiceTypeFormProps> = ({ item, onSubmit, onCancel }) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: item?.name || '',
      category: item?.category || '',
      price: item?.price || 0,
      status: item?.status || 'active',
    },
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Layanan <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Contoh: Nano Burn Coating" {...field} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kategori <span className="text-red-500">*</span></FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <SelectValue placeholder="Pilih Kategori" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[9999]">
                  <SelectItem value="Restoration">Restoration</SelectItem>
                  <SelectItem value="Modification">Modification</SelectItem>
                  <SelectItem value="Cleaning">Cleaning</SelectItem>
                  <SelectItem value="Repair">Repair</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Harga Layanan (Rp) <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  placeholder="0" 
                  {...field} 
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[9999]">
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="inactive">Non Aktif</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <MasterDataFormActions isSubmitting={isSubmitting} onCancel={onCancel} />
      </form>
    </Form>
  );
};
