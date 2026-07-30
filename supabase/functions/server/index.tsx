import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import permissionsRoute from "./permissions.tsx";
import payrollRoute from "./payroll.tsx";
import paymentsRoute from "./payments.tsx";
import telegramRoute from "./telegram.tsx";
import metaMessagingRoute from "./meta_messaging.tsx";
import googleAdsRoute from "./google_ads.tsx";
import tiktokAdsRoute from "./tiktok_ads.tsx";
import {
  getRequesterAccessContext,
  hasEffectivePermission,
  isOwnerRole,
} from "./requester_access.ts";
import type { PermissionKey } from "../../../src/app/data/permissions.ts";
import {
  fetchAdsDailySnapshots,
  fetchLatestAdsDailySnapshotsBeforeOrOn,
  getLatestAdsSnapshotSyncAt,
  loadInternalAdAccounts,
  upsertAdsDailySnapshots,
  type AdsDailySnapshotRecord,
} from "./ads_snapshot_store.tsx";
import {
  clampNumber,
  diffInDaysInclusive,
  getMaxTimestamp,
  isSyncFresh,
  listDateChunks,
  parseBooleanFlag,
} from "./ads_snapshot_utils.tsx";

const app = new Hono();
const CS_ASSIGNMENT_STATUSES = new Set(["available", "busy", "offline"]);

const normalizeCsAssignmentStatusValue = (value: unknown) => {
  if (typeof value !== "string") return "available";
  const normalized = value.trim().toLowerCase();
  return CS_ASSIGNMENT_STATUSES.has(normalized) ? normalized : "available";
};

const normalizeCsMaxActiveChatsValue = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 25;
  return Math.min(Math.trunc(numeric), 500);
};

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "x-client-token", "X-Client-Token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.route("/make-server-f781cd00/permissions", permissionsRoute);
app.route("/make-server-f781cd00/payroll", payrollRoute);
app.route("/make-server-f781cd00/payments", paymentsRoute);
app.route("/make-server-f781cd00/telegram", telegramRoute);
app.route("/make-server-f781cd00/meta/messaging", metaMessagingRoute);
app.route("/make-server-f781cd00/google", googleAdsRoute);
app.route("/make-server-f781cd00/tiktok", tiktokAdsRoute);

app.get("/make-server-f781cd00/finance/operational-expense-categories", async (c) => {
  const url = new URL(c.req.url);
  const includeInactive = parseBooleanFlag(url.searchParams.get("includeInactive") || url.searchParams.get("include_inactive"));
  const access = includeInactive
    ? await requireOperationalExpensePermission(c, MASTER_DATA_VIEW_PERMISSION, "Anda tidak memiliki akses ke master kategori biaya operasional.")
    : await requireAnyOperationalExpensePermission(c, [OPERATIONAL_EXPENSE_VIEW_PERMISSION, MASTER_DATA_VIEW_PERMISSION]);
  if (access.error) return access.error;

  let query = supabase
    .from("operational_expense_categories")
    .select("id, category, subcategory, account_code, account_type, description, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("category", { ascending: true })
    .order("subcategory", { ascending: true });

  if (!includeInactive) query = query.eq("is_active", true);
  const accountType = normalizeOperationalExpenseText(url.searchParams.get("accountType") || url.searchParams.get("account_type"));
  if (accountType && accountType !== "all") query = query.eq("account_type", accountType);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching operational expense categories:", error);
    return c.json({ error: error.message }, 500);
  }

  return c.json(data || []);
});

app.post("/make-server-f781cd00/finance/operational-expense-categories", async (c) => {
  const access = await requireOperationalExpensePermission(c, MASTER_DATA_CREATE_PERMISSION, "Anda tidak memiliki akses tambah master kategori biaya operasional.");
  if (access.error) return access.error;

  try {
    const body = await c.req.json();
    const payload = buildOperationalExpenseCategoryPayload(body);

    const { data, error } = await supabase
      .from("operational_expense_categories")
      .upsert(payload, { onConflict: "category,subcategory" })
      .select("id, category, subcategory, account_code, account_type, description, sort_order, is_active")
      .single();

    if (error) throw error;
    return c.json({ data }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan kategori biaya operasional";
    console.error("Error creating operational expense category:", error);
    return c.json({ error: message }, 400);
  }
});

app.put("/make-server-f781cd00/finance/operational-expense-categories/:id", async (c) => {
  const access = await requireOperationalExpensePermission(c, MASTER_DATA_EDIT_PERMISSION, "Anda tidak memiliki akses edit master kategori biaya operasional.");
  if (access.error) return access.error;

  try {
    const id = normalizeOperationalExpenseText(c.req.param("id"));
    if (!id) return c.json({ error: "ID kategori biaya operasional wajib diisi" }, 400);

    const body = await c.req.json();
    const payload = buildOperationalExpenseCategoryPayload(body);

    const { data, error } = await supabase
      .from("operational_expense_categories")
      .update(payload)
      .eq("id", id)
      .select("id, category, subcategory, account_code, account_type, description, sort_order, is_active")
      .single();

    if (error) throw error;
    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memperbarui kategori biaya operasional";
    console.error("Error updating operational expense category:", error);
    return c.json({ error: message }, 400);
  }
});

app.delete("/make-server-f781cd00/finance/operational-expense-categories/:id", async (c) => {
  const access = await requireOperationalExpensePermission(c, MASTER_DATA_DELETE_PERMISSION, "Anda tidak memiliki akses hapus master kategori biaya operasional.");
  if (access.error) return access.error;

  try {
    const id = normalizeOperationalExpenseText(c.req.param("id"));
    if (!id) return c.json({ error: "ID kategori biaya operasional wajib diisi" }, 400);

    const { data, error } = await supabase
      .from("operational_expense_categories")
      .update({ is_active: false })
      .eq("id", id)
      .select("id, category, subcategory, account_code, account_type, description, sort_order, is_active")
      .single();

    if (error) throw error;
    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menonaktifkan kategori biaya operasional";
    console.error("Error deleting operational expense category:", error);
    return c.json({ error: message }, 400);
  }
});

app.get("/make-server-f781cd00/finance/recurring-expense-payments", async (c) => {
  const auth = await requireAuthorizedRequester(c, [
    RECURRING_EXPENSE_VIEW_PERMISSION,
    RECURRING_EXPENSE_PAY_PERMISSION,
  ]);
  if (auth.response) return auth.response;

  const url = new URL(c.req.url);
  const periodKey = normalizeOperationalExpenseText(url.searchParams.get("periodKey") || url.searchParams.get("period_key"));
  const recurringExpenseId = normalizeOperationalExpenseText(
    url.searchParams.get("recurringExpenseId") || url.searchParams.get("recurring_expense_id"),
  );
  const status = normalizeOperationalExpenseText(url.searchParams.get("status"));
  const requestedLimit = Number(url.searchParams.get("limit") || 500);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 1000)
    : 500;

  let query = supabase
    .from("recurring_expense_payments")
    .select("*")
    .order("paid_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (periodKey) query = query.eq("period_key", periodKey);
  if (recurringExpenseId) query = query.eq("recurring_expense_id", recurringExpenseId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching recurring expense payments:", error);
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data: data || [] });
});

app.post("/make-server-f781cd00/finance/recurring-expenses/pay", async (c) => {
  const auth = await requireAuthorizedRequester(c, [
    RECURRING_EXPENSE_PAY_PERMISSION,
    OPERATIONAL_EXPENSE_CREATE_PERMISSION,
  ], "all");
  if (auth.response) return auth.response;

  try {
    const body = await c.req.json();
    const amount = Number(body.p_amount ?? body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return c.json({ error: "Nominal pembayaran wajib lebih dari 0." }, 400);
    }

    const params = {
      p_recurring_expense_id: normalizeOperationalExpenseText(body.p_recurring_expense_id || body.recurring_expense_id),
      p_period_key: normalizeOperationalExpenseText(body.p_period_key || body.period_key),
      p_due_date: normalizeOperationalExpenseText(body.p_due_date || body.due_date),
      p_paid_at: normalizeOperationalExpenseText(body.p_paid_at || body.paid_at),
      p_amount: amount,
      p_payment_source: normalizeOperationalExpenseText(body.p_payment_source || body.payment_source),
      p_operational_category: normalizeOperationalExpenseText(body.p_operational_category || body.operational_category),
      p_operational_subcategory: normalizeOperationalExpenseText(body.p_operational_subcategory || body.operational_subcategory),
      p_vendor_name: normalizeOperationalExpenseText(body.p_vendor_name || body.vendor_name),
      p_description: normalizeOperationalExpenseText(body.p_description || body.description),
      p_branch_id: normalizeOperationalExpenseText(body.p_branch_id || body.branch_id),
      p_notes: normalizeOperationalExpenseText(body.p_notes || body.notes),
      p_proof_url: normalizeOperationalExpenseText(body.p_proof_url || body.proof_url),
      p_paid_by: auth.requester?.authUser.id || normalizeOperationalExpenseText(body.p_paid_by || body.paid_by),
      p_paid_by_name: auth.requester?.actorName || normalizeOperationalExpenseText(body.p_paid_by_name || body.paid_by_name || "System"),
    };

    if (!params.p_recurring_expense_id) return c.json({ error: "ID pengeluaran rutin wajib diisi." }, 400);
    if (!/^\d{4}-\d{2}$/.test(params.p_period_key)) return c.json({ error: "Periode pembayaran tidak valid." }, 400);
    if (!isOperationalExpenseDate(params.p_due_date)) return c.json({ error: "Tanggal jatuh tempo tidak valid." }, 400);
    if (!isOperationalExpenseDate(params.p_paid_at)) return c.json({ error: "Tanggal bayar tidak valid." }, 400);
    if (!params.p_operational_category) return c.json({ error: "Kategori biaya operasional wajib diisi." }, 400);
    if (!params.p_operational_subcategory) return c.json({ error: "Subkategori biaya operasional wajib diisi." }, 400);

    const { data, error } = await supabase.rpc("pay_recurring_expense", params);
    if (error) throw error;

    return c.json({ data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mencatat pembayaran rutin";
    console.error("Error paying recurring expense:", error);
    return c.json({ error: message }, 400);
  }
});

app.get("/make-server-f781cd00/finance/operational-expenses", async (c) => {
  const access = await requireOperationalExpensePermission(c, OPERATIONAL_EXPENSE_VIEW_PERMISSION);
  if (access.error) return access.error;

  const url = new URL(c.req.url);
  const page = Math.max(Number(url.searchParams.get("page") || "1"), 1);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || "25"), 1), 200);
  const offset = (page - 1) * limit;

  let query = supabase
    .from("operational_expense_ledger")
    .select("*", { count: "exact" });

  query = applyOperationalExpenseFilters(query, url.searchParams);

  const { data, error, count } = await query
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching operational expenses:", error);
    return c.json({ error: error.message }, 500);
  }

  const total = count || 0;
  return c.json({
    data: data || [],
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

app.get("/make-server-f781cd00/finance/operational-expenses/summary", async (c) => {
  const access = await requireOperationalExpensePermission(c, OPERATIONAL_EXPENSE_VIEW_PERMISSION);
  if (access.error) return access.error;

  const url = new URL(c.req.url);
  let query = supabase
    .from("operational_expense_ledger")
    .select("id, amount, category, subcategory, status");

  query = applyOperationalExpenseFilters(query, url.searchParams);

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching operational expense summary:", error);
    return c.json({ error: error.message }, 500);
  }

  const rows = data || [];
  const totalAmount = rows.reduce((sum, row) => sum + parseOperationalExpenseAmount(row.amount), 0);
  const categoryCount = new Set(rows.map((row) => normalizeOperationalExpenseText(row.category)).filter(Boolean)).size;
  const subcategoryCount = new Set(rows.map((row) => normalizeOperationalExpenseText(row.subcategory)).filter(Boolean)).size;

  return c.json({
    totalAmount,
    transactionCount: rows.length,
    averageAmount: rows.length > 0 ? totalAmount / rows.length : 0,
    categoryCount,
    subcategoryCount,
  });
});

app.post("/make-server-f781cd00/finance/operational-expenses", async (c) => {
  const access = await requireOperationalExpensePermission(c, OPERATIONAL_EXPENSE_CREATE_PERMISSION);
  if (access.error) return access.error;

  try {
    const body = await c.req.json();
    const payload = await buildOperationalExpensePayload(body);

    const { data, error } = await supabase
      .from("operational_expense_ledger")
      .insert({
        ...payload,
        status: "active",
        created_by: access.requester?.authUser.id,
        created_by_name: access.requester?.actorName || "System",
        updated_by: access.requester?.authUser.id,
        updated_by_name: access.requester?.actorName || "System",
      })
      .select()
      .single();

    if (error) throw error;
    return c.json({ data }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menyimpan biaya operasional";
    console.error("Error creating operational expense:", error);
    return c.json({ error: message }, 400);
  }
});

app.put("/make-server-f781cd00/finance/operational-expenses/:id", async (c) => {
  const access = await requireOperationalExpensePermission(c, OPERATIONAL_EXPENSE_EDIT_PERMISSION);
  if (access.error) return access.error;

  try {
    const id = normalizeOperationalExpenseText(c.req.param("id"));
    if (!id) return c.json({ error: "ID biaya operasional wajib diisi" }, 400);

    const body = await c.req.json();
    const payload = await buildOperationalExpensePayload(body);

    const { data, error } = await supabase
      .from("operational_expense_ledger")
      .update({
        ...payload,
        updated_by: access.requester?.authUser.id,
        updated_by_name: access.requester?.actorName || "System",
      })
      .eq("id", id)
      .eq("status", "active")
      .select()
      .single();

    if (error) throw error;
    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memperbarui biaya operasional";
    console.error("Error updating operational expense:", error);
    return c.json({ error: message }, 400);
  }
});

app.delete("/make-server-f781cd00/finance/operational-expenses/:id", async (c) => {
  const access = await requireOperationalExpensePermission(c, OPERATIONAL_EXPENSE_DELETE_PERMISSION);
  if (access.error) return access.error;

  try {
    const id = normalizeOperationalExpenseText(c.req.param("id"));
    if (!id) return c.json({ error: "ID biaya operasional wajib diisi" }, 400);

    const body = await c.req.json().catch(() => ({}));
    const reason = normalizeOperationalExpenseText(body.reason || body.void_reason);

    const { data, error } = await supabase
      .from("operational_expense_ledger")
      .update({
        status: "void",
        void_reason: reason,
        voided_at: new Date().toISOString(),
        voided_by: access.requester?.authUser.id,
        updated_by: access.requester?.authUser.id,
        updated_by_name: access.requester?.actorName || "System",
      })
      .eq("id", id)
      .eq("status", "active")
      .select()
      .single();

    if (error) throw error;
    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal void biaya operasional";
    console.error("Error voiding operational expense:", error);
    return c.json({ error: message }, 400);
  }
});

// Initialize Supabase Admin Client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
const authSupabase = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey);

// Ensure Storage Bucket Exists
async function ensureBucket(bucketName: string) {
  if (!supabaseServiceKey) {
    console.log(`Skipping bucket check for ${bucketName}: SUPABASE_SERVICE_ROLE_KEY is not configured.`);
    return;
  }
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === bucketName);
    
    if (!bucketExists) {
        console.log(`Creating bucket: ${bucketName}`);
        await supabase.storage.createBucket(bucketName, {
            public: false, // Private by default as per instructions
            fileSizeLimit: 10485760, // 10MB
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
        });
    }
  } catch (e) {
      console.error("Error ensuring bucket:", e);
  }
}

