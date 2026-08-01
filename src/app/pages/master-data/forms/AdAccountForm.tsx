import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '../../../components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { MasterDataFieldLabel, MasterDataFormActions } from '../../../components/ui/master-data-ui';
import { AdAccount, Platform, SubChannel, User } from '../data';
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
  subChannelId: z.string().optional(),
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
  subChannels?: SubChannel[];
  advertisers: User[];
  liveMetaAccounts?: MetaLiveBreakdownResponse['accounts'];
  liveMetaError?: string | null;
  liveMetaLoading?: boolean;
  metaIntegrationConfig?: AdsIntegrationConfig | null;
  onRefreshMetaRegistry?: () => void;
  liveGoogleAccounts?: GoogleAdsLiveBreakdownResponse['accounts'];
  liveGoogleError?: string | null;
  liveGoogleLoading?: boolean;
  googleIntegrationConfig?: GoogleAdsIntegrationConfig | null;
  onRefreshGoogleRegistry?: () => void;
  liveTikTokAdvertisers?: TikTokAdvertiser[];
  liveTikTokBusinessCenters?: TikTokBusinessCenter[];
  liveTikTokError?: string | null;
  liveTikTokLoading?: boolean;
  tiktokIntegrationConfig?: TikTokAdsIntegrationConfig | null;
  onRefreshTikTokRegistry?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
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
  subChannels = [],
  advertisers,
  liveMetaAccounts = [],
  liveMetaError,
  liveMetaLoading = false,
  metaIntegrationConfig,
  onRefreshMetaRegistry,
  liveGoogleAccounts = [],
  liveGoogleError,
  liveGoogleLoading = false,
  googleIntegrationConfig,
  onRefreshGoogleRegistry,
  liveTikTokAdvertisers = [],
  liveTikTokBusinessCenters = [],
  liveTikTokError,
  liveTikTokLoading = false,
  tiktokIntegrationConfig,
  onRefreshTikTokRegistry,
  onDirtyChange,
  onSubmit,
  onCancel,
}) => {
  const form = useForm<AdAccountFormValues>({
    resolver: zodResolver(adAccountSchema),
    defaultValues: {
      accountName: item?.accountName || '',
      platformId: item?.platformId || '',
      advertiserId: item?.advertiserId || '',
      subChannelId: item?.subChannelId || '',
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
  const availableSubChannels = subChannels.filter((subChannel) => subChannel.status === 'active' && subChannel.platformId === selectedPlatformId);
  const showMetaMapping = isPlatformName(selectedPlatform, 'meta') || isPlatformName(selectedPlatform, 'facebook');
  const showGoogleMapping = isPlatformName(selectedPlatform, 'google');
  const showTikTokMapping = isPlatformName(selectedPlatform, 'tiktok');
  const hasMetaRegistry = liveMetaAccounts.length > 0;
  const hasGoogleRegistry = liveGoogleAccounts.length > 0;
  const hasTikTokRegistry = liveTikTokAdvertisers.length > 0;

  React.useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-2">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <FormField
            control={form.control}
            name="platformId"
            render={({field}) => (
              <FormItem>
                <MasterDataFieldLabel required>Platform</MasterDataFieldLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue('subChannelId', '');
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
                <MasterDataFieldLabel required>Nama Akun</MasterDataFieldLabel>
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
                <MasterDataFieldLabel required>Advertiser Name</MasterDataFieldLabel>
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

          <FormField
            control={form.control}
            name="subChannelId"
            render={({ field }) => (
              <FormItem>
                <MasterDataFieldLabel
                  info={{
                    title: 'Sub Channel',
                    description: 'Diambil dari Master Data Sub Channel dan otomatis difilter sesuai platform akun iklan.',
                  }}
                >
                  Sub Channel
                </MasterDataFieldLabel>
                <Select
                  value={field.value || NONE_VALUE}
                  onValueChange={(value) => field.onChange(value === NONE_VALUE ? '' : value)}
                  disabled={!selectedPlatformId || availableSubChannels.length === 0}
                >
                  <FormControl>
                    <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-slate-200 shadow-sm">
                      <SelectValue placeholder={selectedPlatformId ? 'Pilih Sub Channel' : 'Pilih platform dulu'} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-[9999]">
                    <SelectItem value={NONE_VALUE}>Tidak dikunci</SelectItem>
                    {availableSubChannels.map((subChannel) => (
                      <SelectItem key={subChannel.id} value={subChannel.id} className="focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer">
                        {subChannel.name}
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
            render={({field}) => (
              <FormItem>
                <MasterDataFieldLabel>Status</MasterDataFieldLabel>
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
        </div>

        {showMetaMapping ? (
          hasMetaRegistry ? (
            <FormField
              control={form.control}
              name="liveMetaAccountId"
              render={({ field }) => (
                <FormItem>
                  <MasterDataFieldLabel
                    info={{
                      title: 'Akun Meta Live',
                      description: 'Dipakai untuk mencocokkan snapshot API Meta ke akun internal.',
                    }}
                  >
                    Akun Meta Live
                  </MasterDataFieldLabel>
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
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <MasterDataFieldLabel
                    info={{
                      title: 'Registry API Meta kosong',
                      description: 'Refresh setelah token aktif, atau isi ID akun Meta manual sementara.',
                    }}
                  >
                    Registry API Meta kosong
                  </MasterDataFieldLabel>
                  {liveMetaError ? <p className="mt-1 text-xs font-semibold text-rose-500">{liveMetaError}</p> : null}
                </div>
                {onRefreshMetaRegistry ? (
                  <Button type="button" size="sm" variant="outline" disabled={liveMetaLoading} onClick={onRefreshMetaRegistry}>
                    <RefreshCw className={liveMetaLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                    Refresh
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3">
                <FormField
                  control={form.control}
                  name="liveMetaAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <MasterDataFieldLabel>ID Akun Meta</MasterDataFieldLabel>
                      <FormControl>
                        <Input placeholder="Contoh: act_123456789 atau 123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="liveMetaAccountName"
                  render={({ field }) => (
                    <FormItem>
                      <MasterDataFieldLabel>Nama Akun Meta</MasterDataFieldLabel>
                      <FormControl>
                        <Input placeholder="Opsional, untuk label tampilan" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )
        ) : null}

        {showGoogleMapping ? (
          hasGoogleRegistry ? (
            <FormField
              control={form.control}
              name="liveGoogleCustomerId"
              render={({ field }) => (
                <FormItem>
                  <MasterDataFieldLabel
                    info={{
                      title: 'Akun Google Ads Live',
                      description: 'Dipakai untuk mencocokkan snapshot API Google Ads ke akun internal.',
                    }}
                  >
                    Akun Google Ads Live
                  </MasterDataFieldLabel>
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
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <MasterDataFieldLabel
                      info={{
                        title: 'Registry API Google Ads kosong',
                        description: 'Refresh setelah OAuth aktif, atau isi Customer ID manual sementara.',
                      }}
                    >
                      Registry API Google Ads kosong
                    </MasterDataFieldLabel>
                  {liveGoogleError ? <p className="mt-1 text-xs font-semibold text-rose-500">{liveGoogleError}</p> : null}
                </div>
                {onRefreshGoogleRegistry ? (
                  <Button type="button" size="sm" variant="outline" disabled={liveGoogleLoading} onClick={onRefreshGoogleRegistry}>
                    <RefreshCw className={liveGoogleLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                    Refresh
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3">
                <FormField
                  control={form.control}
                  name="liveGoogleCustomerId"
                  render={({ field }) => (
                    <FormItem>
                      <MasterDataFieldLabel>Customer ID Google Ads</MasterDataFieldLabel>
                      <FormControl>
                        <Input placeholder="Contoh: 123-456-7890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="liveGoogleCustomerName"
                  render={({ field }) => (
                    <FormItem>
                      <MasterDataFieldLabel>Nama Customer</MasterDataFieldLabel>
                      <FormControl>
                        <Input placeholder="Opsional, untuk label tampilan" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )
        ) : null}

        {showTikTokMapping ? (
          <>
            {liveTikTokBusinessCenters.length > 0 ? (
              <FormField
                control={form.control}
                name="liveTikTokBusinessCenterId"
                render={({ field }) => (
                  <FormItem>
                    <MasterDataFieldLabel>Business Center TikTok</MasterDataFieldLabel>
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
            ) : null}

            {hasTikTokRegistry ? (
              <FormField
                control={form.control}
                name="liveTikTokAdvertiserId"
                render={({ field }) => (
                  <FormItem>
                    <MasterDataFieldLabel
                      info={{
                        title: 'Advertiser TikTok Live',
                        description: 'Dipakai untuk mencocokkan snapshot API TikTok ke akun internal.',
                      }}
                    >
                      Advertiser TikTok Live
                    </MasterDataFieldLabel>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <MasterDataFieldLabel
                      info={{
                        title: 'Registry API TikTok kosong',
                        description: 'Refresh setelah OAuth aktif, atau isi Advertiser ID manual sementara.',
                      }}
                    >
                      Registry API TikTok kosong
                    </MasterDataFieldLabel>
                    {liveTikTokError ? <p className="mt-1 text-xs font-semibold text-rose-500">{liveTikTokError}</p> : null}
                  </div>
                  {onRefreshTikTokRegistry ? (
                    <Button type="button" size="sm" variant="outline" disabled={liveTikTokLoading} onClick={onRefreshTikTokRegistry}>
                      <RefreshCw className={liveTikTokLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                      Refresh
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3">
                  <FormField
                    control={form.control}
                    name="liveTikTokAdvertiserId"
                    render={({ field }) => (
                      <FormItem>
                        <MasterDataFieldLabel>Advertiser ID TikTok</MasterDataFieldLabel>
                        <FormControl>
                          <Input placeholder="Contoh: 1234567890123456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="liveTikTokAdvertiserName"
                    render={({ field }) => (
                      <FormItem>
                        <MasterDataFieldLabel>Nama Advertiser</MasterDataFieldLabel>
                        <FormControl>
                          <Input placeholder="Opsional, untuk label tampilan" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
          </>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="ppn"
            render={({field}) => (
              <FormItem>
                <MasterDataFieldLabel
                  info={{
                    title: 'PPN',
                    description: 'Pajak Pertambahan Nilai dalam persen.',
                  }}
                >
                  PPN (%)
                </MasterDataFieldLabel>
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
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fee"
            render={({field}) => (
              <FormItem>
                <MasterDataFieldLabel
                  info={{
                    title: 'Fee',
                    description: 'Biaya layanan atau admin dalam persen.',
                  }}
                >
                  Fee (%)
                </MasterDataFieldLabel>
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
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <MasterDataFormActions confirmOnCancel={form.formState.isDirty} onCancel={onCancel} saveLabel="Simpan Akun Iklan" />
      </form>
    </Form>
  );
};
