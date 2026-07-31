alter table public.ad_platforms
  add column if not exists logo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'platform-logos',
  'platform-logos',
  true,
  1572864,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated read platform logos" on storage.objects;
create policy "Authenticated read platform logos"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'platform-logos');

drop policy if exists "Authenticated upload platform logos" on storage.objects;
create policy "Authenticated upload platform logos"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'platform-logos');

drop policy if exists "Authenticated update platform logos" on storage.objects;
create policy "Authenticated update platform logos"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'platform-logos')
  with check (bucket_id = 'platform-logos');

drop policy if exists "Authenticated delete platform logos" on storage.objects;
create policy "Authenticated delete platform logos"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'platform-logos');
