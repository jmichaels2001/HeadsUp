-- Headbands Phase 2: rooms and player seats.
-- Run once in the Supabase SQL editor (or with `supabase db push`).
--
-- RLS is enabled with no policies, so the browser's publishable key can't
-- read or write these tables. Only the server (secret key) touches them.

create table if not exists public.rooms (
  code text primary key,
  state jsonb not null,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_players (
  room_code text not null references public.rooms (code) on delete cascade,
  player_id text not null,
  token_hash text not null unique,
  last_seen timestamptz not null default now(),
  primary key (room_code, player_id)
);

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
