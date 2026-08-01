begin;

alter table public.ad_accounts
  add column if not exists sub_channel_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ad_accounts_sub_channel_id_fkey'
      and conrelid = 'public.ad_accounts'::regclass
  ) then
    alter table public.ad_accounts
      add constraint ad_accounts_sub_channel_id_fkey
      foreign key (sub_channel_id)
      references public.ad_sub_channels(id)
      on delete set null;
  end if;
end $$;

create index if not exists ad_accounts_sub_channel_idx
  on public.ad_accounts (sub_channel_id);

update public.ad_accounts aa
set sub_channel_id = active_assignment.sub_channel_id
from (
  select distinct on (ad_account_id)
    ad_account_id,
    sub_channel_id
  from public.ad_account_assignments
  where status = 'active'
    and sub_channel_id is not null
  order by ad_account_id, start_date desc, created_at desc
) active_assignment
where aa.id = active_assignment.ad_account_id
  and aa.sub_channel_id is null;

notify pgrst, 'reload schema';

commit;
