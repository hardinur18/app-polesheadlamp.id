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
import { TechnicianTeam, MOCK_BRANCHES, MOCK_USERS } from '../data';

const formSchema = z.object({
  name: z.string().min(1, "Nama tim wajib diisi"),
  branchId: z.string().min(1, "Cabang wajib dipilih"),
  leaderId: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

type FormValues = z.infer<typeof formSchema>;

interface TechnicianTeamFormProps {
  item?: TechnicianTeam | null;
  onSubmit: (data: FormValues) => void;
  onCancel: () => void;
}

export const TechnicianTeamForm: React.FC<TechnicianTeamFormProps> = ({ item, onSubmit, onCancel }) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: item?.name || '',
      branchId: item?.branchId || '',
      leaderId: item?.leaderId || '',
      status: item?.status || 'active',
    },
  });

  // Filter users who are Technicians
  const technicians = MOCK_USERS.filter(u => u.role === 'Teknisi');

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
          name="branchId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cabang <span className="text-red-500">*</span></FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <SelectValue placeholder="Pilih Cabang" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {MOCK_BRANCHES.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
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
              <FormLabel>Nama Tim <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Contoh: Tim A - Bogor" {...field} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="leaderId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ketua Tim (Opsional)</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <SelectValue placeholder="Pilih Ketua Tim" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name}
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
