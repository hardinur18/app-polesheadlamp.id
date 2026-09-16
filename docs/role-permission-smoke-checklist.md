# Role Permission Smoke Checklist

Last updated: 2026-09-16

Use this checklist after permission changes, new role presets, or Supabase function deployments.

## Setup

- Test with one real account per role: Owner, Super Admin, Admin PIC, Finance, CS, Teknisi, Advertiser.
- Sign out and sign in again before each role test so the permission snapshot is fresh.
- For API checks, use the same browser session token and verify protected endpoints return `403` for denied roles, not business data.

## Global Expectations

- Unauthenticated requests to protected Edge Function routes return `401`.
- Authenticated users without the required permission return `403`.
- Frontend navigation hides tabs before the permission snapshot loads.
- Owner and Super Admin can access every route.
- Audit logs are limited to Owner, Super Admin, and Admin PIC by default.
- Legacy `/conversations/*` routes and `/meta/messaging/*` inbox routes require WhatsApp permissions, not only Prospek permissions.

## Role Matrix

| Area | Owner | Super Admin | Admin PIC | Finance | CS | Teknisi | Advertiser |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Permissions / role admin | Allow | Allow | Deny unless custom | Deny | Deny | Deny | Deny |
| Audit logs | Allow | Allow | Allow | Deny | Deny | Deny | Deny |
| Marketing monitoring read | Allow | Allow | Allow | Allow | Allow | Deny | Allow |
| Google/TikTok token health | Allow | Allow | Allow | Allow | Allow | Deny | Allow |
| Google/TikTok integration config write | Allow | Allow | Deny unless `ads.manage` | Deny unless `ads.manage` | Deny | Deny | Allow |
| WhatsApp/Live Chat read | Allow | Allow | Deny unless `whatsapp.view` | Deny unless `whatsapp.view` | Deny unless `whatsapp.view` | Deny | Deny unless `whatsapp.view` |
| WhatsApp/Live Chat reply | Allow | Allow | Deny unless `whatsapp.chats.reply` | Deny | Deny unless `whatsapp.chats.reply` | Deny | Deny |
| Finance/payroll | Allow | Allow | Deny unless custom | Allow | Deny | Deny | Deny |
| Technician mobile | Allow | Allow | Deny unless custom | Deny | Deny | Allow | Deny |

## Endpoint Smoke Checks

- `GET /make-server-f781cd00/permissions/me`
- `GET /make-server-f781cd00/google/token-health`
- `GET /make-server-f781cd00/google/snapshots?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /make-server-f781cd00/google/integration-configs/:adAccountId`
- `GET /make-server-f781cd00/tiktok/token-health`
- `GET /make-server-f781cd00/tiktok/report-integrated?advertiserId=...&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /make-server-f781cd00/tiktok/integration-configs/:adAccountId`
- `GET /make-server-f781cd00/meta/messaging/inbox/overview`
- `POST /make-server-f781cd00/meta/messaging/send`
- `GET /make-server-f781cd00/reports`
- `GET /make-server-f781cd00/expand-url?url=https%3A%2F%2Fexample.com`

## Frontend Route Smoke Checks

- `/audit-logs` only opens for Owner, Super Admin, and Admin PIC.
- `/ads/monitoring` opens for roles with `monitoring.marketing.view`.
- `/conversations/inbox` and `/whatsapp/chats` only open for roles with `whatsapp.view`.
- `/whatsapp/contacts` only opens for roles with `whatsapp.view`.
- `/finance` and payroll pages only open for finance permissions.
- `/teknisi-mobile` only opens for `teknisi.view_mobile`.

## Notes

- Default role permissions are intentionally conservative for WhatsApp. Grant `whatsapp.view` and `whatsapp.chats.reply` explicitly to CS accounts that operate Live Chat.
- Residual browser-side Supabase paths are tracked in the release verification checklist until they are fully moved behind guarded server routes or verified by production RLS/storage policies.
- Broad authenticated database policies are not solved in Phase 2. They remain tracked for Phase 3.
