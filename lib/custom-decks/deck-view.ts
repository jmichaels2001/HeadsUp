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
    creators: [record.createdBy],
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
      merged.set(key, { ...toCard(record), creators: [record.createdBy] })
      continue
    }
    if (!existing.creators.includes(record.createdBy)) {
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
