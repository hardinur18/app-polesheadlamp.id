import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Megaphone,
  RefreshCcw,
  Search,
  Send,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import {
  fetchKirimdevTemplates,
  fetchWhatsAppBroadcasts,
  fetchWhatsAppContacts,
  sendWhatsAppBroadcast,
  type WhatsAppBroadcastRecord,
  type WhatsAppContact,
  type WhatsAppTemplate,
} from '@/app/services/whatsappModuleService';
import { WhatsAppModuleFrame } from './components/WhatsAppModuleFrame';
import {
  ProviderBadge,
  WhatsAppStateCard,
  formatDateTime,
  formatNumber,
  formatPhoneNumber,
} from './components/whatsappModuleShared';

function normalizePhone(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '');
}

function buildTemplateKey(template: WhatsAppTemplate) {
  return `${template.name}::${template.language}`;
}

function BroadcastStatusBadge({ status }: { status: WhatsAppBroadcastRecord['status'] }) {
  const meta =
    status === 'completed'
      ? {
          label: 'Selesai',
          icon: CheckCircle2,
          className:
            'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300',
        }
      : status === 'partial_failed'
        ? {
            label: 'Sebagian gagal',
            icon: AlertTriangle,
            className:
              'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300',
          }
        : {
            label: 'Gagal',
            icon: XCircle,
            className: 'border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300',
          };
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={meta.className}>
      <Icon className="mr-1 h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

export function WhatsAppBroadcastsPage() {
  const [contacts, setContacts] = React.useState<WhatsAppContact[]>([]);
  const [templates, setTemplates] = React.useState<WhatsAppTemplate[]>([]);
  const [broadcasts, setBroadcasts] = React.useState<WhatsAppBroadcastRecord[]>([]);
  const [maxRecipients, setMaxRecipients] = React.useState(25);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [campaignName, setCampaignName] = React.useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = React.useState('');
  const [parameterValues, setParameterValues] = React.useState<Record<string, string>>({});
  const [contactSearch, setContactSearch] = React.useState('');
  const [selectedPhones, setSelectedPhones] = React.useState<string[]>([]);
  const [acknowledgedOptIn, setAcknowledgedOptIn] = React.useState(false);

  const load = React.useCallback(async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [contactsPayload, templatesPayload, broadcastsPayload] = await Promise.all([
        fetchWhatsAppContacts(),
        fetchKirimdevTemplates({ status: 'all', limit: 100 }),
        fetchWhatsAppBroadcasts({ limit: 25 }),
      ]);
      setContacts(contactsPayload.contacts);
      setTemplates(templatesPayload.templates);
      setBroadcasts(broadcastsPayload.broadcasts);
      setMaxRecipients(broadcastsPayload.maxRecipientsPerRun || 25);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data broadcast WhatsApp.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const approvedTemplates = React.useMemo(
    () => templates.filter((template) => template.status === 'approved'),
    [templates],
  );

  React.useEffect(() => {
    if (!approvedTemplates.length) {
      setSelectedTemplateKey('');
      return;
    }
    if (!selectedTemplateKey || !approvedTemplates.some((item) => buildTemplateKey(item) === selectedTemplateKey)) {
      setSelectedTemplateKey(buildTemplateKey(approvedTemplates[0]));
    }
  }, [approvedTemplates, selectedTemplateKey]);

  const selectedTemplate = React.useMemo(
    () => approvedTemplates.find((template) => buildTemplateKey(template) === selectedTemplateKey) || null,
    [approvedTemplates, selectedTemplateKey],
  );

  React.useEffect(() => {
    if (!selectedTemplate) {
      setParameterValues({});
      return;
    }
    setParameterValues((current) => {
      const next: Record<string, string> = {};
      selectedTemplate.variables.forEach((variable) => {
        next[variable] = current[variable] || '';
      });
      return next;
    });
  }, [selectedTemplate]);

  const contactsWithPhone = React.useMemo(() => {
    const seen = new Set<string>();
    return contacts.filter((contact) => {
      const phone = normalizePhone(contact.phoneNumber);
      if (!phone || seen.has(phone)) return false;
      seen.add(phone);
      return true;
    });
  }, [contacts]);

  const filteredContacts = React.useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    return contactsWithPhone.filter((contact) => {
      if (!query) return true;
      const haystack = [contact.name, contact.phoneNumber, contact.provider]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [contactSearch, contactsWithPhone]);

  const selectedContacts = React.useMemo(() => {
    const selected = new Set(selectedPhones);
    return contactsWithPhone.filter((contact) => selected.has(normalizePhone(contact.phoneNumber)));
  }, [contactsWithPhone, selectedPhones]);

  const togglePhone = React.useCallback((phone: string) => {
    setSelectedPhones((current) =>
      current.includes(phone) ? current.filter((item) => item !== phone) : [...current, phone],
    );
  }, []);

  const handleSelectVisible = React.useCallback(() => {
    const current = new Set(selectedPhones);
    for (const contact of filteredContacts) {
      if (current.size >= maxRecipients) break;
      current.add(normalizePhone(contact.phoneNumber));
    }
    setSelectedPhones(Array.from(current));
  }, [filteredContacts, maxRecipients, selectedPhones]);

  const handleSend = React.useCallback(async () => {
    if (!selectedTemplate) {
      toast.error('Pilih template approved dulu.');
      return;
    }
    if (selectedContacts.length === 0) {
      toast.error('Pilih minimal satu kontak.');
      return;
    }
    if (selectedContacts.length > maxRecipients) {
      toast.error(`Maksimal ${formatNumber(maxRecipients)} penerima per sekali broadcast.`);
      return;
    }
    if (!acknowledgedOptIn) {
      toast.error('Centang konfirmasi opt-in sebelum mengirim.');
      return;
    }

    const missingParameter = selectedTemplate.variables.find(
      (variable) => !parameterValues[variable]?.trim(),
    );
    if (missingParameter) {
      toast.error(`Isi nilai parameter {{${missingParameter}}} terlebih dahulu.`);
      return;
    }

    setSending(true);
    try {
      const payload = await sendWhatsAppBroadcast({
        campaignName: campaignName.trim() || `Broadcast ${selectedTemplate.name}`,
        templateName: selectedTemplate.name,
        language: selectedTemplate.language,
        phoneNumberId: selectedTemplate.phoneNumberId,
        bodyParameters: selectedTemplate.variables.map((variable) => ({
          name: variable,
          text: parameterValues[variable],
        })),
        recipients: selectedContacts.map((contact) => ({
          contactId: contact.id,
          phoneNumber: contact.phoneNumber || '',
          name: contact.name,
        })),
        acknowledgedOptIn,
      });

      setBroadcasts((current) => [payload.broadcast, ...current].slice(0, 25));
      setCampaignName('');
      setSelectedPhones([]);
      setAcknowledgedOptIn(false);
      if (payload.broadcast.failureCount > 0) {
        toast.warning(
          `Broadcast selesai dengan ${formatNumber(payload.broadcast.failureCount)} gagal.`,
        );
      } else {
        toast.success(`Broadcast terkirim ke ${formatNumber(payload.broadcast.successCount)} kontak.`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengirim broadcast WhatsApp.');
    } finally {
      setSending(false);
    }
  }, [
    acknowledgedOptIn,
    campaignName,
    maxRecipients,
    parameterValues,
    selectedContacts,
    selectedTemplate,
  ]);

  const totalSent = broadcasts.reduce((sum, broadcast) => sum + broadcast.successCount, 0);
  const totalFailed = broadcasts.reduce((sum, broadcast) => sum + broadcast.failureCount, 0);

  return (
    <WhatsAppModuleFrame
      activeId="whatsapp-broadcasts"
      stats={[
        { label: 'Kontak Tersedia', value: formatNumber(contactsWithPhone.length) },
        { label: 'Template Approved', value: formatNumber(approvedTemplates.length) },
        { label: 'Riwayat Broadcast', value: formatNumber(broadcasts.length) },
        { label: 'Limit / Run', value: formatNumber(maxRecipients) },
      ]}
      actions={
        <Button
          variant="outline"
          onClick={() => void load({ silent: true })}
          disabled={loading || refreshing || sending}
        >
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      }
    >
      {error ? (
        <WhatsAppStateCard
          tone="danger"
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Data broadcast belum berhasil dimuat."
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Coba lagi
            </Button>
          }
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Megaphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Compose Broadcast
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Broadcast memakai template approved dan dikirim lewat backend Kirimdev.
                  </p>
                </div>
              </div>
              <Badge variant="outline">{formatNumber(selectedContacts.length)} dipilih</Badge>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Nama campaign</Label>
                <Input
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                  placeholder="Promo coating Juni"
                />
              </div>
              <div className="space-y-2">
                <Label>Template approved</Label>
                <Select value={selectedTemplateKey} onValueChange={setSelectedTemplateKey}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih template" />
                  </SelectTrigger>
                  <SelectContent>
                    {approvedTemplates.map((template) => (
                      <SelectItem key={buildTemplateKey(template)} value={buildTemplateKey(template)}>
                        {template.name} / {template.language}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedTemplate ? (
              <div className="px-5 pb-5">
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{selectedTemplate.language}</Badge>
                    {selectedTemplate.category ? <Badge variant="outline">{selectedTemplate.category}</Badge> : null}
                    <Badge
                      variant="outline"
                      className="border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                    >
                      approved
                    </Badge>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {selectedTemplate.content || 'Konten template tidak tersedia dari Kirimdev.'}
                  </p>
                </div>

                {selectedTemplate.variables.length > 0 ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {selectedTemplate.variables.map((variable) => (
                      <div key={variable} className="space-y-2">
                        <Label>{`{{${variable}}}`}</Label>
                        <Input
                          value={parameterValues[variable] || ''}
                          onChange={(event) =>
                            setParameterValues((current) => ({
                              ...current,
                              [variable]: event.target.value,
                            }))
                          }
                          placeholder="{{contact_name}}"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                  Macro yang bisa dipakai di nilai parameter: {'{{contact_name}}'}, {'{{phone_number}}'}, {'{{campaign_name}}'}.
                  Kirim hanya ke kontak yang sudah opt-in marketing/notifikasi.
                </div>
              </div>
            ) : (
              <div className="px-5 pb-5">
                <WhatsAppStateCard
                  tone="warning"
                  icon={<FileWarningIcon />}
                  title="Belum ada template approved."
                  description="Sync atau buat template di halaman Templates, lalu tunggu approval Meta sebelum broadcast."
                />
              </div>
            )}
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Pilih Penerima
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Penerima diambil dari kontak WhatsApp yang sudah tersimpan di modul.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectVisible} disabled={loading}>
                  Pilih hasil filter
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedPhones([])}>
                  Kosongkan
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-4 p-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative flex-1 xl:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={contactSearch}
                  onChange={(event) => setContactSearch(event.target.value)}
                  placeholder="Cari nama, nomor, atau provider"
                  className="pl-9"
                />
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {formatNumber(selectedContacts.length)} / {formatNumber(maxRecipients)} penerima
              </div>
            </div>

            <ScrollArea className="h-[420px]">
              <div className="space-y-2 p-3">
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="mt-3 h-3 w-28" />
                    </div>
                  ))
                ) : filteredContacts.length === 0 ? (
                  <WhatsAppStateCard
                    icon={<Users className="h-5 w-5" />}
                    title="Tidak ada kontak untuk filter ini."
                    description="Jalankan Sync Kirimdev di Chats atau tunggu webhook kontak masuk."
                  />
                ) : (
                  filteredContacts.map((contact) => {
                    const phone = normalizePhone(contact.phoneNumber);
                    const checked = selectedPhones.includes(phone);
                    return (
                      <button
                        key={`${contact.channelId}:${contact.id}:${phone}`}
                        type="button"
                        onClick={() => togglePhone(phone)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-950/40"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Checkbox
                            checked={checked}
                            onClick={(event) => event.stopPropagation()}
                            onCheckedChange={() => togglePhone(phone)}
                          />
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-900 dark:text-slate-100">
                              {contact.name || formatPhoneNumber(contact.phoneNumber)}
                            </div>
                            <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {formatPhoneNumber(contact.phoneNumber)}
                            </div>
                          </div>
                        </div>
                        <ProviderBadge provider={contact.provider} />
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 p-5 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Review & Safety
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Cek ringkasan sebelum mengirim ke Kirimdev.
              </p>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Template
                  </div>
                  <div className="mt-2 truncate font-semibold text-slate-900 dark:text-slate-100">
                    {selectedTemplate?.name || '-'}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Penerima
                  </div>
                  <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">
                    {formatNumber(selectedContacts.length)}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Penerima terpilih
                </div>
                <ScrollArea className="h-[150px]">
                  <div className="space-y-2">
                    {selectedContacts.length === 0 ? (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        Belum ada kontak dipilih.
                      </div>
                    ) : (
                      selectedContacts.map((contact) => (
                        <div
                          key={`${contact.id}:${contact.phoneNumber}`}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="truncate text-slate-700 dark:text-slate-200">
                            {contact.name || formatPhoneNumber(contact.phoneNumber)}
                          </span>
                          <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                            {formatPhoneNumber(contact.phoneNumber)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                <Checkbox
                  checked={acknowledgedOptIn}
                  onCheckedChange={(checked) => setAcknowledgedOptIn(checked === true)}
                  className="mt-1"
                />
                <span>
                  Saya konfirmasi penerima broadcast ini sudah opt-in dan kontennya relevan.
                </span>
              </label>

              <Button
                className="w-full"
                onClick={() => void handleSend()}
                disabled={
                  sending ||
                  !selectedTemplate ||
                  selectedContacts.length === 0 ||
                  selectedContacts.length > maxRecipients ||
                  !acknowledgedOptIn
                }
              >
                {sending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Kirim Broadcast
              </Button>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 p-5 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Riwayat Broadcast
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Total sukses {formatNumber(totalSent)}, gagal {formatNumber(totalFailed)}.
              </p>
            </div>
            <div className="p-3">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 w-full" />
                  ))}
                </div>
              ) : broadcasts.length === 0 ? (
                <WhatsAppStateCard
                  icon={<Megaphone className="h-5 w-5" />}
                  title="Belum ada broadcast dari app."
                  description="Broadcast yang dikirim dari halaman ini akan muncul sebagai audit ringkas."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Hasil</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {broadcasts.map((broadcast) => (
                      <TableRow key={broadcast.id}>
                        <TableCell>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {broadcast.campaignName}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {broadcast.templateName} / {broadcast.language}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {formatDateTime(broadcast.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <BroadcastStatusBadge status={broadcast.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {formatNumber(broadcast.successCount)} / {formatNumber(broadcast.recipientCount)}
                          </div>
                          {broadcast.failureCount > 0 ? (
                            <div className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                              {formatNumber(broadcast.failureCount)} gagal
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </div>
      </div>
    </WhatsAppModuleFrame>
  );
}

function FileWarningIcon() {
  return <AlertTriangle className="h-5 w-5" />;
}
