-- Amore Cafe: payment receipt duplicate protection.
-- Run once in Supabase SQL Editor before enabling automatic receipt screening.
-- A hash blocks exact duplicate image files. Cropped/edited duplicates still need staff review.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_receipt_hash_unique
  ON public.orders (receipt_hash)
  WHERE receipt_hash IS NOT NULL;
