import React from 'react';

import {
  fetchWhatsAppOverview,
  type WhatsAppOverviewResponse,
} from '@/app/services/whatsappModuleService';

type UseWhatsAppOverviewResult = {
  data: WhatsAppOverviewResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastLoadedAt: string | null;
  reload: (options?: { silent?: boolean; quiet?: boolean }) => Promise<void>;
};

type UseWhatsAppOverviewOptions = {
  refreshIntervalMs?: number;
  showAutoRefreshIndicator?: boolean;
  includePerformance?: boolean;
  includeContacts?: boolean;
  includeMessageCounts?: boolean;
  includeConversations?: boolean;
};

/**
 * Shared loader for the WhatsApp module overview. Dashboard, Accounts, Inbox
 * Settings and the Chats list all read from the same `/whatsapp/overview` payload,
 * so they share one fetch/refresh contract for consistency.
 */
export function useWhatsAppOverview(options?: UseWhatsAppOverviewOptions): UseWhatsAppOverviewResult {
  const [data, setData] = React.useState<WhatsAppOverviewResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = React.useState<string | null>(null);
  const isReloadingRef = React.useRef(false);
  const refreshIntervalMs = options?.refreshIntervalMs;
  const showAutoRefreshIndicator = options?.showAutoRefreshIndicator ?? true;
  const includePerformance = options?.includePerformance;
  const includeContacts = options?.includeContacts;
  const includeMessageCounts = options?.includeMessageCounts;
  const includeConversations = options?.includeConversations;

  const reload = React.useCallback(async (options?: { silent?: boolean; quiet?: boolean }) => {
    if (isReloadingRef.current) return;
    isReloadingRef.current = true;

    const silent = options?.silent ?? false;
    if (silent) {
      if (!options?.quiet) setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const payload = await fetchWhatsAppOverview({
        includePerformance,
        includeContacts,
        includeMessageCounts,
        includeConversations,
      });
      setData(payload);
      setError(null);
      setLastLoadedAt(new Date().toISOString());
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data modul WhatsApp.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      isReloadingRef.current = false;
    }
  }, [includeContacts, includeConversations, includeMessageCounts, includePerformance]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  React.useEffect(() => {
    if (!refreshIntervalMs || refreshIntervalMs < 1000) return undefined;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void reload({ silent: true, quiet: !showAutoRefreshIndicator });
    }, refreshIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [refreshIntervalMs, reload, showAutoRefreshIndicator]);

  return { data, loading, refreshing, error, lastLoadedAt, reload };
}
