import type { Context, Hono } from "npm:hono";
import { APP_DATA_ACCESS, type AppDataAccessConfig } from "./app_data_access.ts";
import { parseBooleanFlag } from "./ads_snapshot_utils.tsx";
import type { PermissionKey } from "../../../src/app/data/permissions.ts";

type AppDataRow = Record<string, unknown>;
type AppDataPayload = Record<string, unknown>;
type AppDataError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  status?: number;
};
type AppDataQueryResult = { data: AppDataRow[] | null; error: AppDataError | null };
type AppDataSingleQueryResult = { data: AppDataRow | null; error: AppDataError | null };
type AppDataQuery = PromiseLike<AppDataQueryResult> & {
  eq: (column: string, value: string) => AppDataQuery;
  gte: (column: string, value: string) => AppDataQuery;
  lte: (column: string, value: string) => AppDataQuery;
  order: (column: string, options?: { ascending?: boolean }) => AppDataQuery;
  range: (from: number, to: number) => AppDataQuery;
  select: (columns?: string) => AppDataQuery;
  single: () => PromiseLike<AppDataSingleQueryResult>;
};
type AppDataTableQuery = {
  select: (columns?: string) => AppDataQuery;
  insert: (payload: AppDataPayload) => AppDataQuery;
  update: (payload: AppDataPayload) => AppDataQuery;
  delete: () => AppDataQuery;
};
type AppDataSupabaseClient = {
  from: (table: string) => AppDataTableQuery;
};
type AppDataJsonResponse = ReturnType<Context["json"]>;

type AppDataAuthResult = {
  requester?: { actorName?: string | null } | null;
  response?: AppDataJsonResponse;
};

type RegisterAppDataRoutesDependencies = {
  supabase: AppDataSupabaseClient;
  requireAuthorizedRequester: (c: Context, permissions: readonly PermissionKey[]) => Promise<AppDataAuthResult>;
  logActivity: (user: string, action: string, detail: string, ip: string) => Promise<unknown>;
  runBackgroundTask: (label: string, task: Promise<unknown>) => void;
  assertNoBlockingLeadDuplicate: (payload: AppDataPayload, ignoreId?: string | null) => Promise<void>;
  getHttpErrorStatus: (error: unknown, fallback?: number) => number;
};

function getAppDataAccessConfig(type: string) {
  return APP_DATA_ACCESS[type] || null;
}

const getAppDataErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message
      : fallback;

function getAppDataRange(c: Context, config: AppDataAccessConfig) {
  const rawFrom = Number(c.req.query("from") || 0);
  const rawTo = Number(c.req.query("to") || 999);
  const from = Number.isFinite(rawFrom) && rawFrom >= 0 ? Math.floor(rawFrom) : 0;
  const requestedTo = Number.isFinite(rawTo) && rawTo >= from ? Math.floor(rawTo) : from + 999;
  const maxLimit = config.maxLimit || 1000;
  const to = Math.min(requestedTo, from + maxLimit - 1);
  return { from, to };
}

function applyAppDataFilters(query: AppDataQuery, c: Context, config: AppDataAccessConfig) {
  let nextQuery = query;

  (config.filterableColumns || []).forEach((column) => {
    const eqValue = c.req.query(`eq_${column}`);
    const gteValue = c.req.query(`gte_${column}`);
    const lteValue = c.req.query(`lte_${column}`);

    if (typeof eqValue === "string" && eqValue.length > 0) {
      nextQuery = nextQuery.eq(column, eqValue);
    }
    if (typeof gteValue === "string" && gteValue.length > 0) {
      nextQuery = nextQuery.gte(column, gteValue);
    }
    if (typeof lteValue === "string" && lteValue.length > 0) {
      nextQuery = nextQuery.lte(column, lteValue);
    }
  });

  return nextQuery;
}

