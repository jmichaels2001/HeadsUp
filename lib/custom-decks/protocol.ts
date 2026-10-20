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

/** A deck as one device sees it: shared details, its own cards, a count. */
export interface DeckView {
  id: string
  name: string
  emoji: string
  description: string
  version: number
  myCards: Card[]
  otherCardCount: number
  totalCardCount: number
  playable: boolean
  /** Only when every remaining card is yours (or there are none). */
  canDelete: boolean
}

export interface DeckListItem {
  id: string
  name: string
  emoji: string
  description: string
  totalCardCount: number
  myCardCount: number
  playable: boolean
  updatedAt: number
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
