-- Phase 9 security/RLS foundation hardening.
--
-- This migration intentionally keeps authenticated client access for tables that
-- the current frontend still reads/writes directly. It removes anonymous access
-- from internal data, locks backend-only payment transactions, and leaves
-- purpose-built public embed-form policies untouched.

begin;

-- Internal app tables should not be reachable by anonymous clients.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'leads',
    'orders',
    'prospect_bookings',
    'technician_schedules',
    'daily_ads',
    'lead_spam_daily_inputs',
    'payment_methods',
    'finance_categories',
    'finance_accounts',
    'operational_expense_categories',
    'operational_expense_ledger',
    'ad_account_assignments',
    'ad_account_owner_assignments',
    'ad_api_accounts',
    'ad_account_api_mappings',
    'proof_assets',
    'crm_contacts',
    'crm_contact_links',
    'whatsapp_conversations',
    'whatsapp_messages',
    'whatsapp_contacts',
    'audit_logs',
    'manual_debts',
    'vendors',
    'roles',
    'affiliates',
    'cancel_reasons',
    'wa_templates'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all on table public.%I from anon', table_name);
    end if;
  end loop;
end $$;

-- Payment provider transactions are backend-only. The UI should go through the
-- server/payment flow, not mutate provider payloads directly from the browser.
do $$
begin
  if to_regclass('public.payment_transactions') is not null then
    alter table public.payment_transactions enable row level security;

    revoke all on table public.payment_transactions from anon, authenticated;
    grant select, insert, update, delete on table public.payment_transactions to service_role;

    drop policy if exists "Public access payment transactions" on public.payment_transactions;
    drop policy if exists "Authenticated access payment transactions" on public.payment_transactions;
    drop policy if exists "Service role manages payment transactions" on public.payment_transactions;

    create policy "Service role manages payment transactions"
      on public.payment_transactions
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- Keep public logo reads, but make sure old anonymous write policies cannot
-- remain active if migrations were applied out of order.
do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists "Public upload bank logos" on storage.objects;
    drop policy if exists "Public update bank logos" on storage.objects;
    drop policy if exists "Public delete bank logos" on storage.objects;
    drop policy if exists "App access upload proof asset objects" on storage.objects;
    drop policy if exists "App access update proof asset objects" on storage.objects;
    drop policy if exists "App access delete proof asset objects" on storage.objects;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
