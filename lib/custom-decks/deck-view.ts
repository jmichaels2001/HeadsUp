import type { Card } from "@/lib/game"

import { isPlayable, type DeckView } from "./protocol"

export interface DeckRecord {
  id: string
  name: string
  emoji: string
  description: string
  createdBy: string
  version: number
  playCount: number
  hidden: boolean
  createdAt: number
  updatedAt: number
}

export interface CardRecord {
  id: string
  deckId: string
  label: string
  imageUrl: string | null
  createdBy: string
  createdAt: number
}

export function toCard(record: CardRecord): Card {
  return {
    id: record.id,
    label: record.label,
    ...(record.imageUrl && { imageUrl: record.imageUrl }),
    createdBy: record.createdBy,
  }
}

/**
 * The deck as `deviceId` may see it: everyone else's cards are reduced to a
 * count, never sent. Like getViewerState, but for the deck editor.
 */
export function getDeckView(
  deck: DeckRecord,
  cards: CardRecord[],
  deviceId: string,
): DeckView {
  const mine = cards
    .filter((c) => c.createdBy === deviceId)
    .sort((a, b) => a.createdAt - b.createdAt)
  return {
    id: deck.id,
    name: deck.name,
    emoji: deck.emoji,
    description: deck.description,
    version: deck.version,
    myCards: mine.map(toCard),
    otherCardCount: cards.length - mine.length,
    totalCardCount: cards.length,
    playable: isPlayable(cards.length),
    canDelete: mine.length === cards.length,
  }
}
