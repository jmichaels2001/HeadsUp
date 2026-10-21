import type { Card, Category } from "@/lib/game"

import { isPlayable, normalizeLabel, type DeckView } from "./protocol"

export interface DeckRecord {
  id: string
  name: string
  emoji: string
  description: string
  createdBy: string
  version: number
  playCount: number
  hidden: boolean
  /** The prompt an AI deck was generated from; null for hand-made decks. */
  generatedFrom: string | null
  createdAt: number
  updatedAt: number
}

export interface CardRecord {
  id: string
  deckId: string
  label: string
  imageUrl: string | null
  /** Device that added it; null for AI cards, which nobody has seen. */
  createdBy: string | null
  createdAt: number
}

export function toCard(record: CardRecord): Card {
  return {
    id: record.id,
    label: record.label,
    ...(record.imageUrl && { imageUrl: record.imageUrl }),
    creators: record.createdBy ? [record.createdBy] : [],
  }
}

/**
 * Deleting a deck must not destroy cards someone else made and can't see.
 * AI cards count as the deck creator's here, so they can delete an AI deck.
 */
export function canDeleteDeck(
  deck: DeckRecord,
  cards: CardRecord[],
  deviceId: string,
): boolean {
  return cards.every(
    (c) =>
      c.createdBy === deviceId ||
      (c.createdBy === null && deck.createdBy === deviceId),
  )
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
    otherCardCount: cards.filter(
      (c) => c.createdBy !== null && c.createdBy !== deviceId,
    ).length,
    aiCardCount: cards.filter((c) => c.createdBy === null).length,
    totalCardCount: cards.length,
    playable: isPlayable(cards.length),
    canDelete: canDeleteDeck(deck, cards, deviceId),
    hidden: deck.hidden,
    ai: deck.generatedFrom !== null,
  }
}

/**
 * Cards with the same label (ignoring case, spaces, and punctuation) become
 * one card that remembers all its creators, so two players are never dealt
 * the same answer and neither creator is dealt it. Keeps the first image.
 */
export function mergeDuplicateCards(cards: CardRecord[]): Card[] {
  const merged = new Map<string, Card & { creators: string[] }>()
  for (const record of [...cards].sort((a, b) => a.createdAt - b.createdAt)) {
    const key = normalizeLabel(record.label)
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, { ...toCard(record) } as Card & { creators: string[] })
      continue
    }
    if (record.createdBy && !existing.creators.includes(record.createdBy)) {
      existing.creators.push(record.createdBy)
    }
    if (!existing.imageUrl && record.imageUrl) {
      existing.imageUrl = record.imageUrl
    }
  }
  return [...merged.values()]
}

/** The snapshot of a custom deck that goes into a room's state. */
export function toRoomCategory(
  deck: DeckRecord,
  cards: CardRecord[],
): Category {
  return {
    id: deck.id,
    name: deck.name,
    emoji: deck.emoji,
    description: deck.description,
    cards: mergeDuplicateCards(cards),
    visibility: "public",
    builtIn: false,
  }
}
