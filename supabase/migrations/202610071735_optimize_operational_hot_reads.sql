-- Hot read paths used by dashboard, orders, prospects, and schedule views.
-- These indexes avoid broad scans when the app loads date-scoped operational data.

create index if not exists orders_service_date_desc_idx
  on public.orders(service_date desc)
  where service_date is not null;

create index if not exists orders_lead_date_desc_idx
  on public.orders(lead_date desc)
  where lead_date is not null;

create index if not exists leads_created_at_desc_idx
  on public.leads(created_at desc)
  where created_at is not null;

do $$
begin
  if to_regclass('public.technician_schedules') is not null then
    execute 'create index if not exists technician_schedules_date_desc_idx on public.technician_schedules(date desc) where date is not null';
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.daily_ads') is not null then
    execute 'create index if not exists daily_ads_date_desc_idx on public.daily_ads(date desc) where date is not null';
    execute 'create index if not exists daily_ads_account_date_idx on public.daily_ads(ad_account_id, date desc) where ad_account_id is not null and date is not null';
    execute 'create index if not exists daily_ads_cs_date_idx on public.daily_ads(cs_id, date desc) where cs_id is not null and date is not null';
    execute 'create index if not exists daily_ads_advertiser_date_idx on public.daily_ads(advertiser_id, date desc) where advertiser_id is not null and date is not null';
  end if;
end;
$$;

create index if not exists lead_spam_daily_inputs_date_desc_idx
  on public.lead_spam_daily_inputs(input_date desc)
  where input_date is not null;

create index if not exists lead_spam_daily_inputs_scope_date_idx
  on public.lead_spam_daily_inputs(cs_id, platform_id, advertiser_id, input_date desc);
