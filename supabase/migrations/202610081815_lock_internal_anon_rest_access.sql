-- Close remaining anonymous REST access to internal operational tables.
--
-- Phase 9 already revoked direct `anon` grants, but older migrations and live
-- projects can still have grants/policies through PUBLIC or broad public/anon
-- policies. Keep authenticated access broad for now because several active
-- screens still use direct Supabase reads/writes until those flows are moved
-- fully behind typed server APIs.

begin;

do $$
declare
  table_name text;
  policy_record record;
begin
  foreach table_name in array array[
    'profiles',
    'branches',
    'services',
    'vehicle_types',
    'leads',
    'orders',
    'prospect_bookings',
    'technician_schedules',
    'technician_daily_reports',
    'daily_ads',
    'daily_ads_sync_runs',
    'lead_spam_daily_inputs',
    'payment_methods',
    'finance_categories',
    'finance_accounts',
    'recurring_expenses',
    'recurring_expense_payments',
    'operational_expense_categories',
    'operational_expenses',
    'operational_expense_ledger',
    'manual_debts',
    'ad_platforms',
    'ad_sub_channels',
    'ad_sources',
    'ad_accounts',
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
    'vendors',
    'roles',
    'role_permissions',
    'permissions',
    'user_custom_permissions',
    'affiliates',
    'cancel_reasons',
    'wa_templates',
    'products',
    'stock_units',
    'stock_transactions',
    'notifications',
    'kv_store_f781cd00'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);

      -- PUBLIC grants also apply to anon. Remove them, then grant the active
      -- app roles explicitly.
      execute format('revoke all privileges on table public.%I from public', table_name);
      execute format('revoke all privileges on table public.%I from anon', table_name);
      execute format('grant select, insert, update, delete on table public.%I to authenticated, service_role', table_name);

      -- Drop policies that can be used by anonymous clients. A policy with
      -- role PUBLIC effectively includes anon, even when table grants were
      -- later tightened.
      for policy_record in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and (
            'public' = any(roles)
            or 'anon' = any(roles)
            or lower(policyname) like 'public access%'
          )
      loop
        execute format('drop policy if exists %I on public.%I', policy_record.policyname, table_name);
      end loop;

      execute format('drop policy if exists %I on public.%I', 'Authenticated access ' || table_name, table_name);
      execute format(
        'create policy %I on public.%I for all to authenticated using (true) with check (true)',
        'Authenticated access ' || table_name,
        table_name
      );
    end if;
  end loop;
end $$;

-- Tables managed through Edge Functions stay service-role only. Do not broaden
-- these back to authenticated direct browser access.
do $$
declare
  table_name text;
  policy_record record;
begin
  foreach table_name in array array[
    'payment_transactions',
    'payroll_runs',
    'payroll_run_items',
    'salary_profiles',
    'kpi_library',
    'employee_kpi_assignments',
    'payroll_deductions',
    'cs_okr_targets',
    'daily_ads_duplicate_archive'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);

      execute format('revoke all privileges on table public.%I from public', table_name);
      execute format('revoke all privileges on table public.%I from anon, authenticated', table_name);
      execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);

      for policy_record in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and (
            'public' = any(roles)
            or 'anon' = any(roles)
            or 'authenticated' = any(roles)
            or (
              'service_role' = any(roles)
              and lower(policyname) like 'service role manages%'
            )
            or lower(policyname) like 'public access%'
            or lower(policyname) like 'authenticated access%'
          )
      loop
        execute format('drop policy if exists %I on public.%I', policy_record.policyname, table_name);
      end loop;

      execute format('drop policy if exists %I on public.%I', 'Service role manages ' || table_name, table_name);
      execute format(
        'create policy %I on public.%I for all to service_role using (true) with check (true)',
        'Service role manages ' || table_name,
        table_name
      );
    end if;
  end loop;
end $$;

-- Snapshot/reporting tables are readable by authenticated users, but writes
-- stay server-side.
do $$
declare
  table_name text;
  policy_record record;
begin
  foreach table_name in array array[
    'ads_live_daily_snapshots',
    'owner_profitability_daily_recaps',
    'owner_profitability_daily_details'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);

      execute format('revoke all privileges on table public.%I from public', table_name);
      execute format('revoke all privileges on table public.%I from anon', table_name);
      execute format('revoke insert, update, delete on table public.%I from authenticated', table_name);
      execute format('grant select on table public.%I to authenticated', table_name);
      execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);

      for policy_record in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and (
            'public' = any(roles)
            or 'anon' = any(roles)
            or 'authenticated' = any(roles)
            or lower(policyname) like 'public access%'
          )
      loop
        execute format('drop policy if exists %I on public.%I', policy_record.policyname, table_name);
      end loop;

      execute format('drop policy if exists %I on public.%I', 'Authenticated read ' || table_name, table_name);
      execute format(
        'create policy %I on public.%I for select to authenticated using (true)',
        'Authenticated read ' || table_name,
        table_name
      );
    end if;
  end loop;
end $$;

