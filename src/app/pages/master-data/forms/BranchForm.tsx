import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '../../../components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../../components/ui/select';
import { MasterDataFormActions } from '../../../components/ui/master-data-ui';
import { Branch } from '../data';
import { MapCard, BranchPoint } from '../../../components/ui/MapCard';

const formSchema = z.object({
  name: z.string().min(1, "Nama cabang wajib diisi"),
  code: z.string().min(1, "Kode cabang wajib diisi"),
  city: z.string().min(1, "Kota wajib diisi"),
  address: z.string().min(1, "Alamat wajib diisi"),
  radius: z.coerce.number().min(1, "Radius wajib diisi"),
  mapsUrl: z.string().min(1, "Maps URL wajib diisi"),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  status: z.enum(['active', 'inactive', 'coming_soon']),
  openingDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface BranchFormProps {
  item?: Branch | null;
  existingBranches?: Branch[];
  onDirtyChange?: (isDirty: boolean) => void;
  onSubmit: (data: FormValues) => Promise<void> | void;
  onCancel: () => void;
}

export const BranchForm: React.FC<BranchFormProps> = ({ item, existingBranches = [], onDirtyChange, onSubmit, onCancel }) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: item?.name || '',
      code: item?.code || '',
      city: item?.city || '',
      address: item?.address || '',
      radius: item?.radius || 0,
      mapsUrl: item?.mapsUrl || '',
      lat: item?.lat || 0,
      lng: item?.lng || 0,
      status: item?.status || 'active',
      openingDate: item?.openingDate || '',
    },
  });

  // Watch status for conditional rendering
  const statusValue = form.watch("status");

  // Auto-generate code from name
  const nameValue = form.watch("name");
  
  // Watch Maps URL for auto-extraction
  const mapsUrlValue = form.watch("mapsUrl");

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  useEffect(() => {
    if (mapsUrlValue) {
      // Try to extract lat/lng from URL
      const patterns = [
          /@(-?\d+\.\d+),(-?\d+\.\d+)/,
          /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
          /search\/.*\/(-?\d+\.\d+),(-?\d+\.\d+)/
      ];

      for (const pattern of patterns) {
          const match = mapsUrlValue.match(pattern);
          if (match) {
              const lat = parseFloat(match[1]);
              const lng = parseFloat(match[2]);
              
              form.setValue('lat', lat);
              form.setValue('lng', lng);
              break;
          }
      }
    }
  }, [mapsUrlValue, form]);
  
  useEffect(() => {
    // Only generate code if adding new item and name exists
    if (!item && nameValue) {
      const cleanName = nameValue.replace(/[^a-zA-Z]/g, '');
      let baseCode = '';

      if (cleanName.length >= 3) {
        baseCode = cleanName.substring(0, 3).toUpperCase();
      } else if (cleanName.length > 0) {
        baseCode = cleanName.toUpperCase();
      }

      if (baseCode) {
        // Find existing codes that start with this baseCode
        const regex = new RegExp(`^${baseCode}-(\\d+)$`);
        let maxSuffix = 0;

        existingBranches.forEach(branch => {
          if (branch.code) {
             const match = branch.code.match(regex);
             if (match) {
               const suffix = parseInt(match[1], 10);
               if (suffix > maxSuffix) {
                 maxSuffix = suffix;
               }
             }
          }
        });

        // Generate next suffix
        const nextSuffix = (maxSuffix + 1).toString().padStart(2, '0');
        const generatedCode = `${baseCode}-${nextSuffix}`;
        
        form.setValue('code', generatedCode);
      }
    }
  }, [nameValue, item, form, existingBranches]);

  // Watch values for live preview
  const watchedLat = form.watch("lat");
  const watchedLng = form.watch("lng");
  const watchedRadius = form.watch("radius");
  const watchedName = form.watch("name");
  const watchedCode = form.watch("code");
  const watchedAddress = form.watch("address");

  // Construct preview branch object for map
  const previewBranch: BranchPoint | null = (watchedLat && watchedLng) ? {
    id: 'preview',
    name: watchedName || 'Preview Cabang',
    code: watchedCode || 'NEW',
    lat: watchedLat,
    lng: watchedLng,
    radius: watchedRadius || 0,
    address: watchedAddress
  } : null;

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const normalizedValues: FormValues = {
        ...values,
        openingDate:
          values.status === 'coming_soon' && values.openingDate?.trim()
            ? values.openingDate
            : undefined,
      };

      await onSubmit(normalizedValues);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nama Cabang <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input placeholder="Contoh: Bogor" {...field} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kode Cabang <span className="text-slate-400 text-xs font-normal">(Auto)</span></FormLabel>
                <FormControl>
                  <Input 
                    placeholder="BOG-01" 
                    {...field} 
                    readOnly 
                    className="bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kota <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Contoh: Bogor" {...field} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Alamat Lengkap <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Contoh: Jl. Raya Bogor KM 42..." 
                  {...field} 
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 min-h-[80px]" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="mapsUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Maps URL <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input placeholder="https://maps.google.com/..." {...field} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
              </FormControl>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Tempel link Google Maps, lat/lng diisi otomatis oleh backend.</p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="lat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Latitude</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="-6.xxxxx" 
                    {...field} 
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" 
                    step="any"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lng"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Longitude</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="106.xxxxx" 
                    {...field} 
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    step="any" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="radius"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Radius (KM) <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input type="number" placeholder="25" {...field} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
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
                  <SelectContent>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Non Aktif</SelectItem>
                    <SelectItem value="coming_soon">Coming Soon</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {statusValue === 'coming_soon' && (
           <FormField
            control={form.control}
            name="openingDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estimasi Tanggal Buka</FormLabel>
                <FormControl>
                  <Input type="date" {...field} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Map Preview Section - Moved to bottom */}
        {previewBranch && (
          <div className="mt-4 mb-2 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
             <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Preview Lokasi & Radius</span>
                <span className="text-xs text-blue-600 font-medium">
                  {watchedRadius} KM = {(watchedRadius * 0.621371).toFixed(1)} Miles
                </span>
             </div>
             <MapCard 
               branches={[previewBranch]} 
               height="250px" 
               showLegend={false}
               className="border-0 rounded-none"
             />
             <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-[10px] border-t border-yellow-100 dark:border-yellow-800/30">
               <span className="font-bold">Info:</span> Garis radius adalah jarak lurus (udara). Jarak tempuh jalan bisa 1.5x - 2x lebih jauh.
             </div>
          </div>
        )}

        <MasterDataFormActions confirmOnCancel={form.formState.isDirty} isSubmitting={isSubmitting} onCancel={onCancel} />
      </form>
    </Form>
  );
};
