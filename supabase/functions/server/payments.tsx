import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.options("/*", () => new Response(null, { status: 204 }));

type Role = "Owner" | "Super Admin" | "Admin PIC" | "CS" | "Advertiser" | "Teknisi" | "Finance";
type OrderRow = {
  id: string;
  customer_name: string;
  customer_phone?: string;
  price: number;
  payment_type?: string | null;
  payment_status?: string | null;
  payment_validation?: string | null;
  income?: number | null;
  notes?: string | null;
  status?: string | null;
};

type PaymentTransactionRecord = {
  id: string;
  orderId: string;
  amount: number;
  paymentMethod: "qris";
  gatewayProvider: "xendit" | "mock";
  status: "pending" | "requires_action" | "paid" | "expired" | "failed" | "cancelled";
  providerStatus?: string;
  channelCode?: string;
  referenceId?: string;
  paymentRequestId?: string;
  paymentId?: string;
  qrString?: string;
  qrImageUrl?: string;
  checkoutUrl?: string;
  expiresAt?: string;
  paidAt?: string;
  cancelledAt?: string;
  createdAt?: string;
  updatedAt?: string;
  description?: string;
  metadata?: Record<string, any>;
  providerPayload?: any;
};

const PAYMENT_TABLE = "payment_transactions";
const PAYMENT_MASTER_TYPE = "payment_transactions";
const WEBHOOK_LOG_PREFIX = "payment_webhook";
const GATEWAY_SETTINGS_KEY = "payment_gateway:settings";
const XENDIT_API_BASE_URL = Deno.env.get("XENDIT_API_BASE_URL") || "https://api.xendit.co";
const XENDIT_API_VERSION = Deno.env.get("XENDIT_API_VERSION") || "2024-11-11";
let XENDIT_SECRET_KEY = Deno.env.get("XENDIT_SECRET_KEY") || "";
let XENDIT_WEBHOOK_TOKEN = Deno.env.get("XENDIT_WEBHOOK_TOKEN") || "";
const ALLOW_MOCK_PAYMENT_GATEWAY = Deno.env.get("ALLOW_MOCK_PAYMENT_GATEWAY") === "true";
const QRIS_FALLBACK_EXPIRY_HOURS = 48;

type PaymentGatewayConfig = {
  enabled?: boolean;
  merchantName?: string;
  xenditSecretKey?: string;
  xenditWebhookToken?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  updatedAt?: string;
};

type AuthError = { error: string };
type AuthSuccess = {
  supabase: ReturnType<typeof createAdminClient>;
  user: any;
  role: Role;
  profile: any;
};
type AuthResult = AuthError | AuthSuccess;

const isAuthError = (auth: AuthResult): auth is AuthError => "error" in auth;

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(supabaseUrl, supabaseServiceKey);
};

const loadGatewayConfig = async (
  supabase = createAdminClient(),
): Promise<PaymentGatewayConfig | null> => {
  try {
    const { data, error } = await supabase
      .from("kv_store_f781cd00")
      .select("value")
      .eq("key", GATEWAY_SETTINGS_KEY)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const config = (data?.value || null) as PaymentGatewayConfig | null;
    const envSecret = Deno.env.get("XENDIT_SECRET_KEY") || "";
    const envWebhook = Deno.env.get("XENDIT_WEBHOOK_TOKEN") || "";

    if (!config) {
      XENDIT_SECRET_KEY = envSecret;
      XENDIT_WEBHOOK_TOKEN = envWebhook;
      return null;
    }

    if (config.enabled === false) {
      XENDIT_SECRET_KEY = "";
      XENDIT_WEBHOOK_TOKEN = "";
      return config;
    }

    XENDIT_SECRET_KEY = config.xenditSecretKey || envSecret;
    XENDIT_WEBHOOK_TOKEN = config.xenditWebhookToken || envWebhook;
    return config;
  } catch (error) {
    console.error("Failed to load payment gateway config:", error);
    return null;
  }
};

await loadGatewayConfig();

const normalizeText = (value: unknown) => String(value || "").toLowerCase();

