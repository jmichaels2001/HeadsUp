# Phase 3 Brief: Live Video

Read the project overview first. This brief covers only Phase 3. Do not build category editing, public categories, AI decks, accounts/auth, recording of any kind, or production hardening. Before writing code: inspect the repo, then post a short implementation plan and wait for approval.

## Goal

Everyone in a room shares a live video call. Each player's real camera feed appears in their `PlayerTile` (through the existing `videoSlot` prop), under their card, and the mic / camera / connection indicators reflect real state. The game rules, reducer, and room engine from Phases 1 and 2 are unchanged.

## Requirements

- **LiveKit Cloud.** Use a LiveKit Cloud project for local dev and Vercel. API key and secret stay server-side; only the LiveKit URL is public. If LiveKit isn't configured, the app still works and tiles fall back to the placeholder.
- **Tokens from the room server.** A Next.js endpoint mints a short-lived LiveKit access token for a seated player only, checked with the existing seat token. The LiveKit room is the room code; the participant identity is the player id, so feeds map onto player tiles.
- **Everyone in the room is on the call**, in the lobby, during a round, and at round end. Late joiners waiting for the next round are on the call too.
- **Video in tiles.** The lobby and game screens show a video tile per player. Your own feed is mirrored. Portrait and landscape feeds keep their aspect ratio (letterboxed, as in Phase 1). Camera off or no feed yet shows the existing avatar placeholder.
- **Audio.** Remote audio plays automatically. If the browser blocks autoplay, show a clear "Tap to enable sound" control.
- **Real camera and mic check.** The join screen requests camera and mic access, shows a live preview, and handles "denied" and "no device" gracefully. Declining still lets you play without video. The preview tracks are reused when you enter the room, so you aren't prompted twice.
- **In-room controls.** Mic and camera toggles in the room header on the lobby and game screens.
- **Real indicators.** Mic and camera indicators come from LiveKit. Connection combines room presence (Phase 2) with LiveKit connection quality and reconnection state.
- **Leaving.** Leaving the room disconnects from the call.
- **Bandwidth.** Up to 8 participants: enable simulcast, adaptive stream, and dynacast so small tiles get small layers.
- **Mock mode stays.** The mock provider keeps the placeholder video and the dev panel.

## Secrecy

Cards are drawn by the app UI, not filmed, and no game data travels over the call. The per-viewer projection is unchanged.

## Out of scope

Recording, egress, or transcription (never). Screen sharing, chat, virtual backgrounds, noise filters, device pickers beyond the browser default, kicking pruned players from the call server-side, categories/AI, accounts, monitoring, and abuse protection.

## Done when

- Two or more browsers (e.g. a normal and a private window, or a phone) in the same room see and hear each other in the lobby and in a round, with the right feed in the right tile.
- Toggling mic or camera updates your tile and everyone else's indicators. Dropping the network shows reconnecting and recovers.
- Without LiveKit env vars the app still runs with placeholder tiles.
- Unit tests cover the token endpoint logic (auth, identity, room) and the media-state merge; existing tests still pass; typecheck and lint are clean.
- LiveKit setup (Cloud project, env vars for local and Vercel) is documented, and everything is committed.