function getAppDataOrderBy(c: Context, config: AppDataAccessConfig) {
  const fallbackOrderBy = config.orderBy || "created_at";
  const requestedOrderBy = c.req.query("orderBy");
  if (!requestedOrderBy) return fallbackOrderBy;

  const orderableColumns = new Set([
    fallbackOrderBy,
    "created_at",
    "updated_at",
    ...(config.filterableColumns || []),
  ].filter(Boolean));

  return orderableColumns.has(requestedOrderBy) ? requestedOrderBy : fallbackOrderBy;
}

function isAppDataSchemaRetryable(config: AppDataAccessConfig, error: AppDataError | null) {
  const text = [
    error?.code,
    error?.message,
    error?.details,
    error?.hint,
  ].filter(Boolean).join(" ").toLowerCase();

  if (
    (config.table === "ad_account_assignments" || config.table === "ad_account_owner_assignments") &&
    text.includes("notes") &&
    text.includes("schema cache")
  ) {
    return true;
  }

  if (config.table !== "leads") return false;

  return (
    text.includes("pgrst204") ||
    text.includes("42703") ||
    text.includes("schema cache") ||
    [
      "social_platform",
      "social_username",
      "social_profile_url",
      "social_chat_url",
      "embed_form_id",
      "embed_form_submission_id",
      "embed_form_slug",
      "embed_form_name",
      "service_id",
      "affiliate_id",
      "origin",
      "landing_page_url",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
    ].some((column) => text.includes(column))
  );
}

function withoutAppDataDraftColumns(config: AppDataAccessConfig, payload: AppDataPayload) {
  if (config.table === "ad_account_assignments" || config.table === "ad_account_owner_assignments") {
    const { notes: _notes, ...rest } = payload;
    return rest;
  }

  if (config.table === "leads") {
    const {
      social_platform: _social_platform,
      social_username: _social_username,
      social_profile_url: _social_profile_url,
      social_chat_url: _social_chat_url,
      embed_form_id: _embed_form_id,
      embed_form_submission_id: _embed_form_submission_id,
      embed_form_slug: _embed_form_slug,
      embed_form_name: _embed_form_name,
      service_id: _service_id,
      affiliate_id: _affiliate_id,
      origin: _origin,
      landing_page_url: _landing_page_url,
      utm_source: _utm_source,
      utm_medium: _utm_medium,
      utm_campaign: _utm_campaign,
      utm_term: _utm_term,
      utm_content: _utm_content,
      ...rest
    } = payload;
    return rest;
  }

  return payload;
}

async function requireAppDataAccess(
  c: Context,
  config: AppDataAccessConfig,
  action: "read" | "create" | "edit" | "delete",
  deps: RegisterAppDataRoutesDependencies,
) {
  const permissions = action === "read"
    ? config.read
    : action === "create"
      ? config.create
      : action === "edit"
        ? config.edit
        : config.delete;

  if (!permissions?.length) {
    return { requester: null, response: c.json({ error: "Forbidden" }, 403) };
  }

  return deps.requireAuthorizedRequester(c, permissions);
}

