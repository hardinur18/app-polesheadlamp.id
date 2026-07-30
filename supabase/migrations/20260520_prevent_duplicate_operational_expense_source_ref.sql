create or replace function public.fn_prevent_duplicate_operational_expense_source_ref()
returns trigger as $$
begin
  if new.status = 'active' and coalesce(new.source_ref, '') <> '' then
    if exists (
      select 1
      from public.operational_expense_ledger existing
      where existing.source_ref = new.source_ref
        and existing.status = 'active'
        and existing.id <> new.id
      limit 1
    ) then
      raise exception 'Biaya Operasional dengan source_ref % sudah pernah dibuat', new.source_ref
        using errcode = '23505';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_duplicate_operational_expense_source_ref
  on public.operational_expense_ledger;

create trigger trg_prevent_duplicate_operational_expense_source_ref
before insert or update of source_ref, status
on public.operational_expense_ledger
for each row
execute function public.fn_prevent_duplicate_operational_expense_source_ref();
