# Headbands

A browser-based "Who Am I?" party game for friends on a video call. Everyone
sees everyone's card except their own.

See `docs/overview.md` for the project plan and `CLAUDE.md` for conventions.

## Run it locally

Requires Node 22.12+ (`.nvmrc` pins 24).

```bash
npm install
cp .env.example .env.local   # then fill it in (see below)
npm run dev
```

With no env vars set you get the Phase 1 **mock** room: a single-tab
simulation with a dev panel for viewing as any player. Set
`NEXT_PUBLIC_ROOM_BACKEND=server` to use real rooms backed by an in-memory
store (fine for local testing; rooms vanish on restart).

To test multiplayer, use separate browser profiles (e.g. a normal and a
private window, or a phone). Two tabs in the same profile share a seat.

## Supabase setup (real rooms)

1. In the Supabase dashboard, open **SQL Editor** and run each file in
   `supabase/migrations/` once, in order (`0001_rooms.sql`, then
   `0002_decks.sql`, which also creates the public `card-images` storage
   bucket, then `0003_reports.sql` and `0004_ai_decks.sql`).
2. Under **Project Settings → API Keys**, copy the project URL, the
   **publishable** key, and a **secret** key into `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SECRET_KEY`.
3. Add the same three variables in Vercel → Settings → Environment
   Variables (Production and Preview), then redeploy.

How it works: the server keeps each room's full state in Postgres and runs
the game rules (`lib/game`). After each change it sends a tiny "room changed"
ping on a public Realtime channel; each browser then fetches its own view,
which never contains its own unrevealed card. RLS is on with no policies, so
only the server's secret key can touch the tables.

## LiveKit setup (live video)

Video is optional: without these variables the game runs with placeholder
tiles.

1. Create a free project at [LiveKit Cloud](https://cloud.livekit.io).
2. Under **Settings → API Keys**, create a key and copy the WebSocket URL
   (`wss://<project>.livekit.cloud`), API key, and secret into `.env.local`:
   `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. All three are
   server-only; never prefix them with `NEXT_PUBLIC_`.
3. Restart `npm run dev` (env changes and the cached room service both need a
   fresh server).
4. Add the same three variables in Vercel (Production and Preview), then
   redeploy.

How it works: when you're seated in a room, the browser asks
`/api/rooms/[code]/video-token` for a short-lived LiveKit token. The server
checks your seat token and signs one for the call named after the room code,
with your player id as your identity, so each feed lands in the right tile.
The call carries only camera and mic; no game data, and nothing is recorded
(egress is never used). Camera access needs HTTPS or `localhost`, so to test
on a phone use a Vercel preview deploy.

## Deck moderation

Reported decks are reviewed at `/admin`. Set `ADMIN_SECRET` (server only) in
`.env.local` and in Vercel, then sign in at `/admin` with it. Without it,
`/admin` is off. Decks reported from 3 different browsers are hidden from the
library automatically until you dismiss the reports or unhide them.

## AI-generated decks

Optional. Set `ANTHROPIC_API_KEY` (server only) in `.env.local` and in Vercel
to turn on the Generate tab and `/decks/generate`. Decks are written by
`claude-haiku-5-5` unless `ANTHROPIC_MODEL` says otherwise. AI decks are blind:
nobody sees their cards, so everyone, including whoever generated it, can be
dealt them. Each browser can generate 10 decks an hour.

## Commands

- `npm run check`: typecheck, lint, tests
- `npm run build`: production build
- `npm run format`: Prettier
