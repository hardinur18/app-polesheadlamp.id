create or replace function public.sync_order_prospect_lifecycle()
returns trigger
language plpgsql
as $$
declare
  next_lead_status text;
begin
  if new.status in ('cancelled', 'reschedule') then
    update public.prospect_bookings b
    set status = new.status,
        updated_at = timezone('utc'::text, now())
    where b.order_id = new.id
      and b.status is distinct from new.status;

    if new.lead_id is not null then
      update public.prospect_bookings b
      set status = new.status,
          updated_at = timezone('utc'::text, now())
      where b.order_id is null
        and b.lead_id = new.lead_id
        and b.status not in ('cancelled', 'reschedule')
        and b.technician_id::text = new.technician_id::text
        and b.schedule_date::text = new.service_date::text
        and public.normalize_schedule_time(b.schedule_time) = public.normalize_schedule_time(new.service_time);

      if not exists (
        select 1
        from public.orders o
        where o.lead_id = new.lead_id
          and o.id <> new.id
          and o.status not in ('cancelled', 'reschedule')
      ) then
        next_lead_status := case
          when new.status = 'cancelled' then 'Cancel'
          else 'Follow Up'
        end;

        update public.leads l
        set status = next_lead_status
        where l.id = new.lead_id
          and l.status = 'Closing';
      end if;
    end if;

    return new;
  end if;

  if new.lead_id is null then
    return new;
  end if;

  update public.prospect_bookings b
  set order_id = new.id,
      status = 'confirmed',
      updated_at = timezone('utc'::text, now())
  where b.order_id is null
    and b.lead_id = new.lead_id
    and b.status not in ('cancelled', 'reschedule')
    and b.technician_id::text = new.technician_id::text
    and b.schedule_date::text = new.service_date::text
    and public.normalize_schedule_time(b.schedule_time) = public.normalize_schedule_time(new.service_time);

  update public.leads l
  set status = 'Closing'
  where l.id = new.lead_id
    and l.status <> 'Closing';

  return new;
end;
$$;

drop trigger if exists sync_order_prospect_lifecycle on public.orders;
create trigger sync_order_prospect_lifecycle
  after insert or update of lead_id, technician_id, service_date, service_time, status
  on public.orders
  for each row
  execute function public.sync_order_prospect_lifecycle();

with ranked_active_matches as (
  select
    b.id as booking_id,
    o.id as order_id,
    row_number() over (partition by b.id order by o.created_at desc nulls last, o.id desc) as match_rank
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
set order_id = ranked_active_matches.order_id,
    status = 'confirmed',
    updated_at = timezone('utc'::text, now())
from ranked_active_matches
where ranked_active_matches.booking_id = b.id
  and ranked_active_matches.match_rank = 1;

with ranked_inactive_matches as (
  select
    b.id as booking_id,
    o.status as order_status,
    row_number() over (partition by b.id order by o.created_at desc nulls last, o.id desc) as match_rank
  from public.prospect_bookings b
  join public.orders o
    on o.lead_id = b.lead_id
   and o.status in ('cancelled', 'reschedule')
   and o.technician_id::text = b.technician_id::text
   and o.service_date::text = b.schedule_date::text
   and public.normalize_schedule_time(o.service_time) = public.normalize_schedule_time(b.schedule_time)
  where b.order_id is null
    and b.status not in ('cancelled', 'reschedule')
)
update public.prospect_bookings b
set status = ranked_inactive_matches.order_status,
    updated_at = timezone('utc'::text, now())
from ranked_inactive_matches
where ranked_inactive_matches.booking_id = b.id
  and ranked_inactive_matches.match_rank = 1;

update public.prospect_bookings b
set status = 'cancelled',
    updated_at = timezone('utc'::text, now())
from public.leads l
where b.lead_id = l.id
  and b.order_id is null
  and b.status not in ('cancelled', 'reschedule')
  and l.status in ('Closing', 'Cancel');

with lead_order_rollup as (
  select
    l.id as lead_id,
    bool_or(o.status not in ('cancelled', 'reschedule')) as has_active_order,
    bool_or(o.status = 'cancelled') as has_cancelled_order,
    bool_or(o.status = 'reschedule') as has_reschedule_order
  from public.leads l
  join public.orders o
    on o.lead_id = l.id
  where l.status = 'Closing'
  group by l.id
)
update public.leads l
set status = case
  when lead_order_rollup.has_cancelled_order then 'Cancel'
  when lead_order_rollup.has_reschedule_order then 'Follow Up'
  else l.status
end
from lead_order_rollup
where l.id = lead_order_rollup.lead_id
  and not lead_order_rollup.has_active_order;
