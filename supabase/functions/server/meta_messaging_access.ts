import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getRequesterAccessContext,
  hasEffectivePermission,
} from "./requester_access.ts";
import type { RequesterAccessContext } from "./requester_access.ts";
import type { PermissionKey } from "../../../src/app/data/permissions.ts";

export type MessagingPermissionAccess =
  | { requester: RequesterAccessContext; error?: never }
  | { error: Response; requester?: never };

export type MessagingPermissionOrInternalSyncAccess =
  | MessagingPermissionAccess
  | { requester: null; internal: true; error?: never };

export async function checkAuth(req: Request) {
  let token = req.headers.get("x-client-token");
  if (!token) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return { error: "Missing Authorization header" };
    token = authHeader.replace("Bearer ", "");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAuthKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseAuthKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: `Invalid token: ${error?.message || "Unknown"}` };
  }

  return { user };
}

export async function requireMessagingPermission(
  c: any,
  permission: PermissionKey,
): Promise<MessagingPermissionAccess> {
  const requester = await getRequesterAccessContext(c.req.raw.headers);
  if (!requester) {
    return { error: c.json({ error: "Missing or invalid Authorization header" }, 401) };
  }
  if (!hasEffectivePermission(requester, permission)) {
    return { error: c.json({ error: "Forbidden: Insufficient WhatsApp permission" }, 403) };
  }

  return { requester };
}

export async function requireAnyMessagingPermission(
  c: any,
  permissions: PermissionKey[],
): Promise<MessagingPermissionAccess> {
  const requester = await getRequesterAccessContext(c.req.raw.headers);
  if (!requester) {
    return { error: c.json({ error: "Missing or invalid Authorization header" }, 401) };
  }
  if (!permissions.some((permission) => hasEffectivePermission(requester, permission))) {
    return { error: c.json({ error: "Forbidden: Insufficient WhatsApp permission" }, 403) };
  }

  return { requester };
}

function isInternalMessagingSyncRequest(c: any) {
  const token =
    c.req.header("x-internal-sync-token")?.trim() ||
    c.req.header("x-sync-token")?.trim() ||
    "";
  const expectedToken =
    Deno.env.get("WHATSAPP_INTERNAL_SYNC_TOKEN")?.trim() ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
    "";

  return Boolean(expectedToken && token && token === expectedToken);
}

export async function requireAnyMessagingPermissionOrInternalSync(
  c: any,
  permissions: PermissionKey[],
): Promise<MessagingPermissionOrInternalSyncAccess> {
  if (isInternalMessagingSyncRequest(c)) {
    return { requester: null, internal: true };
  }

  return requireAnyMessagingPermission(c, permissions);
}
