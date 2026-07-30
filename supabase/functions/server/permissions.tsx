import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import { getRequesterAccessContext, hasEffectivePermission } from "./requester_access.ts";
import { DEFAULT_ROLE_PERMISSIONS, type PermissionKey } from "../../../src/app/data/permissions.ts";
import { normalizeStoredRolePermissions, sanitizePermissionList } from "../../../src/app/data/permissionBackfill.ts";
import type { Role } from "../../../src/app/pages/master-data/data.ts";

const app = new Hono();
const GLOBAL_ROLE_PERMISSIONS_KEY = "global_role_perms:11111111-1111-4111-a111-111111111111";
const ROLE_KEYS = Object.keys(DEFAULT_ROLE_PERMISSIONS) as Role[];
const ROLE_ALIASES: Record<string, Role> = {
  owner: "Owner",
  "super admin": "Super Admin",
  super_admin: "Super Admin",
  "admin pic": "Admin PIC",
  admin_pic: "Admin PIC",
  admin: "Admin PIC",
  cs: "CS",
  "customer service": "CS",
  advertiser: "Advertiser",
  teknisi: "Teknisi",
  technician: "Teknisi",
  finance: "Finance",
};

const applyNoStoreHeaders = (c: any) => {
  c.header("Cache-Control", "no-store, no-cache, must-revalidate, private");
  c.header("Pragma", "no-cache");
  c.header("Expires", "0");
};

function resolveRole(value: unknown): Role | undefined {
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;

  return ROLE_ALIASES[normalized];
}

function cloneDefaultRolePermissions() {
  return Object.fromEntries(
    ROLE_KEYS.map((role) => [role, [...DEFAULT_ROLE_PERMISSIONS[role]]]),
  ) as Record<Role, PermissionKey[]>;
}

function hasSamePermissionSet(left: PermissionKey[], right: PermissionKey[]) {
  if (left.length !== right.length) return false;

  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();

  return leftSorted.every((permission, index) => permission === rightSorted[index]);
}

async function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

  return createClient(supabaseUrl, supabaseServiceKey);
}

async function loadRolePermissionsMap() {
  const mergedPermissions = cloneDefaultRolePermissions();
  const storedPermissions = await kv.get(GLOBAL_ROLE_PERMISSIONS_KEY);

  if (storedPermissions && typeof storedPermissions === "object") {
    Object.entries(storedPermissions as Record<string, unknown>).forEach(([roleKey, permissions]) => {
      if (roleKey === "id" || roleKey === "type") return;

      const normalizedRole = resolveRole(roleKey);
      if (!normalizedRole) return;

      mergedPermissions[normalizedRole] = normalizeStoredRolePermissions(normalizedRole, permissions);
    });
  }

  return mergedPermissions;
}

function normalizeGlobalRolePayload(body: Record<string, unknown>) {
  const providedByRole = {} as Partial<Record<Role, unknown>>;

  Object.entries(body).forEach(([roleKey, permissions]) => {
    if (roleKey === "id" || roleKey === "type") return;

    const normalizedRole = resolveRole(roleKey);
    if (normalizedRole) {
      providedByRole[normalizedRole] = permissions;
    }
  });

  return {
    id: "11111111-1111-4111-a111-111111111111",
    type: "global_roles",
    ...Object.fromEntries(
      ROLE_KEYS.map((role) => [
        role,
        normalizeStoredRolePermissions(role, providedByRole[role] ?? DEFAULT_ROLE_PERMISSIONS[role]),
      ]),
    ),
  };
}

function extractStoredUserPermissions(value: unknown) {
  if (Array.isArray(value)) return sanitizePermissionList(value);

  if (value && typeof value === "object") {
    const record = value as { perms?: unknown; permissions?: unknown };
    if (Array.isArray(record.perms)) return sanitizePermissionList(record.perms);
    if (Array.isArray(record.permissions)) return sanitizePermissionList(record.permissions);
  }

  return null;
}

async function getTargetRolePermissions(userId: string) {
  const adminClient = await createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  const normalizedRole = resolveRole(profile?.role);
  if (!normalizedRole) return null;

  const rolePermissionsMap = await loadRolePermissionsMap();
  return rolePermissionsMap[normalizedRole] || [];
}

// Handle OPTIONS explicitly to ensure preflight works
app.options("/*", () => new Response(null, { status: 204 }));

