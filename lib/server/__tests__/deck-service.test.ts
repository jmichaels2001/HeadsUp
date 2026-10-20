import { beforeEach, describe, expect, it } from "vitest"

import {
  MAX_DECK_CARDS,
  MAX_IMAGE_BYTES,
  MIN_PLAYABLE_CARDS,
  addCardSchema,
  deckMetaSchema,
  normalizeLabel,
} from "@/lib/custom-decks/protocol"

import { DeckService } from "../deck-service"
import { MemoryDeckStore } from "../deck-store"
import { MemoryImageStore, sniffImageType } from "../image-store"
import { RoomError } from "../room-service"

const ALICE = "device_alice"
const BOB = "device_bob"
const META = { name: "Villains", emoji: "😈", description: "Bad guys" }

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d,
])
const WEBP = new Uint8Array([
  ...new TextEncoder().encode("RIFF"),
  0,
  0,
  0,
  0,
  ...new TextEncoder().encode("WEBP"),
])

let service: DeckService
let images: MemoryImageStore
let clock: number

beforeEach(() => {
  let n = 0
  clock = 1_000
  images = new MemoryImageStore()
  service = new DeckService({
    store: new MemoryDeckStore(),
    images,
    now: () => clock++,
    id: (prefix) => `${prefix}_${++n}`,
  })
})

async function rejects(promise: Promise<unknown>, code: string) {
  const err = await promise.catch((e: unknown) => e)
  expect(err).toBeInstanceOf(RoomError)
  expect((err as RoomError).code).toBe(code)
}

describe("deck view", () => {
  it("only returns the requester's own cards, plus a count of the rest", async () => {
    const deck = await service.createDeck(ALICE, META)
    await service.addCard(deck.id, ALICE, { label: "Darth Vader" })
    await service.addCard(deck.id, BOB, { label: "Joker" })
    await service.addCard(deck.id, BOB, { label: "Thanos" })

    const alice = await service.getDeck(deck.id, ALICE)
    expect(alice.myCards.map((c) => c.label)).toEqual(["Darth Vader"])
    expect(alice.otherCardCount).toBe(2)
    expect(alice.totalCardCount).toBe(3)
    expect(JSON.stringify(alice)).not.toMatch(/Joker|Thanos/)

    const bob = await service.getDeck(deck.id, BOB)
    expect(bob.myCards.map((c) => c.label)).toEqual(["Joker", "Thanos"])
    expect(bob.otherCardCount).toBe(1)
    expect(JSON.stringify(bob)).not.toMatch(/Vader/)
  })

  it("responses to card changes also hide other players' cards", async () => {
    const deck = await service.createDeck(ALICE, META)
    await service.addCard(deck.id, BOB, { label: "Joker" })
    const view = await service.addCard(deck.id, ALICE, { label: "Vader" })
    expect(JSON.stringify(view)).not.toMatch(/Joker/)
  })

  it("records the creator on every card", async () => {
    const deck = await service.createDeck(ALICE, META)
    const view = await service.addCard(deck.id, ALICE, { label: "Vader" })
    expect(view.myCards[0].creators).toEqual([ALICE])
  })

  it("is a playable deck only from the minimum card count, from anyone", async () => {
    const deck = await service.createDeck(ALICE, META)
    for (let i = 0; i < MIN_PLAYABLE_CARDS - 1; i++) {
      await service.addCard(deck.id, i % 2 ? ALICE : BOB, { label: `C${i}` })
    }
    expect((await service.getDeck(deck.id, ALICE)).playable).toBe(false)
    await service.addCard(deck.id, BOB, { label: "Last" })
    expect((await service.getDeck(deck.id, ALICE)).playable).toBe(true)
  })

  it("rejects a missing or malformed device id", async () => {
    await rejects(service.createDeck("", META), "invalid")
    await rejects(service.createDeck("bad id!", META), "invalid")
  })

  it("404s an unknown deck", async () => {
    await rejects(service.getDeck("d_nope", ALICE), "notFound")
  })
})

