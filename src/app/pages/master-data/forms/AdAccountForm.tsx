import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '../../../components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { DialogFooter } from '../../../components/ui/dialog';
import { AdAccount, Platform, User } from '../data';
import type { AdsIntegrationConfig, MetaLiveBreakdownResponse } from '@/app/services/liveAdsService';
import type {
  GoogleAdsIntegrationConfig,
  GoogleAdsLiveBreakdownResponse,
} from '@/app/services/googleAdsLiveService';
import type {
  TikTokAdsIntegrationConfig,
  TikTokAdvertiser,
  TikTokBusinessCenter,
} from '@/app/services/tiktokAdsLiveService';

const adAccountSchema = z.object({
  accountName: z.string().min(1, "Nama akun wajib diisi"),
  platformId: z.string().min(1, "Platform wajib dipilih"),
  advertiserId: z.string().min(1, "Advertiser wajib dipilih"),
  status: z.enum(['active', 'inactive']),
  ppn: z.coerce.number().min(0, "PPN minimal 0%").max(100, "PPN maksimal 100%").default(0),
  fee: z.coerce.number().min(0, "Fee minimal 0%").max(100, "Fee maksimal 100%").default(0),
  liveMetaBusinessManagerId: z.string().optional(),
  liveMetaBusinessManagerName: z.string().optional(),
  liveMetaAccountId: z.string().optional(),
  liveMetaAccountName: z.string().optional(),
  liveGoogleManagerCustomerId: z.string().optional(),
  liveGoogleManagerCustomerName: z.string().optional(),
  liveGoogleCustomerId: z.string().optional(),
  liveGoogleCustomerName: z.string().optional(),
  liveTikTokBusinessCenterId: z.string().optional(),
  liveTikTokBusinessCenterName: z.string().optional(),
  liveTikTokAdvertiserId: z.string().optional(),
  liveTikTokAdvertiserName: z.string().optional(),
});

type AdAccountFormValues = z.infer<typeof adAccountSchema>;

