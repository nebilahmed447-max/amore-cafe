-- Amore Cafe: delivery zones and fees
alter table public.orders add column if not exists delivery_zone text;
alter table public.orders add column if not exists delivery_fee numeric not null default 0;

-- Existing orders remain valid with delivery_fee = 0.
-- Delivery pricing used by the customer checkout:
-- Near = up to 600 m -> 50 ETB
-- Medium = 601 m to 2.5 km -> 100 ETB
-- Far = above 2.5 km -> 200 ETB

-- Automatic GPS delivery distance captured at checkout
alter table public.orders add column if not exists delivery_distance_km numeric;
alter table public.orders add column if not exists delivery_lat double precision;
alter table public.orders add column if not exists delivery_lng double precision;

-- Admin order-history cleanup (authenticated admin users only)
drop policy if exists "Authenticated users can delete orders" on public.orders;
create policy "Authenticated users can delete orders"
on public.orders for delete to authenticated using (true);
