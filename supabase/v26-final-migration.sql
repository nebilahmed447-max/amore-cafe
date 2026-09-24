-- AMORE CAFE V26 FINAL MIGRATION
-- Run this once in Supabase SQL Editor for an existing V25 database.

alter table public.orders add column if not exists delivery_zone text;
alter table public.orders add column if not exists delivery_fee numeric not null default 0;
alter table public.orders add column if not exists delivery_distance_km numeric;
alter table public.orders add column if not exists delivery_lat double precision;
alter table public.orders add column if not exists delivery_lng double precision;

-- Admin history cleanup
alter table public.orders enable row level security;
drop policy if exists "Authenticated users can delete orders" on public.orders;
create policy "Authenticated users can delete orders"
on public.orders for delete to authenticated using (true);

-- Pricing is enforced by the checkout UI:
-- Free: <= 50m = 0 ETB
-- Near: 51–600m = 50 ETB
-- Medium: 601m–2.5km = 100 ETB
-- Far: > 2.5km = 200 ETB