const testXenditBalance = async (secretKey: string) => {
  const response = await fetch(`${XENDIT_API_BASE_URL}/balance`, {
    headers: {
      Authorization: `Basic ${btoa(`${secretKey}:`)}`,
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error_code || response.statusText || "Failed to test Xendit connection");
  }

  return {
    balance: Number(payload?.balance || 0),
    currency: payload?.currency || "IDR",
  };
};

const isMissingPaymentTableError = (error: any) => {
  const message = [
    error?.message,
    error?.details,
    error?.hint,
    error?.error_description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    message.includes(PAYMENT_TABLE) &&
    (message.includes("does not exist") ||
      message.includes("relation") ||
      message.includes("schema cache") ||
      message.includes("column"))
  );
};

const sortTransactionsDesc = (items: PaymentTransactionRecord[]) =>
  [...items].sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });

const buildBasicAuthHeader = (secretKey: string) =>
  `Basic ${btoa(`${secretKey}:`)}`;

const addHours = (dateString: string, hours: number) =>
  new Date(new Date(dateString).getTime() + hours * 60 * 60 * 1000).toISOString();

const mapDbToTransaction = (row: any): PaymentTransactionRecord => ({
  id: row.id,
  orderId: row.order_id,
  amount: Number(row.amount || 0),
  paymentMethod: row.payment_method || "qris",
  gatewayProvider: row.gateway_provider || "mock",
  status: row.status || "pending",
  providerStatus: row.provider_status,
  channelCode: row.channel_code,
  referenceId: row.reference_id,
  paymentRequestId: row.payment_request_id,
  paymentId: row.payment_id,
  qrString: row.qr_string,
  qrImageUrl: row.qr_image_url,
  checkoutUrl: row.checkout_url,
  expiresAt: row.expires_at,
  paidAt: row.paid_at,
  cancelledAt: row.cancelled_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  description: row.description,
  metadata: row.metadata || {},
  providerPayload: row.provider_payload,
});

const mapTransactionToDb = (transaction: PaymentTransactionRecord) => ({
  id: transaction.id,
  order_id: transaction.orderId,
  amount: transaction.amount,
  payment_method: transaction.paymentMethod,
  gateway_provider: transaction.gatewayProvider,
  status: transaction.status,
  provider_status: transaction.providerStatus,
  channel_code: transaction.channelCode,
  reference_id: transaction.referenceId,
  payment_request_id: transaction.paymentRequestId,
  payment_id: transaction.paymentId,
  qr_string: transaction.qrString,
  qr_image_url: transaction.qrImageUrl,
  checkout_url: transaction.checkoutUrl,
  expires_at: transaction.expiresAt,
  paid_at: transaction.paidAt,
  cancelled_at: transaction.cancelledAt,
  description: transaction.description,
  metadata: transaction.metadata || {},
  provider_payload: transaction.providerPayload,
  created_at: transaction.createdAt,
  updated_at: transaction.updatedAt,
});

const mapXenditPaymentRequestStatus = (status?: string): PaymentTransactionRecord["status"] => {
  switch ((status || "").toUpperCase()) {
    case "SUCCEEDED":
      return "paid";
    case "EXPIRED":
      return "expired";
    case "FAILED":
      return "failed";
    case "CANCELED":
      return "cancelled";
    case "REQUIRES_ACTION":
      return "requires_action";
    case "ACCEPTING_PAYMENTS":
    case "AUTHORIZED":
      return "pending";
    default:
      return "pending";
  }
};

const extractActionValue = (actions: any[] | undefined, descriptor: string) =>
  Array.isArray(actions)
    ? actions.find((action) => action?.descriptor === descriptor)?.value
    : undefined;

const deriveExpiresAt = (payload: any) => {
  const explicitExpiry =
    payload?.expires_at ||
    payload?.channel_properties?.expires_at ||
    payload?.expiry_at;

  if (explicitExpiry) {
    return explicitExpiry;
  }

  const createdAt = payload?.created || new Date().toISOString();
  return addHours(createdAt, QRIS_FALLBACK_EXPIRY_HOURS);
};

