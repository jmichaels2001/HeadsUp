# Project Overview: Multiplayer "Headbands" Party Game

Save this as `docs/overview.md`. The Phase briefs (starting with `docs/phase-1-brief.md`) assume you have read this first.

## 1. What we're building

A browser-based multiplayer **Headbands / "Who Am I?"** party game, inspired by The Other Channel's "Guess Who" series. Friends join a private room by link or code and share a live video call. Each player has a secret card shown above their head. **Everyone sees everyone's card except their own.** Players take turns asking the group questions or guessing, until each person has worked out who or what they are.

This is a hobby project for the owner and their friends. It is not a commercial product. Keep scope small and the experience fun.

## 2. Principles

- **Secrecy is the core mechanic, but this is a trusted-friends game.** A player should never see their own unrevealed card by accident: the UI must never render it, and components never receive it. We do **not** need to defend against a determined cheater (no devtools/network-inspection hardening, no heavy RLS work). Keep the design simple. In Phase 1 the mock layer enforces the accidental-spoiler rule by never passing a viewer's own card into the component tree.
- **No accounts in the MVP.** Players just pick a display name.
- **No audio/video recording**, ever.
- **Logic is separate from UI.** Game rules live in a pure, tested state machine with no React or SDK imports.
- **Build in phases.** Each phase has its own brief. Do only the phase you were asked to do.
- **Small, reviewable steps.** Plan first, wait for approval, build, test, commit.

## 3. Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js (App Router), React, TypeScript (strict) |
| Styling / UI | Tailwind CSS, shadcn/ui |
| Tests / quality | Vitest, ESLint, Prettier |
| Database / realtime (later) | Supabase (Postgres, Realtime, Row Level Security) |
| Video (later) | LiveKit |
| Hosting / source | Vercel + GitHub |
| AI categories (later) | An LLM API for generating card categories |

Always check current docs and package versions before installing anything. Do not rely on memory for versions or APIs.

## 4. Confirmed game rules

- **Turn-based**, in a fixed player order.
- **On your turn** you either ask the group a question or make a guess about your own card.
- **Questions have two modes (host picks in the lobby):**
  - **Type** (default): the asker types a yes/no question and every other player, including solved players, taps Yes / No. Majority decides; a tie shows "Unsure". The result is shown to everyone and the turn moves on automatically.
  - **Voice**: the asker asks out loud, the group answers out loud, and the asker taps End turn.
- **Guesses are confirmed by the group.** Every player except the guesser taps Correct / Not yet, **including players who have already solved**. Majority decides. Ties count as "not yet".
- **Correct guess:** the card is revealed to its owner, the player is marked solved, and they no longer take turns for the rest of the round. Others keep playing.
- **Turn passing (default, adjustable):** the turn passes after a question is answered or after a wrong guess. Solved players are skipped.
- **Round ends** when every player is solved, or the host ends it early. All cards are then revealed.
- **Max 8 players per room.**
- **Not enough cards:** if a deck has fewer cards than players, show a "Need more cards" alert and block Start. Built-in decks should have 10+ cards.
- **Late joiners** wait for the next round.
- **Leavers:** a leaver's card is removed from play.
- **Host leaves:** the oldest remaining player becomes host.

## 5. Categories

- **Built-in decks** ship with the app (10+ cards each).
- **Collaborative categories** (planned): groups can build and edit decks together.
- **Public / shared categories** (planned): categories others can browse and use. These will need moderation and reporting, so they are deliberately out of scope until Phase 4.
- **AI-generated categories** (planned): generate a deck from a prompt via an LLM API.
- The `Category` type should include `visibility` (`private` | `room` | `public`) and an optional collaborator list from the start, as types only.

## 6. Phased plan

1. **Phase 0, Setup.** Project scaffold, tooling, `CLAUDE.md`, GitHub, Vercel preview.
2. **Phase 1, Frontend prototype (mock data only).** All screens, design system, pure game reducer with tests, per-viewer projection, dev-only "view as player X" switcher. No backend. *(See `docs/phase-1-brief.md`.)*
3. **Phase 2, Multiplayer engine.** Supabase-backed rooms, realtime state sync, join/leave/host-migration, reconnection. Keep it simple: a server-side check that the room is shared and turn rules are followed is enough; strict anti-cheat or RLS-level card hiding is optional.
4. **Phase 3, Live video.** LiveKit integration through the existing `videoSlot` prop on `PlayerTile`; mic/camera/connection indicators wired to real state.
5. **Phase 4, Categories.** Collaborative and public categories (with moderation/reporting) and AI-generated decks.
6. **Phase 5, Reliability and deploy.** Error handling, reconnection polish, basic monitoring, production deploy. Skip heavy abuse protection unless the game goes beyond friends.

Only the phase named in the current brief is in scope.

## 7. Architecture

```
app/            Next.js routes (App Router)
components/     UI only. No secrets, no server-only code.
lib/game/       Types + pure reducer/state machine + getViewerState. No React/SDK imports.
lib/mock/       Mock data that drives lib/game in Phase 1
```

Key ideas:

- **`lib/game`** holds the real types (`Player`, `Card`, `Category`, `GameState`, turn and round state) and a pure reducer. It is unit-tested for turn order, solved-skipping, majority confirmation (solved players vote, the guesser does not), tie handling, round end, and the secrecy rule.
- **`getViewerState(state, playerId)`** returns a per-viewer projection that strips that viewer's own unrevealed card. Components consume **only** the projection, never raw `GameState`.
- **`PlayerTile`** takes a `videoSlot` prop so the video layer can be swapped in later without touching game UI.
- In later phases, apply the same projection wherever state is sent to a client if that's easy. It is a nice-to-have, not a security requirement, since players are trusted friends.

## 8. Design direction

- Bright and playful, with large, readable cards.
- Accessible contrast. No heavy animation.
- Establish the design system first: color tokens, type scale, spacing, borders, and shared components (`PlayerTile`, `SecretCard`, `CardSlot`, `PlayerChip`, buttons).
- Responsive: test at 2, 4, 6, and 8 players on desktop and phone width. Support portrait and landscape video aspect ratios.

## 9. Workflow rules for Claude Code

These also belong in `CLAUDE.md`.

1. **Read the overview and the current phase brief first.**
2. **Inspect the repo, then post a short plan** (files, components, any deviations) and **wait for approval** before writing code.
3. **Stay in scope.** Do not build ahead into later phases (no backend, auth, LiveKit, or AI work in Phase 1).
4. **Check current docs and package versions** before installing or using any library.
5. **Never put secrets or server-only code under `components/`.** Secrets go in environment variables and are never committed.
6. **Respect the secrecy rule** (never render or pass a viewer's own unrevealed card to components). Don't add anti-cheat hardening; this is a trusted-friends game.
7. **Write tests for game logic** and keep type checks, lint, and tests passing.
8. **Commit in small, working steps** with clear messages.
9. **End each task with a short summary:** what changed, what was verified, and what is incomplete.
10. **If something is ambiguous or conflicts with these docs, ask** instead of guessing.

## 10. Out of scope (for now)

User accounts, payments, recording of any kind, native mobile apps, spectators, chat history persistence, and public-category moderation tooling (until Phase 4).

## 11. Open questions (decide later)

- Exact turn-passing options to expose as "adjustable" settings.
- Whether to include a question limit or timer per turn.
- Hosting limits and video cost expectations for LiveKit at friend-group scale.
- How AI-generated decks are reviewed before use.
