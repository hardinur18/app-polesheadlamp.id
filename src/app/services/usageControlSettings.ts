import React from 'react';
import { supabase } from '@/lib/supabaseClient';
import { buildMakeServerUrl } from './internal/functionsBaseUrl';
import { getSessionBackedEdgeHeaders } from './internal/sessionClientHeaders';

const KV_TABLE = 'kv_store_f781cd00';
const SETTINGS_KEY = 'app:usage-control-settings';
const ROLE_SETTINGS_USAGE_CONTROL_KEY = '_usageControl';
const LOCAL_STORAGE_KEY = 'rhi:usage-control-settings';
const LOCAL_STORAGE_FETCHED_AT_KEY = 'rhi:usage-control-settings:fetched-at';
const CACHE_TTL_MS = 5 * 60 * 1000;

export type UsageControlSettings = {
  permissionResumeRefreshMinutes: number;
  conversationOverviewRefreshMinutes: number;
  conversationMessageRefreshMinutes: number;
  monitoringShiftRefreshMinutes: number;
  adsTodayLiveRefreshMinutes: number;
  updatedAt?: string;
  updatedBy?: string;
};

export const DEFAULT_USAGE_CONTROL_SETTINGS: UsageControlSettings = {
  permissionResumeRefreshMinutes: 5,
  conversationOverviewRefreshMinutes: 1,
  conversationMessageRefreshMinutes: 0.5,
  monitoringShiftRefreshMinutes: 5,
  adsTodayLiveRefreshMinutes: 15,
};

export const USAGE_CONTROL_SETTING_LIMITS: Record<
  keyof Omit<UsageControlSettings, 'updatedAt' | 'updatedBy'>,
  { min: number; max: number; step: number }
> = {
  permissionResumeRefreshMinutes: { min: 1, max: 120, step: 1 },
  conversationOverviewRefreshMinutes: { min: 0.5, max: 120, step: 0.5 },
  conversationMessageRefreshMinutes: { min: 0.5, max: 120, step: 0.5 },
  monitoringShiftRefreshMinutes: { min: 1, max: 240, step: 1 },
  adsTodayLiveRefreshMinutes: { min: 5, max: 360, step: 5 },
};

export const USAGE_CONTROL_SETTINGS_EVENT = 'rhi:usage-control-settings-updated';

type UsageSettingNumberKey = keyof typeof USAGE_CONTROL_SETTING_LIMITS;

function clampNumber(value: unknown, key: UsageSettingNumberKey) {
  const limits = USAGE_CONTROL_SETTING_LIMITS[key];
  const fallback = DEFAULT_USAGE_CONTROL_SETTINGS[key];
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) return fallback;

  return Math.min(limits.max, Math.max(limits.min, numeric));
}

export function sanitizeUsageControlSettings(value: unknown): UsageControlSettings {
  const source = value && typeof value === 'object' ? value as Partial<UsageControlSettings> : {};

  return {
    permissionResumeRefreshMinutes: clampNumber(source.permissionResumeRefreshMinutes, 'permissionResumeRefreshMinutes'),
    conversationOverviewRefreshMinutes: clampNumber(source.conversationOverviewRefreshMinutes, 'conversationOverviewRefreshMinutes'),
    conversationMessageRefreshMinutes: clampNumber(source.conversationMessageRefreshMinutes, 'conversationMessageRefreshMinutes'),
    monitoringShiftRefreshMinutes: clampNumber(source.monitoringShiftRefreshMinutes, 'monitoringShiftRefreshMinutes'),
    adsTodayLiveRefreshMinutes: clampNumber(source.adsTodayLiveRefreshMinutes, 'adsTodayLiveRefreshMinutes'),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : undefined,
    updatedBy: typeof source.updatedBy === 'string' ? source.updatedBy : undefined,
  };
}

function readLocalStorageSettings() {
  if (typeof window === 'undefined') return DEFAULT_USAGE_CONTROL_SETTINGS;

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? sanitizeUsageControlSettings(JSON.parse(raw)) : DEFAULT_USAGE_CONTROL_SETTINGS;
  } catch {
    return DEFAULT_USAGE_CONTROL_SETTINGS;
  }
}

function writeLocalStorageSettings(settings: UsageControlSettings) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  window.localStorage.setItem(LOCAL_STORAGE_FETCHED_AT_KEY, String(Date.now()));
  window.dispatchEvent(new CustomEvent(USAGE_CONTROL_SETTINGS_EVENT, { detail: settings }));
}

