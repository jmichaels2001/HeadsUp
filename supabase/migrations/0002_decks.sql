-- Headbands Phase 4: custom decks and card images.
-- Run once in the Supabase SQL editor (or with `supabase db push`).
--
-- As in 0001, RLS is enabled with no policies: only the server (secret key)
-- reads or writes these tables. Every deck is public, but the server only
-- ever returns a player the cards their own device created.

create table if not exists public.decks (
  id text primary key,
  name text not null,
  emoji text not null,
  description text not null default '',
  -- Device id of the browser that created the deck.
  created_by text not null,
  -- Bumped on every name/emoji/description save (last write wins).
  version integer not null default 0,
  play_count integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deck_cards (
  id text primary key,
  deck_id text not null references public.decks (id) on delete cascade,
  label text not null,
  image_url text,
  -- Device id of the browser that added the card. Only it sees the card.
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists decks_created_by_idx on public.decks (created_by);
create index if not exists deck_cards_deck_id_idx on public.deck_cards (deck_id);
create index if not exists deck_cards_created_by_idx
  on public.deck_cards (created_by);

alter table public.decks enable row level security;
alter table public.deck_cards enable row level security;

-- Public bucket for card images. Uploads go through the app's server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'card-images',
  'card-images',
  true,
  1048576,
  array['image/webp', 'image/jpeg', 'image/png', 'image/gif']
)
on conflict (id) do nothing;
