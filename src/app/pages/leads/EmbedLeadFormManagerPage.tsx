import React from 'react';
import {
  Check,
  Clipboard,
  ClipboardList,
  Code2,
  FileCode2,
  FormInput,
  Loader2,
  Plus,
  Route,
  Save,
  Settings2,
  SlidersHorizontal,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Textarea } from '@/app/components/ui/textarea';
import { MasterDataFieldLabel } from '@/app/components/ui/master-data-ui';
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

const STATUS_LABEL: Record<EmbedLeadStatus, string> = {
  draft: 'Draft',
  active: 'Aktif',
  paused: 'Pause',
  archived: 'Arsip',
};

const STATUS_CLASS: Record<EmbedLeadStatus, string> = {
  draft: 'isDraft',
  active: 'isActive',
  paused: 'isPaused',
  archived: 'isArchived',
};

const ROUTING_LABEL: Record<EmbedLeadRoutingMode, string> = {
  single_cs: 'Pilih CS',
  broadcast: 'Broadcast',
  random: 'Random',
  round_robin: 'Round Robin',
};

const isActiveUser = (status?: string | null) => String(status || '').toLowerCase() === 'active';

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
  const [editorOpen, setEditorOpen] = React.useState(false);

  const csUsers = React.useMemo(
    () => users.filter((user) => isCsRole(user.role) && isActiveUser(user.status)),
    [users],
  );
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

  const openNewForm = () => {
    resetDraft();
    setEditorOpen(true);
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
      setEditorOpen(true);
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
      setEditorOpen(false);
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
      if (draft.id === form.id) {
        resetDraft();
        setEditorOpen(false);
      }
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
  const activeFormCount = forms.filter((form) => form.status === 'active').length;
  const selectedFieldCount = selectedFieldKeys.size;
  const selectedCsCount = selectedCsIds.size;

  return (
    <div className="opsPageShell embedFormPage">
      <div className="topbar">
        <div className="topbarTitle">
          <div className="opsEyebrow">
            <FormInput className="h-4 w-4" />
            PROSPEK & CHANNEL
          </div>
          <h1 className="opsPageTitle">Form Embed</h1>
          <p className="opsPageSubtitle">
            Kelola form publik dari landing page, field prospek, routing CS, dan kode embed.
          </p>
        </div>
        <div className="topbarActions">
          <Button type="button" className="uiButton primaryButton" onClick={openNewForm}>
            <Plus className="h-4 w-4" />
            Form Baru
          </Button>
        </div>
      </div>

      <div className="embedFormMetricGrid">
        <div className="opsMetricCard">
          <span className="metricIcon softBlue"><ClipboardList className="h-5 w-5" /></span>
          <div>
            <span>Total Form</span>
            <strong>{forms.length}</strong>
          </div>
        </div>
        <div className="opsMetricCard">
          <span className="metricIcon softGreen"><Check className="h-5 w-5" /></span>
          <div>
            <span>Form Aktif</span>
            <strong>{activeFormCount}</strong>
          </div>
        </div>
        <div className="opsMetricCard">
          <span className="metricIcon softPurple"><SlidersHorizontal className="h-5 w-5" /></span>
          <div>
            <span>Field Terpilih</span>
            <strong>{selectedFieldCount}</strong>
          </div>
        </div>
        <div className="opsMetricCard">
          <span className="metricIcon softAmber"><Route className="h-5 w-5" /></span>
          <div>
            <span>Routing CS</span>
            <strong>{selectedCsCount || '-'}</strong>
          </div>
        </div>
      </div>

      <section className="embedFormPanel">
        <div className="embedFormPanelHeader">
          <div className="moduleTitleBlock">
            <span className="moduleTitleIcon"><ClipboardList className="h-5 w-5" /></span>
            <div>
              <h2>Daftar Form Embed</h2>
              <p>{loading ? 'Memuat form...' : `${forms.length} form terdaftar, ${activeFormCount} aktif.`}</p>
            </div>
          </div>
          {loading && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
        </div>

        <div className="embedFormList">
          {forms.map((form) => (
            <article
              key={form.id}
              className={cn('embedFormListCard', draft.id === form.id && 'isSelected')}
            >
              <button type="button" className="embedFormListMain" onClick={() => void editForm(form)}>
                <span className="embedFormListIcon"><FileCode2 className="h-4 w-4" /></span>
                <span className="embedFormListText">
                  <strong>{form.name}</strong>
                  <span>/{form.slug}</span>
                </span>
              </button>
              <div className="embedFormListMeta">
                <Badge variant="outline" className={cn('embedFormStatusBadge', STATUS_CLASS[form.status])}>
                  {STATUS_LABEL[form.status]}
                </Badge>
                <Button type="button" size="icon" variant="ghost" className="iconButton danger" onClick={() => void handleDelete(form)} aria-label={`Hapus ${form.name}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </article>
          ))}
          {!loading && forms.length === 0 && (
            <div className="embedFormEmpty">
              <ClipboardList className="h-6 w-6" />
              <strong>Belum ada form embed</strong>
              <span>Buat form pertama untuk landing page advertiser.</span>
            </div>
          )}
        </div>
      </section>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="masterDataFormDialogContent embedFormDialogContent">
          <DialogTitle className="sr-only">{draft.id ? 'Edit Form Embed' : 'Tambah Form Embed'}</DialogTitle>
          <DialogDescription className="sr-only">
            Isi konfigurasi form embed prospek, routing CS, dan kode embed.
          </DialogDescription>
      <section className="embedFormEditor embedFormEditorDialog">
        <div className="embedFormEditorHeader">
          <div className="moduleTitleBlock">
            <span className="moduleTitleIcon"><Settings2 className="h-5 w-5" /></span>
            <div>
              <h2>{draft.id ? 'Edit Form Embed' : 'Tambah Form Embed'}</h2>
              <p>Isi konfigurasi form, source default, routing CS, dan tracking pixel.</p>
            </div>
          </div>
          <Badge variant="outline" className={cn('embedFormStatusBadge', STATUS_CLASS[draft.status])}>
            {STATUS_LABEL[draft.status]}
          </Badge>
        </div>

        <div className="embedFormEditorBody">
        <div className="embedFormSection">
          <div className="embedFormSectionTitle">
            <span>1</span>
            <h3>Informasi Form</h3>
          </div>
          <div className="masterDataFormGrid masterDataFormFieldGrid">
            <div className="masterDataFormField span-half">
              <MasterDataFieldLabel required>Nama Form</MasterDataFieldLabel>
              <Input
                className="uiInput"
                value={draft.name}
                onChange={(event) => patchDraft({
                  name: event.target.value,
                  slug: draft.slug ? draft.slug : createEmbedLeadSlug(event.target.value),
                })}
                placeholder="Contoh: LP Nano Ceramic Jakarta"
              />
            </div>
            <div className="masterDataFormField span-half">
              <MasterDataFieldLabel required>Slug Embed</MasterDataFieldLabel>
              <Input
                className="uiInput"
                value={draft.slug}
                onChange={(event) => patchDraft({ slug: createEmbedLeadSlug(event.target.value) })}
                placeholder="lp-nano-ceramic-jakarta"
              />
            </div>
            <div className="masterDataFormField span-quarter">
              <MasterDataFieldLabel>Status</MasterDataFieldLabel>
              <Select value={draft.status} onValueChange={(value) => patchDraft({ status: value as EmbedLeadStatus })}>
                <SelectTrigger className="uiSelectTrigger"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="paused">Pause</SelectItem>
                  <SelectItem value="archived">Arsip</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="masterDataFormField span-quarter">
              <MasterDataFieldLabel>Mode Embed</MasterDataFieldLabel>
              <Select value={draft.embedMode} onValueChange={(value) => patchDraft({ embedMode: value as EmbedLeadMode })}>
                <SelectTrigger className="uiSelectTrigger"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Iframe + Script</SelectItem>
                  <SelectItem value="iframe">Iframe</SelectItem>
                  <SelectItem value="script">Script</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="masterDataFormField span-half">
              <MasterDataFieldLabel>Button Label</MasterDataFieldLabel>
              <Input
                className="uiInput"
                value={draft.submitButtonLabel}
                onChange={(event) => patchDraft({ submitButtonLabel: event.target.value })}
                placeholder="Kirim"
              />
            </div>
            <div className="masterDataFormField span-full">
              <MasterDataFieldLabel optional>Deskripsi</MasterDataFieldLabel>
              <Textarea
                value={draft.description}
                onChange={(event) => patchDraft({ description: event.target.value })}
                placeholder="Keterangan singkat yang muncul di form publik"
                className="uiInput min-h-24 resize-y py-3"
              />
            </div>
          </div>
        </div>

        <div className="embedFormSection">
          <div className="embedFormSectionTitle">
            <span>2</span>
            <h3>Source Default</h3>
          </div>
          <div className="masterDataFormGrid masterDataFormFieldGrid">
            <div className="masterDataFormField span-third">
              <MasterDataFieldLabel>Produk / Layanan</MasterDataFieldLabel>
              <Select value={normalizeSelectValue(draft.defaultServiceId)} onValueChange={(value) => patchDraft({ defaultServiceId: denormalizeSelectValue(value) })}>
                <SelectTrigger className="uiSelectTrigger"><SelectValue placeholder="Pilih layanan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak dikunci</SelectItem>
                  {activeServices.map((service) => (
                    <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="masterDataFormField span-third">
              <MasterDataFieldLabel>Platform</MasterDataFieldLabel>
              <Select value={normalizeSelectValue(draft.platformId)} onValueChange={(value) => patchDraft({ platformId: denormalizeSelectValue(value), subChannelId: '', adAccountId: '' })}>
                <SelectTrigger className="uiSelectTrigger"><SelectValue placeholder="Pilih platform" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak dikunci</SelectItem>
                  {activePlatforms.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>{platform.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="masterDataFormField span-third">
              <MasterDataFieldLabel>Sub Channel</MasterDataFieldLabel>
              <Select value={normalizeSelectValue(draft.subChannelId)} onValueChange={(value) => patchDraft({ subChannelId: denormalizeSelectValue(value) })}>
                <SelectTrigger className="uiSelectTrigger"><SelectValue placeholder="Pilih sub channel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak dikunci</SelectItem>
                  {activeSubChannels.map((subChannel) => (
                    <SelectItem key={subChannel.id} value={subChannel.id}>{subChannel.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="masterDataFormField span-third">
              <MasterDataFieldLabel>Advertiser</MasterDataFieldLabel>
              <Select value={normalizeSelectValue(draft.advertiserId)} onValueChange={(value) => patchDraft({ advertiserId: denormalizeSelectValue(value), adAccountId: '' })}>
                <SelectTrigger className="uiSelectTrigger"><SelectValue placeholder="Pilih advertiser" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak dikunci</SelectItem>
                  {advertiserUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="masterDataFormField span-third">
              <MasterDataFieldLabel>Akun Iklan</MasterDataFieldLabel>
              <Select value={normalizeSelectValue(draft.adAccountId)} onValueChange={(value) => patchDraft({ adAccountId: denormalizeSelectValue(value) })}>
                <SelectTrigger className="uiSelectTrigger"><SelectValue placeholder="Pilih akun iklan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak dikunci</SelectItem>
                  {filteredAdAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>{account.accountName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="masterDataFormField span-third">
              <MasterDataFieldLabel>Status Prospek Baru</MasterDataFieldLabel>
              <Select value={draft.defaultStatus} onValueChange={(value) => patchDraft({ defaultStatus: value as Draft['defaultStatus'] })}>
                <SelectTrigger className="uiSelectTrigger"><SelectValue /></SelectTrigger>
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
        </div>

        <div className="embedFormSection">
          <div className="embedFormSectionTitle">
            <span>3</span>
            <h3>Routing CS</h3>
            <small>{ROUTING_LABEL[draft.routingMode]}</small>
          </div>
          <div className="embedRoutingGrid">
            <div className="masterDataFormField">
              <MasterDataFieldLabel>Mode Routing</MasterDataFieldLabel>
              <Select value={draft.routingMode} onValueChange={(value) => patchDraft({ routingMode: value as EmbedLeadRoutingMode })}>
                <SelectTrigger className="uiSelectTrigger"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_cs">Pilih CS</SelectItem>
                  <SelectItem value="broadcast">Broadcast</SelectItem>
                  <SelectItem value="random">Random</SelectItem>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="embedChoiceGrid">
              {csUsers.map((user) => (
                <label key={user.id} className={cn('embedChoiceCard', selectedCsIds.has(user.id) && 'isChecked')}>
                  <Checkbox className="dataTableSoftCheckbox" checked={selectedCsIds.has(user.id)} onCheckedChange={(checked) => toggleCs(user.id, checked === true)} />
                  <UsersRound className="h-4 w-4" />
                  <span>{user.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="embedFormSection">
          <div className="embedFormSectionTitle">
            <span>4</span>
            <h3>Field Prospek</h3>
            <small>{selectedFieldCount} field aktif</small>
          </div>
          <div className="embedChoiceGrid fields">
            {EMBED_LEAD_FIELD_DEFINITIONS.map((field) => {
              const locked = REQUIRED_KEYS.includes(field.key);
              return (
                <label key={field.key} className={cn('embedChoiceCard', selectedFieldKeys.has(field.key) && 'isChecked', locked && 'isLocked')}>
                  <Checkbox
                    className="dataTableSoftCheckbox"
                    checked={selectedFieldKeys.has(field.key)}
                    disabled={locked}
                    onCheckedChange={(checked) => toggleField(field.key, checked === true)}
                  />
                  <span>{field.label}</span>
                  {locked && <Badge variant="outline" className="embedRequiredBadge">Wajib</Badge>}
                </label>
              );
            })}
          </div>
        </div>

        <div className="embedFormSection">
          <div className="embedFormSectionTitle">
            <span>5</span>
            <h3>Tracking & Redirect</h3>
          </div>
          <div className="masterDataFormGrid masterDataFormFieldGrid">
            <div className="masterDataFormField span-third">
              <MasterDataFieldLabel optional>Meta Pixel ID</MasterDataFieldLabel>
              <Input className="uiInput" value={draft.metaPixelId} onChange={(event) => patchDraft({ metaPixelId: event.target.value })} placeholder="1234567890" />
            </div>
            <div className="masterDataFormField span-third">
              <MasterDataFieldLabel optional>TikTok Pixel ID</MasterDataFieldLabel>
              <Input className="uiInput" value={draft.tiktokPixelId} onChange={(event) => patchDraft({ tiktokPixelId: event.target.value })} placeholder="C..." />
            </div>
            <div className="masterDataFormField span-third">
              <MasterDataFieldLabel optional>Google Tag ID</MasterDataFieldLabel>
              <Input className="uiInput" value={draft.googleTagId} onChange={(event) => patchDraft({ googleTagId: event.target.value })} placeholder="G-... / AW-..." />
            </div>
            <div className="masterDataFormField span-half">
              <MasterDataFieldLabel optional>Google Conversion ID</MasterDataFieldLabel>
              <Input className="uiInput" value={draft.googleAdsConversionId} onChange={(event) => patchDraft({ googleAdsConversionId: event.target.value })} placeholder="AW-123456789" />
            </div>
            <div className="masterDataFormField span-half">
              <MasterDataFieldLabel optional>Google Conversion Label</MasterDataFieldLabel>
              <Input className="uiInput" value={draft.googleAdsConversionLabel} onChange={(event) => patchDraft({ googleAdsConversionLabel: event.target.value })} placeholder="AbCdEf..." />
            </div>
            <div className="masterDataFormField span-full">
              <MasterDataFieldLabel required>Pesan Terima Kasih</MasterDataFieldLabel>
              <Textarea value={draft.thankYouMessage} onChange={(event) => patchDraft({ thankYouMessage: event.target.value })} className="uiInput min-h-24 resize-y py-3" />
            </div>
            <div className="masterDataFormField span-full">
              <MasterDataFieldLabel optional>Redirect URL</MasterDataFieldLabel>
              <Input className="uiInput" value={draft.redirectUrl} onChange={(event) => patchDraft({ redirectUrl: event.target.value })} placeholder="https://landing-page.com/thank-you" />
            </div>
          </div>
        </div>

        {selectedFormForCode && (
          <div className="embedFormSection embedCodeSection">
            <div className="embedFormSectionTitle">
              <span><Code2 className="h-4 w-4" /></span>
              <h3>Embed Code</h3>
            </div>
            <div className="embedCodeGrid">
              <div className="embedCodeBox">
                <div>
                  <MasterDataFieldLabel>Iframe</MasterDataFieldLabel>
                  <Button type="button" size="sm" variant="outline" className="uiButton ghostButton buttonSm" onClick={() => void copyText(iframeCode)}>
                    <Clipboard className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
                <Textarea readOnly value={iframeCode} className="uiInput min-h-32 font-mono text-xs" />
              </div>
              <div className="embedCodeBox">
                <div>
                  <MasterDataFieldLabel>Script</MasterDataFieldLabel>
                  <Button type="button" size="sm" variant="outline" className="uiButton ghostButton buttonSm" onClick={() => void copyText(scriptCode)}>
                    <Clipboard className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
                <Textarea readOnly value={scriptCode} className="uiInput min-h-32 font-mono text-xs" />
              </div>
            </div>
          </div>
        )}
        </div>

        <div className="masterDataFormActions embedFormActions">
          <span>{draft.id ? 'Perubahan akan diterapkan ke form embed ini.' : 'Form baru belum tersimpan.'}</span>
          <div>
            <Button type="button" variant="outline" className="uiButton ghostButton" onClick={() => setEditorOpen(false)}>Batal</Button>
            <Button type="button" className="uiButton primaryButton" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Form
            </Button>
          </div>
        </div>
      </section>
        </DialogContent>
      </Dialog>
    </div>
  );
}
