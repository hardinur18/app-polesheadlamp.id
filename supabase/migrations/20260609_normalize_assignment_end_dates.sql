create or replace function public.normalize_assignment_end_date()
returns trigger as $$
begin
  if new.start_date is not null
    and new.end_date is not null
    and new.end_date < new.start_date then
    new.end_date = new.start_date;
  end if;

  return new;
end;
$$ language plpgsql;

update public.ad_account_assignments
set end_date = start_date
where end_date is not null
  and end_date < start_date;

drop trigger if exists normalize_ad_account_assignments_end_date on public.ad_account_assignments;
create trigger normalize_ad_account_assignments_end_date
  before insert or update on public.ad_account_assignments
  for each row
  execute function public.normalize_assignment_end_date();

do $$
begin
  if to_regclass('public.ad_account_owner_assignments') is not null then
    execute '
      update public.ad_account_owner_assignments
      set end_date = start_date
      where end_date is not null
        and end_date < start_date
    ';

    execute '
      drop trigger if exists normalize_ad_account_owner_assignments_end_date
      on public.ad_account_owner_assignments
    ';

    execute '
      create trigger normalize_ad_account_owner_assignments_end_date
        before insert or update on public.ad_account_owner_assignments
        for each row
        execute function public.normalize_assignment_end_date()
    ';
  end if;
end $$;
