-- AMORE CAFE: staff roles for delivery and waiter panels.
-- Run in Supabase SQL Editor AFTER backing up your current project.
-- Do not rerun supabase/schema.sql on a live database; it drops orders and foods.
create table if not exists public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null check (role in ('manager','delivery','waiter')),
  active boolean not null default true,
  assigned_tables integer[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.staff_profiles add column if not exists assigned_tables integer[] not null default '{}';
alter table public.staff_profiles enable row level security;
drop policy if exists "Staff can view own profile" on public.staff_profiles;
create policy "Staff can view own profile" on public.staff_profiles for select to authenticated using (user_id = auth.uid());
-- Create and change staff profiles only from the Supabase SQL Editor in this first version. This avoids self-referencing RLS policies.

-- Backfill simple table labels into table_number for existing dine-in orders.
update public.orders
set table_number = (regexp_match(coalesce(address,''), '^\s*(?:table\s*)?#?\s*(\d+)\s*$', 'i'))[1]
where coalesce(btrim(table_number),'') = ''
  and coalesce(order_type,'') <> 'delivery'
  and coalesce(address,'') ~* '^\s*(?:table\s*)?#?\s*\d+\s*$';

-- Replace broad order access with role- and table-aware policies.
drop policy if exists "Authenticated users can view orders" on public.orders;
drop policy if exists "Authenticated users can update orders" on public.orders;
drop policy if exists "Authenticated users can delete orders" on public.orders;
drop policy if exists "Active staff can view orders" on public.orders;
drop policy if exists "Managers and assigned staff can update orders" on public.orders;
drop policy if exists "Active staff can view assigned orders" on public.orders;
drop policy if exists "Staff can update assigned orders" on public.orders;
drop policy if exists "Managers can delete orders" on public.orders;
create policy "Active staff can view assigned orders" on public.orders for select to authenticated
using (exists (
  select 1 from public.staff_profiles p where p.user_id=auth.uid() and p.active and (
    p.role='manager'
    or (p.role='delivery' and order_type='delivery')
    or (p.role='waiter' and order_type <> 'delivery' and case when coalesce(table_number,'') ~ '^\d+$' then table_number::int = any(p.assigned_tables) else false end)
  )
));
create policy "Staff can update assigned orders" on public.orders for update to authenticated
using (exists (
  select 1 from public.staff_profiles p where p.user_id=auth.uid() and p.active and (
    p.role='manager'
    or (p.role='delivery' and order_type='delivery')
    or (p.role='waiter' and order_type <> 'delivery' and case when coalesce(table_number,'') ~ '^\d+$' then table_number::int = any(p.assigned_tables) else false end)
  )
))
with check (exists (
  select 1 from public.staff_profiles p where p.user_id=auth.uid() and p.active and (
    p.role='manager'
    or (p.role='delivery' and order_type='delivery')
    or (p.role='waiter' and order_type <> 'delivery' and case when coalesce(table_number,'') ~ '^\d+$' then table_number::int = any(p.assigned_tables) else false end)
  )
));
create policy "Managers can delete orders" on public.orders for delete to authenticated
using (exists (select 1 from public.staff_profiles p where p.user_id=auth.uid() and p.active and p.role='manager'));


-- Example: assign waiter A to tables 1–6. Replace the UUID with the Auth user ID.
-- UPDATE public.staff_profiles SET assigned_tables = ARRAY[1,2,3,4,5,6] WHERE user_id = 'WAITER_AUTH_UUID';
-- Waiter B: ARRAY[7,8,9,10,11,12]; Waiter C: ARRAY[13,14,15,16,17,18].
