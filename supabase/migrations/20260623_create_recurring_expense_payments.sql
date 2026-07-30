begin;

create extension if not exists pgcrypto;

create table if not exists public.recurring_expense_payments (
  id uuid primary key default gen_random_uuid(),
  recurring_expense_id text not null,
  period_key text not null,
  due_date date,
  paid_at date not null,
  amount numeric(15,2) not null check (amount >= 0),
  payment_source text not null default '',
  operational_category text not null default '',
  operational_subcategory text not null default '',
  vendor_name text not null default '',
  notes text not null default '',
  proof_url text not null default '',
  operational_expense_id uuid references public.operational_expense_ledger(id) on delete set null,
  status text not null default 'paid',
  paid_by text,
  paid_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_expense_payments_period_key_chk check (period_key ~ '^\d{4}-\d{2}$'),
  constraint recurring_expense_payments_status_chk check (status in ('paid', 'void'))
);

create unique index if not exists idx_recurring_expense_payments_unique_paid_period
  on public.recurring_expense_payments (recurring_expense_id, period_key)
  where status = 'paid';

create index if not exists idx_recurring_expense_payments_period
  on public.recurring_expense_payments (period_key, paid_at desc);

create index if not exists idx_recurring_expense_payments_recurring
  on public.recurring_expense_payments (recurring_expense_id, paid_at desc);

create index if not exists idx_operational_expense_ledger_recurring_source_ref
  on public.operational_expense_ledger (source_ref)
  where source_type = 'recurring' and status = 'active';