const mapXenditPaymentRequest = (
  source: Pick<PaymentTransactionRecord, "id" | "orderId"> & Partial<PaymentTransactionRecord>,
  paymentRequest: any,
): PaymentTransactionRecord => {
  const providerStatus = paymentRequest?.status;
  const status = mapXenditPaymentRequestStatus(providerStatus);

  return {
    ...source,
    amount: Number(paymentRequest?.request_amount || source.amount || 0),
    gatewayProvider: "xendit",
    paymentMethod: "qris",
    status,
    providerStatus,
    channelCode: paymentRequest?.channel_code || "QRIS",
    referenceId: paymentRequest?.reference_id || source.referenceId,
    paymentRequestId: paymentRequest?.payment_request_id || source.paymentRequestId,
    paymentId: paymentRequest?.latest_payment_id || paymentRequest?.payment_id || source.paymentId,
    qrString: extractActionValue(paymentRequest?.actions, "QR_STRING") || source.qrString,
    checkoutUrl:
      extractActionValue(paymentRequest?.actions, "WEB_URL") ||
      extractActionValue(paymentRequest?.actions, "DEEPLINK_URL") ||
      source.checkoutUrl,
    expiresAt: deriveExpiresAt(paymentRequest),
    paidAt:
      status === "paid"
        ? paymentRequest?.updated || paymentRequest?.created || new Date().toISOString()
        : source.paidAt,
    createdAt: paymentRequest?.created || source.createdAt || new Date().toISOString(),
    updatedAt: paymentRequest?.updated || new Date().toISOString(),
    description: paymentRequest?.description || source.description,
    metadata: paymentRequest?.metadata || source.metadata || {},
    providerPayload: paymentRequest,
  };
};

const requiresManagerRole = (role: Role) =>
  ["Owner", "Super Admin", "Admin PIC", "Finance", "CS"].includes(role);

const canCancelQris = (role: Role) =>
  ["Owner", "Super Admin", "Admin PIC", "Finance"].includes(role);

const canReadPayments = (role: Role) =>
  ["Owner", "Super Admin", "Admin PIC", "Finance", "CS", "Advertiser"].includes(role);

const checkAuth = async (req: Request): Promise<AuthResult> => {
  let token = req.headers.get("x-client-token");
  if (!token) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "");
    }
  }

  if (!token) {
    return { error: "Missing authentication token" };
  }

  const supabase = createAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: `Invalid token: ${error?.message || "Unknown error"}` };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, name")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    user,
    role: (profile?.role || user.user_metadata?.role || "CS") as Role,
    profile,
  };
};

const getOrderById = async (supabase: ReturnType<typeof createAdminClient>, orderId: string) => {
  const { data, error } = await supabase
    .from("orders")
    .select("id, customer_name, customer_phone, price, payment_type, payment_status, payment_validation, income, notes, status")
    .eq("id", orderId)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Order not found");
  }

  return data as OrderRow;
};

const listKvTransactions = async () => {
  const items = await kv.getByPrefix(`${PAYMENT_MASTER_TYPE}:`);
  return sortTransactionsDesc((items || []) as PaymentTransactionRecord[]);
};

const listOrderTransactions = async (supabase: ReturnType<typeof createAdminClient>, orderId: string) => {
  const { data, error } = await supabase
    .from(PAYMENT_TABLE)
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (!error) {
    return (data || []).map(mapDbToTransaction);
  }

  if (!isMissingPaymentTableError(error)) {
    throw error;
  }

  const items = await listKvTransactions();
  return items.filter((item) => item.orderId === orderId);
};

const getTransactionById = async (supabase: ReturnType<typeof createAdminClient>, transactionId: string) => {
  const { data, error } = await supabase
    .from(PAYMENT_TABLE)
    .select("*")
    .eq("id", transactionId)
    .maybeSingle();

  if (!error && data) {
    return mapDbToTransaction(data);
  }

  if (error && !isMissingPaymentTableError(error)) {
    throw error;
  }

  const items = await listKvTransactions();
  return items.find((item) => item.id === transactionId) || null;
};

