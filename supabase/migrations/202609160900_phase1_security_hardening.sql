-- Phase 1 security foundation hardening.
--
-- Goals:
-- - Remove anonymous full CRUD from internal tables that were previously public.
-- - Keep authenticated direct-client access temporarily where the current app still depends on it.
-- - Preserve public embed-form submissions with column-limited grants.

-- CRM contacts are internal customer records.
do $$
begin
  if to_regclass('public.crm_contacts') is not null then
    revoke all on public.crm_contacts from anon;
    drop policy if exists "Public access crm contacts" on public.crm_contacts;
    drop policy if exists "Authenticated access crm contacts" on public.crm_contacts;
    create policy "Authenticated access crm contacts"
      on public.crm_contacts
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.crm_contact_links') is not null then
    revoke all on public.crm_contact_links from anon;
    drop policy if exists "Public access crm contact links" on public.crm_contact_links;
    drop policy if exists "Authenticated access crm contact links" on public.crm_contact_links;
    create policy "Authenticated access crm contact links"
      on public.crm_contact_links
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- WhatsApp inbox storage is internal operational data.
do $$
begin
  if to_regclass('public.whatsapp_conversations') is not null then
    revoke all on public.whatsapp_conversations from anon;
    drop policy if exists "Public access whatsapp conversations" on public.whatsapp_conversations;
    drop policy if exists "Authenticated access whatsapp conversations" on public.whatsapp_conversations;
    create policy "Authenticated access whatsapp conversations"
      on public.whatsapp_conversations
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.whatsapp_messages') is not null then
    revoke all on public.whatsapp_messages from anon;
    drop policy if exists "Public access whatsapp messages" on public.whatsapp_messages;
    drop policy if exists "Authenticated access whatsapp messages" on public.whatsapp_messages;
    create policy "Authenticated access whatsapp messages"
      on public.whatsapp_messages
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.whatsapp_contacts') is not null then
    revoke all on public.whatsapp_contacts from anon;
    drop policy if exists "Public access whatsapp contacts" on public.whatsapp_contacts;
    drop policy if exists "Authenticated access whatsapp contacts" on public.whatsapp_contacts;
    create policy "Authenticated access whatsapp contacts"
      on public.whatsapp_contacts
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- Proof asset metadata should not be anonymously mutable.
do $$
begin
  if to_regclass('public.proof_assets') is not null then
    revoke all on public.proof_assets from anon;
    drop policy if exists "App access read proof assets" on public.proof_assets;
    drop policy if exists "App access create proof assets" on public.proof_assets;
    drop policy if exists "App access update proof assets" on public.proof_assets;
    drop policy if exists "App access delete proof assets" on public.proof_assets;
    drop policy if exists "Authenticated access proof assets" on public.proof_assets;
    create policy "Authenticated access proof assets"
      on public.proof_assets
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- Public embed forms need public read/submit only, not full public CRUD.
do $$
begin
  if to_regclass('public.embed_lead_forms') is not null then
    revoke all on public.embed_lead_forms from anon;
    grant select on public.embed_lead_forms to anon;
    grant update (round_robin_cursor, last_routed_cs_id, last_routed_at) on public.embed_lead_forms to anon;

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
    revoke all on public.embed_lead_form_fields from anon;
    grant select on public.embed_lead_form_fields to anon;

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
    revoke all on public.embed_lead_form_cs_routes from anon;
    grant select on public.embed_lead_form_cs_routes to anon;

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
    revoke all on public.embed_lead_form_submissions from anon;
    grant insert on public.embed_lead_form_submissions to anon;
    grant update (lead_id, lead_payload, status, processed_at, error_message) on public.embed_lead_form_submissions to anon;

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

