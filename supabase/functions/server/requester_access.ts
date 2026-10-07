import { createClient, type User as SupabaseAuthUser } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, type PermissionKey } from "../../../src/app/data/permissions.ts";
import { normalizeStoredRolePermissions } from "../../../src/app/data/permissionBackfill.ts";
import type { Role } from "../../../src/app/pages/master-data/data.ts";

const GLOBAL_ROLE_PERMISSIONS_KEY = "global_role_perms:11111111-1111-4111-a111-111111111111";
const ROLE_KEYS = Object.keys(DEFAULT_ROLE_PERMISSIONS) as Role[];
const AUTH_USER_CACHE_TTL_MS = 60_000;
const AUTH_USER_TIMEOUT_MS = 3_000;
const ROLE_PERMISSIONS_CACHE_TTL_MS = 60_000;
const USER_CUSTOM_PERMISSIONS_CACHE_TTL_MS = 30_000;
const REQUESTER_PROFILE_TIMEOUT_MS = 4_000;

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

const VALID_PERMISSION_KEYS = new Set<string>(PERMISSIONS.map((permission) => permission.key));

let rolePermissionsCache:
  | { value: Record<Role, PermissionKey[]>; expiresAt: number }
  | null = null;
const authUserCache = new Map<string, { value: SupabaseAuthUser; expiresAt: number }>();
const userCustomPermissionsCache = new Map<string, { value: PermissionKey[] | null; expiresAt: number }>();

type RequesterProfile = {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

export type RequesterAccessContext = {
  authUser: SupabaseAuthUser;
  profile: RequesterProfile | null;
  role: Role | undefined;
  isOwner: boolean;
  customPermissions: PermissionKey[] | null;
  permissions: Set<PermissionKey>;
  actorName: string;
};

function resolveRole(value: unknown): Role | undefined {
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;

  return ROLE_ALIASES[normalized];
}

function getRequesterToken(headers: Headers): string {
  const clientTokenHeader = headers.get("x-client-token");
  if (clientTokenHeader?.trim()) {
    return clientTokenHeader.trim();
  }

  const authorizationHeader = headers.get("Authorization");
  if (authorizationHeader?.startsWith("Bearer ")) {
    return authorizationHeader.slice(7).trim();
  }

  return "";
}

function decodeJwtPayload(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );
    return JSON.parse(atob(paddedPayload)) as { exp?: number };
  } catch {
    return null;
  }
}

function getTokenCacheExpiry(token: string, now = Date.now()) {
  const expMs = Number(decodeJwtPayload(token)?.exp || 0) * 1000;
  const ttlExpiry = now + AUTH_USER_CACHE_TTL_MS;
  return expMs > 0 ? Math.min(expMs, ttlExpiry) : ttlExpiry;
}

async function loadAuthUser(adminClient: Awaited<ReturnType<typeof createAdminClient>>, token: string) {
  if (!adminClient) return null;

  const now = Date.now();
  const cached = authUserCache.get(token);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const timeout = new Promise<{ timedOut: true }>((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), AUTH_USER_TIMEOUT_MS);
    });
    const result = await Promise.race([
      adminClient.auth.getUser(token),
      timeout,
    ]);

    if ("timedOut" in result) {
      console.warn("[RequesterAccess] Auth user lookup timed out.");
      return null;
    }

    const {
      data: { user },
      error,
    } = result;

    if (error || !user) {
      return null;
    }

    authUserCache.set(token, {
      value: user,
      expiresAt: getTokenCacheExpiry(token, now),
    });

    return user;
  } catch (error) {
    console.warn("[RequesterAccess] Auth user lookup failed.", error instanceof Error ? error.message : error);
    return null;
  }
}

function sanitizePermissionList(values: unknown): PermissionKey[] {
  if (!Array.isArray(values)) return [];

  const normalized = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value): value is PermissionKey => Boolean(value) && VALID_PERMISSION_KEYS.has(value));

  return Array.from(new Set(normalized));
}

function cloneDefaultRolePermissions() {
  return Object.fromEntries(
    ROLE_KEYS.map((role) => [role, [...DEFAULT_ROLE_PERMISSIONS[role]]]),
  ) as Record<Role, PermissionKey[]>;
}

async function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[RequesterAccess] SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib dikonfigurasi.");
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

async function loadRolePermissionsMap() {
  const now = Date.now();
  if (rolePermissionsCache && rolePermissionsCache.expiresAt > now) {
    return cloneRolePermissionsMap(rolePermissionsCache.value);
  }

  const mergedPermissions = cloneDefaultRolePermissions();

  try {
    const storedPermissions = await kv.get(GLOBAL_ROLE_PERMISSIONS_KEY);
    if (!storedPermissions || typeof storedPermissions !== "object") {
      rolePermissionsCache = {
        value: cloneRolePermissionsMap(mergedPermissions),
        expiresAt: now + ROLE_PERMISSIONS_CACHE_TTL_MS,
      };
      return mergedPermissions;
    }

    Object.entries(storedPermissions as Record<string, unknown>).forEach(([roleKey, permissions]) => {
      if (roleKey === "id" || roleKey === "type") return;

      const normalizedRole = resolveRole(roleKey);
      if (!normalizedRole) return;

      mergedPermissions[normalizedRole] = normalizeStoredRolePermissions(normalizedRole, permissions);
    });
  } catch (error) {
    console.error("[RequesterAccess] Failed to load role permissions:", error);
  }

  rolePermissionsCache = {
    value: cloneRolePermissionsMap(mergedPermissions),
    expiresAt: now + ROLE_PERMISSIONS_CACHE_TTL_MS,
  };

  return mergedPermissions;
}