export function saveUsageControlSettingsLocally(settings: UsageControlSettings) {
  const payload = sanitizeUsageControlSettings({
    ...settings,
    updatedAt: settings.updatedAt || new Date().toISOString(),
  });

  writeLocalStorageSettings(payload);
  return payload;
}

export function getCachedUsageControlSettings() {
  return readLocalStorageSettings();
}

export function shouldRefreshUsageControlSettingsCache() {
  if (typeof window === 'undefined') return true;

  const fetchedAt = Number(window.localStorage.getItem(LOCAL_STORAGE_FETCHED_AT_KEY) || 0);
  return !fetchedAt || Date.now() - fetchedAt > CACHE_TTL_MS;
}

export async function fetchUsageControlSettings(options?: { force?: boolean }) {
  if (!options?.force && !shouldRefreshUsageControlSettingsCache()) {
    return getCachedUsageControlSettings();
  }

  try {
    const { data, error } = await supabase
      .from(KV_TABLE)
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (error) throw error;

    if (data?.value) {
      const settings = sanitizeUsageControlSettings(data.value);
      writeLocalStorageSettings(settings);
      return settings;
    }
  } catch (error) {
    console.warn('[UsageControl] Direct settings read failed, falling back to server settings', error);
  }

  const response = await fetch(buildMakeServerUrl('/permissions/settings'), {
    headers: await getSessionBackedEdgeHeaders(),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.warn('[UsageControl] Server settings read failed, using local cache', payload);
    return getCachedUsageControlSettings();
  }

  const settings = sanitizeUsageControlSettings(payload.data?.[ROLE_SETTINGS_USAGE_CONTROL_KEY]);
  writeLocalStorageSettings(settings);
  return settings;
}

export async function saveUsageControlSettings(settings: UsageControlSettings) {
  const payload = sanitizeUsageControlSettings({
    ...settings,
    updatedAt: settings.updatedAt || new Date().toISOString(),
  });

  const currentResponse = await fetch(buildMakeServerUrl('/permissions/settings'), {
    headers: await getSessionBackedEdgeHeaders(),
    cache: 'no-store',
  });
  const currentPayload = await currentResponse.json().catch(() => ({}));

  if (!currentResponse.ok) {
    throw new Error(currentPayload.error || currentPayload.message || `HTTP ${currentResponse.status}`);
  }

  const currentSettings =
    currentPayload.data && typeof currentPayload.data === 'object' && !Array.isArray(currentPayload.data)
      ? currentPayload.data
      : {};

  const saveResponse = await fetch(buildMakeServerUrl('/permissions/settings'), {
    method: 'POST',
    headers: await getSessionBackedEdgeHeaders({ includeJsonContentType: true }),
    body: JSON.stringify({
      ...currentSettings,
      [ROLE_SETTINGS_USAGE_CONTROL_KEY]: payload,
    }),
  });
  const savePayload = await saveResponse.json().catch(() => ({}));

  if (!saveResponse.ok) {
    throw new Error(savePayload.error || savePayload.message || `HTTP ${saveResponse.status}`);
  }

  writeLocalStorageSettings(payload);
  return payload;
}

export function minutesToMs(minutes: number) {
  return Math.max(1, minutes) * 60 * 1000;
}

export function useUsageControlSettings() {
  const [settings, setSettings] = React.useState<UsageControlSettings>(() => getCachedUsageControlSettings());

  React.useEffect(() => {
    let cancelled = false;

    fetchUsageControlSettings().then((nextSettings) => {
      if (!cancelled) {
        setSettings(nextSettings);
      }
    }).catch((error) => {
      console.warn('[UsageControl] Failed to refresh settings cache', error);
    });

    const handleSettingsUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<UsageControlSettings>;
      setSettings(sanitizeUsageControlSettings(customEvent.detail));
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LOCAL_STORAGE_KEY) return;
      setSettings(getCachedUsageControlSettings());
    };

    window.addEventListener(USAGE_CONTROL_SETTINGS_EVENT, handleSettingsUpdate);
    window.addEventListener('storage', handleStorage);

    return () => {
      cancelled = true;
      window.removeEventListener(USAGE_CONTROL_SETTINGS_EVENT, handleSettingsUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return settings;
}