export function registerAppDataRoutes(app: Hono, deps: RegisterAppDataRoutesDependencies) {
  app.get("/make-server-f781cd00/app-data/:type", async (c) => {
    const type = c.req.param("type");
    const config = getAppDataAccessConfig(type);
    if (!config) return c.json({ error: "Unknown app data type" }, 404);

    const auth = await requireAppDataAccess(c, config, "read", deps);
    if (auth.response) return auth.response;

    try {
      const { from, to } = getAppDataRange(c, config);
      const orderBy = getAppDataOrderBy(c, config);
      const ascending = parseBooleanFlag(c.req.query("ascending"), Boolean(config.ascending));

      let query = deps.supabase
        .from(config.table)
        .select("*")
        .order(orderBy, { ascending });

      query = applyAppDataFilters(query, c, config).range(from, to);

      let { data, error } = await query;

      if (error && error.code === "42703") {
        let retryQuery = deps.supabase
          .from(config.table)
          .select("*");
        retryQuery = applyAppDataFilters(retryQuery, c, config).range(from, to);
        const retry = await retryQuery;
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      return c.json({
        rows: data || [],
        range: { from, to },
        rowCount: data?.length || 0,
      });
    } catch (err: unknown) {
      return c.json({ error: getAppDataErrorMessage(err, "Gagal memuat app data.") }, 500);
    }
  });

  app.post("/make-server-f781cd00/app-data/:type", async (c) => {
    const type = c.req.param("type");
    const config = getAppDataAccessConfig(type);
    if (!config) return c.json({ error: "Unknown app data type" }, 404);

    const auth = await requireAppDataAccess(c, config, "create", deps);
    if (auth.response) return auth.response;

    try {
      const payload = await c.req.json() as AppDataPayload;
      if (config.table === "leads") {
        await deps.assertNoBlockingLeadDuplicate(payload);
      }

      let { data, error } = await deps.supabase
        .from(config.table)
        .insert(payload)
        .select()
        .single();

      if (error && isAppDataSchemaRetryable(config, error)) {
        const retry = await deps.supabase
          .from(config.table)
          .insert(withoutAppDataDraftColumns(config, payload))
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      const actor = auth.requester?.actorName || "System";
      deps.runBackgroundTask(
        `audit create ${type}`,
        deps.logActivity(actor, `Create ${type}`, `Created ${type} ${String(payload.id || "")}`, "System"),
      );

      return c.json({ row: data }, 201);
    } catch (err: unknown) {
      return c.json({ error: getAppDataErrorMessage(err, "Gagal menyimpan app data.") }, deps.getHttpErrorStatus(err));
    }
  });

  app.put("/make-server-f781cd00/app-data/:type/:id", async (c) => {
    const type = c.req.param("type");
    const id = c.req.param("id");
    const config = getAppDataAccessConfig(type);
    if (!config) return c.json({ error: "Unknown app data type" }, 404);

    const auth = await requireAppDataAccess(c, config, "edit", deps);
    if (auth.response) return auth.response;

    try {
      const payload = await c.req.json() as AppDataPayload;
      if (config.table === "leads") {
        await deps.assertNoBlockingLeadDuplicate(payload, id);
      }

      let { data, error } = await deps.supabase
        .from(config.table)
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      if (error && isAppDataSchemaRetryable(config, error)) {
        const retry = await deps.supabase
          .from(config.table)
          .update(withoutAppDataDraftColumns(config, payload))
          .eq("id", id)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      const actor = auth.requester?.actorName || "System";
      deps.runBackgroundTask(
        `audit update ${type}`,
        deps.logActivity(actor, `Update ${type}`, `Updated ${type} ${id}`, "System"),
      );

      return c.json({ row: data });
    } catch (err: unknown) {
      return c.json({ error: getAppDataErrorMessage(err, "Gagal memperbarui app data.") }, deps.getHttpErrorStatus(err));
    }
  });

  app.delete("/make-server-f781cd00/app-data/:type/:id", async (c) => {
    const type = c.req.param("type");
    const id = c.req.param("id");
    const config = getAppDataAccessConfig(type);
    if (!config) return c.json({ error: "Unknown app data type" }, 404);

    const auth = await requireAppDataAccess(c, config, "delete", deps);
    if (auth.response) return auth.response;

    try {
      const { error } = await deps.supabase
        .from(config.table)
        .delete()
        .eq("id", id);
      if (error) throw error;

      const actor = auth.requester?.actorName || "System";
      deps.runBackgroundTask(
        `audit delete ${type}`,
        deps.logActivity(actor, `Delete ${type}`, `Deleted ${type} ${id}`, "System"),
      );

      return c.json({ success: true });
    } catch (err: unknown) {
      return c.json({ error: getAppDataErrorMessage(err, "Gagal menghapus app data.") }, 500);
    }
  });
}