-- Public embed form tables intentionally keep limited anon access. Public
-- pages call Edge Functions, but these scoped policies preserve compatibility
-- with existing embed snippets without exposing internal leads/orders.
do $$
begin
  if to_regclass('public.embed_lead_forms') is not null then
    revoke all privileges on table public.embed_lead_forms from public;
    revoke all privileges on table public.embed_lead_forms from anon;
    grant select on table public.embed_lead_forms to anon;
    grant update (round_robin_cursor, last_routed_cs_id, last_routed_at) on public.embed_lead_forms to anon;
    grant select, insert, update, delete on table public.embed_lead_forms to authenticated, service_role;

    drop policy if exists "Public access embed lead forms" on public.embed_lead_forms;
    drop policy if exists "Public read active embed lead forms" on public.embed_lead_forms;
    drop policy if exists "Public update active embed lead form routing" on public.embed_lead_forms;
    drop policy if exists "Authenticated access embed lead forms" on public.embed_lead_forms;

    create policy "Public read active embed lead forms"
      on public.embed_lead_forms
      for select
      to anon
      using (status = 'active');

    create policy "Public update active embed lead form routing"
      on public.embed_lead_forms
      for update
      to anon
      using (status = 'active')
      with check (status = 'active');

    create policy "Authenticated access embed lead forms"
      on public.embed_lead_forms
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.embed_lead_form_fields') is not null then
    revoke all privileges on table public.embed_lead_form_fields from public;
    revoke all privileges on table public.embed_lead_form_fields from anon;
    grant select on table public.embed_lead_form_fields to anon;
    grant select, insert, update, delete on table public.embed_lead_form_fields to authenticated, service_role;

    drop policy if exists "Public access embed lead form fields" on public.embed_lead_form_fields;
    drop policy if exists "Public read active embed lead form fields" on public.embed_lead_form_fields;
    drop policy if exists "Authenticated access embed lead form fields" on public.embed_lead_form_fields;

    create policy "Public read active embed lead form fields"
      on public.embed_lead_form_fields
      for select
      to anon
      using (
        is_visible = true
        and exists (
          select 1
          from public.embed_lead_forms forms
          where forms.id = embed_lead_form_fields.form_id
            and forms.status = 'active'
        )
      );

    create policy "Authenticated access embed lead form fields"
      on public.embed_lead_form_fields
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.embed_lead_form_cs_routes') is not null then
    revoke all privileges on table public.embed_lead_form_cs_routes from public;
    revoke all privileges on table public.embed_lead_form_cs_routes from anon;
    grant select on table public.embed_lead_form_cs_routes to anon;
    grant select, insert, update, delete on table public.embed_lead_form_cs_routes to authenticated, service_role;

    drop policy if exists "Public access embed lead form cs routes" on public.embed_lead_form_cs_routes;
    drop policy if exists "Public read active embed lead form cs routes" on public.embed_lead_form_cs_routes;
    drop policy if exists "Authenticated access embed lead form cs routes" on public.embed_lead_form_cs_routes;

    create policy "Public read active embed lead form cs routes"
      on public.embed_lead_form_cs_routes
      for select
      to anon
      using (
        status = 'active'
        and exists (
          select 1
          from public.embed_lead_forms forms
          where forms.id = embed_lead_form_cs_routes.form_id
            and forms.status = 'active'
        )
      );

    create policy "Authenticated access embed lead form cs routes"
      on public.embed_lead_form_cs_routes
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.embed_lead_form_submissions') is not null then
    revoke all privileges on table public.embed_lead_form_submissions from public;
    revoke all privileges on table public.embed_lead_form_submissions from anon;
    grant insert on table public.embed_lead_form_submissions to anon;
    grant update (lead_id, lead_payload, status, processed_at, error_message)
      on public.embed_lead_form_submissions
      to anon;
    grant select, insert, update, delete on table public.embed_lead_form_submissions to authenticated, service_role;

    drop policy if exists "Public access embed lead form submissions" on public.embed_lead_form_submissions;
    drop policy if exists "Public insert embed lead form submissions" on public.embed_lead_form_submissions;
    drop policy if exists "Public update recent embed lead form submissions" on public.embed_lead_form_submissions;
    drop policy if exists "Authenticated access embed lead form submissions" on public.embed_lead_form_submissions;

    create policy "Public insert embed lead form submissions"
      on public.embed_lead_form_submissions
      for insert
      to anon
      with check (
        exists (
          select 1
          from public.embed_lead_forms forms
          where forms.id = embed_lead_form_submissions.form_id
            and forms.status = 'active'
        )
      );

    create policy "Public update recent embed lead form submissions"
      on public.embed_lead_form_submissions
      for update
      to anon
      using (
        status = 'received'
        and created_at >= now() - interval '15 minutes'
      )
      with check (
        status in ('received', 'lead_created', 'failed', 'spam', 'duplicate')
        and created_at >= now() - interval '15 minutes'
      );

    create policy "Authenticated access embed lead form submissions"
      on public.embed_lead_form_submissions
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