const findTransactionByProviderReference = async (
  supabase: ReturnType<typeof createAdminClient>,
  paymentRequestId?: string,
  referenceId?: string,
) => {
  if (paymentRequestId) {
    const { data, error } = await supabase
      .from(PAYMENT_TABLE)
      .select("*")
      .eq("payment_request_id", paymentRequestId)
      .maybeSingle();

    if (!error && data) {
      return mapDbToTransaction(data);
    }

    if (error && !isMissingPaymentTableError(error)) {
      throw error;
    }
  }

  if (referenceId) {
    const { data, error } = await supabase
      .from(PAYMENT_TABLE)
      .select("*")
      .eq("reference_id", referenceId)
      .maybeSingle();

    if (!error && data) {
      return mapDbToTransaction(data);
    }

    if (error && !isMissingPaymentTableError(error)) {
      throw error;
    }
  }

  const items = await listKvTransactions();
  return (
    items.find(
      (item) =>
        (paymentRequestId && item.paymentRequestId === paymentRequestId) ||
        (referenceId && item.referenceId === referenceId),
    ) || null
  );
};

const saveTransaction = async (
  supabase: ReturnType<typeof createAdminClient>,
  transaction: PaymentTransactionRecord,
) => {
  const now = new Date().toISOString();
  const normalized: PaymentTransactionRecord = {
    ...transaction,
    createdAt: transaction.createdAt || now,
    updatedAt: now,
  };

  const { data, error } = await supabase
    .from(PAYMENT_TABLE)
    .upsert(mapTransactionToDb(normalized))
    .select()
    .single();

  if (!error && data) {
    return mapDbToTransaction(data);
  }

  if (!isMissingPaymentTableError(error)) {
    throw error;
  }

  await kv.set(`${PAYMENT_MASTER_TYPE}:${normalized.id}`, normalized);
  return normalized;
};

