-- Amore Cafe AI Telegram ordering assistant
-- Back up production before running. This migration only adds columns/table; it does not drop existing data.
alter table public.orders add column if not exists telegram_chat_id text;
alter table public.orders add column if not exists source text not null default 'website';
create index if not exists orders_telegram_chat_id_idx on public.orders(telegram_chat_id);
create table if not exists public.telegram_sessions (
  chat_id text primary key,
  state text not null default 'idle',
  data jsonb not null default '{"cart":[],"history":[]}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.telegram_sessions enable row level security;
-- Intentionally no anon/authenticated policies: only the server-side service role can access sessions.
