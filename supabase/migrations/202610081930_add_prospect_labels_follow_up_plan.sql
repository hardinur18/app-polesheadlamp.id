begin;

alter table if exists public.leads
  add column if not exists label_ids uuid[] not null default '{}'::uuid[];

create table if not exists public.prospect_labels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  color text not null default '#2563EB',
  description text,
  status text not null default 'active',
  follow_up_enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prospect_labels_name_not_blank check (length(trim(name)) > 0),
  constraint prospect_labels_slug_not_blank check (length(trim(slug)) > 0),
  constraint prospect_labels_status_check check (status in ('active', 'inactive'))
);

create unique index if not exists prospect_labels_slug_unique_idx
  on public.prospect_labels (lower(slug));

create index if not exists prospect_labels_status_sort_idx
  on public.prospect_labels (status, sort_order, name);

create index if not exists leads_label_ids_gin_idx
  on public.leads using gin (label_ids);

comment on table public.prospect_labels is
  'Master labels for prospect segmentation and follow-up planning.';

comment on column public.leads.label_ids is
  'References prospect_labels.id values for prospect segmentation and follow-up filtering.';

-- Backfill master labels from any earlier free-text labels column if it exists.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'leads'
      and column_name = 'labels'
  ) then
    insert into public.prospect_labels (name, slug, color, description, status, sort_order)
    select
      cleaned.label_name,
      regexp_replace(lower(cleaned.label_name), '[^a-z0-9]+', '-', 'g') as slug,
      '#2563EB',
      'Migrasi otomatis dari label prospek lama.',
      'active',
      row_number() over (order by cleaned.label_name)::integer
    from (
      select distinct trim(label_value) as label_name
      from public.leads
      cross join lateral unnest(labels) as label_value
      where trim(label_value) <> ''
    ) cleaned
    on conflict (lower(slug)) do nothing;

    update public.leads lead
    set label_ids = coalesce(backfilled.label_ids, '{}'::uuid[])
    from (
      select
        lead_source.id,
        array_agg(label.id order by label.name) as label_ids
      from public.leads lead_source
      cross join lateral unnest(lead_source.labels) as label_value
      join public.prospect_labels label
        on lower(label.slug) = lower(regexp_replace(lower(trim(label_value)), '[^a-z0-9]+', '-', 'g'))
      group by lead_source.id
    ) backfilled
    where lead.id = backfilled.id
      and coalesce(array_length(lead.label_ids, 1), 0) = 0;
  end if;
end $$;

alter table if exists public.wa_templates
  add column if not exists follow_up_step integer,
  add column if not exists follow_up_delay_days integer,
  add column if not exists follow_up_is_active boolean not null default true;

alter table if exists public.wa_templates
  drop constraint if exists wa_templates_follow_up_step_check;

alter table if exists public.wa_templates
  add constraint wa_templates_follow_up_step_check
  check (follow_up_step is null or (follow_up_step >= 1 and follow_up_step <= 6));

alter table if exists public.wa_templates
  drop constraint if exists wa_templates_follow_up_delay_days_check;

alter table if exists public.wa_templates
  add constraint wa_templates_follow_up_delay_days_check
  check (follow_up_delay_days is null or follow_up_delay_days >= 0);

with ordered_templates as (
  select
    id,
    row_number() over (
      order by
        case
          when lower(title) like '%salam pertama%' then 1
          when lower(title) like '%sapaan awal%' then 2
          when lower(title) like '%follow up%' then 3
          when lower(title) like '%upsell%' or lower(title) like '%upsel%' then 4
          else 90
        end,
        title
    ) as step_number
  from public.wa_templates
  where category = 'Leads'
    and follow_up_step is null
)
update public.wa_templates template
set
  follow_up_step = case
    when ordered_templates.step_number <= 6 then ordered_templates.step_number
    else null
  end,
  follow_up_delay_days = case ordered_templates.step_number
    when 1 then 0
    when 2 then 1
    when 3 then 3
    when 4 then 7
    when 5 then 14
    when 6 then 21
    else null
  end,
  follow_up_is_active = ordered_templates.step_number <= 6
from ordered_templates
where template.id = ordered_templates.id;

create index if not exists wa_templates_follow_up_plan_idx
  on public.wa_templates (category, follow_up_is_active, follow_up_step);

alter table if exists public.prospect_labels enable row level security;
grant select, insert, update, delete on table public.prospect_labels to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