// Initialize Bucket
ensureBucket("make-f781cd00");

const PROOF_ASSETS_BUCKET = "proof-assets";
const PROOF_ASSET_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function sanitizeUploadFileName(fileName: string) {
  return (fileName || "image.jpg")
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 120) || "image.jpg";
}

async function ensureProofAssetsBucket() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi untuk upload aset.");
  }

  const options = {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: Array.from(PROOF_ASSET_ALLOWED_MIME_TYPES),
  };
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  const bucketExists = buckets?.some((bucket) => bucket.name === PROOF_ASSETS_BUCKET);
  if (!bucketExists) {
    const { error } = await supabase.storage.createBucket(PROOF_ASSETS_BUCKET, options);
    if (error) throw error;
    return;
  }

  await supabase.storage.updateBucket(PROOF_ASSETS_BUCKET, options).catch(() => undefined);
}

async function uploadProofAssetFile(file: File, userId: string) {
  const mimeType = file.type || "application/octet-stream";
  if (!PROOF_ASSET_ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Gambar harus JPG, PNG, atau WebP.");
  }

  await ensureProofAssetsBucket();

  const safeName = sanitizeUploadFileName(file.name || "proof-asset.jpg");
  const objectPath = [
    userId || "system",
    new Date().toISOString().slice(0, 10),
    `${Date.now()}-${crypto.randomUUID()}-${safeName}`,
  ].join("/");
  const uploadBody = new Blob([await file.arrayBuffer()], { type: mimeType });
  const { error } = await supabase.storage
    .from(PROOF_ASSETS_BUCKET)
    .upload(objectPath, uploadBody, {
      contentType: mimeType,
      upsert: false,
    });
  if (error) throw error;

  const { data } = supabase.storage.from(PROOF_ASSETS_BUCKET).getPublicUrl(objectPath);
  return {
    url: data.publicUrl,
    path: objectPath,
    bucket: PROOF_ASSETS_BUCKET,
    size: file.size,
    mimeType,
  };
}

// Helper to log activity
async function logActivity(user: string, action: string, detail: string, ip: string) {
  const timestamp = Date.now();
  const key = `audit:${timestamp}:${Math.random().toString(36).substring(7)}`;
  const entry = {
    time: new Date(timestamp).toISOString(),
    user,
    action,
    detail,
    ip,
    type: action.toLowerCase().includes('delete') ? 'red' : action.toLowerCase().includes('create') || action.toLowerCase().includes('add') ? 'green' : 'blue' 
  };
  await kv.set(key, entry);
}

function runBackgroundTask(label: string, task: Promise<unknown>) {
  const guardedTask = task.catch((error) => {
    console.warn(`[BackgroundTask] ${label} failed:`, error?.message || error);
  });

  const edgeRuntime = (globalThis as unknown as {
    EdgeRuntime?: { waitUntil?: (task: Promise<unknown>) => void };
  }).EdgeRuntime;

  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(guardedTask);
    return;
  }

  void guardedTask;
}

// Helper to get actor name from token
async function getActorName(authHeader?: string, clientTokenHeader?: string) {
    const token = clientTokenHeader?.trim()
      ? clientTokenHeader.trim()
      : authHeader?.startsWith("Bearer ")
        ? authHeader.split(' ')[1]
        : "";
    if (!token) return "System";
    const { data: { user } } = await supabase.auth.getUser(token);
    return user?.user_metadata?.name || user?.email || "System";
}

const OPERATIONAL_EXPENSE_VIEW_PERMISSION: PermissionKey = "operational_expenses.view";
const OPERATIONAL_EXPENSE_CREATE_PERMISSION: PermissionKey = "operational_expenses.create";
const OPERATIONAL_EXPENSE_EDIT_PERMISSION: PermissionKey = "operational_expenses.edit";
const OPERATIONAL_EXPENSE_DELETE_PERMISSION: PermissionKey = "operational_expenses.delete";
const RECURRING_EXPENSE_VIEW_PERMISSION: PermissionKey = "recurring_expenses.view";
const RECURRING_EXPENSE_PAY_PERMISSION: PermissionKey = "recurring_expenses.pay";
const MASTER_DATA_VIEW_PERMISSION: PermissionKey = "master_data.view";
const MASTER_DATA_CREATE_PERMISSION: PermissionKey = "master_data.create";
const MASTER_DATA_EDIT_PERMISSION: PermissionKey = "master_data.edit";
const MASTER_DATA_DELETE_PERMISSION: PermissionKey = "master_data.delete";

function normalizeOperationalExpenseText(value: unknown) {
  return String(value || "").trim();
}

function parseOperationalExpenseAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function isOperationalExpenseDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function requireOperationalExpensePermission(c: any, permission: PermissionKey, forbiddenMessage = "Anda tidak memiliki akses ke Biaya Operasional.") {
  const requester = await getRequesterAccessContext(c.req.raw.headers);
  if (!requester) {
    return {
      error: c.json({ error: "Session login tidak valid. Silakan login ulang." }, 401),
      requester: null,
    };
  }

  if (!hasEffectivePermission(requester, permission)) {
    return {
      error: c.json({ error: forbiddenMessage }, 403),
      requester,
    };
  }

  return { error: null, requester };
}

async function requireAnyOperationalExpensePermission(c: any, permissions: PermissionKey[]) {
  const requester = await getRequesterAccessContext(c.req.raw.headers);
  if (!requester) {
    return {
      error: c.json({ error: "Session login tidak valid. Silakan login ulang." }, 401),
      requester: null,
    };
  }

  if (!permissions.some((permission) => hasEffectivePermission(requester, permission))) {
    return {
      error: c.json({ error: "Anda tidak memiliki akses ke Biaya Operasional." }, 403),
      requester,
    };
  }

  return { error: null, requester };
}

function buildOperationalExpenseCategoryPayload(body: Record<string, unknown>) {
  const category = normalizeOperationalExpenseText(body.category);
  const subcategory = normalizeOperationalExpenseText(body.subcategory);

  if (!category) throw new Error("Kategori biaya operasional wajib diisi");
  if (!subcategory) throw new Error("Subkategori biaya operasional wajib diisi");

  const sortOrder = Number(body.sort_order ?? body.sortOrder ?? 0);
  const accountType = normalizeOperationalExpenseText(body.account_type || body.accountType || "expense");
  if (!["income", "expense", "cogs"].includes(accountType)) {
    throw new Error("Tipe akun harus income, expense, atau cogs");
  }

  return {
    category,
    subcategory,
    account_code: normalizeOperationalExpenseText(body.account_code || body.accountCode || body.code),
    account_type: accountType,
    description: normalizeOperationalExpenseText(body.description),
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    is_active: typeof body.is_active === "boolean"
      ? body.is_active
      : typeof body.isActive === "boolean"
        ? body.isActive
        : true,
  };
}

async function resolveOperationalExpenseBranch(branchId: string) {
  if (!branchId) {
    return { branchId: null, branchName: "" };
  }

  const { data, error } = await supabase
    .from("branches")
    .select("id, name")
    .eq("id", branchId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error("Cabang biaya operasional tidak ditemukan");

  return { branchId: data.id, branchName: normalizeOperationalExpenseText(data.name) };
}

async function buildOperationalExpensePayload(body: Record<string, unknown>) {
  const expenseDate = normalizeOperationalExpenseText(body.expense_date || body.expenseDate || body.date);
  if (!expenseDate || !isOperationalExpenseDate(expenseDate)) {
    throw new Error("Tanggal biaya operasional wajib diisi dengan format YYYY-MM-DD");
  }

  const category = normalizeOperationalExpenseText(body.category);
  if (!category) throw new Error("Kategori biaya operasional wajib diisi");

  const subcategory = normalizeOperationalExpenseText(body.subcategory);
  const amount = parseOperationalExpenseAmount(body.amount);
  if (amount <= 0) throw new Error("Nominal biaya operasional wajib lebih besar dari 0");

  const branch = await resolveOperationalExpenseBranch(
    normalizeOperationalExpenseText(body.branch_id || body.branchId),
  );

  return {
    expense_date: expenseDate,
    period_key: expenseDate.slice(0, 7),
    branch_id: branch.branchId,
    branch_name: branch.branchName,
    category,
    subcategory,
    vendor_name: normalizeOperationalExpenseText(body.vendor_name || body.vendorName),
    description: normalizeOperationalExpenseText(body.description),
    amount,
    currency: normalizeOperationalExpenseText(body.currency) || "IDR",
    payment_source: normalizeOperationalExpenseText(body.payment_source || body.paymentSource),
    source_type: normalizeOperationalExpenseText(body.source_type || body.sourceType) || "manual",
    source_ref: normalizeOperationalExpenseText(body.source_ref || body.sourceRef),
    notes: normalizeOperationalExpenseText(body.notes),
  };
}

function applyOperationalExpenseFilters(query: any, params: URLSearchParams) {
  const branchId = normalizeOperationalExpenseText(params.get("branch_id") || params.get("branchId"));
  const category = normalizeOperationalExpenseText(params.get("category"));
  const subcategory = normalizeOperationalExpenseText(params.get("subcategory"));
  const status = normalizeOperationalExpenseText(params.get("status") || "active");
  const startDate = normalizeOperationalExpenseText(params.get("startDate") || params.get("start_date"));
  const endDate = normalizeOperationalExpenseText(params.get("endDate") || params.get("end_date"));
  const q = normalizeOperationalExpenseText(params.get("q"));

  if (branchId && branchId !== "all") query = query.eq("branch_id", branchId);
  if (category && category !== "all") query = query.eq("category", category);
  if (subcategory && subcategory !== "all") query = query.eq("subcategory", subcategory);
  if (status && status !== "all") query = query.eq("status", status);
  if (startDate) query = query.gte("expense_date", startDate);
  if (endDate) query = query.lte("expense_date", endDate);
  if (q) {
    const escaped = q.replace(/[%_,]/g, "");
    query = query.or(
      `description.ilike.%${escaped}%,vendor_name.ilike.%${escaped}%,category.ilike.%${escaped}%,subcategory.ilike.%${escaped}%,payment_source.ilike.%${escaped}%,source_ref.ilike.%${escaped}%,notes.ilike.%${escaped}%`,
    );
  }

  return query;
}

const META_GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION")?.trim() || "v23.0";
const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN")?.trim() || "";
const META_DM_USER_TOKEN = Deno.env.get("META_DM_USER_TOKEN")?.trim() || "";
const META_APP_ID = Deno.env.get("META_APP_ID")?.trim() || "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET")?.trim() || "";
const META_BATCH_SIZE = Math.min(50, Math.max(1, Number(Deno.env.get("META_BATCH_SIZE") || "50")));

