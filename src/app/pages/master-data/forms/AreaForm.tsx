import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '../../../components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../../components/ui/select';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList
} from '../../../components/ui/command';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '../../../components/ui/popover';
import { MasterDataFormActions } from '../../../components/ui/master-data-ui';
import { Area, Branch, MOCK_BRANCHES } from '../data';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

const formSchema = z.object({
  name: z.string().min(1, "Nama daerah wajib diisi"),
  branchId: z.string().min(1, "Cabang wajib dipilih"),
  status: z.enum(['active', 'inactive']),
});

type FormValues = z.infer<typeof formSchema>;

interface AreaFormProps {
  item?: Area | null;
  branches: Branch[];
  onSubmit: (data: FormValues) => void;
  onCancel: () => void;
}

export const AreaForm: React.FC<AreaFormProps> = ({ item, branches, onSubmit, onCancel }) => {
  const [open, setOpen] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: item?.name || '',
      branchId: item?.branchId || '',
      status: item?.status || 'active',
    },
  });

  // Filter only active branches for the dropdown selection
  // This ensures new areas or updates can only be assigned to currently active branches
  const activeBranches = useMemo(() => {
    return branches.filter(b => b.status === 'active');
  }, [branches]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-4">
          {/* 1. Nama Daerah - Full Width */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Nama Daerah/Kecamatan <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input placeholder="Contoh: Cibinong" {...field} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 2. Induk Cabang - Searchable Dropdown (Active Only) */}
            <FormField
              control={form.control}
              name="branchId"
              render={({ field }) => (
                <FormItem className="flex flex-col space-y-2">
                  <FormLabel>Induk Cabang <span className="text-red-500">*</span></FormLabel>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={open}
                          className={cn(
                            "w-full justify-between bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-slate-200 shadow-sm font-normal text-left",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? branches.find((branch) => branch.id === field.value)?.name || "Cabang tidak aktif"
                            : "Pilih Cabang"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 z-[1000]" align="start">
                      <Command>
                        <CommandInput placeholder="Cari cabang..." />
                        <CommandList className="max-h-[200px] overflow-y-auto bg-white dark:bg-slate-900">
                          <CommandEmpty>Cabang tidak ditemukan.</CommandEmpty>
                          <CommandGroup>
                            {activeBranches.map((branch) => (
                              <CommandItem
                                key={branch.id}
                                value={branch.name}
                                onSelect={() => {
                                  form.setValue("branchId", branch.id, { 
                                    shouldValidate: true,
                                    shouldDirty: true 
                                  });
                                  setOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    branch.id === field.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {branch.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 3. Status - Dropdown */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-slate-200 shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-[200]">
                      <SelectItem value="active" className="focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer">Aktif</SelectItem>
                      <SelectItem value="inactive" className="focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer">Non Aktif</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <MasterDataFormActions onCancel={onCancel} saveLabel="Simpan Data" />
      </form>
    </Form>
  );
};
