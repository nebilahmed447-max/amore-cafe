-- Inside Amore photo manager
create table if not exists public.inside_amore_photos (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

alter table public.inside_amore_photos enable row level security;

drop policy if exists "Inside Amore photos are public" on public.inside_amore_photos;
create policy "Inside Amore photos are public" on public.inside_amore_photos for select to anon, authenticated using (true);

drop policy if exists "Admins manage Inside Amore photos" on public.inside_amore_photos;
create policy "Admins manage Inside Amore photos" on public.inside_amore_photos for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public) values ('inside-amore','inside-amore',true) on conflict (id) do update set public=true;

drop policy if exists "Inside Amore public images" on storage.objects;
create policy "Inside Amore public images" on storage.objects for select to public using (bucket_id='inside-amore');

drop policy if exists "Authenticated upload Inside Amore" on storage.objects;
create policy "Authenticated upload Inside Amore" on storage.objects for insert to authenticated with check (bucket_id='inside-amore');

drop policy if exists "Authenticated update Inside Amore" on storage.objects;
create policy "Authenticated update Inside Amore" on storage.objects for update to authenticated using (bucket_id='inside-amore') with check (bucket_id='inside-amore');

drop policy if exists "Authenticated delete Inside Amore" on storage.objects;
create policy "Authenticated delete Inside Amore" on storage.objects for delete to authenticated using (bucket_id='inside-amore');