async function loadUserCustomPermissions(userId: string) {
  const now = Date.now();
  const cached = userCustomPermissionsCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.value === null ? null : [...cached.value];
  }

  try {
    const storedPermissions =
      (await kv.get(`user_perms:${userId}`)) ??
      (await kv.get(`user_permission:${userId}`));

    if (Array.isArray(storedPermissions)) {
      return cacheUserCustomPermissions(userId, sanitizePermissionList(storedPermissions), now);
    }

    if (
      storedPermissions &&
      typeof storedPermissions === "object" &&
      Array.isArray((storedPermissions as { perms?: unknown[] }).perms)
    ) {
      return cacheUserCustomPermissions(
        userId,
        sanitizePermissionList((storedPermissions as { perms?: unknown[] }).perms),
        now,
      );
    }

    if (
      storedPermissions &&
      typeof storedPermissions === "object" &&
      Array.isArray((storedPermissions as { permissions?: unknown[] }).permissions)
    ) {
      return cacheUserCustomPermissions(
        userId,
        sanitizePermissionList((storedPermissions as { permissions?: unknown[] }).permissions),
        now,
      );
    }

    return cacheUserCustomPermissions(userId, null, now);
  } catch (error) {
    console.error("[RequesterAccess] Failed to load user custom permissions:", error);
    return null;
  }
}

function cloneRolePermissionsMap(value: Record<Role, PermissionKey[]>) {
  return Object.fromEntries(
    ROLE_KEYS.map((role) => [role, [...(value[role] || [])]]),
  ) as Record<Role, PermissionKey[]>;
}

function cacheUserCustomPermissions(userId: string, value: PermissionKey[] | null, now = Date.now()) {
  const cachedValue = value === null ? null : [...value];
  userCustomPermissionsCache.set(userId, {
    value: cachedValue,
    expiresAt: now + USER_CUSTOM_PERMISSIONS_CACHE_TTL_MS,
  });
  return cachedValue === null ? null : [...cachedValue];
}

async function loadRequesterProfile(adminClient: Awaited<ReturnType<typeof createAdminClient>>, userId: string) {
  if (!adminClient) return null;

  const abortController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeout = new Promise<{ timedOut: true }>((resolve) => {
      timeoutId = setTimeout(() => {
        abortController.abort();
        resolve({ timedOut: true });
      }, REQUESTER_PROFILE_TIMEOUT_MS);
    });

    const result = await Promise.race([
      adminClient
        .from("profiles")
        .select("id, email, name, role")
        .eq("id", userId)
        .abortSignal(abortController.signal)
        .maybeSingle(),
      timeout,
    ]);

    if ("timedOut" in result) {
      console.warn("[RequesterAccess] Profile lookup timed out; falling back to auth metadata.", { userId });
      return null;
    }

    if (result.error) {
      console.warn("[RequesterAccess] Profile lookup failed; falling back to auth metadata.", {
        userId,
        error: result.error.message,
      });
      return null;
    }

    return (result.data || null) as RequesterProfile | null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("abort")) {
      console.warn("[RequesterAccess] Profile lookup threw; falling back to auth metadata.", {
        userId,
        error: message,
      });
    }
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function getRequesterAccessContext(headers: Headers): Promise<RequesterAccessContext | null> {
  const token = getRequesterToken(headers);
  if (!token) {
    return null;
  }

  const adminClient = await createAdminClient();
  if (!adminClient) {
    return null;
  }

  const authUser = await loadAuthUser(adminClient, token);
  if (!authUser) {
    return null;
  }

  const profile = await loadRequesterProfile(adminClient, authUser.id);

  const normalizedRole = resolveRole(profile?.role || authUser.user_metadata?.role);
  const isOwner = normalizedRole === "Owner";

  if (isOwner) {
    return {
      authUser,
      profile,
      role: normalizedRole,
      isOwner,
      customPermissions: null,
      permissions: new Set<PermissionKey>(DEFAULT_ROLE_PERMISSIONS.Owner),
      actorName:
        String(profile?.name || authUser.user_metadata?.name || authUser.email || "System").trim() || "System",
    };
  }

  const storedCustomPermissions = await loadUserCustomPermissions(authUser.id);
  const customPermissions =
    storedCustomPermissions !== null && normalizedRole
      ? normalizeStoredRolePermissions(normalizedRole, storedCustomPermissions)
      : storedCustomPermissions;
  const rolePermissionsMap = customPermissions === null ? await loadRolePermissionsMap() : null;
  const rolePermissions = normalizedRole && rolePermissionsMap ? rolePermissionsMap[normalizedRole] || [] : [];

  return {
    authUser,
    profile,
    role: normalizedRole,
    isOwner,
    customPermissions,
    permissions: new Set<PermissionKey>(customPermissions ?? rolePermissions),
    actorName:
      String(profile?.name || authUser.user_metadata?.name || authUser.email || "System").trim() || "System",
  };
}

export function hasEffectivePermission(requester: RequesterAccessContext | null, permission: PermissionKey) {
  if (!requester) return false;
  if (requester.isOwner) return true;
  return requester.permissions.has(permission);
}

export function isOwnerRole(value: unknown) {
  return resolveRole(value) === "Owner";
}
