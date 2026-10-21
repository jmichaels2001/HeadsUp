-- Headbands Phase 4: AI-generated decks.
-- Run once in the Supabase SQL editor, after 0003.
--
-- AI decks are "blind": nobody sees their cards, so AI cards have no creator
-- (created_by is null) and anyone can be dealt them.

alter table public.deck_cards alter column created_by drop not null;

-- The prompt an AI deck was generated from (null for hand-made decks).
alter table public.decks add column if not exists generated_from text;

-- One row per generation attempt, for the per-browser hourly limit.
create table if not exists public.ai_generations (
  id bigint generated always as identity primary key,
  device_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_generations_device_time_idx
  on public.ai_generations (device_id, created_at);

alter table public.ai_generations enable row level security;
