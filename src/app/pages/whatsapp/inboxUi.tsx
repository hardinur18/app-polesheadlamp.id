import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/app/components/ui/utils';

/**
 * Design tokens — single source of truth for the WhatsApp module's visual language.
 *
 * Change a token here once and every page that composes from it updates. Pages must
 * NOT hardcode font sizes, radii, control heights, surface colors, or gutters that a
 * token already covers — always reference `ui.*` or the primitives below.
 */
export const ui = {
  // Typography scale
  text: {
    label:
      'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400',
    title: 'text-sm font-semibold text-slate-900 dark:text-slate-100',
    body: 'text-sm text-slate-700 dark:text-slate-300',
    sub: 'text-xs text-slate-500 dark:text-slate-400',
    meta: 'text-[11px] text-slate-400 dark:text-slate-500',
  },
  // Radius scale (by role)
  r: {
    control: 'rounded-xl', // buttons, chips, list items
    field: 'rounded-2xl', // inputs, cards, account selector
    pill: 'rounded-full', // avatars, count badges
  },
  // Sizing scale
  h: {
    header: 'h-16', // every column header band (64px)
    control: 'h-10', // primary controls / composer buttons
    chip: 'h-7', // status chips
    icon: 'h-8 w-8', // compact icon buttons (header)
  },
  icon: 'h-4 w-4',
  // Surfaces & layering
  surface: {
    base: 'bg-white dark:bg-slate-950',
    raised: 'bg-slate-50 dark:bg-slate-900',
    divider: 'border-slate-200 dark:border-slate-800',
    hover: 'hover:bg-slate-50 dark:hover:bg-slate-900/70',
    active:
      'bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-100 dark:ring-blue-900/60',
  },
  // Horizontal gutters (content never touches a divider)
  gutter: 'px-4',
  sidebarGutter: 'px-3.5',
} as const;

export const whatsAppInboxStyle = {
  '--wa-sidebar-w': '288px',
  '--wa-list-w': '420px',
  '--wa-list-w-compact': '360px',
  '--wa-detail-w': '320px',
  '--wa-header-h': '68px',
  '--wa-row-h': '104px',
  '--wa-control-h': '44px',
  '--wa-icon-btn': '38px',
  '--wa-icon-btn-sm': '34px',
  '--wa-account-select-h': '54px',
  '--wa-account-icon': '34px',
  '--wa-avatar-row': '44px',
  '--wa-avatar-header': '40px',
  '--wa-row-meta-w': '88px',
  '--wa-stat-h': '40px',
  '--wa-chat-pad-x': '16px',
  '--wa-chat-stack-gap': '16px',
  '--wa-bubble-min-w': '144px',
  '--wa-bubble-max-w': '640px',
  '--wa-bubble-max-pct': '72%',
  '--wa-composer-pad': '12px',
  '--wa-sidebar-menu-w': '280px',
} as CSSProperties;

/**
 * Ready-made className strings for retrofitting existing markup without rewriting JSX.
 * Swap a `className="..."` literal for one of these; change it here once → every usage updates.
 */