type MetaBusinessRecord = {
  id: string;
  name: string;
  verification_status?: string;
};

type MetaAdAccountRecord = {
  id: string;
  account_id?: string;
  name?: string;
  account_status?: number | string;
  currency?: string;
  business?: {
    id?: string;
    name?: string;
  } | null;
};

type MetaInsightsRow = {
  account_id?: string;
  account_name?: string;
  spend?: string | number;
  clicks?: string | number;
  cpc?: string | number;
  ctr?: string | number;
  cpm?: string | number;
  cpp?: string | number;
  reach?: string | number;
  impressions?: string | number;
  actions?: Array<{ action_type?: string; value?: string | number }>;
  cost_per_action_type?: Array<{ action_type?: string; value?: string | number }>;
  date_start?: string;
  date_stop?: string;
};

function ensureMetaConfigured(accessToken = META_ACCESS_TOKEN) {
  if (!accessToken) {
    throw new Error("Token Meta belum dikonfigurasi di server.");
  }
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const META_MESSAGING_RESULT_ACTION_PRIORITY = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.messaging_conversation_started",
  "messaging_conversation_started_7d",
  "messaging_conversation_started",
];

function normalizeMetaActionType(actionType: string) {
  return actionType.trim().toLowerCase();
}

function findMetaMessagingResultAction(actions?: Array<{ action_type?: string; value?: string | number }>) {
  if (!Array.isArray(actions)) return null;

  const normalizedActions = actions.map((action) => ({
    action,
    type: normalizeMetaActionType(String(action.action_type || "")),
  }));

  for (const resultActionType of META_MESSAGING_RESULT_ACTION_PRIORITY) {
    const matchedAction = normalizedActions.find((item) => item.type === resultActionType);
    if (matchedAction) return matchedAction.action;
  }

  return null;
}

function extractMetaMessagingResultValue(actions?: Array<{ action_type?: string; value?: string | number }>) {
  return toNumber(findMetaMessagingResultAction(actions)?.value);
}

function extractMetaMessagingResultCost(actions?: Array<{ action_type?: string; value?: string | number }>) {
  const resultAction = findMetaMessagingResultAction(actions);
  return resultAction ? toNumber(resultAction.value) : null;
}

function isValidDateParam(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function splitIntoChunks<T>(items: T[], chunkSize: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    result.push(items.slice(index, index + chunkSize));
  }
  return result;
}

async function createAppSecretProof(accessToken: string) {
  if (!META_APP_SECRET) return null;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(META_APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(accessToken));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function getMetaAuthParams(accessToken = META_ACCESS_TOKEN) {
  ensureMetaConfigured(accessToken);

  const params = new URLSearchParams({
    access_token: accessToken,
  });

  const appSecretProof = await createAppSecretProof(accessToken);
  if (appSecretProof) {
    params.set("appsecret_proof", appSecretProof);
  }

  return params;
}

async function fetchMetaJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.error) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `Meta Graph API error (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

async function fetchMetaPaged<T>(
  path: string,
  params: Record<string, string>,
  accessToken = META_ACCESS_TOKEN,
) {
  const authParams = await getMetaAuthParams(accessToken);
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  authParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const rows: T[] = [];
  let nextUrl: string | null = url.toString();

  while (nextUrl) {
    const payload = await fetchMetaJson(nextUrl);
    if (Array.isArray(payload?.data)) {
      rows.push(...payload.data);
    }
    nextUrl = payload?.paging?.next || null;
  }

  return rows;
}

async function fetchMetaInsightsBatch(
  accounts: MetaAdAccountRecord[],
  from: string,
  to: string,
  accessToken = META_ACCESS_TOKEN,
) {
  const authParams = await getMetaAuthParams(accessToken);
  const insightsByAccountId = new Map<string, { metrics: MetaInsightsRow | null; error: string | null }>();
  const chunks = splitIntoChunks(accounts, META_BATCH_SIZE);

  for (const chunk of chunks) {
    const batch = chunk.map((account) => {
      const params = new URLSearchParams({
        fields: "account_id,account_name,spend,clicks,cpc,ctr,cpm,cpp,reach,impressions,actions,cost_per_action_type,date_start,date_stop",
        level: "account",
        time_range: JSON.stringify({ since: from, until: to }),
        limit: "1",
      });

      return {
        method: "GET",
        relative_url: `${account.id}/insights?${params.toString()}`,
      };
    });

    const body = new URLSearchParams({
      batch: JSON.stringify(batch),
    });
    authParams.forEach((value, key) => {
      body.set(key, value);
    });

    const payload = await fetchMetaJson(`https://graph.facebook.com/${META_GRAPH_VERSION}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const responses = Array.isArray(payload) ? payload : [];

    chunk.forEach((account, index) => {
      const response = responses[index];
      if (!response) {
        insightsByAccountId.set(account.id, {
          metrics: null,
          error: "Meta batch response missing",
        });
        return;
      }

      if (response.code !== 200) {
        insightsByAccountId.set(account.id, {
          metrics: null,
          error: `Meta batch error (${response.code})`,
        });
        return;
      }

      const parsedBody = JSON.parse(response.body || "{}");
      const metrics = Array.isArray(parsedBody?.data) && parsedBody.data.length > 0 ? parsedBody.data[0] : null;

      insightsByAccountId.set(account.id, {
        metrics,
        error: parsedBody?.error?.message || null,
      });
    });
  }

  return insightsByAccountId;
}

