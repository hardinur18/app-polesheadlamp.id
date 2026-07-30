create table if not exists public.embed_lead_forms (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  slug text not null,
  public_token text not null default replace(gen_random_uuid()::text, '-', ''),
  description text,
  status text not null default 'draft',
  embed_mode text not null default 'both',
  default_status text not null default 'Pending',
  default_service_id text,
  default_service_name text,
  platform_id text,
  sub_channel_id text,
  advertiser_id text,
  ad_account_id text,
  fallback_cs_id text,
  routing_mode text not null default 'single_cs',
  round_robin_cursor integer not null default 0,
  last_routed_cs_id text,
  last_routed_at timestamptz,
  thank_you_message text,
  redirect_url text,
  submit_button_label text not null default 'Kirim',
  meta_pixel_id text,
  meta_event_name text not null default 'Lead',
  tiktok_pixel_id text,
  tiktok_event_name text not null default 'SubmitForm',
  google_tag_id text,
  google_ads_conversion_id text,
  google_ads_conversion_label text,
  google_event_name text not null default 'conversion',
  tracking_config jsonb not null default '{}'::jsonb,
  theme_config jsonb not null default '{}'::jsonb,
  spam_protection_config jsonb not null default '{}'::jsonb,
  allowed_embed_origins text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint embed_lead_forms_slug_unique unique (slug),
  constraint embed_lead_forms_public_token_unique unique (public_token),
  constraint embed_lead_forms_status_check check (status in ('draft', 'active', 'paused', 'archived')),
  constraint embed_lead_forms_embed_mode_check check (embed_mode in ('iframe', 'script', 'both')),
  constraint embed_lead_forms_default_status_check check (default_status in ('Pending', 'Follow Up', 'Booking', 'Closing', 'Cancel')),
  constraint embed_lead_forms_routing_mode_check check (routing_mode in ('single_cs', 'broadcast', 'random', 'round_robin')),
  constraint embed_lead_forms_round_robin_cursor_check check (round_robin_cursor >= 0),
  constraint embed_lead_forms_slug_format_check check (slug ~ '^[a-z0-9][a-z0-9-]{1,120}[a-z0-9]$')
);

create table if not exists public.embed_lead_form_fields (
  id text primary key default gen_random_uuid()::text,
  form_id text not null references public.embed_lead_forms(id) on delete cascade,
  field_key text not null,
  label text,
  placeholder text,
  help_text text,
  input_type text not null default 'text',
  is_visible boolean not null default true,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  options jsonb not null default '[]'::jsonb,
  validation_config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint embed_lead_form_fields_unique unique (form_id, field_key),
  constraint embed_lead_form_fields_sort_order_check check (sort_order >= 0),
  constraint embed_lead_form_fields_required_visible_check check (not is_required or is_visible),
  constraint embed_lead_form_fields_identity_required_check check (
    field_key not in ('name', 'phone') or is_required = true
  ),
  constraint embed_lead_form_fields_input_type_check check (
    input_type in ('text', 'tel', 'textarea', 'select', 'radio', 'checkbox', 'date', 'url', 'hidden')
  ),
  constraint embed_lead_form_fields_key_check check (
    field_key in (
      'name',
      'phone',
      'platform_id',
      'sub_channel_id',
      'advertiser_id',
      'vehicle_id',
      'affiliate_id',
      'service_id',
      'notes',
      'social_platform',
      'social_username',
      'social_profile_url',
      'social_chat_url'
    )
  )
);

create table if not exists public.embed_lead_form_cs_routes (
  id text primary key default gen_random_uuid()::text,
  form_id text not null references public.embed_lead_forms(id) on delete cascade,
  cs_id text not null,
  status text not null default 'active',
  route_weight integer not null default 1,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint embed_lead_form_cs_routes_unique unique (form_id, cs_id),
  constraint embed_lead_form_cs_routes_status_check check (status in ('active', 'inactive')),
  constraint embed_lead_form_cs_routes_weight_check check (route_weight > 0),
  constraint embed_lead_form_cs_routes_sort_order_check check (sort_order >= 0)
);

