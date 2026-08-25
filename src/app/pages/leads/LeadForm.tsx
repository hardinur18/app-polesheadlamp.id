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
import {
  MasterDataDialogBody,
  MasterDataFormActions,
} from '../../components/ui/master-data-ui';
import {
  AdAccount,
  AdAccountAssignment,
  Lead,
  Platform,
  SubChannel,
  User,
  VehicleType,
} from '../master-data/data';
import { useMasterData } from '../master-data/context';
import { getTodayDateKey } from '../master-data/dateKeys';
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

const NONE_ADVERTISER = 'none_advertiser';
const NONE_PLATFORM = 'none_platform';
const NONE_SUBCHANNEL = 'none_subchannel';
const NONE_CS = 'none_cs';
const NONE_SOCIAL_PLATFORM = 'none_social_platform';

const uniqueById = <T extends { id: string }>(items: T[]) =>
  Array.from(new Map(items.map((item) => [item.id, item])).values());

const normalizeSelectValue = (value?: string, noneValue?: string) =>
  !value || value === noneValue ? '' : value;

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
  const {
    subChannels: contextSubChannels,
    advertiserConfigs,
    adAccounts,
    adAccountAssignments,
    adAccountOwnerAssignments,
  } = useMasterData();
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
  const selectedSubChannelId = form.watch('subChannelId');
  const selectedAdvertiserId = form.watch('advertiserId');
  const selectedSocialPlatform = form.watch('socialPlatform');
  
  const isCSLogin = isCsRole(currentUser?.role);
  const isAdvertiserLogin = isAdvertiserRole(currentUser?.role);
  const todayKey = getTodayDateKey();
  const originalAdvertiserId = item?.advertiserId || '';
  const originalPlatformId = item?.platformId || '';
  const originalSubChannelId = item?.subChannelId || '';
  const originalCsId = item?.csId || '';
  const normalizedSelectedAdvertiserId = normalizeSelectValue(selectedAdvertiserId, NONE_ADVERTISER);
  const normalizedSelectedPlatformId = normalizeSelectValue(selectedPlatformId, NONE_PLATFORM);
  const normalizedSelectedSubChannelId = normalizeSelectValue(selectedSubChannelId, NONE_SUBCHANNEL);
  const preserveOriginalPlatform = Boolean(item) && normalizedSelectedAdvertiserId === originalAdvertiserId;
  const preserveOriginalSubChannel = preserveOriginalPlatform && normalizedSelectedPlatformId === originalPlatformId;
  const preserveOriginalCs =
    preserveOriginalSubChannel && normalizedSelectedSubChannelId === originalSubChannelId;

  const isActiveAssignmentPeriod = (assignment: { startDate?: string | null; endDate?: string | null; status?: string | null }) => {
    if (assignment.status && assignment.status !== 'active') return false;
    if (assignment.startDate && assignment.startDate > todayKey) return false;
    if (assignment.endDate && assignment.endDate < todayKey) return false;
    return true;
  };

  const activeAdAccounts = useMemo(
    () => adAccounts.filter((account) => account.status === 'active'),
    [adAccounts],
  );

  const activeOwnerByAccountId = useMemo(() => {
    const map = new Map<string, string>();
    [...adAccountOwnerAssignments]
      .filter(isActiveAssignmentPeriod)
      .sort((left, right) => right.startDate.localeCompare(left.startDate))
      .forEach((assignment) => {
        if (!map.has(assignment.adAccountId)) {
          map.set(assignment.adAccountId, assignment.advertiserId);
        }
      });
    return map;
  }, [adAccountOwnerAssignments, todayKey]);

  const activeCsAssignmentsByAccountId = useMemo(() => {
    const map = new Map<string, AdAccountAssignment[]>();
    adAccountAssignments
      .filter(isActiveAssignmentPeriod)
      .forEach((assignment) => {
        const list = map.get(assignment.adAccountId) || [];
        list.push(assignment);
        map.set(assignment.adAccountId, list);
      });
    return map;
  }, [adAccountAssignments, todayKey]);

  const getAccountAdvertiserId = (account: AdAccount) => activeOwnerByAccountId.get(account.id) || account.advertiserId;

  const getScopedAdAccounts = (advertiserId?: string) => {
    let accounts = activeAdAccounts;

    if (isAdvertiserLogin && currentUser) {
      accounts = accounts.filter((account) => getAccountAdvertiserId(account) === currentUser.id);
    } else if (isCSLogin && currentUser) {
      accounts = accounts.filter((account) =>
        (activeCsAssignmentsByAccountId.get(account.id) || []).some((assignment) => assignment.csId === currentUser.id),
      );
    }

    if (advertiserId && advertiserId !== NONE_ADVERTISER) {
      accounts = accounts.filter((account) => getAccountAdvertiserId(account) === advertiserId);
    }

    return accounts;
  };

  const getAccountSubChannelIds = (accounts: AdAccount[]) => {
    const ids = new Set<string>();

    accounts.forEach((account) => {
      if (account.subChannelId) ids.add(account.subChannelId);
      (activeCsAssignmentsByAccountId.get(account.id) || []).forEach((assignment) => {
        if (assignment.subChannelId) ids.add(assignment.subChannelId);
      });
    });

    return ids;
  };

  // --- FILTERING LOGIC (AD ACCOUNT FOUNDATION + LEGACY FALLBACK) ---

  // 1. Filtered Advertisers (For CS Role)
  const filteredAdvertisers = useMemo(() => {
    const includeSelectedAdvertiser = (items: User[]) => {
      if (!selectedAdvertiserId || selectedAdvertiserId === NONE_ADVERTISER) return items;
      if (items.some((advertiser) => advertiser.id === selectedAdvertiserId)) return items;

      const selected = advertiserUsers.find((advertiser) => advertiser.id === selectedAdvertiserId);
      return selected ? uniqueById([...items, selected]) : items;
    };

    const accountScopedAdvertisers = getScopedAdAccounts();
    if (accountScopedAdvertisers.length > 0) {
      const advertiserIds = new Set(
        accountScopedAdvertisers
          .map(getAccountAdvertiserId)
          .filter(Boolean),
      );
      const fromAdAccounts = advertiserUsers.filter((advertiser) => advertiserIds.has(advertiser.id));
      if (fromAdAccounts.length > 0) return includeSelectedAdvertiser(fromAdAccounts);
    }

    // Legacy safety net: keep the old access config behavior if account assignments are not ready yet.
    if (isCSLogin && currentUser) {
      const myAdvertiserIds = advertiserConfigs
        .filter(cfg => cfg.csIds.includes(currentUser.id))
        .map(cfg => cfg.advertiserId);

      if (myAdvertiserIds.length > 0) {
        return includeSelectedAdvertiser(advertiserUsers.filter(a => myAdvertiserIds.includes(a.id)));
      }
      return advertiserUsers;
    }
    return includeSelectedAdvertiser(advertiserUsers);
  }, [
    activeAdAccounts,
    activeCsAssignmentsByAccountId,
    activeOwnerByAccountId,
    advertiserConfigs,
    advertiserUsers,
    currentUser,
    isAdvertiserLogin,
    isCSLogin,
    selectedAdvertiserId,
  ]);

  // 2. Active Config for selected Advertiser
  const activeConfig = useMemo(() => {
      // Priority 1: Form Selection
      if (selectedAdvertiserId && selectedAdvertiserId !== NONE_ADVERTISER) {
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
      const includeOriginalPlatform = (items: Platform[]) => {
        if (!preserveOriginalPlatform || !originalPlatformId) return items;
        if (items.some((platform) => platform.id === originalPlatformId)) return items;

        const original = platforms.find((platform) => platform.id === originalPlatformId);
        return original ? uniqueById([...items, original]) : items;
      };
      const mandatoryPlatformNames = ['repeat order', 'organik'];
      const mandatoryPlatforms = platforms.filter(p => p.status === 'active' && mandatoryPlatformNames.includes(p.name.toLowerCase()));
      const scopedAccounts = getScopedAdAccounts(selectedAdvertiserId);

      if (scopedAccounts.length > 0) {
        const platformIds = new Set(scopedAccounts.map((account) => account.platformId).filter(Boolean));
        const accountPlatforms = platforms.filter((platform) => platform.status === 'active' && platformIds.has(platform.id));
        const combined = isAdvertiserRole(currentUser?.role)
          ? accountPlatforms
          : [...accountPlatforms, ...mandatoryPlatforms];
        const uniquePlatforms = uniqueById(combined);

        if (uniquePlatforms.length > 0) return includeOriginalPlatform(uniquePlatforms);
      }

      // RULE 1: Admins -> All Active
      if (isAdminManagementRole(currentUser?.role)) {
          return includeOriginalPlatform(platforms.filter(p => p.status === 'active'));
      }

      // RULE 2: Config Based (Advertiser OR CS selecting Advertiser)
      if (activeConfig) {
           const allowedIds = activeConfig.platformIds || [];
           const allowedPlatforms = platforms.filter(p => allowedIds.includes(p.id));
           
           if (isAdvertiserRole(currentUser?.role)) {
               return includeOriginalPlatform(allowedPlatforms);
            } else {
               const combined = [...allowedPlatforms, ...mandatoryPlatforms];
               return includeOriginalPlatform(uniqueById(combined));
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
              return includeOriginalPlatform(uniqueById(combined));
          }
          // Fallback if no config: Just Mandatory + Active? Or All?
          // Safer to show Mandatory + Active to avoid blockage.
          const combined = [...platforms.filter(p => p.status === 'active'), ...mandatoryPlatforms];
          return includeOriginalPlatform(uniqueById(combined));
      }

      // Fallback for Advertiser with NO CONFIG -> Allow All Active (Safety net)
      if (isAdvertiserRole(currentUser?.role)) {
          return includeOriginalPlatform(platforms.filter(p => p.status === 'active'));
      }

      return includeOriginalPlatform(platforms.filter(p => p.status === 'active'));
  }, [
    activeAdAccounts,
    activeConfig,
    activeCsAssignmentsByAccountId,
    activeOwnerByAccountId,
    advertiserConfigs,
    currentUser,
    originalPlatformId,
    platforms,
    preserveOriginalPlatform,
    selectedAdvertiserId,
  ]);

  // 4. Filtered SubChannels
  const filteredSubChannels = useMemo(() => {
    const includeOriginalSubChannel = (items: SubChannel[]) => {
      if (!preserveOriginalSubChannel || !originalSubChannelId) return items;
      if (items.some((subChannel) => subChannel.id === originalSubChannelId)) return items;

      const original = subChannels.find((subChannel) => subChannel.id === originalSubChannelId);
      return original ? uniqueById([...items, original]) : items;
    };
    let scs = subChannels.filter(s => s.status === 'active');

    // Filter by Platform
    if (selectedPlatformId && selectedPlatformId !== NONE_PLATFORM) {
       scs = scs.filter(sc => sc.platformId === selectedPlatformId);
    } else if (selectedPlatformId === NONE_PLATFORM) {
       return [];
    }

    const scopedAccounts = getScopedAdAccounts(selectedAdvertiserId)
      .filter((account) => !selectedPlatformId || selectedPlatformId === NONE_PLATFORM || account.platformId === selectedPlatformId);
    const accountSubChannelIds = getAccountSubChannelIds(scopedAccounts);

    if (accountSubChannelIds.size > 0) {
      return includeOriginalSubChannel(scs.filter((subChannel) => accountSubChannelIds.has(subChannel.id)));
    }

    // Legacy safety net for advertiser configs that have not been migrated into account assignments.
    if (activeConfig?.subChannelIds && activeConfig.subChannelIds.length > 0) {
      scs = scs.filter(s => activeConfig.subChannelIds!.includes(s.id));
    }
    
    return includeOriginalSubChannel(scs);
  }, [
    activeAdAccounts,
    activeConfig,
    activeCsAssignmentsByAccountId,
    activeOwnerByAccountId,
    currentUser,
    originalSubChannelId,
    preserveOriginalSubChannel,
    selectedAdvertiserId,
    selectedPlatformId,
    subChannels,
  ]);

  // 5. Filtered CS
  const filteredCS = useMemo(() => {
      const includeOriginalCs = (items: User[]) => {
        if (!preserveOriginalCs || !originalCsId) return items;
        if (items.some((cs) => cs.id === originalCsId)) return items;

        const original = csUsers.find((cs) => cs.id === originalCsId);
        return original ? uniqueById([...items, original]) : items;
      };
      const scopedAccounts = getScopedAdAccounts(selectedAdvertiserId)
        .filter((account) =>
          (!selectedPlatformId || selectedPlatformId === NONE_PLATFORM || account.platformId === selectedPlatformId) &&
          (!selectedSubChannelId || selectedSubChannelId === NONE_SUBCHANNEL || (
            account.subChannelId === selectedSubChannelId ||
            (activeCsAssignmentsByAccountId.get(account.id) || []).some((assignment) => assignment.subChannelId === selectedSubChannelId)
          )),
        );
      const accountCsIds = new Set<string>();
      scopedAccounts.forEach((account) => {
        (activeCsAssignmentsByAccountId.get(account.id) || []).forEach((assignment) => {
          if (assignment.csId) accountCsIds.add(assignment.csId);
        });
      });

      if (accountCsIds.size > 0) {
        return includeOriginalCs(csUsers.filter((cs) => accountCsIds.has(cs.id)));
      }

      // Admins see all
      if (isAdminManagementRole(currentUser?.role)) {
          return includeOriginalCs(csUsers);
      }
      
      // Advertiser sees ONLY assigned
      if (isAdvertiserRole(currentUser?.role)) {
          if (activeConfig) {
             if (activeConfig.csIds && activeConfig.csIds.length > 0) {
                 return includeOriginalCs(csUsers.filter(c => activeConfig.csIds!.includes(c.id)));
             }
             return []; // Config exists but empty -> Empty CS
          }
          return includeOriginalCs(csUsers); // No Config -> Show All (Safety net)
      }
      
      // CS selection logic (if applicable)
      if (activeConfig && activeConfig.csIds && activeConfig.csIds.length > 0) {
          return includeOriginalCs(csUsers.filter(c => activeConfig.csIds!.includes(c.id)));
      }
      
      return includeOriginalCs(csUsers);
  }, [
    activeAdAccounts,
    activeConfig,
    activeCsAssignmentsByAccountId,
    activeOwnerByAccountId,
    csUsers,
    currentUser,
    originalCsId,
    preserveOriginalCs,
    selectedAdvertiserId,
    selectedPlatformId,
    selectedSubChannelId,
  ]);

  // Keep dependent dropdowns aligned with the selected advertiser/ad-account scope.
  useEffect(() => {
    const currentPlatform = form.getValues('platformId');

    if (
      currentPlatform &&
      currentPlatform !== NONE_PLATFORM &&
      !filteredPlatforms.some((platform) => platform.id === currentPlatform)
    ) {
      form.setValue('platformId', '');
      form.setValue('subChannelId', '');
    }
  }, [filteredPlatforms, form, selectedAdvertiserId]);

  useEffect(() => {
    const currentSubChannel = form.getValues('subChannelId');

    if (
      currentSubChannel &&
      currentSubChannel !== NONE_SUBCHANNEL &&
      !filteredSubChannels.some((subChannel) => subChannel.id === currentSubChannel)
    ) {
      form.setValue('subChannelId', '');
    }
  }, [filteredSubChannels, form, selectedAdvertiserId, selectedPlatformId]);

  useEffect(() => {
    if (isCSLogin && currentUser) {
      if (form.getValues('csId') !== currentUser.id) {
        form.setValue('csId', currentUser.id);
      }
      return;
    }

    const currentCs = form.getValues('csId');

    if (currentCs && currentCs !== NONE_CS && !filteredCS.some((cs) => cs.id === currentCs)) {
      form.setValue('csId', '');
    }
  }, [currentUser, filteredCS, form, isCSLogin, selectedAdvertiserId, selectedPlatformId, selectedSubChannelId]);

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
      <form onSubmit={form.handleSubmit(onSubmit)} className="masterDataForm leadManagedForm">
        <MasterDataDialogBody compact className="leadManagedFormBody">
        {/* Row 1: Name & Phone */}
        <div className="leadFormGrid">
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

        <div className="leadSocialSection">
          <Collapsible open={openSocialHelp} onOpenChange={setOpenSocialHelp} className="leadSocialCollapsible">
            <div className="leadSocialSectionHeader">
              <div>
                <div className="leadSocialTitleRow">
                  <h3>Kontak Sosial</h3>
                  <span>Opsional</span>
                </div>
              </div>

              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="leadSocialToggle"
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
              <div className="leadSocialHelp">
                <p>Isi username tanpa simbol "@".</p>
                <p>Link room chat dipakai kalau kamu punya URL DM yang spesifik.</p>
                <p>Kalau link profil kosong, sistem otomatis pakai username sebagai fallback.</p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="leadFormGrid">
            <FormField
              control={form.control}
              name="socialPlatform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform Sosial</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === NONE_SOCIAL_PLATFORM ? undefined : value)}
                    value={field.value || NONE_SOCIAL_PLATFORM}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-white border-slate-200 focus:ring-slate-200 shadow-sm">
                        <SelectValue placeholder="Pilih platform sosial" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white border-slate-200 shadow-xl rounded-xl z-[9999]">
                      <SelectItem
                        value={NONE_SOCIAL_PLATFORM}
                        className="text-slate-500 focus:bg-slate-50 cursor-pointer italic"
                      >
                        Tidak ada akun sosial
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

          <div className="leadFormGrid">
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

        <div className="leadFormSection">
          <div className="leadFormSectionHeader">
            <h3>Sumber & Assignment</h3>
          </div>

          <div className="leadFormGrid">
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
                    <Select
                      value={field.value || NONE_ADVERTISER}
                      onValueChange={(value) => field.onChange(value === NONE_ADVERTISER ? '' : value)}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-white border-slate-200 focus:ring-slate-200 shadow-sm">
                          <SelectValue placeholder="Pilih Advertiser" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white border-slate-200 shadow-xl rounded-xl z-[9999]">
                        <SelectItem value={NONE_ADVERTISER} className="text-slate-500 focus:bg-slate-50 cursor-pointer italic">
                          Tidak ada advertiser
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

            <FormField
              control={form.control}
              name="platformId"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Sumber (Opsional)</FormLabel>
                  <Select
                    value={field.value || NONE_PLATFORM}
                    onValueChange={(value) => {
                      const nextValue = value === NONE_PLATFORM ? '' : value;
                      field.onChange(nextValue);
                      if (!nextValue) form.setValue('subChannelId', '');
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-white border-slate-200 focus:ring-slate-200 shadow-sm">
                        <SelectValue placeholder="Pilih Sumber" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white border-slate-200 shadow-xl rounded-xl z-[9999]">
                      <SelectItem value={NONE_PLATFORM} className="text-slate-500 focus:bg-slate-50 cursor-pointer italic">
                        Tidak ada sumber
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

            {selectedPlatformId && selectedPlatformId !== NONE_PLATFORM && filteredSubChannels.length > 0 && (
              <FormField
                control={form.control}
                name="subChannelId"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Sub Channel</FormLabel>
                    <Select
                      value={field.value || NONE_SUBCHANNEL}
                      onValueChange={(value) => field.onChange(value === NONE_SUBCHANNEL ? '' : value)}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-white border-slate-200 focus:ring-slate-200 shadow-sm">
                          <SelectValue placeholder="Pilih Sub Channel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white border-slate-200 shadow-xl rounded-xl z-[9999]">
                        <SelectItem value={NONE_SUBCHANNEL} className="text-slate-500 focus:bg-slate-50 cursor-pointer italic">
                          Tidak ada sub channel
                        </SelectItem>
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
              name="csId"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Customer Service / Staff</FormLabel>
                  {isCSLogin ? (
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
                    <Select
                      value={field.value || NONE_CS}
                      onValueChange={(value) => field.onChange(value === NONE_CS ? '' : value)}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-white border-slate-200 focus:ring-slate-200 shadow-sm">
                          <SelectValue placeholder="Pilih Staff CS" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-white border-slate-200 shadow-xl rounded-xl z-[9999]">
                        <SelectItem value={NONE_CS} className="text-slate-500 focus:bg-slate-50 cursor-pointer italic">
                          Belum ditentukan
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
                               Tidak ada mobil
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
        </div>

        <div className="leadFormSection">
          <div className="leadFormSectionHeader">
            <h3>Status & Catatan</h3>
          </div>

          <div className="leadFormGrid single">
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
                    <Select value={field.value} onValueChange={field.onChange}>
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
        </div>
        </MasterDataDialogBody>

        <MasterDataFormActions
          onCancel={onCancel}
          saveLabel={item ? 'Simpan Perubahan' : 'Tambah Prospek'}
        />
      </form>
    </Form>
  );
};
