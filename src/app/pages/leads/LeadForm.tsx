import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible";
import { cn } from "../../components/ui/utils";
import { Check, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { DialogFooter } from '../../components/ui/dialog';
import { Lead, Branch, Platform, VehicleType, User, SubChannel } from '../master-data/data';
import { useMasterData } from '../master-data/context';
import { LEAD_SOCIAL_PLATFORM_OPTIONS, getLeadSocialPlatformLabel } from './socialContact';
import { isAdminManagementRole, isAdvertiserRole, isCsRole } from '@/app/data/roleHelpers';

const leadSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  phone: z.string().min(1, "Nomor HP wajib diisi"),
  platformId: z.string().optional(),
  subChannelId: z.string().optional(),
  advertiserId: z.string().optional(),
  vehicleId: z.string().optional(),
  csId: z.string().optional(),
  status: z.enum(['Pending', 'Follow Up', 'Booking', 'Closing', 'Cancel']),
  notes: z.string().optional(),
  socialPlatform: z.enum(['instagram', 'tiktok']).optional(),
  socialUsername: z.string().optional(),
  socialProfileUrl: z.string().optional(),
  socialChatUrl: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadSchema>;

interface LeadFormProps {
  item?: Lead | null;
  platforms: Platform[];
  subChannels?: SubChannel[];
  vehicles: VehicleType[];
  advertiserUsers: User[];
  csUsers: User[]; // List of CS users
  currentUser?: User; // The currently logged in user
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export const LeadForm: React.FC<LeadFormProps> = ({ 
  item, 
  platforms, 
  subChannels: propSubChannels,
  vehicles, 
  advertiserUsers, 
  csUsers,
  currentUser,
  onSubmit, 
  onCancel 
}) => {
  const { subChannels: contextSubChannels, advertiserConfigs } = useMasterData();
  const subChannels = propSubChannels || contextSubChannels || [];
  
  const [openVehicle, setOpenVehicle] = useState(false);
  const [openSocialHelp, setOpenSocialHelp] = useState(false);

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: item?.name || '',
      phone: item?.phone || '',
      platformId: item?.platformId || '',
      subChannelId: item?.subChannelId || '',
      advertiserId: item?.advertiserId || '',
      vehicleId: item?.vehicleId || '',
      csId: item?.csId || '',
      status: item?.status || 'Pending',
      notes: item?.notes || '',
      socialPlatform: item?.socialPlatform || undefined,
      socialUsername: item?.socialUsername || '',
      socialProfileUrl: item?.socialProfileUrl || '',
      socialChatUrl: item?.socialChatUrl || '',
    },
  });

  // Watchers
  const selectedPlatformId = form.watch('platformId');
  const selectedAdvertiserId = form.watch('advertiserId');
  const selectedSocialPlatform = form.watch('socialPlatform');
  
  const isCSLogin = isCsRole(currentUser?.role);
  const isAdvertiserLogin = isAdvertiserRole(currentUser?.role);

  // --- FILTERING LOGIC (ADVERTISER CONFIG) ---

  // 1. Filtered Advertisers (For CS Role)
  const filteredAdvertisers = useMemo(() => {
      // If Admin/Owner/Super Admin, show all. 
      // If Advertiser, show only self.
      // If CS, only show advertisers assigned to me.
      if (isCSLogin && currentUser) {
          const myAdvertiserIds = advertiserConfigs
              .filter(cfg => cfg.csIds.includes(currentUser.id))
              .map(cfg => cfg.advertiserId);
          
          if (myAdvertiserIds.length > 0) {
              return advertiserUsers.filter(a => myAdvertiserIds.includes(a.id));
          }
          return advertiserUsers; 
      }
      return advertiserUsers;
  }, [advertiserUsers, isCSLogin, currentUser, advertiserConfigs]);

  // 2. Active Config for selected Advertiser
  const activeConfig = useMemo(() => {
      // Priority 1: Form Selection
      if (selectedAdvertiserId && selectedAdvertiserId !== 'none_advertiser') {
         return advertiserConfigs.find(c => c.advertiserId === selectedAdvertiserId);
      }
      // Priority 2: Current User (if Advertiser)
      if (isAdvertiserRole(currentUser?.role)) {
         return advertiserConfigs.find(c => c.advertiserId === currentUser.id);
      }
      return null;
  }, [selectedAdvertiserId, advertiserConfigs, currentUser]);

  // 3. Filtered Platforms
  const filteredPlatforms = useMemo(() => {
      // RULE 1: Admins -> All Active
      if (isAdminManagementRole(currentUser?.role)) {
          return platforms.filter(p => p.status === 'active');
      }

      // Helper for Mandatory
      const mandatoryPlatformNames = ['repeat order', 'organik'];
      const mandatoryPlatforms = platforms.filter(p => mandatoryPlatformNames.includes(p.name.toLowerCase()));

      // RULE 2: Config Based (Advertiser OR CS selecting Advertiser)
      if (activeConfig) {
           const allowedIds = activeConfig.platformIds || [];
           const allowedPlatforms = platforms.filter(p => allowedIds.includes(p.id));
           
           if (isAdvertiserRole(currentUser?.role)) {
               return allowedPlatforms;
            } else {
               const combined = [...allowedPlatforms, ...mandatoryPlatforms];
               return Array.from(new Map(combined.map(p => [p.id, p])).values());
           }
      }

      // RULE 3: CS (No specific Advertiser selected yet)
      if (isCsRole(currentUser?.role)) {
          const myConfigs = advertiserConfigs.filter(cfg => cfg.csIds?.includes(currentUser.id));
          if (myConfigs.length > 0) {
              const allowedIds = new Set<string>();
              myConfigs.forEach(cfg => cfg.platformIds?.forEach(id => allowedIds.add(id)));
              const allowedPlatforms = platforms.filter(p => allowedIds.has(p.id));
              const combined = [...allowedPlatforms, ...mandatoryPlatforms];
              return Array.from(new Map(combined.map(p => [p.id, p])).values());
          }
          // Fallback if no config: Just Mandatory + Active? Or All?
          // Safer to show Mandatory + Active to avoid blockage.
          const combined = [...platforms.filter(p => p.status === 'active'), ...mandatoryPlatforms];
          return Array.from(new Map(combined.map(p => [p.id, p])).values());
      }

      // Fallback for Advertiser with NO CONFIG -> Allow All Active (Safety net)
      if (isAdvertiserRole(currentUser?.role)) {
          return platforms.filter(p => p.status === 'active');
      }

      return platforms.filter(p => p.status === 'active');
  }, [platforms, activeConfig, isCSLogin, currentUser, advertiserConfigs]);

  // 4. Filtered SubChannels
  const filteredSubChannels = useMemo(() => {
    let scs = subChannels;
    
    // Filter by Config (Strict)
    if (activeConfig) {
        if (activeConfig.subChannelIds && activeConfig.subChannelIds.length > 0) {
            scs = scs.filter(s => activeConfig.subChannelIds!.includes(s.id));
        }
    } 

    // Filter by Platform
    if (selectedPlatformId && selectedPlatformId !== 'none_platform') {
       scs = scs.filter(sc => sc.platformId === selectedPlatformId);
    } else if (selectedPlatformId === 'none_platform') {
       return [];
    }
    
    return scs.filter(s => s.status === 'active');
  }, [selectedPlatformId, subChannels, activeConfig, currentUser]);

  // 5. Filtered CS
  const filteredCS = useMemo(() => {
      // Admins see all
      if (isAdminManagementRole(currentUser?.role)) {
          return csUsers;
      }
      
      // Advertiser sees ONLY assigned
      if (isAdvertiserRole(currentUser?.role)) {
          if (activeConfig) {
             if (activeConfig.csIds && activeConfig.csIds.length > 0) {
                 return csUsers.filter(c => activeConfig.csIds!.includes(c.id));
             }
             return []; // Config exists but empty -> Empty CS
          }
          return csUsers; // No Config -> Show All (Safety net)
      }
      
      // CS selection logic (if applicable)
      if (activeConfig && activeConfig.csIds && activeConfig.csIds.length > 0) {
          return csUsers.filter(c => activeConfig.csIds!.includes(c.id));
      }
      
      return csUsers;
  }, [csUsers, activeConfig, currentUser]);

  // Reset subChannelId when platformId changes
  useEffect(() => {
    if (selectedPlatformId !== item?.platformId) {
       const currentSub = form.getValues('subChannelId');
       if (currentSub) {
          const isValid = filteredSubChannels.some(sc => sc.id === currentSub);
          if (!isValid) {
             form.setValue('subChannelId', '');
          }
       }
    }
  }, [selectedPlatformId, filteredSubChannels, form, item]);

  // Auto-fill logic
  useEffect(() => {
    if (!item && currentUser && isCsRole(currentUser.role)) {
      form.setValue('csId', currentUser.id);
    }
    if (!item && currentUser && isAdvertiserRole(currentUser.role)) {
      form.setValue('advertiserId', currentUser.id);
    }
  }, [currentUser, item, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        {/* Row 1: Name & Phone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({field}) => (
              <FormItem>
                <FormLabel>Nama Prospek <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input placeholder="Contoh: Budi Santoso" {...field} className="bg-white border-slate-200 shadow-sm" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({field}) => (
              <FormItem>
                <FormLabel>Nomor Whatsapp <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input placeholder="Contoh: 08123456789" {...field} className="bg-white border-slate-200 shadow-sm" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <Collapsible open={openSocialHelp} onOpenChange={setOpenSocialHelp} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">Kontak Sosial</h3>
                  <span className="text-[11px] font-medium text-slate-400">Opsional</span>
                </div>
              </div>

              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  aria-label="Lihat panduan kontak sosial"
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      openSocialHelp && "rotate-180"
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
                <p>Isi username tanpa simbol "@".</p>
                <p>Link room chat dipakai kalau kamu punya URL DM yang spesifik.</p>
                <p>Kalau link profil kosong, sistem otomatis pakai username sebagai fallback.</p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="socialPlatform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform Sosial</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === 'none_social_platform' ? undefined : value)}
                    value={field.value || 'none_social_platform'}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-white border-slate-200 focus:ring-slate-200 shadow-sm">
                        <SelectValue placeholder="Pilih platform sosial" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white border-slate-200 shadow-xl rounded-xl z-[9999]">
                      <SelectItem
                        value="none_social_platform"
                        className="text-slate-500 focus:bg-slate-50 cursor-pointer italic"
                      >
                        -- Tidak ada akun sosial --
                      </SelectItem>
                      {LEAD_SOCIAL_PLATFORM_OPTIONS.map((platform) => (
                        <SelectItem
                          key={platform.value}
                          value={platform.value}
                          className="focus:bg-slate-50 cursor-pointer"
                        >
                          {platform.label}
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
              name="socialUsername"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Username {selectedSocialPlatform ? getLeadSocialPlatformLabel(selectedSocialPlatform) : 'Sosial'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Contoh: restorationheadlamp"
                      {...field}
                      className="bg-white border-slate-200 shadow-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="socialChatUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link Room Chat (Opsional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Contoh: instagram.com/direct/..."
                      {...field}
                      className="bg-white border-slate-200 shadow-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="socialProfileUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link Profil (Opsional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Contoh: instagram.com/namauser"
                      {...field}
                      className="bg-white border-slate-200 shadow-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Row 2: Source & Vehicle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="platformId"
            render={({field}) => (
              <FormItem>
                <FormLabel>Sumber (Opsional)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-white border-slate-200 focus:ring-slate-200 shadow-sm">
                      <SelectValue placeholder="Pilih Sumber" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white border-slate-200 shadow-xl rounded-xl z-[9999]">
                    <SelectItem value="none_platform" className="text-slate-500 focus:bg-slate-50 cursor-pointer italic">
                      -- Tidak ada sumber --
                    </SelectItem>
                    {filteredPlatforms.map((platform) => (
                      <SelectItem key={platform.id} value={platform.id} className="focus:bg-slate-50 cursor-pointer">
                        {platform.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {selectedPlatformId && selectedPlatformId !== 'none_platform' && filteredSubChannels.length > 0 && (
            <FormField
              control={form.control}
              name="subChannelId"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Sub Channel</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white border-slate-200 focus:ring-slate-200 shadow-sm">
                        <SelectValue placeholder="Pilih Sub Channel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white border-slate-200 shadow-xl rounded-xl z-[9999]">
                      {filteredSubChannels.map((sc) => (
                        <SelectItem key={sc.id} value={sc.id} className="focus:bg-slate-50 cursor-pointer">
                          {sc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="vehicleId"
            render={({field}) => (
              <FormItem className="flex flex-col">
                <FormLabel>Mobil (Opsional)</FormLabel>
                <Popover open={openVehicle} onOpenChange={setOpenVehicle}>
                   <PopoverTrigger asChild>
                     <FormControl>
                       <Button
                         type="button"
                         variant="outline"
                         role="combobox"
                         aria-expanded={openVehicle}
                         className={cn(
                           "w-full justify-between bg-white border-slate-200 shadow-sm",
                           !field.value && "text-muted-foreground"
                         )}
                       >
                         {field.value
                           ? vehicles.find((v) => v.id === field.value)?.name
                           : "Pilih Mobil"}
                         <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                       </Button>
                     </FormControl>
                   </PopoverTrigger>
                   <PopoverContent className="w-[300px] p-0 border-slate-200 dark:border-slate-800" align="start">
                     <Command>
                       <CommandInput placeholder="Cari mobil..." />
                       <CommandList>
                         <CommandEmpty>Mobil tidak ditemukan.</CommandEmpty>
                         <CommandGroup>
                           <CommandItem
                             value="none_vehicle"
                             onSelect={() => {
                               form.setValue('vehicleId', '');
                               setOpenVehicle(false);
                             }}
                             className="text-slate-500 italic"
                           >
                             <Check
                               className={cn(
                                 "mr-2 h-4 w-4",
                                 !field.value ? "opacity-100" : "opacity-0"
                               )}
                             />
                             -- Tidak ada mobil --
                           </CommandItem>
                           {vehicles.map((vehicle) => (
                             <CommandItem
                               value={vehicle.name}
                               key={vehicle.id}
                               onSelect={() => {
                                 form.setValue('vehicleId', vehicle.id);
                                 setOpenVehicle(false);
                               }}
                             >
                               <Check
                                 className={cn(
                                   "mr-2 h-4 w-4",
                                   vehicle.id === field.value ? "opacity-100" : "opacity-0"
                                 )}
                               />
                               {vehicle.name}
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
        </div>

        {/* Row 3: CS (Conditional) & Branch */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="csId"
            render={({field}) => (
              <FormItem>
                <FormLabel>Customer Service / Staff</FormLabel>
                {isCSLogin ? (
                  // If CS Login: Show Input ReadOnly
                  <FormControl>
                    <div className="relative">
                      <Input 
                        value={currentUser?.name || ''} 
                        readOnly 
                        className="bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed shadow-sm" 
                      />
                      <input type="hidden" {...field} />
                    </div>
                  </FormControl>
                ) : (
                  // If Admin/Owner Login: Show Dropdown
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white border-slate-200 focus:ring-slate-200 shadow-sm">
                        <SelectValue placeholder="Pilih Staff CS" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white border-slate-200 shadow-xl rounded-xl z-[9999]">
                      <SelectItem value="none_cs" className="text-slate-500 focus:bg-slate-50 cursor-pointer italic">
                        -- Belum ditentukan --
                      </SelectItem>
                      {filteredCS.map((user) => (
                        <SelectItem key={user.id} value={user.id} className="focus:bg-slate-50 cursor-pointer">
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="advertiserId"
            render={({field}) => (
              <FormItem>
                <FormLabel>Advertiser (Opsional)</FormLabel>
                {isAdvertiserLogin ? (
                  <FormControl>
                    <div className="relative">
                      <Input 
                        value={currentUser?.name || ''} 
                        readOnly 
                        className="bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed shadow-sm" 
                      />
                      <input type="hidden" {...field} />
                    </div>
                  </FormControl>
                ) : (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-white border-slate-200 focus:ring-slate-200 shadow-sm">
                      <SelectValue placeholder="Pilih Advertiser" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white border-slate-200 shadow-xl rounded-xl z-[9999]">
                    <SelectItem value="none_advertiser" className="text-slate-500 focus:bg-slate-50 cursor-pointer italic">
                      -- Tidak ada advertiser --
                    </SelectItem>
                    {filteredAdvertisers.map((user) => (
                      <SelectItem key={user.id} value={user.id} className="focus:bg-slate-50 cursor-pointer">
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Row 4: Status */}
        <div className="grid grid-cols-1 gap-4">
           <FormField
            control={form.control}
            name="status"
            render={({field}) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                {field.value === 'Closing' ? (
                   <FormControl>
                     <div className="relative">
                        <Input value="Closing (Sudah jadi Pesanan)" readOnly className="bg-emerald-50 border-emerald-200 text-emerald-700 font-medium cursor-not-allowed shadow-sm" />
                        <input type="hidden" {...field} />
                     </div>
                   </FormControl>
                ) : (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white border-slate-200 focus:ring-slate-200 shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white border-slate-200 shadow-xl rounded-xl z-[9999]">
                      {['Pending', 'Follow Up', 'Booking', 'Cancel'].map((status) => (
                        <SelectItem key={status} value={status} className="focus:bg-slate-50 cursor-pointer">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({field}) => (
            <FormItem>
              <FormLabel>Catatan</FormLabel>
              <FormControl>
                <Textarea placeholder="Tambahkan catatan..." {...field} className="bg-white border-slate-200 shadow-sm" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter className="mt-6 gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onCancel} className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 w-full sm:w-auto">
            Batal
          </Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 shadow-sm w-full sm:w-auto">
            {item ? 'Simpan Perubahan' : 'Tambah Prospek'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};
