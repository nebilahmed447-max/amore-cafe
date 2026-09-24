-- Amore Cafe: set realistic preparation times (minutes) for the current 18-menu seed list.
-- Run this once in Supabase SQL Editor after the foods table exists.

UPDATE foods AS f
SET prep_time = v.prep_time,
    updated_at = NOW()
FROM (VALUES
  ('burger-special', 15),
  ('beef-burger', 12),
  ('cheese-burger', 13),
  ('chicken-burger', 15),
  ('fasting-burger', 12),
  ('special-pizza', 25),
  ('beef-pizza', 22),
  ('veggie-pizza', 20),
  ('chicken-wrap', 10),
  ('pasta', 18),
  ('salad', 8),
  ('fish', 20),
  ('coffee', 7),
  ('iced', 5),
  ('juice', 6),
  ('shake', 8),
  ('cake', 3),
  ('water', 1)
) AS v(id, prep_time)
WHERE f.id = v.id;

-- Verify the result:
SELECT id, name, prep_time
FROM foods
ORDER BY created_at ASC;
