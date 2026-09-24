-- AMORE CAFE — NON-DESTRUCTIVE FIX FOR EXISTING SUPABASE TABLES
-- Run this ONCE if you created the earlier foods/orders tables and customer orders fail.
-- It preserves existing rows and changes IDs to the text format used by the app.

alter table if exists public.foods
  alter column id drop default;

alter table if exists public.foods
  alter column id type text using id::text;

alter table if exists public.orders
  alter column id drop default;

alter table if exists public.orders
  alter column id type text using id::text;

alter table if exists public.orders
  add column if not exists payment text not null default 'Cash';

alter table if exists public.foods enable row level security;
alter table if exists public.orders enable row level security;

-- Recreate the policies safely.
drop policy if exists "Anyone can view foods" on public.foods;
drop policy if exists "Authenticated users can add foods" on public.foods;
drop policy if exists "Authenticated users can update foods" on public.foods;
drop policy if exists "Authenticated users can delete foods" on public.foods;

drop policy if exists "Anyone can create orders" on public.orders;
drop policy if exists "Authenticated users can view orders" on public.orders;
drop policy if exists "Authenticated users can update orders" on public.orders;

create policy "Anyone can view foods"
on public.foods for select to anon, authenticated using (true);

create policy "Authenticated users can add foods"
on public.foods for insert to authenticated with check (true);

create policy "Authenticated users can update foods"
on public.foods for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete foods"
on public.foods for delete to authenticated using (true);

create policy "Anyone can create orders"
on public.orders for insert to anon, authenticated with check (true);

create policy "Authenticated users can view orders"
on public.orders for select to authenticated using (true);

create policy "Authenticated users can update orders"
on public.orders for update to authenticated using (true) with check (true);


-- V26 delivery distance fields
alter table public.orders add column if not exists delivery_distance_km numeric;
alter table public.orders add column if not exists delivery_lat double precision;
alter table public.orders add column if not exists delivery_lng double precision;

-- V26 admin history cleanup
drop policy if exists "Authenticated users can delete orders" on public.orders;
create policy "Authenticated users can delete orders"
on public.orders for delete to authenticated using (true);
