-- AMORE CAFE — PAYMENT RECEIPTS
-- Run this once in Supabase SQL Editor on your existing production project.

-- 1) Store the private Storage object path for each order.
alter table public.orders
  add column if not exists receipt_url text;

-- 2) Create a private bucket for payment receipts.
insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do update set public = false;

-- 3) Customers can upload receipts; only authenticated admins can read them.
drop policy if exists "Anyone can upload payment receipts" on storage.objects;
create policy "Anyone can upload payment receipts"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'payment-receipts');

drop policy if exists "Authenticated users can view payment receipts" on storage.objects;
create policy "Authenticated users can view payment receipts"
on storage.objects for select
to authenticated
using (bucket_id = 'payment-receipts');

-- Admins can remove a receipt if needed.
drop policy if exists "Authenticated users can delete payment receipts" on storage.objects;
create policy "Authenticated users can delete payment receipts"
on storage.objects for delete
to authenticated
using (bucket_id = 'payment-receipts');
