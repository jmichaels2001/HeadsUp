# Headbands — Claude Code guide

@AGENTS.md

A browser-based multiplayer "Headbands / Who Am I?" party game for a group of trusted friends. Read `docs/overview.md` and the current phase brief (`docs/phase-*-brief.md`) before starting any task. **Only the phase named in the current brief is in scope.**

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui (Base UI) · Vitest · ESLint · Prettier. Node ≥ 22.12 (`.nvmrc` pins 24). Later phases: Supabase, LiveKit, an LLM API.

## Commands

- `npm run dev`: start the dev server at http://localhost:3000
- `npm run check`: typecheck, lint, and tests (must pass before every commit)
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:watch`
- `npm run format`: Prettier (no semicolons, Tailwind class sorting)
- `npm run build`: production build

## Layout

```
app/          Next.js routes (App Router)
components/   UI only. No secrets, no server-only code.
lib/game/     Types + pure reducer + getViewerState. No React/Next/SDK imports (ESLint-enforced).
lib/mock/     Phase 1 mock data + MockRoomProvider that drives lib/game
docs/         Overview and phase briefs
```

## Secrecy rule

A player never sees their own card until it is revealed. `getViewerState(state, playerId)` returns a projection that omits the viewer's own unrevealed card entirely. Never hide it with CSS. **Components consume only the projection, never raw `GameState`.** This is a trusted-friends game, so don't add anti-cheat hardening.

## Rules

- **No secrets or server-only code under `components/`.** Secrets go in environment variables (`.env.local`, never committed; document names in `.env.example`).
- No audio/video recording, ever.

## Workflow

1. Read the overview and the current phase brief first.
2. Inspect the repo, then post a short plan (files, components, any deviations) and wait for approval before writing code.
3. Stay in scope. Do not build ahead into later phases (no backend, auth, LiveKit, or AI work in Phase 1).
4. Check current docs and package versions before installing or using any library. For Next.js, read `node_modules/next/dist/docs/`.
5. Never put secrets or server-only code under `components/`.
6. Respect the secrecy rule. Don't add anti-cheat hardening.
7. Write tests for game logic, and keep type checks, lint, and tests passing.
8. Commit in small, working steps with clear messages.
9. End each task with a short summary: what changed, what was verified, and what is incomplete.
10. If something is ambiguous or conflicts with these docs, ask instead of guessing.
