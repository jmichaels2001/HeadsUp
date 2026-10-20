import { describe, expect, it } from "vitest"

import { mergeDuplicateCards } from "@/lib/custom-decks/deck-view"

import { DeckService } from "../deck-service"
import { MemoryDeckStore } from "../deck-store"
import { MemoryImageStore } from "../image-store"
import { RoomError, RoomService } from "../room-service"
import { MemoryRoomStore } from "../store"

const media = { mic: true, camera: true }
const ALICE = "device_alice"
const BOB = "device_bob"
const META = { name: "Villains", emoji: "😈", description: "" }

function setup() {
  let n = 0
  let seed = 0
  const decks = new DeckService({
    store: new MemoryDeckStore(),
    images: new MemoryImageStore(),
  })
  const rooms = new RoomService({
    store: new MemoryRoomStore(),
    seed: () => ++seed,
    token: () => `token-${++n}`,
    roomCode: () => "ROOMA",
    playerId: () => `p${n + 1}`,
    loadDeck: (id) => decks.loadForRoom(id),
  })
  return { decks, rooms }
}

async function deckWith(
  decks: DeckService,
  cards: [label: string, device: string][],
) {
  const deck = await decks.createDeck(ALICE, META)
  for (const [label, device] of cards) {
    await decks.addCard(deck.id, device, { label })
  }
  return deck.id
}

async function rejects(promise: Promise<unknown>, code: string) {
  const err = await promise.catch((e: unknown) => e)
  expect(err).toBeInstanceOf(RoomError)
  expect((err as RoomError).code).toBe(code)
}

const tenEach = (device: string, prefix: string) =>
  Array.from(
    { length: 10 },
    (_, i) => [`${prefix} ${i}`, device] as [string, string],
  )

describe("custom decks in rooms", () => {
  it("snapshots a custom deck and never deals a creator their own card", async () => {
    const { decks, rooms } = setup()
    const id = await deckWith(decks, [
      ...tenEach(ALICE, "Alice"),
      ...tenEach(BOB, "Bob"),
    ])
    const host = await rooms.createRoom({
      name: "Alice",
      media,
      deviceId: ALICE,
    })
    const bob = await rooms.joinRoom(host.code, {
      name: "Bob",
      media,
      deviceId: BOB,
    })

    let view = await rooms.act(host.code, host.token, {
      type: "selectCategory",
      categoryId: id,
    })
    expect(view.view.category).toMatchObject({ id, cardCount: 20 })
    expect(JSON.stringify(view.view)).not.toMatch(/Alice \d|Bob \d/)

    for (let round = 0; round < 20; round++) {
      view = await rooms.act(
        host.code,
        host.token,
        round === 0 ? { type: "startRound" } : { type: "nextRound" },
      )
      // Alice sees Bob's card: it must be one Alice made.
      const bobsCard = view.view.players.find((p) => p.id === bob.playerId)!
      expect(bobsCard.card?.label).toMatch(/^Alice/)
      const bobView = await rooms.getRoom(host.code, bob.token)
      const alicesCard = bobView.view.players.find(
        (p) => p.id === host.playerId,
      )!
      expect(alicesCard.card?.label).toMatch(/^Bob/)
      await rooms.act(host.code, host.token, { type: "endRound" })
    }
  })

  it("edits after selecting don't change the room's deck", async () => {
    const { decks, rooms } = setup()
    const id = await deckWith(decks, tenEach(BOB, "Bob"))
    const host = await rooms.createRoom({
      name: "Alice",
      media,
      deviceId: ALICE,
    })
    await rooms.act(host.code, host.token, {
      type: "selectCategory",
      categoryId: id,
    })
    await decks.addCard(id, BOB, { label: "Late addition" })
    const view = await rooms.getRoom(host.code, host.token)
    expect(view.view.category?.cardCount).toBe(10)
  })

  it("blocks the start when one player made every card", async () => {
    const { decks, rooms } = setup()
    const id = await deckWith(decks, tenEach(ALICE, "Alice"))
    const host = await rooms.createRoom({
      name: "Alice",
      media,
      deviceId: ALICE,
    })
    await rooms.joinRoom(host.code, { name: "Bob", media, deviceId: BOB })
    const view = await rooms.act(host.code, host.token, {
      type: "selectCategory",
      categoryId: id,
    })
    expect(view.view.startBlocker).toBe("notEnoughOtherCards")
    await rejects(
      rooms.act(host.code, host.token, { type: "startRound" }),
      "rejected",
    )
  })

  it("rejects drafts and unknown decks without a 404", async () => {
    const { decks, rooms } = setup()
    const draft = await deckWith(decks, [["Only one", BOB]])
    const host = await rooms.createRoom({
      name: "Alice",
      media,
      deviceId: ALICE,
    })
    await rejects(
      rooms.act(host.code, host.token, {
        type: "selectCategory",
        categoryId: draft,
      }),
      "rejected",
    )
    await rejects(
      rooms.act(host.code, host.token, {
        type: "selectCategory",
        categoryId: "d_missing",
      }),
      "invalid",
    )
  })

  it("keeps device ids out of every player's view", async () => {
    const { rooms } = setup()
    const host = await rooms.createRoom({
      name: "Alice",
      media,
      deviceId: ALICE,
    })
    const view = await rooms.joinRoom(host.code, {
      name: "Bob",
      media,
      deviceId: BOB,
    })
    expect(JSON.stringify(view.view)).not.toMatch(/device_/)
  })
})

describe("mergeDuplicateCards", () => {
  const record = (
    id: string,
    label: string,
    createdBy: string,
    imageUrl: string | null = null,
  ) => ({ id, deckId: "d", label, imageUrl, createdBy, createdAt: Number(id) })

  it("merges labels that differ only by case, spacing, or punctuation", () => {
    const merged = mergeDuplicateCards([
      record("1", "Darth Vader", ALICE),
      record("2", "darth-vader!", BOB),
      record("3", "Joker", BOB),
    ])
    expect(merged).toHaveLength(2)
    expect(merged[0]).toMatchObject({
      id: "1",
      label: "Darth Vader",
      creators: [ALICE, BOB],
    })
  })

  it("keeps an image from any copy", () => {
    const [card] = mergeDuplicateCards([
      record("1", "Vader", ALICE),
      record("2", "vader", BOB, "/img.webp"),
    ])
    expect(card.imageUrl).toBe("/img.webp")
  })

  it("lists each creator once", () => {
    const [card] = mergeDuplicateCards([
      record("1", "Vader", ALICE),
      record("2", "VADER", ALICE),
    ])
    expect(card.creators).toEqual([ALICE])
  })
})
