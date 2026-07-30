create table if not exists public.proof_assets (
  id text primary key default ('proof_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)),
  title text not null,
  vehicle_type_id text references public.vehicle_types(id) on delete set null,
  year integer check (year is null or (year >= 1900 and year <= 2100)),
  image_path text not null,
  tags text[] not null default '{}'::text[],
  caption text,
  is_active boolean not null default true,
  usage_count integer not null default 0 check (usage_count >= 0),
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists proof_assets_vehicle_type_idx
  on public.proof_assets(vehicle_type_id);

create index if not exists proof_assets_active_created_idx
  on public.proof_assets(is_active, created_at desc);

create index if not exists proof_assets_tags_idx
  on public.proof_assets using gin(tags);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proof-assets',
  'proof-assets',
  true,
  10485760,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.proof_assets enable row level security;

drop policy if exists "App access read proof assets" on public.proof_assets;
create policy "App access read proof assets"
  on public.proof_assets
  for select
  to anon, authenticated, service_role
  using (true);

drop policy if exists "App access create proof assets" on public.proof_assets;
create policy "App access create proof assets"
  on public.proof_assets
  for insert
  to anon, authenticated, service_role
  with check (true);

drop policy if exists "App access update proof assets" on public.proof_assets;
create policy "App access update proof assets"
  on public.proof_assets
  for update
  to anon, authenticated, service_role
  using (true)
  with check (true);

drop policy if exists "App access delete proof assets" on public.proof_assets;
create policy "App access delete proof assets"
  on public.proof_assets
  for delete
  to anon, authenticated, service_role
  using (true);

grant select, insert, update, delete on public.proof_assets to anon, authenticated, service_role;

drop policy if exists "App access read proof asset objects" on storage.objects;
create policy "App access read proof asset objects"
  on storage.objects
  for select
  to anon, authenticated, service_role
  using (bucket_id = 'proof-assets');

drop policy if exists "App access upload proof asset objects" on storage.objects;
create policy "App access upload proof asset objects"
  on storage.objects
  for insert
  to anon, authenticated, service_role
  with check (bucket_id = 'proof-assets');

drop policy if exists "App access update proof asset objects" on storage.objects;
create policy "App access update proof asset objects"
  on storage.objects
  for update
  to anon, authenticated, service_role
  using (bucket_id = 'proof-assets')
  with check (bucket_id = 'proof-assets');

drop policy if exists "App access delete proof asset objects" on storage.objects;
create policy "App access delete proof asset objects"
  on storage.objects
  for delete
  to anon, authenticated, service_role
  using (bucket_id = 'proof-assets');

comment on table public.proof_assets is 'Global proof gallery assets such as edited before-after images and testimonials.';
comment on column public.proof_assets.caption is 'Short image or vehicle description shown with the asset.';
