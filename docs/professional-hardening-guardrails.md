# Professional Hardening Guardrails

This project has active production workflows, so modernization work should keep existing business behavior intact unless a change is explicitly approved.

## Safe By Default

- Preserve existing CRUD behavior, Supabase payload shapes, route IDs, role permissions, and order/status transitions.
- Prefer visual polish, naming cleanup, build hygiene, and documentation before touching data flow.
- Keep each change small enough to review and roll back independently.
- Do not edit unrelated dirty files while there are local user changes.

## Requires Explicit Approval

- Routing fallback changes.
- Permission or role landing changes.
- Supabase table, edge function, or KV write behavior changes.
- Order, lead, stock, payment, payroll, or reporting calculations.
- Dependency upgrades that can change runtime behavior.

## Verification Baseline

For no-logic polish changes, run:

```bash
npm run lint
npm run typecheck
npm run build
```

For logic or architecture work, add targeted smoke checks for the affected role and workflow before merging.