describe("deck details", () => {
  it("anyone can edit name, emoji, and description", async () => {
    const deck = await service.createDeck(ALICE, META)
    const view = await service.updateDeck(deck.id, BOB, {
      meta: { ...META, name: "Baddies" },
      expectedVersion: 0,
    })
    expect(view.name).toBe("Baddies")
    expect(view.version).toBe(1)
  })

  it("rejects a stale save (last write wins on a fresh version)", async () => {
    const deck = await service.createDeck(ALICE, META)
    await service.updateDeck(deck.id, BOB, {
      meta: { ...META, name: "Bob's" },
      expectedVersion: 0,
    })
    await rejects(
      service.updateDeck(deck.id, ALICE, {
        meta: { ...META, name: "Alice's" },
        expectedVersion: 0,
      }),
      "conflict",
    )
    expect((await service.getDeck(deck.id, ALICE)).name).toBe("Bob's")
  })

  it("card changes don't bump the version", async () => {
    const deck = await service.createDeck(ALICE, META)
    await service.addCard(deck.id, BOB, { label: "Joker" })
    const view = await service.updateDeck(deck.id, ALICE, {
      meta: META,
      expectedVersion: 0,
    })
    expect(view.version).toBe(1)
  })
})

describe("cards", () => {
  it("only the creator can edit or remove a card", async () => {
    const deck = await service.createDeck(ALICE, META)
    const view = await service.addCard(deck.id, ALICE, { label: "Vader" })
    const cardId = view.myCards[0].id

    await rejects(
      service.updateCard(deck.id, cardId, BOB, { label: "Hacked" }),
      "notFound",
    )
    await rejects(service.removeCard(deck.id, cardId, BOB), "notFound")

    const edited = await service.updateCard(deck.id, cardId, ALICE, {
      label: "Darth Vader",
    })
    expect(edited.myCards[0].label).toBe("Darth Vader")
    const removed = await service.removeCard(deck.id, cardId, ALICE)
    expect(removed.myCards).toEqual([])
  })

  it("rejects your own duplicates but allows someone else's", async () => {
    const deck = await service.createDeck(ALICE, META)
    await service.addCard(deck.id, ALICE, { label: "Darth Vader" })
    await rejects(
      service.addCard(deck.id, ALICE, { label: "darth  vader!" }),
      "rejected",
    )
    const bob = await service.addCard(deck.id, BOB, { label: "Darth Vader" })
    expect(bob.totalCardCount).toBe(2)
  })

  it("rejects renaming a card to one of your other cards", async () => {
    const deck = await service.createDeck(ALICE, META)
    await service.addCard(deck.id, ALICE, { label: "Joker" })
    const view = await service.addCard(deck.id, ALICE, { label: "Vader" })
    const vader = view.myCards.find((c) => c.label === "Vader")!
    await rejects(
      service.updateCard(deck.id, vader.id, ALICE, { label: "joker" }),
      "rejected",
    )
    // Renaming to the same label (e.g. changing case) is fine.
    await service.updateCard(deck.id, vader.id, ALICE, { label: "VADER" })
  })

  it("caps a deck at the maximum card count", async () => {
    const deck = await service.createDeck(ALICE, META)
    for (let i = 0; i < MAX_DECK_CARDS; i++) {
      await service.addCard(deck.id, ALICE, { label: `Card ${i}` })
    }
    await rejects(
      service.addCard(deck.id, BOB, { label: "One too many" }),
      "rejected",
    )
  })
})

describe("deleting a deck", () => {
  it("is allowed when every card is yours", async () => {
    const deck = await service.createDeck(ALICE, META)
    await service.addCard(deck.id, ALICE, { label: "Vader" })
    expect((await service.getDeck(deck.id, ALICE)).canDelete).toBe(true)
    await service.deleteDeck(deck.id, ALICE)
    await rejects(service.getDeck(deck.id, ALICE), "notFound")
  })

  it("is refused while someone else has cards in it", async () => {
    const deck = await service.createDeck(ALICE, META)
    await service.addCard(deck.id, ALICE, { label: "Vader" })
    await service.addCard(deck.id, BOB, { label: "Joker" })
    expect((await service.getDeck(deck.id, ALICE)).canDelete).toBe(false)
    await rejects(service.deleteDeck(deck.id, ALICE), "rejected")
  })

  it("an empty deck can be deleted by anyone", async () => {
    const deck = await service.createDeck(ALICE, META)
    await service.deleteDeck(deck.id, BOB)
    await rejects(service.getDeck(deck.id, ALICE), "notFound")
  })
})

