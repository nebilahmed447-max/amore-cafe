-- Dynamic Amore Cafe staff and table management.
-- Run once in Supabase SQL Editor after staff-panels-telegram.sql.
-- After this migration, managers can create staff accounts and manage tables from /admin.
-- Never rerun schema.sql on a live project; it drops business data.

CREATE TABLE IF NOT EXISTS public.cafe_tables (
  table_number integer PRIMARY KEY CHECK (table_number > 0),
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cafe_tables ENABLE ROW LEVEL SECURITY;
-- No client-side policies are intentionally added. The manager-only server API uses the service role.

-- Backfill all table numbers already assigned to waiters.
INSERT INTO public.cafe_tables (table_number, label)
SELECT DISTINCT n, 'Table ' || n
FROM public.staff_profiles p
CROSS JOIN LATERAL unnest(coalesce(p.assigned_tables, '{}'::integer[])) AS n
WHERE n > 0
ON CONFLICT (table_number) DO NOTHING;

-- Backfill table numbers already used on existing non-delivery orders.
INSERT INTO public.cafe_tables (table_number, label)
SELECT DISTINCT safe_number, 'Table ' || safe_number
FROM (
  SELECT CASE WHEN table_number ~ '^[0-9]{1,7}$' THEN table_number::integer END AS safe_number, order_type
  FROM public.orders
) existing
WHERE coalesce(order_type, '') <> 'delivery'
  AND safe_number BETWEEN 1 AND 1000000
ON CONFLICT (table_number) DO NOTHING;

-- Keep assignments as an unrestricted integer array. The admin API validates that each
-- assigned number exists and prevents two active waiters from sharing a table.
ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS assigned_tables integer[] NOT NULL DEFAULT '{}';