create or replace function public.pay_recurring_expense(
  p_recurring_expense_id text,
  p_period_key text,
  p_due_date date,
  p_paid_at date,
  p_amount numeric,
  p_payment_source text,
  p_operational_category text,
  p_operational_subcategory text,
  p_vendor_name text,
  p_description text,
  p_branch_id text,
  p_notes text,
  p_proof_url text,
  p_paid_by text,
  p_paid_by_name text
)
returns table(payment_id uuid, operational_expense_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id text := nullif(trim(coalesce(p_branch_id, '')), '');
  v_branch_name text := '';
  v_source_ref text;
  v_existing_payment uuid;
  v_operational_expense_id uuid;
  v_payment_id uuid;
begin
  if nullif(trim(coalesce(p_recurring_expense_id, '')), '') is null then
    raise exception 'ID pengeluaran rutin wajib diisi';
  end if;

  if p_period_key !~ '^\d{4}-\d{2}$' then
    raise exception 'Periode pembayaran tidak valid';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Nominal pembayaran wajib lebih dari 0';
  end if;

  select id
    into v_existing_payment
  from public.recurring_expense_payments
  where recurring_expense_id = p_recurring_expense_id
    and period_key = p_period_key
    and status = 'paid'
  limit 1;

  if v_existing_payment is not null then
    raise exception 'Pembayaran periode % sudah tercatat untuk pengeluaran rutin ini', p_period_key;
  end if;

  if v_branch_id is not null then
    select name into v_branch_name
    from public.branches
    where id::text = v_branch_id
    limit 1;
    v_branch_name := coalesce(v_branch_name, '');
  end if;

  v_source_ref := 'recurring:' || p_recurring_expense_id || ':' || p_period_key;

  select id
    into v_operational_expense_id
  from public.operational_expense_ledger
  where source_ref = v_source_ref
    and status = 'active'
  limit 1;

  if v_operational_expense_id is null then
    insert into public.operational_expense_ledger (
      expense_date,
      period_key,
      branch_id,
      branch_name,
      category,
      subcategory,
      vendor_name,
      description,
      amount,
      currency,
      payment_source,
      source_type,
      source_ref,
      notes,
      status,
      created_by,
      created_by_name,
      updated_by,
      updated_by_name
    )
    values (
      p_paid_at,
      p_period_key,
      v_branch_id,
      v_branch_name,
      trim(coalesce(p_operational_category, '')),
      trim(coalesce(p_operational_subcategory, '')),
      trim(coalesce(p_vendor_name, '')),
      trim(coalesce(p_description, '')),
      p_amount,
      'IDR',
      trim(coalesce(p_payment_source, '')),
      'recurring',
      v_source_ref,
      trim(coalesce(p_notes, '')),
      'active',
      nullif(trim(coalesce(p_paid_by, '')), ''),
      trim(coalesce(p_paid_by_name, '')),
      nullif(trim(coalesce(p_paid_by, '')), ''),
      trim(coalesce(p_paid_by_name, ''))
    )
    returning id into v_operational_expense_id;
  end if;

  insert into public.recurring_expense_payments (
    recurring_expense_id,
    period_key,
    due_date,
    paid_at,
    amount,
    payment_source,
    operational_category,
    operational_subcategory,
    vendor_name,
    notes,
    proof_url,
    operational_expense_id,
    status,
    paid_by,
    paid_by_name
  )
  values (
    p_recurring_expense_id,
    p_period_key,
    p_due_date,
    p_paid_at,
    p_amount,
    trim(coalesce(p_payment_source, '')),
    trim(coalesce(p_operational_category, '')),
    trim(coalesce(p_operational_subcategory, '')),
    trim(coalesce(p_vendor_name, '')),
    trim(coalesce(p_notes, '')),
    trim(coalesce(p_proof_url, '')),
    v_operational_expense_id,
    'paid',
    nullif(trim(coalesce(p_paid_by, '')), ''),
    trim(coalesce(p_paid_by_name, ''))
  )
  returning id into v_payment_id;

  update public.recurring_expenses
  set last_payment_date = p_paid_at::timestamptz
  where id::text = p_recurring_expense_id;

  payment_id := v_payment_id;
  operational_expense_id := v_operational_expense_id;
  return next;
end;
$$;

revoke all on public.recurring_expense_payments from anon;
grant select on public.recurring_expense_payments to authenticated, service_role;
grant insert, update, delete on public.recurring_expense_payments to service_role;
revoke execute on function public.pay_recurring_expense(
  text, text, date, date, numeric, text, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.pay_recurring_expense(
  text, text, date, date, numeric, text, text, text, text, text, text, text, text, text, text
) to authenticated, service_role;

do $$
begin
  if to_regclass('public.recurring_expenses') is not null then
    execute $backfill$
      with legacy_source as (
        select
          e.id::text as recurring_expense_id,
          e.name,
          e.category,
          coalesce(e.amount, 0)::numeric(15,2) as amount,
          nullif(trim(coalesce(e.branch_id::text, '')), '') as raw_branch_id,
          e.last_payment_date::date as paid_at,
          to_char(e.last_payment_date::date, 'YYYY-MM') as period_key,
          make_date(
            extract(year from e.last_payment_date::date)::int,
            extract(month from e.last_payment_date::date)::int,
            least(
              greatest(coalesce(e.due_date, 1), 1),
              extract(day from (date_trunc('month', e.last_payment_date::date) + interval '1 month - 1 day'))::int
            )
          ) as due_date,
          case
            when lower(coalesce(e.category, '')) = 'rent' then 'Biaya Sewa Kantor / Cabang'
            when lower(coalesce(e.category, '')) = 'salary' then 'Gaji & Komisi'
            when lower(coalesce(e.category, '')) = 'marketing' then 'Biaya Iklan'
            when lower(coalesce(e.category, '')) = 'other' then 'Lain - lain tidak Rutin'
            else 'Biaya Utilitas'
          end as operational_subcategory,
          trim(coalesce(e.bank_name, '')) as bank_name,
          'recurring:' || e.id::text || ':' || to_char(e.last_payment_date::date, 'YYYY-MM') as source_ref
        from public.recurring_expenses e
        where e.last_payment_date is not null
          and coalesce(e.amount, 0) > 0
      ),
      legacy as (
        select
          ls.*,
          b.id::text as branch_id,
          coalesce(b.name, '') as branch_name
        from legacy_source ls
        left join public.branches b on b.id::text = ls.raw_branch_id
      ),
      inserted_ledger as (
        insert into public.operational_expense_ledger (
          expense_date,
          period_key,
          branch_id,
          branch_name,
          category,
          subcategory,
          vendor_name,
          description,
          amount,
          currency,
          payment_source,
          source_type,
          source_ref,
          notes,
          status,
          created_by_name,
          updated_by_name
        )
        select
          l.paid_at,
          l.period_key,
          l.branch_id,
          l.branch_name,
          'Beban Operasional',
          l.operational_subcategory,
          trim(coalesce(l.name, '')),
          'Pembayaran rutin ' || trim(coalesce(l.name, '')) || ' periode ' || l.period_key,
          l.amount,
          'IDR',
          case when l.bank_name <> '' then 'Transfer ' || l.bank_name else '' end,
          'recurring',
          l.source_ref,
          'Migrasi otomatis dari status pembayaran rutin lama',
          'active',
          'Migrasi Sistem',
          'Migrasi Sistem'
        from legacy l
        where not exists (
          select 1
          from public.operational_expense_ledger existing
          where existing.source_ref = l.source_ref
            and existing.status = 'active'
        )
        returning id, source_ref
      ),
      ledger_rows as (
        select id, source_ref from inserted_ledger
        union all
        select existing.id, existing.source_ref
        from public.operational_expense_ledger existing
        join legacy l on l.source_ref = existing.source_ref
        where existing.status = 'active'
      )
      insert into public.recurring_expense_payments (
        recurring_expense_id,
        period_key,
        due_date,
        paid_at,
        amount,
        payment_source,
        operational_category,
        operational_subcategory,
        vendor_name,
        notes,
        operational_expense_id,
        status,
        paid_by_name
      )
      select
        l.recurring_expense_id,
        l.period_key,
        l.due_date,
        l.paid_at,
        l.amount,
        case when l.bank_name <> '' then 'Transfer ' || l.bank_name else '' end,
        'Beban Operasional',
        l.operational_subcategory,
        trim(coalesce(l.name, '')),
        'Migrasi otomatis dari status pembayaran rutin lama',
        lr.id,
        'paid',
        'Migrasi Sistem'
      from legacy l
      left join ledger_rows lr on lr.source_ref = l.source_ref
      where not exists (
        select 1
        from public.recurring_expense_payments existing
        where existing.recurring_expense_id = l.recurring_expense_id
          and existing.period_key = l.period_key
          and existing.status = 'paid'
      )
      on conflict do nothing;
    $backfill$;
  end if;
end $$;

comment on table public.recurring_expense_payments is
  'Payment history for recurring expenses. Each paid period links to an operational expense ledger row.';

commit;
