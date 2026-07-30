import React from 'react';
import {
  AlertTriangle,
  ContactRound,
  Gauge,
  Inbox,
  Loader2,
  MessageCircle,
  MessagesSquare,
  RefreshCcw,
  Smartphone,
  TimerReset,
  Trophy,
  Users,
} from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { cn } from '@/app/components/ui/utils';
import {
  fetchWhatsAppOverview,
  type WhatsAppAccount,
  type WhatsAppConversation,
  type WhatsAppCsPerformance,
  type WhatsAppCsPerformanceStatus,
  type WhatsAppOverviewResponse,
} from '@/app/services/whatsappModuleService';
import {
  formatNumber,
  getInitials,
} from './components/whatsappModuleShared';
import { ui } from './inboxUi';
import { useWhatsAppOverview } from './useWhatsAppOverview';

const AVATAR_COLORS = [
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

function getAvatarClassName(value: string | null | undefined) {
  const key = value || 'whatsapp';
  const index = key.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getConnectedAccountCount(accounts: WhatsAppAccount[]) {
  return accounts.filter((account) => account.status !== 'not_configured').length;
}

function getUnreadConversationCount(conversations: WhatsAppConversation[]) {
  return conversations.reduce((total, conversation) => total + Math.max(conversation.unreadCount || 0, 0), 0);
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return '-';
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} detik`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}d` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}j ${remainingMinutes}m` : `${hours}j`;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return '-';
  return `${Math.round(value * 100)}%`;
}

function getPerformanceStatusLabel(status: WhatsAppCsPerformanceStatus) {
  if (status === 'performing') return 'Perform';
  if (status === 'needs_attention') return 'Evaluasi';
  if (status === 'insufficient_data') return 'Data minim';
  return 'Monitor';
}

function getPerformanceStatusClassName(status: WhatsAppCsPerformanceStatus) {
  if (status === 'performing') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'needs_attention') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'insufficient_data') return 'border-slate-200 bg-slate-50 text-slate-500';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function getPerformanceAvatarKey(row: WhatsAppCsPerformance) {
  return row.csProfileId || row.csDisplayName || row.csWhatsappNumber || 'unassigned';
}

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof MessagesSquare;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={ui.text.label}>{label}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
            {value}
          </div>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof MessagesSquare;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <div className={cn('flex items-center gap-2', ui.text.label)}>
        <Icon className="h-3.5 w-3.5 text-emerald-700" />
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof MessagesSquare;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950 dark:text-slate-100">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function SlaBar({ value }: { value: number | null | undefined }) {
  const pct = Math.max(0, Math.min(100, Math.round((value ?? 0) * 100)));
  const tone = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="mt-1.5 h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center text-slate-500">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
        <Inbox className="h-5 w-5" />
      </div>
      <div className="font-semibold text-slate-900 dark:text-slate-100">{title}</div>
      <p className="max-w-sm text-sm leading-6 dark:text-slate-400">{description}</p>
    </div>
  );
}

export function WhatsAppDashboardPage() {
  // Phase 1: ringkasan + KPI tanpa agregasi berat → tampil instan.
  const { data, loading, refreshing, error, reload } = useWhatsAppOverview({
    includePerformance: false,
    includeMessageCounts: false,
  });

  // Phase 2: Performa CS (agregasi 30 hari) dimuat terpisah agar tidak memblok KPI.
  const [performance, setPerformance] =
    React.useState<WhatsAppOverviewResponse['performance'] | null>(null);
  const [performanceLoading, setPerformanceLoading] = React.useState(true);

  const loadPerformance = React.useCallback(async () => {
    setPerformanceLoading(true);
    try {
      const result = await fetchWhatsAppOverview({
        includePerformance: true,
        includeContacts: false,
        includeMessageCounts: false,
      });
      setPerformance(result.performance ?? null);
    } catch {
      // Biarkan KPI tetap tampil walau Performa CS gagal dimuat.
    } finally {
      setPerformanceLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadPerformance();
  }, [loadPerformance]);

  const accounts = data?.accounts || [];
  const conversations = data?.conversations || [];
  const connectedAccountCount = getConnectedAccountCount(accounts);
  const unreadCount = getUnreadConversationCount(conversations);
  const performanceRows = performance?.cs || [];

  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
      <div className="w-full max-w-[1600px] space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-100">
              Dashboard
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="h-10 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
              onClick={() => {
                void reload({ silent: true });
                void loadPerformance();
              }}
              disabled={loading || refreshing}
            >
              {refreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Dashboard WhatsApp belum berhasil dimuat.</div>
              <div className="mt-1">{error}</div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Percakapan"
            value={formatNumber(data?.diagnostics.conversationCount || 0)}
            icon={MessagesSquare}
          />
          <StatTile
            label="Kontak"
            value={formatNumber(data?.diagnostics.contactCount || 0)}
            icon={ContactRound}
          />
          <StatTile
            label="Nomor aktif"
            value={`${formatNumber(connectedAccountCount)} / ${formatNumber(accounts.length)}`}
            icon={Smartphone}
          />
          <StatTile
            label="Belum dibaca"
            value={formatNumber(unreadCount)}
            icon={MessageCircle}
          />
        </div>

        <Card className="overflow-hidden rounded-xl border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <PanelHeader
            icon={Gauge}
            title="Performa CS"
            action={
              <Badge
                variant="outline"
                className={cn(
                  'rounded-full px-3 py-1',
                  (performance?.totals.needsAttentionCount || 0) > 0
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                )}
              >
                {formatNumber(performance?.totals.needsAttentionCount || 0)} perlu evaluasi
              </Badge>
            }
          />

          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
            <MiniMetric
              label="CS terukur"
              value={formatNumber(performance?.totals.csCount || 0)}
              icon={Users}
            />
            <MiniMetric
              label="Avg response"
              value={formatDuration(performance?.totals.avgResponseSeconds)}
              icon={TimerReset}
            />
            <MiniMetric
              label="SLA hit"
              value={formatPercent(performance?.totals.slaHitRate)}
              icon={Gauge}
            />
            <MiniMetric
              label="Closing WA"
              value={`${formatNumber(performance?.totals.closing || 0)} / ${formatNumber(performance?.totals.leads || 0)}`}
              icon={Trophy}
            />
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[920px]">
              <TableHeader className="bg-slate-50 dark:bg-slate-950">
                <TableRow className="border-slate-200 hover:bg-transparent dark:border-slate-800">
                  <TableHead className="h-11 pl-5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    CS
                  </TableHead>
                  <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Response
                  </TableHead>
                  <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    SLA
                  </TableHead>
                  <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Lead & closing
                  </TableHead>
                  <TableHead className="h-11 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Evaluasi
                  </TableHead>
                  <TableHead className="h-11 pr-5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Score
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performanceLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index} className="h-[82px] border-slate-200/70 dark:border-slate-800">
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-9 w-9 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                      <TableCell className="pr-5"><Skeleton className="ml-auto h-6 w-20 rounded-full" /></TableCell>
                    </TableRow>
                  ))
                ) : performanceRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <EmptyState
                        title="Belum ada performa CS yang bisa dihitung."
                        description="Metrik akan muncul setelah pesan WhatsApp dan prospek Auto WA API punya mapping CS."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  performanceRows.map((row) => (
                    <TableRow
                      key={row.csProfileId || row.csDisplayName}
                      className="h-[82px] border-slate-200/70 hover:bg-emerald-50/30 dark:border-slate-800 dark:hover:bg-slate-950/50"
                    >
                      <TableCell className="pl-5">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                              getAvatarClassName(getPerformanceAvatarKey(row)),
                            )}
                          >
                            {getInitials(row.csDisplayName)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-950 dark:text-slate-100">
                              {row.csDisplayName}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {formatNumber(row.conversationCount)} chat, {formatNumber(row.accountCount)} akun
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                          {formatDuration(row.avgResponseSeconds)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          median {formatDuration(row.medianResponseSeconds)}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                          {formatPercent(row.slaHitRate)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatNumber(row.slaBreachedCount)} breach, {formatNumber(row.unansweredConversationCount)} pending
                        </div>
                        <SlaBar value={row.slaHitRate} />
                      </TableCell>

                      <TableCell>
                        <div className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                          {formatNumber(row.closing)} closing / {formatNumber(row.leads)} lead
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          conversion {formatPercent(row.conversionRate)}
                        </div>
                      </TableCell>

                      <TableCell className="max-w-[240px]">
                        <div className="flex flex-col gap-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                          {row.evaluation.slice(0, 2).map((item) => (
                            <span key={item} className="truncate" title={item}>
                              {item}
                            </span>
                          ))}
                        </div>
                      </TableCell>

                      <TableCell className="pr-5 text-right">
                        <Badge
                          variant="outline"
                          className={cn('rounded-full px-2 py-1', getPerformanceStatusClassName(row.status))}
                        >
                          {getPerformanceStatusLabel(row.status)}
                        </Badge>
                        {row.score === null ? (
                          <div className="mt-1.5 text-xs text-slate-400">-</div>
                        ) : (
                          <div className="mt-1.5">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                row.score >= 80
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200'
                                  : row.score >= 60
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200'
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200',
                              )}
                            >
                              {formatNumber(row.score)}/100
                            </span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

      </div>
    </div>
  );
}