async function fetchMetaDailyInsightsBatch(
  accounts: MetaAdAccountRecord[],
  from: string,
  to: string,
  accessToken = META_ACCESS_TOKEN,
) {
  const authParams = await getMetaAuthParams(accessToken);
  const insightsByAccountId = new Map<string, { metrics: MetaInsightsRow[]; error: string | null }>();
  const chunks = splitIntoChunks(accounts, META_BATCH_SIZE);

  for (const chunk of chunks) {
    const batch = chunk.map((account) => {
      const params = new URLSearchParams({
        fields: "account_id,account_name,spend,clicks,cpc,ctr,cpm,cpp,reach,impressions,actions,cost_per_action_type,date_start,date_stop",
        level: "account",
        time_increment: "1",
        time_range: JSON.stringify({ since: from, until: to }),
        limit: "500",
      });

      return {
        method: "GET",
        relative_url: `${account.id}/insights?${params.toString()}`,
      };
    });

    const body = new URLSearchParams({
      batch: JSON.stringify(batch),
    });
    authParams.forEach((value, key) => {
      body.set(key, value);
    });

    const payload = await fetchMetaJson(`https://graph.facebook.com/${META_GRAPH_VERSION}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const responses = Array.isArray(payload) ? payload : [];

    chunk.forEach((account, index) => {
      const response = responses[index];
      if (!response) {
        insightsByAccountId.set(account.id, {
          metrics: [],
          error: "Meta batch response missing",
        });
        return;
      }

      if (response.code !== 200) {
        insightsByAccountId.set(account.id, {
          metrics: [],
          error: `Meta batch error (${response.code})`,
        });
        return;
      }

      const parsedBody = JSON.parse(response.body || "{}");
      const metrics = Array.isArray(parsedBody?.data) ? parsedBody.data : [];

      insightsByAccountId.set(account.id, {
        metrics,
        error: parsedBody?.error?.message || null,
      });
    });
  }

  return insightsByAccountId;
}

type MetaRegistryTokenCandidate = {
  accessToken: string;
  source: "runtime-system" | "dm-user";
};

type MetaRegistrySnapshot = {
  source: MetaRegistryTokenCandidate["source"];
  accessToken: string;
  businesses: MetaBusinessRecord[];
  accounts: MetaAdAccountRecord[];
};

type MetaIntegrationConfigRecord = {
  adAccountId: string;
  enabled: boolean;
  businessManagerId?: string;
  businessManagerName?: string;
  liveMetaAccountId?: string;
  liveMetaAccountName?: string;
};

function isNonNull<T>(value: T | null): value is T {
  return value !== null;
}

function getMetaRegistryTokenCandidates() {
  const seen = new Set<string>();
  const candidates: MetaRegistryTokenCandidate[] = [];

  for (const candidate of [
    { accessToken: META_ACCESS_TOKEN, source: "runtime-system" as const },
    { accessToken: META_DM_USER_TOKEN, source: "dm-user" as const },
  ]) {
    const token = candidate.accessToken.trim();
    if (!token || seen.has(token)) continue;
    seen.add(token);
    candidates.push({ ...candidate, accessToken: token });
  }

  return candidates;
}

async function resolveBestMetaRegistrySnapshot() {
  const candidates = getMetaRegistryTokenCandidates();
  if (candidates.length === 0) {
    throw new Error("META_ACCESS_TOKEN atau META_DM_USER_TOKEN belum dikonfigurasi di server.");
  }

  let bestSnapshot: MetaRegistrySnapshot | null = null;
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      const [businesses, accounts] = await Promise.all([
        fetchMetaPaged<MetaBusinessRecord>(
          "/me/businesses",
          {
            fields: "id,name,verification_status",
            limit: "200",
          },
          candidate.accessToken,
        ),
        fetchMetaPaged<MetaAdAccountRecord>(
          "/me/adaccounts",
          {
            fields: "id,account_id,name,account_status,currency,business{id,name}",
            limit: "500",
          },
          candidate.accessToken,
        ),
      ]);

      const snapshot: MetaRegistrySnapshot = {
        source: candidate.source,
        accessToken: candidate.accessToken,
        businesses,
        accounts,
      };

      if (!bestSnapshot) {
        bestSnapshot = snapshot;
        continue;
      }

      const bestScore = bestSnapshot.accounts.length * 1000 + bestSnapshot.businesses.length;
      const nextScore = snapshot.accounts.length * 1000 + snapshot.businesses.length;
      if (nextScore > bestScore) {
        bestSnapshot = snapshot;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Gagal membaca registry Meta.");
    }
  }

  if (!bestSnapshot) {
    throw lastError || new Error("Tidak ada token Meta yang berhasil membaca registry.");
  }

  return bestSnapshot;
}

async function debugMetaToken() {
  ensureMetaConfigured();

  if (!META_APP_ID || !META_APP_SECRET) {
    throw new Error("META_APP_ID atau META_APP_SECRET belum diatur di server.");
  }

  const appAccessToken = `${META_APP_ID}|${META_APP_SECRET}`;
  const url = new URL("https://graph.facebook.com/debug_token");
  url.searchParams.set("input_token", META_ACCESS_TOKEN);
  url.searchParams.set("access_token", appAccessToken);

  return fetchMetaJson(url.toString());
}

async function requireAuthenticatedUser(c: any) {
  const clientTokenHeader = c.req.header("x-client-token");
  const authHeader = c.req.header("Authorization");
  const token = clientTokenHeader?.trim()
    ? clientTokenHeader.trim()
    : authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

  if (!token) {
    return null;
  }

  const { data, error } = await authSupabase.auth.getUser(token);
  if (error || !data?.user) {
    return null;
  }

  return data.user;
}

async function requireAuthorizedRequester(
  c: any,
  permissions?: readonly PermissionKey[],
  mode: "any" | "all" = "any",
) {
  const requester = await getRequesterAccessContext(c.req.raw.headers);

  if (!requester) {
    return { requester: null, response: c.json({ error: "Unauthorized" }, 401) };
  }

  if (permissions?.length) {
    const hasAccess =
      mode === "all"
        ? permissions.every((permission) => hasEffectivePermission(requester, permission))
        : permissions.some((permission) => hasEffectivePermission(requester, permission));

    if (!hasAccess) {
      return { requester: null, response: c.json({ error: "Forbidden" }, 403) };
    }
  }

  return { requester, response: null };
}

function requesterHasAnyPermission(
  requester: Awaited<ReturnType<typeof getRequesterAccessContext>> | null,
  permissions: readonly PermissionKey[],
) {
  if (!requester) return false;
  return permissions.some((permission) => hasEffectivePermission(requester, permission));
}

function requesterCanViewOwnTechnicianSurface(
  requester: Awaited<ReturnType<typeof getRequesterAccessContext>> | null,
  userId: string,
) {
  if (!requester) return false;
  return requester.authUser.id === userId && hasEffectivePermission(requester, "teknisi.view_mobile");
}

function requesterCanManageTechnicianAttendance(
  requester: Awaited<ReturnType<typeof getRequesterAccessContext>> | null,
) {
  return requesterHasAnyPermission(requester, ["monitoring.activity_view", "technician_schedule.manage"]);
}

function requesterCanReadShift(
  requester: Awaited<ReturnType<typeof getRequesterAccessContext>> | null,
  userId: string,
) {
  return (
    requesterCanViewOwnTechnicianSurface(requester, userId) ||
    requesterCanManageTechnicianAttendance(requester)
  );
}

function requesterCanWriteShift(
  requester: Awaited<ReturnType<typeof getRequesterAccessContext>> | null,
  userId: string,
) {
  return (
    requesterCanViewOwnTechnicianSurface(requester, userId) ||
    requesterCanManageTechnicianAttendance(requester)
  );
}

function requesterCanResetShift(
  requester: Awaited<ReturnType<typeof getRequesterAccessContext>> | null,
) {
  return requesterCanManageTechnicianAttendance(requester);
}

function requesterCanReadTechnicianOrders(
  requester: Awaited<ReturnType<typeof getRequesterAccessContext>> | null,
  userId: string,
) {
  return (
    requesterCanViewOwnTechnicianSurface(requester, userId) ||
    requesterCanManageTechnicianAttendance(requester)
  );
}

async function readJsonBody(c: any) {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

function toInteger(value: unknown) {
  return Math.trunc(toNumber(value));
}

async function loadMetaIntegrationConfigMap() {
  const configs = (await kv.getByPrefix("meta_integration_config:")) as MetaIntegrationConfigRecord[];
  const mapped = new Map<string, MetaIntegrationConfigRecord>();

  for (const config of configs) {
    const accountId = config?.liveMetaAccountId?.trim();
    if (!accountId || !config?.adAccountId) continue;
    mapped.set(accountId, config);
  }

  return mapped;
}

async function loadMetaIntegrationConfigs() {
  return (await kv.getByPrefix("meta_integration_config:")) as MetaIntegrationConfigRecord[];
}

function buildMetaExternalAccountIdVariants(value?: string | null) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return [];

  const withoutPrefix = trimmed.replace(/^act_/i, "");
  return Array.from(new Set([trimmed, withoutPrefix, `act_${withoutPrefix}`].filter(Boolean)));
}

async function syncMetaSnapshotRange(params: {
  from: string;
  to: string;
  requestedBusinessId?: string;
  requestedAccountId?: string;
  force?: boolean;
  minFreshMinutes?: number;
}) {
  const latestSyncedAt = await getLatestAdsSnapshotSyncAt({
    platformKey: "meta",
    from: params.from,
    to: params.to,
  });

  if (!params.force && isSyncFresh(latestSyncedAt, params.minFreshMinutes || 0)) {
    const rows = await fetchAdsDailySnapshots({
      platformKey: "meta",
      from: params.from,
      to: params.to,
    });

    return {
      rows,
      latestSyncedAt: latestSyncedAt || getMaxTimestamp(rows),
      upsertedCount: 0,
      servedFrom: "database-fresh",
      skippedSync: true,
    };
  }

  const registrySnapshot = await resolveBestMetaRegistrySnapshot();
  const filteredAccounts = registrySnapshot.accounts.filter((account) => {
    if (params.requestedBusinessId && account.business?.id !== params.requestedBusinessId) {
      return false;
    }
    if (params.requestedAccountId && account.id !== params.requestedAccountId) {
      return false;
    }
    return true;
  });

  const [internalAccounts, integrationConfigByAccountId] = await Promise.all([
    loadInternalAdAccounts(),
    loadMetaIntegrationConfigMap(),
  ]);
  const internalAccountById = new Map(
    internalAccounts.map((account) => [account.id, account]),
  );

  let upsertedCount = 0;
  for (const chunk of listDateChunks(params.from, params.to, 31)) {
    const insightMap = await fetchMetaDailyInsightsBatch(
      filteredAccounts,
      chunk.from,
      chunk.to,
      registrySnapshot.accessToken,
    );

    const chunkRecords: AdsDailySnapshotRecord[] = filteredAccounts.flatMap((account) => {
      const insight = insightMap.get(account.id);
      const metricsRows = insight?.metrics || [];

      const records: Array<AdsDailySnapshotRecord | null> = metricsRows
        .map((metrics) => {
          const snapshotDate = metrics?.date_start || metrics?.date_stop;
          if (!snapshotDate) return null;

          const integrationConfig = integrationConfigByAccountId.get(account.id);
          const internalAccount = integrationConfig?.adAccountId
            ? internalAccountById.get(integrationConfig.adAccountId)
            : null;
          const spend = toNumber(metrics?.spend);
          const dashboardResultCost = extractMetaMessagingResultCost(metrics?.cost_per_action_type);
          const dashboardResultValue = extractMetaMessagingResultValue(metrics?.actions);
          const conversions =
            dashboardResultValue > 0
              ? dashboardResultValue
              : dashboardResultCost && dashboardResultCost > 0
                ? Math.round(spend / dashboardResultCost)
                : 0;
          const costPerConversion =
            dashboardResultCost ||
            (conversions > 0 ? spend / conversions : null);

          return {
            platformKey: "meta",
            snapshotDate,
            internalAdAccountId: integrationConfig?.adAccountId || null,
            advertiserId: internalAccount?.advertiserId || null,
            platformId: internalAccount?.platformId || null,
            externalAccountId: account.id,
            externalAccountName: account.name || metrics?.account_name || account.id,
            externalGroupId: account.business?.id || null,
            externalGroupName: account.business?.name || "Tanpa Business Manager",
            externalAccountStatus:
              account.account_status != null ? String(account.account_status) : null,
            currencyCode: account.currency || "IDR",
            spend,
            clicks: toNumber(metrics?.clicks),
            impressions: toNumber(metrics?.impressions),
            reach: toNumber(metrics?.reach),
            conversions,
            ctr: metrics?.ctr != null ? toNumber(metrics.ctr) : null,
            cpc: metrics?.cpc != null ? toNumber(metrics.cpc) : null,
            cpm: metrics?.cpm != null ? toNumber(metrics.cpm) : null,
            costPerConversion,
            error: insight?.error || null,
          } satisfies AdsDailySnapshotRecord;
        });

      return records.filter(isNonNull);
    });

    if (chunkRecords.length === 0) continue;
    const chunkResult = await upsertAdsDailySnapshots(chunkRecords);
    upsertedCount += chunkResult.upsertedCount;
  }

  const rows = await fetchAdsDailySnapshots({
    platformKey: "meta",
    from: params.from,
    to: params.to,
  });

  return {
    rows,
    latestSyncedAt: getMaxTimestamp(rows),
    upsertedCount,
    servedFrom: "meta-live",
    skippedSync: false,
  };
}

// Health check endpoint
app.get("/make-server-f781cd00/health", (c) => {
  return c.json({ status: "ok" });
});

app.get("/make-server-f781cd00/meta/live-breakdown", async (c) => {
  try {
    const user = await requireAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!META_ACCESS_TOKEN && !META_DM_USER_TOKEN) {
      return c.json({ error: "META_ACCESS_TOKEN atau META_DM_USER_TOKEN belum diatur di server." }, 503);
    }

    const from = c.req.query("from");
    const to = c.req.query("to");
    const requestedBusinessId = c.req.query("businessId");
    const requestedAccountId = c.req.query("accountId");

    if (!isValidDateParam(from) || !isValidDateParam(to)) {
      return c.json({ error: "Parameter from/to wajib format YYYY-MM-DD." }, 400);
    }

    const registrySnapshot = await resolveBestMetaRegistrySnapshot();
    const businesses = registrySnapshot.businesses;
    const allAccounts = registrySnapshot.accounts;

    const filteredAccounts = allAccounts.filter((account) => {
      if (requestedBusinessId && account.business?.id !== requestedBusinessId) return false;
      if (requestedAccountId && account.id !== requestedAccountId) return false;
      return true;
    });

    const insightMap = await fetchMetaInsightsBatch(
      filteredAccounts,
      from!,
      to!,
      registrySnapshot.accessToken,
    );

    const accountSnapshots = filteredAccounts.map((account) => {
      const insight = insightMap.get(account.id);
      const metrics = insight?.metrics;
      const spend = toNumber(metrics?.spend);
      const clicks = toNumber(metrics?.clicks);
      const impressions = toNumber(metrics?.impressions);
      const reach = toNumber(metrics?.reach);
      const cpc = metrics?.cpc != null ? toNumber(metrics.cpc) : null;
      const ctr = metrics?.ctr != null ? toNumber(metrics.ctr) : null;
      const cpm = metrics?.cpm != null ? toNumber(metrics.cpm) : null;
      const cpp = metrics?.cpp != null ? toNumber(metrics.cpp) : null;

      return {
        id: account.id,
        accountId: account.account_id || account.id.replace(/^act_/, ""),
        name: account.name || metrics?.account_name || account.id,
        businessId: account.business?.id || null,
        businessName: account.business?.name || "Tanpa BM",
        accountStatus: account.account_status != null ? Number(account.account_status) : null,
        currency: account.currency || "IDR",
        spend,
        clicks,
        impressions,
        reach,
        cpc,
        ctr,
        cpm,
        cpp,
        dateStart: metrics?.date_start || from,
        dateStop: metrics?.date_stop || to,
        error: insight?.error || null,
      };
    });

    const businessSummaryMap = new Map(
      businesses.map((business) => [
        business.id,
        {
          id: business.id,
          name: business.name,
          verificationStatus: business.verification_status || "unknown",
          accountCount: 0,
          spend: 0,
          clicks: 0,
          impressions: 0,
          reach: 0,
        },
      ]),
    );

    for (const account of accountSnapshots) {
      if (!account.businessId) continue;

      const business =
        businessSummaryMap.get(account.businessId) ||
        {
          id: account.businessId,
          name: account.businessName,
          verificationStatus: "unknown",
          accountCount: 0,
          spend: 0,
          clicks: 0,
          impressions: 0,
          reach: 0,
        };

      business.accountCount += 1;
      business.spend += account.spend;
      business.clicks += account.clicks;
      business.impressions += account.impressions;
      business.reach += account.reach;
      businessSummaryMap.set(account.businessId, business);
    }

    const businessSnapshots = Array.from(businessSummaryMap.values()).sort((left, right) => {
      if (right.spend !== left.spend) return right.spend - left.spend;
      return left.name.localeCompare(right.name);
    });

    const summary = accountSnapshots.reduce(
      (acc, account) => {
        acc.accountCount += 1;
        acc.businessCount = businessSnapshots.length;
        acc.spend += account.spend;
        acc.clicks += account.clicks;
        acc.impressions += account.impressions;
        acc.reach += account.reach;
        return acc;
      },
      {
        businessCount: businessSnapshots.length,
        accountCount: 0,
        spend: 0,
        clicks: 0,
        impressions: 0,
        reach: 0,
      },
    );

    return c.json({
      source: "meta-live",
      generatedAt: new Date().toISOString(),
      requestedBy: user.id,
      range: {
        from,
        to,
      },
      businesses: businessSnapshots,
      accounts: accountSnapshots.sort((left, right) => {
        if (right.spend !== left.spend) return right.spend - left.spend;
        return left.name.localeCompare(right.name);
      }),
      summary,
      metadata: {
        registryTokenSource: registrySnapshot.source,
        registryBusinessCount: businesses.length,
        registryAccountCount: allAccounts.length,
      },
    });
  } catch (err: any) {
    console.error("Meta live breakdown error:", err);
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.get("/make-server-f781cd00/meta/snapshots", async (c) => {
  try {
    const user = await requireAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const from = c.req.query("from");
    const to = c.req.query("to");
    const requestedBusinessId = c.req.query("businessId");
    const requestedAccountId = c.req.query("accountId");
    const includeLastKnown = parseBooleanFlag(c.req.query("includeLastKnown"));

    if (!isValidDateParam(from) || !isValidDateParam(to)) {
      return c.json({ error: "Parameter from/to wajib format YYYY-MM-DD." }, 400);
    }

    let rows = await fetchAdsDailySnapshots({
      platformKey: "meta",
      from: from!,
      to: to!,
    });

    if (requestedBusinessId) {
      rows = rows.filter((row) => row.externalGroupId === requestedBusinessId);
    }
    if (requestedAccountId) {
      rows = rows.filter((row) => row.externalAccountId === requestedAccountId);
    }

    let servedFrom = "meta-snapshot-db";
    let fallbackSnapshotDate: string | null = null;

    if (includeLastKnown) {
      const existingAccountIds = new Set(rows.flatMap((row) => buildMetaExternalAccountIdVariants(row.externalAccountId)));
      const configs = await loadMetaIntegrationConfigs();
      const fallbackAccountIds = requestedAccountId
        ? buildMetaExternalAccountIdVariants(requestedAccountId)
        : configs
            .filter(
              (config) =>
                config.enabled &&
                config.liveMetaAccountId &&
                (!requestedBusinessId || config.businessManagerId === requestedBusinessId),
            )
            .flatMap((config) => buildMetaExternalAccountIdVariants(config.liveMetaAccountId))
            .filter((accountId) => accountId && !existingAccountIds.has(accountId));

      const fallbackRows =
        fallbackAccountIds.length > 0 || rows.length === 0
          ? await fetchLatestAdsDailySnapshotsBeforeOrOn({
              platformKey: "meta",
              onOrBefore: to!,
              externalAccountIds: fallbackAccountIds.length > 0 ? fallbackAccountIds : undefined,
              externalGroupId: requestedBusinessId || null,
            })
          : [];

      const mergedAccountIds = new Set(rows.flatMap((row) => buildMetaExternalAccountIdVariants(row.externalAccountId)));
      const missingFallbackRows = fallbackRows.filter((row) => {
        const variants = buildMetaExternalAccountIdVariants(row.externalAccountId);
        if (variants.some((accountId) => mergedAccountIds.has(accountId))) return false;
        variants.forEach((accountId) => mergedAccountIds.add(accountId));
        return true;
      });

      rows = [...rows, ...missingFallbackRows];
      servedFrom = missingFallbackRows.length > 0 ? "meta-snapshot-db-with-latest-known" : servedFrom;
      fallbackSnapshotDate = missingFallbackRows[0]?.snapshotDate || null;
    }

    return c.json({
      source: servedFrom,
      range: { from, to },
      rows,
      metadata: {
        rowCount: rows.length,
        lastSyncedAt: getMaxTimestamp(rows),
        servedFrom,
        fallbackSnapshotDate,
      },
    });
  } catch (err: any) {
    console.error("Meta snapshot db error:", err);
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.post("/make-server-f781cd00/meta/sync-snapshots", async (c) => {
  try {
    const user = await requireAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!META_ACCESS_TOKEN && !META_DM_USER_TOKEN) {
      return c.json({ error: "META_ACCESS_TOKEN atau META_DM_USER_TOKEN belum diatur di server." }, 503);
    }

    const body = await readJsonBody(c);
    const from = typeof body?.from === "string" ? body.from : c.req.query("from");
    const to = typeof body?.to === "string" ? body.to : c.req.query("to");
    const requestedBusinessId =
      typeof body?.businessId === "string" ? body.businessId : c.req.query("businessId");
    const requestedAccountId =
      typeof body?.accountId === "string" ? body.accountId : c.req.query("accountId");
    const force = parseBooleanFlag(
      typeof body?.force !== "undefined" ? body.force : c.req.query("force"),
      false,
    );
    const minFreshMinutes = clampNumber(
      typeof body?.minFreshMinutes !== "undefined"
        ? body.minFreshMinutes
        : c.req.query("minFreshMinutes"),
      10,
      0,
      240,
    );

    if (!isValidDateParam(from) || !isValidDateParam(to)) {
      return c.json({ error: "Parameter from/to wajib format YYYY-MM-DD." }, 400);
    }

    if (diffInDaysInclusive(from!, to!) > 730) {
      return c.json({ error: "Rentang sync maksimal 730 hari per request." }, 400);
    }

    const result = await syncMetaSnapshotRange({
      from: from!,
      to: to!,
      requestedBusinessId: requestedBusinessId || undefined,
      requestedAccountId: requestedAccountId || undefined,
      force,
      minFreshMinutes,
    });

    let rows = result.rows;
    if (requestedBusinessId) {
      rows = rows.filter((row) => row.externalGroupId === requestedBusinessId);
    }
    if (requestedAccountId) {
      rows = rows.filter((row) => row.externalAccountId === requestedAccountId);
    }

    return c.json({
      source: "meta-snapshot-sync",
      range: { from, to },
      rows,
      metadata: {
        rowCount: rows.length,
        upsertedCount: result.upsertedCount,
        servedFrom: result.servedFrom,
        skippedSync: result.skippedSync,
        lastSyncedAt: result.latestSyncedAt,
      },
    });
  } catch (err: any) {
    console.error("Meta snapshot sync error:", err);
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.get("/make-server-f781cd00/meta/token-health", async (c) => {
  try {
    const user = await requireAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const debugPayload = await debugMetaToken();
    const tokenData = debugPayload?.data || {};

    return c.json({
      ok: Boolean(tokenData?.is_valid),
      checkedAt: new Date().toISOString(),
      appId: tokenData?.app_id || null,
      type: tokenData?.type || null,
      application: tokenData?.application || null,
      isValid: Boolean(tokenData?.is_valid),
      expiresAt: tokenData?.expires_at || null,
      dataAccessExpiresAt: tokenData?.data_access_expires_at || null,
      scopes: Array.isArray(tokenData?.scopes) ? tokenData.scopes : [],
      granularScopes: Array.isArray(tokenData?.granular_scopes) ? tokenData.granular_scopes : [],
      userId: tokenData?.user_id || null,
      metadata: {
        usesAppSecretProof: Boolean(META_APP_SECRET),
        source: "server",
      },
    });
  } catch (err: any) {
    console.error("Meta token health error:", err);
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.get("/make-server-f781cd00/meta/integration-configs", async (c) => {
  try {
    const user = await requireAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const configs = await kv.getByPrefix("meta_integration_config:");
    return c.json({ configs });
  } catch (err: any) {
    console.error("Meta integration configs error:", err);
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

app.post("/make-server-f781cd00/meta/integration-configs/:adAccountId", async (c) => {
  try {
    const user = await requireAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const adAccountId = c.req.param("adAccountId");
    const body = await c.req.json();
    const enabled = Boolean(body?.enabled);
    const businessManagerId =
      typeof body?.businessManagerId === "string" && body.businessManagerId.trim()
        ? body.businessManagerId.trim()
        : undefined;
    const businessManagerName =
      typeof body?.businessManagerName === "string" && body.businessManagerName.trim()
        ? body.businessManagerName.trim()
        : undefined;
    const liveMetaAccountId =
      typeof body?.liveMetaAccountId === "string" && body.liveMetaAccountId.trim()
        ? body.liveMetaAccountId.trim()
        : undefined;
    const liveMetaAccountName =
      typeof body?.liveMetaAccountName === "string" && body.liveMetaAccountName.trim()
        ? body.liveMetaAccountName.trim()
        : undefined;

    const config = {
      adAccountId,
      enabled,
      businessManagerId,
      businessManagerName,
      liveMetaAccountId,
      liveMetaAccountName,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    };

    await kv.set(`meta_integration_config:${adAccountId}`, config);
    return c.json({ success: true, config });
  } catch (err: any) {
    console.error("Save Meta integration config error:", err);
    return c.json({ error: err.message || "Unknown error" }, 500);
  }
});

// Verify Email Route (Basic MX Check)
app.post("/make-server-f781cd00/verify-email", async (c) => {
  const auth = await requireAuthorizedRequester(c, ["users.create", "users.edit"]);
  if (auth.response) return auth.response;

  try {
    const { email } = await c.req.json();
    if (!email || !email.includes('@')) {
      return c.json({ valid: false, reason: "Invalid format" });
    }

    const domain = email.split('@')[1];
    
    // 1. Check for disposable domains (Basic list)
    const disposableDomains = ['tempmail.com', 'throwawaymail.com', 'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'yopmail.com'];
    if (disposableDomains.includes(domain.toLowerCase())) {
        return c.json({ valid: false, reason: "Disposable email detected" });
    }

    // 2. Resolve MX Records using Deno's DNS API
    // This confirms the domain can receive emails.
    try {
        const records = await Deno.resolveDns(domain, "MX");
        if (!records || records.length === 0) {
            return c.json({ valid: false, reason: "Domain has no mail servers (MX records missing)" });
        }
        
        // Success
        return c.json({ 
            valid: true, 
            mxFound: true, 
            provider: records[0].exchange 
        });

    } catch (dnsError) {
        // If DNS lookup fails, the domain likely doesn't exist
        return c.json({ valid: false, reason: "Domain does not exist or has no MX records" });
    }

  } catch (err: any) {
    console.error("Email verification error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// Create User (Admin only)
app.post("/make-server-f781cd00/users", async (c) => {
  try {
    const requester = await getRequesterAccessContext(c.req.raw.headers);
    if (!requester) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!hasEffectivePermission(requester, "users.create")) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const body = await c.req.json();
    const {
      email,
      password,
      name,
      role,
      branchId,
      employmentStatus,
      avatarUrl,
      phone,
      joinDate,
      bankName,
      bankAccountNumber,
      emergencyPhone,
      csWhatsappNumber,
      csDisplayName,
      csAssignmentStatus,
      csMaxActiveChats,
      csNotes,
    } = body;
    const targetRole = typeof role === "string" && role.trim() ? role.trim() : "CS";
    const targetStatus = body?.status === "inactive" ? "inactive" : "active";
    const normalizedCsAssignmentStatus = normalizeCsAssignmentStatusValue(csAssignmentStatus);
    const normalizedCsMaxActiveChats = normalizeCsMaxActiveChatsValue(csMaxActiveChats);

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }
    if (isOwnerRole(targetRole) && !requester.isOwner) {
      return c.json({ error: "Forbidden: hanya Owner yang dapat membuat akun Owner" }, 403);
    }

    // 1. Create User in Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto confirm
      user_metadata: { name, role: targetRole, branch_id: branchId }
    });

    if (authError) {
      return c.json({ error: authError.message }, 400);
    }

    if (!authData.user) {
      return c.json({ error: "User creation failed" }, 500);
    }

    // 2. Ensure Profile is Created/Updated
    // We use UPSERT to handle cases where the Trigger might be missing or slow.
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ 
        id: authData.user.id,
        name,
        email: email, // Store email in profile for easy access
        role: targetRole,
        branch_id: branchId && branchId !== "none_branch" ? branchId : null,
        employment_status: employmentStatus || 'permanent',
        avatar_url: avatarUrl || null,
        phone: phone || null,
        join_date: joinDate || null,
        bank_name: bankName || null,
        bank_account_number: bankAccountNumber || null,
        emergency_phone: emergencyPhone || null,
        cs_whatsapp_number: csWhatsappNumber || null,
        cs_display_name: csDisplayName || null,
        cs_assignment_status: normalizedCsAssignmentStatus,
        cs_max_active_chats: normalizedCsMaxActiveChats,
        cs_notes: csNotes || null,
        status: targetStatus
      });

    if (profileError) {
      console.error("Profile upsert error:", profileError);
      
      // ROLLBACK: Delete the auth user if profile creation fails to prevent inconsistent state
      await supabase.auth.admin.deleteUser(authData.user.id);
      
      return c.json({ 
        error: `Gagal membuat profil pengguna: ${profileError.message}. User Auth dibatalkan.` 
      }, 500);
    }

    // Log Activity
    const actor = requester.actorName;
    // Get IP (simulated or from header)
    const ip = c.req.header('x-forwarded-for') || "127.0.0.1";
    const rhiId = `RHI-${authData.user.id.slice(-4).toUpperCase()}`;
    await logActivity(actor, "Create User", `Created user ${name} (${rhiId}) - Role: ${targetRole}`, ip);

    return c.json({ user: authData.user, message: "User created successfully" });

  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Update User (Profile) with permission checks.
app.put("/make-server-f781cd00/users/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const requester = await getRequesterAccessContext(c.req.raw.headers);
    if (!requester) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!hasEffectivePermission(requester, "users.edit")) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", id)
      .maybeSingle();

    if (profileError) {
      return c.json({ error: profileError.message }, 400);
    }
    if (!existingProfile) {
      return c.json({ error: "User not found" }, 404);
    }
    if (isOwnerRole(existingProfile.role) && !requester.isOwner) {
      return c.json({ error: "Forbidden: hanya Owner yang dapat mengubah akun Owner" }, 403);
    }

    const body = await c.req.json();
    const nextRole = typeof body?.role === "string" && body.role.trim() ? body.role.trim() : existingProfile.role;
    const normalizedCsAssignmentStatus = normalizeCsAssignmentStatusValue(body?.csAssignmentStatus);
    const normalizedCsMaxActiveChats = normalizeCsMaxActiveChatsValue(body?.csMaxActiveChats);
    if (isOwnerRole(nextRole) && !requester.isOwner) {
      return c.json({ error: "Forbidden: hanya Owner yang dapat menetapkan role Owner" }, 403);
    }

    const profilePayload = {
      name: body?.name,
      role: nextRole,
      branch_id:
        !body?.branchId || body.branchId === "none_branch"
          ? null
          : body.branchId,
      status: body?.status,
      phone: body?.phone || null,
      employment_status: body?.employmentStatus || null,
      avatar_url: body?.avatarUrl || null,
      join_date: body?.joinDate || null,
      bank_name: body?.bankName || null,
      bank_account_number: body?.bankAccountNumber || null,
      emergency_phone: body?.emergencyPhone || null,
      cs_whatsapp_number: body?.csWhatsappNumber || null,
      cs_display_name: body?.csDisplayName || null,
      cs_assignment_status: normalizedCsAssignmentStatus,
      cs_max_active_chats: normalizedCsMaxActiveChats,
      cs_notes: body?.csNotes || null,
    };

    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update(profilePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      return c.json({ error: updateError.message }, 400);
    }

    const metadataUpdate = {
      name: body?.name,
      role: nextRole,
      branch_id: profilePayload.branch_id,
    };

    const actor = requester.actorName;
    const ip = c.req.header("x-forwarded-for") || "127.0.0.1";
    const rhiId = `RHI-${id.slice(-4).toUpperCase()}`;

    runBackgroundTask(
      `sync auth metadata for user ${id}`,
      supabase.auth.admin.updateUserById(id, {
        user_metadata: metadataUpdate,
      }).then(({ error }) => {
        if (error) throw error;
      }),
    );
    runBackgroundTask(
      `log user update ${id}`,
      logActivity(actor, "Update User", `Updated user ${body?.name || rhiId} (${rhiId})`, ip),
    );

    return c.json({ profile: updatedProfile, message: "User updated successfully" });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.delete("/make-server-f781cd00/users/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const requester = await getRequesterAccessContext(c.req.raw.headers);
    if (!requester) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!hasEffectivePermission(requester, "users.delete")) {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (requester.authUser.id === id) {
      return c.json({ error: "Forbidden: akun sendiri tidak dapat dihapus" }, 403);
    }

    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", id)
      .maybeSingle();
    if (isOwnerRole(targetProfile?.role) && !requester.isOwner) {
      return c.json({ error: "Forbidden: hanya Owner yang dapat menghapus akun Owner" }, 403);
    }

    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) throw error;
    
    // Also delete from profiles if not cascaded (though it usually should be if FK is set right)
    // Or we just let it be orphan if we want to keep history (but usually we want to delete access)
    
    // Log Activity
    const actor = requester.actorName;
    const ip = c.req.header('x-forwarded-for') || "127.0.0.1";
    const rhiId = `RHI-${id.slice(-4).toUpperCase()}`;
    await logActivity(actor, "Delete User", `Deleted user ${rhiId}`, ip);

    return c.json({ message: "User deleted successfully" });
  } catch (err: any) {
     return c.json({ error: err.message }, 500);
  }
});

// Reset User Password
app.put("/make-server-f781cd00/users/:id/password", async (c) => {
  const id = c.req.param("id");
  try {
    const requester = await getRequesterAccessContext(c.req.raw.headers);
    if (!requester) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!hasEffectivePermission(requester, "users.reset_password")) {
      return c.json({ error: "Forbidden: Insufficient permissions" }, 403);
    }

    const { password } = await c.req.json();
    if (!password || password.length < 6) {
        return c.json({ error: "Password must be at least 6 characters" }, 400);
    }

    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", id)
      .maybeSingle();
    if (isOwnerRole(targetProfile?.role) && !requester.isOwner) {
        return c.json({ error: "Forbidden: hanya Owner yang dapat mereset password akun Owner" }, 403);
    }

    // Update Password
    const { error: updateError } = await supabase.auth.admin.updateUserById(id, { password });
    
    if (updateError) {
        console.error("Update password error:", updateError);
        throw updateError;
    }

    // Force logout (revoke all active sessions for this user)
    try {
        const { error: signOutError } = await supabase.auth.admin.signOut(id);
        if (signOutError) {
            console.warn(`Warning: Failed to revoke sessions for user ${id}:`, signOutError.message);
        }
    } catch (signOutEx: any) {
        console.warn(`Exception during signOut for user ${id}:`, signOutEx.message);
    }

    // Log Activity
    const actor = requester.actorName;
    const ip = c.req.header('x-forwarded-for') || "127.0.0.1";
    const rhiId = `RHI-${id.slice(-4).toUpperCase()}`;
    await logActivity(actor, "Reset Password", `Reset password for user ${rhiId}`, ip);

    return c.json({ success: true, message: "Password updated successfully" });

  } catch (err: any) {
    const errorMessage = err.message || (typeof err === 'string' ? err : JSON.stringify(err));
    return c.json({ error: errorMessage }, 500);
  }
});

// --- LEADS API ---

// Get All Leads
app.get("/make-server-f781cd00/leads", async (c) => {
  const auth = await requireAuthorizedRequester(c, ["leads.view"]);
  if (auth.response) return auth.response;

  try {
    // Fetch all keys starting with "lead:"
    const leads = await kv.getByPrefix("lead:");
    // Sort by timestamp desc
    leads.sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    return c.json(leads);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Create Lead
app.post("/make-server-f781cd00/leads", async (c) => {
  const auth = await requireAuthorizedRequester(c, ["leads.create"]);
  if (auth.response) return auth.response;

  try {
    const data = await c.req.json();
    if (!data.id) return c.json({ error: "ID is required" }, 400);
    
    const key = `lead:${data.id}`;
    // Add timestamp if missing
    const payload = { ...data, timestamp: data.timestamp || new Date().toISOString() };
    
    await kv.set(key, payload);
    
    // Log
    const actor = auth.requester?.actorName || "System";
    await logActivity(actor, "Create Lead", `Created lead ${data.name} (${data.id})`, "System");
    
    return c.json(payload);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Update Lead
app.put("/make-server-f781cd00/leads/:id", async (c) => {
  const id = c.req.param("id");
  const auth = await requireAuthorizedRequester(c, ["leads.edit"]);
  if (auth.response) return auth.response;

  try {
    const data = await c.req.json();
    const key = `lead:${id}`;
    
    await kv.set(key, data);
    
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete Lead
app.delete("/make-server-f781cd00/leads/:id", async (c) => {
  const id = c.req.param("id");
  const auth = await requireAuthorizedRequester(c, ["leads.delete"]);
  if (auth.response) return auth.response;

  try {
    const key = `lead:${id}`;
    await kv.del(key);
    
    const actor = auth.requester?.actorName || "System";
    await logActivity(actor, "Delete Lead", `Deleted lead ${id}`, "System");
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// --- ORDERS API ---

// Get All Orders
app.get("/make-server-f781cd00/orders", async (c) => {
  const auth = await requireAuthorizedRequester(c, ["order.view"]);
  if (auth.response) return auth.response;

  try {
    const orders = await kv.getByPrefix("order:");
    // Sort by serviceDate desc
    orders.sort((a: any, b: any) => new Date(b.serviceDate || 0).getTime() - new Date(a.serviceDate || 0).getTime());
    return c.json(orders);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Create Order
app.post("/make-server-f781cd00/orders", async (c) => {
  const auth = await requireAuthorizedRequester(c, ["order.create"]);
  if (auth.response) return auth.response;

  try {
    const data = await c.req.json();
    if (!data.id) return c.json({ error: "ID is required" }, 400);
    
    const key = `order:${data.id}`;
    const payload = { ...data, createdAt: data.createdAt || new Date().toISOString() };
    
    await kv.set(key, payload);
    
    const actor = auth.requester?.actorName || "System";
    await logActivity(actor, "Create Order", `Created order ${data.id} - ${data.customerName}`, "System");
    
    return c.json(payload);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Update Order
app.put("/make-server-f781cd00/orders/:id", async (c) => {
  const id = c.req.param("id");
  const auth = await requireAuthorizedRequester(c, ["order.edit"]);
  if (auth.response) return auth.response;

  try {
    const data = await c.req.json();
    const key = `order:${id}`;
    
    await kv.set(key, data);
    
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete Order
app.delete("/make-server-f781cd00/orders/:id", async (c) => {
  const id = c.req.param("id");
  const auth = await requireAuthorizedRequester(c, ["order.delete"]);
  if (auth.response) return auth.response;

  try {
    const key = `order:${id}`;
    await kv.del(key);
    
    const actor = auth.requester?.actorName || "System";
    await logActivity(actor, "Delete Order", `Deleted order ${id}`, "System");
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// --- AFFILIATES API ---

// Get All Affiliates
app.get("/make-server-f781cd00/affiliates", async (c) => {
  const auth = await requireAuthorizedRequester(c, ["affiliate.view"]);
  if (auth.response) return auth.response;

  try {
    const affiliates = await kv.getByPrefix("affiliate:");
    // Sort by created_at desc (newest first)
    affiliates.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return c.json(affiliates);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Create Affiliate
app.post("/make-server-f781cd00/affiliates", async (c) => {
  const auth = await requireAuthorizedRequester(c, ["affiliate.manage"]);
  if (auth.response) return auth.response;

  try {
    const data = await c.req.json();
    if (!data.id) return c.json({ error: "ID is required" }, 400);
    
    const key = `affiliate:${data.id}`;
    const payload = { ...data, created_at: data.created_at || new Date().toISOString() };
    
    await kv.set(key, payload);
    
    const actor = auth.requester?.actorName || "System";
    await logActivity(actor, "Create Affiliate", `Created affiliate ${data.nama_lengkap} (${data.id})`, "System");
    
    return c.json(payload);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Update Affiliate
app.put("/make-server-f781cd00/affiliates/:id", async (c) => {
  const id = c.req.param("id");
  const auth = await requireAuthorizedRequester(c, ["affiliate.manage"]);
  if (auth.response) return auth.response;

  try {
    const data = await c.req.json();
    const key = `affiliate:${id}`;
    
    // We should probably check if it exists, but KV upsert is fine
    await kv.set(key, data);
    
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete Affiliate
app.delete("/make-server-f781cd00/affiliates/:id", async (c) => {
  const id = c.req.param("id");
  const auth = await requireAuthorizedRequester(c, ["affiliate.manage"]);
  if (auth.response) return auth.response;

  try {
    const key = `affiliate:${id}`;
    await kv.del(key);
    
    const actor = auth.requester?.actorName || "System";
    await logActivity(actor, "Delete Affiliate", `Deleted affiliate ${id}`, "System");
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Get Audit Logs
app.get("/make-server-f781cd00/logs", async (c) => {
  const auth = await requireAuthorizedRequester(c, ["audit_logs.view"]);
  if (auth.response) return auth.response;

  try {
    const logs = await kv.getByPrefix("audit:");
    // Sort descending
    logs.sort((a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime());
    return c.json(logs);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Expand Short URL (e.g. Google Maps)
app.post("/make-server-f781cd00/expand-url", async (c) => {
  let url = "";
  try {
    ({ url } = await c.req.json());
    if (!url) return c.json({ error: "URL is required" }, 400);

    // Filter basic security
    const allowedDomains = ['goo.gl', 'bit.ly', 'maps.app.goo.gl', 'g.co', 'google.com', 'google.co.id'];
    const isAllowed = allowedDomains.some(d => url.includes(d));
    
    if (!isAllowed) {
       // If it's just a raw google maps link that isn't short, just return it
       if (url.includes('/maps')) return c.json({ expandedUrl: url });
       // Otherwise reject generic URLs to prevent abuse
       return c.json({ error: "Only Google Maps URLs are supported" }, 400);
    }

    // Optimization: If it's already a full maps URL, return immediately without fetching
    // This prevents connection errors on long URLs and saves resources
    if (url.includes('/maps/')) {
        return c.json({ expandedUrl: url });
    }

    // Use a browser User-Agent to avoid blocking and ensure redirects work
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
    };

    try {
        const resp = await fetch(url, { 
            method: 'GET',
            headers,
            redirect: 'follow', // Follow all redirects automatically
        });
        
        // If successful, return the final destination URL
        if (resp.url && resp.url !== url) {
             return c.json({ expandedUrl: resp.url });
        }

    } catch (e: any) {
        // Log generic warning instead of full stack trace for connection resets to reduce noise
        if (e.message?.includes('connection reset') || e.message?.includes('connection error')) {
            console.warn(`URL Expansion connection failed for ${url}: ${e.message}`);
        } else {
            console.error("Fetch error:", e);
        }
    }

    // Force return original if nothing changed
    return c.json({ expandedUrl: url });

  } catch (err: any) {
    console.error("Expand URL error:", err);
    // Graceful fallback: return original
    return c.json({ expandedUrl: url });
  }
});

// --- SHIFTS API ---

// Get Shift
app.get("/make-server-f781cd00/shifts/:userId/:date", async (c) => {
  const userId = c.req.param("userId");
  const date = c.req.param("date"); // yyyy-MM-dd
  const key = `shift:${userId}:${date}`;
  const auth = await requireAuthorizedRequester(c);
  if (auth.response) return auth.response;
  if (!requesterCanReadShift(auth.requester, userId)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  try {
    const shift = await kv.get(key);
    return c.json(shift || null);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete Shift
app.delete("/make-server-f781cd00/shifts/:userId/:date", async (c) => {
  const userId = c.req.param("userId");
  const date = c.req.param("date");
  const key = `shift:${userId}:${date}`;
  const auth = await requireAuthorizedRequester(c);
  if (auth.response) return auth.response;
  if (!requesterCanResetShift(auth.requester)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  try {
    await kv.del(key);
    
    // Log Activity
    const actor = auth.requester?.actorName || "System";
    await logActivity(actor, "Reset Shift", `Reset shift for ${userId} on ${date}`, "System");
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// --- SPECIALIZED MOBILE ENDPOINTS (OPTIMIZED) ---

// Get Technician Specific Orders (Server-Side Filtering via Supabase SQL)
app.get("/make-server-f781cd00/mobile/technician-orders/:userId", async (c) => {
  const userId = c.req.param("userId");
  const dateStr = c.req.query("date"); // YYYY-MM-DD
  const auth = await requireAuthorizedRequester(c);
  if (auth.response) return auth.response;
  if (!requesterCanReadTechnicianOrders(auth.requester, userId)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  
  try {
    // 1. Fetch Vehicles Reference (Safely)
    // We do this sequentially to prevent any Promise.all race conditions or unhandled rejections
    let vehiclesMap = new Map();
    
    // Attempt 1: Fetch from SQL 'vehicle_types' table
    try {
        const { data: vData, error: vError } = await supabase
            .from('vehicle_types')
            .select('id, name');
            
        if (!vError && vData) {
            vData.forEach((v: any) => vehiclesMap.set(String(v.id), v.name));
        }
    } catch (e) {
        console.error("SQL Vehicle fetch ignored:", e);
    }

    // Attempt 2: Fetch from KV Store 'vehicle_type' (Master Data)
    try {
        const kvVehicles = await kv.getByPrefix('vehicle_type:');
        if (kvVehicles) {
             kvVehicles.forEach((v: any) => {
                 if (v.id && v.name) vehiclesMap.set(String(v.id), v.name);
             });
        }
    } catch (e) {
        console.error("KV Vehicle fetch error:", e);
    }

    // 2. Fetch Orders directly from SQL Table
    let query = supabase
        .from('orders')
        .select('*')
        .eq('technician_id', userId);

    if (dateStr) {
       query = query.eq('service_date', dateStr);
    }
    
    // Sort by time
    query = query.order('service_time', { ascending: true });

    const { data: ordersData, error: ordersError } = await query;

    if (ordersError) {
        console.error("Orders Query Error:", ordersError);
        return c.json({ error: ordersError.message }, 500);
    }

    // 3. Normalize Data for Frontend
    const normalizedOrders = (ordersData || []).map((o: any) => ({
        ...o, // Keep original keys
        id: o.id,
        technicianId: o.technician_id,
        serviceDate: o.service_date,
        serviceTime: o.service_time,
        serviceId: o.service_id,
        serviceCategory: o.service_category,
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        address: o.address,
        vehicleId: o.vehicle_id,
        vehicleType: vehiclesMap.get(String(o.vehicle_id)) || o.kendaraan || o.vehicle_type || 'Unknown',
        price: o.price,
        status: o.status,
        mapsUrl: o.maps_url,
        lat: Number(o.lat || 0),
        lng: Number(o.lng || 0),
        leadId: o.lead_id,
    }));

    return c.json(normalizedOrders);
  } catch (err: any) {
    console.error("Endpoint Error:", err);
    return c.json({ error: err.message }, 500);
  }
});

// Save Shift
app.post("/make-server-f781cd00/shifts", async (c) => {
  const auth = await requireAuthorizedRequester(c);
  if (auth.response) return auth.response;
  try {
    const { userId, date, data } = await c.req.json();
    if (!userId || !date || !data) {
        return c.json({ error: "Missing required fields" }, 400);
    }
    if (!requesterCanWriteShift(auth.requester, String(userId))) {
        return c.json({ error: "Forbidden" }, 403);
    }
    
    const key = `shift:${userId}:${date}`;
    await kv.set(key, data);
    
    // Log Activity (Optional, but good for tracking)
    // const actor = await getActorName(c.req.header('Authorization'));
    // const actionName = data.status === 'active' ? 'Start Shift' : 'End Shift';
    // await logActivity(actor, actionName, `User ${userId} - ${data.status}`, "System");
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// --- MASTER DATA GENERIC API ---

const handleProofAssetUpload = async (c: any) => {
  const auth = await requireAuthorizedRequester(c, [
    "proof_assets.create",
    "proof_assets.edit",
    "recurring_expenses.pay",
  ]);
  if (auth.response) return auth.response;

  try {
    const formData = await c.req.raw.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return c.json({ error: "File gambar wajib diisi." }, 400);
    }

    const result = await uploadProofAssetFile(file, auth.requester?.authUser.id || "system");
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message || "Gagal upload gambar aset." }, 500);
  }
};

app.post("/make-server-f781cd00/upload-image", handleProofAssetUpload);
app.post("/upload-image", handleProofAssetUpload);

// Get Master Data by Type
app.get("/make-server-f781cd00/master/:type", async (c) => {
  const type = c.req.param("type");
  const auth = await requireAuthorizedRequester(c, ["master_data.view"]);
  if (auth.response) return auth.response;

  try {
    const items = await kv.getByPrefix(`${type}:`);
    // Generic sort by createdAt if available, else by name
    items.sort((a: any, b: any) => {
        if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return (a.name || "").localeCompare(b.name || "");
    });
    return c.json(items);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Create/Update Master Data Item
app.post("/make-server-f781cd00/master/:type", async (c) => {
  const type = c.req.param("type");
  const auth = await requireAuthorizedRequester(c, ["master_data.create", "master_data.edit"]);
  if (auth.response) return auth.response;

  try {
    const data = await c.req.json();
    if (!data.id) return c.json({ error: "ID is required" }, 400);
    
    const key = `${type}:${data.id}`;
    const payload = { ...data, updatedAt: new Date().toISOString() };
    if (!payload.createdAt) payload.createdAt = new Date().toISOString();

    await kv.set(key, payload);
    
    const actor = auth.requester?.actorName || "System";
    await logActivity(actor, `Update ${type}`, `Updated ${type} ${data.name || data.id}`, "System");
    
    return c.json(payload);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete Master Data Item
app.delete("/make-server-f781cd00/master/:type/:id", async (c) => {
  const type = c.req.param("type");
  const id = c.req.param("id");
  const auth = await requireAuthorizedRequester(c, ["master_data.delete"]);
  if (auth.response) return auth.response;

  try {
    const key = `${type}:${id}`;
    await kv.del(key);
    
    const actor = auth.requester?.actorName || "System";
    await logActivity(actor, `Delete ${type}`, `Deleted ${type} ${id}`, "System");
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// --- PERMISSIONS API ---

// Get All Permissions
app.get("/make-server-f781cd00/permissions", async (c) => {
  const auth = await requireAuthorizedRequester(c, ["role_permissions.view"]);
  if (auth.response) return auth.response;

  try {
    // Returns array of { role: string, permissions: string[] }
    const items = await kv.getByPrefix("permission:");
    return c.json(items);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Save Permissions (Batch)
app.post("/make-server-f781cd00/permissions", async (c) => {
  const auth = await requireAuthorizedRequester(c, ["role_permissions.manage"]);
  if (auth.response) return auth.response;

  try {
    const { permissions } = await c.req.json(); // Record<Role, string[]>
    
    if (!permissions) return c.json({ error: "Permissions object required" }, 400);

    // Optimized: Use mset to save all in one transaction/request
    const entries = Object.entries(permissions);
    
    // Convert to proper key-value pairs for mset
    const updates: Record<string, any> = {};
    entries.forEach(([role, perms]) => {
        updates[`permission:${role}`] = { role, permissions: perms };
    });

    await kv.mset(Object.keys(updates), Object.values(updates));

    try {
        const actor = auth.requester?.actorName || "System";
        await logActivity(actor, "Update Permissions", "Updated role permissions", "System");
    } catch (e) {
        console.error("Log activity failed:", e);
    }

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// --- MANUAL DEBTS API (HYBRID APPROACH) ---

// Get All Manual Debts
app.get("/make-server-f781cd00/manual-debts", async (c) => {
  const auth = await requireAuthorizedRequester(c, ["debts.view", "finance.manage"]);
  if (auth.response) return auth.response;

  try {
    const debts = await kv.getByPrefix("debt:");
    // Sort by created_at desc
    debts.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return c.json(debts);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Create Manual Debt
app.post("/make-server-f781cd00/manual-debts", async (c) => {
  const auth = await requireAuthorizedRequester(c, ["finance.manage"]);
  if (auth.response) return auth.response;

  try {
    const data = await c.req.json();
    if (!data.id) return c.json({ error: "ID is required" }, 400);
    
    const key = `debt:${data.id}`;
    const payload = { ...data, created_at: data.created_at || new Date().toISOString() };
    
    await kv.set(key, payload);
    
    const actor = auth.requester?.actorName || "System";
    await logActivity(actor, "Create Debt", `Created debt for ${data.user_name || 'Unknown'} - ${data.amount}`, "System");
    
    return c.json(payload);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Update Manual Debt (Pay/Settle)
app.put("/make-server-f781cd00/manual-debts/:id", async (c) => {
  const id = c.req.param("id");
  const auth = await requireAuthorizedRequester(c, ["finance.manage"]);
  if (auth.response) return auth.response;

  try {
    const data = await c.req.json();
    const key = `debt:${id}`;
    
    await kv.set(key, data);
    
    const actor = auth.requester?.actorName || "System";
    await logActivity(actor, "Update Debt", `Updated debt ${id} status to ${data.status}`, "System");
    
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete Manual Debt
app.delete("/make-server-f781cd00/manual-debts/:id", async (c) => {
  const id = c.req.param("id");
  const auth = await requireAuthorizedRequester(c, ["finance.manage"]);
  if (auth.response) return auth.response;

  try {
    const key = `debt:${id}`;
    await kv.del(key);
    
    const actor = auth.requester?.actorName || "System";
    await logActivity(actor, "Delete Debt", `Deleted debt ${id}`, "System");
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// --- USER SPECIFIC PERMISSIONS API ---

// Get User Permissions
app.get("/make-server-f781cd00/permissions/user/:userId", async (c) => {
    const userId = c.req.param("userId");
    const key = `user_permission:${userId}`;
    const auth = await requireAuthorizedRequester(c, ["role_permissions.view"]);
    if (auth.response) return auth.response;
    
    try {
        const perms = await kv.get(key);
        if (!perms) {
            return c.json({ permissions: null }, 404);
        }
        return c.json(perms); // { permissions: [] }
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// Set User Permissions
app.post("/make-server-f781cd00/permissions/user/:userId", async (c) => {
    const userId = c.req.param("userId");
    const auth = await requireAuthorizedRequester(c, ["role_permissions.manage"]);
    if (auth.response) return auth.response;

    try {
        let body;
        try {
            body = await c.req.json();
        } catch (e) {
            return c.json({ error: "Invalid JSON body" }, 400);
        }

        const { permissions } = body; // { permissions: [...] }
        if (!Array.isArray(permissions)) {
            return c.json({ error: "Invalid format: permissions must be an array" }, 400);
        }
        
        const key = `user_permission:${userId}`;
        await kv.set(key, { permissions });

        const actor = auth.requester?.actorName || "System";
        // Wrap log in try-catch to prevent main flow failure
        try {
            await logActivity(actor, "Update User Permissions", `Updated custom permissions for ${userId}`, "System");
        } catch (e) {
            console.error("Log activity failed:", e);
        }
        
        return c.json({ success: true });
    } catch (err: any) {
        console.error("Set user permissions error:", err);
        return c.json({ error: err.message }, 500);
    }
});

// Delete User Permissions (Reset to Role Default)
app.delete("/make-server-f781cd00/permissions/user/:userId", async (c) => {
    const userId = c.req.param("userId");
    const auth = await requireAuthorizedRequester(c, ["role_permissions.manage"]);
    if (auth.response) return auth.response;

    try {
        const key = `user_permission:${userId}`;
        await kv.del(key);
        
        const actor = auth.requester?.actorName || "System";
        try {
            await logActivity(actor, "Reset User Permissions", `Reset permissions for ${userId} to default`, "System");
        } catch (e) {
            console.error("Log activity failed:", e);
        }

        return c.json({ success: true });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// --- ADVERTISER ACCESS CONFIG API ---

// Get Advertiser Config (KV Version)
// Renamed to 'access-config' to avoid AdBlockers blocking 'advertiser' keyword
app.get("/make-server-f781cd00/access-config/:id", async (c) => {
  const id = c.req.param("id");
  const auth = await requireAuthorizedRequester(c);
  if (auth.response) return auth.response;
  try {
    const config = await kv.get(`advertiser_config:${id}`);
    if (!config) {
        return c.json({ platformIds: [], subChannelIds: [], csIds: [] });
    }
    return c.json(config);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Save Advertiser Config (KV Version)
app.post("/make-server-f781cd00/access-config/:id", async (c) => {
  const id = c.req.param("id");
  const auth = await requireAuthorizedRequester(c, ["users.edit", "master_data.edit"]);
  if (auth.response) return auth.response;
  try {
    const { platformIds, subChannelIds, csIds } = await c.req.json();
    
    // Save to KV
    // Store ID inside value for easier retrieval
    const key = `advertiser_config:${id}`;
    await kv.set(key, { advertiserId: id, platformIds, subChannelIds, csIds });
    
    const actor = auth.requester?.actorName || "System";
    await logActivity(actor, "Update Advertiser Config", `Updated access config for ${id}`, "System");

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Get ALL Advertiser Configs (For Context Loading)
app.get("/make-server-f781cd00/access-configs", async (c) => {
    const auth = await requireAuthorizedRequester(c);
    if (auth.response) return auth.response;
    try {
        const configs = await kv.getByPrefix("advertiser_config:");
        return c.json(configs);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// --- OPERASIONAL TEKNISI (REPORTS) API ---

// Get Reports (Optional Date Filter)
app.get("/make-server-f781cd00/reports", async (c) => {
  try {
    const date = c.req.query("date");
    const reports = await kv.getByPrefix("report:");
    
    if (date) {
        // Filter by date if provided
        const filtered = reports.filter((r: any) => r.date === date);
        return c.json(filtered);
    }
    
    // Sort by date desc
    reports.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    return c.json(reports);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Create/Update Report
app.post("/make-server-f781cd00/reports", async (c) => {
  try {
    const data = await c.req.json();
    // ID format: report:YYYY-MM-DD:TECHNICIAN_ID
    // Ensure unique key for Date + Technician
    if (!data.date || !data.technicianId) {
        return c.json({ error: "Date and Technician ID are required" }, 400);
    }
    
    const id = data.id || `${data.date}:${data.technicianId}`;
    const key = `report:${id}`;
    
    const payload = { 
        ...data, 
        id, // Ensure ID is consistent
        updatedAt: new Date().toISOString() 
    };
    
    await kv.set(key, payload);
    
    const actor = await getActorName(c.req.header('Authorization'));
    await logActivity(actor, "Save Report", `Saved report for ${data.technicianName} on ${data.date}`, "System");
    
    return c.json(payload);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete Report
app.delete("/make-server-f781cd00/reports/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const key = `report:${id}`;
    await kv.del(key);
    
    const actor = await getActorName(c.req.header('Authorization'));
    await logActivity(actor, "Delete Report", `Deleted report ${id}`, "System");
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// --- TARGETS API (Monthly by Unit/Service) ---
app.get("/make-server-f781cd00/targets/:month", async (c) => {
    const month = c.req.param("month"); // YYYY-MM
    try {
        const auth = await requireAuthorizedRequester(c, [
          "targets.manage",
          "monitoring.activity_view",
          "monitoring.marketing.view",
          "monitoring.view",
        ]);
        if (auth.response) {
          return auth.response;
        }

        const key = `targets:${month}`;
        const data = await kv.get(key);
        return c.json(data || []);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

app.post("/make-server-f781cd00/targets/:month", async (c) => {
    const month = c.req.param("month");
    try {
        const auth = await requireAuthorizedRequester(c, ["targets.manage"]);
        if (auth.response) {
          return auth.response;
        }

        const { targets } = await c.req.json(); // Array of TargetItem
        const key = `targets:${month}`;
        await kv.set(key, targets);
        
        const actor = auth.requester?.actorName || "System";
        await logActivity(actor, "Update Targets", `Updated targets for ${month}`, "System");

        return c.json({ success: true });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// --- CS OKR TARGETS API (Monthly by CS/Platform) ---
app.get("/make-server-f781cd00/cs-okr-targets/:month", async (c) => {
    const month = c.req.param("month");
    try {
        const auth = await requireAuthorizedRequester(c, [
          "targets.manage",
          "monitoring.marketing.view",
          "dashboard.view_cs",
        ]);
        if (auth.response) {
          return auth.response;
        }

        const key = `cs_okr_targets:${month}`;
        const data = await kv.get(key);
        const targets = Array.isArray(data) ? data : [];
        const scopedTargets = auth.requester?.role === "CS"
          ? targets.filter((target: any) => target?.csId === auth.requester?.authUser.id)
          : targets;
        return c.json({ targets: scopedTargets });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

app.post("/make-server-f781cd00/cs-okr-targets/:month", async (c) => {
    const month = c.req.param("month");
    try {
        const auth = await requireAuthorizedRequester(c, ["targets.manage"]);
        if (auth.response) {
          return auth.response;
        }

        const body = await c.req.json();
        const rawTargets = Array.isArray(body?.targets) ? body.targets : [];
        const targets = rawTargets.map((target: any) => ({
          id: target.id || crypto.randomUUID(),
          month,
          csId: target.csId || "",
          platformId: target.platformId || null,
          leadsTarget: Number(target.leadsTarget) || 0,
          orderTarget: Number(target.orderTarget) || 0,
          revenueTarget: Number(target.revenueTarget) || 0,
          conversionTargetPercent: Number(target.conversionTargetPercent) || 20,
          responseTargetSeconds: Number(target.responseTargetSeconds) || 600,
          slaTargetPercent: Number(target.slaTargetPercent) || 85,
          spamTargetPercent: Number(target.spamTargetPercent) || 10,
          notes: target.notes || "",
          updatedAt: new Date().toISOString(),
        })).filter((target: any) => target.csId);

        const key = `cs_okr_targets:${month}`;
        await kv.set(key, targets);

        const actor = auth.requester?.actorName || "System";
        await logActivity(actor, "Update CS OKR Targets", `Updated CS OKR targets for ${month}`, "System");

        return c.json({ success: true, targets });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});


// --- STOCK MANAGEMENT API ---

// 1. Get Stock Settings (Service Types & Units)
app.get("/make-server-f781cd00/stock/settings", async (c) => {
    try {
        const auth = await requireAuthorizedRequester(c, ["inventory.view", "stock.settings.manage"]);
        if (auth.response) {
          return auth.response;
        }

        const settings = await kv.get("stock_settings");
        // Default structure if not found
        const defaultSettings = {
            service_types: ["Cuci Reguler", "Detailing", "Coating", "F&B", "Umum"],
            units: ["Pcs", "Liter", "Botol", "Box", "Set", "Kaleng"]
        };
        return c.json(settings || defaultSettings);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// 2. Save Stock Settings
app.post("/make-server-f781cd00/stock/settings", async (c) => {
    try {
        const auth = await requireAuthorizedRequester(c, ["stock.settings.manage"]);
        if (auth.response) {
          return auth.response;
        }

        const data = await c.req.json();
        await kv.set("stock_settings", data);
        
        const actor = auth.requester?.actorName || "System";
        await logActivity(actor, "Update Stock Settings", "Updated service types or units", "System");
        
        return c.json({ success: true, data });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// 3. Get All Products
app.get("/make-server-f781cd00/stock/products", async (c) => {
    try {
        const auth = await requireAuthorizedRequester(c, ["inventory.view"]);
        if (auth.response) {
          return auth.response;
        }

        const products = await kv.getByPrefix("stock_product:");
        // Sort by name
        products.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
        return c.json(products);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// 4. Create/Update Product (Master Data Only - No Stock Adjustment Here usually, unless initial)
app.post("/make-server-f781cd00/stock/products", async (c) => {
    try {
        const auth = await requireAuthorizedRequester(c, ["inventory.create", "inventory.edit"]);
        if (auth.response) {
          return auth.response;
        }

        const data = await c.req.json();
        if (!data.id) return c.json({ error: "ID is required" }, 400);

        const key = `stock_product:${data.id}`;
        
        // Fetch existing to preserve current_qty and average_cost if not provided (safety)
        const existing = await kv.get(key);
        
        const payload = {
            ...existing, // Keep existing state
            ...data,     // Overwrite with new details
            updatedAt: new Date().toISOString()
        };

        // Ensure defaults
        if (payload.current_qty === undefined) payload.current_qty = 0;
        if (payload.average_cost === undefined) payload.average_cost = 0;

        await kv.set(key, payload);
        
        const actor = auth.requester?.actorName || "System";
        const action = existing ? "Update Product" : "Create Product";
        await logActivity(actor, action, `${action}: ${data.name}`, "System");

        return c.json(payload);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// 5. Delete Product
app.delete("/make-server-f781cd00/stock/products/:id", async (c) => {
    const id = c.req.param("id");
    try {
        const auth = await requireAuthorizedRequester(c, ["inventory.delete"]);
        if (auth.response) {
          return auth.response;
        }

        const key = `stock_product:${id}`;
        await kv.del(key);
        
        const actor = auth.requester?.actorName || "System";
        await logActivity(actor, "Delete Product", `Deleted product ${id}`, "System");
        
        return c.json({ success: true });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// 6. Stock Transaction (IN/OUT/ADJUST) - The Core Logic for HPP
app.post("/make-server-f781cd00/stock/transactions", async (c) => {
    try {
        const auth = await requireAuthorizedRequester(c, ["stock.transaction.create"]);
        if (auth.response) {
          return auth.response;
        }

        const { type, productId, quantity, unitPrice, notes, date, relatedId } = await c.req.json();
        
        if (!productId || !quantity || !type) {
            return c.json({ error: "Missing required fields" }, 400);
        }

        const productKey = `stock_product:${productId}`;
        const product = await kv.get(productKey);

        if (!product) {
            return c.json({ error: "Product not found" }, 404);
        }

        const qtyNum = Number(quantity);
        const priceNum = Number(unitPrice || 0);
        let newQty = Number(product.current_qty || 0);
        let newAvgCost = Number(product.average_cost || 0);
        let totalValue = 0;

        // Validation
        if (type === 'OUT' && newQty < qtyNum) {
            // Optional: Allow negative stock? Usually no for accurate HPP.
            // Let's allow it but warn, or block. For now, let's block strict mode.
            // return c.json({ error: "Insufficient stock" }, 400);
        }

        // --- HPP CALCULATION LOGIC ---
        if (type === 'IN') {
            // Weighted Average Cost Formula
            // New Avg = ((Old Qty * Old Avg) + (New Qty * New Price)) / (Old Qty + New Qty)
            
            const oldTotalValue = newQty * newAvgCost;
            const newStockValue = qtyNum * priceNum;
            
            newQty += qtyNum;
            
            if (newQty > 0) {
                newAvgCost = (oldTotalValue + newStockValue) / newQty;
            }
            
            totalValue = newStockValue; // Value of this transaction

        } else if (type === 'OUT') {
            // OUT uses current Average Cost
            totalValue = qtyNum * newAvgCost; // Cost of Goods Sold (COGS)
            newQty -= qtyNum;
            // Average Cost DOES NOT CHANGE on OUT (mathematically)
        } else if (type === 'ADJUST') {
            // Adjustment (Opname) - distinct from IN/OUT
            // If quantity is positive, treated like IN but maybe with 0 cost or current cost?
            // Usually Adjust uses current cost to just fix Qty, OR specific cost if found.
            // Let's assume Adjust updates Qty to a specific value or adds/subtracts?
            // Convention: 'quantity' is the DELTA.
            
            // If we are "finding" items (positive adjust), and we don't know price, we might keep avg cost same?
            // Or if we know the price, we treat like IN.
            // Let's keep Avg Cost same for simplicity unless specified.
            newQty += qtyNum;
            totalValue = qtyNum * newAvgCost;
        }

        // Update Product
        const updatedProduct = {
            ...product,
            current_qty: newQty,
            average_cost: newAvgCost,
            last_updated: new Date().toISOString()
        };

        await kv.set(productKey, updatedProduct);

        // Record Transaction
        const trxId = crypto.randomUUID();
        const trxKey = `stock_trx:${trxId}`;
        const transaction = {
            id: trxId,
            productId,
            productName: product.name, // Snapshot name
            type,
            quantity: qtyNum,
            unitPrice: type === 'IN' ? priceNum : newAvgCost, // Record cost at moment of transaction
            totalValue,
            notes,
            date: date || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            relatedId // Link to Order ID or Invoice ID
        };

        await kv.set(trxKey, transaction);

        const actor = auth.requester?.actorName || "System";
        await logActivity(actor, `Stock ${type}`, `${type} ${qtyNum} ${product.unit || 'pcs'} of ${product.name}`, "System");

        return c.json({ success: true, product: updatedProduct, transaction });

    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// 7. Get Stock Transactions
app.get("/make-server-f781cd00/stock/transactions", async (c) => {
    try {
        const auth = await requireAuthorizedRequester(c, ["stock.transaction.view"]);
        if (auth.response) {
          return auth.response;
        }

        const trxs = await kv.getByPrefix("stock_trx:");
        // Sort by date desc
        trxs.sort((a: any, b: any) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
        // Limit to last 500 for performance? Or pagination?
        // Let's return all for now, filter on client
        return c.json(trxs);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

Deno.serve(app.fetch);
