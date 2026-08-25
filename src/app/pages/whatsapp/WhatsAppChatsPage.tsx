import React from 'react';
import type { DateRange } from 'react-day-picker';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  Circle,
  Clock3,
  ExternalLink,
  FileText,
  ImagePlus,
  Info,
  Image as ImageIcon,
  Inbox,
  Loader2,
  Mail,
  Maximize2,
  MessageCircle,
  Mic,
  Minimize2,
  Music,
  Paperclip,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Smartphone,
  Tag,
  UserPlus,
  Video,
  Wifi,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { SmartFilterDate } from '@/app/components/SmartFilterDate';
import { Button } from '@/app/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible';
import { Input } from '@/app/components/ui/input';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/app/components/ui/select';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Textarea } from '@/app/components/ui/textarea';
import { cn } from '@/app/components/ui/utils';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useMasterData } from '@/app/pages/master-data/context';
import type { Lead } from '@/app/pages/master-data/data';
import { supabase } from '@/lib/supabaseClient';
import {
  fetchWhatsAppConversationsPage,
  fetchWhatsAppMessages,
  sendWhatsAppMessage,
  syncKirimdevInbox,
  uploadWhatsAppMedia,
  type WhatsAppAccount,
  type WhatsAppConversationsPageResponse,
  type WhatsAppConversation,
  type WhatsAppMessage,
  type WhatsAppOutboundMediaType,
  type WhatsAppProvider,
} from '@/app/services/whatsappModuleService';
import {
  MessageStatusBadge,
  ProviderBadge,
  formatNumber,
  formatPhoneNumber,
  formatRelativeTime,
  WhatsAppContactAvatar,
} from './components/whatsappModuleShared';
import {
  CountBadge,
  FilterRow,
  IconButton,
  InboxStatButton,
  StatusChip,
  cls,
  whatsAppInboxStyle,
} from './inboxUi';
import { useWhatsAppOverview } from './useWhatsAppOverview';

const PROVIDER_FILTERS: Array<{ id: 'all' | WhatsAppProvider; label: string }> = [
  { id: 'all', label: 'Semua' },
  { id: 'kirimdev', label: 'Kirimdev' },
  { id: 'meta', label: 'Meta langsung' },
];

type InboxStatusFilter = 'all' | 'unread' | 'open' | 'pending' | 'resolved';
type InboxSlaFilter = 'all' | 'at_risk' | 'breached';
type SidebarSectionId = 'status' | 'provider' | 'sla' | 'labels';

const STATUS_FILTERS: Array<{ id: InboxStatusFilter; label: string }> = [
  { id: 'all', label: 'Semua' },
  { id: 'unread', label: 'Belum dibaca' },
  { id: 'open', label: 'Aktif' },
  { id: 'pending', label: 'Menunggu' },
  { id: 'resolved', label: 'Selesai' },
];

const MANUAL_WHATSAPP_LEAD_ORIGIN = 'manual_wa_chat';

const DEFAULT_COLLAPSED_SIDEBAR_SECTIONS: Record<SidebarSectionId, boolean> = {
  status: false,
  provider: false,
  sla: false,
  labels: false,
};

