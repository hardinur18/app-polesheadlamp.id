import React from 'react';
import {
  AlertTriangle,
  FileText,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  UploadCloud,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
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
import { Textarea } from '@/app/components/ui/textarea';
import {
  createKirimdevTemplate,
  fetchKirimdevTemplates,
  syncKirimdevTemplates,
  type CreateWhatsAppTemplateInput,
  type WhatsAppTemplate,
  type WhatsAppTemplateStatus,
} from '@/app/services/whatsappModuleService';
import { WhatsAppModuleFrame } from './components/WhatsAppModuleFrame';
import {
  WhatsAppStateCard,
  formatDateTime,
  formatNumber,
} from './components/whatsappModuleShared';

const TEMPLATE_STATUS_FILTERS: Array<{ id: WhatsAppTemplateStatus | 'all'; label: string }> = [
  { id: 'all', label: 'Semua' },
  { id: 'approved', label: 'Approved' },
  { id: 'pending', label: 'Pending' },
  { id: 'rejected', label: 'Rejected' },
];

const TEMPLATE_CATEGORIES: Array<CreateWhatsAppTemplateInput['category']> = [
  'MARKETING',
  'UTILITY',
  'AUTHENTICATION',
];

function extractVariables(text: string) {
  const matches = Array.from(text.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g));
  return Array.from(new Set(matches.map((match) => match[1]).filter(Boolean)));
}

function TemplateStatusBadge({ status }: { status: WhatsAppTemplateStatus }) {
  const className =
    status === 'approved'
      ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300'
      : status === 'pending'
        ? 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300'
        : 'border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300';

  return (
    <Badge variant="outline" className={className}>
      {status}
    </Badge>
  );
}

