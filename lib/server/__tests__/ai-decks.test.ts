import Anthropic from "@anthropic-ai/sdk"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AI_HOURLY_LIMIT } from "@/lib/custom-decks/protocol"
import { dealCards } from "@/lib/game"

import { AdminService } from "../admin-service"
import {
  claudeDeckGenerator,
  cleanGeneratedDeck,
  type DeckGenerator,
} from "../ai-deck"
import { DeckService } from "../deck-service"
import { MemoryDeckStore } from "../deck-store"
import { MemoryGenerationLog } from "../generation-log"
import { MemoryImageStore } from "../image-store"
import { MemoryReportStore } from "../report-store"
import { RoomError } from "../room-service"

const ME = "device_generator"
const FRIEND = "device_friend"
const HOUR = 3_600_000

const labels = (n: number, prefix = "Card") =>
  Array.from({ length: n }, (_, i) => `${prefix} ${i}`)

let clock: number
let store: MemoryDeckStore
let reports: MemoryReportStore
let generator: ReturnType<typeof vi.fn<DeckGenerator>>

function service(withGenerator = true) {
  let n = 0
  return new DeckService({
    store,
    reports,
    generations: new MemoryGenerationLog(),
    images: new MemoryImageStore(),
    generator: withGenerator ? generator : null,
    now: () => clock,
    id: (prefix) => `${prefix}_${++n}`,
  })
}

beforeEach(() => {
  clock = 10 * HOUR
  store = new MemoryDeckStore()
  reports = new MemoryReportStore()
  generator = vi.fn<DeckGenerator>(async (_prompt, count) => ({
    name: "Cartoons",
    emoji: "📺",
    description: "90s cartoons",
    labels: labels(count, "Toon"),
  }))
})

async function rejects(promise: Promise<unknown>, code: string) {
  const err = await promise.catch((e: unknown) => e)
  expect(err).toBeInstanceOf(RoomError)
  expect((err as RoomError).code).toBe(code)
  return err as RoomError
}

describe("cleanGeneratedDeck", () => {
  const raw = (cards: string[]) => ({
    name: "  Cartoons ",
    emoji: "📺",
    description: "90s cartoons",
    cards,
  })

  it("trims, removes duplicates, drops over-long labels, and caps the count", () => {
    const deck = cleanGeneratedDeck(
      raw([
        "  Bugs   Bunny ",
        "bugs bunny!",
        "x".repeat(61),
        "",
        ...labels(20, "Toon"),
      ]),
      12,
    )
    expect(deck.name).toBe("Cartoons")
    expect(deck.labels).toHaveLength(12)
    expect(deck.labels[0]).toBe("Bugs Bunny")
    expect(deck.labels).not.toContain("bugs bunny!")
    expect(deck.labels.some((l) => l.length > 60)).toBe(false)
  })

  it("rejects decks left with too few cards to play", async () => {
    await rejects(
      Promise.resolve().then(() =>
        cleanGeneratedDeck(raw(["a", "A", "b", ...labels(7)]), 20),
      ),
      "rejected",
    )
  })

  it("falls back for a missing name or a bogus emoji", () => {
    const deck = cleanGeneratedDeck(
      {
        name: " ",
        emoji: "not an emoji at all, really",
        description: "",
        cards: labels(10),
      },
      10,
    )
    expect(deck.name).toBe("AI deck")
    expect(deck.emoji).toBe("✨")
  })
})

describe("generating a deck", () => {
  it("saves a blind deck: the generator sees none of the cards", async () => {
    const decks = service()
    const view = await decks.generate(ME, {
      prompt: " 90s cartoons ",
      count: 15,
    })
    expect(generator).toHaveBeenCalledWith("90s cartoons", 15)
    expect(view).toMatchObject({
      name: "Cartoons",
      myCards: [],
      otherCardCount: 0,
      aiCardCount: 15,
      totalCardCount: 15,
      playable: true,
      ai: true,
    })
    expect(JSON.stringify(view)).not.toMatch(/Toon/)
    expect(JSON.stringify(await decks.getDeck(view.id, FRIEND))).not.toMatch(
      /Toon/,
    )
  })

  it("AI cards can be dealt to anyone, including the generator", async () => {
    const decks = service()
    const view = await decks.generate(ME, { prompt: "toons", count: 10 })
    const category = await decks.loadForRoom(view.id)
    expect(category.cards.every((c) => c.creators?.length === 0)).toBe(true)
    const players = [ME, FRIEND].map((deviceId, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      joinedAt: i,
      media: { mic: true, camera: true, connection: "good" as const },
      deviceId,
    }))
    expect(dealCards(players, category.cards, 3)).not.toBeNull()
  })

  it("AI cards can't be edited or removed by anyone", async () => {
    const decks = service()
    const view = await decks.generate(ME, { prompt: "toons", count: 10 })
    const [card] = (await store.getCards(view.id)).slice(0, 1)
    await rejects(decks.removeCard(view.id, card.id, ME), "notFound")
    await rejects(
      decks.updateCard(view.id, card.id, ME, { label: "x" }),
      "notFound",
    )
  })

  it("only the generator can delete a pure AI deck", async () => {
    const decks = service()
    const view = await decks.generate(ME, { prompt: "toons", count: 10 })
    expect((await decks.getDeck(view.id, FRIEND)).canDelete).toBe(false)
    await rejects(decks.deleteDeck(view.id, FRIEND), "rejected")
    expect((await decks.getDeck(view.id, ME)).canDelete).toBe(true)
    await decks.deleteDeck(view.id, ME)
  })

  it("friends can still add their own cards to an AI deck", async () => {
    const decks = service()
    const view = await decks.generate(ME, { prompt: "toons", count: 10 })
    const friend = await decks.addCard(view.id, FRIEND, { label: "Doug" })
    expect(friend).toMatchObject({ aiCardCount: 10, totalCardCount: 11 })
    expect(friend.myCards.map((c) => c.label)).toEqual(["Doug"])
    // Now the generator can't delete it: it holds a friend's card.
    expect((await decks.getDeck(view.id, ME)).canDelete).toBe(false)
  })

  it("shows up as AI in the library, my decks, and admin with its prompt", async () => {
    const decks = service()
    const view = await decks.generate(ME, { prompt: "90s cartoons", count: 10 })
    expect((await decks.listLibrary("", "newest"))[0].ai).toBe(true)
    expect((await decks.listMyDecks(ME))[0].ai).toBe(true)
    await decks.report(view.id, FRIEND, { reason: "other" })
    const [flagged] = await new AdminService(store, reports).listFlagged()
    expect(flagged.generatedFrom).toBe("90s cartoons")
    expect(flagged.cards.every((c) => c.ai)).toBe(true)
  })

  it("is unavailable without an API key", async () => {
    const decks = service(false)
    expect(decks.aiEnabled).toBe(false)
    await rejects(decks.generate(ME, { prompt: "toons" }), "unavailable")
  })

  it("passes the generator's friendly errors through", async () => {
    generator.mockRejectedValueOnce(
      new RoomError("rejected", "Claude couldn't make that deck."),
    )
    const err = await rejects(
      service().generate(ME, { prompt: "toons" }),
      "rejected",
    )
    expect(err.message).toMatch(/couldn't make that deck/)
    expect(await store.listDecksForDevice(ME)).toEqual([])
  })
})

