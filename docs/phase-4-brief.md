# Phase 4 Brief: Categories

Read the project overview first. This brief covers only Phase 4. Do not build accounts/auth, deck access control, production deploy, monitoring, reconnection polish, or heavy abuse protection (Phase 5 or later). Before writing code: inspect the repo, then post a short implementation plan and wait for approval.

## Goal

Groups can make their own decks, edit them together, browse everyone's decks, and generate a deck from a prompt with AI. The host picks any of these in the lobby just like a built-in deck. The game rules, reducer, room engine, and video layer from Phases 1–3 are unchanged.

## Everything is public (for now)

There are still no accounts, and for this phase there is no deck access control:

- **Every deck is public.** All saved decks appear in the deck library, and anyone can open one and add cards to it. Only the cards are private to their creator (see below). Security comes later; keep the design easy to lock down then (all writes go through server endpoints, never straight from the browser to Supabase).
- New decks are stored with `visibility: "public"`. The `private` / `room` values and the `Collaborator` / `ownerId` types stay in place but aren't used.
- Each browser gets a random **device id** (localStorage). It's used to list "My decks" (decks this browser created), to de-duplicate reports, for the AI rate limit, and to remember who created each card. It is not a security boundary.

## Requirements

### Custom decks (build first)

- **Storage.** Decks live in a new Supabase table via a new migration (`0002_decks.sql`), RLS on with no policies, server-only access as in Phase 2. The in-memory store keeps working for local dev without Supabase.
- **Deck editor** at its own route (e.g. `/decks/[id]`): name, emoji, description, and a card list (add, edit, remove; reorder not required). Saves through server endpoints.
- **You only see your own cards.** In the editor, a player sees, edits, and removes only the cards their device created, plus a count of everyone else's ("12 more cards by other players"). This is enforced by the server like the in-game secrecy rule: the deck API returns only the requester's cards and a count, never the others' cards (no CSS hiding). Name, emoji, and description are shared and anyone can edit them.
- **Limits.** 10–200 cards per deck; card label ≤ 60 chars; name ≤ 40 chars. A deck with fewer than 10 cards can be saved as a draft: it shows a warning, appears under "My decks" and by direct link, but isn't listed in the library or selectable in the lobby until it reaches 10. The existing "Need more cards" Start blocker still applies.
- **Card images.** Custom cards have a required label and an optional image, not an emoji. The deck itself keeps its emoji icon. In the editor, you add an image by pasting it (e.g. copy an image in another tab or app, then paste into the card row), or with an "Add image" button that opens the file/photo picker (pasting is awkward on phones). Each card row shows a thumbnail with Replace and Remove.
  - The browser shrinks pasted or picked images before upload: longest side ≤ 512 px, re-encoded as WebP (JPEG fallback). The server accepts only images ≤ 1 MB.
  - Images are uploaded through a server endpoint into a public Supabase Storage bucket (`card-images`), and the card stores the image URL. Without Supabase, local dev keeps images in memory and serves them from the app.
  - Cleaning up unused images is out of scope.
- **Card rendering.** `SecretCard` (and anywhere else a card is shown) displays the image if there is one, otherwise the emoji (built-in decks keep their emojis), otherwise just the label. Images keep their aspect ratio inside the card.
- **Card creators.** Each custom card records the device id of the browser that added it (`createdBy`). Only the creator can edit or remove a card. Built-in cards have no creator.
- **Never deal a card to its creator.** Players send their device id when they join a room. When a round is dealt, no player gets a card their device created. This is a game rule in the pure reducer: dealing finds a random valid assignment (a small matching with backtracking, still driven by the round seed), not just shuffle-and-slice. If no valid assignment exists (e.g. two players and one of them made every card), Start is blocked with "Not enough cards made by other players". Because creators are tracked by device, the same person on a different browser isn't recognised; that's acceptable for now.
- **Collaborative editing.** Cards are added, edited, and removed one at a time, so people adding their own cards never conflict. The shared name, emoji, and description are last-write-wins, with a version number so a stale save is rejected with "Someone else edited this deck — reload". No live co-editing cursors. Optional nice-to-have: a Realtime ping so open editors know to reload.
- **Duplicates.** Since you can't see others' cards, two people may add the same thing. The deck keeps both (warning would spoil the other card), and when a deck is snapshotted into a room, cards with the same label (ignoring case, spaces, and punctuation) count as one, so two players are never dealt the same answer.
- **Deleting a deck.** Allowed only when every remaining card was created by your device (or the deck is empty). Otherwise you can remove your own cards but the deck stays. Moderators can delete any deck from `/admin`.
- **Using a deck in a room.** The lobby category picker gains tabs: Built-in, Library (with a "Mine" filter), and Generate. When the host selects a custom deck, the server loads it and snapshots its cards into the room state (`selectCategory` already carries a full `Category`), so later edits don't change a round in progress.

