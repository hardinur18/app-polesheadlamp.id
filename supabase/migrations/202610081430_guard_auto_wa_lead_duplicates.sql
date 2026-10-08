-- Guard future exact active lead duplicates at database level.
-- Existing duplicate rows are intentionally left untouched for manual review/merge.

create or replace function public.normalize_lead_duplicate_phone(value text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(value, ''), '\D', '', 'g');

  if digits = '' then
    return '';
  end if;

  if digits like '620%' then
    return '62' || substr(digits, 4);
  end if;

  if digits like '0%' then
    return '62' || substr(digits, 2);
  end if;

  if digits like '8%' then
    return '62' || digits;
  end if;

  return digits;
end;
$$;

create or replace function public.normalize_lead_duplicate_name(value text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(btrim(coalesce(value, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.prevent_exact_active_lead_duplicate()
returns trigger
language plpgsql
as $$
declare
  existing_label text;
  duplicate_phone text;
  duplicate_name text;
begin
  if new.status not in ('Pending', 'Follow Up', 'Booking') then
    return new;
  end if;

  duplicate_phone := public.normalize_lead_duplicate_phone(new.phone);
  duplicate_name := public.normalize_lead_duplicate_name(new.name);

  if duplicate_phone = '' or duplicate_name = '' then
    return new;
  end if;

  select coalesce(nullif(l.name, ''), l.id)
    into existing_label
  from public.leads l
  where l.id is distinct from new.id
    and l.status in ('Pending', 'Follow Up', 'Booking')
    and public.normalize_lead_duplicate_phone(l.phone) = duplicate_phone
    and public.normalize_lead_duplicate_name(l.name) = duplicate_name
  limit 1;

  if existing_label is not null then
    raise exception 'Nomor dan nama yang sama sudah ada sebagai prospek aktif untuk %.', existing_label
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_exact_active_lead_duplicate on public.leads;
create trigger trg_prevent_exact_active_lead_duplicate
before insert or update of name, phone, status on public.leads
for each row execute function public.prevent_exact_active_lead_duplicate();

create unique index if not exists idx_leads_exact_active_duplicate_guard_20261008
  on public.leads (
    public.normalize_lead_duplicate_phone(phone),
    public.normalize_lead_duplicate_name(name)
  )
  where status in ('Pending', 'Follow Up', 'Booking')
    and public.normalize_lead_duplicate_phone(phone) <> ''
    and public.normalize_lead_duplicate_name(name) <> ''
    and created_at >= timestamptz '2026-10-08 00:00:00+00';

create or replace view public.active_lead_exact_duplicate_audit as
select
  public.normalize_lead_duplicate_phone(phone) as normalized_phone,
  public.normalize_lead_duplicate_name(name) as normalized_name,
  count(*) as duplicate_count,
  min(created_at) as first_created_at,
  max(created_at) as last_created_at,
  array_agg(id order by created_at asc) as lead_ids,
  array_agg(name order by created_at asc) as lead_names,
  array_agg(phone order by created_at asc) as lead_phones,
  array_agg(status order by created_at asc) as lead_statuses,
  array_agg(cs_id order by created_at asc) as cs_ids
from public.leads
where status in ('Pending', 'Follow Up', 'Booking')
  and public.normalize_lead_duplicate_phone(phone) <> ''
  and public.normalize_lead_duplicate_name(name) <> ''
group by 1, 2
having count(*) > 1;

comment on index public.idx_leads_exact_active_duplicate_guard_20261008 is
  'Prevents new exact active lead duplicates by normalized phone + name without mutating historical duplicates.';

comment on view public.active_lead_exact_duplicate_audit is
  'Lists existing exact active duplicate leads so CS/owner can review and merge/cancel manually.';
