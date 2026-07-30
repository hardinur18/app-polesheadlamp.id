import React from 'react';
import type { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Inbox,
  Instagram,
  Loader2,
  MessageCircle,
  RefreshCcw,
  Search,
  Send,
  Smartphone,
  Sparkles,
  Users,
  Wifi,
} from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback } from '@/app/components/ui/avatar';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { SmartFilterDate } from '@/app/components/SmartFilterDate';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Separator } from '@/app/components/ui/separator';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Textarea } from '@/app/components/ui/textarea';
import { cn } from '@/app/components/ui/utils';
import {
  fetchConversationDailyInboxStats,
  fetchConversationInboxOverview,
  fetchConversationMessages,
  sendConversationMessage,
  syncConversationChannels,
  type ConversationChannel,
  type ConversationDailyInboxBucket,
  type ConversationDailyInboxStatsResponse,
  type ConversationMessage,
  type ConversationOverviewItem,
  type ConversationPlatform,
} from '@/app/services/conversationCenterService';
import { minutesToMs, useUsageControlSettings } from '@/app/services/usageControlSettings';
import { ConversationWorkspaceFrame } from './components/ConversationWorkspaceFrame';

const PLATFORM_FILTERS: Array<{ id: 'all' | ConversationPlatform; label: string }> = [
  { id: 'all', label: 'Semua' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook_page', label: 'Messenger' },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value || 0);
}

function formatConversationTime(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    ...(sameDay
      ? {}
      : {
          day: '2-digit',
          month: 'short',
        }),
  }).format(date);
}

