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

  if new.branch_id is null or new.technician_id is null or new.service_date is null or new.service_time is null then
    return new;
  end if;

  slot_time := public.normalize_schedule_time(new.service_time);
  if slot_time is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.branch_id::text || '|' || new.technician_id::text || '|' || new.service_date::text || '|' || slot_time));

  select o.customer_name
    into customer_label
  from public.orders o
  where o.id is distinct from new.id
    and o.status not in ('cancelled', 'reschedule')
    and o.branch_id::text = new.branch_id::text
    and o.technician_id::text = new.technician_id::text
    and o.service_date::text = new.service_date::text
    and public.normalize_schedule_time(o.service_time) = slot_time
  limit 1;

  if customer_label is not null then
    raise exception 'Jadwal bentrok. Slot % sudah terisi order aktif untuk %.', slot_time, customer_label
      using errcode = '23505';
  end if;

  select b.customer_name
    into customer_label
  from public.prospect_bookings b
  where b.order_id is null
    and b.status not in ('cancelled', 'reschedule')
    and b.branch_id::text = new.branch_id::text
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

  if new.branch_id is null or new.technician_id is null or new.schedule_date is null or new.schedule_time is null then
    return new;
  end if;

  slot_time := public.normalize_schedule_time(new.schedule_time);
  if slot_time is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.branch_id::text || '|' || new.technician_id::text || '|' || new.schedule_date::text || '|' || slot_time));

  select o.customer_name
    into customer_label
  from public.orders o
  where o.status not in ('cancelled', 'reschedule')
    and o.branch_id::text = new.branch_id::text
    and o.technician_id::text = new.technician_id::text
    and o.service_date::text = new.schedule_date::text
    and public.normalize_schedule_time(o.service_time) = slot_time
  limit 1;

  if customer_label is not null then
    raise exception 'Jadwal bentrok. Slot % sudah terisi order aktif untuk %.', slot_time, customer_label
      using errcode = '23505';
  end if;

  select b.customer_name
    into customer_label
  from public.prospect_bookings b
  where b.id is distinct from new.id
    and b.order_id is null
    and b.status not in ('cancelled', 'reschedule')
    and b.branch_id::text = new.branch_id::text
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

drop trigger if exists prevent_duplicate_active_order_schedule_slot on public.orders;
create trigger prevent_duplicate_active_order_schedule_slot
  before insert or update of branch_id, technician_id, service_date, service_time, status
  on public.orders
  for each row
  execute function public.prevent_duplicate_active_order_schedule_slot();

drop trigger if exists prevent_duplicate_active_prospect_booking_slot on public.prospect_bookings;
create trigger prevent_duplicate_active_prospect_booking_slot
  before insert or update of branch_id, technician_id, schedule_date, schedule_time, status, order_id
  on public.prospect_bookings
  for each row
  execute function public.prevent_duplicate_active_prospect_booking_slot();
