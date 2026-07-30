import { createClient, type User as SupabaseAuthUser } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, type PermissionKey } from "../../../src/app/data/permissions.ts";
import { normalizeStoredRolePermissions } from "../../../src/app/data/permissionBackfill.ts";
import type { Role } from "../../../src/app/pages/master-data/data.ts";

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

const VALID_PERMISSION_KEYS = new Set<string>(PERMISSIONS.map((permission) => permission.key));

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
  const mergedPermissions = cloneDefaultRolePermissions();

  try {
    const storedPermissions = await kv.get(GLOBAL_ROLE_PERMISSIONS_KEY);
    if (!storedPermissions || typeof storedPermissions !== "object") {
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

  return mergedPermissions;
}

async function loadUserCustomPermissions(userId: string) {
  try {
    const storedPermissions =
      (await kv.get(`user_perms:${userId}`)) ??
      (await kv.get(`user_permission:${userId}`));

    if (Array.isArray(storedPermissions)) {
      return sanitizePermissionList(storedPermissions);
    }

    if (
      storedPermissions &&
      typeof storedPermissions === "object" &&
      Array.isArray((storedPermissions as { perms?: unknown[] }).perms)
    ) {
      return sanitizePermissionList((storedPermissions as { perms?: unknown[] }).perms);
    }

    if (
      storedPermissions &&
      typeof storedPermissions === "object" &&
      Array.isArray((storedPermissions as { permissions?: unknown[] }).permissions)
    ) {
      return sanitizePermissionList((storedPermissions as { permissions?: unknown[] }).permissions);
    }

    return null;
  } catch (error) {
    console.error("[RequesterAccess] Failed to load user custom permissions:", error);
    return null;
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

  const {
    data: { user: authUser },
    error: authError,
  } = await adminClient.auth.getUser(token);

  if (authError || !authUser) {
    return null;
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, email, name, role")
    .eq("id", authUser.id)
    .maybeSingle();

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

  const customPermissions = await loadUserCustomPermissions(authUser.id);
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
