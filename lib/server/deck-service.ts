import { randomBytes } from "node:crypto"

import { getDeckView, type CardRecord } from "@/lib/custom-decks/deck-view"
import {
  deviceIdSchema,
  isPlayable,
  MAX_DECK_CARDS,
  MAX_IMAGE_BYTES,
  normalizeLabel,
  type AddCardRequest,
  type DeckListItem,
  type DeckMeta,
  type DeckView,
  type ImageUploadResponse,
  type UpdateCardRequest,
  type UpdateDeckRequest,
} from "@/lib/custom-decks/protocol"

import type { DeckStore } from "./deck-store"
import { imageFileName, sniffImageType, type ImageStore } from "./image-store"
import { RoomError } from "./room-service"

export interface DeckServiceDeps {
  store: DeckStore
  images: ImageStore
  now?: () => number
  id?: (prefix: string) => string
}

function defaultId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString("base64url")}`
}

/**
 * Custom decks. Every deck is public and anyone can edit its name, emoji, and
 * description, but each card belongs to the device that added it: only that
 * device can see, edit, or remove it.
 */
export class DeckService {
  private store: DeckStore
  private images: ImageStore
  private now: () => number
  private id: (prefix: string) => string

  constructor(deps: DeckServiceDeps) {
    this.store = deps.store
    this.images = deps.images
    this.now = deps.now ?? Date.now
    this.id = deps.id ?? defaultId
  }

  async createDeck(deviceId: string, meta: DeckMeta): Promise<DeckView> {
    const device = checkDevice(deviceId)
    const now = this.now()
    const deck = {
      id: this.id("d"),
      ...meta,
      createdBy: device,
      version: 0,
      playCount: 0,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    }
    await this.store.createDeck(deck)
    return getDeckView(deck, [], device)
  }

  async getDeck(id: string, deviceId: string): Promise<DeckView> {
    const device = checkDevice(deviceId)
    const deck = await this.store.getDeck(id)
    if (!deck) throw notFound()
    return getDeckView(deck, await this.store.getCards(id), device)
  }

  async listMyDecks(deviceId: string): Promise<DeckListItem[]> {
    const device = checkDevice(deviceId)
    const decks = await this.store.listDecksForDevice(device)
    const creators = await this.store.getCardCreators(decks.map((d) => d.id))
    return decks.map((d) => {
      const cards = creators[d.id] ?? []
      return {
        id: d.id,
        name: d.name,
        emoji: d.emoji,
        description: d.description,
        totalCardCount: cards.length,
        myCardCount: cards.filter((c) => c === device).length,
        playable: isPlayable(cards.length),
        updatedAt: d.updatedAt,
      }
    })
  }

  async updateDeck(
    id: string,
    deviceId: string,
    { meta, expectedVersion }: UpdateDeckRequest,
  ): Promise<DeckView> {
    checkDevice(deviceId)
    if (!(await this.store.getDeck(id))) throw notFound()
    if (!(await this.store.updateDeck(id, expectedVersion, meta, this.now()))) {
      throw new RoomError(
        "conflict",
        "Someone else edited this deck. Reload to see their changes.",
      )
    }
    return this.getDeck(id, deviceId)
  }

  /** Only when every remaining card is yours, so nobody loses hidden work. */
  async deleteDeck(id: string, deviceId: string): Promise<void> {
    const view = await this.getDeck(id, deviceId)
    if (!view.canDelete) {
      throw new RoomError(
        "rejected",
        "Other players have cards in this deck. Remove your own cards instead.",
      )
    }
    await this.store.deleteDeck(id)
  }

  async addCard(
    id: string,
    deviceId: string,
    input: AddCardRequest,
  ): Promise<DeckView> {
    const device = checkDevice(deviceId)
    if (!(await this.store.getDeck(id))) throw notFound()
    const cards = await this.store.getCards(id)
    if (cards.length >= MAX_DECK_CARDS) {
      throw new RoomError(
        "rejected",
        `Decks hold up to ${MAX_DECK_CARDS} cards.`,
      )
    }
    this.checkDuplicate(cards, device, input.label)
    const card: CardRecord = {
      id: this.id("c"),
      deckId: id,
      label: input.label,
      imageUrl: this.checkImageUrl(input.imageUrl),
      createdBy: device,
      createdAt: this.now(),
    }
    await this.store.addCard(card)
    return this.getDeck(id, device)
  }

  async updateCard(
    id: string,
    cardId: string,
    deviceId: string,
    patch: UpdateCardRequest,
  ): Promise<DeckView> {
    const device = checkDevice(deviceId)
    const cards = await this.store.getCards(id)
    const card = ownCard(cards, cardId, device)
    if (patch.label !== undefined) {
      this.checkDuplicate(
        cards.filter((c) => c.id !== card.id),
        device,
        patch.label,
      )
    }
    await this.store.updateCard(id, cardId, {
      ...(patch.label !== undefined && { label: patch.label }),
      ...(patch.imageUrl !== undefined && {
        imageUrl: this.checkImageUrl(patch.imageUrl),
      }),
    })
    return this.getDeck(id, device)
  }

  async removeCard(
    id: string,
    cardId: string,
    deviceId: string,
  ): Promise<DeckView> {
    const device = checkDevice(deviceId)
    ownCard(await this.store.getCards(id), cardId, device)
    await this.store.deleteCard(id, cardId)
    return this.getDeck(id, device)
  }

  async uploadImage(bytes: Uint8Array): Promise<ImageUploadResponse> {
    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new RoomError("invalid", "That image is too big (1 MB max).")
    }
    const type = sniffImageType(bytes)
    if (!type) {
      throw new RoomError("invalid", "That doesn't look like an image.")
    }
    const url = await this.images.put(
      imageFileName(this.id("i"), type),
      bytes,
      type,
    )
    return { url }
  }

  /** Cards may only point at images uploaded through us. */
  private checkImageUrl(url: string | null | undefined): string | null {
    if (!url) return null
    if (!this.images.owns(url)) {
      throw new RoomError("invalid", "Upload the image instead of linking it.")
    }
    return url
  }

  /**
   * Your own duplicates are rejected. Someone else's aren't: saying so would
   * spoil their card. Those are merged when a deck is dealt.
   */
  private checkDuplicate(cards: CardRecord[], device: string, label: string) {
    const key = normalizeLabel(label)
    if (
      cards.some(
        (c) => c.createdBy === device && normalizeLabel(c.label) === key,
      )
    ) {
      throw new RoomError("rejected", "You already added that card.")
    }
  }
}

function checkDevice(deviceId: string): string {
  if (!deviceIdSchema.safeParse(deviceId).success) {
    throw new RoomError("invalid", "Missing or invalid device id.")
  }
  return deviceId
}

function ownCard(
  cards: CardRecord[],
  cardId: string,
  device: string,
): CardRecord {
  const card = cards.find((c) => c.id === cardId)
  // Someone else's card is reported as missing: you can't see it.
  if (!card || card.createdBy !== device) {
    throw new RoomError("notFound", "Card not found.")
  }
  return card
}

function notFound() {
  return new RoomError("notFound", "Deck not found.")
}
