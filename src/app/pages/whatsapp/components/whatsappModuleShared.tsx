import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  FileText,
  MessagesSquare,
  Settings2,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Card } from '@/app/components/ui/card';
import { cn } from '@/app/components/ui/utils';
import type {
  WhatsAppAccountStatus,
  WhatsAppMessageStatus,
  WhatsAppProvider,
} from '@/app/services/whatsappModuleService';
import type { WhatsAppWorkspaceIconKey } from '../whatsappWorkspace';

const WORKSPACE_ICONS: Record<WhatsAppWorkspaceIconKey, ComponentType<{ className?: string }>> = {
  chats: MessagesSquare,
  contacts: Users,
  templates: FileText,
  settings: Settings2,
};

export function getWorkspaceIcon(iconKey: WhatsAppWorkspaceIconKey) {
  return WORKSPACE_ICONS[iconKey] ?? MessagesSquare;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value || 0);
}

export function formatRelativeTime(value: string | null) {
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
    ...(sameDay ? {} : { day: '2-digit', month: 'short' }),
  }).format(date);
}

export function formatDateTime(value: string | null) {
  if (!value) return 'belum pernah';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'belum pernah';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getInitials(name: string | null | undefined) {
  if (!name) return 'WA';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || '')
    .join('');
  return initials || 'WA';
}

export function formatPhoneNumber(value: string | null | undefined) {
  if (!value) return 'Nomor tidak diketahui';
  const trimmed = value.trim();
  if (!trimmed) return 'Nomor tidak diketahui';
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

export function WhatsAppContactAvatar({
  src,
  name,
  phone,
  className,
  fallback = 'WA',
}: {
  src?: string | null;
  name?: string | null;
  phone?: string | null;
  className?: string;
  fallback?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const safeSrc = src && src !== failedSrc ? src : null;
  const label = name || formatPhoneNumber(phone) || 'Kontak WhatsApp';

  useEffect(() => {
    setFailedSrc(null);
  }, [src]);

  return (
    <div className={className} title={label}>
      {safeSrc ? (
        <img
          src={safeSrc}
          alt={`Foto profil ${label}`}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(safeSrc)}
        />
      ) : (
        getInitials(name || phone || fallback)
      )}
    </div>
  );
}

const PROVIDER_META: Record<WhatsAppProvider, { label: string; className: string }> = {
  kirimdev: {
    label: 'Kirimdev',
    className:
      'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300',
  },
  meta: {
    label: 'Meta langsung',
    className: 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300',
  },
};

export function getProviderLabel(provider: WhatsAppProvider) {
  return PROVIDER_META[provider]?.label ?? provider;
}

export function ProviderBadge({ provider }: { provider: WhatsAppProvider }) {
  const meta = PROVIDER_META[provider] ?? PROVIDER_META.meta;
  return (
    <Badge variant="outline" className={cn('gap-1', meta.className)}>
      <Sparkles className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

const STATUS_META: Record<
  WhatsAppMessageStatus,
  { label: string; className: string; icon: ComponentType<{ className?: string }> }
> = {
  pending: {
    label: 'Menunggu',
    className: 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300',
    icon: Clock,
  },
  sent: {
    label: 'Terkirim',
    className: 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300',
    icon: Check,
  },
  delivered: {
    label: 'Sampai',
    className: 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300',
    icon: CheckCheck,
  },
  read: {
    label: 'Dibaca',
    className: 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300',
    icon: CheckCheck,
  },
  failed: {
    label: 'Gagal',
    className: 'border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300',
    icon: XCircle,
  },
};

export function getMessageStatusLabel(status: WhatsAppMessageStatus | null) {
  if (!status) return null;
  return STATUS_META[status]?.label ?? status;
}

export function MessageStatusBadge({
  status,
  className,
}: {
  status: WhatsAppMessageStatus | null;
  className?: string;
}) {
  if (!status) return null;
  const meta = STATUS_META[status];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn('gap-1', meta.className, className)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

const ACCOUNT_STATUS_META: Record<
  WhatsAppAccountStatus,
  { label: string; className: string }
> = {
  connected: {
    label: 'Terhubung',
    className:
      'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300',
  },
  configured: {
    label: 'Siap (menunggu event)',
    className: 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300',
  },
  not_configured: {
    label: 'Belum dikonfigurasi',
    className: 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300',
  },
};

export function AccountStatusBadge({ status }: { status: WhatsAppAccountStatus }) {
  const meta = ACCOUNT_STATUS_META[status] ?? ACCOUNT_STATUS_META.not_configured;
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  );
}

/**
 * Consistent state block used for empty / error / informational states across the
 * module so every page feels the same as the rest of the app's design system.
 */
export function WhatsAppStateCard({
  icon,
  title,
  description,
  tone = 'neutral',
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  tone?: 'neutral' | 'warning' | 'danger';
  action?: ReactNode;
}) {
  const toneClassName =
    tone === 'danger'
      ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200'
        : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300';

  return (
    <Card className={cn('shadow-sm', toneClassName)}>
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/60 text-slate-400 dark:bg-slate-950/40 dark:text-slate-500">
          {icon}
        </div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</div>
        {description ? (
          <p className="max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        ) : null}
        {action ? <div className="mt-1">{action}</div> : null}
      </div>
    </Card>
  );
}

/**
 * Professional "coming next" state for module sections that are scaffolded but not
 * yet wired to data. Lists the planned capabilities so it never reads as an empty
 * dead-end.
 */
export function WhatsAppComingSoon({
  title,
  description,
  capabilities,
}: {
  title: string;
  description: string;
  capabilities: string[];
}) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl space-y-3">
          <Badge
            variant="outline"
            className="border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-300"
          >
            Segera hadir
          </Badge>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
          <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-xs leading-6 text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Bagian ini sengaja belum diaktifkan agar tidak menampilkan data setengah jadi. Modul
            inti WhatsApp (Chats, Contacts, Accounts, Inbox Settings) sudah dapat digunakan lebih
            dulu.
          </div>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Rencana fitur
          </div>
          <div className="space-y-2">
            {capabilities.map((capability) => (
              <div
                key={capability}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-800"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                <span className="text-sm text-slate-600 dark:text-slate-300">{capability}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