export const cls = {
  moduleShell:
    'flex flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white text-slate-950 shadow-[0_22px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100',
  layoutGrid:
    'grid min-h-0 flex-1 grid-cols-1 overflow-hidden border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:grid-cols-[var(--wa-list-w-compact)_minmax(0,1fr)] xl:grid-cols-[var(--wa-sidebar-w)_var(--wa-list-w)_minmax(0,1fr)]',
  layoutGridWithCustomer:
    'grid min-h-0 flex-1 grid-cols-1 overflow-hidden border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:grid-cols-[var(--wa-list-w-compact)_minmax(0,1fr)] xl:grid-cols-[var(--wa-sidebar-w)_var(--wa-list-w)_minmax(0,1fr)] min-[1900px]:grid-cols-[var(--wa-sidebar-w)_var(--wa-list-w)_minmax(0,1fr)_var(--wa-detail-w)]',
  headerBand:
    'flex min-h-[var(--wa-header-h)] flex-none items-center justify-between gap-3 border-b border-slate-200 px-4 dark:border-slate-800',
  sidebarPanel:
    'hidden min-h-0 flex-col border-r border-slate-200 bg-slate-50/75 dark:border-slate-800 dark:bg-slate-950 xl:flex',
  sectionLabel:
    'flex items-center justify-between px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400',
  sectionToggle:
    'flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-900/70 dark:hover:text-slate-200',
  sectionChevron: 'h-3.5 w-3.5 transition-transform duration-150',
  // Sidebar scroll body: consistent gutter + vertical rhythm between sections.
  sidebarBody: 'space-y-3 py-4 pl-4 pr-4',
  sidebarSection: 'space-y-2',
  sidebarSurface:
    'rounded-[22px] border border-slate-200 bg-white p-2.5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900/70',
  sidebarCollapseContent:
    'grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out data-[state=closed]:grid-rows-[0fr] data-[state=closed]:opacity-0 data-[state=open]:grid-rows-[1fr] data-[state=open]:opacity-100',
  sidebarCollapseInner: 'min-h-0 overflow-hidden pt-1',
  accountSelectTrigger:
    'h-[var(--wa-account-select-h)] overflow-hidden rounded-2xl border-slate-200 bg-white py-2 pl-2 pr-9 text-sm shadow-sm outline-none transition-colors hover:border-slate-300 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-100 data-[state=open]:border-blue-500 data-[state=open]:ring-2 data-[state=open]:ring-inset data-[state=open]:ring-blue-100 dark:border-slate-800 dark:bg-slate-900',
  accountSelectContent:
    'max-h-[360px] w-[var(--wa-sidebar-menu-w)] overflow-y-auto rounded-2xl border-slate-200 bg-white p-1.5 shadow-[0_22px_50px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-900',
  accountSelectItem:
    'rounded-xl py-2 pl-2 pr-8 text-slate-700 transition-colors data-[state=checked]:bg-blue-50 data-[state=checked]:text-slate-950 data-[highlighted]:bg-slate-50 dark:text-slate-200 dark:data-[state=checked]:bg-blue-950/30 dark:data-[state=checked]:text-slate-100 dark:data-[highlighted]:bg-slate-800',
  accountRow: 'flex w-full min-w-0 flex-1 items-center gap-2.5 overflow-hidden',
  accountIcon:
    'flex h-[var(--wa-account-icon)] w-[var(--wa-account-icon)] shrink-0 items-center justify-center text-blue-700 dark:text-blue-200',
  // Filter item button (icon + label + count), with hover; pass active separately.
  filterItem:
    'grid min-h-11 w-full grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors',
  filterItemIdle:
    'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900/70',
  filterItemActive:
    'bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-100 dark:ring-blue-900/60',
  iconButton:
    'flex h-[var(--wa-icon-btn)] w-[var(--wa-icon-btn)] shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-900',
  iconButtonSm:
    'flex h-[var(--wa-icon-btn-sm)] w-[var(--wa-icon-btn-sm)] shrink-0 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-900',
  avatarRow:
    'flex h-[var(--wa-avatar-row)] w-[var(--wa-avatar-row)] shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-sm font-semibold text-blue-800 ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-100 dark:ring-blue-900/60',
  avatarHeader:
    'flex h-[var(--wa-avatar-header)] w-[var(--wa-avatar-header)] shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-sm font-semibold text-blue-800 ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-100 dark:ring-blue-900/60',
  statGrid:
    'grid grid-cols-3 gap-2 border-b border-slate-200 bg-slate-50/50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950',
  statButton:
    'group grid min-h-[var(--wa-stat-h)] min-w-0 grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-2 text-left transition-colors',
  statButtonIdle:
    'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900/70',
  statButtonAccentActive:
    'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-100 dark:ring-blue-900/70',
  statButtonDangerActive:
    'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-200 dark:ring-rose-900/70',
  statCount:
    'shrink-0 text-[14px] font-semibold leading-none text-blue-700 dark:text-blue-200',
  statCountDanger:
    'shrink-0 text-[14px] font-semibold leading-none text-rose-600 dark:text-rose-200',
  listPanel:
    'min-h-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950',
  listHeaderBody:
    'space-y-3 border-b border-slate-200 bg-white px-4 pb-4 pt-4 dark:border-slate-800 dark:bg-slate-950',
  searchField:
    'h-11 rounded-xl border-slate-200 bg-white pl-10 pr-3 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100 dark:border-slate-800 dark:bg-slate-950 dark:placeholder:text-slate-500',
  searchIcon:
    'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400',
  listToolbar: 'flex min-w-0 items-center justify-between gap-3 text-xs text-slate-500',
  chatViewport:
    'min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white px-[var(--wa-chat-pad-x)] py-4 dark:bg-slate-950',
  messageStack:
    'flex min-h-full w-full min-w-0 flex-col justify-end gap-[var(--wa-chat-stack-gap)] overflow-x-hidden',
  messageBubbleBase:
    'min-w-[var(--wa-bubble-min-w)] overflow-hidden rounded-2xl px-4 py-3 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.10),0_8px_20px_rgba(15,23,42,0.07)]',
  messageBubbleOutbound: 'rounded-br-md bg-emerald-600 text-white',
  messageBubbleInbound:
    'rounded-bl-md border border-slate-300/80 bg-white text-slate-950 ring-1 ring-slate-950/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:ring-white/10',
  messageMetaOutbound: 'text-emerald-50/85',
  messageReadStatusOutbound:
    'font-semibold text-sky-100 [text-shadow:0_1px_1px_rgba(15,23,42,0.24)]',
  headerTextButton:
    'flex h-9 shrink-0 items-center gap-1 rounded-xl border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900',
  composerDock:
    'flex-none border-t border-slate-200 bg-slate-50/70 px-4 py-[var(--wa-composer-pad)] dark:border-slate-800 dark:bg-slate-950',
  composerShell:
    'flex min-w-0 items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:border-slate-800 dark:bg-slate-950',
};

