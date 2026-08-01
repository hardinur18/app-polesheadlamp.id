alter table public.payment_methods
  add column if not exists logo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bank-logos',
  'bank-logos',
  true,
  1572864,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read bank logos" on storage.objects;
create policy "Public read bank logos"
  on storage.objects
  for select
  to anon, authenticated, service_role
  using (bucket_id = 'bank-logos');

drop policy if exists "Public upload bank logos" on storage.objects;
create policy "Public upload bank logos"
  on storage.objects
  for insert
  to anon, authenticated, service_role
  with check (bucket_id = 'bank-logos');

drop policy if exists "Public update bank logos" on storage.objects;
create policy "Public update bank logos"
  on storage.objects
  for update
  to anon, authenticated, service_role
  using (bucket_id = 'bank-logos')
  with check (bucket_id = 'bank-logos');

drop policy if exists "Public delete bank logos" on storage.objects;
create policy "Public delete bank logos"
  on storage.objects
  for delete
  to anon, authenticated, service_role
  using (bucket_id = 'bank-logos');

notify pgrst, 'reload schema';