describe("my decks", () => {
  it("lists decks you created or added cards to, with your card count", async () => {
    const mine = await service.createDeck(ALICE, META)
    const bobs = await service.createDeck(BOB, { ...META, name: "Bob's" })
    await service.createDeck(BOB, { ...META, name: "Not Alice's" })
    await service.addCard(bobs.id, ALICE, { label: "Vader" })
    await service.addCard(bobs.id, BOB, { label: "Joker" })

    const list = await service.listMyDecks(ALICE)
    expect(list.map((d) => d.id).sort()).toEqual([mine.id, bobs.id].sort())
    const shared = list.find((d) => d.id === bobs.id)!
    expect(shared.totalCardCount).toBe(2)
    expect(shared.myCardCount).toBe(1)
  })
})

describe("card images", () => {
  it("accepts real images and returns a URL cards can use", async () => {
    const { url } = await service.uploadImage(PNG)
    expect(url).toMatch(/\.png$/)
    const deck = await service.createDeck(ALICE, META)
    const view = await service.addCard(deck.id, ALICE, {
      label: "Vader",
      imageUrl: url,
    })
    expect(view.myCards[0].imageUrl).toBe(url)
  })

  it("rejects files that aren't images, whatever they claim to be", async () => {
    await rejects(
      service.uploadImage(new TextEncoder().encode("<svg>not allowed</svg>")),
      "invalid",
    )
  })

  it("rejects images over the size limit", async () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1)
    big.set(PNG)
    await rejects(service.uploadImage(big), "invalid")
  })

  it("rejects image URLs that weren't uploaded through the app", async () => {
    const deck = await service.createDeck(ALICE, META)
    await rejects(
      service.addCard(deck.id, ALICE, {
        label: "Vader",
        imageUrl: "https://example.com/vader.png",
      }),
      "invalid",
    )
  })

  it("can remove a card's image", async () => {
    const { url } = await service.uploadImage(WEBP)
    const deck = await service.createDeck(ALICE, META)
    const view = await service.addCard(deck.id, ALICE, {
      label: "Vader",
      imageUrl: url,
    })
    const cleared = await service.updateCard(
      deck.id,
      view.myCards[0].id,
      ALICE,
      { imageUrl: null },
    )
    expect(cleared.myCards[0].imageUrl).toBeUndefined()
  })

  it("sniffs image types from magic bytes", () => {
    expect(sniffImageType(PNG)).toBe("image/png")
    expect(sniffImageType(WEBP)).toBe("image/webp")
    expect(
      sniffImageType(
        new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      ),
    ).toBe("image/jpeg")
    expect(sniffImageType(new TextEncoder().encode("GIF89a......"))).toBe(
      "image/gif",
    )
    expect(sniffImageType(new Uint8Array(4))).toBeNull()
  })
})

describe("schemas", () => {
  it("enforces deck and card limits", () => {
    expect(deckMetaSchema.safeParse(META).success).toBe(true)
    expect(deckMetaSchema.safeParse({ ...META, name: "  " }).success).toBe(
      false,
    )
    expect(
      deckMetaSchema.safeParse({ ...META, name: "x".repeat(41) }).success,
    ).toBe(false)
    expect(addCardSchema.safeParse({ label: "x".repeat(60) }).success).toBe(
      true,
    )
    expect(addCardSchema.safeParse({ label: "x".repeat(61) }).success).toBe(
      false,
    )
  })

  it("normalizes labels for duplicate checks", () => {
    expect(normalizeLabel("  Darth-Vader! ")).toBe(
      normalizeLabel("darth vader"),
    )
    expect(normalizeLabel("Pokémon")).toBe("pokémon")
  })
})
