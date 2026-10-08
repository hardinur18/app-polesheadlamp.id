import type { ErrorInfo } from 'react';

type ErrorSeverity = 'info' | 'warning' | 'error' | 'fatal';

interface ReportClientErrorOptions {
  area: string;
  severity?: ErrorSeverity;
  tags?: Record<string, string | number | boolean | null | undefined>;
  errorInfo?: ErrorInfo;
}

interface InstallGlobalErrorReportingOptions {
  shouldIgnore?: (error: unknown) => boolean;
}

interface NormalizedError {
  name: string;
  message: string;
  stack?: string;
}

export interface ClientErrorReport {
  id: string;
  area: string;
  severity: ErrorSeverity;
  message: string;
  name: string;
  at: string;
  path?: string;
  tags?: Record<string, string | number | boolean | null>;
}

const STORAGE_KEY = 'rhi:client-error-reports';
const MAX_STORED_REPORTS = 20;
const DEDUPE_WINDOW_MS = 10_000;

const lastReportByFingerprint = new Map<string, number>();

function normalizeError(error: unknown): NormalizedError {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      stack: error.stack,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    return {
      name: typeof record.name === 'string' ? record.name : 'UnknownError',
      message:
        typeof record.message === 'string'
          ? record.message
          : typeof record.statusText === 'string'
            ? record.statusText
            : JSON.stringify(record),
    };
  }

  return {
    name: 'UnknownError',
    message: String(error || 'Unknown error'),
  };
}

function sanitizeTags(tags?: ReportClientErrorOptions['tags']): ClientErrorReport['tags'] {
  if (!tags) return undefined;

  return Object.fromEntries(
    Object.entries(tags).filter(
      (entry): entry is [string, string | number | boolean | null] => entry[1] !== undefined,
    ),
  );
}

function createIncidentId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `rhi-${timestamp}-${random}`;
}

function getFingerprint(area: string, normalized: NormalizedError) {
  const stackHead = normalized.stack?.split('\n').slice(0, 2).join('\n') ?? '';
  return `${area}:${normalized.name}:${normalized.message}:${stackHead}`;
}

function storeReport(report: ClientErrorReport) {
  if (typeof window === 'undefined') return;

  try {
    const current = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '[]') as ClientErrorReport[];
    const next = [report, ...current].slice(0, MAX_STORED_REPORTS);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Reporting must never break the app.
  }
}

function shouldSkipDuplicate(fingerprint: string) {
  const now = Date.now();
  const lastSeenAt = lastReportByFingerprint.get(fingerprint) ?? 0;
  if (now - lastSeenAt < DEDUPE_WINDOW_MS) return true;
  lastReportByFingerprint.set(fingerprint, now);
  return false;
}

export function getFriendlyErrorMessage(error: unknown) {
  const { message } = normalizeError(error);
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('failed to fetch') || lowerMessage.includes('network')) {
    return 'Koneksi ke server belum stabil. Coba muat ulang beberapa saat lagi.';
  }

  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'Server membutuhkan waktu terlalu lama untuk merespons. Coba ulangi beberapa saat lagi.';
  }

  if (lowerMessage.includes('permission') || lowerMessage.includes('unauthorized') || lowerMessage.includes('forbidden')) {
    return 'Akses untuk aksi ini belum tersedia pada role user yang sedang login.';
  }

  if (lowerMessage.includes('duplicate') || lowerMessage.includes('unique')) {
    return 'Data yang sama sudah ada. Periksa kembali nama, nomor, atau kode uniknya.';
  }

  return 'Aplikasi menangkap error saat memproses halaman ini. Muat ulang halaman atau kembali ke Dashboard.';
}

export function reportClientError(error: unknown, options: ReportClientErrorOptions): ClientErrorReport {
  const normalized = normalizeError(error);
  const report: ClientErrorReport = {
    id: createIncidentId(),
    area: options.area,
    severity: options.severity ?? 'error',
    message: normalized.message,
    name: normalized.name,
    at: new Date().toISOString(),
    path: typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : undefined,
    tags: sanitizeTags(options.tags),
  };

  const fingerprint = getFingerprint(options.area, normalized);
  if (!shouldSkipDuplicate(fingerprint)) {
    const logPayload = {
      ...report,
      stack: normalized.stack,
      componentStack: options.errorInfo?.componentStack,
    };
    const logger = report.severity === 'warning' || report.severity === 'info' ? console.warn : console.error;
    logger('[RHI Client Error]', logPayload);
  }

  storeReport(report);
  return report;
}

export function getStoredClientErrorReports(): ClientErrorReport[] {
  if (typeof window === 'undefined') return [];

  try {
    return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '[]') as ClientErrorReport[];
  } catch {
    return [];
  }
}

export function installGlobalErrorReportingHandlers(options: InstallGlobalErrorReportingOptions = {}) {
  if (typeof window === 'undefined') return () => undefined;

  const handleError = (event: ErrorEvent) => {
    const error = event.error ?? event.message;
    if (options.shouldIgnore?.(error)) return;

    reportClientError(error, {
      area: 'window.error',
      severity: 'error',
      tags: {
        file: event.filename || null,
        line: event.lineno || null,
        column: event.colno || null,
      },
    });
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (options.shouldIgnore?.(event.reason)) return;

    reportClientError(event.reason, {
      area: 'window.unhandledrejection',
      severity: 'error',
    });
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  };
}