const logWebhook = async (payload: any) => {
  const key = `${WEBHOOK_LOG_PREFIX}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  await kv.set(key, payload);
};

const createReferenceId = (orderId: string) =>
  `qris_${orderId.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}`;

const createMockPaymentTransaction = (order: OrderRow): PaymentTransactionRecord => {
  const createdAt = new Date().toISOString();
  return {
    id: `paytx-${crypto.randomUUID()}`,
    orderId: order.id,
    amount: Number(order.price || 0),
    paymentMethod: "qris",
    gatewayProvider: "mock",
    status: "requires_action",
    providerStatus: "REQUIRES_ACTION",
    channelCode: "QRIS",
    referenceId: createReferenceId(order.id),
    qrString: `MOCK-QRIS|ORDER:${order.id}|AMOUNT:${Math.round(Number(order.price || 0))}|NAME:${order.customer_name}`,
    expiresAt: addHours(createdAt, QRIS_FALLBACK_EXPIRY_HOURS),
    createdAt,
    updatedAt: createdAt,
    description: `Mock QRIS untuk order ${order.id}`,
    metadata: {
      order_id: order.id,
      mode: "mock",
    },
    providerPayload: {
      mode: "mock",
      note: "XENDIT_SECRET_KEY belum dikonfigurasi. Sistem menjalankan fallback mock untuk pengembangan UI.",
    },
  };
};

const createXenditPaymentRequest = async (order: OrderRow) => {
  const referenceId = createReferenceId(order.id);
  const body = {
    reference_id: referenceId,
    type: "PAY",
    country: "ID",
    currency: "IDR",
    request_amount: Math.round(Number(order.price || 0)),
    capture_method: "AUTOMATIC",
    channel_code: "QRIS",
    channel_properties: {
      qr_string_type: "DYNAMIC",
    },
    description: `QRIS pembayaran order ${order.id}`,
    metadata: {
      order_id: order.id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
    },
  };

  const response = await fetch(`${XENDIT_API_BASE_URL}/v3/payment_requests`, {
    method: "POST",
    headers: {
      Authorization: buildBasicAuthHeader(XENDIT_SECRET_KEY),
      "Content-Type": "application/json",
      "api-version": XENDIT_API_VERSION,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error_code || "Failed to create QRIS payment request");
  }

  return mapXenditPaymentRequest(
    {
      id: `paytx-${crypto.randomUUID()}`,
      orderId: order.id,
      amount: Math.round(Number(order.price || 0)),
      paymentMethod: "qris",
      gatewayProvider: "xendit",
      status: "requires_action",
      referenceId,
    },
    payload,
  );
};

const refreshXenditPaymentRequest = async (transaction: PaymentTransactionRecord) => {
  if (!transaction.paymentRequestId) {
    throw new Error("Missing payment request id");
  }

  const response = await fetch(
    `${XENDIT_API_BASE_URL}/v3/payment_requests/${transaction.paymentRequestId}`,
    {
      headers: {
        Authorization: buildBasicAuthHeader(XENDIT_SECRET_KEY),
        "api-version": XENDIT_API_VERSION,
      },
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error_code || "Failed to refresh payment request");
  }

  return mapXenditPaymentRequest(transaction, payload);
};

const markSupersededTransactions = async (
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string,
  reason: string,
) => {
  const existingTransactions = await listOrderTransactions(supabase, orderId);
  const activeTransactions = existingTransactions.filter((item) =>
    ["pending", "requires_action"].includes(item.status),
  );

  const updated = [];
  for (const transaction of activeTransactions) {
    updated.push(
      await saveTransaction(supabase, {
        ...transaction,
        status: "cancelled",
        providerStatus: transaction.providerStatus || "CANCELED",
        cancelledAt: new Date().toISOString(),
        metadata: {
          ...(transaction.metadata || {}),
          superseded_reason: reason,
        },
      }),
    );
  }

  return updated;
};

const syncOrderPaymentState = async (
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string,
) => {
  const order = await getOrderById(supabase, orderId);
  const transactions = await listOrderTransactions(supabase, orderId);
  const paidTransactions = transactions.filter((item) => item.status === "paid");
  const totalPaid = paidTransactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  let paymentStatus = order.payment_status || "Unpaid";
  let paymentValidation = order.payment_validation || "Pending";
  let income = order.income || 0;

  if (totalPaid >= Number(order.price || 0) && totalPaid > 0) {
    paymentStatus = "Paid";
    paymentValidation = "Valid";
    income = totalPaid;
  } else if (totalPaid > 0) {
    paymentStatus = "Down Payment";
    paymentValidation = "Valid";
    income = totalPaid;
  } else if (transactions.some((item) => ["pending", "requires_action"].includes(item.status))) {
    paymentStatus = "Unpaid";
    paymentValidation = "Pending";
    income = 0;
  } else if (transactions.some((item) => item.status === "failed")) {
    paymentStatus = "Unpaid";
    paymentValidation = "Invalid";
    income = 0;
  } else if (transactions.length > 0) {
    paymentStatus = "Unpaid";
    paymentValidation = "Pending";
    income = 0;
  }

  await supabase
    .from("orders")
    .update({
      payment_type: transactions.length > 0 ? "QRIS" : order.payment_type,
      payment_status: paymentStatus,
      payment_validation: paymentValidation,
      income,
    })
    .eq("id", orderId);

  return {
    ...order,
    payment_type: transactions.length > 0 ? "QRIS" : order.payment_type,
    payment_status: paymentStatus,
    payment_validation: paymentValidation,
    income,
  };
};

app.get("/status", async (c) => {
  try {
    const auth = await checkAuth(c.req.raw);
    if (isAuthError(auth)) return c.json({ error: auth.error }, 401);

    const config = await loadGatewayConfig(auth.supabase);
    const enabled = config?.enabled !== false;
    const hasSecretKey = Boolean(XENDIT_SECRET_KEY);
    const hasWebhookToken = Boolean(XENDIT_WEBHOOK_TOKEN);

    return c.json({
      data: {
        enabled,
        hasSecretKey,
        hasWebhookToken,
        mode: !enabled ? "disabled" : hasSecretKey ? "live" : ALLOW_MOCK_PAYMENT_GATEWAY ? "mock" : "unconfigured",
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to load payment gateway status" }, 500);
  }
});

app.post("/test-xendit", async (c) => {
  try {
    const auth = await checkAuth(c.req.raw);
    if (isAuthError(auth)) return c.json({ error: auth.error }, 401);
    if (!requiresManagerRole(auth.role)) return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json().catch(() => ({}));
    const config = await loadGatewayConfig(auth.supabase);
    const secretKey = String(body.xenditSecretKey || XENDIT_SECRET_KEY || config?.xenditSecretKey || "").trim();

    if (!secretKey) {
      return c.json({ error: "Secret API Key Xendit wajib diisi" }, 400);
    }

    const result = await testXenditBalance(secretKey);
    return c.json({ data: result });
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to test Xendit connection" }, 500);
  }
});

app.get("/order/:orderId", async (c) => {
  try {
    const auth = await checkAuth(c.req.raw);
    if (isAuthError(auth)) return c.json({ error: auth.error }, 401);
    if (!canReadPayments(auth.role)) return c.json({ error: "Forbidden" }, 403);

    const orderId = c.req.param("orderId");
    const transactions = await listOrderTransactions(auth.supabase, orderId);
    return c.json({ data: transactions });
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to fetch payment transactions" }, 500);
  }
});

app.post("/qris/create", async (c) => {
  try {
    const auth = await checkAuth(c.req.raw);
    if (isAuthError(auth)) return c.json({ error: auth.error }, 401);
    if (!requiresManagerRole(auth.role)) return c.json({ error: "Forbidden" }, 403);
    const config = await loadGatewayConfig(auth.supabase);

    const { orderId, force } = await c.req.json();
    if (!orderId) return c.json({ error: "orderId is required" }, 400);
    if (config?.enabled === false) {
      return c.json({ error: "Payment Gateway belum diaktifkan. Silakan aktifkan dulu di pengaturan." }, 503);
    }

    const order = await getOrderById(auth.supabase, orderId);
    if (!Number(order.price || 0)) {
      return c.json({ error: "Order belum memiliki nominal pembayaran yang valid" }, 400);
    }

    if (normalizeText(order.status) === "cancelled") {
      return c.json({ error: "Order yang sudah dibatalkan tidak bisa dibuatkan QRIS" }, 400);
    }

    if (normalizeText(order.payment_status) === "paid" && !force) {
      return c.json({ error: "Order yang sudah lunas tidak perlu dibuatkan QRIS baru" }, 400);
    }

    const existingTransactions = await listOrderTransactions(auth.supabase, orderId);
    const reusableTransaction = existingTransactions.find(
      (item) =>
        ["pending", "requires_action"].includes(item.status) &&
        Number(item.amount || 0) === Math.round(Number(order.price || 0)),
    );

    if (reusableTransaction && !force) {
      return c.json({ data: reusableTransaction, reused: true });
    }

    if (existingTransactions.some((item) => ["pending", "requires_action"].includes(item.status))) {
      await markSupersededTransactions(
        auth.supabase,
        orderId,
        force ? "force_regenerate" : "price_or_status_changed",
      );
    }

    if (!XENDIT_SECRET_KEY && !ALLOW_MOCK_PAYMENT_GATEWAY) {
      return c.json({
        error: "XENDIT_SECRET_KEY belum dikonfigurasi. QRIS mock hanya boleh aktif jika ALLOW_MOCK_PAYMENT_GATEWAY=true.",
      }, 503);
    }

    const transaction = XENDIT_SECRET_KEY
      ? await createXenditPaymentRequest(order)
      : createMockPaymentTransaction(order);

    const saved = await saveTransaction(auth.supabase, transaction);
    await syncOrderPaymentState(auth.supabase, orderId);

    return c.json({
      data: saved,
      mode: saved.gatewayProvider,
      warning:
        saved.gatewayProvider === "mock"
          ? "XENDIT_SECRET_KEY belum dikonfigurasi, sistem memakai fallback mock untuk pengembangan."
          : null,
    });
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to create QRIS payment" }, 500);
  }
});

app.post("/transactions/:id/refresh", async (c) => {
  try {
    const auth = await checkAuth(c.req.raw);
    if (isAuthError(auth)) return c.json({ error: auth.error }, 401);
    if (!canReadPayments(auth.role)) return c.json({ error: "Forbidden" }, 403);
    await loadGatewayConfig(auth.supabase);

    const transaction = await getTransactionById(auth.supabase, c.req.param("id"));
    if (!transaction) return c.json({ error: "Payment transaction not found" }, 404);

    let nextTransaction = transaction;
    if (transaction.gatewayProvider === "xendit" && XENDIT_SECRET_KEY) {
      nextTransaction = await refreshXenditPaymentRequest(transaction);
    } else if (
      transaction.expiresAt &&
      new Date(transaction.expiresAt).getTime() < Date.now() &&
      ["pending", "requires_action"].includes(transaction.status)
    ) {
      nextTransaction = {
        ...transaction,
        status: "expired",
        providerStatus: "EXPIRED",
      };
    }

    const saved = await saveTransaction(auth.supabase, nextTransaction);
    await syncOrderPaymentState(auth.supabase, saved.orderId);

    return c.json({ data: saved });
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to refresh transaction" }, 500);
  }
});

app.post("/transactions/:id/cancel", async (c) => {
  try {
    const auth = await checkAuth(c.req.raw);
    if (isAuthError(auth)) return c.json({ error: auth.error }, 401);
    if (!canCancelQris(auth.role)) return c.json({ error: "Forbidden" }, 403);
    await loadGatewayConfig(auth.supabase);

    const transaction = await getTransactionById(auth.supabase, c.req.param("id"));
    if (!transaction) return c.json({ error: "Payment transaction not found" }, 404);

    const saved = await saveTransaction(auth.supabase, {
      ...transaction,
      status: "cancelled",
      providerStatus: "CANCELED",
      cancelledAt: new Date().toISOString(),
      metadata: {
        ...(transaction.metadata || {}),
        cancelled_by_role: auth.role,
      },
    });

    await syncOrderPaymentState(auth.supabase, saved.orderId);

    return c.json({
      data: saved,
      note:
        transaction.gatewayProvider === "xendit"
          ? "Tagihan ditandai dibatalkan di sistem. Jika provider masih menerima QR lama, webhook akan tetap ditangani secara aman."
          : null,
    });
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to cancel transaction" }, 500);
  }
});

app.post("/webhook/xendit", async (c) => {
  try {
    const supabase = createAdminClient();
    await loadGatewayConfig(supabase);
    const callbackToken = c.req.header("x-callback-token");
    if (XENDIT_WEBHOOK_TOKEN && callbackToken !== XENDIT_WEBHOOK_TOKEN) {
      return c.json({ error: "Invalid callback token" }, 401);
    }

    const payload = await c.req.json();
    await logWebhook(payload);

    const event = payload?.event;
    const data = payload?.data || {};

    const transaction = await findTransactionByProviderReference(
      supabase,
      data.payment_request_id,
      data.reference_id,
    );

    if (!transaction) {
      return c.json({ received: true, ignored: true });
    }

    const nextStatus =
      event === "payment.capture"
        ? "paid"
        : event === "payment.failure"
          ? "failed"
          : mapXenditPaymentRequestStatus(data.status);

    const saved = await saveTransaction(supabase, {
      ...transaction,
      gatewayProvider: "xendit",
      status: nextStatus,
      providerStatus: data.status || event,
      paymentId: data.payment_id || transaction.paymentId,
      paymentRequestId: data.payment_request_id || transaction.paymentRequestId,
      referenceId: data.reference_id || transaction.referenceId,
      amount: Number(data.request_amount || transaction.amount || 0),
      paidAt:
        nextStatus === "paid"
          ? data.updated || payload?.created || new Date().toISOString()
          : transaction.paidAt,
      providerPayload: payload,
      metadata: {
        ...(transaction.metadata || {}),
        last_webhook_event: event,
      },
    });

    await syncOrderPaymentState(supabase, saved.orderId);

    return c.json({ received: true });
  } catch (error: any) {
    return c.json({ error: error.message || "Webhook processing failed" }, 500);
  }
});

export default app;