export function WhatsAppTemplatesPage() {
  const [templates, setTemplates] = React.useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<WhatsAppTemplateStatus | 'all'>('all');
  const [name, setName] = React.useState('');
  const [category, setCategory] =
    React.useState<CreateWhatsAppTemplateInput['category']>('UTILITY');
  const [language, setLanguage] = React.useState('id');
  const [bodyText, setBodyText] = React.useState('Halo {{1}}, pesanan Anda sedang diproses.');
  const [exampleValues, setExampleValues] = React.useState<string[]>(['Budi']);

  const load = React.useCallback(async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const payload = await fetchKirimdevTemplates({ status: 'all', limit: 100 });
      setTemplates(payload.templates);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat template Kirimdev.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const variables = React.useMemo(() => extractVariables(bodyText), [bodyText]);

  React.useEffect(() => {
    setExampleValues((current) =>
      variables.map((_, index) => current[index] || `Contoh ${index + 1}`),
    );
  }, [variables]);

  const filteredTemplates = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return templates.filter((template) => {
      if (statusFilter !== 'all' && template.status !== statusFilter) return false;
      if (!query) return true;
      const haystack = [
        template.name,
        template.language,
        template.category,
        template.content,
        template.variables.join(' '),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [search, statusFilter, templates]);

  const handleSync = React.useCallback(async () => {
    setSyncing(true);
    try {
      const payload = await syncKirimdevTemplates();
      setTemplates(payload.templates);
      toast.success(`Sync template selesai: ${formatNumber(payload.templates.length)} template.`);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal sync template Kirimdev.');
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleCreate = React.useCallback(async () => {
    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName || !bodyText.trim()) {
      toast.error('Nama dan isi BODY template wajib diisi.');
      return;
    }

    setCreating(true);
    try {
      await createKirimdevTemplate({
        name: normalizedName,
        category,
        language: language.trim() || 'id',
        bodyText: bodyText.trim(),
        exampleValues,
      });
      toast.success('Template dikirim ke Kirimdev untuk review Meta.');
      setName('');
      await load({ silent: true });
    } catch (err: any) {
      toast.error(err?.message || 'Gagal membuat template.');
    } finally {
      setCreating(false);
    }
  }, [bodyText, category, exampleValues, language, load, name]);

  const approvedCount = templates.filter((template) => template.status === 'approved').length;
  const pendingCount = templates.filter((template) => template.status === 'pending').length;
  const rejectedCount = templates.filter((template) => template.status === 'rejected').length;

  return (
    <WhatsAppModuleFrame
      activeId="whatsapp-templates"
      stats={[
        { label: 'Total Template', value: formatNumber(templates.length) },
        { label: 'Approved', value: formatNumber(approvedCount) },
        { label: 'Pending', value: formatNumber(pendingCount) },
        { label: 'Rejected', value: formatNumber(rejectedCount) },
      ]}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void handleSync()} disabled={syncing || loading}>
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            Sync Kirimdev
          </Button>
          <Button
            variant="outline"
            onClick={() => void load({ silent: true })}
            disabled={refreshing || loading || syncing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      }
    >
      {error ? (
        <WhatsAppStateCard
          tone="danger"
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Template belum berhasil dimuat."
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Coba lagi
            </Button>
          }
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Template Kirimdev
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Template approved bisa dipakai untuk broadcast dan pesan di luar window 24 jam.
                </p>
              </div>
            </div>
            <Badge variant="outline">{formatNumber(filteredTemplates.length)}</Badge>
          </div>

          <div className="flex flex-col gap-4 p-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative flex-1 xl:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama, bahasa, isi, atau variabel"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {TEMPLATE_STATUS_FILTERS.map((filter) => (
                <Button
                  key={filter.id}
                  variant={statusFilter === filter.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(filter.id)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          <ScrollArea className="h-[560px]">
            <div className="p-3">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="mt-3 h-3 w-full" />
                    </div>
                  ))}
                </div>
              ) : filteredTemplates.length === 0 ? (
                <WhatsAppStateCard
                  icon={<FileText className="h-5 w-5" />}
                  title="Belum ada template untuk filter ini."
                  description="Sync dari Kirimdev atau buat template body-only baru. Template baru tetap perlu approval Meta sebelum bisa dipakai broadcast."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Variabel</TableHead>
                      <TableHead>Update</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates.map((template) => (
                      <TableRow key={`${template.name}:${template.language}`}>
                        <TableCell>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {template.name}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {template.content || 'Konten template belum tersedia dari Kirimdev.'}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="outline">{template.language}</Badge>
                            {template.category ? <Badge variant="outline">{template.category}</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <TemplateStatusBadge status={template.status} />
                        </TableCell>
                        <TableCell>
                          {template.variables.length > 0 ? (
                            <div className="flex max-w-[220px] flex-wrap gap-1">
                              {template.variables.map((variable) => (
                                <Badge key={variable} variant="outline">
                                  {`{{${variable}}}`}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500 dark:text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(template.updatedAt || template.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </ScrollArea>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Buat Template Body
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Kirim template sederhana ke Kirimdev untuk review Meta.
            </p>
          </div>
          <div className="space-y-4 p-5">
            <div className="space-y-2">
              <Label>Nama template</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="order_update"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as CreateWhatsAppTemplateInput['category'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bahasa</Label>
                <Input value={language} onChange={(event) => setLanguage(event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>BODY</Label>
              <Textarea
                value={bodyText}
                onChange={(event) => setBodyText(event.target.value)}
                className="min-h-[140px]"
              />
            </div>
            {variables.length > 0 ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Contoh variabel
                </div>
                {variables.map((variable, index) => (
                  <div key={variable} className="space-y-2">
                    <Label>{`{{${variable}}}`}</Label>
                    <Input
                      value={exampleValues[index] || ''}
                      onChange={(event) =>
                        setExampleValues((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            ) : null}
            <Button className="w-full" onClick={() => void handleCreate()} disabled={creating}>
              {creating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Buat Template
            </Button>
          </div>
        </Card>
      </div>
    </WhatsAppModuleFrame>
  );
}
