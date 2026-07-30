alter table if exists public.leads
  add column if not exists origin text default 'manual';

update public.leads
set origin = 'manual'
where origin is null;

create index if not exists leads_origin_idx
  on public.leads(origin);

create index if not exists leads_auto_wa_lookup_idx
  on public.leads(last_contact, created_at desc)
  where last_contact = 'Auto WA API';

comment on column public.leads.origin is 'Lead source marker, including auto_wa_api for WhatsApp auto-created leads.';
