create table if not exists public.payment_transactions (
  id text primary key,
  order_id text not null references public.orders(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  payment_method text not null default 'qris',
  gateway_provider text not null default 'mock',
  status text not null default 'pending',
  provider_status text,
  channel_code text,
  reference_id text,
  payment_request_id text,
  payment_id text,
  qr_string text,
  qr_image_url text,
  checkout_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  provider_payload jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists payment_transactions_order_id_idx
  on public.payment_transactions(order_id);

create index if not exists payment_transactions_payment_request_id_idx
  on public.payment_transactions(payment_request_id);

create index if not exists payment_transactions_reference_id_idx
  on public.payment_transactions(reference_id);

alter table public.payment_transactions enable row level security;