function SidebarFilterSection({
  id,
  title,
  collapsed,
  onOpenChange,
  children,
}: {
  id: string;
  title: string;
  collapsed: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const open = !collapsed;

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className={cn(cls.sidebarSection, cls.sidebarSurface)}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cls.sectionToggle}
          aria-expanded={open}
          aria-controls={id}
        >
          <span>{title}</span>
          <ChevronDown className={cn(cls.sectionChevron, !open && '-rotate-90')} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent
        id={id}
        forceMount
        className={cls.sidebarCollapseContent}
      >
        <div className={cls.sidebarCollapseInner}>{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

const OVERVIEW_REFRESH_INTERVAL_MS = 5_000;
const MESSAGE_REFRESH_INTERVAL_MS = 30_000;
const KIRIMDEV_INBOX_AUTO_SYNC_INTERVAL_MS = 15_000;
const KIRIMDEV_INBOX_AUTO_SYNC_MIN_INTERVAL_MS = 4_000;
const KIRIMDEV_INBOX_SYNC_CONVERSATION_LIMIT = 50;
const KIRIMDEV_INBOX_SYNC_MESSAGE_LIMIT = 10;
const CONVERSATION_PAGE_SIZE = 120;
const MESSAGE_PREFETCH_LIMIT = 6;
const MESSAGE_CACHE_MAX = 80;
const CONVERSATION_PAGE_CACHE_TTL_MS = 10 * 60 * 1000;
const REALTIME_REFRESH_DEBOUNCE_MS = 300;
const FAST_DB_FALLBACK_DELAY_MS = 900;
const MESSAGE_PAGE_SIZE = 50;
const MESSAGE_SYNC_LIMIT = 10;
const ALL_ACCOUNTS_VALUE = 'all';
const COMPOSER_ATTACHMENT_MAX_BYTES: Record<WhatsAppOutboundMediaType, number> = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
};
const WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
const SLA_AT_RISK_MS = 2 * 60 * 60 * 1000;

type ComposerAttachment = {
  file: File;
  type: WhatsAppOutboundMediaType;
  previewUrl: string | null;
};

type NormalizedMessageAttachment = {
  type: string;
  url: string | null;
  mimeType: string | null;
  name: string | null;
  caption: string | null;
  raw: unknown;
};

const IMAGE_EXTENSION_RE = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;
const VIDEO_EXTENSION_RE = /\.(m4v|mov|mp4|webm)(?:[?#].*)?$/i;
const AUDIO_EXTENSION_RE = /\.(aac|m4a|mp3|ogg|wav|webm)(?:[?#].*)?$/i;

function inferComposerAttachmentType(
  file: File,
  preferredType?: WhatsAppOutboundMediaType,
): WhatsAppOutboundMediaType | null {
  const mimeType = file.type.toLowerCase();
  if (preferredType && preferredType !== 'document') return preferredType;
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    preferredType === 'document' ||
    mimeType === 'application/pdf' ||
    mimeType.startsWith('text/') ||
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation') ||
    mimeType.includes('officedocument')
  ) {
    return 'document';
  }
  return null;
}

function validateComposerAttachment(file: File, type: WhatsAppOutboundMediaType) {
  const maxBytes = COMPOSER_ATTACHMENT_MAX_BYTES[type];
  const mimeType = file.type.toLowerCase();
  if (file.size > maxBytes) {
    return `Ukuran file ${type} melebihi batas WhatsApp.`;
  }
  if (type === 'image' && !['image/jpeg', 'image/jpg', 'image/png'].includes(mimeType)) {
    return 'Gambar WhatsApp harus JPG atau PNG.';
  }
  if (type === 'video' && !['video/mp4', 'video/3gpp', 'video/quicktime'].includes(mimeType)) {
    return 'Video WhatsApp harus MP4 atau 3GPP.';
  }
  if (type === 'audio' && !mimeType.startsWith('audio/')) {
    return 'Audio WhatsApp harus berupa file audio.';
  }
  return null;
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '0 B';
  if (size < 1024) return `${size} B`;
  const kilobytes = size / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function getComposerAttachmentLabel(type: WhatsAppOutboundMediaType) {
  if (type === 'image') return 'Gambar';
  if (type === 'video') return 'Video';
  if (type === 'audio') return 'Audio';
  return 'Dokumen';
}

function readPathValue(value: unknown, path: string[]) {
  let current = value as any;
  for (const part of path) {
    if (!current || typeof current !== 'object') return null;
    current = current[part];
  }
  return typeof current === 'string' && current.trim() ? current.trim() : null;
}

function readFirstString(value: unknown, paths: string[][]) {
  for (const path of paths) {
    const result = readPathValue(value, path);
    if (result) return result;
  }
  return null;
}

function normalizeAttachment(raw: unknown, fallbackType?: string | null): NormalizedMessageAttachment {
  const type =
    readFirstString(raw, [['type'], ['media_type'], ['mediaType']]) ||
    fallbackType ||
    'media';
  return {
    type: type.toLowerCase(),
    url: readFirstString(raw, [
      ['url'],
      ['link'],
      ['media_url'],
      ['mediaUrl'],
      ['payload', 'url'],
      ['image', 'url'],
      ['video', 'url'],
      ['audio', 'url'],
      ['document', 'url'],
    ]),
    mimeType: readFirstString(raw, [
      ['mime_type'],
      ['mimeType'],
      ['mime'],
      ['content_type'],
      ['contentType'],
    ]),
    name: readFirstString(raw, [
      ['filename'],
      ['file_name'],
      ['name'],
      ['title'],
      ['document', 'filename'],
    ]),
    caption: readFirstString(raw, [
      ['caption'],
      ['title'],
      ['image', 'caption'],
      ['video', 'caption'],
      ['document', 'caption'],
    ]),
    raw,
  };
}

function getMessageMediaItems(message: WhatsAppMessage) {
  const fromAttachments = Array.isArray(message.attachments)
    ? message.attachments.map((attachment) => normalizeAttachment(attachment))
    : [];

  const hasMediaUrl = Boolean(message.mediaUrl);
  const alreadyHasMediaUrl = fromAttachments.some((attachment) => attachment.url === message.mediaUrl);
  if (hasMediaUrl && !alreadyHasMediaUrl) {
    fromAttachments.push(
      normalizeAttachment(
        {
          type: fromAttachments[0]?.type || 'media',
          url: message.mediaUrl,
          mime_type: fromAttachments[0]?.mimeType || undefined,
          caption: fromAttachments[0]?.caption || undefined,
        },
        fromAttachments[0]?.type,
      ),
    );
  }

  return fromAttachments;
}

function isImageAttachment(attachment: NormalizedMessageAttachment) {
  return Boolean(
    attachment.url &&
      (attachment.mimeType?.startsWith('image/') ||
        attachment.type === 'image' ||
        IMAGE_EXTENSION_RE.test(attachment.url)),
  );
}

function isVideoAttachment(attachment: NormalizedMessageAttachment) {
  return Boolean(
    attachment.url &&
      (attachment.mimeType?.startsWith('video/') ||
        attachment.type === 'video' ||
        VIDEO_EXTENSION_RE.test(attachment.url)),
  );
}

function isAudioAttachment(attachment: NormalizedMessageAttachment) {
  return Boolean(
    attachment.url &&
      (attachment.mimeType?.startsWith('audio/') ||
        attachment.type === 'audio' ||
        AUDIO_EXTENSION_RE.test(attachment.url)),
  );
}

function getAttachmentLabel(attachment: NormalizedMessageAttachment) {
  if (attachment.caption) return attachment.caption;
  if (attachment.name) return attachment.name;
  if (attachment.type === 'image') return 'Gambar';
  if (attachment.type === 'video') return 'Video';
  if (attachment.type === 'audio') return 'Audio';
  if (attachment.type === 'document') return 'Dokumen';
  return 'Lampiran';
}

function getConversationInboxStatus(conversation: WhatsAppConversation): Exclude<InboxStatusFilter, 'all' | 'unread'> {
  const rawStatus = conversation.conversationStatus?.toLowerCase();
  if (rawStatus?.includes('pending')) return 'pending';
  if (rawStatus?.includes('resolved') || rawStatus?.includes('closed')) return 'resolved';
  return 'open';
}

function getStatusFilterCount(filter: InboxStatusFilter, conversations: WhatsAppConversation[]) {
  if (filter === 'all') return conversations.length;
  if (filter === 'unread') {
    return conversations.filter((conversation) => conversation.unreadCount > 0).length;
  }
  return conversations.filter((conversation) => getConversationInboxStatus(conversation) === filter).length;
}

function getInboxStatusLabel(status: ReturnType<typeof getConversationInboxStatus>) {
  switch (status) {
    case 'pending':
      return 'Menunggu';
    case 'resolved':
      return 'Selesai';
    case 'open':
    default:
      return 'Aktif';
  }
}

function getAccountChannelId(account: WhatsAppAccount) {
  return account.id || `whatsapp:${account.phoneNumberId}`;
}

function getAccountLabel(account: WhatsAppAccount) {
  const label = account.label
    ?.replace(/\s*\u00e2\u20ac\u00a2\s*/g, ' - ')
    .replace(/\s*•\s*/g, ' - ')
    .trim();
  return label || account.displayPhoneNumber || account.phoneNumberId || 'WhatsApp account';
}

function normalizeComparablePhoneNumber(value: string | null | undefined) {
  const normalized = (value || '').replace(/\D/g, '');
  if (!normalized) return '';
  if (normalized.startsWith('0')) return `62${normalized.slice(1)}`;
  if (normalized.startsWith('8')) return `62${normalized}`;
  return normalized;
}

function generateManualWhatsAppLeadId() {
  const timeSeed = Date.now().toString(36).slice(-5);
  const randomSeed = Math.random().toString(36).slice(2, 6);
  return `WA-${timeSeed}${randomSeed}`.toUpperCase();
}

function isOpenLeadStatus(status: Lead['status']) {
  return status !== 'Closing' && status !== 'Cancel';
}

function getAccountComparablePhoneNumber(account: WhatsAppAccount) {
  return (
    normalizeComparablePhoneNumber(account.csWhatsappNumber) ||
    normalizeComparablePhoneNumber(account.displayPhoneNumber) ||
    normalizeComparablePhoneNumber(account.label) ||
    normalizeComparablePhoneNumber(account.phoneNumberId)
  );
}

function getAccountDisplayName(account: WhatsAppAccount) {
  if (account.csDisplayName?.trim()) return account.csDisplayName.trim();
  const label = getAccountLabel(account)
    .replace(/^WhatsApp\s*[-:]\s*/i, '')
    .replace(/^WhatsApp\s+/i, '')
    .trim();
  return label || 'WhatsApp account';
}

function getAccountDisplayPhone(account: WhatsAppAccount) {
  return formatPhoneNumber(account.displayPhoneNumber || account.csWhatsappNumber || account.phoneNumberId);
}

function getConversationAccount(
  conversation: WhatsAppConversation | null,
  accounts: WhatsAppAccount[],
) {
  if (!conversation) return null;
  return accounts.find((account) => getAccountChannelId(account) === conversation.channelId) || null;
}

function AccountSelectRow({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count: number;
}) {
  return (
    <span className={cls.accountRow}>
      <span className={cls.accountIcon}>
        <Smartphone className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 overflow-hidden text-left">
        <span className="block truncate text-sm font-semibold leading-5 text-slate-800 dark:text-slate-100">
          {title}
        </span>
        <span className="block truncate text-xs leading-4 text-slate-500 dark:text-slate-400">
          {subtitle}
        </span>
      </span>
      <CountBadge tone="accent" className="ml-auto max-w-[4.75rem]">
        {formatNumber(count)}
      </CountBadge>
    </span>
  );
}

function parseTimestampMs(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatDurationShort(durationMs: number) {
  const totalMinutes = Math.max(0, Math.floor(durationMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getServiceWindowState(timestamp: string | null | undefined) {
  const timestampMs = parseTimestampMs(timestamp);
  if (timestampMs === null) {
    return {
      isKnown: false,
      isOpen: false,
      isAtRisk: false,
      remainingMs: 0,
      remainingLabel: '-',
      label: 'Jendela tidak diketahui',
    };
  }

  const remainingMs = timestampMs + WHATSAPP_SERVICE_WINDOW_MS - Date.now();
  const isOpen = remainingMs > 0;
  return {
    isKnown: true,
    isOpen,
    isAtRisk: isOpen && remainingMs <= SLA_AT_RISK_MS,
    remainingMs: Math.max(0, remainingMs),
    remainingLabel: isOpen ? formatDurationShort(remainingMs) : 'Berakhir',
    label: isOpen ? 'Masih terbuka' : 'Sudah tertutup',
  };
}

function matchesSlaFilter(conversation: WhatsAppConversation, filter: InboxSlaFilter) {
  if (filter === 'all') return true;
  const windowState = getServiceWindowState(conversation.lastMessageAt);
  if (filter === 'breached') return windowState.isKnown && !windowState.isOpen;
  return windowState.isAtRisk;
}

function getSlaFilterCount(filter: InboxSlaFilter, conversations: WhatsAppConversation[]) {
  return conversations.filter((conversation) => matchesSlaFilter(conversation, filter)).length;
}

function formatJakartaDateKey(value: string | null | undefined) {
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

function isDateKeyWithinRange(dateKey: string | null, range: DateRange | undefined) {
  if (!dateKey) return false;
  if (!range?.from) return true;

  const fromKey = formatJakartaDateKey(range.from.toISOString());
  const toKey = formatJakartaDateKey((range.to || range.from).toISOString());
  if (!fromKey || !toKey) return true;

  return dateKey >= fromKey && dateKey <= toKey;
}

function getDateRangeJakartaBounds(range: DateRange | undefined) {
  if (!range?.from) return { from: null as string | null, to: null as string | null };

  const fromKey = formatJakartaDateKey(range.from.toISOString());
  const toKey = formatJakartaDateKey((range.to || range.from).toISOString());
  return {
    from: fromKey ? `${fromKey}T00:00:00.000+07:00` : null,
    to: toKey ? `${toKey}T23:59:59.999+07:00` : null,
  };
}

function getLatestInboundMessage(messages: WhatsAppMessage[]) {
  return (
    [...messages]
      .reverse()
      .find((message) => message.direction === 'inbound') || null
  );
}

function mergeWhatsAppMessages(messages: WhatsAppMessage[]) {
  const rows = new Map<string, WhatsAppMessage>();
  messages.forEach((message) => {
    rows.set(`${message.conversationId}:${message.id}`, message);
  });
  return Array.from(rows.values()).sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
}

type MessageCacheEntry = {
  messages: WhatsAppMessage[];
  hasMore: boolean;
  nextCursor: string | null;
  loadedAt: string;
};

type ConversationPageParams = {
  limit: number;
  from: string | null;
  to: string | null;
  channelId: string | null;
  provider: WhatsAppProvider | 'all';
  status: InboxStatusFilter;
  sla: InboxSlaFilter;
  query: string | null;
};

const messageCache = new Map<string, MessageCacheEntry>();
const messagePrefetchInFlight = new Set<string>();

function rememberMessageCache(conversationId: string, entry: MessageCacheEntry) {
  if (!conversationId) return;
  if (messageCache.has(conversationId)) messageCache.delete(conversationId);
  messageCache.set(conversationId, entry);
  while (messageCache.size > MESSAGE_CACHE_MAX) {
    const oldestKey = messageCache.keys().next().value;
    if (!oldestKey) break;
    messageCache.delete(oldestKey);
  }
}

function getMessageCache(conversationId: string) {
  return messageCache.get(conversationId) || null;
}

function updateMessageCache(conversationId: string, update: (entry: MessageCacheEntry) => MessageCacheEntry) {
  const current = messageCache.get(conversationId);
  if (!current) return;
  rememberMessageCache(conversationId, update(current));
}

function normalizeRealtimeProvider(value: unknown): WhatsAppProvider {
  return value === 'kirimdev' ? 'kirimdev' : 'meta';
}

function normalizeRealtimeSource(value: unknown) {
  return value === 'api' ? 'api' : 'webhook';
}

function normalizeRealtimeDirection(value: unknown): WhatsAppMessage['direction'] {
  return value === 'outbound' ? 'outbound' : 'inbound';
}

function normalizeRealtimeStatus(value: unknown): WhatsAppMessage['status'] {
  if (
    value === 'pending' ||
    value === 'sent' ||
    value === 'delivered' ||
    value === 'read' ||
    value === 'failed'
  ) {
    return value;
  }
  return null;
}

function readRealtimeAvatarUrl(raw: unknown) {
  return (
    readFirstString(raw, [['contactAvatarUrl'], ['avatarUrl'], ['profilePictureUrl']]) ||
    null
  );
}

function readRealtimeContactName(raw: unknown) {
  return readFirstString(raw, [
    ['conversation', 'contact', 'name'],
    ['contact', 'name'],
    ['profile', 'name'],
  ]);
}

function readRealtimeContactPhone(raw: unknown) {
  const phone = readFirstString(raw, [
    ['conversation', 'contact', 'phone_number'],
    ['conversation', 'contact', 'phoneNumber'],
    ['contact', 'phone_number'],
    ['contact', 'phoneNumber'],
    ['profile', 'phone'],
    ['profile', 'phone_number'],
  ]);
  return phone ? phone.replace(/\D/g, '') : null;
}

function mapRealtimeConversation(row: any): WhatsAppConversation | null {
  if (!row?.id || typeof row.channel_id !== 'string' || !row.channel_id.startsWith('whatsapp:')) {
    return null;
  }
  const raw = row.raw && typeof row.raw === 'object' ? row.raw : null;
  const rawContactPhone = readRealtimeContactPhone(raw);
  const contactPhone =
    (typeof row.contact_phone === 'string' && row.contact_phone.trim()) ||
    rawContactPhone ||
    null;
  const contactId =
    (typeof row.contact_id === 'string' && row.contact_id.trim()) ||
    contactPhone ||
    '';
  const contactName =
    (typeof row.contact_name === 'string' && row.contact_name.trim()) ||
    readRealtimeContactName(raw) ||
    null;
  const lastMessageText = typeof row.last_message_text === 'string' ? row.last_message_text : null;
  if (!contactId && !contactPhone && !contactName && !lastMessageText) return null;

  return {
    id: String(row.id),
    channelId: row.channel_id,
    provider: normalizeRealtimeProvider(row.provider),
    source: normalizeRealtimeSource(row.source),
    contactId,
    contactName,
    contactPhone,
    contactAvatarUrl: readRealtimeAvatarUrl(raw),
    lastMessageAt: typeof row.last_message_at === 'string' ? row.last_message_at : new Date().toISOString(),
    lastMessageText,
    lastDirection: normalizeRealtimeDirection(row.last_direction),
    lastStatus: normalizeRealtimeStatus(row.last_status),
    unreadCount: Number.isFinite(Number(row.unread_count)) ? Number(row.unread_count) : 0,
    hasAttachment: Boolean(row.last_has_attachment),
    conversationStatus: typeof row.conversation_status === 'string' ? row.conversation_status : null,
    updatedAt:
      typeof row.updated_at === 'string'
        ? row.updated_at
        : typeof row.last_message_at === 'string'
        ? row.last_message_at
        : new Date().toISOString(),
  };
}

function mapRealtimeMessage(row: any): WhatsAppMessage | null {
  if (!row?.id || !row?.conversation_id || typeof row.channel_id !== 'string') return null;
  const attachments = Array.isArray(row.attachments)
    ? row.attachments
    : row.attachments && typeof row.attachments === 'object'
    ? [row.attachments]
    : [];
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    channelId: row.channel_id,
    provider: normalizeRealtimeProvider(row.provider),
    direction: normalizeRealtimeDirection(row.direction),
    text: typeof row.text === 'string' ? row.text : null,
    status: normalizeRealtimeStatus(row.status),
    attachments,
    mediaUrl: typeof row.media_url === 'string' ? row.media_url : null,
    timestamp: typeof row.timestamp === 'string' ? row.timestamp : new Date().toISOString(),
    senderName: null,
  };
}

function normalizeConversationSearchQuery(value: string | null | undefined) {
  return (value || '').replace(/[%,()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function getConversationPageCacheKey(params: ConversationPageParams) {
  return [
    'wa-conversation-page-v6',
    params.from || 'all',
    params.to || 'all',
    params.channelId || 'all',
    params.provider || 'all',
    params.status,
    params.sla,
    normalizeConversationSearchQuery(params.query).toLowerCase() || 'all',
  ].join('|');
}

function readConversationPageCache(cacheKey: string): WhatsAppConversationsPageResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      cachedAt?: number;
      page?: WhatsAppConversationsPageResponse;
    };
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > CONVERSATION_PAGE_CACHE_TTL_MS) return null;
    if (!parsed.page || !Array.isArray(parsed.page.conversations)) return null;
    if (parsed.page.counts?.total > 0 && parsed.page.conversations.length === 0) return null;
    if (parsed.page.conversations.some((conversation) =>
      !conversation.contactId &&
      !conversation.contactPhone &&
      !conversation.contactName &&
      !conversation.lastMessageText
    )) {
      return null;
    }
    return parsed.page;
  } catch {
    return null;
  }
}

function writeConversationPageCache(cacheKey: string, page: WhatsAppConversationsPageResponse) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      cacheKey,
      JSON.stringify({
        cachedAt: Date.now(),
        page,
      }),
    );
  } catch {
    // Storage can be unavailable in private mode; cache is purely optional.
  }
}

async function fetchFastConversationPageFallback(
  params: ConversationPageParams,
): Promise<WhatsAppConversationsPageResponse | null> {
  let query: any = supabase
    .from('whatsapp_conversations')
    .select(
      [
        'id',
        'channel_id',
        'source',
        'contact_id',
        'provider',
        'contact_name',
        'contact_phone',
        'last_message_at',
        'last_message_text',
        'last_direction',
        'last_status',
        'last_has_attachment',
        'conversation_status',
        'unread_count',
        'updated_at',
        'raw',
      ].join(','),
    )
    .like('channel_id', 'whatsapp:%')
    .order('last_message_at', { ascending: false })
    .limit(params.limit + 1);

  if (params.channelId?.startsWith('whatsapp:')) query = query.eq('channel_id', params.channelId);
  if (params.provider === 'kirimdev' || params.provider === 'meta') query = query.eq('provider', params.provider);
  if (params.from) query = query.gte('last_message_at', params.from);
  if (params.to) query = query.lte('last_message_at', params.to);
  if (params.status === 'unread') {
    query = query.gt('unread_count', 0);
  } else if (params.status === 'pending') {
    query = query.ilike('conversation_status', '%pending%');
  } else if (params.status === 'resolved') {
    query = query.or('conversation_status.ilike.%resolved%,conversation_status.ilike.%closed%');
  }
  if (params.sla === 'breached') {
    query = query.lt('last_message_at', new Date(Date.now() - WHATSAPP_SERVICE_WINDOW_MS).toISOString());
  } else if (params.sla === 'at_risk') {
    query = query
      .gte('last_message_at', new Date(Date.now() - WHATSAPP_SERVICE_WINDOW_MS).toISOString())
      .lte('last_message_at', new Date(Date.now() - (WHATSAPP_SERVICE_WINDOW_MS - SLA_AT_RISK_MS)).toISOString());
  }
  const search = normalizeConversationSearchQuery(params.query);
  if (search) {
    const pattern = `%${search}%`;
    query = query.or(
      `contact_name.ilike.${pattern},contact_phone.ilike.${pattern},last_message_text.ilike.${pattern}`,
    );
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) return null;

  const rows = data.map(mapRealtimeConversation).filter(Boolean) as WhatsAppConversation[];
  const conversations = rows.slice(0, params.limit);
  const countSlaThreshold = new Date(Date.now() - WHATSAPP_SERVICE_WINDOW_MS).toISOString();
  return {
    generatedAt: new Date().toISOString(),
    conversations,
    nextCursor: rows.length > params.limit ? conversations[conversations.length - 1]?.lastMessageAt || null : null,
    hasMore: rows.length > params.limit,
    counts: {
      total: conversations.length,
      unread: conversations.filter((conversation) => conversation.unreadCount > 0).length,
      slaBreached: conversations.filter((conversation) => conversation.lastMessageAt < countSlaThreshold).length,
    },
    countsApproximate: true,
  };
}

function MessageMediaPreview({
  attachments,
  isOutbound,
}: {
  attachments: NormalizedMessageAttachment[];
  isOutbound: boolean;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {attachments.map((attachment, index) => {
        const label = getAttachmentLabel(attachment);
        const key = `${attachment.url || attachment.type}:${index}`;

        if (isImageAttachment(attachment) && attachment.url) {
          return (
            <a
              key={key}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-xl border border-black/10 bg-black/5 dark:border-white/10"
            >
              <img
                src={attachment.url}
                alt={label}
                loading="lazy"
                className="max-h-72 w-full max-w-sm object-cover"
              />
            </a>
          );
        }

        if (isVideoAttachment(attachment) && attachment.url) {
          return (
            <video
              key={key}
              src={attachment.url}
              controls
              className="max-h-72 w-full max-w-sm rounded-xl border border-black/10 bg-black dark:border-white/10"
            />
          );
        }

        if (isAudioAttachment(attachment) && attachment.url) {
          return (
            <audio key={key} src={attachment.url} controls className="w-full max-w-sm" />
          );
        }

        const Icon =
          attachment.type === 'image'
            ? ImageIcon
            : attachment.type === 'video'
            ? Video
            : attachment.type === 'audio'
            ? Music
            : attachment.type === 'document'
            ? FileText
            : Paperclip;

        return attachment.url ? (
          <a
            key={key}
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'flex max-w-sm items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors',
              isOutbound
                ? 'border-white/30 bg-white/10 text-white hover:bg-white/15'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </a>
        ) : (
          <div
            key={key}
            className={cn(
              'flex max-w-sm items-center gap-3 rounded-xl border px-3 py-2 text-sm',
              isOutbound
                ? 'border-white/25 bg-white/10 text-white/85'
                : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <span className="text-xs opacity-70">menunggu URL media</span>
          </div>
        );
      })}
    </div>
  );
}

function getConversationAvatarUrl(conversation: WhatsAppConversation | null | undefined) {
  return (
    conversation?.contactAvatarUrl ||
    conversation?.avatarUrl ||
    conversation?.profilePictureUrl ||
    null
  );
}

type ConversationIdentity = Pick<WhatsAppConversation, 'contactId' | 'contactName' | 'contactPhone'>;

function hasUsefulContactName(value: string | null | undefined) {
  const name = (value || '').trim();
  if (!name) return false;
  const signal = name.replace(/[^A-Za-z0-9]/g, '');
  return signal.length >= 2;
}

function normalizeConversationPhone(value: string | null | undefined) {
  const raw = (value || '').trim();
  if (!raw) return null;
  const withoutProviderPrefix = raw.replace(/^whatsapp:/i, '');
  const digits = withoutProviderPrefix.replace(/\D/g, '');
  if (digits.length < 6) return null;
  return withoutProviderPrefix.startsWith('+') ? `+${digits}` : digits;
}

function getConversationDisplayName(conversation: ConversationIdentity | null | undefined) {
  if (!conversation) return 'Kontak WhatsApp';
  const name = conversation.contactName?.trim();
  if (hasUsefulContactName(name)) return name;
  const phone = normalizeConversationPhone(conversation.contactPhone) || normalizeConversationPhone(conversation.contactId);
  if (phone) return formatPhoneNumber(phone);
  return 'Kontak WhatsApp';
}

function getConversationSubtitle(conversation: ConversationIdentity | null | undefined) {
  if (!conversation) return 'Pilih thread di kiri untuk membaca isi pesan.';
  const phone = normalizeConversationPhone(conversation.contactPhone) || normalizeConversationPhone(conversation.contactId);
  if (phone) return formatPhoneNumber(phone);
  return 'Nomor WhatsApp belum tersedia';
}

const ConversationListRow = React.memo(function ConversationListRow({
  conversation,
  isActive,
  onPrefetch,
  onSelect,
}: {
  conversation: WhatsAppConversation;
  isActive: boolean;
  onPrefetch?: (conversation: WhatsAppConversation) => void;
  onSelect: (conversationId: string) => void;
}) {
  const serviceWindow = getServiceWindowState(conversation.lastMessageAt);
  const displayName = getConversationDisplayName(conversation);
  const subtitle = getConversationSubtitle(conversation);
  return (
    <button
      onFocus={() => onPrefetch?.(conversation)}
      onMouseEnter={() => onPrefetch?.(conversation)}
      onClick={() => onSelect(conversation.id)}
      className={cn(
        'mx-2 grid min-h-[var(--wa-row-h)] w-[calc(100%-1rem)] grid-cols-[var(--wa-avatar-row)_minmax(0,1fr)_var(--wa-row-meta-w)] items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors',
        isActive
          ? 'bg-blue-50/70 text-slate-950 shadow-[inset_3px_0_0_#3b82f6] ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-100 dark:ring-blue-900/60'
          : 'hover:bg-slate-50 dark:hover:bg-slate-900/70',
      )}
    >
      <WhatsAppContactAvatar
        src={getConversationAvatarUrl(conversation)}
        name={displayName}
        phone={conversation.contactPhone}
        className={cls.avatarRow}
      />
      <div className="min-w-0 overflow-hidden">
        <div
          className="truncate text-sm font-semibold leading-5 text-slate-950 dark:text-slate-100"
          title={displayName}
        >
          {displayName}
        </div>
        <div className="truncate text-xs leading-4 text-slate-500" title={subtitle}>
          {subtitle}
        </div>
        <div
          className="mt-1 truncate text-sm leading-5 text-slate-700 dark:text-slate-300"
          title={conversation.lastMessageText || 'Belum ada pesan'}
        >
          {conversation.lastMessageText || 'Belum ada pesan'}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          {conversation.provider === 'meta' ? (
            <span className="shrink-0 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-blue-700">
              Meta Ads
            </span>
          ) : null}
          <span className="inline-flex min-w-0 items-center gap-1 truncate text-xs text-slate-500">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
            <span className="truncate">
              {getInboxStatusLabel(getConversationInboxStatus(conversation))}
            </span>
          </span>
        </div>
      </div>
      <div className="flex min-w-0 shrink-0 flex-col items-end gap-1.5 overflow-hidden">
        <div className="max-w-full truncate text-xs font-medium text-blue-700" title={formatRelativeTime(conversation.lastMessageAt)}>
          {formatRelativeTime(conversation.lastMessageAt)}
        </div>
        {conversation.unreadCount > 0 ? (
          <CountBadge className="bg-emerald-600 text-white">{formatNumber(conversation.unreadCount)}</CountBadge>
        ) : conversation.messageCount ? (
          <span
            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] leading-none text-slate-500 dark:border-slate-800 dark:bg-slate-950"
            title={`${formatNumber(conversation.messageCount)} pesan`}
          >
            <MessageCircle className="h-3 w-3" />
            {formatNumber(conversation.messageCount)}
          </span>
        ) : null}
        {!serviceWindow.isOpen || serviceWindow.isAtRisk ? (
          <span
            className={cn(
              'max-w-full truncate rounded border bg-white px-1.5 py-0.5 text-[10px] leading-none dark:bg-slate-950',
              serviceWindow.isAtRisk
                ? 'border-orange-200 text-orange-600 dark:border-orange-900/60'
                : 'border-rose-200 text-rose-600 dark:border-rose-900/60',
            )}
            title={`SLA ${serviceWindow.remainingLabel}`}
          >
            SLA {serviceWindow.remainingLabel}
          </span>
        ) : null}
      </div>
    </button>
  );
}, (previous, next) =>
  previous.isActive === next.isActive &&
  previous.onPrefetch === next.onPrefetch &&
  previous.conversation.id === next.conversation.id &&
  previous.conversation.contactName === next.conversation.contactName &&
  previous.conversation.contactPhone === next.conversation.contactPhone &&
  getConversationAvatarUrl(previous.conversation) === getConversationAvatarUrl(next.conversation) &&
  previous.conversation.lastMessageAt === next.conversation.lastMessageAt &&
  previous.conversation.lastMessageText === next.conversation.lastMessageText &&
  previous.conversation.provider === next.conversation.provider &&
  previous.conversation.unreadCount === next.conversation.unreadCount &&
  previous.conversation.messageCount === next.conversation.messageCount &&
  previous.conversation.conversationStatus === next.conversation.conversationStatus
);

const ChatMessageBubble = React.memo(function ChatMessageBubble({
  message,
}: {
  message: WhatsAppMessage;
}) {
  const isOutbound = message.direction === 'outbound';
  const mediaItems = getMessageMediaItems(message);
  const hasMediaItems = mediaItems.length > 0;

  return (
    <div
      className={cn(
        'flex w-full min-w-0 items-end',
        isOutbound ? 'justify-end pl-10' : 'justify-start pr-10',
      )}
    >
      <div
        className={cn(
          cls.messageBubbleBase,
          isOutbound ? cls.messageBubbleOutbound : cls.messageBubbleInbound,
        )}
        style={{
          maxWidth: 'min(var(--wa-bubble-max-w), var(--wa-bubble-max-pct))',
          overflowWrap: 'break-word',
          whiteSpace: 'normal',
          width: 'fit-content',
          wordBreak: 'normal',
        }}
      >
        {message.text ? (
          <div className="whitespace-pre-wrap leading-6 [overflow-wrap:break-word] [word-break:normal]">
            {message.text}
          </div>
        ) : !hasMediaItems ? (
          <div className="leading-6 opacity-80">
            Pesan non-teks / lampiran
          </div>
        ) : null}
        <MessageMediaPreview attachments={mediaItems} isOutbound={isOutbound} />
        <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px]">
          <span className={isOutbound ? cls.messageMetaOutbound : 'text-slate-400 dark:text-slate-500'}>
            {formatRelativeTime(message.timestamp)}
          </span>
          {isOutbound && message.status ? (
            <MessageStatusBadge
              status={message.status}
              className={cn(
                'border-transparent bg-transparent px-0 text-[11px]',
                message.status === 'read' ? cls.messageReadStatusOutbound : cls.messageMetaOutbound,
              )}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}, (previous, next) =>
  previous.message.id === next.message.id &&
  previous.message.conversationId === next.message.conversationId &&
  previous.message.direction === next.message.direction &&
  previous.message.text === next.message.text &&
  previous.message.status === next.message.status &&
  previous.message.mediaUrl === next.message.mediaUrl &&
  previous.message.timestamp === next.message.timestamp &&
  previous.message.attachments === next.message.attachments
);

export function WhatsAppChatsPage() {
  const navigate = useNavigate();
  const {
    data,
    loading: overviewLoading,
    refreshing: overviewRefreshing,
    error: overviewError,
    reload,
  } = useWhatsAppOverview({
    refreshIntervalMs: OVERVIEW_REFRESH_INTERVAL_MS,
    includeContacts: false,
    includeConversations: false,
    includeMessageCounts: false,
    includePerformance: false,
    showAutoRefreshIndicator: false,
  });
  const { users, leads, addLead, currentUser } = useMasterData();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = React.useState('');
  const deferredSearch = React.useDeferredValue(search);
  const [selectedAccountId, setSelectedAccountId] = React.useState(ALL_ACCOUNTS_VALUE);
  const [providerFilter, setProviderFilter] = React.useState<'all' | WhatsAppProvider>('all');
  const [statusFilter, setStatusFilter] = React.useState<InboxStatusFilter>('all');
  const [slaFilter, setSlaFilter] = React.useState<InboxSlaFilter>('all');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<WhatsAppMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = React.useState(false);
  const [messagesRefreshing, setMessagesRefreshing] = React.useState(false);
  const [messagesLoadingOlder, setMessagesLoadingOlder] = React.useState(false);
  const [messagesHasMore, setMessagesHasMore] = React.useState(false);
  const [messagesOlderCursor, setMessagesOlderCursor] = React.useState<string | null>(null);
  const [messagesLastLoadedAt, setMessagesLastLoadedAt] = React.useState<string | null>(null);
  const [messagesError, setMessagesError] = React.useState<string | null>(null);
  const [conversationPage, setConversationPage] = React.useState<WhatsAppConversationsPageResponse | null>(null);
  const [conversationsLoading, setConversationsLoading] = React.useState(true);
  const [conversationsRefreshing, setConversationsRefreshing] = React.useState(false);
  const [conversationsError, setConversationsError] = React.useState<string | null>(null);
  const composerTextRef = React.useRef('');
  const composerTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [hasComposerText, setHasComposerText] = React.useState(false);
  const [selectedAttachment, setSelectedAttachment] = React.useState<ComposerAttachment | null>(null);
  const [sendingMessage, setSendingMessage] = React.useState(false);
  const [creatingProspectFromChat, setCreatingProspectFromChat] = React.useState(false);
  const [uploadingAttachment, setUploadingAttachment] = React.useState(false);
  const [showCustomerPanel, setShowCustomerPanel] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isDesktopInbox, setIsDesktopInbox] = React.useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches,
  );
  const [collapsedSidebarSections, setCollapsedSidebarSections] = React.useState(
    DEFAULT_COLLAPSED_SIDEBAR_SECTIONS,
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleChange = (event: MediaQueryListEvent) => setIsDesktopInbox(event.matches);
    setIsDesktopInbox(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  React.useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const genericAttachmentInputRef = React.useRef<HTMLInputElement | null>(null);
  const imageAttachmentInputRef = React.useRef<HTMLInputElement | null>(null);
  const documentAttachmentInputRef = React.useRef<HTMLInputElement | null>(null);
  const audioAttachmentInputRef = React.useRef<HTMLInputElement | null>(null);
  const messageRequestRef = React.useRef(0);
  const messageLoadInFlightKeyRef = React.useRef<string | null>(null);
  const selectedConversationRef = React.useRef<WhatsAppConversation | null>(null);
  const didAutoSelectAccountRef = React.useRef(false);
  const olderScrollSnapshotRef = React.useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const messagesLengthRef = React.useRef(0);
  const messagesOlderCursorRef = React.useRef<string | null>(null);
  const conversationPageRequestRef = React.useRef(0);
  const conversationPageCacheKeyRef = React.useRef<string | null>(null);
  const conversationPageStateCacheKeyRef = React.useRef<string | null>(null);
  const exactCountInFlightKeyRef = React.useRef<string | null>(null);
  const accountBreakdownCacheKeyRef = React.useRef<string | null>(null);
  const accountBreakdownInFlightKeyRef = React.useRef<string | null>(null);
  const realtimeRefreshTimerRef = React.useRef<number | null>(null);
  const loadConversationPageRef = React.useRef<((options?: { silent?: boolean }) => Promise<void>) | null>(null);
  const loadMessagesRef = React.useRef<
    ((conversation: WhatsAppConversation, options?: { silent?: boolean; sync?: boolean; older?: boolean; showIndicator?: boolean }) => Promise<void>) | null
  >(null);
  const kirimdevInboxSyncInFlightRef = React.useRef(false);
  const lastKirimdevInboxSyncAtRef = React.useRef(0);
  const setSidebarSectionOpen = React.useCallback((section: SidebarSectionId, open: boolean) => {
    setCollapsedSidebarSections((current) => ({
      ...current,
      [section]: !open,
    }));
  }, []);

  const activeDateRangeKey = React.useMemo(() => {
    if (!dateRange?.from) return 'all';
    const fromKey = formatJakartaDateKey(dateRange.from.toISOString());
    const toKey = formatJakartaDateKey((dateRange.to || dateRange.from).toISOString());
    return `${fromKey || 'unknown'}:${toKey || fromKey || 'unknown'}`;
  }, [dateRange]);

  const dateBounds = React.useMemo(() => getDateRangeJakartaBounds(dateRange), [dateRange]);

  const applyConversationPage = React.useCallback((
    page: WhatsAppConversationsPageResponse,
    cacheKey: string,
  ) => {
    const canPreserveExactCounts = conversationPageStateCacheKeyRef.current === cacheKey;
    setConversationPage((current) => {
      const next =
        canPreserveExactCounts &&
        current &&
        !current.countsApproximate &&
        page.countsApproximate
          ? {
              ...page,
              counts: current.counts,
              filterCounts: current.filterCounts ?? page.filterCounts,
              accountCounts: current.accountCounts ?? page.accountCounts,
              allAccountCount: current.allAccountCount ?? page.allAccountCount,
              countsApproximate: false,
            }
          : page;
      writeConversationPageCache(cacheKey, next);
      return next;
    });
    conversationPageStateCacheKeyRef.current = cacheKey;
  }, []);

  const refreshExactConversationCounts = React.useCallback(async (
    pageParams: ConversationPageParams,
    cacheKey: string,
  ) => {
    if (exactCountInFlightKeyRef.current === cacheKey) return;
    exactCountInFlightKeyRef.current = cacheKey;
    try {
      const countPayload = await fetchWhatsAppConversationsPage({
        ...pageParams,
        limit: 1,
        includeCounts: true,
        includeFilterCounts: true,
        includeAccountCounts: false,
      });
      if (conversationPageCacheKeyRef.current !== cacheKey) return;
      setConversationPage((current) => {
        if (!current || conversationPageStateCacheKeyRef.current !== cacheKey) return current;
        const next = {
          ...current,
          counts: countPayload.counts,
          filterCounts: countPayload.filterCounts ?? current.filterCounts,
          accountCounts: countPayload.accountCounts ?? current.accountCounts,
          allAccountCount: countPayload.allAccountCount ?? current.allAccountCount,
          countsApproximate: false,
          generatedAt: countPayload.generatedAt,
        };
        writeConversationPageCache(cacheKey, next);
        return next;
      });
    } catch {
      // Keep the fast approximate count visible; the next refresh will retry exact counts.
    } finally {
      if (exactCountInFlightKeyRef.current === cacheKey) {
        exactCountInFlightKeyRef.current = null;
      }
    }
  }, []);

  const refreshAccountConversationCounts = React.useCallback(async (
    pageParams: ConversationPageParams,
    pageCacheKey: string,
  ) => {
    const breakdownParams: ConversationPageParams = {
      ...pageParams,
      channelId: null,
      limit: 1,
    };
    const breakdownKey = getConversationPageCacheKey(breakdownParams);
    accountBreakdownCacheKeyRef.current = breakdownKey;
    if (accountBreakdownInFlightKeyRef.current === breakdownKey) return;
    accountBreakdownInFlightKeyRef.current = breakdownKey;

    try {
      const breakdownPayload = await fetchWhatsAppConversationsPage({
        ...breakdownParams,
        includeCounts: true,
        includeFilterCounts: false,
        includeAccountCounts: true,
      });
      if (
        accountBreakdownCacheKeyRef.current !== breakdownKey ||
        conversationPageCacheKeyRef.current !== pageCacheKey
      ) {
        return;
      }
      setConversationPage((current) => {
        if (!current || conversationPageStateCacheKeyRef.current !== pageCacheKey) return current;
        const next = {
          ...current,
          accountCounts: breakdownPayload.accountCounts ?? current.accountCounts,
          allAccountCount:
            breakdownPayload.allAccountCount ??
            breakdownPayload.counts?.total ??
            current.allAccountCount,
        };
        writeConversationPageCache(pageCacheKey, next);
        return next;
      });
    } catch {
      // Account badges can keep their previous exact values until the next refresh.
    } finally {
      if (accountBreakdownInFlightKeyRef.current === breakdownKey) {
        accountBreakdownInFlightKeyRef.current = null;
      }
    }
  }, []);

  const loadConversationPage = React.useCallback(async (options?: { silent?: boolean }) => {
    const requestId = conversationPageRequestRef.current + 1;
    conversationPageRequestRef.current = requestId;
    const silent = options?.silent ?? false;
    const pageParams: ConversationPageParams = {
      limit: CONVERSATION_PAGE_SIZE,
      from: dateBounds.from,
      to: dateBounds.to,
      channelId: selectedAccountId === ALL_ACCOUNTS_VALUE ? null : selectedAccountId,
      provider: providerFilter,
      status: statusFilter,
      sla: slaFilter,
      query: deferredSearch.trim() || null,
    };
    const cacheKey = getConversationPageCacheKey(pageParams);
    conversationPageCacheKeyRef.current = cacheKey;
    const shouldLoadExactInline = Boolean(
      selectedAccountId !== ALL_ACCOUNTS_VALUE ||
        dateBounds.from ||
        dateBounds.to ||
        providerFilter !== 'all' ||
        statusFilter !== 'all' ||
        slaFilter !== 'all' ||
        deferredSearch.trim(),
    );

    if (silent) {
      setConversationsRefreshing(true);
    } else {
      const cached = readConversationPageCache(cacheKey);
      if (cached && (!shouldLoadExactInline || !cached.countsApproximate)) {
        applyConversationPage(cached, cacheKey);
        setConversationsLoading(false);
        setConversationsRefreshing(true);
      } else {
        setConversationsLoading(true);
      }
    }

    let fallbackTimer: number | null = null;
    try {
      if (!silent && !shouldLoadExactInline && typeof window !== 'undefined') {
        fallbackTimer = window.setTimeout(() => {
          void (async () => {
            if (conversationPageRequestRef.current !== requestId) return;
            const fallbackPage = await fetchFastConversationPageFallback(pageParams);
            if (!fallbackPage || conversationPageRequestRef.current !== requestId) return;
            applyConversationPage(fallbackPage, cacheKey);
            setConversationsLoading(false);
            setConversationsRefreshing(true);
            setConversationsError(null);
            void refreshExactConversationCounts(pageParams, cacheKey);
            void refreshAccountConversationCounts(pageParams, cacheKey);
          })();
        }, FAST_DB_FALLBACK_DELAY_MS);
      }

      const payload = await fetchWhatsAppConversationsPage({
        ...pageParams,
        includeCounts: shouldLoadExactInline,
        includeFilterCounts: shouldLoadExactInline,
        includeAccountCounts: false,
      });
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (conversationPageRequestRef.current !== requestId) return;
      applyConversationPage(payload, cacheKey);
      setConversationsError(null);

      if (payload.countsApproximate) {
        void refreshExactConversationCounts(pageParams, cacheKey);
      }
      void refreshAccountConversationCounts(pageParams, cacheKey);
    } catch (err: any) {
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (conversationPageRequestRef.current !== requestId) return;
      const fallbackPage = !silent ? await fetchFastConversationPageFallback(pageParams) : null;
      if (fallbackPage && conversationPageRequestRef.current === requestId) {
        applyConversationPage(fallbackPage, cacheKey);
        void refreshExactConversationCounts(pageParams, cacheKey);
        void refreshAccountConversationCounts(pageParams, cacheKey);
        setConversationsError(null);
      } else {
        setConversationsError(err?.message || 'Gagal memuat daftar percakapan.');
      }
    } finally {
      if (conversationPageRequestRef.current === requestId) {
        setConversationsLoading(false);
        setConversationsRefreshing(false);
      }
    }
  }, [
    dateBounds.from,
    dateBounds.to,
    deferredSearch,
    applyConversationPage,
    providerFilter,
    refreshAccountConversationCounts,
    refreshExactConversationCounts,
    selectedAccountId,
    slaFilter,
    statusFilter,
  ]);

  React.useEffect(() => {
    loadConversationPageRef.current = loadConversationPage;
  }, [loadConversationPage]);

  React.useEffect(() => {
    void loadConversationPage();
  }, [loadConversationPage]);

  const accounts = React.useMemo(() => data?.accounts || [], [data?.accounts]);
  const csOwnerByPhoneNumber = React.useMemo(() => {
    const ownerMap = new Map<
      string,
      { displayName: string; whatsappNumber: string; priority: number }
    >();

    users.forEach((user) => {
      const displayName =
        user.csDisplayName?.trim() ||
        user.name?.trim() ||
        user.email?.trim() ||
        'CS';
      const basePriority = (user.status === 'active' ? 20 : 0) + (user.role === 'CS' ? 10 : 0);
      const candidates = [
        {
          key: normalizeComparablePhoneNumber(user.csWhatsappNumber),
          whatsappNumber: user.csWhatsappNumber || '',
          priority: 100 + basePriority,
        },
        {
          key: normalizeComparablePhoneNumber(user.phone),
          whatsappNumber: user.phone || '',
          priority: 10 + basePriority,
        },
      ];

      candidates.forEach((candidate) => {
        if (!candidate.key) return;
        const currentOwner = ownerMap.get(candidate.key);
        if (currentOwner && currentOwner.priority >= candidate.priority) return;

        ownerMap.set(candidate.key, {
          displayName,
          whatsappNumber: candidate.whatsappNumber,
          priority: candidate.priority,
        });
      });
    });

    return ownerMap;
  }, [users]);
  const enrichedAccounts = React.useMemo(
    () =>
      accounts.map((account) => {
        if (account.csDisplayName?.trim()) return account;

        const accountPhoneNumber = getAccountComparablePhoneNumber(account);
        const owner = accountPhoneNumber ? csOwnerByPhoneNumber.get(accountPhoneNumber) : null;
        if (!owner) return account;

        return {
          ...account,
          csDisplayName: owner.displayName,
          csWhatsappNumber: owner.whatsappNumber || account.csWhatsappNumber,
        };
      }),
    [accounts, csOwnerByPhoneNumber],
  );
  const conversations = React.useMemo(
    () => conversationPage?.conversations || [],
    [conversationPage?.conversations],
  );
  const dateScopedAllConversations = conversations;
  const accountConversationCountById = React.useMemo(() => {
    if (conversationPage?.accountCounts) {
      return new Map(
        Object.entries(conversationPage.accountCounts).map(([channelId, count]) => [
          channelId,
          Number.isFinite(count) ? count : 0,
        ]),
      );
    }
    const rows = new Map<string, number>();
    dateScopedAllConversations.forEach((conversation) => {
      rows.set(conversation.channelId, (rows.get(conversation.channelId) || 0) + 1);
    });
    return rows;
  }, [conversationPage?.accountCounts, dateScopedAllConversations]);
  const selectedAccount = React.useMemo(
    () => enrichedAccounts.find((account) => getAccountChannelId(account) === selectedAccountId) || null,
    [enrichedAccounts, selectedAccountId],
  );

  React.useEffect(() => {
    if (
      !didAutoSelectAccountRef.current &&
      selectedAccountId === ALL_ACCOUNTS_VALUE &&
      enrichedAccounts.length === 1
    ) {
      didAutoSelectAccountRef.current = true;
      setSelectedAccountId(getAccountChannelId(enrichedAccounts[0]));
    }
  }, [enrichedAccounts, selectedAccountId]);

  React.useEffect(() => {
    if (
      selectedAccountId !== ALL_ACCOUNTS_VALUE &&
      !enrichedAccounts.some((account) => getAccountChannelId(account) === selectedAccountId)
    ) {
      setSelectedAccountId(ALL_ACCOUNTS_VALUE);
    }
  }, [enrichedAccounts, selectedAccountId]);

  const dateScopedConversations = conversations;
  const filteredConversations = conversations;

  React.useEffect(() => {
    if (!filteredConversations.length) {
      setSelectedId(null);
      return;
    }
    const selectedConversationStillVisible =
      selectedId && filteredConversations.some((conversation) => conversation.id === selectedId);

    if (selectedConversationStillVisible) return;

    if (isDesktopInbox) {
      setSelectedId(filteredConversations[0].id);
    } else if (selectedId) {
      setSelectedId(null);
    }
  }, [filteredConversations, isDesktopInbox, selectedId]);

  const selectedConversation = React.useMemo<WhatsAppConversation | null>(
    () => filteredConversations.find((conversation) => conversation.id === selectedId) || null,
    [filteredConversations, selectedId],
  );

  const conversationMatchesCurrentFilters = React.useCallback((conversation: WhatsAppConversation) => {
    if (selectedAccountId !== ALL_ACCOUNTS_VALUE && conversation.channelId !== selectedAccountId) return false;
    if (dateRange?.from && !isDateKeyWithinRange(formatJakartaDateKey(conversation.lastMessageAt), dateRange)) {
      return false;
    }
    if (statusFilter === 'unread' && conversation.unreadCount <= 0) return false;
    if (
      statusFilter !== 'all' &&
      statusFilter !== 'unread' &&
      getConversationInboxStatus(conversation) !== statusFilter
    ) {
      return false;
    }
    if (providerFilter !== 'all' && conversation.provider !== providerFilter) return false;
    if (!matchesSlaFilter(conversation, slaFilter)) return false;

    const query = deferredSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      conversation.contactName,
      conversation.contactPhone,
      conversation.lastMessageText,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query);
  }, [dateRange, deferredSearch, providerFilter, selectedAccountId, slaFilter, statusFilter]);

  const upsertRealtimeConversation = React.useCallback((conversation: WhatsAppConversation) => {
    setConversationPage((current) => {
      if (!current) return current;
      const matches = conversationMatchesCurrentFilters(conversation);
      const previous = current.conversations.find((row) => row.id === conversation.id) || null;
      const existed = Boolean(previous);
      const withoutCurrent = current.conversations.filter((row) => row.id !== conversation.id);
      const conversations = matches
        ? [conversation, ...withoutCurrent]
            .sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt))
            .slice(0, CONVERSATION_PAGE_SIZE)
        : withoutCurrent;
      const countsAreExact = !current.countsApproximate;
      const countSlaThreshold = new Date(Date.now() - WHATSAPP_SERVICE_WINDOW_MS).toISOString();
      const previousUnread = Boolean(previous && previous.unreadCount > 0);
      const nextUnread = Boolean(matches && conversation.unreadCount > 0);
      const previousSlaBreached = Boolean(previous && previous.lastMessageAt < countSlaThreshold);
      const nextSlaBreached = Boolean(matches && conversation.lastMessageAt < countSlaThreshold);
      const exactTotalDelta = matches && !existed ? 1 : !matches && existed ? -1 : 0;
      const exactUnreadDelta = (nextUnread ? 1 : 0) - (previousUnread ? 1 : 0);
      const exactSlaDelta = (nextSlaBreached ? 1 : 0) - (previousSlaBreached ? 1 : 0);
      const accountCounts =
        countsAreExact && current.accountCounts
          ? {
              ...current.accountCounts,
              [conversation.channelId]: Math.max(
                0,
                (current.accountCounts[conversation.channelId] || 0) + exactTotalDelta,
              ),
            }
          : current.accountCounts;
      return {
        ...current,
        conversations,
        counts: {
          ...current.counts,
          total: countsAreExact
            ? Math.max(0, current.counts.total + exactTotalDelta)
            : matches && !existed
              ? Math.max(current.counts.total, conversations.length)
              : current.counts.total,
          unread: countsAreExact
            ? Math.max(0, current.counts.unread + exactUnreadDelta)
            : conversations.filter((row) => row.unreadCount > 0).length,
          slaBreached: countsAreExact
            ? Math.max(0, current.counts.slaBreached + exactSlaDelta)
            : current.counts.slaBreached,
        },
        accountCounts,
        allAccountCount:
          countsAreExact && typeof current.allAccountCount === 'number'
            ? Math.max(0, current.allAccountCount + exactTotalDelta)
            : current.allAccountCount,
        countsApproximate: current.countsApproximate,
        generatedAt: new Date().toISOString(),
      };
    });
  }, [conversationMatchesCurrentFilters]);

  const applyRealtimeMessage = React.useCallback((message: WhatsAppMessage) => {
    const loadedAt = new Date().toISOString();
    updateMessageCache(message.conversationId, (entry) => ({
      ...entry,
      messages: mergeWhatsAppMessages([...entry.messages, message]),
      loadedAt,
    }));

    const selected = selectedConversationRef.current;
    if (!selected || selected.id !== message.conversationId) return;

    setMessages((current) => {
      const merged = mergeWhatsAppMessages([...current, message]);
      const currentCache = getMessageCache(message.conversationId);
      rememberMessageCache(message.conversationId, {
        messages: merged,
        hasMore: currentCache?.hasMore ?? messagesHasMore,
        nextCursor: currentCache?.nextCursor || messagesOlderCursorRef.current,
        loadedAt,
      });
      return merged;
    });
    setMessagesLastLoadedAt(loadedAt);
  }, [messagesHasMore]);

  const scheduleRealtimeRefresh = React.useCallback((options?: { refreshActiveThread?: boolean }) => {
    if (realtimeRefreshTimerRef.current) {
      window.clearTimeout(realtimeRefreshTimerRef.current);
    }

    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void loadConversationPageRef.current?.({ silent: true });

      const conversation = selectedConversationRef.current;
      if (options?.refreshActiveThread && conversation) {
        void loadMessagesRef.current?.(conversation, {
          silent: true,
          sync: false,
          showIndicator: false,
        });
      }
    }, REALTIME_REFRESH_DEBOUNCE_MS);
  }, []);

  React.useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  React.useEffect(() => {
    messagesLengthRef.current = messages.length;
  }, [messages.length]);

  React.useEffect(() => {
    messagesOlderCursorRef.current = messagesOlderCursor;
  }, [messagesOlderCursor]);

  const loadMessages = React.useCallback(async (
    conversation: WhatsAppConversation,
    options?: { silent?: boolean; sync?: boolean; older?: boolean; showIndicator?: boolean },
  ) => {
    const older = options?.older ?? false;
    const silent = options?.silent ?? older;
    const loadKey = `${conversation.id}:${older ? 'older' : silent ? 'silent' : 'initial'}:${options?.sync ? 'sync' : 'db'}`;
    if (messageLoadInFlightKeyRef.current === loadKey) return;
    messageLoadInFlightKeyRef.current = loadKey;

    const requestId = messageRequestRef.current + 1;
    messageRequestRef.current = requestId;
    const showIndicator = options?.showIndicator ?? true;

    if (older) {
      const viewport = viewportRef.current;
      olderScrollSnapshotRef.current = viewport
        ? { scrollHeight: viewport.scrollHeight, scrollTop: viewport.scrollTop }
        : null;
      setMessagesLoadingOlder(true);
    } else if (silent) {
      const viewport = viewportRef.current;
      olderScrollSnapshotRef.current = viewport
        ? { scrollHeight: viewport.scrollHeight, scrollTop: viewport.scrollTop }
        : null;
      if (showIndicator) setMessagesRefreshing(true);
    } else {
      setMessages([]);
      setMessagesError(null);
      setMessagesLastLoadedAt(null);
      setMessagesHasMore(false);
      setMessagesOlderCursor(null);
      setMessagesLoading(true);
    }

    try {
      const payload = await fetchWhatsAppMessages({
        conversationId: conversation.id,
        limit: MESSAGE_PAGE_SIZE,
        maxPages: options?.sync ? 1 : undefined,
        sync: options?.sync ?? false,
        syncLimit: MESSAGE_SYNC_LIMIT,
        before: older ? messagesOlderCursorRef.current : null,
      });
      if (messageRequestRef.current !== requestId) return;
      const loadedAt = new Date().toISOString();
      if (older) {
        setMessages((current) => {
          const merged = mergeWhatsAppMessages([...payload.messages, ...current]);
          rememberMessageCache(conversation.id, {
            messages: merged,
            hasMore: Boolean(payload.hasMore),
            nextCursor: payload.nextCursor || null,
            loadedAt,
          });
          return merged;
        });
        setMessagesHasMore(Boolean(payload.hasMore));
        setMessagesOlderCursor(payload.nextCursor || null);
      } else if (silent) {
        React.startTransition(() => {
          setMessages((current) => {
            const merged = mergeWhatsAppMessages([...current, ...payload.messages]);
            const currentCache = getMessageCache(conversation.id);
            rememberMessageCache(conversation.id, {
              messages: merged,
              hasMore:
                messagesLengthRef.current <= MESSAGE_PAGE_SIZE
                  ? Boolean(payload.hasMore)
                  : currentCache?.hasMore ?? Boolean(payload.hasMore),
              nextCursor:
                messagesLengthRef.current <= MESSAGE_PAGE_SIZE
                  ? payload.nextCursor || null
                  : currentCache?.nextCursor || payload.nextCursor || null,
              loadedAt,
            });
            return merged;
          });
        });
        if (messagesLengthRef.current <= MESSAGE_PAGE_SIZE) {
          setMessagesHasMore(Boolean(payload.hasMore));
          setMessagesOlderCursor(payload.nextCursor || null);
        }
      } else {
        rememberMessageCache(conversation.id, {
          messages: payload.messages,
          hasMore: Boolean(payload.hasMore),
          nextCursor: payload.nextCursor || null,
          loadedAt,
        });
        setMessages(payload.messages);
        setMessagesHasMore(Boolean(payload.hasMore));
        setMessagesOlderCursor(payload.nextCursor || null);
      }
      setMessagesError(null);
      setMessagesLastLoadedAt(loadedAt);
    } catch (err: any) {
      if (messageRequestRef.current !== requestId) return;
      setMessagesError(err?.message || 'Gagal memuat isi percakapan.');
    } finally {
      if (messageRequestRef.current === requestId) {
        setMessagesLoading(false);
        setMessagesRefreshing(false);
        setMessagesLoadingOlder(false);
      }
      if (messageLoadInFlightKeyRef.current === loadKey) {
        messageLoadInFlightKeyRef.current = null;
      }
    }
  }, []);

  React.useEffect(() => {
    loadMessagesRef.current = loadMessages;
  }, [loadMessages]);

  React.useEffect(() => {
    const channel = supabase
      .channel('whatsapp-inbox-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_conversations' },
        (payload) => {
          const conversation = mapRealtimeConversation(payload.new);
          if (!conversation) return;
          upsertRealtimeConversation(conversation);
          scheduleRealtimeRefresh();
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' },
        (payload) => {
          const message = mapRealtimeMessage(payload.new);
          if (!message) return;
          applyRealtimeMessage(message);
          scheduleRealtimeRefresh({ refreshActiveThread: true });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages' },
        (payload) => {
          const message = mapRealtimeMessage(payload.new);
          if (!message) return;
          applyRealtimeMessage(message);
        },
      )
      .subscribe();

    return () => {
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [applyRealtimeMessage, scheduleRealtimeRefresh, upsertRealtimeConversation]);

  React.useEffect(() => {
    const conversation = selectedConversationRef.current;
    if (!conversation) {
      setMessages([]);
      setMessagesError(null);
      setMessagesLastLoadedAt(null);
      setMessagesHasMore(false);
      setMessagesOlderCursor(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const cached = getMessageCache(conversation.id);
      if (cached) {
        setMessages(cached.messages);
        setMessagesHasMore(cached.hasMore);
        setMessagesOlderCursor(cached.nextCursor);
        setMessagesLastLoadedAt(cached.loadedAt);
        setMessagesError(null);
        setMessagesLoading(false);
        setMessagesRefreshing(false);
        void loadMessages(conversation, {
          silent: true,
          sync: false,
          showIndicator: false,
        });
        return;
      }
      await loadMessages(conversation, { sync: false });
      if (cancelled) return;
      if (selectedConversationRef.current?.id !== conversation.id) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMessages, selectedId]);

  const prefetchConversationMessages = React.useCallback(async (conversation: WhatsAppConversation) => {
    if (!conversation?.id) return;
    if (getMessageCache(conversation.id) || messagePrefetchInFlight.has(conversation.id)) return;
    messagePrefetchInFlight.add(conversation.id);
    try {
      const payload = await fetchWhatsAppMessages({
        conversationId: conversation.id,
        limit: MESSAGE_PAGE_SIZE,
        sync: false,
      });
      rememberMessageCache(conversation.id, {
        messages: payload.messages,
        hasMore: Boolean(payload.hasMore),
        nextCursor: payload.nextCursor || null,
        loadedAt: new Date().toISOString(),
      });
    } catch {
      // Prefetch is opportunistic; the normal click path still handles errors.
    } finally {
      messagePrefetchInFlight.delete(conversation.id);
    }
  }, []);

  React.useEffect(() => {
    if (!filteredConversations.length) return undefined;
    const timeoutId = window.setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      filteredConversations
        .slice(0, MESSAGE_PREFETCH_LIMIT)
        .forEach((conversation) => {
          void prefetchConversationMessages(conversation);
        });
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [filteredConversations, prefetchConversationMessages]);

  React.useEffect(() => {
    if (!selectedId) return undefined;

    const intervalId = window.setInterval(() => {
      const conversation = selectedConversationRef.current;
      if (!conversation) return;
      if (document.visibilityState !== 'visible') return;
      void loadMessages(conversation, {
        silent: true,
        sync: false,
        showIndicator: false,
      });
    }, MESSAGE_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadMessages, selectedId]);

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.scrollLeft = 0;
    const olderSnapshot = olderScrollSnapshotRef.current;
    if (olderSnapshot) {
      olderScrollSnapshotRef.current = null;
      viewport.scrollTop = olderSnapshot.scrollTop + (viewport.scrollHeight - olderSnapshot.scrollHeight);
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
    window.requestAnimationFrame(() => {
      viewport.scrollLeft = 0;
    });
  }, [messages]);

  React.useEffect(() => {
    return () => {
      if (selectedAttachment?.previewUrl) URL.revokeObjectURL(selectedAttachment.previewUrl);
    };
  }, [selectedAttachment?.previewUrl]);

  const latestInboundMessage = React.useMemo(() => getLatestInboundMessage(messages), [messages]);

  const latestInboundWamid = React.useMemo(() => {
    return (
      [...messages]
        .reverse()
        .find((message) => message.direction === 'inbound' && message.id.startsWith('wamid.'))?.id ||
      null
    );
  }, [messages]);

  const canSendWhatsAppReply = Boolean(
    selectedConversation &&
      hasPermission('whatsapp.chats.reply') &&
      selectedConversation.provider === 'kirimdev' &&
      (selectedConversation.contactPhone || selectedConversation.contactId),
  );
  const canRefreshKirimdevInbox =
    hasPermission('whatsapp.view') || hasPermission('whatsapp.settings.manage');
  const shouldRunKirimdevLiveSync = Boolean(
    canRefreshKirimdevInbox && data?.kirimdev?.apiKeyConfigured,
  );

  const syncKirimdevInboxInBackground = React.useCallback(async (options?: {
    minIntervalMs?: number;
    refreshActiveThread?: boolean;
  }) => {
    if (!canRefreshKirimdevInbox) return null;
    if (kirimdevInboxSyncInFlightRef.current) return null;

    const now = Date.now();
    const minIntervalMs = options?.minIntervalMs ?? 0;
    if (
      minIntervalMs > 0 &&
      now - lastKirimdevInboxSyncAtRef.current < minIntervalMs
    ) {
      return null;
    }

    kirimdevInboxSyncInFlightRef.current = true;
    lastKirimdevInboxSyncAtRef.current = now;

    try {
      const result = await syncKirimdevInbox({
        conversationLimit: KIRIMDEV_INBOX_SYNC_CONVERSATION_LIMIT,
        maxPages: 1,
        includeMessages: true,
        messageLimit: KIRIMDEV_INBOX_SYNC_MESSAGE_LIMIT,
      });

      await Promise.all([
        reload({ silent: true, quiet: true }),
        loadConversationPage({ silent: true }),
      ]);

      const conversation = selectedConversationRef.current;
      if (options?.refreshActiveThread !== false && conversation) {
        await loadMessages(conversation, {
          silent: true,
          sync: false,
          showIndicator: false,
        });
      }

      return result;
    } catch {
      return null;
    } finally {
      kirimdevInboxSyncInFlightRef.current = false;
    }
  }, [canRefreshKirimdevInbox, loadConversationPage, loadMessages, reload]);

  React.useEffect(() => {
    if (!shouldRunKirimdevLiveSync) return undefined;

    const timeoutId = window.setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      void syncKirimdevInboxInBackground({
        minIntervalMs: KIRIMDEV_INBOX_AUTO_SYNC_MIN_INTERVAL_MS,
        refreshActiveThread: false,
      });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [activeDateRangeKey, shouldRunKirimdevLiveSync, syncKirimdevInboxInBackground]);

  React.useEffect(() => {
    if (!shouldRunKirimdevLiveSync) return undefined;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void syncKirimdevInboxInBackground({
        minIntervalMs: KIRIMDEV_INBOX_AUTO_SYNC_MIN_INTERVAL_MS,
      });
    }, KIRIMDEV_INBOX_AUTO_SYNC_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [shouldRunKirimdevLiveSync, syncKirimdevInboxInBackground]);

  const sendDisabledReason = React.useMemo(() => {
    if (!selectedConversation) return 'Pilih percakapan terlebih dahulu.';
    if (!hasPermission('whatsapp.chats.reply')) {
      return 'Role Anda belum punya permission untuk membalas chat WhatsApp.';
    }
    if (selectedConversation.provider !== 'kirimdev') {
      return 'Balasan WhatsApp di modul ini memakai jalur Kirimdev.';
    }
    if (!selectedConversation.contactPhone && !selectedConversation.contactId) {
      return 'Kontak belum punya nomor tujuan yang valid.';
    }
    return null;
  }, [hasPermission, selectedConversation]);

  const clearSelectedAttachment = React.useCallback(() => {
    setSelectedAttachment(null);
  }, []);

  const resetComposerText = React.useCallback(() => {
    composerTextRef.current = '';
    setHasComposerText(false);
    if (composerTextareaRef.current) {
      composerTextareaRef.current.value = '';
    }
  }, []);

  const updateComposerText = React.useCallback((value: string) => {
    composerTextRef.current = value;
    const nextHasText = Boolean(value.trim());
    setHasComposerText((current) => (current === nextHasText ? current : nextHasText));
  }, []);

  React.useEffect(() => {
    resetComposerText();
    setSelectedAttachment(null);
  }, [resetComposerText, selectedConversation?.id]);

  const handlePickAttachment = React.useCallback((kind: 'any' | WhatsAppOutboundMediaType) => {
    if (!selectedConversation || !canSendWhatsAppReply) {
      toast.error(sendDisabledReason || 'Percakapan belum bisa menerima balasan WhatsApp.');
      return;
    }

    const input =
      kind === 'image'
        ? imageAttachmentInputRef.current
        : kind === 'document'
        ? documentAttachmentInputRef.current
        : kind === 'audio'
        ? audioAttachmentInputRef.current
        : genericAttachmentInputRef.current;
    input?.click();
  }, [canSendWhatsAppReply, selectedConversation, sendDisabledReason]);

  const handleAttachmentSelected = React.useCallback((
    event: React.ChangeEvent<HTMLInputElement>,
    preferredType?: WhatsAppOutboundMediaType,
  ) => {
    const file = event.currentTarget.files?.[0] || null;
    event.currentTarget.value = '';
    if (!file) return;

    const type = inferComposerAttachmentType(file, preferredType);
    if (!type) {
      toast.error('Tipe file ini belum didukung untuk lampiran WhatsApp.');
      return;
    }

    const validationMessage = validateComposerAttachment(file, type);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    if (type === 'audio') resetComposerText();
    setSelectedAttachment({
      file,
      type,
      previewUrl: type === 'image' ? URL.createObjectURL(file) : null,
    });
  }, [resetComposerText]);

  const handleSendMessage = React.useCallback(async () => {
    if (!selectedConversation || !canSendWhatsAppReply) return;
    const text = composerTextRef.current.trim();
    if (!text && !selectedAttachment) return;
    if (selectedAttachment?.type === 'audio' && text) {
      toast.error('Audio WhatsApp tidak mendukung caption. Kirim teks terpisah setelah audio.');
      return;
    }

    setSendingMessage(true);
    try {
      let uploadedMedia: Awaited<ReturnType<typeof uploadWhatsAppMedia>>['media'] | null = null;
      if (selectedAttachment) {
        setUploadingAttachment(true);
        const uploadPayload = await uploadWhatsAppMedia({
          file: selectedAttachment.file,
          type: selectedAttachment.type,
        });
        uploadedMedia = uploadPayload.media;
      }

      const payload = await sendWhatsAppMessage({
        conversationId: selectedConversation.id,
        channelId: selectedConversation.channelId,
        to: selectedConversation.contactPhone || selectedConversation.contactId,
        text,
        media: uploadedMedia
          ? {
              type: uploadedMedia.type,
              url: uploadedMedia.url,
              fileName: uploadedMedia.fileName,
              mimeType: uploadedMedia.mimeType,
            }
          : null,
        replyToMessageId: latestInboundWamid,
      });

      resetComposerText();
      clearSelectedAttachment();
      setMessages((current) => [...current, payload.message]);
      toast.success(uploadedMedia ? 'Lampiran WhatsApp dikirim lewat Kirimdev.' : 'Balasan WhatsApp dikirim lewat Kirimdev.');
      await Promise.all([
        loadMessages(selectedConversation, { silent: true, sync: false, showIndicator: false }),
        loadConversationPage({ silent: true }),
        reload({ silent: true, quiet: true }),
      ]);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengirim balasan WhatsApp.');
    } finally {
      setSendingMessage(false);
      setUploadingAttachment(false);
    }
  }, [
    canSendWhatsAppReply,
    clearSelectedAttachment,
    latestInboundWamid,
    loadConversationPage,
    loadMessages,
    reload,
    resetComposerText,
    selectedAttachment,
    selectedConversation,
  ]);

  const handleSelectConversation = React.useCallback((conversationId: string) => {
    setSelectedId(conversationId);
  }, []);

  const totalConversationCount = conversationPage?.counts.total ?? dateScopedConversations.length;
  const allAccountConversationCount =
    conversationPage?.allAccountCount ??
    (conversationPage?.accountCounts
      ? Object.values(conversationPage.accountCounts).reduce((sum, count) => sum + count, 0)
      : totalConversationCount);
  const exactStatusCounts = conversationPage?.filterCounts?.status ?? null;
  const exactSlaCounts = conversationPage?.filterCounts?.sla ?? null;
  const getSidebarStatusCount = React.useCallback((filter: InboxStatusFilter) => {
    if (exactStatusCounts) return exactStatusCounts[filter];
    return getStatusFilterCount(filter, dateScopedConversations);
  }, [dateScopedConversations, exactStatusCounts]);
  const getSidebarSlaCount = React.useCallback((filter: InboxSlaFilter) => {
    if (exactSlaCounts) {
      if (filter === 'at_risk') return exactSlaCounts.atRisk;
      return exactSlaCounts[filter];
    }
    return getSlaFilterCount(filter, dateScopedConversations);
  }, [dateScopedConversations, exactSlaCounts]);
  const openCount = exactStatusCounts?.open ?? conversationPage?.counts.total ?? getStatusFilterCount('open', dateScopedConversations);
  const unreadCount = exactStatusCounts?.unread ?? conversationPage?.counts.unread ?? getStatusFilterCount('unread', dateScopedConversations);
  const slaBreachedCount = exactSlaCounts?.breached ?? conversationPage?.counts.slaBreached ?? getSlaFilterCount('breached', dateScopedConversations);
  const countsAreApproximate = Boolean(conversationPage?.countsApproximate && conversationPage.hasMore);
  const formatMaybeApproximateCount = React.useCallback((count: number) => {
    const formatted = formatNumber(count);
    return countsAreApproximate ? `${formatted}+` : formatted;
  }, [countsAreApproximate]);
  const getAccountOptionCount = React.useCallback((channelId: string) => {
    if (selectedAccountId !== ALL_ACCOUNTS_VALUE && channelId === selectedAccountId) {
      return totalConversationCount;
    }
    return accountConversationCountById.get(channelId) || 0;
  }, [accountConversationCountById, selectedAccountId, totalConversationCount]);
  const selectedConversationAccount = getConversationAccount(selectedConversation, enrichedAccounts);
  const selectedConversationAccountLabel = selectedConversation
    ? selectedConversationAccount
      ? getAccountLabel(selectedConversationAccount)
      : selectedConversation.channelId
    : '';
  const selectedConversationStatus = selectedConversation
    ? getConversationInboxStatus(selectedConversation)
    : 'open';
  const selectedConversationStatusLabel = getInboxStatusLabel(selectedConversationStatus);
  const selectedMessageCount = selectedConversation?.messageCount || messages.length || 0;
  const selectedConversationDisplayName = getConversationDisplayName(selectedConversation);
  const selectedConversationSubtitle = getConversationSubtitle(selectedConversation);
  const selectedConversationPhone = React.useMemo(() => {
    if (!selectedConversation) return '';
    return (
      normalizeConversationPhone(selectedConversation.contactPhone) ||
      normalizeConversationPhone(selectedConversation.contactId) ||
      ''
    );
  }, [selectedConversation]);
  const selectedConversationPhoneKey = React.useMemo(
    () => normalizeComparablePhoneNumber(selectedConversationPhone),
    [selectedConversationPhone],
  );
  const selectedConversationOpenLead = React.useMemo(() => {
    if (!selectedConversationPhoneKey) return null;
    return (
      leads.find(
        (lead) =>
          normalizeComparablePhoneNumber(lead.phone) === selectedConversationPhoneKey &&
          isOpenLeadStatus(lead.status),
      ) || null
    );
  }, [leads, selectedConversationPhoneKey]);
  const selectedLastInboundAt =
    latestInboundMessage?.timestamp ||
    (selectedConversation?.lastDirection === 'inbound' ? selectedConversation.lastMessageAt : null);
  const selectedServiceWindow = getServiceWindowState(
    selectedLastInboundAt || selectedConversation?.lastMessageAt,
  );
  const composerBusy = sendingMessage || uploadingAttachment;
  const hasComposerPayload = Boolean(hasComposerText || selectedAttachment);
  const loading = (conversationsLoading || overviewLoading) && !conversationPage;
  const refreshing = overviewRefreshing || conversationsRefreshing;
  const error = overviewError || conversationsError;
  const canCreateProspectFromChat =
    Boolean(selectedConversation && selectedConversationPhoneKey) &&
    !selectedConversationOpenLead &&
    !creatingProspectFromChat;

  const handleCreateProspectFromChat = React.useCallback(async () => {
    if (!selectedConversation) return;

    if (!selectedConversationPhoneKey || !selectedConversationPhone) {
      toast.error('Nomor WhatsApp percakapan ini belum tersedia.');
      return;
    }

    if (selectedConversationOpenLead) {
      toast.info('Percakapan ini sudah punya prospek aktif.');
      return;
    }

    const rawContactName = selectedConversation.contactName?.trim() || '';
    const displayName = selectedConversationDisplayName.trim();
    const hasRealName = hasUsefulContactName(rawContactName);
    const nameCandidate = hasRealName ? rawContactName : displayName;
    const leadName =
      nameCandidate && nameCandidate !== 'Kontak WhatsApp' && !nameCandidate.startsWith('+')
        ? nameCandidate
        : selectedConversationPhone;
    const notes = [
      'Dibuat manual dari Live Chat.',
      selectedConversation.lastMessageText
        ? `Pesan terakhir: ${selectedConversation.lastMessageText}`
        : null,
      selectedConversationAccountLabel ? `Akun WhatsApp: ${selectedConversationAccountLabel}` : null,
      selectedConversation.channelId ? `Channel ID: ${selectedConversation.channelId}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    const manualLead: Lead = {
      id: generateManualWhatsAppLeadId(),
      name: leadName,
      phone: selectedConversationPhone,
      status: 'Pending',
      timestamp: new Date().toISOString(),
      lastContact: 'Live Chat WhatsApp',
      csId: currentUser?.id,
      notes,
      origin: MANUAL_WHATSAPP_LEAD_ORIGIN,
    };

    try {
      setCreatingProspectFromChat(true);
      await addLead(manualLead, { silent: true });
      toast.success('Prospek dibuat dari Live Chat.');
    } catch (err: any) {
      toast.error(err?.message || 'Gagal membuat prospek dari Live Chat.');
    } finally {
      setCreatingProspectFromChat(false);
    }
  }, [
    addLead,
    currentUser?.id,
    selectedConversation,
    selectedConversationAccountLabel,
    selectedConversationDisplayName,
    selectedConversationOpenLead,
    selectedConversationPhone,
    selectedConversationPhoneKey,
  ]);

  return (
    <div
      style={whatsAppInboxStyle}
      className={cn(
        isFullscreen ? 'flex flex-col bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-100' : cls.moduleShell,
        isFullscreen
          ? 'fixed inset-0 z-[60] h-[100dvh]'
          : 'h-full min-h-0',
      )}
    >
      {error ? (
        <div className="flex flex-none items-start gap-3 border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">Daftar percakapan belum berhasil dimuat.</div>
            <div className="mt-1">{error}</div>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          showCustomerPanel ? cls.layoutGridWithCustomer : cls.layoutGrid,
        )}
      >
        <aside className={cls.sidebarPanel}>
          <ScrollArea className="min-h-0 flex-1">
            <div className={cls.sidebarBody}>

              <div className={cn(cls.sidebarSection, cls.sidebarSurface)}>
                <div className={cn(cls.sectionLabel, 'mb-0.5')}>Akun WhatsApp</div>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className={cls.accountSelectTrigger}>
                    {selectedAccount ? (
                      <AccountSelectRow
                        title={getAccountDisplayName(selectedAccount)}
                        subtitle={getAccountDisplayPhone(selectedAccount)}
                        count={getAccountOptionCount(getAccountChannelId(selectedAccount))}
                      />
                    ) : (
                      <AccountSelectRow
                        title="Semua akun"
                        subtitle={`${formatNumber(enrichedAccounts.length)} akun`}
                        count={allAccountConversationCount}
                      />
                    )}
                  </SelectTrigger>
                  <SelectContent
                    align="start"
                    sideOffset={6}
                    className={cls.accountSelectContent}
                  >
                    <SelectItem
                      value={ALL_ACCOUNTS_VALUE}
                      className={cls.accountSelectItem}
                    >
                      <AccountSelectRow
                        title="Semua akun"
                        subtitle={`${formatNumber(enrichedAccounts.length)} akun`}
                        count={allAccountConversationCount}
                      />
                    </SelectItem>
                    {enrichedAccounts.map((account) => {
                      const channelId = getAccountChannelId(account);
                      const accountCount = getAccountOptionCount(channelId);
                      return (
                        <SelectItem
                          key={channelId}
                          value={channelId}
                          className={cls.accountSelectItem}
                        >
                          <AccountSelectRow
                            title={getAccountDisplayName(account)}
                            subtitle={getAccountDisplayPhone(account)}
                            count={accountCount}
                          />
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <SidebarFilterSection
                id="whatsapp-sidebar-status"
                title="Status"
                collapsed={collapsedSidebarSections.status}
                onOpenChange={(open) => setSidebarSectionOpen('status', open)}
              >
                <div className="space-y-1">
                  {STATUS_FILTERS.map((filter) => {
                    const Icon =
                      filter.id === 'all'
                        ? Inbox
                        : filter.id === 'unread'
                        ? Mail
                        : filter.id === 'open'
                        ? Circle
                        : filter.id === 'pending'
                        ? Clock3
                        : CheckCircle2;
                    const isActive = statusFilter === filter.id;
                    return (
                      <FilterRow
                        key={filter.id}
                        active={isActive}
                        count={formatNumber(getSidebarStatusCount(filter.id))}
                        icon={
                          <Icon
                            className={cn(
                              'h-4 w-4',
                              filter.id === 'pending' && 'text-amber-500',
                              filter.id === 'open' && 'text-emerald-600',
                            )}
                          />
                        }
                        label={filter.label}
                        onClick={() => setStatusFilter(filter.id)}
                        tone={filter.id === 'all' || filter.id === 'open' ? 'accent' : 'neutral'}
                      />
                    );
                  })}
                </div>
              </SidebarFilterSection>

              <SidebarFilterSection
                id="whatsapp-sidebar-provider"
                title="Provider"
                collapsed={collapsedSidebarSections.provider}
                onOpenChange={(open) => setSidebarSectionOpen('provider', open)}
              >
                <div className="space-y-1">
                  {PROVIDER_FILTERS.map((filter) => {
                    const isActive = providerFilter === filter.id;
                    return (
                      <FilterRow
                        key={filter.id}
                        active={isActive}
                        icon={<Wifi className="h-4 w-4 text-emerald-600" />}
                        label={filter.label}
                        onClick={() => setProviderFilter(filter.id)}
                      />
                    );
                  })}
                </div>
              </SidebarFilterSection>

              <SidebarFilterSection
                id="whatsapp-sidebar-sla"
                title="SLA"
                collapsed={collapsedSidebarSections.sla}
                onOpenChange={(open) => setSidebarSectionOpen('sla', open)}
              >
                <div className="space-y-1">
                  {[
                    { id: 'all' as const, label: 'Semua', Icon: Inbox },
                    { id: 'at_risk' as const, label: 'Hampir lewat', Icon: Clock3 },
                    { id: 'breached' as const, label: 'Lewat SLA', Icon: AlertTriangle },
                  ].map((filter) => {
                    const isActive = slaFilter === filter.id;
                    const Icon = filter.Icon;
                    return (
                      <FilterRow
                        key={filter.id}
                        active={isActive}
                        count={formatNumber(getSidebarSlaCount(filter.id))}
                        icon={
                          <Icon
                            className={cn(
                              'h-4 w-4',
                              filter.id === 'at_risk' && 'text-orange-500',
                              filter.id === 'breached' && 'text-rose-500',
                            )}
                          />
                        }
                        label={filter.label}
                        onClick={() => setSlaFilter(filter.id)}
                        tone={filter.id === 'breached' ? 'danger' : filter.id === 'all' ? 'accent' : 'neutral'}
                      />
                    );
                  })}
                </div>
              </SidebarFilterSection>

              <SidebarFilterSection
                id="whatsapp-sidebar-labels"
                title="Label"
                collapsed={collapsedSidebarSections.labels}
                onOpenChange={(open) => setSidebarSectionOpen('labels', open)}
              >
                <div className="flex h-10 items-center gap-2 rounded-xl px-2.5 text-sm text-slate-500 dark:text-slate-400">
                  <Tag className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span className="truncate">Belum ada label</span>
                </div>
              </SidebarFilterSection>
            </div>
          </ScrollArea>
        </aside>

        <section
          className={cn(
            cls.listPanel,
            selectedId ? 'hidden lg:flex' : 'flex',
          )}
        >
          <div className="flex-none">
            <div className={cls.statGrid}>
                <InboxStatButton
                  onClick={() => setStatusFilter('open')}
                  active={statusFilter === 'open'}
                  icon={<Circle className="h-4 w-4 text-emerald-600" />}
                  label="Aktif"
                  count={formatMaybeApproximateCount(openCount)}
                />
                <InboxStatButton
                  onClick={() => setStatusFilter('unread')}
                  active={statusFilter === 'unread'}
                  icon={<Mail className="h-4 w-4 text-sky-600" />}
                  label="Belum dibaca"
                  count={formatMaybeApproximateCount(unreadCount)}
                />
                <InboxStatButton
                  onClick={() => setSlaFilter('breached')}
                  active={slaFilter === 'breached'}
                  icon={<AlertTriangle className="h-4 w-4 text-rose-600" />}
                  label="SLA"
                  count={formatMaybeApproximateCount(slaBreachedCount)}
                  tone="danger"
                />
            </div>
            <div className={cls.listHeaderBody}>
              <div className="space-y-2">
                <div className="relative">
                  <Search className={cls.searchIcon} />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cari chat, kontak, atau nomor..."
                    className={cls.searchField}
                  />
                </div>
                <SmartFilterDate
                  date={dateRange}
                  setDate={setDateRange}
                  className="w-full [&_button]:h-11 [&_button]:justify-start [&_button]:rounded-xl [&_button]:border-slate-200/90 [&_button]:shadow-none [&_button]:focus-visible:border-blue-500 [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-blue-100"
                />
              </div>
              <div className={cls.listToolbar}>
                <span className="min-w-0 truncate">
                  Menampilkan {formatNumber(filteredConversations.length)} dari {formatMaybeApproximateCount(totalConversationCount)} percakapan
                </span>
                <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-blue-700 dark:text-blue-300">
                  <span className={cn(
                    'h-2 w-2 rounded-full bg-emerald-500',
                    refreshing && 'animate-pulse',
                  )} />
                  Realtime
                </div>
              </div>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="py-2">
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="mx-2 mb-2 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
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
                      Belum ada percakapan WhatsApp untuk filter ini.
                    </div>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      Inbox Kirimdev disinkronkan otomatis. Coba ubah filter tanggal atau tunggu pembaruan berikutnya.
                    </p>
                  </div>
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <ConversationListRow
                    key={conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === selectedId}
                    onPrefetch={prefetchConversationMessages}
                    onSelect={handleSelectConversation}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </section>

        <section
          className={cn(
            'min-h-0 flex-col bg-white dark:bg-slate-950',
            selectedId ? 'flex' : 'hidden lg:flex',
          )}
        >
          <div className={cn(cls.headerBand, 'gap-2 overflow-hidden py-2')}>
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              {selectedConversation ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSelectedId(null)}
                  size="sm"
                  className="waMobileOnlyAction h-9 max-w-[7.5rem] shrink-0 gap-1.5 rounded-xl px-2 text-xs font-semibold text-slate-600 shadow-none hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                  title="Kembali ke list chat"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="truncate">List Chat</span>
                </Button>
              ) : null}
              <WhatsAppContactAvatar
                src={getConversationAvatarUrl(selectedConversation)}
                name={selectedConversationDisplayName}
                phone={selectedConversation?.contactPhone}
                className={cn(cls.avatarHeader, 'hidden sm:flex')}
                fallback="WA"
              />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">
                  {selectedConversation ? selectedConversationDisplayName : 'Pilih percakapan'}
                </h2>
                <div className="mt-1 min-w-0 truncate text-xs text-slate-500">
                  {selectedConversation ? selectedConversationSubtitle : 'Pilih thread di kiri untuk membaca isi pesan.'}
                </div>
              </div>
            </div>
            <div className="flex min-w-0 shrink-0 items-center gap-1.5">
              {selectedConversation ? (
                <div className="hidden max-w-[42vw] items-center justify-end gap-1.5 overflow-hidden 2xl:flex">
                  <StatusChip
                    className="max-w-[8rem]"
                    tone={
                      selectedServiceWindow.isOpen
                        ? selectedServiceWindow.isAtRisk
                          ? 'warning'
                          : 'success'
                        : 'danger'
                    }
                  >
                    <Clock3 className="h-3 w-3" />
                    <span className="truncate">{selectedServiceWindow.remainingLabel}</span>
                  </StatusChip>
                  <StatusChip>
                    <Circle className="h-3 w-3 text-emerald-600" />
                    {selectedConversationStatusLabel}
                  </StatusChip>
                  <StatusChip>
                    <MessageCircle className="h-3 w-3" />
                    {formatNumber(selectedMessageCount)} pesan
                  </StatusChip>
                  {selectedConversationOpenLead ? (
                    <StatusChip tone="success">
                      <CheckCircle2 className="h-3 w-3" />
                      Sudah Prospek
                    </StatusChip>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCreateProspectFromChat}
                      disabled={!canCreateProspectFromChat}
                      className="hidden h-8 shrink-0 gap-1.5 rounded-xl border-emerald-100 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 shadow-none hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 2xl:inline-flex"
                      title="Jadikan prospek"
                    >
                      {creatingProspectFromChat ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5" />
                      )}
                      Jadikan Prospek
                    </Button>
                  )}
                  {messagesLastLoadedAt ? (
                    <StatusChip className="hidden 2xl:inline-flex">
                      <RefreshCcw className="h-3 w-3" />
                      {formatRelativeTime(messagesLastLoadedAt)}
                    </StatusChip>
                  ) : null}
                </div>
              ) : null}
              {selectedConversationOpenLead ? (
                <StatusChip
                  tone="success"
                  className="max-w-[9rem] px-2 sm:px-2.5 2xl:hidden"
                  title="Sudah prospek"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="hidden truncate sm:inline">Sudah Prospek</span>
                  <span className="sr-only sm:hidden">Sudah Prospek</span>
                </StatusChip>
              ) : null}
              {selectedConversation ? (
                <span className="hidden h-5 w-px bg-slate-200 2xl:block dark:bg-slate-800" />
              ) : null}
              <div className="flex items-center gap-1.5">
                {selectedConversation ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/orders')}
                    className="waMobileOnlyAction h-9 w-9 shrink-0 gap-1.5 rounded-xl border-blue-100 bg-blue-50 p-0 text-xs font-semibold text-blue-700 shadow-none hover:bg-blue-100"
                    title="Buka list pesanan"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Pesanan</span>
                  </Button>
                ) : null}
                {selectedConversation && !selectedConversationOpenLead ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCreateProspectFromChat}
                    disabled={!canCreateProspectFromChat}
                    className="h-8 w-8 shrink-0 gap-1.5 rounded-xl border-emerald-100 bg-emerald-50 p-0 text-xs font-semibold text-emerald-700 shadow-none hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-2.5 2xl:hidden"
                    title="Jadikan prospek"
                  >
                    {creatingProspectFromChat ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">Prospek</span>
                  </Button>
                ) : null}
                <IconButton
                  onClick={() => setIsFullscreen((current) => !current)}
                  size="sm"
                  title={isFullscreen ? 'Keluar layar penuh (Esc)' : 'Layar penuh'}
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </IconButton>
                <IconButton
                  onClick={() => setShowCustomerPanel((current) => !current)}
                  active={showCustomerPanel}
                  className="hidden min-[1900px]:flex"
                  size="sm"
                  title={showCustomerPanel ? 'Tutup detail kontak' : 'Tampilkan detail kontak'}
                >
                  <Info className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div
              ref={viewportRef}
              className={cn(cls.chatViewport, 'wa-chat-wallpaper')}
            >
              {!selectedConversation ? (
                <div className="flex h-full items-center justify-center text-center">
                  <div>
                    <MessageCircle className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700" />
                    <div className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                      Pilih percakapan untuk membuka thread.
                    </div>
                  </div>
                </div>
              ) : messagesLoading ? (
                <div className="flex h-full items-center justify-center text-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    Memuat pesan
                  </div>
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
                <div className={cls.messageStack}>
                  {messagesHasMore ? (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-md border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                        disabled={messagesLoadingOlder || !messagesOlderCursor}
                        onClick={() => {
                          if (!selectedConversation || !messagesOlderCursor) return;
                          void loadMessages(selectedConversation, { older: true });
                        }}
                      >
                        {messagesLoadingOlder ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Clock3 className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Pesan lama
                      </Button>
                    </div>
                  ) : null}
                  {messages.map((message) => (
                    <ChatMessageBubble key={`${message.conversationId}:${message.id}`} message={message} />
                  ))}
                </div>
              )}
            </div>

            <div className={cls.composerDock}>
              {!canSendWhatsAppReply && sendDisabledReason ? (
                <div className="mb-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {sendDisabledReason}
                </div>
              ) : null}
              <input
                ref={genericAttachmentInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,video/mp4,video/3gpp,audio/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                onChange={(event) => handleAttachmentSelected(event)}
              />
              <input
                ref={imageAttachmentInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png"
                onChange={(event) => handleAttachmentSelected(event, 'image')}
              />
              <input
                ref={documentAttachmentInputRef}
                type="file"
                className="hidden"
                accept="application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                onChange={(event) => handleAttachmentSelected(event, 'document')}
              />
              <input
                ref={audioAttachmentInputRef}
                type="file"
                className="hidden"
                accept="audio/*"
                onChange={(event) => handleAttachmentSelected(event, 'audio')}
              />
              {selectedAttachment ? (
                <div className="mb-2 flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
                  {selectedAttachment.previewUrl ? (
                    <img
                      src={selectedAttachment.previewUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-md object-cover"
                    />
                  ) : selectedAttachment.type === 'audio' ? (
                    <Mic className="h-5 w-5 shrink-0 text-slate-500" />
                  ) : selectedAttachment.type === 'video' ? (
                    <Video className="h-5 w-5 shrink-0 text-slate-500" />
                  ) : (
                    <FileText className="h-5 w-5 shrink-0 text-slate-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800 dark:text-slate-100">
                      {selectedAttachment.file.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {getComposerAttachmentLabel(selectedAttachment.type)} | {formatFileSize(selectedAttachment.file.size)}
                    </div>
                  </div>
                  <IconButton
                    type="button"
                    onClick={clearSelectedAttachment}
                    className="text-slate-500 hover:bg-white dark:hover:bg-slate-800"
                    size="sm"
                    title="Hapus lampiran"
                  >
                    <X className="h-4 w-4" />
                  </IconButton>
                </div>
              ) : null}
              <div className={cls.composerShell}>
                <div className="relative min-w-0 self-stretch">
                  <Textarea
                    ref={composerTextareaRef}
                    defaultValue=""
                    onChange={(event) => updateComposerText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    placeholder=""
                    aria-label={
                      selectedAttachment?.type === 'audio'
                        ? 'Audio siap dikirim'
                        : selectedAttachment
                        ? 'Caption opsional'
                        : 'Tulis pesan atau pakai shortcut'
                    }
                    style={{ textAlign: 'left' }}
                    className="waComposerTextarea min-w-0 resize-none border-0 bg-transparent px-2 py-2 text-left text-sm leading-5 shadow-none focus-visible:ring-0"
                    disabled={!selectedConversation || !canSendWhatsAppReply || composerBusy || selectedAttachment?.type === 'audio'}
                  />
                  {!hasComposerText ? (
                    <span className="pointer-events-none absolute left-2 top-2 text-left text-sm leading-5 text-slate-400">
                      {selectedAttachment?.type === 'audio'
                        ? 'Audio siap dikirim'
                        : selectedAttachment
                        ? 'Caption opsional...'
                        : 'Tulis pesan atau pakai /shortcut...'}
                    </span>
                  ) : null}
                </div>
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <IconButton
                      type="button"
                      onClick={() => handlePickAttachment('any')}
                      disabled={!selectedConversation || !canSendWhatsAppReply || composerBusy}
                      className="text-slate-500"
                      title="Tambah lampiran"
                    >
                      <Plus className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      type="button"
                      onClick={() => handlePickAttachment('image')}
                      disabled={!selectedConversation || !canSendWhatsAppReply || composerBusy}
                      className="text-slate-500"
                      title="Pilih gambar"
                    >
                      <ImagePlus className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      type="button"
                      onClick={() => handlePickAttachment('document')}
                      disabled={!selectedConversation || !canSendWhatsAppReply || composerBusy}
                      className="text-slate-500"
                      title="Pilih dokumen"
                    >
                      <Paperclip className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      type="button"
                      onClick={() => handlePickAttachment('audio')}
                      disabled={!selectedConversation || !canSendWhatsAppReply || composerBusy}
                      className="text-slate-500"
                      title="Pilih audio"
                    >
                      <Mic className="h-4 w-4" />
                    </IconButton>
                  </div>
                  <Button
                    variant="success"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 shadow-[0_12px_28px_rgba(37,99,235,0.28)] hover:from-sky-500 hover:to-blue-800"
                    onClick={() => void handleSendMessage()}
                    disabled={!hasComposerPayload || !canSendWhatsAppReply || composerBusy}
                  >
                    {composerBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {showCustomerPanel ? (
          <aside className="hidden min-h-0 overflow-hidden border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 min-[1900px]:flex min-[1900px]:flex-col">
            <div className={cls.headerBand}>
              <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-100">Detail Kontak</h2>
              <IconButton
                onClick={() => setShowCustomerPanel(false)}
                className="text-slate-500"
                size="sm"
                title="Tutup detail kontak"
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            <ScrollArea className="min-h-0 flex-1">
            {selectedConversation ? (
              <div>
                <div className="border-b border-slate-200 px-4 py-5 text-center dark:border-slate-800">
                  <WhatsAppContactAvatar
                    src={getConversationAvatarUrl(selectedConversation)}
                    name={selectedConversationDisplayName}
                    phone={selectedConversation.contactPhone}
                    className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-base font-semibold text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <div
                    className="mt-3 truncate font-semibold text-slate-950 dark:text-slate-100"
                    title={selectedConversationDisplayName}
                  >
                    {selectedConversationDisplayName}
                  </div>
                  <div
                    className="mt-2 flex min-w-0 items-center justify-center gap-1 text-xs text-slate-500"
                    title={selectedConversationSubtitle}
                  >
                    <Smartphone className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{selectedConversationSubtitle}</span>
                  </div>
                </div>

                <div className="border-b border-slate-200 px-3 py-3 dark:border-slate-800">
                  <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 text-xs dark:bg-slate-900">
                    {['Detail', 'Aktivitas', 'Catatan', 'Deal'].map((tab, index) => (
                      <button
                        key={tab}
                        disabled={index !== 0}
                        title={index === 0 ? undefined : `${tab} belum tersedia di modul inbox ini.`}
                        className={cn(
                          'h-8 min-w-0 rounded-md px-1.5 font-medium transition-colors',
                          index === 0
                            ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-slate-100'
                            : 'cursor-not-allowed text-slate-400',
                        )}
                      >
                        <span className="block truncate">{tab}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <div className="space-y-3 px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Status
                    </div>
                    <StatusChip tone="success">
                      <Circle className="h-3 w-3 fill-current" />
                      {selectedConversationStatusLabel}
                    </StatusChip>
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <span className="text-slate-500">Ditugaskan ke</span>
                      <span className="truncate font-medium text-slate-700 dark:text-slate-200">Belum ditugaskan</span>
                    </div>
                  </div>

                  <div className="space-y-2 px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Nama
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <span
                        className="min-w-0 truncate font-medium text-slate-950 dark:text-slate-100"
                        title={selectedConversationDisplayName}
                      >
                        {selectedConversationDisplayName}
                      </span>
                      <button
                        className="cursor-not-allowed text-xs font-medium text-slate-400"
                        disabled
                        title="Edit kontak belum tersedia di modul inbox ini."
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Email
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <span className="min-w-0 truncate text-slate-500">Email belum ada</span>
                      <button
                        className="cursor-not-allowed text-xs font-medium text-slate-400"
                        disabled
                        title="Email kontak belum tersedia di data conversation."
                      >
                        Tambah
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Label
                    </div>
                    <button
                      className="flex cursor-not-allowed items-center gap-1 text-slate-400"
                      disabled
                      title="Label conversation belum tersedia di backend."
                    >
                      <Tag className="h-4 w-4" />
                      Tambah label
                    </button>
                  </div>

                  <div className="space-y-2 px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Percakapan
                    </div>
                    <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3">
                      <span className="text-slate-500">Provider</span>
                      <div className="flex min-w-0 justify-end">
                        <ProviderBadge provider={selectedConversation.provider} />
                      </div>
                    </div>
                    <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3">
                      <span className="text-slate-500">Akun</span>
                      <span
                        className="min-w-0 truncate text-right font-medium text-slate-950 dark:text-slate-100"
                        title={selectedConversationAccountLabel}
                      >
                        {selectedConversationAccountLabel}
                      </span>
                    </div>
                    <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3">
                      <span className="text-slate-500">Dibuat</span>
                      <span className="min-w-0 truncate text-right font-medium text-slate-950 dark:text-slate-100">
                        {formatRelativeTime(selectedConversation.updatedAt)}
                      </span>
                    </div>
                    <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3">
                      <span className="text-slate-500">Pesan terakhir</span>
                      <span className="min-w-0 truncate text-right font-medium text-slate-950 dark:text-slate-100">
                        {formatRelativeTime(selectedConversation.lastMessageAt)}
                      </span>
                    </div>
                    <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3">
                      <span className="text-slate-500">Inbound terakhir</span>
                      <span className="min-w-0 truncate text-right font-medium text-slate-950 dark:text-slate-100">
                        {selectedLastInboundAt ? formatRelativeTime(selectedLastInboundAt) : 'Belum ada inbound'}
                      </span>
                    </div>
                    <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3">
                      <span className="text-slate-500">Jumlah pesan</span>
                      <span className="min-w-0 truncate text-right font-medium text-slate-950 dark:text-slate-100">
                        {formatNumber(selectedMessageCount)}
                        {selectedConversation.mergedConversationCount && selectedConversation.mergedConversationCount > 1
                          ? ` dari ${formatNumber(selectedConversation.mergedConversationCount)} thread`
                          : ''}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Jendela Layanan 24 Jam
                    </div>
                    <div
                      className={cn(
                        'rounded-lg border px-3 py-2',
                        selectedServiceWindow.isOpen
                          ? selectedServiceWindow.isAtRisk
                            ? 'border-orange-200 bg-orange-50 text-orange-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-rose-200 bg-rose-50 text-rose-700',
                      )}
                    >
                      <div className="flex items-center gap-2 font-medium">
                        <Clock3 className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 truncate">{selectedServiceWindow.label}</span>
                      </div>
                      <div className="mt-1 text-xs">
                        {selectedServiceWindow.isOpen
                          ? `${selectedServiceWindow.remainingLabel} tersisa`
                          : selectedServiceWindow.remainingLabel}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="m-4 rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700">
                Pilih thread di kiri untuk melihat detail kontak dan sumber datanya.
              </div>
            )}
            </ScrollArea>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
