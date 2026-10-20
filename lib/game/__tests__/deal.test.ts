import { describe, expect, it } from "vitest"

import { canDealFairly, dealCards } from "../deal"
import { gameReducer } from "../reducer"
import { getStartBlocker } from "../selectors"
import type { Card, Category, GameState, Player } from "../types"
import { getViewerState } from "../viewer"
import { lobby, makePlayer } from "./helpers"

function player(id: string, deviceId?: string): Player {
  return { ...makePlayer(id), ...(deviceId && { deviceId }) }
}

function card(label: string, ...creators: string[]): Card {
  return { id: label, label, ...(creators.length && { creators }) }
}

function withDeck(
  state: GameState,
  cards: Card[],
  devices: string[],
): GameState {
  const category: Category = {
    id: "custom",
    name: "Custom",
    emoji: "🃏",
    description: "",
    visibility: "public",
    builtIn: false,
    cards,
  }
  return {
    ...state,
    category,
    players: state.players.map((p, i) => ({ ...p, deviceId: devices[i] })),
  }
}

describe("dealCards", () => {
  it("never deals a player a card they created, across many seeds", () => {
    const players = [player("a", "A"), player("b", "B"), player("c", "C")]
    // Each player made most of the deck; only a few cards are fair game.
    const cards = [
      card("a1", "A"),
      card("a2", "A"),
      card("a3", "A"),
      card("b1", "B"),
      card("b2", "B"),
      card("c1", "C"),
    ]
    for (let seed = 0; seed < 500; seed++) {
      const dealt = dealCards(players, cards, seed)
      expect(dealt).not.toBeNull()
      for (const p of players) {
        expect(dealt![p.id].creators).not.toContain(p.deviceId)
      }
      expect(new Set(Object.values(dealt!).map((c) => c.id)).size).toBe(3)
    }
  })

  it("still varies the deal by seed", () => {
    const players = [player("a", "A"), player("b", "B")]
    const cards = Array.from({ length: 10 }, (_, i) =>
      card(`c${i}`, i % 2 ? "A" : "B"),
    )
    const deals = new Set(
      Array.from({ length: 50 }, (_, seed) =>
        JSON.stringify(dealCards(players, cards, seed)),
      ),
    )
    expect(deals.size).toBeGreaterThan(10)
  })

  it("matches the old shuffle-and-slice deal when nobody made any cards", () => {
    const players = [player("a"), player("b")]
    const cards = [card("x"), card("y"), card("z")]
    const dealt = dealCards(players, cards, 42)!
    const again = dealCards(players, cards, 42)!
    expect(dealt).toEqual(again)
    expect(dealt.a.id).not.toBe(dealt.b.id)
  })

  it("finds a deal that needs earlier players to swap", () => {
    // Shuffling may hand A the only card B can have; the matcher must swap.
    const players = [player("a", "A"), player("b", "B")]
    const cards = [card("ab"), card("onlyForA", "B")]
    for (let seed = 0; seed < 50; seed++) {
      const dealt = dealCards(players, cards, seed)!
      expect(dealt.a.id).toBe("onlyForA")
      expect(dealt.b.id).toBe("ab")
    }
  })

  it("returns null when no fair deal exists", () => {
    const players = [player("a", "A"), player("b", "B")]
    const allByA = Array.from({ length: 10 }, (_, i) => card(`a${i}`, "A"))
    expect(dealCards(players, allByA, 1)).toBeNull()
    expect(canDealFairly(players, allByA)).toBe(false)
  })

  it("keeps a merged card from both of its creators", () => {
    const players = [player("a", "A"), player("b", "B"), player("c", "C")]
    const cards = [card("shared", "A", "B"), card("c1", "C"), card("x")]
    for (let seed = 0; seed < 100; seed++) {
      const dealt = dealCards(players, cards, seed)!
      expect(dealt.c.id).toBe("shared")
    }
  })

  it("ignores creators for players without a device id", () => {
    const players = [player("a"), player("b")]
    const cards = [card("x", "A"), card("y", "A")]
    expect(dealCards(players, cards, 3)).not.toBeNull()
  })
})

describe("start blocker for own cards", () => {
  it("blocks the start when no fair deal exists", () => {
    const allByA = Array.from({ length: 10 }, (_, i) => card(`a${i}`, "A"))
    const state = withDeck(lobby(2), allByA, ["A", "B"])
    expect(getStartBlocker(state)).toBe("notEnoughOtherCards")
    expect(gameReducer(state, { type: "startRound", by: "a", seed: 1 })).toBe(
      state,
    )
  })

  it("reports too few cards before checking creators", () => {
    const state = withDeck(lobby(3), [card("x", "A"), card("y")], ["A"])
    expect(getStartBlocker(state)).toBe("notEnoughCards")
  })

  it("re-checks on the next round, e.g. after a late joiner who made cards", () => {
    const cards = [card("a1", "A"), card("b1", "B"), card("c1", "C")]
    let state = withDeck(lobby(2), cards, ["A", "B"])
    state = gameReducer(state, { type: "startRound", by: "a", seed: 1 })
    expect(state.phase).toBe("playing")
    state = gameReducer(state, { type: "endRound", by: "a" })
    state = gameReducer(state, {
      type: "join",
      player: player("c", "C"),
    })
    // a, b, c each made one of three cards: still a fair deal (a derangement).
    expect(getStartBlocker(state)).toBeNull()

    state = gameReducer(state, {
      type: "join",
      player: player("d", "A"),
    })
    // Now four players for three cards.
    expect(getStartBlocker(state)).toBe("notEnoughCards")
  })

  it("deals a round where nobody gets their own card", () => {
    const cards = Array.from({ length: 10 }, (_, i) =>
      card(`c${i}`, ["A", "B", "C"][i % 3]),
    )
    for (let seed = 0; seed < 100; seed++) {
      const state = gameReducer(withDeck(lobby(3), cards, ["A", "B", "C"]), {
        type: "startRound",
        by: "a",
        seed,
      })
      for (const p of state.players) {
        expect(state.round!.assignments[p.id].creators).not.toContain(
          p.deviceId,
        )
      }
    }
  })

  it("never shows device ids to other players", () => {
    const cards = Array.from({ length: 10 }, (_, i) => card(`c${i}`, "devZ"))
    const state = gameReducer(withDeck(lobby(2), cards, ["devA", "devB"]), {
      type: "startRound",
      by: "a",
      seed: 5,
    })
    const json = JSON.stringify(getViewerState(state, "a"))
    expect(json).not.toMatch(/devZ|devA|devB|creators|deviceId/)
  })
})
