import { z } from "zod"

import type { Card } from "@/lib/game"

/**
 * Wire format for custom decks. Every deck is public for now, but a player
 * only ever receives the cards their own device created: the server sends
 * everyone else's as a count.
 */

/** A deck needs this many cards to be listed and played. */
export const MIN_PLAYABLE_CARDS = 10
export const MAX_DECK_CARDS = 200
export const MAX_DECK_NAME = 40
export const MAX_DECK_DESCRIPTION = 120
export const MAX_CARD_LABEL = 60
/** Uploaded card images (after the browser shrinks them). */
export const MAX_IMAGE_BYTES = 1024 * 1024
export const MAX_IMAGE_SIDE = 512
export const MAX_REPORT_NOTE = 200
/** Open reports from this many different browsers hide a deck. */
export const AUTO_HIDE_REPORTS = 3
export const LIBRARY_PAGE_SIZE = 50

/** Sent on every deck request so the server knows whose cards to return. */
export const DEVICE_HEADER = "x-device-id"
export const deviceIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/)

export const deckMetaSchema = z.strictObject({
  name: z.string().trim().min(1).max(MAX_DECK_NAME),
  emoji: z.string().trim().min(1).max(16),
  description: z.string().trim().max(MAX_DECK_DESCRIPTION),
})
export type DeckMeta = z.infer<typeof deckMetaSchema>

export const updateDeckSchema = z.strictObject({
  meta: deckMetaSchema,
  expectedVersion: z.number().int().min(0),
})
export type UpdateDeckRequest = z.infer<typeof updateDeckSchema>

const imageUrl = z.string().max(500).nullable()

export const addCardSchema = z.strictObject({
  label: z.string().trim().min(1).max(MAX_CARD_LABEL),
  imageUrl: imageUrl.optional(),
})
export type AddCardRequest = z.infer<typeof addCardSchema>

export const updateCardSchema = z.strictObject({
  label: z.string().trim().min(1).max(MAX_CARD_LABEL).optional(),
  imageUrl: imageUrl.optional(),
})
export type UpdateCardRequest = z.infer<typeof updateCardSchema>

export const REPORT_REASONS = ["offensive", "spam", "other"] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const reportSchema = z.strictObject({
  reason: z.enum(REPORT_REASONS),
  note: z.string().trim().max(MAX_REPORT_NOTE).default(""),
})
export type ReportRequest = z.input<typeof reportSchema>

export const MAX_AI_PROMPT = 200
export const MIN_AI_CARDS = MIN_PLAYABLE_CARDS
export const MAX_AI_CARDS = 40
/** Generations allowed per browser per hour. */
export const AI_HOURLY_LIMIT = 10

export const generateDeckSchema = z.strictObject({
  prompt: z.string().trim().min(1).max(MAX_AI_PROMPT),
  count: z.number().int().min(MIN_AI_CARDS).max(MAX_AI_CARDS).default(20),
})
export type GenerateDeckRequest = z.input<typeof generateDeckSchema>

export const librarySortSchema = z.enum(["newest", "popular"])
export type LibrarySort = z.infer<typeof librarySortSchema>

/** A deck as one device sees it: shared details, its own cards, a count. */
export interface DeckView {
  id: string
  name: string
  emoji: string
  description: string
  version: number
  myCards: Card[]
  /** Cards other players added (you can't see them). */
  otherCardCount: number
  /** AI-generated cards (nobody can see them). */
  aiCardCount: number
  totalCardCount: number
  playable: boolean
  /** Only when every remaining card is yours (or there are none). */
  canDelete: boolean
  /** Hidden from the library while reports are reviewed. */
  hidden: boolean
  /** Generated with AI. */
  ai: boolean
}

export interface DeckListItem {
  id: string
  name: string
  emoji: string
  description: string
  totalCardCount: number
  myCardCount: number
  playable: boolean
  hidden: boolean
  ai: boolean
  updatedAt: number
}

/** A library entry: never any cards, just what's needed to pick one. */
export interface LibraryItem {
  id: string
  name: string
  emoji: string
  description: string
  cardCount: number
  playCount: number
  ai: boolean
  createdAt: number
}

export interface AdminReport {
  id: string
  reason: ReportReason
  note: string
  createdAt: number
}

/** Moderators see everything, including every card. */
export interface AdminDeck {
  id: string
  name: string
  emoji: string
  description: string
  hidden: boolean
  playCount: number
  /** The prompt, for AI decks. */
  generatedFrom: string | null
  cards: {
    id: string
    label: string
    imageUrl: string | null
    ai: boolean
  }[]
  reports: AdminReport[]
}

export interface ImageUploadResponse {
  url: string
}

/** Labels that count as the same card ("Pizza!" vs " pizza"). */
export function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")
}

export function isPlayable(totalCardCount: number): boolean {
  return totalCardCount >= MIN_PLAYABLE_CARDS
}
