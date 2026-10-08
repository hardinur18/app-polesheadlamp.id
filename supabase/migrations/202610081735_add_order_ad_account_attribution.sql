alter table public.orders
  add column if not exists ad_account_id text references public.ad_accounts(id) on delete set null;

create index if not exists orders_ad_account_lead_date_idx
  on public.orders(ad_account_id, lead_date desc)
  where ad_account_id is not null;

create index if not exists orders_ad_attribution_scope_idx
  on public.orders(lead_date, platform_id, cs_id, sub_channel_id)
  where ad_account_id is null;

with order_scope as (
  select
    o.id as order_id,
    coalesce(
      nullif(o.lead_date::text, ''),
      nullif(o.service_date::text, ''),
      (o.created_at::date)::text
    ) as order_date,
    o.advertiser_id,
    o.platform_id,
    o.sub_channel_id,
    o.cs_id
  from public.orders o
  where o.ad_account_id is null
),
ranked_matches as (
  select
    os.order_id,
    da.ad_account_id,
    (coalesce(da.sub_channel_id, '') = coalesce(os.sub_channel_id, '')) as exact_sub_channel,
    (da.advertiser_id = os.advertiser_id) as exact_advertiser,
    count(*) over (partition by os.order_id) as candidate_count,
    count(*) filter (
      where coalesce(da.sub_channel_id, '') = coalesce(os.sub_channel_id, '')
    ) over (partition by os.order_id) as exact_sub_channel_count,
    count(*) filter (
      where da.advertiser_id = os.advertiser_id
    ) over (partition by os.order_id) as exact_advertiser_count,
    row_number() over (
      partition by os.order_id
      order by
        case when coalesce(da.sub_channel_id, '') = coalesce(os.sub_channel_id, '') then 0 else 1 end,
        case when da.advertiser_id = os.advertiser_id then 0 else 1 end,
        ((coalesce(da.amount_spent, 0) + (coalesce(da.leads_dashboard, 0) * 100000))) desc,
        da.ad_account_id
    ) as match_rank
  from order_scope os
  join public.daily_ads da
    on da.date::text = os.order_date
   and da.platform_id = os.platform_id
   and da.cs_id = os.cs_id
  where os.order_date is not null
    and os.platform_id is not null
    and os.cs_id is not null
    and da.ad_account_id is not null
)
update public.orders o
set ad_account_id = ranked_matches.ad_account_id
from ranked_matches
where o.id = ranked_matches.order_id
  and ranked_matches.match_rank = 1
  and (
    ranked_matches.candidate_count = 1
    or (ranked_matches.exact_sub_channel and ranked_matches.exact_sub_channel_count = 1)
    or (ranked_matches.exact_advertiser and ranked_matches.exact_advertiser_count = 1)
  );
