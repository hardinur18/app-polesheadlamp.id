type PerfStatus = 'ok' | 'error' | 'fallback' | 'timeout' | 'skipped';

type PerfMetadata = Record<string, unknown>;

export type PerfMetric = {
  name: string;
  durationMs: number;
  status: PerfStatus | string;
  metadata?: PerfMetadata;
  timestamp: string;
};

type PerfConsoleApi = {
  metrics: PerfMetric[];
  enable: () => void;
  disable: () => void;
  clear: () => void;
  print: () => void;
};

declare global {
  interface Window {
    __RHI_PERF_METRICS__?: PerfMetric[];
    __RHI_PERF__?: PerfConsoleApi;
  }
}

const PERF_STORAGE_KEY = 'rhi:perf';
const PERF_SLOW_THRESHOLD_STORAGE_KEY = 'rhi:perf:slowMs';
const DEFAULT_SLOW_THRESHOLD_MS = 800;
const MAX_METRIC_BUFFER = 250;

const canUseBrowserPerf = () =>
  typeof window !== 'undefined' &&
  typeof window.performance !== 'undefined' &&
  typeof window.performance.now === 'function';

const isDevMode = () => Boolean(import.meta.env.DEV);

export const isPerfTelemetryEnabled = () => {
  if (typeof window === 'undefined') return false;

  try {
    return isDevMode() || window.localStorage.getItem(PERF_STORAGE_KEY) === '1';
  } catch {
    return isDevMode();
  }
};

const getSlowThresholdMs = () => {
  if (typeof window === 'undefined') return DEFAULT_SLOW_THRESHOLD_MS;

  try {
    const rawValue = window.localStorage.getItem(PERF_SLOW_THRESHOLD_STORAGE_KEY);
    const parsedValue = rawValue ? Number(rawValue) : DEFAULT_SLOW_THRESHOLD_MS;
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : DEFAULT_SLOW_THRESHOLD_MS;
  } catch {
    return DEFAULT_SLOW_THRESHOLD_MS;
  }
};

const getMetricBuffer = () => {
  if (typeof window === 'undefined') return [];

  if (!window.__RHI_PERF_METRICS__) {
    window.__RHI_PERF_METRICS__ = [];
  }

  return window.__RHI_PERF_METRICS__;
};

const ensurePerfConsoleApi = () => {
  if (typeof window === 'undefined' || window.__RHI_PERF__) return;

  window.__RHI_PERF__ = {
    metrics: getMetricBuffer(),
    enable: () => {
      window.localStorage.setItem(PERF_STORAGE_KEY, '1');
      console.info('[RHI Perf] Enabled. Reload or repeat the action to capture fresh timings.');
    },
    disable: () => {
      window.localStorage.removeItem(PERF_STORAGE_KEY);
      console.info('[RHI Perf] Disabled.');
    },
    clear: () => {
      getMetricBuffer().splice(0);
      console.info('[RHI Perf] Cleared metrics.');
    },
    print: () => {
      console.table(getMetricBuffer());
    },
  };
};

export const recordPerfMetric = (
  name: string,
  durationMs: number,
  status: PerfStatus | string = 'ok',
  metadata?: PerfMetadata,
) => {
  if (!isPerfTelemetryEnabled()) return;

  ensurePerfConsoleApi();

  const metric: PerfMetric = {
    name,
    durationMs: Number(durationMs.toFixed(1)),
    status,
    metadata,
    timestamp: new Date().toISOString(),
  };
  const metricBuffer = getMetricBuffer();
  metricBuffer.push(metric);

  if (metricBuffer.length > MAX_METRIC_BUFFER) {
    metricBuffer.splice(0, metricBuffer.length - MAX_METRIC_BUFFER);
  }

  const shouldWarn = status !== 'ok' || metric.durationMs >= getSlowThresholdMs();
  const log = shouldWarn ? console.warn : console.debug;
  log('[RHI Perf]', metric.name, `${metric.durationMs}ms`, metric.status, metric.metadata || {});
};

export const startPerfTimer = (name: string, metadata?: PerfMetadata) => {
  if (!canUseBrowserPerf()) {
    return () => undefined;
  }

  const startedAt = window.performance.now();
  let ended = false;

  return (status: PerfStatus | string = 'ok', extraMetadata?: PerfMetadata) => {
    if (ended) return;
    ended = true;

    recordPerfMetric(
      name,
      window.performance.now() - startedAt,
      status,
      extraMetadata ? { ...metadata, ...extraMetadata } : metadata,
    );
  };
};

export const measureAsync = async <T>(
  name: string,
  operation: () => Promise<T>,
  metadata?: PerfMetadata,
) => {
  const endTimer = startPerfTimer(name, metadata);

  try {
    const result = await operation();
    endTimer('ok');
    return result;
  } catch (error) {
    endTimer('error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
