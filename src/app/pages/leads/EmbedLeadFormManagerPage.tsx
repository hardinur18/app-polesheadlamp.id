import React from 'react';
import { Check, Clipboard, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Textarea } from '@/app/components/ui/textarea';
import { cn } from '@/app/components/ui/utils';
import { isAdvertiserRole, isCsRole } from '@/app/data/roleHelpers';
import { useMasterData } from '@/app/pages/master-data/context';
import {
  createEmbedLeadSlug,
  deleteEmbedLeadForm,
  EMBED_LEAD_FIELD_DEFINITIONS,
  fetchEmbedLeadFormBundle,
  getIframeEmbedCode,
  getScriptEmbedCode,
  listEmbedLeadForms,
  normalizeRequiredFields,
  saveEmbedLeadForm,
  type EmbedLeadFieldKey,
  type EmbedLeadForm,
  type EmbedLeadFormBundle,
  type EmbedLeadFormField,
  type EmbedLeadMode,
  type EmbedLeadRoutingMode,
  type EmbedLeadStatus,
} from '@/app/services/embedLeadForms';

type Draft = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  status: EmbedLeadStatus;
  embedMode: EmbedLeadMode;
  defaultStatus: 'Pending' | 'Follow Up' | 'Booking' | 'Closing' | 'Cancel';
  defaultServiceId: string;
  platformId: string;
  subChannelId: string;
  advertiserId: string;
  adAccountId: string;
  fallbackCsId: string;
  routingMode: EmbedLeadRoutingMode;
  thankYouMessage: string;
  redirectUrl: string;
  submitButtonLabel: string;
  metaPixelId: string;
  metaEventName: string;
  tiktokPixelId: string;
  tiktokEventName: string;
  googleTagId: string;
  googleAdsConversionId: string;
  googleAdsConversionLabel: string;
  googleEventName: string;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  slug: '',
  description: '',
  status: 'draft',
  embedMode: 'both',
  defaultStatus: 'Pending',
  defaultServiceId: '',
  platformId: '',
  subChannelId: '',
  advertiserId: '',
  adAccountId: '',
  fallbackCsId: '',
  routingMode: 'single_cs',
  thankYouMessage: 'Terima kasih. Tim kami akan segera menghubungi Anda melalui WhatsApp.',
  redirectUrl: '',
  submitButtonLabel: 'Kirim',
  metaPixelId: '',
  metaEventName: 'Lead',
  tiktokPixelId: '',
  tiktokEventName: 'SubmitForm',
  googleTagId: '',
  googleAdsConversionId: '',
  googleAdsConversionLabel: '',
  googleEventName: 'conversion',
};

const REQUIRED_KEYS: EmbedLeadFieldKey[] = ['name', 'phone'];

const normalizeSelectValue = (value?: string | null) => value || 'none';
const denormalizeSelectValue = (value: string) => (value === 'none' ? '' : value);

