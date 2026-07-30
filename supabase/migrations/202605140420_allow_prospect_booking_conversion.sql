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
    and (new.lead_id is null or b.lead_id is distinct from new.lead_id)
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
