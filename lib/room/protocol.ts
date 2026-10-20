import { z } from "zod"

import { deviceIdSchema } from "@/lib/custom-decks/protocol"
import type { ViewerState } from "@/lib/game"

/**
 * Wire format between the browser and the room API. Clients never send who
 * they are (`by`) or shuffle seeds: the server fills those in.
 */

export const joinRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(20),
  media: z.strictObject({ mic: z.boolean(), camera: z.boolean() }),
  /** So the server never deals this player a card they created. */
  deviceId: deviceIdSchema.optional(),
})
export type JoinRequest = z.infer<typeof joinRequestSchema>

const text = z.string().max(200)

export const clientActionSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("selectCategory"),
    categoryId: z.string().max(64),
  }),
  z.strictObject({
    type: z.literal("updateSettings"),
    settings: z.strictObject({
      questionMode: z.enum(["type", "voice"]).optional(),
      passAfterQuestion: z.boolean().optional(),
    }),
  }),
  z.strictObject({ type: z.literal("startRound") }),
  z.strictObject({ type: z.literal("nextRound") }),
  z.strictObject({ type: z.literal("askQuestion"), question: text }),
  z.strictObject({
    type: z.literal("answerQuestion"),
    answer: z.enum(["yes", "no"]),
  }),
  z.strictObject({ type: z.literal("questionAnswered") }),
  z.strictObject({ type: z.literal("makeGuess"), text }),
  z.strictObject({
    type: z.literal("castVote"),
    vote: z.enum(["correct", "notYet"]),
  }),
  z.strictObject({ type: z.literal("endRound") }),
  z.strictObject({ type: z.literal("backToLobby") }),
  z.strictObject({
    type: z.literal("setMedia"),
    media: z.strictObject({
      mic: z.boolean().optional(),
      camera: z.boolean().optional(),
    }),
  }),
  z.strictObject({ type: z.literal("leave") }),
])
export type ClientAction = z.infer<typeof clientActionSchema>

export interface Seat {
  code: string
  playerId: string
  token: string
}

export interface RoomSnapshot {
  version: number
  view: ViewerState
}

export type SeatResponse = Seat & RoomSnapshot

/** Where and how to join the room's video call. */
export interface VideoTokenResponse {
  url: string
  token: string
}

export type RoomErrorCode =
  | "notFound"
  | "unauthorized"
  | "full"
  | "invalid"
  | "rejected"
  | "conflict"
  | "unavailable"

export interface ApiError {
  error: RoomErrorCode
  message: string
}

/** Realtime channel and event names shared by server and client. */
export const roomChannel = (code: string) => `room:${code}`
export const ROOM_CHANGED_EVENT = "changed"

/** Uppercase letters and digits, at most 6. */
export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6)
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{4,6}$/.test(code)
}
