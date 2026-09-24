-- Allows customers to safely check the status of a specific order
-- without exposing the entire orders table to anonymous users.
-- Run this once in Supabase SQL Editor after the existing schema/migrations.

create or replace function public.get_order_status(p_order_id text)
returns table (
  id text,
  status text,
  total numeric,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    o.id::text,
    o.status::text,
    o.total,
    o.created_at
  from public.orders o
  where o.id::text = p_order_id
  limit 1;
$$;

revoke all on function public.get_order_status(text) from public;
grant execute on function public.get_order_status(text) to anon, authenticated;
