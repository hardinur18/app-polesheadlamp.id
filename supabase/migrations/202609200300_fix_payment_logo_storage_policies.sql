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
drop policy if exists "Public upload bank logos" on storage.objects;
drop policy if exists "Public update bank logos" on storage.objects;
drop policy if exists "Public delete bank logos" on storage.objects;
drop policy if exists "Authenticated upload bank logos" on storage.objects;
drop policy if exists "Authenticated update bank logos" on storage.objects;
drop policy if exists "Authenticated delete bank logos" on storage.objects;
drop policy if exists "App read payment account assets" on storage.objects;
drop policy if exists "App upload payment account assets" on storage.objects;
drop policy if exists "App update payment account assets" on storage.objects;
drop policy if exists "App delete payment account assets" on storage.objects;

create policy "App read payment account assets"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'bank-logos');

create policy "App upload payment account assets"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'bank-logos');

create policy "App update payment account assets"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'bank-logos')
  with check (bucket_id = 'bank-logos');

create policy "App delete payment account assets"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'bank-logos');

notify pgrst, 'reload schema';
