# Phase 1 Brief: Frontend Prototype (mock data only)

Read the project overview first. This brief covers only Phase 0 (setup) and Phase 1. Do not build backend, Supabase, auth, LiveKit, or AI features. Before writing code: inspect the repo, then post a short implementation plan (files, components, anything you'd deviate on) and wait for approval.

## Confirmed game rules

- Turn-based. Players take turns in a fixed order.
- On your turn you either ask the group a question, or make a guess about your own card.
- Guesses are confirmed by the group. Every player except the guesser taps Correct / Not yet, including players who have already solved. Majority decides; ties count as "not yet".
- Correct guess: the card is revealed to its owner, the player is marked solved, and they no longer take turns for the rest of the round. Others keep playing.
- Turn passing (default, adjustable): the turn passes after a question is answered or a wrong guess. A solved player is skipped.
- Round ends when every player is solved, or the host ends it early. Everyone's cards are then revealed.
- Max 8 players. If a deck has fewer cards than players, show a "Need more cards" alert and block Start. Built-in decks should have 10+ cards.
- Late joiners wait for the next round. A leaver's card is removed. If the host leaves, the oldest remaining player becomes host.
- Secrecy rule: a player never sees their own card until it is revealed. In Phase 1 this is enforced in the mock layer by never passing the viewer's own card to the component tree, not by hiding it with CSS.

## Phase 0: Setup

- Next.js (App Router), TypeScript strict, Tailwind, shadcn/ui, ESLint, Prettier, Vitest.
- Check current docs and package versions before installing anything.
- Add `CLAUDE.md` with: the workflow rules from the overview, the secrecy rule, and "no secrets or server-only code under `components/`".
- Push to GitHub and confirm a Vercel preview deploys.
- Commit.

## Phase 1: Screens

1. Landing: Create Room, Join Room (code input).
2. Join / name entry: display name, plus a mock camera/mic permission step.
3. Lobby: player list (host badge, up to 8), room code and copy-invite-link, category picker (built-in only), "Need more cards" alert state, Start button for the host.
4. Game screen: responsive grid of video tiles, each with name and a card above or near it. Your own tile shows an empty "?" slot. Show whose turn it is, and give the active player Ask and Guess actions. All other players, solved or not, get Correct / Not yet buttons while a guess is pending. Solved players can see everyone's cards (their own was revealed), so make sure their view still renders correctly while they vote. Show solved state on tiles. Include mic/camera/connection indicators.
5. Round end / reveal: all cards revealed, with Next Round and Back to Lobby.

Also build empty, loading, error, and "reconnecting" states, plus a dev-only "view as player X" switcher to check each player's perspective.

## Architecture constraints

- Put real types (`Player`, `Card`, `Category`, `GameState`, turn and round state) and a pure reducer/state machine in `lib/game`, with no React or SDK imports. Mock data in `lib/mock` drives it. Unit-test the reducer: turn order, solved-skipping, majority confirmation (solved players count as voters, the guesser does not), tie handling, round end, and the "own card never in a viewer's projection" rule.
- Expose a `getViewerState(state, playerId)` projection that strips the viewer's own unrevealed card. Components only consume the projection.
- Isolate the future video layer: build a `PlayerTile` that takes a `videoSlot` prop. Mock it with a placeholder, and include portrait and landscape aspect ratios.
- Establish the design system first: color tokens, type scale, spacing, borders, and shared components (PlayerTile, SecretCard, CardSlot, PlayerChip, buttons). Bright and playful, large readable cards, accessible contrast, and no heavy animation.
- Test layouts at 2, 4, 6, and 8 players on desktop and phone width.

## Data model note for later phases

Design `Category` with `visibility` (private / room / public) and an optional collaborator list now, as types only. Collaborative and public categories are planned for Phase 4. Public categories will need moderation and reporting, so don't build any of that yet.

## Done when

- A full round can be clicked through on desktop and phone width.
- Reducer tests and type checks pass, and lint is clean.
- Design tokens and shared components are settled.
- Everything is committed, with a short summary of what changed and what's incomplete.
