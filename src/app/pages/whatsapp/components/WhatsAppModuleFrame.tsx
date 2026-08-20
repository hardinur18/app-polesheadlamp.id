import type { MouseEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { Badge } from '@/app/components/ui/badge';
import { Card } from '@/app/components/ui/card';
import { cn } from '@/app/components/ui/utils';
import { APP_LAYOUT_TAB_PERMISSIONS } from '@/app/components/layout/appLayoutTabPermissions';
import type { PermissionKey } from '@/app/data/permissions';
import { usePermissions } from '@/app/hooks/usePermissions';
import { getAppRouteByTabId, getCanonicalAppPath } from '@/app/routing/appRouteRegistry';
import {
  WHATSAPP_WORKSPACE_MAP,
  WHATSAPP_WORKSPACES,
  type WhatsAppWorkspaceId,
} from '../whatsappWorkspace';
import { getWorkspaceIcon } from './whatsappModuleShared';
import { ui } from '../inboxUi';

type WhatsAppModuleFrameProps = {
  activeId: WhatsAppWorkspaceId;
  badges?: string[];
  stats?: Array<{ label: string; value: string; hint?: string }>;
  actions?: ReactNode;
  children: ReactNode;
};

function resolveTabHref(id: WhatsAppWorkspaceId) {
  const route = getAppRouteByTabId(id);
  return route ? getCanonicalAppPath(route) : undefined;
}

function hasRequiredPermission(
  requirement: PermissionKey | PermissionKey[] | undefined,
  hasPermission: (permission: PermissionKey) => boolean,
) {
  if (!requirement) return true;
  return Array.isArray(requirement)
    ? requirement.some((permission) => hasPermission(permission))
    : hasPermission(requirement);
}

export function WhatsAppModuleFrame({
  activeId,
  badges,
  stats = [],
  actions,
  children,
}: WhatsAppModuleFrameProps) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const workspace = WHATSAPP_WORKSPACE_MAP[activeId];
  const resolvedBadges = badges ?? ['Live Chat', 'Provider: Kirimdev + Meta'];
  const visibleWorkspaces = WHATSAPP_WORKSPACES.filter((item) => {
    if (activeId === 'whatsapp-contacts') {
      return item.id === 'whatsapp-contacts';
    }
    if (item.id === 'whatsapp-contacts') return false;
    return hasRequiredPermission(APP_LAYOUT_TAB_PERMISSIONS[item.id], hasPermission);
  });

  const handleNavigate = (id: WhatsAppWorkspaceId, href?: string, event?: MouseEvent) => {
    if (event) {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }
      event.preventDefault();
    }
    if (id === activeId) return;
    if (!href) return;
    navigate(href);
    // Hard-navigation fallback mirrors the global sidebar: if the SPA route does not
    // settle (e.g. lazy chunk hiccup) fall back to a full browser navigation.
    window.setTimeout(() => {
      const targetPath = new URL(href, window.location.origin).pathname;
      if (window.location.pathname !== targetPath) {
        window.location.assign(href);
      }
    }, 180);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-0">
      <Card className="border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {resolvedBadges.map((badge) => (
                  <Badge
                    key={badge}
                    variant="outline"
                    className="border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"
                  >
                    {badge}
                  </Badge>
                ))}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  {workspace?.title ?? 'Live Chat'}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {workspace?.description}
                </p>
              </div>
            </div>

            {actions ? (
              <div className="flex flex-wrap items-center gap-3 xl:justify-end">{actions}</div>
            ) : null}
          </div>

          {stats.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className={cn(
                    'border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40',
                    ui.r.field,
                  )}
                >
                  <div className={ui.text.label}>{stat.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {stat.value}
                  </div>
                  {stat.hint ? (
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {stat.hint}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Card>

      {/* In-module section navigation */}
      <Card className="border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900">
        <nav className="flex flex-wrap gap-3 p-3" aria-label="Navigasi live chat">
          {visibleWorkspaces.map((item) => {
            const Icon = getWorkspaceIcon(item.iconKey);
            const isActive = item.id === activeId;
            const href = resolveTabHref(item.id);
            const isComingSoon = item.status === 'coming-soon';

            return (
              <a
                key={item.id}
                href={href || '#'}
                onClick={(event) => handleNavigate(item.id, href, event)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-950/40',
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{item.label}</span>
                {isComingSoon ? (
                  <span
                    className={cn(
                      'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
                    )}
                  >
                    Soon
                  </span>
                ) : null}
              </a>
            );
          })}
        </nav>
      </Card>

      {children}
    </div>
  );
}
