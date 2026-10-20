# Phase 2 Brief: Multiplayer Engine

Read the project overview first. This brief covers only Phase 2. Do not build video (LiveKit), accounts/auth, category editing, AI decks, or production hardening. Before writing code: inspect the repo, then post a short implementation plan and wait for approval.

## Goal

Real rooms that friends on different devices can join by link or code, with game state kept in sync live. The Phase 1 screens, reducer, and per-viewer projection are reused as-is; only the data layer underneath them changes.

## Requirements

- **Rooms in Supabase.** Creating a room stores it server-side under a unique code. Joining by code or invite link adds you to that room. Max 8 players, late joiners wait for the next round (rules unchanged from the overview).
- **Server runs the rules.** Every game action goes to a Next.js server endpoint, which loads the room, checks the action comes from a player in that room, applies the existing pure `gameReducer`, and saves the result. Invalid actions (wrong turn, not host, wrong phase) are rejected. The server picks shuffle seeds. No client can write game state directly.
- **Live sync.** When a room changes, every connected player sees the update within about a second, via Supabase Realtime.
- **Identity without accounts.** Joining gives the player an id and a private token stored in the browser. The token proves "I am this player in this room" on later requests, including after a refresh.
- **Per-viewer state from the server.** The server returns `getViewerState(state, playerId)` for the requesting player, so a client never receives its own unrevealed card. (Nice-to-have per the overview, and cheap here because the server already has the projection.)
- **Presence and reconnection.** Show who is connected using Realtime Presence, driving the existing connection indicators. If your connection drops, show the existing "Reconnecting" banner and resync automatically when it returns. Refreshing the page puts you back in your room.
- **Leaving and host migration.** Leave removes the player and their card (existing reducer behaviour). Players who disappear without leaving are removed after a grace period (about 2 minutes without a heartbeat), so a closed tab doesn't stall the game. Host migrates to the oldest remaining player.
- **Concurrency.** Two simultaneous actions must not overwrite each other (use a version number and retry).
- **Mock mode stays.** Keep the Phase 1 mock provider behind a switch for UI work and solo testing, along with the dev panel.

## Out of scope

LiveKit video (tiles keep the mock video placeholder; mic/camera toggles stay local), accounts, anti-cheat or RLS-level card hiding, room history, moderation, monitoring, and heavy abuse protection.

## Done when

- Two or more browsers (e.g. a normal and a private window, or a phone) can create and join the same room and play a full round, with every action showing up on every screen.
- Refreshing mid-round restores your seat and view. Closing a tab eventually removes that player, and host migrates.
- Unit tests cover the server action handling (auth, validation, seeds, conflict retry) with an in-memory store; existing tests still pass; typecheck and lint are clean.
- Setup steps (SQL migration, env vars for local and Vercel) are documented, and everything is committed.