/** Fixed-height header band shared by every column header so baselines line up. */
export function HeaderBand({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-[var(--wa-header-h)] flex-none items-center justify-between gap-3 border-b px-4',
        ui.surface.divider,
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Uppercase section label, inset to align with the items beneath it. */
export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between px-2.5', ui.text.label, className)}>
      {children}
    </div>
  );
}

/** Square icon button with consistent size, radius, hover and active states. */
export function IconButton({
  children,
  onClick,
  title,
  disabled,
  active,
  size = 'md',
  className,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  active?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        'flex shrink-0 items-center justify-center text-slate-600 transition-colors dark:text-slate-300',
        size === 'sm' ? cls.iconButtonSm : cls.iconButton,
        active && ui.surface.active,
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Rounded count badge with neutral / accent / danger tones. */
export function CountBadge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'danger';
  className?: string;
}) {
  const toneClass =
    tone === 'accent'
      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
      : tone === 'danger'
        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none',
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Compact outline chip used in headers (status / SLA window / meta). */
export function StatusChip({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  className?: string;
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
      : tone === 'warning'
        ? 'border-orange-200 text-orange-700 dark:border-orange-900/60 dark:text-orange-300'
        : tone === 'danger'
          ? 'border-rose-200 text-rose-700 dark:border-rose-900/60 dark:text-rose-300'
          : 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300';
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium',
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function FilterRow({
  icon,
  label,
  count,
  active,
  tone = 'neutral',
  onClick,
}: {
  icon: ReactNode;
  label: ReactNode;
  count?: ReactNode;
  active?: boolean;
  tone?: 'neutral' | 'accent' | 'danger';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(cls.filterItem, active ? cls.filterItemActive : cls.filterItemIdle)}
    >
      <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
      <span className="min-w-0 truncate text-left">{label}</span>
      {count == null ? <span aria-hidden="true" /> : <CountBadge tone={tone}>{count}</CountBadge>}
    </button>
  );
}

export function InboxStatButton({
  icon,
  label,
  count,
  active,
  tone = 'accent',
  onClick,
}: {
  icon?: ReactNode;
  label: ReactNode;
  count: ReactNode;
  active?: boolean;
  tone?: 'accent' | 'danger';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        cls.statButton,
        active
          ? tone === 'danger'
            ? cls.statButtonDangerActive
            : cls.statButtonAccentActive
          : cls.statButtonIdle,
      )}
    >
      {icon ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/80 text-current ring-1 ring-black/5 transition-colors group-hover:bg-white dark:bg-slate-950/50 dark:ring-white/10">
          {icon}
        </span>
      ) : (
        <span aria-hidden="true" />
      )}
      <span className="min-w-0 truncate whitespace-nowrap text-[12px] font-medium leading-none text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className={tone === 'danger' ? cls.statCountDanger : cls.statCount}>{count}</span>
    </button>
  );
}
