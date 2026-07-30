do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum = any (c.conkey)
    where n.nspname = 'public'
      and t.relname = 'products'
      and a.attname = 'branch_id'
      and c.contype = 'f'
  loop
    execute format('alter table public.products drop constraint %I', constraint_name);
  end loop;
end $$;

alter table if exists public.products
  alter column branch_id type text using branch_id::text;

update public.products p
set branch_id = null
where branch_id is not null
  and not exists (
    select 1
    from public.branches b
    where b.id = p.branch_id
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_branch_id_fkey'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_branch_id_fkey
      foreign key (branch_id) references public.branches(id) on delete set null;
  end if;
end $$;

alter table if exists public.stock_transactions
  add column if not exists branch_id text,
  add column if not exists technician_id text;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum = any (c.conkey)
    where n.nspname = 'public'
      and t.relname = 'stock_transactions'
      and a.attname = 'branch_id'
      and c.contype = 'f'
  loop
    execute format('alter table public.stock_transactions drop constraint %I', constraint_name);
  end loop;
end $$;

alter table if exists public.stock_transactions
  alter column branch_id type text using branch_id::text,
  alter column technician_id type text using technician_id::text;

update public.stock_transactions st
set branch_id = null
where branch_id is not null
  and not exists (
    select 1
    from public.branches b
    where b.id = st.branch_id
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stock_transactions_branch_id_fkey'
      and conrelid = 'public.stock_transactions'::regclass
  ) then
    alter table public.stock_transactions
      add constraint stock_transactions_branch_id_fkey
      foreign key (branch_id) references public.branches(id) on delete set null;
  end if;
end $$;

create index if not exists products_branch_id_idx
  on public.products(branch_id);

create index if not exists stock_transactions_branch_id_idx
  on public.stock_transactions(branch_id);

create index if not exists stock_transactions_technician_id_idx
  on public.stock_transactions(technician_id);
