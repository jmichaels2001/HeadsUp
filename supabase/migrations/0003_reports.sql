-- Headbands Phase 4: deck reports and play counts.
-- Run once in the Supabase SQL editor, after 0002.
--
-- RLS is enabled with no policies: only the server (secret key) touches this.

create table if not exists public.deck_reports (
  id text primary key,
  deck_id text not null references public.decks (id) on delete cascade,
  -- Device id of the browser that reported it.
  device_id text not null,
  reason text not null check (reason in ('offensive', 'spam', 'other')),
  note text not null default '',
  status text not null default 'open'
    check (status in ('open', 'dismissed', 'actioned')),
  created_at timestamptz not null default now()
);

-- One open report per browser per deck.
create unique index if not exists deck_reports_one_open_idx
  on public.deck_reports (deck_id, device_id)
  where status = 'open';

create index if not exists deck_reports_deck_id_idx
  on public.deck_reports (deck_id);

alter table public.deck_reports enable row level security;

-- Atomic play counter, bumped when a round starts with a custom deck.
create or replace function public.increment_deck_play_count(deck text)
returns void
language sql
as $$
  update public.decks set play_count = play_count + 1 where id = deck;
$$;

revoke execute on function public.increment_deck_play_count(text)
  from public, anon, authenticated;
grant execute on function public.increment_deck_play_count(text)
  to service_role;
