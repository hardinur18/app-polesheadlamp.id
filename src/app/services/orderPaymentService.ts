import { PaymentTransaction } from '@/app/pages/master-data/data';
import { Order } from '@/app/pages/master-data/data';
import { buildMakeServerUrl } from './internal/functionsBaseUrl';
import { getSessionBackedEdgeHeaders } from './internal/sessionClientHeaders';

const BASE_URL = buildMakeServerUrl('/payments');

export type PaymentGatewayNoticeCode =
  | 'session_required'
  | 'service_unavailable'
  | 'service_not_ready'
  | 'permission_denied'
  | 'configuration_required'
  | 'validation_error'
  | 'unknown_error';

export type PaymentGatewayNotice = {
  code: PaymentGatewayNoticeCode;
  title: string;
  description: string;
};

export type PaymentGatewayServiceStatus = {
  available: boolean;
  state: 'live' | 'mock' | 'disabled' | 'unavailable';
  title: string;
  description: string;
  enabled?: boolean;
  hasSecretKey?: boolean;
  hasWebhookToken?: boolean;
};

type PaymentGatewayStatusPayload = {
  data?: {
    enabled?: boolean;
    hasSecretKey?: boolean;
    hasWebhookToken?: boolean;
    mode?: 'live' | 'mock' | 'disabled';
  };
};

type XenditConnectionTestPayload = {
  data?: {
    balance?: number;
    currency?: string;
  };
};

class PaymentGatewayError extends Error {
  code: PaymentGatewayNoticeCode;
  description: string;
  status?: number;
  technicalMessage?: string;

  constructor(notice: PaymentGatewayNotice, options?: { status?: number; technicalMessage?: string }) {
    super(notice.title);
    this.name = 'PaymentGatewayError';
    this.code = notice.code;
    this.description = notice.description;
    this.status = options?.status;
    this.technicalMessage = options?.technicalMessage;
  }
}

const buildNotice = (
  code: PaymentGatewayNoticeCode,
  title: string,
  description: string,
): PaymentGatewayNotice => ({
  code,
  title,
  description,
});

const resolveGatewayNotice = (message: string, status?: number): PaymentGatewayNotice => {
  const normalized = String(message || '').trim();

  if (status === 404) {
    return buildNotice(
      'service_not_ready',
      'Layanan QRIS belum aktif',
      'Server pembayaran QRIS di aplikasi ini belum tersedia. Tim kami perlu mengaktifkan Edge Function pembayaran terlebih dahulu.',
    );
  }

  if (status === 401) {
    return buildNotice(
      'session_required',
      'Sesi pembayaran perlu diperbarui',
      'Silakan muat ulang halaman lalu login kembali sebelum membuat tagihan QRIS.',
    );
  }

  if (status === 403) {
    return buildNotice(
      'permission_denied',
      'Akses QRIS belum diizinkan',
      'Akun ini belum memiliki izin untuk mengelola tagihan QRIS. Silakan hubungi admin.',
    );
  }

  if (
    normalized.includes('XENDIT_SECRET_KEY') ||
    normalized.includes('webhook') ||
    normalized.includes('mode mock')
  ) {
    return buildNotice(
      'configuration_required',
      'QRIS masih dalam tahap persiapan',
      'Konfigurasi Xendit di server belum lengkap. Lengkapi secret key dan webhook agar tagihan QRIS bisa dipakai untuk transaksi nyata.',
    );
  }

  if (
    normalized.includes('Order belum memiliki nominal') ||
    normalized.includes('Order yang sudah dibatalkan') ||
    normalized.includes('Order yang sudah lunas')
  ) {
    return buildNotice(
      'validation_error',
      'Tagihan QRIS belum bisa dibuat',
      normalized,
    );
  }

  if (
    normalized.includes('Failed to fetch') ||
    normalized.includes('NetworkError') ||
    normalized.includes('Load failed') ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return buildNotice(
      'service_unavailable',
      'Layanan QRIS sedang tidak dapat dihubungi',
      'Silakan coba beberapa saat lagi. Jika kendala berlanjut, gunakan metode pembayaran biasa terlebih dahulu dan hubungi admin.',
    );
  }

  if (status && status >= 500) {
    return buildNotice(
      'service_unavailable',
      'Server pembayaran sedang bermasalah',
      'Permintaan QRIS belum bisa diproses saat ini. Silakan coba lagi beberapa saat lagi.',
    );
  }

  return buildNotice(
    'unknown_error',
    'Permintaan QRIS belum berhasil diproses',
    normalized || 'Terjadi kendala pada layanan pembayaran. Silakan coba lagi.',
  );
};

const createGatewayError = (message: string, status?: number) => {
  const notice = resolveGatewayNotice(message, status);
  return new PaymentGatewayError(notice, {
    status,
    technicalMessage: message,
  });
};

const getHeaders = async (includeJsonContentType = true) => {
  try {
    return await getSessionBackedEdgeHeaders({ includeJsonContentType });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Missing active session';
    throw createGatewayError(message, 401);
  }
};

