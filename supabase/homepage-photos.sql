-- Separate homepage photo slots for the two existing homepage placements.
create table if not exists public.homepage_photos (
  slot_key text primary key,
  image_url text not null,
  storage_path text not null unique,
  updated_at timestamptz not null default now()
);

alter table public.homepage_photos enable row level security;

drop policy if exists "Homepage photos are public" on public.homepage_photos;
create policy "Homepage photos are public" on public.homepage_photos for select to anon, authenticated using (true);

drop policy if exists "Authenticated manage homepage photos" on public.homepage_photos;
create policy "Authenticated manage homepage photos" on public.homepage_photos for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('homepage-images','homepage-images',true) on conflict (id) do update set public=true;

drop policy if exists "Homepage images are public" on storage.objects;
create policy "Homepage images are public" on storage.objects for select to public using (bucket_id='homepage-images');

drop policy if exists "Authenticated upload homepage images" on storage.objects;
create policy "Authenticated upload homepage images" on storage.objects for insert to authenticated with check (bucket_id='homepage-images');

drop policy if exists "Authenticated update homepage images" on storage.objects;
create policy "Authenticated update homepage images" on storage.objects for update to authenticated using (bucket_id='homepage-images') with check (bucket_id='homepage-images');

drop policy if exists "Authenticated delete homepage images" on storage.objects;
create policy "Authenticated delete homepage images" on storage.objects for delete to authenticated using (bucket_id='homepage-images');
