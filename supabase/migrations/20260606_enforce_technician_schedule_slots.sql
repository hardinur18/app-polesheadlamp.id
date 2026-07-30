create or replace function public.normalize_schedule_time(value text)
returns text
language plpgsql
immutable
as $$
declare
  raw_value text;
  match text[];
  hours integer;
  minutes integer;
begin
  if value is null then
    return null;
  end if;

  raw_value := replace(regexp_replace(btrim(value), '\s+', '', 'g'), '.', ':');
  if raw_value = '' then
    return null;
  end if;

  match := regexp_match(raw_value, '^(\d{1,2})(?::?(\d{2}))?$');
  if match is null then
    return raw_value;
  end if;

  hours := match[1]::integer;
  minutes := coalesce(match[2], '00')::integer;

  if hours < 0 or hours > 23 or minutes < 0 or minutes > 59 then
    return raw_value;
  end if;

  return lpad(hours::text, 2, '0') || ':' || lpad(minutes::text, 2, '0');
end;
$$;

create index if not exists orders_technician_service_date_idx
  on public.orders(technician_id, service_date);

create index if not exists prospect_bookings_technician_schedule_date_idx
  on public.prospect_bookings(technician_id, schedule_date);

do $$
begin
  if to_regclass('public.technician_schedules') is not null then
    execute 'create index if not exists technician_schedules_user_date_idx on public.technician_schedules(user_id, date)';

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'technician_schedules'
    ) then
      alter publication supabase_realtime add table public.technician_schedules;
    end if;
  end if;
end;
$$;

create or replace function public.prevent_duplicate_active_order_schedule_slot()
returns trigger
language plpgsql
as $$
declare
  slot_time text;
  customer_label text;
begin
  if new.status in ('cancelled', 'reschedule') then
    return new;
  end if;

  if new.technician_id is null or new.service_date is null or new.service_time is null then
    return new;
  end if;

  slot_time := public.normalize_schedule_time(new.service_time);
  if slot_time is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.technician_id::text || '|' || new.service_date::text || '|' || slot_time));

  select coalesce(nullif(o.customer_name, ''), o.id)
    into customer_label
  from public.orders o
  where o.id is distinct from new.id
    and o.status not in ('cancelled', 'reschedule')
    and o.technician_id::text = new.technician_id::text
    and o.service_date::text = new.service_date::text
    and public.normalize_schedule_time(o.service_time) = slot_time
  limit 1;

  if customer_label is not null then
    raise exception 'Jadwal bentrok. Slot % sudah terisi order aktif untuk %.', slot_time, customer_label
      using errcode = '23505';
  end if;

  select coalesce(nullif(b.customer_name, ''), b.id)
    into customer_label
  from public.prospect_bookings b
  where b.order_id is null
    and (new.lead_id is null or b.lead_id is distinct from new.lead_id)
    and b.status not in ('cancelled', 'reschedule')
    and b.technician_id::text = new.technician_id::text
    and b.schedule_date::text = new.service_date::text
    and public.normalize_schedule_time(b.schedule_time) = slot_time
  limit 1;

  if customer_label is not null then
    raise exception 'Jadwal bentrok. Slot % sudah terisi booking prospek aktif untuk %.', slot_time, customer_label
      using errcode = '23505';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_duplicate_active_prospect_booking_slot()
returns trigger
language plpgsql
as $$
declare
  slot_time text;
  customer_label text;