const readPayload = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return { payload: {}, rawText: '' };
  }

  try {
    return {
      payload: JSON.parse(text),
      rawText: text,
    };
  } catch {
    return {
      payload: {},
      rawText: text,
    };
  }
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  const { payload, rawText } = await readPayload(response);

  if (!response.ok) {
    throw createGatewayError(
      payload?.error || payload?.message || rawText || `HTTP ${response.status}`,
      response.status,
    );
  }

  return payload as T;
};

const normalizeUnknownError = (error: unknown) => {
  if (error instanceof PaymentGatewayError) {
    return error;
  }

  if (error instanceof Error) {
    return createGatewayError(error.message);
  }

  return createGatewayError('Unknown payment gateway error');
};

async function requestJson<T>(path: string, init?: RequestInit, includeJsonContentType = true): Promise<T> {
  try {
    const headers = await getHeaders(includeJsonContentType);
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...(init?.headers || {}),
      },
    });
    return await handleResponse<T>(response);
  } catch (error) {
    throw normalizeUnknownError(error);
  }
}

export const getPaymentGatewayNotice = (
  error: unknown,
  fallback?: Partial<PaymentGatewayNotice>,
): PaymentGatewayNotice => {
  if (error instanceof PaymentGatewayError) {
    return {
      code: error.code,
      title: error.message,
      description: error.description,
    };
  }

  return {
    code: fallback?.code || 'unknown_error',
    title: fallback?.title || 'Permintaan QRIS belum berhasil diproses',
    description:
      fallback?.description ||
      (error instanceof Error ? error.message : 'Terjadi kendala pada layanan pembayaran.'),
  };
};

export const orderPaymentService = {
  async testXenditConnection(xenditSecretKey: string): Promise<{ balance: number; currency?: string }> {
    const payload = await requestJson<XenditConnectionTestPayload>('/test-xendit', {
      method: 'POST',
      body: JSON.stringify({ xenditSecretKey }),
    });

    return {
      balance: Number(payload.data?.balance || 0),
      currency: payload.data?.currency,
    };
  },

  async getServiceStatus(): Promise<PaymentGatewayServiceStatus> {
    try {
      const payload = await requestJson<PaymentGatewayStatusPayload>('/status', undefined, false);
      const mode = payload.data?.mode || 'disabled';

      if (mode === 'live') {
        return {
          available: true,
          state: 'live',
          title: 'Layanan QRIS siap digunakan',
          description: 'Server pembayaran aktif dan konfigurasi Xendit untuk transaksi nyata sudah terbaca.',
          enabled: payload.data?.enabled,
          hasSecretKey: payload.data?.hasSecretKey,
          hasWebhookToken: payload.data?.hasWebhookToken,
        };
      }

      if (mode === 'mock') {
        return {
          available: true,
          state: 'mock',
          title: 'Layanan QRIS masih mode simulasi',
          description: 'Server pembayaran sudah aktif, tetapi secret key Xendit belum lengkap sehingga transaksi nyata belum berjalan.',
          enabled: payload.data?.enabled,
          hasSecretKey: payload.data?.hasSecretKey,
          hasWebhookToken: payload.data?.hasWebhookToken,
        };
      }

      return {
        available: true,
        state: 'disabled',
        title: 'Payment Gateway belum diaktifkan',
        description: 'Aktifkan Payment Gateway di pengaturan agar tim operasional bisa membuat tagihan QRIS dari pesanan.',
        enabled: payload.data?.enabled,
        hasSecretKey: payload.data?.hasSecretKey,
        hasWebhookToken: payload.data?.hasWebhookToken,
      };
    } catch (error) {
      const notice = getPaymentGatewayNotice(error);
      return {
        available: false,
        state: 'unavailable',
        title: notice.title,
        description: notice.description,
      };
    }
  },

  async listOrderTransactions(orderId: string, _role?: string): Promise<PaymentTransaction[]> {
    const payload = await requestJson<{ data?: PaymentTransaction[] }>(`/order/${orderId}`, {
      method: 'GET',
    }, false);
    return payload.data || [];
  },

  async createQrisPayment(
    orderId: string,
    _order: Order,
    _role?: string,
    force = false,
  ): Promise<{ data: PaymentTransaction; syncState?: { paymentStatus: string; paymentValidation: string; income: number } }> {
    return requestJson('/qris/create', {
      method: 'POST',
      body: JSON.stringify({
        orderId,
        force,
      }),
    });
  },

  async refreshTransaction(transactionId: string, _role?: string): Promise<PaymentTransaction> {
    const payload = await requestJson<{ data: PaymentTransaction }>(`/transactions/${transactionId}/refresh`, {
      method: 'POST',
    });
    return payload.data;
  },

  async cancelTransaction(transactionId: string, _role?: string): Promise<PaymentTransaction> {
    const payload = await requestJson<{ data: PaymentTransaction }>(`/transactions/${transactionId}/cancel`, {
      method: 'POST',
    });
    return payload.data;
  },
};