export function EmbedLeadFormManagerPage() {
  const {
    services,
    vehicles,
    platforms,
    subChannels,
    users,
    affiliates,
    adAccounts,
    currentUser,
  } = useMasterData();
  const [forms, setForms] = React.useState<EmbedLeadForm[]>([]);
  const [activeBundle, setActiveBundle] = React.useState<EmbedLeadFormBundle | null>(null);
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [selectedFieldKeys, setSelectedFieldKeys] = React.useState<Set<EmbedLeadFieldKey>>(
    () => new Set(REQUIRED_KEYS),
  );
  const [selectedCsIds, setSelectedCsIds] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const csUsers = React.useMemo(() => users.filter((user) => isCsRole(user.role)), [users]);
  const advertiserUsers = React.useMemo(() => users.filter((user) => isAdvertiserRole(user.role)), [users]);

  const activePlatforms = React.useMemo(
    () => platforms.filter((platform) => platform.status === 'active'),
    [platforms],
  );
  const activeSubChannels = React.useMemo(
    () => subChannels.filter((subChannel) => subChannel.status === 'active' && (!draft.platformId || subChannel.platformId === draft.platformId)),
    [draft.platformId, subChannels],
  );
  const activeServices = React.useMemo(
    () => services.filter((service) => service.status === 'active'),
    [services],
  );
  const activeVehicles = React.useMemo(
    () => vehicles.filter((vehicle) => vehicle.status === 'active'),
    [vehicles],
  );
  const activeAffiliates = React.useMemo(
    () => affiliates.filter((affiliate) => affiliate.status === 'Active'),
    [affiliates],
  );
  const filteredAdAccounts = React.useMemo(
    () => adAccounts.filter((account) =>
      account.status === 'active' &&
      (!draft.advertiserId || account.advertiserId === draft.advertiserId) &&
      (!draft.platformId || account.platformId === draft.platformId)
    ),
    [adAccounts, draft.advertiserId, draft.platformId],
  );

  const loadForms = React.useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listEmbedLeadForms();
      setForms(rows);
    } catch (error: any) {
      toast.error(`Gagal memuat form embed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadForms();
  }, [loadForms]);

  const patchDraft = (patch: Partial<Draft>) => {
    setDraft((prev) => ({
      ...prev,
      ...patch,
    }));
  };

  const resetDraft = () => {
    setActiveBundle(null);
    setDraft(EMPTY_DRAFT);
    setSelectedFieldKeys(new Set(REQUIRED_KEYS));
    setSelectedCsIds(new Set());
  };

  const editForm = async (form: EmbedLeadForm) => {
    setSaving(true);
    try {
      const bundle = await fetchEmbedLeadFormBundle(form.slug);
      if (!bundle) throw new Error('Form tidak ditemukan.');

      setActiveBundle(bundle);
      setDraft({
        id: bundle.form.id,
        name: bundle.form.name,
        slug: bundle.form.slug,
        description: bundle.form.description || '',
        status: bundle.form.status,
        embedMode: bundle.form.embedMode,
        defaultStatus: bundle.form.defaultStatus,
        defaultServiceId: bundle.form.defaultServiceId || '',
        platformId: bundle.form.platformId || '',
        subChannelId: bundle.form.subChannelId || '',
        advertiserId: bundle.form.advertiserId || '',
        adAccountId: bundle.form.adAccountId || '',
        fallbackCsId: bundle.form.fallbackCsId || '',
        routingMode: bundle.form.routingMode,
        thankYouMessage: bundle.form.thankYouMessage || EMPTY_DRAFT.thankYouMessage,
        redirectUrl: bundle.form.redirectUrl || '',
        submitButtonLabel: bundle.form.submitButtonLabel || 'Kirim',
        metaPixelId: bundle.form.metaPixelId || '',
        metaEventName: bundle.form.metaEventName || 'Lead',
        tiktokPixelId: bundle.form.tiktokPixelId || '',
        tiktokEventName: bundle.form.tiktokEventName || 'SubmitForm',
        googleTagId: bundle.form.googleTagId || '',
        googleAdsConversionId: bundle.form.googleAdsConversionId || '',
        googleAdsConversionLabel: bundle.form.googleAdsConversionLabel || '',
        googleEventName: bundle.form.googleEventName || 'conversion',
      });
      setSelectedFieldKeys(new Set(bundle.fields.filter((field) => field.isVisible).map((field) => field.fieldKey)));
      setSelectedCsIds(new Set(bundle.routes.filter((route) => route.status === 'active').map((route) => route.csId)));
    } catch (error: any) {
      toast.error(`Gagal membuka form: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleField = (fieldKey: EmbedLeadFieldKey, checked: boolean) => {
    if (REQUIRED_KEYS.includes(fieldKey)) return;
    setSelectedFieldKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(fieldKey);
      else next.delete(fieldKey);
      return next;
    });
  };

  const toggleCs = (csId: string, checked: boolean) => {
    setSelectedCsIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(csId);
      else next.delete(csId);
      return next;
    });
  };

  const optionsForField = (fieldKey: EmbedLeadFieldKey) => {
    switch (fieldKey) {
      case 'service_id':
        return activeServices.map((service) => ({ label: service.name, value: service.id }));
      case 'vehicle_id':
        return activeVehicles.map((vehicle) => ({ label: vehicle.name, value: vehicle.id }));
      case 'platform_id':
        return activePlatforms.map((platform) => ({ label: platform.name, value: platform.id }));
      case 'sub_channel_id':
        return activeSubChannels.map((subChannel) => ({ label: subChannel.name, value: subChannel.id }));
      case 'advertiser_id':
        return advertiserUsers.map((user) => ({ label: user.name, value: user.id }));
      case 'affiliate_id':
        return activeAffiliates.map((affiliate) => ({ label: affiliate.name, value: affiliate.id }));
      case 'social_platform':
        return [
          { label: 'Instagram', value: 'instagram' },
          { label: 'TikTok', value: 'tiktok' },
        ];
      default:
        return [];
    }
  };

  const buildFields = (): EmbedLeadFormField[] => normalizeRequiredFields(
    EMBED_LEAD_FIELD_DEFINITIONS
      .filter((definition) => selectedFieldKeys.has(definition.key))
      .map((definition, index) => ({
        fieldKey: definition.key,
        label: definition.label,
        placeholder: definition.placeholder || null,
        helpText: null,
        inputType: definition.inputType,
        isVisible: true,
        isRequired: Boolean(definition.lockedRequired),
        sortOrder: index * 10,
        options: optionsForField(definition.key),
        validationConfig: {},
        metadata: {},
      })),
  );

  const handleSave = async () => {
    if (!draft.name.trim()) {
      toast.error('Nama form wajib diisi');
      return;
    }

    const slug = createEmbedLeadSlug(draft.slug || draft.name);
    if (!slug) {
      toast.error('Slug form belum valid');
      return;
    }

    setSaving(true);
    try {
      const defaultService = services.find((service) => service.id === draft.defaultServiceId);
      const firstSelectedCs = Array.from(selectedCsIds)[0] || '';
      const fallbackCsId = draft.fallbackCsId || firstSelectedCs;

      const saved = await saveEmbedLeadForm({
        form: {
          id: draft.id,
          name: draft.name.trim(),
          slug,
          description: draft.description,
          status: draft.status,
          embedMode: draft.embedMode,
          defaultStatus: draft.defaultStatus,
          defaultServiceId: draft.defaultServiceId,
          defaultServiceName: defaultService?.name || '',
          platformId: draft.platformId,
          subChannelId: draft.subChannelId,
          advertiserId: draft.advertiserId,
          adAccountId: draft.adAccountId,
          fallbackCsId,
          routingMode: draft.routingMode,
          thankYouMessage: draft.thankYouMessage,
          redirectUrl: draft.redirectUrl,
          submitButtonLabel: draft.submitButtonLabel,
          metaPixelId: draft.metaPixelId,
          metaEventName: draft.metaEventName,
          tiktokPixelId: draft.tiktokPixelId,
          tiktokEventName: draft.tiktokEventName,
          googleTagId: draft.googleTagId,
          googleAdsConversionId: draft.googleAdsConversionId,
          googleAdsConversionLabel: draft.googleAdsConversionLabel,
          googleEventName: draft.googleEventName,
          createdBy: draft.id ? undefined : currentUser?.id,
          updatedBy: currentUser?.id,
        },
        fields: buildFields(),
        routes: Array.from(selectedCsIds).map((csId, index) => ({
          csId,
          status: 'active',
          routeWeight: 1,
          sortOrder: index * 10,
          metadata: {},
        })),
      });

      setActiveBundle(saved);
      setDraft((prev) => ({ ...prev, id: saved.form.id, slug: saved.form.slug, fallbackCsId: saved.form.fallbackCsId || '' }));
      await loadForms();
      toast.success('Form embed tersimpan');
    } catch (error: any) {
      toast.error(`Gagal menyimpan form: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (form: EmbedLeadForm) => {
    if (!window.confirm(`Hapus form "${form.name}"?`)) return;
    setSaving(true);
    try {
      await deleteEmbedLeadForm(form.id);
      if (draft.id === form.id) resetDraft();
      await loadForms();
      toast.success('Form embed dihapus');
    } catch (error: any) {
      toast.error(`Gagal menghapus form: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('Embed code disalin');
  };

  const selectedFormForCode = activeBundle?.form || forms.find((form) => form.id === draft.id);
  const iframeCode = selectedFormForCode ? getIframeEmbedCode(selectedFormForCode) : '';
  const scriptCode = selectedFormForCode ? getScriptEmbedCode(selectedFormForCode) : '';

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950 dark:text-slate-100">Embed Lead Form</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Form publik untuk LP advertiser.</p>
        </div>
        <Button type="button" variant="outline" onClick={resetDraft} className="w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Form Baru
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Daftar Form</h2>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          </div>
          <div className="space-y-2">
            {forms.map((form) => (
              <div
                key={form.id}
                className={cn(
                  'rounded-lg border p-3 transition',
                  draft.id === form.id
                    ? 'border-blue-300 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/60',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <button type="button" className="min-w-0 text-left" onClick={() => void editForm(form)}>
                    <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{form.name}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">/{form.slug}</div>
                  </button>
                  <Badge variant="outline" className="rounded-md text-[11px] capitalize">{form.status}</Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void editForm(form)}>
                    Edit
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void handleDelete(form)} className="text-red-600 hover:text-red-700">
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
            {!loading && forms.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800">
                Belum ada form embed.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Nama Form</Label>
                <Input
                  value={draft.name}
                  onChange={(event) => patchDraft({
                    name: event.target.value,
                    slug: draft.slug ? draft.slug : createEmbedLeadSlug(event.target.value),
                  })}
                  placeholder="LP Nano Ceramic Jakarta"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug Embed</Label>
                <Input
                  value={draft.slug}
                  onChange={(event) => patchDraft({ slug: createEmbedLeadSlug(event.target.value) })}
                  placeholder="lp-nano-ceramic-jakarta"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={draft.status} onValueChange={(value) => patchDraft({ status: value as EmbedLeadStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mode Embed</Label>
                <Select value={draft.embedMode} onValueChange={(value) => patchDraft({ embedMode: value as EmbedLeadMode })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Iframe + Script</SelectItem>
                    <SelectItem value="iframe">Iframe</SelectItem>
                    <SelectItem value="script">Script</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>Deskripsi</Label>
                <Textarea
                  value={draft.description}
                  onChange={(event) => patchDraft({ description: event.target.value })}
                  placeholder="Judul/keterangan singkat yang muncul di form"
                  className="min-h-20"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Produk, Source, dan Routing</h2>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Produk/Layanan Default</Label>
                <Select value={normalizeSelectValue(draft.defaultServiceId)} onValueChange={(value) => patchDraft({ defaultServiceId: denormalizeSelectValue(value) })}>
                  <SelectTrigger><SelectValue placeholder="Pilih layanan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak dikunci</SelectItem>
                    {activeServices.map((service) => (
                      <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Platform Default</Label>
                <Select value={normalizeSelectValue(draft.platformId)} onValueChange={(value) => patchDraft({ platformId: denormalizeSelectValue(value), subChannelId: '', adAccountId: '' })}>
                  <SelectTrigger><SelectValue placeholder="Pilih platform" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak dikunci</SelectItem>
                    {activePlatforms.map((platform) => (
                      <SelectItem key={platform.id} value={platform.id}>{platform.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sub Channel Default</Label>
                <Select value={normalizeSelectValue(draft.subChannelId)} onValueChange={(value) => patchDraft({ subChannelId: denormalizeSelectValue(value) })}>
                  <SelectTrigger><SelectValue placeholder="Pilih sub channel" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak dikunci</SelectItem>
                    {activeSubChannels.map((subChannel) => (
                      <SelectItem key={subChannel.id} value={subChannel.id}>{subChannel.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Advertiser</Label>
                <Select value={normalizeSelectValue(draft.advertiserId)} onValueChange={(value) => patchDraft({ advertiserId: denormalizeSelectValue(value), adAccountId: '' })}>
                  <SelectTrigger><SelectValue placeholder="Pilih advertiser" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak dikunci</SelectItem>
                    {advertiserUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Akun Iklan</Label>
                <Select value={normalizeSelectValue(draft.adAccountId)} onValueChange={(value) => patchDraft({ adAccountId: denormalizeSelectValue(value) })}>
                  <SelectTrigger><SelectValue placeholder="Pilih akun iklan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak dikunci</SelectItem>
                    {filteredAdAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>{account.accountName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status Prospek Baru</Label>
                <Select value={draft.defaultStatus} onValueChange={(value) => patchDraft({ defaultStatus: value as Draft['defaultStatus'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Follow Up">Follow Up</SelectItem>
                    <SelectItem value="Booking">Booking</SelectItem>
                    <SelectItem value="Closing">Closing</SelectItem>
                    <SelectItem value="Cancel">Cancel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[240px_1fr]">
              <div className="space-y-2">
                <Label>Routing CS</Label>
                <Select value={draft.routingMode} onValueChange={(value) => patchDraft({ routingMode: value as EmbedLeadRoutingMode })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_cs">Pilih CS</SelectItem>
                    <SelectItem value="broadcast">Broadcast</SelectItem>
                    <SelectItem value="random">Random</SelectItem>
                    <SelectItem value="round_robin">Round Robin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {csUsers.map((user) => (
                  <label key={user.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                    <Checkbox checked={selectedCsIds.has(user.id)} onCheckedChange={(checked) => toggleCs(user.id, checked === true)} />
                    <span className="truncate">{user.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Field Prospek</h2>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {EMBED_LEAD_FIELD_DEFINITIONS.map((field) => {
                const locked = REQUIRED_KEYS.includes(field.key);
                return (
                  <label key={field.key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                    <Checkbox
                      checked={selectedFieldKeys.has(field.key)}
                      disabled={locked}
                      onCheckedChange={(checked) => toggleField(field.key, checked === true)}
                    />
                    <span className="truncate">{field.label}</span>
                    {locked && <Badge variant="outline" className="ml-auto rounded-md text-[10px]">Wajib</Badge>}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Tracking</h2>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Meta Pixel ID</Label>
                <Input value={draft.metaPixelId} onChange={(event) => patchDraft({ metaPixelId: event.target.value })} placeholder="1234567890" />
              </div>
              <div className="space-y-2">
                <Label>TikTok Pixel ID</Label>
                <Input value={draft.tiktokPixelId} onChange={(event) => patchDraft({ tiktokPixelId: event.target.value })} placeholder="C..." />
              </div>
              <div className="space-y-2">
                <Label>Google Tag ID</Label>
                <Input value={draft.googleTagId} onChange={(event) => patchDraft({ googleTagId: event.target.value })} placeholder="G-... / AW-..." />
              </div>
              <div className="space-y-2">
                <Label>Google Conversion ID</Label>
                <Input value={draft.googleAdsConversionId} onChange={(event) => patchDraft({ googleAdsConversionId: event.target.value })} placeholder="AW-123456789" />
              </div>
              <div className="space-y-2">
                <Label>Google Conversion Label</Label>
                <Input value={draft.googleAdsConversionLabel} onChange={(event) => patchDraft({ googleAdsConversionLabel: event.target.value })} placeholder="AbCdEf..." />
              </div>
              <div className="space-y-2">
                <Label>Button Label</Label>
                <Input value={draft.submitButtonLabel} onChange={(event) => patchDraft({ submitButtonLabel: event.target.value })} placeholder="Kirim" />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label>Thank You Message</Label>
                <Textarea value={draft.thankYouMessage} onChange={(event) => patchDraft({ thankYouMessage: event.target.value })} className="min-h-20" />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label>Redirect URL</Label>
                <Input value={draft.redirectUrl} onChange={(event) => patchDraft({ redirectUrl: event.target.value })} placeholder="https://landing-page.com/thank-you" />
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-500">
              {draft.id ? 'Mengedit form aktif.' : 'Form baru belum tersimpan.'}
            </div>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Simpan Form
            </Button>
          </div>

          {selectedFormForCode && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Embed Code</h2>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Iframe</Label>
                    <Button type="button" size="sm" variant="outline" onClick={() => void copyText(iframeCode)}>
                      <Clipboard className="mr-2 h-3.5 w-3.5" />
                      Copy
                    </Button>
                  </div>
                  <Textarea readOnly value={iframeCode} className="min-h-32 font-mono text-xs" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Script</Label>
                    <Button type="button" size="sm" variant="outline" onClick={() => void copyText(scriptCode)}>
                      <Clipboard className="mr-2 h-3.5 w-3.5" />
                      Copy
                    </Button>
                  </div>
                  <Textarea readOnly value={scriptCode} className="min-h-32 font-mono text-xs" />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