begin
  if new.order_id is not null or new.status in ('cancelled', 'reschedule') then
    return new;
  end if;

  if new.technician_id is null then
    raise exception 'Teknisi wajib dipilih untuk booking prospek aktif.'
      using errcode = '23502';
  end if;

  if new.schedule_date is null or new.schedule_time is null then
    return new;
  end if;

  slot_time := public.normalize_schedule_time(new.schedule_time);
  if slot_time is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.technician_id::text || '|' || new.schedule_date::text || '|' || slot_time));

  select coalesce(nullif(o.customer_name, ''), o.id)
    into customer_label
  from public.orders o
  where o.status not in ('cancelled', 'reschedule')
    and o.technician_id::text = new.technician_id::text
    and o.service_date::text = new.schedule_date::text
    and public.normalize_schedule_time(o.service_time) = slot_time
  limit 1;

  if customer_label is not null then
    raise exception 'Jadwal bentrok. Slot % sudah terisi order aktif untuk %.', slot_time, customer_label
      using errcode = '23505';
  end if;

  select coalesce(nullif(b.customer_name, ''), b.id)
    into customer_label
  from public.prospect_bookings b
  where b.id is distinct from new.id
    and b.order_id is null
    and b.status not in ('cancelled', 'reschedule')
    and b.technician_id::text = new.technician_id::text
    and b.schedule_date::text = new.schedule_date::text
    and public.normalize_schedule_time(b.schedule_time) = slot_time
  limit 1;

  if customer_label is not null then
    raise exception 'Jadwal bentrok. Slot % sudah terisi booking prospek aktif untuk %.', slot_time, customer_label
      using errcode = '23505';
  end if;

  return new;
end;
$$;

create or replace function public.link_matching_prospect_booking_to_order()
returns trigger
language plpgsql
as $$
declare
  slot_time text;
begin
  if new.status in ('cancelled', 'reschedule') then
    return new;
  end if;

  if new.lead_id is null or new.technician_id is null or new.service_date is null or new.service_time is null then
    return new;
  end if;

  slot_time := public.normalize_schedule_time(new.service_time);
  if slot_time is null then
    return new;
  end if;

  update public.prospect_bookings b
  set order_id = new.id,
      status = 'confirmed',
      updated_at = timezone('utc'::text, now())
  where b.order_id is null
    and b.status not in ('cancelled', 'reschedule')
    and b.lead_id = new.lead_id
    and b.technician_id::text = new.technician_id::text
    and b.schedule_date::text = new.service_date::text
    and public.normalize_schedule_time(b.schedule_time) = slot_time;

  return new;
end;
$$;

drop trigger if exists prevent_duplicate_active_order_schedule_slot on public.orders;
create trigger prevent_duplicate_active_order_schedule_slot
  before insert or update of lead_id, technician_id, service_date, service_time, status
  on public.orders
  for each row
  execute function public.prevent_duplicate_active_order_schedule_slot();

drop trigger if exists link_matching_prospect_booking_to_order on public.orders;
create trigger link_matching_prospect_booking_to_order
  after insert or update of lead_id, technician_id, service_date, service_time, status
  on public.orders
  for each row
  execute function public.link_matching_prospect_booking_to_order();

drop trigger if exists prevent_duplicate_active_prospect_booking_slot on public.prospect_bookings;
create trigger prevent_duplicate_active_prospect_booking_slot
  before insert or update of technician_id, schedule_date, schedule_time, status, order_id
  on public.prospect_bookings
  for each row
  execute function public.prevent_duplicate_active_prospect_booking_slot();

with ranked_matches as (
  select
    b.id as booking_id,
    o.id as order_id,
    row_number() over (partition by b.id order by o.id desc) as match_rank
  from public.prospect_bookings b
  join public.orders o
    on o.lead_id = b.lead_id
   and o.status not in ('cancelled', 'reschedule')
   and o.technician_id::text = b.technician_id::text
   and o.service_date::text = b.schedule_date::text
   and public.normalize_schedule_time(o.service_time) = public.normalize_schedule_time(b.schedule_time)
  where b.order_id is null
    and b.status not in ('cancelled', 'reschedule')
)
update public.prospect_bookings b
set order_id = ranked_matches.order_id,
    status = 'confirmed',
    updated_at = timezone('utc'::text, now())
from ranked_matches
where ranked_matches.booking_id = b.id
  and ranked_matches.match_rank = 1;