create table if not exists public.embed_lead_form_submissions (
  id text primary key default gen_random_uuid()::text,
  form_id text references public.embed_lead_forms(id) on delete set null,
  lead_id text references public.leads(id) on delete set null,
  form_slug text,
  form_name text,
  public_token text,
  customer_name text not null,
  customer_phone text not null,
  service_id text,
  service_name text,
  platform_id text,
  sub_channel_id text,
  advertiser_id text,
  ad_account_id text,
  vehicle_id text,
  affiliate_id text,
  notes text,
  field_answers jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  lead_payload jsonb not null default '{}'::jsonb,
  tracking_context jsonb not null default '{}'::jsonb,
  routing_context jsonb not null default '{}'::jsonb,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  landing_page_url text,
  referrer_url text,
  user_agent text,
  ip_address inet,
  status text not null default 'received',
  routing_mode text,
  routed_cs_id text,
  routed_cs_ids text[] not null default '{}'::text[],
  error_message text,
  duplicate_of_submission_id text references public.embed_lead_form_submissions(id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint embed_lead_form_submissions_status_check check (
    status in ('received', 'lead_created', 'failed', 'spam', 'duplicate')
  ),
  constraint embed_lead_form_submissions_routing_mode_check check (
    routing_mode is null or routing_mode in ('single_cs', 'broadcast', 'random', 'round_robin')
  )
);

create index if not exists embed_lead_forms_status_idx
  on public.embed_lead_forms(status);

create index if not exists embed_lead_forms_advertiser_idx
  on public.embed_lead_forms(advertiser_id);

create index if not exists embed_lead_forms_platform_idx
  on public.embed_lead_forms(platform_id);

create index if not exists embed_lead_form_fields_form_sort_idx
  on public.embed_lead_form_fields(form_id, sort_order);

create index if not exists embed_lead_form_cs_routes_form_status_idx
  on public.embed_lead_form_cs_routes(form_id, status, sort_order);

create index if not exists embed_lead_form_cs_routes_cs_idx
  on public.embed_lead_form_cs_routes(cs_id);

create index if not exists embed_lead_form_submissions_form_created_idx
  on public.embed_lead_form_submissions(form_id, created_at desc);

create index if not exists embed_lead_form_submissions_lead_idx
  on public.embed_lead_form_submissions(lead_id);

create index if not exists embed_lead_form_submissions_status_idx
  on public.embed_lead_form_submissions(status);

create index if not exists embed_lead_form_submissions_phone_idx
  on public.embed_lead_form_submissions(customer_phone);

create index if not exists embed_lead_form_submissions_advertiser_idx
  on public.embed_lead_form_submissions(advertiser_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_embed_lead_forms_updated_at on public.embed_lead_forms;
create trigger set_embed_lead_forms_updated_at
  before update on public.embed_lead_forms
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_embed_lead_form_fields_updated_at on public.embed_lead_form_fields;
create trigger set_embed_lead_form_fields_updated_at
  before update on public.embed_lead_form_fields
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_embed_lead_form_cs_routes_updated_at on public.embed_lead_form_cs_routes;
create trigger set_embed_lead_form_cs_routes_updated_at
  before update on public.embed_lead_form_cs_routes
  for each row
  execute function public.set_updated_at();

create or replace function public.seed_required_embed_lead_form_fields()
returns trigger as $$
begin
  insert into public.embed_lead_form_fields (
    form_id,
    field_key,
    label,
    placeholder,
    input_type,
    is_visible,
    is_required,
    sort_order
  )
  values
    (new.id, 'name', 'Nama Customer', 'Nama lengkap', 'text', true, true, 10),
    (new.id, 'phone', 'No. WhatsApp', '08xxxxxxxxxx', 'tel', true, true, 20)
  on conflict (form_id, field_key) do update
    set is_visible = true,
        is_required = true,
        updated_at = now();

  return new;
end;
$$ language plpgsql;

drop trigger if exists seed_required_embed_lead_form_fields on public.embed_lead_forms;
create trigger seed_required_embed_lead_form_fields
  after insert on public.embed_lead_forms
  for each row
  execute function public.seed_required_embed_lead_form_fields();

alter table if exists public.leads
  add column if not exists embed_form_id text,
  add column if not exists embed_form_submission_id text,
  add column if not exists embed_form_slug text,
  add column if not exists embed_form_name text,
  add column if not exists service_id text,
  add column if not exists affiliate_id text,
  add column if not exists origin text default 'manual',
  add column if not exists landing_page_url text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term text,
  add column if not exists utm_content text;

do $$
begin
  if to_regclass('public.leads') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'leads_embed_form_id_fkey'
        and conrelid = 'public.leads'::regclass
    ) then
      alter table public.leads
        add constraint leads_embed_form_id_fkey
        foreign key (embed_form_id)
        references public.embed_lead_forms(id)
        on delete set null;
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'leads_embed_form_submission_id_fkey'
        and conrelid = 'public.leads'::regclass
    ) then
      alter table public.leads
        add constraint leads_embed_form_submission_id_fkey
        foreign key (embed_form_submission_id)
        references public.embed_lead_form_submissions(id)
        on delete set null;
    end if;

    create index if not exists leads_embed_form_id_idx
      on public.leads(embed_form_id);

    create index if not exists leads_embed_form_submission_id_idx
      on public.leads(embed_form_submission_id);

    create index if not exists leads_service_id_idx
      on public.leads(service_id);

    create index if not exists leads_affiliate_id_idx
      on public.leads(affiliate_id);

    create index if not exists leads_origin_idx
      on public.leads(origin);
  end if;
