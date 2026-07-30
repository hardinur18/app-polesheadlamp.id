create table if not exists public.prospect_bookings (
  id text primary key,
  lead_id text not null references public.leads(id) on delete cascade,
  order_id text references public.orders(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  schedule_date date not null,
  schedule_time text not null,
  branch_id text not null references public.branches(id) on delete restrict,
  area_id text references public.areas(id) on delete set null,
  address text,
  maps_url text,
  notes text,
  status text not null default 'tentative',
  cs_id text,
  advertiser_id text,
  technician_id text,
  vehicle_id text,
  platform_id text,
  sub_channel_id text,
  service_id text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint prospect_bookings_status_check check (status in ('tentative', 'confirmed', 'reschedule', 'cancelled'))
);

create index if not exists prospect_bookings_lead_id_idx
  on public.prospect_bookings(lead_id);

create index if not exists prospect_bookings_order_id_idx
  on public.prospect_bookings(order_id);

create index if not exists prospect_bookings_schedule_date_idx
  on public.prospect_bookings(schedule_date);

create index if not exists prospect_bookings_branch_id_idx
  on public.prospect_bookings(branch_id);

grant delete, insert, references, select, trigger, truncate, update
  on table public.prospect_bookings
  to anon, authenticated, service_role;

alter table public.prospect_bookings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'prospect_bookings'
      and policyname = 'Public access prospect bookings'
  ) then
    create policy "Public access prospect bookings"
      on public.prospect_bookings
      for all
      to public
      using (true)
      with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'prospect_bookings'
  ) then
    alter publication supabase_realtime add table public.prospect_bookings;
  end if;
end
$$;
