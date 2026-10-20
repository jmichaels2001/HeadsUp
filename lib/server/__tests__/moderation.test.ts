import { beforeEach, describe, expect, it } from "vitest"

import {
  adminToken,
  AdminService,
  isAdminSecret,
  isAdminToken,
} from "../admin-service"
import { DeckService } from "../deck-service"
import { MemoryDeckStore } from "../deck-store"
import { MemoryImageStore } from "../image-store"
import { MemoryReportStore } from "../report-store"
import { RoomError, RoomService } from "../room-service"
import { MemoryRoomStore } from "../store"

const OWNER = "device_owner"
const FRIEND = "device_friend"
const reporter = (n: number) => `device_reporter${n}`

let decks: DeckService
let admin: AdminService
let clock: number

beforeEach(() => {
  let n = 0
  clock = 1_000
  const store = new MemoryDeckStore()
  const reports = new MemoryReportStore()
  decks = new DeckService({
    store,
    reports,
    images: new MemoryImageStore(),
    now: () => (clock += 10),
    id: (prefix) => `${prefix}_${++n}`,
  })
  admin = new AdminService(store, reports)
})

async function deck(name: string, cards = 10, device = OWNER) {
  const view = await decks.createDeck(device, {
    name,
    emoji: "🃏",
    description: "",
  })
  for (let i = 0; i < cards; i++) {
    await decks.addCard(view.id, device, { label: `${name} card ${i}` })
  }
  return view.id
}

async function rejects(promise: Promise<unknown>, code: string) {
  const err = await promise.catch((e: unknown) => e)
  expect(err).toBeInstanceOf(RoomError)
  expect((err as RoomError).code).toBe(code)
}

describe("library", () => {
  it("lists playable, visible decks and never their cards", async () => {
    const villains = await deck("Villains")
    await deck("Draft", 9)
    const list = await decks.listLibrary("", "newest")
    expect(list.map((d) => d.id)).toEqual([villains])
    expect(list[0]).toMatchObject({ cardCount: 10, playCount: 0 })
    expect(JSON.stringify(list)).not.toMatch(/card \d/)
  })

  it("searches names case-insensitively", async () => {
    await deck("Movie Villains")
    await deck("Animals")
    const list = await decks.listLibrary("villain", "newest")
    expect(list.map((d) => d.name)).toEqual(["Movie Villains"])
  })

  it("sorts by newest or most played", async () => {
    const older = await deck("Older")
    const newer = await deck("Newer")
    await decks.recordPlay(older)
    await decks.recordPlay(older)
    expect((await decks.listLibrary("", "newest")).map((d) => d.id)).toEqual([
      newer,
      older,
    ])
    const popular = await decks.listLibrary("", "popular")
    expect(popular.map((d) => d.id)).toEqual([older, newer])
    expect(popular[0].playCount).toBe(2)
  })

  it("leaves out hidden decks", async () => {
    const id = await deck("Reported")
    await admin.act(id, "hide")
    expect(await decks.listLibrary("", "newest")).toEqual([])
  })
})

describe("reports", () => {
  it("hides a deck once 3 different browsers report it", async () => {
    const id = await deck("Villains")
    await decks.report(id, reporter(1), { reason: "offensive" })
    await decks.report(id, reporter(2), { reason: "spam" })
    expect((await decks.getDeck(id, OWNER)).hidden).toBe(false)
    await decks.report(id, reporter(3), { reason: "other", note: "hmm" })
    expect((await decks.getDeck(id, OWNER)).hidden).toBe(true)
  })

  it("counts repeat reports from one browser once", async () => {
    const id = await deck("Villains")
    for (let i = 0; i < 5; i++) {
      await decks.report(id, reporter(1), { reason: "spam" })
    }
    await decks.report(id, reporter(2), { reason: "spam" })
    expect((await decks.getDeck(id, OWNER)).hidden).toBe(false)
    const [flagged] = await admin.listFlagged()
    expect(flagged.reports).toHaveLength(2)
  })

  it("updates a browser's open report rather than adding another", async () => {
    const id = await deck("Villains")
    await decks.report(id, reporter(1), { reason: "spam" })
    await decks.report(id, reporter(1), { reason: "offensive", note: "rude" })
    const [flagged] = await admin.listFlagged()
    expect(flagged.reports).toMatchObject([
      { reason: "offensive", note: "rude" },
    ])
  })

  it("rejects reports on missing decks and bad device ids", async () => {
    await rejects(
      decks.report("d_nope", reporter(1), { reason: "spam" }),
      "notFound",
    )
    const id = await deck("Villains")
    await rejects(decks.report(id, "bad id", { reason: "spam" }), "invalid")
  })

  it("a hidden deck can't be picked in a room", async () => {
    const id = await deck("Villains")
    await admin.act(id, "hide")
    await rejects(decks.loadForRoom(id), "notFound")
  })

  it("tells contributors their deck is hidden", async () => {
    const id = await deck("Villains")
    await decks.addCard(id, FRIEND, { label: "Friend's card" })
    await admin.act(id, "hide")
    const mine = await decks.listMyDecks(FRIEND)
    expect(mine[0].hidden).toBe(true)
  })
})