interface AdAccountFormProps {
  item?: AdAccount | null;
  platforms: Platform[];
  advertisers: User[];
  liveMetaAccounts?: MetaLiveBreakdownResponse['accounts'];
  metaIntegrationConfig?: AdsIntegrationConfig | null;
  liveGoogleAccounts?: GoogleAdsLiveBreakdownResponse['accounts'];
  googleIntegrationConfig?: GoogleAdsIntegrationConfig | null;
  liveTikTokAdvertisers?: TikTokAdvertiser[];
  liveTikTokBusinessCenters?: TikTokBusinessCenter[];
  tiktokIntegrationConfig?: TikTokAdsIntegrationConfig | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const NONE_VALUE = '__none__';

function isPlatformName(platform: Platform | undefined, keyword: string) {
  return platform?.name.toLowerCase().replace(/\s+/g, '').includes(keyword) || false;
}

export const AdAccountForm: React.FC<AdAccountFormProps> = ({
  item,
  platforms,
  advertisers,
  liveMetaAccounts = [],
  metaIntegrationConfig,
  liveGoogleAccounts = [],
  googleIntegrationConfig,
  liveTikTokAdvertisers = [],
  liveTikTokBusinessCenters = [],
  tiktokIntegrationConfig,
  onSubmit,
  onCancel,
}) => {
  const form = useForm<AdAccountFormValues>({
    resolver: zodResolver(adAccountSchema),
    defaultValues: {
      accountName: item?.accountName || '',
      platformId: item?.platformId || '',
      advertiserId: item?.advertiserId || '',
      status: item?.status || 'active',
      ppn: item?.ppn ?? 11, // Default PPN 11%
      fee: item?.fee ?? 0,
      liveMetaBusinessManagerId: metaIntegrationConfig?.businessManagerId || '',
      liveMetaBusinessManagerName: metaIntegrationConfig?.businessManagerName || '',
      liveMetaAccountId: metaIntegrationConfig?.liveMetaAccountId || '',
      liveMetaAccountName: metaIntegrationConfig?.liveMetaAccountName || '',
      liveGoogleManagerCustomerId: googleIntegrationConfig?.managerCustomerId || '',
      liveGoogleManagerCustomerName: googleIntegrationConfig?.managerCustomerName || '',
      liveGoogleCustomerId: googleIntegrationConfig?.liveGoogleCustomerId || '',
      liveGoogleCustomerName: googleIntegrationConfig?.liveGoogleCustomerName || '',
      liveTikTokBusinessCenterId: tiktokIntegrationConfig?.businessCenterId || '',
      liveTikTokBusinessCenterName: tiktokIntegrationConfig?.businessCenterName || '',
      liveTikTokAdvertiserId: tiktokIntegrationConfig?.liveTikTokAdvertiserId || '',
      liveTikTokAdvertiserName: tiktokIntegrationConfig?.liveTikTokAdvertiserName || '',
    },
  });

  const selectedPlatformId = form.watch('platformId');
  const selectedPlatform = platforms.find((platform) => platform.id === selectedPlatformId);
  const showMetaMapping = isPlatformName(selectedPlatform, 'meta') || isPlatformName(selectedPlatform, 'facebook');
  const showGoogleMapping = isPlatformName(selectedPlatform, 'google');
  const showTikTokMapping = isPlatformName(selectedPlatform, 'tiktok');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        <FormField
          control={form.control}
          name="platformId"
          render={({field}) => (
            <FormItem>
              <FormLabel>Platform <span className="text-red-500">*</span></FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  form.setValue('liveMetaBusinessManagerId', '');
                  form.setValue('liveMetaBusinessManagerName', '');
                  form.setValue('liveMetaAccountId', '');
                  form.setValue('liveMetaAccountName', '');
                  form.setValue('liveGoogleManagerCustomerId', '');
                  form.setValue('liveGoogleManagerCustomerName', '');
                  form.setValue('liveGoogleCustomerId', '');
                  form.setValue('liveGoogleCustomerName', '');
                  form.setValue('liveTikTokBusinessCenterId', '');
                  form.setValue('liveTikTokBusinessCenterName', '');
                  form.setValue('liveTikTokAdvertiserId', '');
                  form.setValue('liveTikTokAdvertiserName', '');
                }}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-slate-200 shadow-sm">
                    <SelectValue placeholder="Pilih Platform" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-[9999]">
                  {platforms.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer">
                      {p.name}
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
          name="accountName"
          render={({field}) => (
            <FormItem>
              <FormLabel>Nama Akun <span className="text-red-500">*</span></FormLabel>
              <FormControl>
                <Input placeholder="Contoh: Akun FB Utama" {...field} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="advertiserId"
          render={({field}) => (
            <FormItem>
              <FormLabel>Advertiser Name <span className="text-red-500">*</span></FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-slate-200 shadow-sm">
                    <SelectValue placeholder="Pilih Advertiser" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-[9999]">
                  {advertisers.map((advertiser) => (
                    <SelectItem key={advertiser.id} value={advertiser.id} className="focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer">
                      {advertiser.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {showMetaMapping ? (
          <FormField
            control={form.control}
            name="liveMetaAccountId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Akun Meta Live</FormLabel>
                <Select
                  value={field.value || NONE_VALUE}
                  onValueChange={(value) => {
                    const nextValue = value === NONE_VALUE ? '' : value;
                    const account = liveMetaAccounts.find((row) => row.id === nextValue);
                    field.onChange(nextValue);
                    form.setValue('liveMetaAccountName', account?.name || '');
                    form.setValue('liveMetaBusinessManagerId', account?.businessId || '');
                    form.setValue('liveMetaBusinessManagerName', account?.businessName || '');
                  }}
                >
                  <FormControl>
                    <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-slate-200 shadow-sm">
                      <SelectValue placeholder="Pilih akun Meta live" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-[9999]">
                    <SelectItem value={NONE_VALUE}>Tidak dipasangkan</SelectItem>
                    {liveMetaAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} - {account.businessName || 'Tanpa Business Manager'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription className="text-xs">
                  Dipakai untuk mencocokkan snapshot API Meta ke akun internal.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {showGoogleMapping ? (
          <FormField
            control={form.control}
            name="liveGoogleCustomerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Akun Google Ads Live</FormLabel>
                <Select
                  value={field.value || NONE_VALUE}
                  onValueChange={(value) => {
                    const nextValue = value === NONE_VALUE ? '' : value;
                    const account = liveGoogleAccounts.find((row) => row.customerId === nextValue);
                    field.onChange(nextValue);
                    form.setValue('liveGoogleCustomerName', account?.customerName || account?.name || '');
                    form.setValue('liveGoogleManagerCustomerId', account?.managerCustomerId || '');
                    form.setValue('liveGoogleManagerCustomerName', account?.managerCustomerName || '');
                  }}
                >
                  <FormControl>
                    <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-slate-200 shadow-sm">
                      <SelectValue placeholder="Pilih customer Google Ads" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-[9999]">
                    <SelectItem value={NONE_VALUE}>Tidak dipasangkan</SelectItem>
                    {liveGoogleAccounts.map((account) => (
                      <SelectItem key={account.customerId} value={account.customerId}>
                        {account.customerName || account.name} - {account.managerCustomerName || 'Direct Access'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription className="text-xs">
                  Kalau daftar kosong, cek token OAuth Google Ads di server.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {showTikTokMapping ? (
          <>
            <FormField
              control={form.control}
              name="liveTikTokBusinessCenterId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Center TikTok</FormLabel>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(value) => {
                      const nextValue = value === NONE_VALUE ? '' : value;
                      const businessCenter = liveTikTokBusinessCenters.find((row) => row.bcId === nextValue);
                      field.onChange(nextValue);
                      form.setValue('liveTikTokBusinessCenterName', businessCenter?.bcName || '');
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-slate-200 shadow-sm">
                        <SelectValue placeholder="Pilih Business Center" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-[9999]">
                      <SelectItem value={NONE_VALUE}>Tidak dipasangkan</SelectItem>
                      {liveTikTokBusinessCenters.map((businessCenter) => (
                        <SelectItem key={businessCenter.bcId} value={businessCenter.bcId}>
                          {businessCenter.bcName}
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
              name="liveTikTokAdvertiserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Advertiser TikTok Live</FormLabel>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(value) => {
                      const nextValue = value === NONE_VALUE ? '' : value;
                      const advertiser = liveTikTokAdvertisers.find((row) => row.advertiserId === nextValue);
                      field.onChange(nextValue);
                      form.setValue('liveTikTokAdvertiserName', advertiser?.advertiserName || '');
                      form.setValue('liveTikTokBusinessCenterId', advertiser?.bcId || form.getValues('liveTikTokBusinessCenterId') || '');
                      form.setValue('liveTikTokBusinessCenterName', advertiser?.bcName || form.getValues('liveTikTokBusinessCenterName') || '');
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-slate-200 shadow-sm">
                        <SelectValue placeholder="Pilih advertiser TikTok" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-[9999]">
                      <SelectItem value={NONE_VALUE}>Tidak dipasangkan</SelectItem>
                      {liveTikTokAdvertisers.map((advertiser) => (
                        <SelectItem key={advertiser.advertiserId} value={advertiser.advertiserId}>
                          {advertiser.advertiserName} - {advertiser.bcName || 'Tanpa Business Center'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs">
                    Kalau daftar kosong, token OAuth TikTok belum tersedia atau perlu authorize ulang.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="ppn"
            render={({field}) => (
              <FormItem>
                <FormLabel>PPN (%)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input 
                      type="number" 
                      step="0.1" 
                      placeholder="0" 
                      {...field} 
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm pr-8" 
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                  </div>
                </FormControl>
                <FormDescription className="text-xs">Pajak Pertambahan Nilai</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fee"
            render={({field}) => (
              <FormItem>
                <FormLabel>Fee (%)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input 
                      type="number" 
                      step="0.1" 
                      placeholder="0" 
                      {...field} 
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm pr-8" 
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                  </div>
                </FormControl>
                <FormDescription className="text-xs">Biaya layanan/admin</FormDescription>
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
                  <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-slate-200 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-[9999]">
                  <SelectItem value="active" className="focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer">Aktif</SelectItem>
                  <SelectItem value="inactive" className="focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer">Non Aktif</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={onCancel} className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50">
            Batal
          </Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 shadow-sm">
            Simpan Akun Iklan
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};
