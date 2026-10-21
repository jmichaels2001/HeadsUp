import type { CardRecord, DeckRecord } from "@/lib/custom-decks/deck-view"
import type { DeckMeta, LibrarySort } from "@/lib/custom-decks/protocol"

export interface LibraryQuery {
  /** Case-insensitive name search. */
  query: string
  sort: LibrarySort
  limit: number
}

export interface CardPatch {
  label?: string
  imageUrl?: string | null
}

/** Persistence for custom decks. Supabase in prod, memory in tests/dev. */
export interface DeckStore {
  createDeck(deck: DeckRecord): Promise<void>
  getDeck(id: string): Promise<DeckRecord | null>
  /** Compare-and-set on version. Returns false if someone else wrote first. */
  updateDeck(
    id: string,
    expectedVersion: number,
    meta: DeckMeta,
    now: number,
  ): Promise<boolean>
  deleteDeck(id: string): Promise<void>
  /** Decks this device created or added cards to, newest first. */
  listDecksForDevice(deviceId: string): Promise<DeckRecord[]>
  /** Visible decks for the library (card counts are checked by the caller). */
  listVisibleDecks(query: LibraryQuery): Promise<DeckRecord[]>
  listHiddenDecks(): Promise<DeckRecord[]>
  getDecks(ids: string[]): Promise<DeckRecord[]>
  setHidden(id: string, hidden: boolean): Promise<void>
  incrementPlayCount(id: string): Promise<void>
  getCards(deckId: string): Promise<CardRecord[]>
  /** Card counts per deck, by creator. */
  getCardCreators(deckIds: string[]): Promise<Record<string, (string | null)[]>>
  addCard(card: CardRecord): Promise<void>
  addCards(cards: CardRecord[]): Promise<void>
  updateCard(deckId: string, cardId: string, patch: CardPatch): Promise<void>
  deleteCard(deckId: string, cardId: string): Promise<void>
}

/** In-process store for tests and local dev without Supabase. */
export class MemoryDeckStore implements DeckStore {
  private decks = new Map<string, DeckRecord>()
  private cards = new Map<string, CardRecord>()

  async createDeck(deck: DeckRecord) {
    this.decks.set(deck.id, structuredClone(deck))
  }

  async getDeck(id: string) {
    const deck = this.decks.get(id)
    return deck ? structuredClone(deck) : null
  }

  async updateDeck(
    id: string,
    expectedVersion: number,
    meta: DeckMeta,
    now: number,
  ) {
    const deck = this.decks.get(id)
    if (!deck || deck.version !== expectedVersion) return false
    this.decks.set(id, {
      ...deck,
      ...meta,
      version: expectedVersion + 1,
      updatedAt: now,
    })
    return true
  }

  async deleteDeck(id: string) {
    this.decks.delete(id)
    for (const [cardId, card] of this.cards) {
      if (card.deckId === id) this.cards.delete(cardId)
    }
  }

  async listDecksForDevice(deviceId: string) {
    const withMyCards = new Set(
      [...this.cards.values()]
        .filter((c) => c.createdBy === deviceId)
        .map((c) => c.deckId),
    )
    return [...this.decks.values()]
      .filter((d) => d.createdBy === deviceId || withMyCards.has(d.id))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((d) => structuredClone(d))
  }

  async listVisibleDecks({ query, sort, limit }: LibraryQuery) {
    const needle = query.trim().toLowerCase()
    return [...this.decks.values()]
      .filter((d) => !d.hidden && d.name.toLowerCase().includes(needle))
      .sort((a, b) =>
        sort === "popular"
          ? b.playCount - a.playCount || b.createdAt - a.createdAt
          : b.createdAt - a.createdAt,
      )
      .slice(0, limit)
      .map((d) => structuredClone(d))
  }

  async listHiddenDecks() {
    return [...this.decks.values()]
      .filter((d) => d.hidden)
      .map((d) => structuredClone(d))
  }

  async getDecks(ids: string[]) {
    return ids.flatMap((id) => {
      const deck = this.decks.get(id)
      return deck ? [structuredClone(deck)] : []
    })
  }

  async setHidden(id: string, hidden: boolean) {
    const deck = this.decks.get(id)
    if (deck) this.decks.set(id, { ...deck, hidden })
  }

  async incrementPlayCount(id: string) {
    const deck = this.decks.get(id)
    if (deck) this.decks.set(id, { ...deck, playCount: deck.playCount + 1 })
  }

  async getCards(deckId: string) {
    return [...this.cards.values()]
      .filter((c) => c.deckId === deckId)
      .map((c) => structuredClone(c))
  }

  async getCardCreators(deckIds: string[]) {
    const result: Record<string, (string | null)[]> = Object.fromEntries(
      deckIds.map((id) => [id, []]),
    )
    for (const card of this.cards.values()) {
      result[card.deckId]?.push(card.createdBy)
    }
    return result
  }

  async addCard(card: CardRecord) {
    this.cards.set(card.id, structuredClone(card))
  }

  async addCards(cards: CardRecord[]) {
    for (const card of cards) await this.addCard(card)
  }

  async updateCard(deckId: string, cardId: string, patch: CardPatch) {
    const card = this.cards.get(cardId)
    if (card?.deckId === deckId) this.cards.set(cardId, { ...card, ...patch })
  }

  async deleteCard(deckId: string, cardId: string) {
    if (this.cards.get(cardId)?.deckId === deckId) this.cards.delete(cardId)
  }
}
