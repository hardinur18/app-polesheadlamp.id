import { buildMakeServerUrl } from './functionsBaseUrl';
import { fetchWithTimeout, isRequestTimeoutError } from './fetchWithTimeout';
import { getPublicEdgeHeaders, getSessionBackedEdgeHeaders } from './sessionClientHeaders';

export type ApiClientAuthMode = 'session' | 'public' | 'none';
export type ApiClientParseMode = 'json' | 'text' | 'empty' | 'response';
export type ApiClientQueryValue = string | number | boolean | null | undefined;

export type ApiClientRequestOptions<TBody = unknown> = Omit<RequestInit, 'body' | 'headers' | 'method'> & {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: TBody;
  query?: Record<string, ApiClientQueryValue | ApiClientQueryValue[]>;
  headers?: HeadersInit;
  auth?: ApiClientAuthMode;
  parseAs?: ApiClientParseMode;
  timeoutMs?: number;
  timeoutMessage?: string;
  includeJsonContentType?: boolean;
};

type ErrorPayload = {
  error?: unknown;
  message?: unknown;
  details?: unknown;
};

const DEFAULT_API_TIMEOUT_MS = 12_000;
const DEFAULT_TIMEOUT_MESSAGE = 'Request ke server terlalu lama. Coba ulang beberapa detik lagi.';

export class ApiClientError extends Error {
  status: number;
  payload: unknown;
  isTimeout: boolean;

  constructor(message: string, options: { status?: number; payload?: unknown; isTimeout?: boolean } = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status ?? 0;
    this.payload = options.payload;
    this.isTimeout = Boolean(options.isTimeout);
  }
}

function isBodyInit(value: unknown): value is BodyInit {
  return (
    typeof value === 'string' ||
    value instanceof Blob ||
    value instanceof ArrayBuffer ||
    value instanceof URLSearchParams ||
    (typeof FormData !== 'undefined' && value instanceof FormData) ||
    (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream)
  );
}

function shouldSendJson(body: unknown) {
  return body !== undefined && !isBodyInit(body);
}

function buildUrl(path: string, query?: ApiClientRequestOptions['query']) {
  const url = new URL(buildMakeServerUrl(path));

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) {
        if (item === null || item === undefined || item === '') continue;
        url.searchParams.append(key, String(item));
      }
    }
  }

  return url.toString();
}

function mergeHeaders(headers?: HeadersInit, includeJsonContentType = false) {
  const merged = new Headers(headers);
  if (includeJsonContentType && !merged.has('content-type')) {
    merged.set('Content-Type', 'application/json');
  }
  return Object.fromEntries(merged.entries());
}

async function resolveHeaders(options: ApiClientRequestOptions, includeJsonContentType: boolean) {
  if (options.auth === 'none') {
    return mergeHeaders(options.headers, includeJsonContentType);
  }

  if (options.auth === 'public') {
    return getPublicEdgeHeaders({
      headers: options.headers,
      includeJsonContentType,
    });
  }

  return getSessionBackedEdgeHeaders({
    headers: options.headers,
    includeJsonContentType,
  });
}

async function readPayload(response: Response) {
  const text = await response.text().catch(() => '');
  if (!text) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown, response: Response) {
  if (payload && typeof payload === 'object') {
    const objectPayload = payload as ErrorPayload;
    const directMessage = objectPayload.error || objectPayload.message || objectPayload.details;

    if (typeof directMessage === 'string' && directMessage.trim()) {
      return directMessage;
    }
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  return `Request gagal dengan status HTTP ${response.status}`;
}

function parsePayload<TResponse>(payload: unknown, parseAs: ApiClientParseMode, response: Response) {
  if (parseAs === 'response') return response as TResponse;
  if (parseAs === 'empty' || response.status === 204) return undefined as TResponse;
  if (parseAs === 'text') return (typeof payload === 'string' ? payload : JSON.stringify(payload ?? '')) as TResponse;
  return payload as TResponse;
}

export async function requestMakeServer<TResponse = unknown, TBody = unknown>(
  options: ApiClientRequestOptions<TBody>,
): Promise<TResponse> {
  const method = options.method ?? (options.body === undefined ? 'GET' : 'POST');
  const hasJsonBody = shouldSendJson(options.body);
  const includeJsonContentType = options.includeJsonContentType ?? hasJsonBody;
  const headers = await resolveHeaders(options, includeJsonContentType);
  const body = options.body === undefined
    ? undefined
    : hasJsonBody
      ? JSON.stringify(options.body)
      : options.body as BodyInit;
  const {
    path,
    query,
    auth: _auth,
    parseAs: _parseAs,
    timeoutMs: _timeoutMs,
    timeoutMessage: _timeoutMessage,
    includeJsonContentType: _includeJsonContentType,
    headers: _headers,
    body: _body,
    method: _method,
    ...requestInit
  } = options;

  let response: Response;

  try {
    response = await fetchWithTimeout(
      buildUrl(path, query),
      {
        ...requestInit,
        method,
        headers,
        body,
      },
      options.timeoutMs ?? DEFAULT_API_TIMEOUT_MS,
      options.timeoutMessage ?? DEFAULT_TIMEOUT_MESSAGE,
    );
  } catch (error) {
    throw new ApiClientError(
      error instanceof Error ? error.message : DEFAULT_TIMEOUT_MESSAGE,
      { isTimeout: isRequestTimeoutError(error) },
    );
  }

  const parseAs = options.parseAs ?? 'json';
  const payload = parseAs === 'response' && response.ok ? undefined : await readPayload(response);

  if (!response.ok) {
    throw new ApiClientError(getErrorMessage(payload, response), {
      status: response.status,
      payload,
    });
  }

  return parsePayload<TResponse>(payload, parseAs, response);
}

export const makeServerApi = {
  get<TResponse = unknown>(path: string, options: Omit<ApiClientRequestOptions, 'path' | 'method' | 'body'> = {}) {
    return requestMakeServer<TResponse>({ ...options, path, method: 'GET' });
  },

  post<TResponse = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options: Omit<ApiClientRequestOptions<TBody>, 'path' | 'method' | 'body'> = {},
  ) {
    return requestMakeServer<TResponse, TBody>({ ...options, path, method: 'POST', body });
  },

  put<TResponse = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options: Omit<ApiClientRequestOptions<TBody>, 'path' | 'method' | 'body'> = {},
  ) {
    return requestMakeServer<TResponse, TBody>({ ...options, path, method: 'PUT', body });
  },

  patch<TResponse = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options: Omit<ApiClientRequestOptions<TBody>, 'path' | 'method' | 'body'> = {},
  ) {
    return requestMakeServer<TResponse, TBody>({ ...options, path, method: 'PATCH', body });
  },

  delete<TResponse = unknown>(path: string, options: Omit<ApiClientRequestOptions, 'path' | 'method' | 'body'> = {}) {
    return requestMakeServer<TResponse>({ ...options, path, method: 'DELETE' });
  },
};