app.get("/me", async (c) => {
  try {
    applyNoStoreHeaders(c);
    const requester = await getRequesterAccessContext(c.req.raw.headers);
    if (!requester) return c.json({ error: "Unauthorized" }, 401);

    return c.json({
      data: {
        role: requester.role || null,
        isOwner: requester.isOwner,
        customPermissions: requester.customPermissions,
        effectivePermissions: Array.from(requester.permissions),
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET: Fetch Global Role Permissions
app.get("/global", async (c) => {
  try {
    applyNoStoreHeaders(c);
    const requester = await getRequesterAccessContext(c.req.raw.headers);
    if (!requester) return c.json({ error: "Unauthorized" }, 401);
    if (!hasEffectivePermission(requester, "role_permissions.view") && !hasEffectivePermission(requester, "role_permissions.manage")) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const rolePermissions = await loadRolePermissionsMap();
    return c.json({ data: rolePermissions });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST: Save Global Role Permissions
app.post("/global", async (c) => {
  try {
    const requester = await getRequesterAccessContext(c.req.raw.headers);
    if (!requester) return c.json({ error: "Unauthorized" }, 401);
    if (!hasEffectivePermission(requester, "role_permissions.manage")) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const body = await c.req.json();
    const sanitizedPayload = normalizeGlobalRolePayload(
      body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {},
    );
    await kv.set(GLOBAL_ROLE_PERMISSIONS_KEY, sanitizedPayload);

    return c.json({ success: true, data: sanitizedPayload });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET: Fetch Global Role Settings
app.get("/settings", async (c) => {
  try {
    applyNoStoreHeaders(c);
    const requester = await getRequesterAccessContext(c.req.raw.headers);
    if (!requester) return c.json({ error: "Unauthorized" }, 401);
    if (!hasEffectivePermission(requester, "role_permissions.view") && !hasEffectivePermission(requester, "role_permissions.manage")) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const value = await kv.get("global_role_settings:1");
    return c.json({ data: value || {} });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST: Save Global Role Settings
app.post("/settings", async (c) => {
  try {
    const requester = await getRequesterAccessContext(c.req.raw.headers);
    if (!requester) return c.json({ error: "Unauthorized" }, 401);
    if (!hasEffectivePermission(requester, "role_permissions.manage")) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const body = await c.req.json();
    await kv.set("global_role_settings:1", body);

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET: Fetch Specific User's Custom Permissions
app.get("/user/:id", async (c) => {
  try {
    applyNoStoreHeaders(c);
    const userId = c.req.param("id");
    if (!userId) return c.json({ error: "Missing user id" }, 400);

    const requester = await getRequesterAccessContext(c.req.raw.headers);
    if (!requester) return c.json({ error: "Unauthorized" }, 401);
    if (requester.authUser.id !== userId && !hasEffectivePermission(requester, "role_permissions.manage")) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const value =
      (await kv.get(`user_perms:${userId}`)) ??
      (await kv.get(`user_permission:${userId}`));
    const permissions = extractStoredUserPermissions(value);

    if (!permissions) {
      return c.json({ data: null });
    }

    return c.json({
      data: {
        id: userId,
        type: "custom_perms",
        perms: permissions,
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// POST: Set Specific User's Custom Permissions
app.post("/user/:id", async (c) => {
  try {
    const requester = await getRequesterAccessContext(c.req.raw.headers);
    if (!requester) return c.json({ error: "Unauthorized" }, 401);
    if (!hasEffectivePermission(requester, "role_permissions.manage")) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const userId = c.req.param("id");
    if (!userId) return c.json({ error: "Missing user id" }, 400);

    const body = await c.req.json();
    const sanitizedPermissions = sanitizePermissionList(body?.perms);
    const hasCustomPayload = body?.perms !== null && body?.perms !== undefined;

    if (body?.perms !== null && body?.perms !== undefined && !Array.isArray(body.perms)) {
      return c.json({ error: "Invalid format: perms must be an array or null" }, 400);
    }

    if (!hasCustomPayload || body?.perms === null) {
      await kv.del(`user_perms:${userId}`);
      await kv.del(`user_permission:${userId}`);
    } else {
      const targetRolePermissions = await getTargetRolePermissions(userId);

      if (targetRolePermissions && hasSamePermissionSet(sanitizedPermissions, targetRolePermissions)) {
        await kv.del(`user_perms:${userId}`);
        await kv.del(`user_permission:${userId}`);
      } else {
        await kv.set(`user_perms:${userId}`, {
          id: userId,
          type: "custom_perms",
          perms: sanitizedPermissions,
        });
      }
    }

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