### Library and moderation

- **Browse.** A library page and lobby tab: list, simple name search, sort by newest and most used (a play counter incremented on round start).
- **Reporting.** Every deck has a Report button with a short reason (offensive, spam, other + optional note). A deck with 3 or more open reports from different device ids is hidden from the library automatically until reviewed.
- **Moderation page.** `/admin` gated by a server-only `ADMIN_SECRET` env var (entered once, kept in an httpOnly cookie). Shows reported decks with their reports; actions are Dismiss reports, Hide, and Delete. No moderator accounts.
- No automated content filtering on human-made decks beyond the report flow.

### AI-generated decks

- **Provider.** Anthropic Claude API via the official SDK, server-side only; key in `ANTHROPIC_API_KEY`. Model `claude-haiku-5-5` by default, overridable with `ANTHROPIC_MODEL`. Check current SDK docs before use.
- **Flow.** User enters a prompt (≤ 200 chars) and a card count (10–40, default 20). The server asks the model for structured output (deck name, emoji, description, card labels), validates it with zod, de-duplicates labels, and returns it. Generated cards have no images; people can paste them in while reviewing. Saved generated cards belong to the device that saved them.
- **Review before use (answers the overview's open question).** A generated deck always opens in the editor unsaved. A human reviews and tweaks it, then saves it (which adds it to the library) and can select it. Generated decks are never auto-saved or auto-selected.
- **Guardrails.** The system prompt asks for well-known, guessable, friend-appropriate answers suitable for a Headbands game. Per-device rate limit of 10 generations per hour, stored in the database (not memory) so it works on Vercel. No other abuse protection.
- **Fallback.** Without `ANTHROPIC_API_KEY` the Generate tab shows "AI generation isn't configured" and everything else still works.

### Mock mode

The mock provider keeps working with built-in decks only. Library and Generate tabs show a "Needs server mode" note.

## Secrecy

Unchanged. Custom decks only replace where cards come from; the per-viewer projection still strips a viewer's own unrevealed card. Outside the game, nobody sees cards they didn't create: the editor shows only your own cards, and the library and lobby picker show only name, emoji, description, and card count. The one exception is `/admin`, where moderators see a reported deck's full card list.

## Out of scope

Accounts, deck access control or private decks, per-person collaborator roles, live co-editing, deck import/export, image search or AI-generated images, unused-image cleanup, comments or ratings, automated moderation or content scanning, moderator accounts, AI review of human decks, AI features beyond deck generation, production deploy, monitoring, and recording of any kind.

## Done when

- A player creates a deck, pastes an image onto a card and picks another from a file. A second browser adds its own cards and sees only those plus a count of the first player's cards (checked in the API response, not just the UI). A stale save of the deck name is rejected cleanly.
- A host picks a custom deck in the lobby and plays a full round with it across two browsers; editing the deck mid-round doesn't affect the round, and nobody is dealt a card they created.
- A deck can be found in the library, reported, auto-hidden at the report threshold, and dismissed/hidden/deleted from `/admin`.
- A prompt generates a valid deck that opens in the editor unsaved; malformed model output is rejected with a friendly error; the rate limit kicks in.
- Without Supabase, LiveKit, or Anthropic env vars the app still runs, with the affected features showing a clear "not configured" state.
- Unit tests cover deck validation, image upload checks (type and size), the deck API only returning the requester's cards, card edit/remove limited to the creator, delete-deck rules, duplicate-label merging, dealing that never gives a player their own card (including the blocked case), version conflicts, report threshold logic, AI output parsing/validation, and the rate limiter; existing tests still pass; typecheck and lint are clean.
- New env vars (`ADMIN_SECRET`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`) are in `.env.example`, the migration and setup steps are documented, and everything is committed.

## Build order

1. Deck storage, API, and editor (custom + collaborative decks, card images).
2. Lobby picker integration.
3. Library, reporting, and `/admin`.
4. AI generation.

Each step is committed separately and leaves the app working.