function formatLastUpdated(value: string | null) {
  if (!value) return 'belum pernah';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'belum pernah';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDailyDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function formatJakartaDateKey(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function shiftDateKey(dateKey: string, offsetDays: number) {
  const anchor = new Date(`${dateKey}T12:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() + offsetDays);
  return anchor.toISOString().slice(0, 10);
}

function isDateKeyWithinRange(dateKey: string | null, range: DateRange | undefined) {
  if (!dateKey) return false;
  if (!range?.from) return true;

  const fromKey = formatJakartaDateKey(range.from.toISOString());
  const toKey = formatJakartaDateKey((range.to || range.from).toISOString());
  if (!fromKey || !toKey) return true;

  return dateKey >= fromKey && dateKey <= toKey;
}

function formatDateRangeLabel(range: DateRange | undefined) {
  if (!range?.from) return 'Semua Tanggal';
  const fromKey = formatJakartaDateKey(range.from.toISOString());
  const toKey = formatJakartaDateKey((range.to || range.from).toISOString());
  if (!fromKey || !toKey) return 'Semua Tanggal';
  if (fromKey === toKey) return formatDailyDate(fromKey);
  return `${formatDailyDate(fromKey)} - ${formatDailyDate(toKey)}`;
}

function buildFallbackDailyBuckets(conversations: ConversationOverviewItem[]) {
  const buckets = new Map<string, ConversationDailyInboxBucket & { contactSet: Set<string>; instagramSet: Set<string>; messengerSet: Set<string> }>();

  for (const conversation of conversations) {
    if (conversation.platform !== 'instagram' && conversation.platform !== 'facebook_page') {
      continue;
    }

    const dateKey = formatJakartaDateKey(conversation.lastMessageAt);
    if (!dateKey) continue;

    const existing = buckets.get(dateKey) || {
      date: dateKey,
      inboundMessages: 0,
      newConversations: 0,
      uniqueContacts: 0,
      instagramInboundMessages: 0,
      instagramNewConversations: 0,
      instagramUniqueContacts: 0,
      messengerInboundMessages: 0,
      messengerNewConversations: 0,
      messengerUniqueContacts: 0,
      contactSet: new Set<string>(),
      instagramSet: new Set<string>(),
      messengerSet: new Set<string>(),
    };

    existing.inboundMessages += 1;
    existing.newConversations += 1;
    existing.contactSet.add(conversation.contactId);

    if (conversation.platform === 'instagram') {
      existing.instagramInboundMessages += 1;
      existing.instagramNewConversations += 1;
      existing.instagramSet.add(conversation.contactId);
    } else {
      existing.messengerInboundMessages += 1;
      existing.messengerNewConversations += 1;
      existing.messengerSet.add(conversation.contactId);
    }

    buckets.set(dateKey, existing);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      date: bucket.date,
      inboundMessages: bucket.inboundMessages,
      newConversations: bucket.newConversations,
      uniqueContacts: bucket.contactSet.size,
      instagramInboundMessages: bucket.instagramInboundMessages,
      instagramNewConversations: bucket.instagramNewConversations,
      instagramUniqueContacts: bucket.instagramSet.size,
      messengerInboundMessages: bucket.messengerInboundMessages,
      messengerNewConversations: bucket.messengerNewConversations,
      messengerUniqueContacts: bucket.messengerSet.size,
    }))
    .sort((left, right) => right.date.localeCompare(left.date));
}

function describeDailyBucket(label: string, bucket: ConversationDailyInboxBucket | null) {
  return {
    label,
    newConversations: bucket?.newConversations || 0,
    inboundMessages: bucket?.inboundMessages || 0,
    uniqueContacts: bucket?.uniqueContacts || 0,
  };
}

function getConversationGroupLabel(platform: ConversationPlatform) {
  return platform === 'instagram' ? 'Instagram' : platform === 'facebook_page' ? 'Messenger' : 'Lainnya';
}

function getPlatformLabel(platform: ConversationPlatform) {
  switch (platform) {
    case 'instagram':
      return 'Instagram';
    case 'facebook_page':
      return 'Messenger';
    case 'whatsapp':
      return 'WhatsApp';
    default:
      return platform;
  }
}

function getPlatformIcon(platform: ConversationPlatform) {
  switch (platform) {
    case 'instagram':
      return <Instagram className="h-4 w-4" />;
    case 'facebook_page':
      return <MessageCircle className="h-4 w-4" />;
    case 'whatsapp':
      return <Smartphone className="h-4 w-4" />;
    default:
      return <Inbox className="h-4 w-4" />;
  }
}

function buildConversationSelectionKey(conversation: Pick<ConversationOverviewItem, 'id' | 'channelId'>) {
  return `${conversation.channelId}::${conversation.id}`;
}

function getInitials(name: string | null) {
  if (!name) return '??';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || '')
    .join('');
}

export function ConversationLiveInboxPage() {
  const usageControlSettings = useUsageControlSettings();
  const overviewRefreshMs = minutesToMs(usageControlSettings.conversationOverviewRefreshMinutes);
  const messageRefreshMs = minutesToMs(usageControlSettings.conversationMessageRefreshMinutes);
  const [overview, setOverview] = React.useState<Awaited<
    ReturnType<typeof fetchConversationInboxOverview>
  > | null>(null);
  const [dailyStats, setDailyStats] = React.useState<ConversationDailyInboxStatsResponse | null>(null);
  const [messages, setMessages] = React.useState<ConversationMessage[]>([]);
  const [search, setSearch] = React.useState('');
  const [platformFilter, setPlatformFilter] = React.useState<'all' | ConversationPlatform>('all');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(() => ({
    from: subDays(new Date(), 29),
    to: new Date(),
  }));
  const [selectedConversationKey, setSelectedConversationKey] = React.useState<string | null>(null);
  const [composerText, setComposerText] = React.useState('');
  const [overviewLoading, setOverviewLoading] = React.useState(true);
  const [overviewRefreshing, setOverviewRefreshing] = React.useState(false);
  const [messagesLoading, setMessagesLoading] = React.useState(false);
  const [syncingChannels, setSyncingChannels] = React.useState(false);
  const [sendingMessage, setSendingMessage] = React.useState(false);
  const [overviewError, setOverviewError] = React.useState<string | null>(null);
  const [dailyStatsError, setDailyStatsError] = React.useState<string | null>(null);
  const [messagesError, setMessagesError] = React.useState<string | null>(null);
  const [lastOverviewAt, setLastOverviewAt] = React.useState<string | null>(null);
  const messageViewportRef = React.useRef<HTMLDivElement | null>(null);

  const loadOverview = React.useCallback(
    async (options?: { silent?: boolean; syncAssets?: boolean }) => {
      const silent = options?.silent ?? false;
      const syncAssets = options?.syncAssets ?? false;

      if (syncAssets) {
        setSyncingChannels(true);
      } else if (silent) {
        setOverviewRefreshing(true);
      } else {
        setOverviewLoading(true);
      }

      try {
        if (syncAssets) {
          await syncConversationChannels();
        }

        let payload = await fetchConversationInboxOverview();

        if (
          !syncAssets &&
          payload.channels.length === 0 &&
          payload.conversations.length === 0
        ) {
          await syncConversationChannels();
          payload = await fetchConversationInboxOverview();
        }

        setOverview(payload);
        setOverviewError(null);
        setLastOverviewAt(new Date().toISOString());

        try {
          const statsPayload = await fetchConversationDailyInboxStats(90);
          setDailyStats(statsPayload);
          setDailyStatsError(null);
        } catch (statsError: any) {
          setDailyStatsError(statsError?.message || 'Gagal memuat statistik inbox harian.');
        }

        setSelectedConversationKey((previousKey) => {
          if (!payload.conversations.length) return null;
          if (
            previousKey &&
            payload.conversations.some(
              (conversation) => buildConversationSelectionKey(conversation) === previousKey,
            )
          ) {
            return previousKey;
          }
          return buildConversationSelectionKey(payload.conversations[0]);
        });
      } catch (error: any) {
        setOverviewError(error?.message || 'Gagal memuat Kotak Masuk Live.');
      } finally {
        setOverviewLoading(false);
        setOverviewRefreshing(false);
        setSyncingChannels(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void loadOverview({ silent: true });
    }, overviewRefreshMs);

    return () => window.clearInterval(intervalId);
  }, [loadOverview, overviewRefreshMs]);

  const todayDateKey = React.useMemo(
    () => formatJakartaDateKey(new Date().toISOString()) || new Date().toISOString().slice(0, 10),
    [],
  );

  const filteredConversations = React.useMemo(() => {
    const rows = overview?.conversations || [];
    const normalizedQuery = search.trim().toLowerCase();

    return rows.filter((conversation) => {
      if (platformFilter !== 'all' && conversation.platform !== platformFilter) {
        return false;
      }

      if (!isDateKeyWithinRange(formatJakartaDateKey(conversation.lastMessageAt), dateRange)) {
        return false;
      }

      if (!normalizedQuery) return true;

      const haystack = [
        conversation.contactName,
        conversation.contactHandle,
        conversation.channelLabel,
        conversation.pageName,
        conversation.lastMessageText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [dateRange, overview?.conversations, platformFilter, search]);

  const groupedConversations = React.useMemo(() => {
    const groups: Array<{
      platform: ConversationPlatform;
      label: string;
      rows: ConversationOverviewItem[];
    }> = [];

    const platformOrder: ConversationPlatform[] =
      platformFilter === 'all'
        ? ['instagram', 'facebook_page', 'whatsapp']
        : [platformFilter as ConversationPlatform];

    for (const platform of platformOrder) {
      const rows = filteredConversations.filter((conversation) => conversation.platform === platform);
      if (rows.length === 0) continue;
      groups.push({
        platform,
        label: getConversationGroupLabel(platform),
        rows,
      });
    }

    return groups;
  }, [filteredConversations, platformFilter]);

  React.useEffect(() => {
    if (!filteredConversations.length) {
      setSelectedConversationKey(null);
      return;
    }

    if (
      !selectedConversationKey ||
      !filteredConversations.some(
        (conversation) => buildConversationSelectionKey(conversation) === selectedConversationKey,
      )
    ) {
      setSelectedConversationKey(buildConversationSelectionKey(filteredConversations[0]));
    }
  }, [filteredConversations, selectedConversationKey]);

  const selectedConversation = React.useMemo(
    () =>
      filteredConversations.find(
        (conversation) => buildConversationSelectionKey(conversation) === selectedConversationKey,
      ) || null,
    [filteredConversations, selectedConversationKey],
  );

  const selectedChannel = React.useMemo(
    () =>
      overview?.channels.find((channel) => channel.id === selectedConversation?.channelId) || null,
    [overview?.channels, selectedConversation?.channelId],
  );

  const loadMessages = React.useCallback(async (conversation: ConversationOverviewItem) => {
    setMessagesLoading(true);
    try {
      const payload = await fetchConversationMessages({
        channelId: conversation.channelId,
        conversationId: conversation.id,
      });
      setMessages(payload.messages);
      setMessagesError(null);
    } catch (error: any) {
      setMessagesError(error?.message || 'Gagal memuat isi percakapan.');
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      setMessagesError(null);
      return;
    }

    void loadMessages(selectedConversation);

    const intervalId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void loadMessages(selectedConversation);
    }, messageRefreshMs);

    return () => window.clearInterval(intervalId);
  }, [loadMessages, messageRefreshMs, selectedConversation]);

  React.useEffect(() => {
    const viewport = messageViewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  const totalUnread = React.useMemo(
    () => (overview?.conversations || []).reduce((sum, conversation) => sum + conversation.unreadCount, 0),
    [overview?.conversations],
  );

  const activeChannelCount = React.useMemo(
    () =>
      (overview?.channels || []).filter(
        (channel) => channel.platform === 'whatsapp' || channel.supportsMessaging,
      ).length,
    [overview?.channels],
  );

  const liveErrorCount = overview?.diagnostics.liveErrors.length || 0;
  const fallbackDailyBuckets = React.useMemo(
    () => buildFallbackDailyBuckets(overview?.conversations || []),
    [overview?.conversations],
  );
  const hasWebhookDailyStats = Boolean(dailyStats?.latestStoredEventAt);
  const visibleDailyBuckets = React.useMemo(() => {
    const rows = hasWebhookDailyStats ? dailyStats?.days || [] : fallbackDailyBuckets;
    return rows.filter((bucket) => isDateKeyWithinRange(bucket.date, dateRange));
  }, [dailyStats?.days, dateRange, fallbackDailyBuckets, hasWebhookDailyStats]);
  const summarizeBuckets = React.useCallback((rows: ConversationDailyInboxBucket[]) => {
    return rows.reduce(
      (accumulator, row) => ({
        date: rows[0]?.date || todayDateKey,
        inboundMessages: accumulator.inboundMessages + row.inboundMessages,
        newConversations: accumulator.newConversations + row.newConversations,
        uniqueContacts: accumulator.uniqueContacts + row.uniqueContacts,
        instagramInboundMessages: accumulator.instagramInboundMessages + row.instagramInboundMessages,
        instagramNewConversations: accumulator.instagramNewConversations + row.instagramNewConversations,
        instagramUniqueContacts: accumulator.instagramUniqueContacts + row.instagramUniqueContacts,
        messengerInboundMessages: accumulator.messengerInboundMessages + row.messengerInboundMessages,
        messengerNewConversations: accumulator.messengerNewConversations + row.messengerNewConversations,
        messengerUniqueContacts: accumulator.messengerUniqueContacts + row.messengerUniqueContacts,
      }),
      {
        date: todayDateKey,
        inboundMessages: 0,
        newConversations: 0,
        uniqueContacts: 0,
        instagramInboundMessages: 0,
        instagramNewConversations: 0,
        instagramUniqueContacts: 0,
        messengerInboundMessages: 0,
        messengerNewConversations: 0,
        messengerUniqueContacts: 0,
      } satisfies ConversationDailyInboxBucket,
    );
  }, [todayDateKey]);
  const selectedRangeSummary = React.useMemo(
    () => summarizeBuckets(visibleDailyBuckets),
    [summarizeBuckets, visibleDailyBuckets],
  );
  const todayDailyStats = React.useMemo(
    () =>
      describeDailyBucket(
        'Rentang Dipilih',
        visibleDailyBuckets.length ? selectedRangeSummary : null,
      ),
    [selectedRangeSummary, visibleDailyBuckets.length],
  );
  const yesterdayDailyStats = React.useMemo(
    () =>
      describeDailyBucket(
        'Instagram',
        visibleDailyBuckets.length
          ? {
              ...selectedRangeSummary,
              newConversations: selectedRangeSummary.instagramNewConversations,
              inboundMessages: selectedRangeSummary.instagramInboundMessages,
              uniqueContacts: selectedRangeSummary.instagramUniqueContacts,
            }
          : null,
      ),
    [selectedRangeSummary, visibleDailyBuckets.length],
  );
  const last7DailyStats = React.useMemo(
    () =>
      describeDailyBucket(
        'Messenger',
        visibleDailyBuckets.length
          ? {
              ...selectedRangeSummary,
              newConversations: selectedRangeSummary.messengerNewConversations,
              inboundMessages: selectedRangeSummary.messengerInboundMessages,
              uniqueContacts: selectedRangeSummary.messengerUniqueContacts,
            }
          : null,
      ),
    [selectedRangeSummary, visibleDailyBuckets.length],
  );
  const activeDateRangeLabel = React.useMemo(() => formatDateRangeLabel(dateRange), [dateRange]);

  const applySingleDateRange = React.useCallback((dateKey: string) => {
    const date = new Date(`${dateKey}T12:00:00`);
    setDateRange({ from: date, to: date });
  }, []);

  const applyPresetDateRange = React.useCallback((fromKey: string, toKey: string) => {
    setDateRange({
      from: new Date(`${fromKey}T12:00:00`),
      to: new Date(`${toKey}T12:00:00`),
    });
  }, []);

  const canSendMessage = Boolean(
    selectedConversation &&
      selectedChannel &&
      !selectedConversation.contactId.startsWith('unknown:') &&
      selectedChannel.supportsMessaging &&
      (selectedConversation.platform !== 'whatsapp' || selectedConversation.provider === 'kirimdev'),
  );

  const sendDisabledReason = React.useMemo(() => {
    if (!selectedConversation) return 'Pilih percakapan terlebih dahulu.';
    if (selectedConversation.platform === 'whatsapp' && selectedConversation.provider !== 'kirimdev') {
      return 'Balas WhatsApp dari Pusat Percakapan memakai provider Kirimdev.';
    }
    if (selectedConversation.contactId.startsWith('unknown:')) {
      return 'Kontak live belum punya ID penerima yang aman untuk dikirimi balasan.';
    }
    if (!selectedChannel?.supportsMessaging) {
      return 'Channel ini belum menandai task messaging aktif.';
    }
    return null;
  }, [selectedChannel?.supportsMessaging, selectedConversation]);

  const handleSendMessage = React.useCallback(async () => {
    if (!selectedConversation || !canSendMessage) return;
    const text = composerText.trim();
    if (!text) return;

    setSendingMessage(true);
    try {
      await sendConversationMessage({
        channelId: selectedConversation.channelId,
        recipientId: selectedConversation.contactId,
        text,
      });
      setComposerText('');
      toast.success('Pesan berhasil dikirim.');
      await Promise.all([loadMessages(selectedConversation), loadOverview({ silent: true })]);
    } catch (error: any) {
      toast.error(error?.message || 'Gagal mengirim pesan.');
    } finally {
      setSendingMessage(false);
    }
  }, [canSendMessage, composerText, loadMessages, loadOverview, selectedConversation]);

  return (
    <ConversationWorkspaceFrame
      title="Pusat Percakapan • Kotak Masuk Live"
      description="Inbox realtime omnichannel untuk Messenger, Instagram DM, dan WhatsApp dalam satu workspace. Messenger dan Instagram dibaca langsung live dari Meta, sedangkan WhatsApp mengikuti event webhook yang sudah masuk ke server."
      badges={['Pusat Percakapan', 'Omnichannel', 'Live']}
      stats={[
        {
          label: 'Percakapan Aktif',
          value: formatNumber(overview?.conversations.length || 0),
          hint: 'Thread live yang berhasil dibaca dari Meta dan penyimpanan webhook.',
        },
        {
          label: 'Belum Dibaca',
          value: formatNumber(totalUnread),
          hint: 'Akumulasi unread dari thread yang sedang tersedia.',
        },
        {
          label: 'Channel Aktif',
          value: formatNumber(activeChannelCount),
          hint: 'Channel dengan messaging aktif atau WhatsApp webhook yang sudah dikenali.',
        },
        {
          label: 'Gangguan Sinkron',
          value: formatNumber(liveErrorCount),
          hint: lastOverviewAt ? `Terakhir dicek ${formatLastUpdated(lastOverviewAt)}.` : 'Menunggu sinkron pertama.',
        },
      ]}
      actions={
        <>
          <Button
            variant="outline"
            onClick={() => void loadOverview({ silent: true })}
            disabled={overviewRefreshing || overviewLoading}
          >
            {overviewRefreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Refresh Live
          </Button>
          <Button
            variant="default"
            onClick={() => void loadOverview({ syncAssets: true })}
            disabled={syncingChannels}
          >
            {syncingChannels ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wifi className="mr-2 h-4 w-4" />
            )}
            Sinkron Channel
          </Button>
        </>
      }
    >
      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative flex-1 xl:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama kontak, handle, channel, atau cuplikan pesan"
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PLATFORM_FILTERS.map((filter) => {
              const active = platformFilter === filter.id;
              return (
                <Button
                  key={filter.id}
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPlatformFilter(filter.id)}
                >
                  {filter.label}
                </Button>
              );
            })}
            <SmartFilterDate date={dateRange} setDate={setDateRange} className="w-full md:w-[280px]" />
          </div>
        </div>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950/30 dark:text-blue-300">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Kotak Masuk Harian
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Tracking DM Instagram dan Messenger per tanggal. Saat histori webhook belum tersedia, panel ini fallback ke aktivitas thread live berdasarkan waktu pesan terakhir. Tanggal mengikuti WIB.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{activeDateRangeLabel}</Badge>
              <Badge variant="outline">Instagram + Messenger</Badge>
              <Badge variant="outline">{hasWebhookDailyStats ? 'Basis: Webhook' : 'Basis: Thread Live'}</Badge>
              <Badge variant="outline">
                Event terakhir {formatLastUpdated(dailyStats?.latestStoredEventAt || null)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              { ...todayDailyStats, label: 'Rentang Dipilih', onClick: () => undefined },
              { ...yesterdayDailyStats, label: 'Instagram', onClick: () => undefined },
              { ...last7DailyStats, label: 'Messenger', onClick: () => undefined },
            ].map((item) => (
              <div
                key={item.label}
                role="button"
                tabIndex={0}
                onClick={item.onClick}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    item.onClick();
                  }
                }}
                className="rounded-2xl border border-slate-200 p-4 transition-colors dark:border-slate-800"
              >
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {item.label}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      Thread
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      {formatNumber(item.newConversations)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      Pesan
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      {formatNumber(item.inboundMessages)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      Kontak
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      {formatNumber(item.uniqueContacts)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {dailyStatsError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              {dailyStatsError}
            </div>
          ) : null}

          {!dailyStatsError && !hasWebhookDailyStats ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              Histori webhook DM belum penuh, jadi hitungan di panel ini sementara memakai tanggal chat terakhir per thread live, bukan tanggal thread dibuat. Setelah event webhook DM mulai tersimpan, angka akan otomatis lebih presisi.
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="pb-3 pr-4 font-medium">Tanggal</th>
                  <th className="pb-3 pr-4 font-medium">IG Thread</th>
                  <th className="pb-3 pr-4 font-medium">IG Aktivitas</th>
                  <th className="pb-3 pr-4 font-medium">IG Kontak</th>
                  <th className="pb-3 pr-4 font-medium">MSG Thread</th>
                  <th className="pb-3 pr-4 font-medium">MSG Aktivitas</th>
                  <th className="pb-3 font-medium">MSG Kontak</th>
                </tr>
              </thead>
              <tbody>
                {visibleDailyBuckets.slice(0, 31).map((bucket) => (
                  <tr
                    key={bucket.date}
                    className="cursor-pointer border-b border-slate-100 last:border-b-0 dark:border-slate-800/70"
                    onClick={() => applySingleDateRange(bucket.date)}
                  >
                    <td className="py-3 pr-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {formatDailyDate(bucket.date)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{bucket.date}</div>
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                      {formatNumber(bucket.instagramNewConversations)}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                      {formatNumber(bucket.instagramInboundMessages)}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                      {formatNumber(bucket.instagramUniqueContacts)}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                      {formatNumber(bucket.messengerNewConversations)}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                      {formatNumber(bucket.messengerInboundMessages)}
                    </td>
                    <td className="py-3 font-medium text-slate-900 dark:text-slate-100">
                      {formatNumber(bucket.messengerUniqueContacts)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-xs leading-6 text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Filter tanggal di atas sekarang bekerja seperti di advertiser. Klik baris tanggal untuk menyaring daftar chat ke tanggal itu saja. Saat basisnya `Thread Live`, angka merepresentasikan thread yang chat terakhirnya jatuh pada tanggal tersebut. Saat basisnya `Webhook`, angka merepresentasikan event inbound yang tersimpan.
          </div>
        </div>
      </Card>

      {overviewError ? (
        <Card className="border-rose-200 bg-rose-50 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30">
          <div className="flex items-start gap-3 p-5 text-sm text-rose-700 dark:text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Inbox live belum berhasil dimuat.</div>
              <div className="mt-1">{overviewError}</div>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)_320px]">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Daftar Percakapan
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Menampilkan thread yang berhasil ditarik live atau dari webhook store.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{activeDateRangeLabel}</Badge>
              <Badge variant="outline">{formatNumber(filteredConversations.length)}</Badge>
            </div>
          </div>

          <ScrollArea className="h-[620px]">
            <div className="space-y-2 p-3">
              {overviewLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="mt-3 h-4 w-40" />
                    <Skeleton className="mt-3 h-3 w-full" />
                  </div>
                ))
              ) : filteredConversations.length === 0 ? (
                <div className="flex min-h-[320px] items-center justify-center p-6 text-center">
                    <div>
                      <Inbox className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700" />
                      <div className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                        Belum ada percakapan untuk filter ini.
                      </div>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Coba ganti platform, tanggal aktivitas, sinkron channel, atau tunggu event webhook baru masuk.
                      </p>
                    </div>
                  </div>
              ) : (
                groupedConversations.map((group) => (
                  <div key={group.platform} className="space-y-2">
                    {platformFilter === 'all' ? (
                      <div className="sticky top-0 z-10 rounded-xl border border-slate-200 bg-slate-50/95 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-300">
                        {group.label} • {formatNumber(group.rows.length)}
                      </div>
                    ) : null}
                    {group.rows.map((conversation) => {
                      const isActive =
                        buildConversationSelectionKey(conversation) === selectedConversationKey;

                      return (
                        <button
                          key={buildConversationSelectionKey(conversation)}
                          onClick={() => setSelectedConversationKey(buildConversationSelectionKey(conversation))}
                          className={cn(
                            'w-full rounded-2xl border p-4 text-left transition-colors',
                            isActive
                              ? 'border-blue-500 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/20'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-950/40',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar className="h-10 w-10 border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                                <AvatarFallback className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                                  {getInitials(conversation.contactName || conversation.contactHandle)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-slate-900 dark:text-slate-100">
                                  {conversation.contactName || conversation.contactHandle || 'Kontak tanpa nama'}
                                </div>
                                <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                                  {conversation.contactHandle
                                    ? `@${conversation.contactHandle}`
                                    : conversation.channelLabel}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {formatConversationTime(conversation.lastMessageAt)}
                              </div>
                              {conversation.unreadCount > 0 ? (
                                <div className="mt-2 inline-flex min-w-6 items-center justify-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                                  {conversation.unreadCount}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="gap-1">
                              {getPlatformIcon(conversation.platform)}
                              {getPlatformLabel(conversation.platform)}
                            </Badge>
                            <Badge variant="outline">
                              {conversation.source === 'meta-live' ? 'Live' : 'Webhook'}
                            </Badge>
                            {conversation.platform === 'whatsapp' && conversation.provider ? (
                              <Badge
                                variant="outline"
                                className={
                                  conversation.provider === 'kirimdev'
                                    ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300'
                                    : undefined
                                }
                              >
                                {conversation.provider === 'kirimdev' ? 'Kirimdev' : 'Meta'}
                              </Badge>
                            ) : null}
                          </div>

                          <div className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {conversation.lastMessageText || 'Belum ada cuplikan pesan yang tersedia.'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-800">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
                {selectedConversation?.contactName ||
                  selectedConversation?.contactHandle ||
                  'Pilih percakapan'}
              </h2>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                {selectedConversation
                  ? `${selectedConversation.channelLabel} • ${selectedConversation.pageName}`
                  : 'Pilih thread di kiri untuk membaca isi pesan.'}
              </p>
            </div>

            {selectedConversation?.graphLink ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(selectedConversation.graphLink || '#', '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Buka di Meta
              </Button>
            ) : null}
          </div>

          <div className="flex h-[620px] flex-col">
            <div
              ref={messageViewportRef}
              className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
            >
              {selectedConversation == null ? (
                <div className="flex h-full items-center justify-center text-center">
                  <div>
                    <MessageCircle className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700" />
                    <div className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                      Pilih percakapan untuk membuka thread live.
                    </div>
                  </div>
                </div>
              ) : messagesLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        'max-w-[78%] rounded-2xl px-4 py-3',
                        index % 2 === 0
                          ? 'bg-slate-100 dark:bg-slate-800'
                          : 'ml-auto bg-blue-600/10 dark:bg-blue-900/20',
                      )}
                    >
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="mt-3 h-3 w-48" />
                    </div>
                  ))}
                </div>
              ) : messagesError ? (
                <div className="flex h-full items-center justify-center text-center">
                  <div>
                    <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" />
                    <div className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-300">
                      {messagesError}
                    </div>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center">
                  <div>
                    <Inbox className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700" />
                    <div className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                      Belum ada pesan yang bisa dibaca untuk thread ini.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex',
                        message.direction === 'outbound' ? 'justify-end' : 'justify-start',
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[78%] rounded-2xl px-4 py-3 shadow-sm',
                          message.direction === 'outbound'
                            ? 'rounded-br-md bg-blue-600 text-white'
                            : 'rounded-bl-md border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-100',
                        )}
                      >
                        <div className="text-xs font-medium opacity-80">
                          {message.senderName || (message.direction === 'outbound' ? 'Anda' : 'Kontak')}
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-sm leading-6">
                          {message.text || 'Pesan non-teks / lampiran'}
                        </div>
                        {message.attachments.length > 0 ? (
                          <div className="mt-2 text-xs opacity-80">
                            {formatNumber(message.attachments.length)} lampiran
                          </div>
                        ) : null}
                        <div className="mt-2 text-[11px] opacity-70">
                          {formatConversationTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3 p-5">
              {!canSendMessage && sendDisabledReason ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                  {sendDisabledReason}
                </div>
              ) : null}
              <Textarea
                value={composerText}
                onChange={(event) => setComposerText(event.target.value)}
                placeholder="Tulis balasan untuk percakapan ini"
                className="min-h-[96px]"
                disabled={!selectedConversation || !canSendMessage || sendingMessage}
              />
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedConversation
                    ? `Sumber: ${selectedConversation.source === 'meta-live' ? 'Meta Live API' : 'Webhook Store'}`
                    : 'Pilih percakapan untuk membalas.'}
                </div>
                <Button
                  onClick={() => void handleSendMessage()}
                  disabled={!composerText.trim() || !canSendMessage || sendingMessage}
                >
                  {sendingMessage ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Kirim Balasan
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="p-5">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Detail Thread
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Konteks channel, sumber data, dan status thread terpilih.
                  </p>
                </div>
              </div>

              {selectedConversation ? (
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {selectedConversation.contactName || 'Kontak tanpa nama'}
                    </div>
                    <div className="mt-1 text-slate-500 dark:text-slate-400">
                      {selectedConversation.contactHandle
                        ? `@${selectedConversation.contactHandle}`
                        : selectedConversation.contactId}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Platform
                      </div>
                      <div className="mt-2 flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                        {getPlatformIcon(selectedConversation.platform)}
                        {getPlatformLabel(selectedConversation.platform)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Sumber
                      </div>
                      <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">
                        {selectedConversation.source === 'meta-live' ? 'Meta Live API' : 'Webhook Store'}
                      </div>
                      {selectedConversation.platform === 'whatsapp' && selectedConversation.provider ? (
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Provider: {selectedConversation.provider === 'kirimdev' ? 'Kirimdev' : 'Meta'}
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Unread
                      </div>
                      <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">
                        {formatNumber(selectedConversation.unreadCount)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Pesan
                      </div>
                      <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">
                        {selectedConversation.messageCount == null
                          ? 'Store'
                          : formatNumber(selectedConversation.messageCount)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Pilih thread di kiri untuk melihat detail channel dan sumber datanya.
                </div>
              )}
            </div>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="p-5">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Status Channel
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Messenger dan Instagram live, WhatsApp dari webhook, TikTok masih menunggu adapter inbox server.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {(overview?.channels || []).map((channel: ConversationChannel) => (
                  <div
                    key={channel.id}
                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {getPlatformIcon(channel.platform)}
                          <span className="truncate">
                            {channel.platform === 'instagram'
                              ? channel.instagramUsername || channel.pageName
                              : channel.whatsappDisplayPhoneNumber || channel.pageName}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {channel.id}
                        </div>
                      </div>
                      <Badge variant="outline">
                        {channel.platform === 'whatsapp' || channel.supportsMessaging
                          ? 'Aktif'
                          : 'Perlu cek task'}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">{getPlatformLabel(channel.platform)}</Badge>
                      <Badge variant="outline">{channel.subscribedFields.length} field</Badge>
                    </div>
                  </div>
                ))}

                <div className="rounded-2xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <MessageCircle className="h-4 w-4" />
                    TikTok DM
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Koneksi token TikTok sudah ada di proyek, tetapi adapter inbox live server untuk DM TikTok belum tersedia di repo ini.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="p-5">
              <div className="flex items-center gap-3">
                {liveErrorCount > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                )}
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Diagnostik Live
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Status sinkron cepat untuk inbox channel yang berhasil dibaca.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {liveErrorCount === 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
                    Messenger dan Instagram berhasil dibaca tanpa error pada sinkron terakhir.
                  </div>
                ) : (
                  overview?.diagnostics.liveErrors.map((error) => (
                    <div
                      key={`${error.channelId}:${error.error}`}
                      className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
                    >
                      <div className="font-semibold">{error.channelId}</div>
                      <div className="mt-1">{error.error}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </ConversationWorkspaceFrame>
  );
}
