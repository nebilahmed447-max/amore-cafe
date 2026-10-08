-- Amore Cafe — per-item take-away packing fee
-- Run this once in Supabase SQL Editor on the existing production database.
-- Default 0 preserves the current pricing until you configure a fee per food/drink.

alter table public.foods
  add column if not exists takeaway_pack_fee numeric not null default 0;

-- Keep existing products unchanged and prevent negative fees.
update public.foods
set takeaway_pack_fee = 0
where takeaway_pack_fee is null or takeaway_pack_fee < 0;

alter table public.foods
  drop constraint if exists foods_takeaway_pack_fee_nonnegative;

alter table public.foods
  add constraint foods_takeaway_pack_fee_nonnegative
  check (takeaway_pack_fee >= 0);
