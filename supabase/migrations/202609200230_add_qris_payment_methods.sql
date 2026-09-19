alter table public.payment_methods
  add column if not exists account_type text not null default 'bank',
  add column if not exists qris_image_path text,
  add column if not exists notes text;

update public.payment_methods
set account_type = 'bank'
where account_type is null or account_type = '';

alter table public.payment_methods
  drop constraint if exists payment_methods_account_type_check;

alter table public.payment_methods
  add constraint payment_methods_account_type_check
  check (account_type in ('bank', 'qris'));

notify pgrst, 'reload schema';
