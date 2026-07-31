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
import { AdSource, INITIAL_AD_ACCOUNTS, MOCK_USERS } from '../data';

const formSchema = z.object({
  name: z.string().min(1, "Nama sumber wajib diisi"),
  adAccountId: z.string().min(1, "Akun iklan wajib dipilih"),
  defaultCsName: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

type FormValues = z.infer<typeof formSchema>;

interface AdSourceFormProps {
  item?: AdSource | null;
  onSubmit: (data: FormValues) => void;
  onCancel: () => void;
}

export const AdSourceForm: React.FC<AdSourceFormProps> = ({ item, onSubmit, onCancel }) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: item?.name || '',
      adAccountId: item?.adAccountId || '',
      defaultCsName: item?.defaultCsName || '',
      status: item?.status || 'active',
    },
  });

  // Filter users who are CS
  const csUsers = MOCK_USERS.filter(u => u.role === 'CS');

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
          name="adAccountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Akun Iklan <span className="text-red-500">*</span></FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <SelectValue placeholder="Pilih Akun Iklan" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {INITIAL_AD_ACCOUNTS.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Campaign / Sumber <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Contoh: IG - Promo Merdeka" {...field} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="defaultCsName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default CS (Opsional)</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <SelectValue placeholder="Pilih CS" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {csUsers.map((cs) => (
                    <SelectItem key={cs.name} value={cs.name}>
                      {cs.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <SelectContent>
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