end
$$;

comment on table public.embed_lead_forms is 'Public embeddable lead forms for advertiser landing pages.';
comment on table public.embed_lead_form_fields is 'Visible Prospek fields enabled per embedded lead form.';
comment on table public.embed_lead_form_cs_routes is 'CS recipients used by single, broadcast, random, and round-robin routing modes.';
comment on table public.embed_lead_form_submissions is 'Audit log for every embedded lead form submission before or after creating a Prospek row.';
comment on column public.embed_lead_forms.embed_mode is 'Which embed snippets should be available: iframe, script, or both.';
comment on column public.embed_lead_forms.default_service_id is 'Default product/service attached to submissions from this form.';
comment on column public.embed_lead_forms.routing_mode is 'single_cs, broadcast, random, or round_robin.';
comment on column public.embed_lead_forms.tracking_config is 'Provider-specific tracking overrides beyond the first-class Meta, TikTok, and Google fields.';
comment on column public.embed_lead_form_fields.field_key is 'Must match a supported Prospek/lead field key.';
comment on column public.embed_lead_form_submissions.field_answers is 'Normalized answers for enabled fields on the embed form.';

grant select, insert, update, delete
  on public.embed_lead_forms,
     public.embed_lead_form_fields,
     public.embed_lead_form_cs_routes,
     public.embed_lead_form_submissions
  to anon, authenticated, service_role;

alter table public.embed_lead_forms enable row level security;
alter table public.embed_lead_form_fields enable row level security;
alter table public.embed_lead_form_cs_routes enable row level security;
alter table public.embed_lead_form_submissions enable row level security;

drop policy if exists "Public access embed lead forms" on public.embed_lead_forms;
create policy "Public access embed lead forms"
  on public.embed_lead_forms
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);

drop policy if exists "Public access embed lead form fields" on public.embed_lead_form_fields;
create policy "Public access embed lead form fields"
  on public.embed_lead_form_fields
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);

drop policy if exists "Public access embed lead form cs routes" on public.embed_lead_form_cs_routes;
create policy "Public access embed lead form cs routes"
  on public.embed_lead_form_cs_routes
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);

drop policy if exists "Public access embed lead form submissions" on public.embed_lead_form_submissions;
create policy "Public access embed lead form submissions"
  on public.embed_lead_form_submissions
  for all
  to anon, authenticated, service_role
  using (true)
  with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'embed_lead_forms'
  ) then
    alter publication supabase_realtime add table public.embed_lead_forms;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'embed_lead_form_fields'
  ) then
    alter publication supabase_realtime add table public.embed_lead_form_fields;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'embed_lead_form_cs_routes'
  ) then
    alter publication supabase_realtime add table public.embed_lead_form_cs_routes;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'embed_lead_form_submissions'
  ) then
    alter publication supabase_realtime add table public.embed_lead_form_submissions;
  end if;
end
$$;