describe("admin actions", () => {
  async function reported(count = 3) {
    const id = await deck("Villains")
    for (let i = 1; i <= count; i++) {
      await decks.report(id, reporter(i), { reason: "offensive" })
    }
    return id
  }

  it("lists reported and hidden decks with every card", async () => {
    const id = await reported(1)
    await deck("Clean")
    const flagged = await admin.listFlagged()
    expect(flagged.map((d) => d.id)).toEqual([id])
    expect(flagged[0].cards).toHaveLength(10)
  })

  it("dismiss closes the reports and unhides", async () => {
    const id = await reported()
    await admin.act(id, "dismiss")
    expect((await decks.getDeck(id, OWNER)).hidden).toBe(false)
    expect(await admin.listFlagged()).toEqual([])
    // New reports start counting from zero.
    await decks.report(id, reporter(1), { reason: "spam" })
    expect((await decks.getDeck(id, OWNER)).hidden).toBe(false)
  })

  it("hide keeps the deck listed for review as hidden", async () => {
    const id = await reported(1)
    await admin.act(id, "hide")
    const [flagged] = await admin.listFlagged()
    expect(flagged).toMatchObject({ id, hidden: true, reports: [] })
    await admin.act(id, "unhide")
    expect(await admin.listFlagged()).toEqual([])
  })

  it("delete removes the deck", async () => {
    const id = await reported()
    await admin.act(id, "delete")
    await rejects(decks.getDeck(id, OWNER), "notFound")
    expect(await admin.listFlagged()).toEqual([])
  })

  it("404s an unknown deck", async () => {
    await rejects(admin.act("d_nope", "hide"), "notFound")
  })
})

describe("admin auth", () => {
  it("accepts only a token made from the configured secret", () => {
    expect(isAdminToken("s3cret", adminToken("s3cret"))).toBe(true)
    expect(isAdminToken("s3cret", adminToken("wrong"))).toBe(false)
    expect(isAdminToken("s3cret", "garbage")).toBe(false)
    expect(isAdminToken("s3cret", undefined)).toBe(false)
  })

  it("is off when no secret is configured", () => {
    expect(isAdminToken(undefined, adminToken(""))).toBe(false)
    expect(isAdminToken("", adminToken(""))).toBe(false)
    expect(isAdminSecret(undefined, "")).toBe(false)
  })

  it("checks a sign-in attempt", () => {
    expect(isAdminSecret("s3cret", "s3cret")).toBe(true)
    expect(isAdminSecret("s3cret", "S3CRET")).toBe(false)
  })

  it("never stores the secret itself in the cookie", () => {
    expect(adminToken("s3cret")).not.toContain("s3cret")
  })
})

describe("play count", () => {
  it("goes up when a round starts with a custom deck, not a built-in one", async () => {
    const id = await deck("Villains", 10, FRIEND)
    let n = 0
    const rooms = new RoomService({
      store: new MemoryRoomStore(),
      seed: () => 1,
      token: () => `token-${++n}`,
      roomCode: () => "ROOMA",
      playerId: () => `p${n + 1}`,
      loadDeck: (deckId) => decks.loadForRoom(deckId),
      onRoundStart: (deckId) => decks.recordPlay(deckId),
    })
    const media = { mic: true, camera: true }
    const host = await rooms.createRoom({ name: "A", media, deviceId: OWNER })
    await rooms.joinRoom(host.code, { name: "B", media })

    // Built-in deck (the room's default).
    await rooms.act(host.code, host.token, { type: "startRound" })
    await rooms.act(host.code, host.token, { type: "endRound" })
    await rooms.act(host.code, host.token, { type: "backToLobby" })

    await rooms.act(host.code, host.token, {
      type: "selectCategory",
      categoryId: id,
    })
    await rooms.act(host.code, host.token, { type: "startRound" })
    await rooms.act(host.code, host.token, { type: "endRound" })
    await rooms.act(host.code, host.token, { type: "nextRound" })

    const [entry] = await decks.listLibrary("", "popular")
    expect(entry).toMatchObject({ id, playCount: 2 })
  })
})
