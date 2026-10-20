"use client"

import { createContext, useContext } from "react"

import type {
  Answer,
  GameSettings,
  MediaState,
  PlayerId,
  ViewerState,
  Vote,
} from "@/lib/game"

import type { VideoTokenResponse } from "./protocol"

/**
 * What the UI gets from a room provider. Both the Phase 1 mock and the real
 * server-backed provider implement this, so screens don't care which is live.
 * Components only ever see `view`, the per-viewer projection.
 */

export type DevOverlay = "none" | "loading" | "error" | "reconnecting"
export type VideoOrientation = "landscape" | "portrait"

export type CreateResult = { ok: true; code: string } | { ok: false }
export type JoinResult = "ok" | "full" | "notFound" | "error"

/** State of the room in the current URL (/room/[code]). */
export type RoomStatus =
  "loading" | "ready" | "notSeated" | "notFound" | "error"

export interface RoomActions {
  selectCategory: (categoryId: string) => void
  updateSettings: (settings: Partial<GameSettings>) => void
  startRound: () => void
  askQuestion: (question: string) => void
  answerQuestion: (answer: Answer) => void
  questionAnswered: () => void
  makeGuess: (text: string) => void
  castVote: (vote: Vote) => void
  endRound: () => void
  nextRound: () => void
  backToLobby: () => void
  setMedia: (media: Partial<Pick<MediaState, "mic" | "camera">>) => void
}

/** Mock-only tools for the dev panel. */
export interface MockDevTools {
  setViewer: (playerId: PlayerId) => void
  loadScenario: (playerCount: number, phase: "lobby" | "playing") => void
  addMockPlayer: () => void
  removePlayer: (playerId: PlayerId) => void
  fillVotes: (vote: Vote) => void
  fillAnswers: (answer: Answer) => void
  toggleOrientation: (playerId: PlayerId) => void
  setConnection: (connection: MediaState["connection"]) => void
  reset: () => void
}

export interface RoomContextValue {
  backend: "mock" | "server"
  /** False until client-side storage has been read. */
  ready: boolean
  status: RoomStatus
  view: ViewerState | null
  /** Your connection to the room dropped; showing last known state. */
  reconnecting: boolean
  overlay: DevOverlay
  setOverlay: (overlay: DevOverlay) => void
  videoOrientation: (playerId: PlayerId) => VideoOrientation
  session: {
    createRoom: (
      name: string,
      media: Pick<MediaState, "mic" | "camera">,
    ) => Promise<CreateResult>
    joinRoom: (
      code: string,
      name: string,
      media: Pick<MediaState, "mic" | "camera">,
    ) => Promise<JoinResult>
    /** True if this browser already holds a seat in that room. */
    hasSeat: (code: string) => boolean
    /** Credentials for this room's video call; null when video is off. */
    videoToken: () => Promise<VideoTokenResponse | null>
    leaveRoom: () => void
  }
  actions: RoomActions
  dev: MockDevTools | null
}

export const RoomContext = createContext<RoomContextValue | null>(null)

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext)
  if (!ctx) throw new Error("useRoom must be used inside RoomProvider")
  return ctx
}