-- Finance master data is internal.
do $$
begin
  if to_regclass('public.finance_categories') is not null then
    revoke all on public.finance_categories from anon;
    drop policy if exists finance_categories_select_all on public.finance_categories;
    drop policy if exists finance_categories_insert_all on public.finance_categories;
    drop policy if exists finance_categories_update_all on public.finance_categories;
    drop policy if exists finance_categories_delete_all on public.finance_categories;
    drop policy if exists "Authenticated access finance categories" on public.finance_categories;
    create policy "Authenticated access finance categories"
      on public.finance_categories
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.finance_accounts') is not null then
    revoke all on public.finance_accounts from anon;
    drop policy if exists finance_accounts_select_all on public.finance_accounts;
    drop policy if exists finance_accounts_insert_all on public.finance_accounts;
    drop policy if exists finance_accounts_update_all on public.finance_accounts;
    drop policy if exists finance_accounts_delete_all on public.finance_accounts;
    drop policy if exists "Authenticated access finance accounts" on public.finance_accounts;
    create policy "Authenticated access finance accounts"
      on public.finance_accounts
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- Ad-account assignment and API registry tables are internal configuration.
do $$
begin
  if to_regclass('public.ad_account_assignments') is not null then
    revoke all on public.ad_account_assignments from anon;
    drop policy if exists "Public access ad account assignments" on public.ad_account_assignments;
    drop policy if exists "Authenticated access ad account assignments" on public.ad_account_assignments;
    create policy "Authenticated access ad account assignments"
      on public.ad_account_assignments
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.ad_account_owner_assignments') is not null then
    revoke all on public.ad_account_owner_assignments from anon;
    drop policy if exists "Public access ad account owner assignments" on public.ad_account_owner_assignments;
    drop policy if exists "Authenticated access ad account owner assignments" on public.ad_account_owner_assignments;
    create policy "Authenticated access ad account owner assignments"
      on public.ad_account_owner_assignments
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.ad_api_accounts') is not null then
    revoke all on public.ad_api_accounts from anon;
    drop policy if exists "Public access ad api accounts" on public.ad_api_accounts;
    drop policy if exists "Authenticated access ad api accounts" on public.ad_api_accounts;
    create policy "Authenticated access ad api accounts"
      on public.ad_api_accounts
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.ad_account_api_mappings') is not null then
    revoke all on public.ad_account_api_mappings from anon;
    drop policy if exists "Public access ad account api mappings" on public.ad_account_api_mappings;
    drop policy if exists "Authenticated access ad account api mappings" on public.ad_account_api_mappings;
    create policy "Authenticated access ad account api mappings"
      on public.ad_account_api_mappings
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- Misc internal operational tables that had anonymous full CRUD in early migrations.
do $$
begin
  if to_regclass('public.lead_spam_daily_inputs') is not null then
    revoke all on public.lead_spam_daily_inputs from anon;
    drop policy if exists "Public access lead spam daily inputs" on public.lead_spam_daily_inputs;
    drop policy if exists "Authenticated access lead spam daily inputs" on public.lead_spam_daily_inputs;
    create policy "Authenticated access lead spam daily inputs"
      on public.lead_spam_daily_inputs
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.prospect_bookings') is not null then
    revoke all on public.prospect_bookings from anon;
    drop policy if exists "Public access prospect bookings" on public.prospect_bookings;
    drop policy if exists "Authenticated access prospect bookings" on public.prospect_bookings;
    create policy "Authenticated access prospect bookings"
      on public.prospect_bookings
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if to_regclass('public.operational_expense_categories') is not null then
    revoke all on public.operational_expense_categories from anon;
  end if;

  if to_regclass('public.operational_expense_ledger') is not null then
    revoke all on public.operational_expense_ledger from anon;
  end if;
end $$;

-- Storage object policies: keep public reads only where they are part of the product,
-- but remove anonymous upload/update/delete.
do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists "App access read proof asset objects" on storage.objects;
    drop policy if exists "App access upload proof asset objects" on storage.objects;
    drop policy if exists "App access update proof asset objects" on storage.objects;
    drop policy if exists "App access delete proof asset objects" on storage.objects;
    drop policy if exists "Authenticated read proof asset objects" on storage.objects;
    drop policy if exists "Authenticated upload proof asset objects" on storage.objects;
    drop policy if exists "Authenticated update proof asset objects" on storage.objects;
    drop policy if exists "Authenticated delete proof asset objects" on storage.objects;

    create policy "Authenticated read proof asset objects"
      on storage.objects
      for select
      to authenticated
      using (bucket_id = 'proof-assets');

    create policy "Authenticated upload proof asset objects"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'proof-assets');

    create policy "Authenticated update proof asset objects"
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'proof-assets')
      with check (bucket_id = 'proof-assets');

    create policy "Authenticated delete proof asset objects"
      on storage.objects
      for delete
      to authenticated
      using (bucket_id = 'proof-assets');

    drop policy if exists "Public upload bank logos" on storage.objects;
    drop policy if exists "Public update bank logos" on storage.objects;
    drop policy if exists "Public delete bank logos" on storage.objects;
    drop policy if exists "Authenticated upload bank logos" on storage.objects;
    drop policy if exists "Authenticated update bank logos" on storage.objects;
    drop policy if exists "Authenticated delete bank logos" on storage.objects;

    create policy "Authenticated upload bank logos"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'payment-method-logos');

    create policy "Authenticated update bank logos"
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'payment-method-logos')
      with check (bucket_id = 'payment-method-logos');

    create policy "Authenticated delete bank logos"
      on storage.objects
      for delete
      to authenticated
      using (bucket_id = 'payment-method-logos');
  end if;
end $$;