describe("hourly limit", () => {
  it("allows 10 generations an hour per browser, then frees up", async () => {
    const decks = service()
    for (let i = 0; i < AI_HOURLY_LIMIT; i++) {
      await decks.generate(ME, { prompt: `deck ${i}`, count: 10 })
      clock += 60_000
    }
    const err = await rejects(
      decks.generate(ME, { prompt: "one more", count: 10 }),
      "rateLimited",
    )
    expect(err.status).toBe(429)
    // Someone else isn't affected.
    await decks.generate(FRIEND, { prompt: "theirs", count: 10 })
    // An hour after the first one, a slot opens.
    clock += HOUR - AI_HOURLY_LIMIT * 60_000 + 1
    await decks.generate(ME, { prompt: "later", count: 10 })
  })

  it("counts failed attempts too", async () => {
    generator.mockRejectedValue(new RoomError("rejected", "nope"))
    const decks = service()
    for (let i = 0; i < AI_HOURLY_LIMIT; i++) {
      await rejects(decks.generate(ME, { prompt: "x" }), "rejected")
    }
    await rejects(decks.generate(ME, { prompt: "x" }), "rateLimited")
  })
})

describe("claudeDeckGenerator", () => {
  type Parse = Anthropic["messages"]["parse"]

  function withParse(parse: (...args: Parameters<Parse>) => unknown) {
    const client = {
      messages: { parse: vi.fn(parse) },
    } as unknown as Pick<Anthropic, "messages">
    return {
      client,
      generate: claudeDeckGenerator({
        apiKey: "test",
        model: "claude-haiku-5-5",
        client,
      }),
    }
  }

  const ok = (cards: string[]) => ({
    stop_reason: "end_turn",
    parsed_output: { name: "Toons", emoji: "📺", description: "", cards },
  })

  it("asks for a few spare cards, structured output, and passes the theme as data", async () => {
    const { client, generate } = withParse(async () => ok(labels(25)))
    const deck = await generate("90s cartoons", 20)
    expect(deck.labels).toHaveLength(20)
    const [params] = vi.mocked(client.messages.parse).mock.calls[0]
    expect(params.model).toBe("claude-haiku-5-5")
    expect(params.output_config?.format).toBeDefined()
    expect(JSON.stringify(params.messages)).toContain(
      "<theme>90s cartoons</theme>",
    )
    expect(JSON.stringify(params.messages)).toContain("25 cards")
  })

  it("turns a refusal into a friendly rejection", async () => {
    const { generate } = withParse(async () => ({
      stop_reason: "refusal",
      parsed_output: null,
    }))
    const err = await rejects(generate("something", 10), "rejected")
    expect(err.message).toMatch(/couldn't make that deck/)
  })

  it("reports unparseable output as unavailable", async () => {
    const { generate } = withParse(async () => ({
      stop_reason: "max_tokens",
      parsed_output: null,
    }))
    await rejects(generate("toons", 10), "unavailable")
  })

  it("maps API errors to friendly messages", async () => {
    const rateLimited = new Anthropic.RateLimitError(
      429,
      undefined,
      "slow down",
      new Headers(),
    )
    const busy = withParse(async () => {
      throw rateLimited
    })
    const err = await rejects(busy.generate("toons", 10), "unavailable")
    expect(err.message).toMatch(/busy/)

    const broken = withParse(async () => {
      throw new Anthropic.InternalServerError(
        500,
        undefined,
        "boom",
        new Headers(),
      )
    })
    vi.spyOn(console, "error").mockImplementation(() => {})
    const err2 = await rejects(broken.generate("toons", 10), "unavailable")
    expect(err2.message).toMatch(/isn't available/)
  })
})
