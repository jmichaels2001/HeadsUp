import { describe, expect, it } from "vitest"

import { gameReducer } from "../reducer"
import type { GameState } from "../types"
import { getViewerState } from "../viewer"
import { ask, guessAndVote, makePlayer, started } from "./helpers"

/** Asserts the viewer's own card id and label appear nowhere in the projection. */
function expectOwnCardHidden(state: GameState, viewerId: string) {
  const card = state.round!.assignments[viewerId]
  const view = getViewerState(state, viewerId)
  const json = JSON.stringify(view)
  expect(json).not.toContain(card.id)
  expect(json).not.toContain(card.label)
  expect(view.you!.card).toBeNull()
  expect(view.you!.cardHidden).toBe(true)
}

describe("getViewerState secrecy", () => {
  it("never includes a viewer's own unrevealed card, at any point in a round", () => {
    const snapshots: GameState[] = []
    let state = started(4)
    snapshots.push(state)
    state = ask(state, "a")
    snapshots.push(state)
    state = gameReducer(state, { type: "makeGuess", by: "b", text: "a guess" })
    snapshots.push(state)
    state = gameReducer(state, { type: "castVote", by: "a", vote: "notYet" })
    snapshots.push(state)
    state = guessAndVote(ask(state, "c"), "d", {
      a: "notYet",
      b: "notYet",
      c: "notYet",
    })
    snapshots.push(state)

    for (const snap of snapshots) {
      for (const id of snap.round!.turnOrder) {
        if (!snap.round!.solved.includes(id)) expectOwnCardHidden(snap, id)
      }
    }
  })

  it("shows the viewer everyone else's card", () => {
    const state = started(4)
    const view = getViewerState(state, "a")
    for (const p of view.players.filter((p) => !p.isYou)) {
      expect(p.card).toEqual(state.round!.assignments[p.id])
    }
  })

  it("reveals a card to its owner once they solve it", () => {
    const state = guessAndVote(started(3), "a", { b: "correct", c: "correct" })
    const view = getViewerState(state, "a")
    expect(view.you!.card).toEqual(state.round!.assignments.a)
    expect(view.you!.cardHidden).toBe(false)
    expect(view.you!.status).toBe("solved")
  })

  it("still hides other unsolved players' own cards after someone solves", () => {
    const state = guessAndVote(started(3), "a", { b: "correct", c: "correct" })
    expectOwnCardHidden(state, "b")
    expectOwnCardHidden(state, "c")
  })

  it("lets a solved player vote while seeing all cards", () => {
    let state = guessAndVote(started(3), "a", { b: "correct", c: "correct" })
    state = gameReducer(state, { type: "makeGuess", by: "b", text: "a guess" })
    const view = getViewerState(state, "a")
    expect(view.players.every((p) => p.card !== null)).toBe(true)
    expect(view.round!.turn).toMatchObject({
      kind: "voting",
      guess: { canVote: true, guesserId: "b" },
    })
  })

  it("reveals every card at round end", () => {
    const state = gameReducer(started(3), { type: "endRound", by: "a" })
    for (const id of ["a", "b", "c"]) {
      const view = getViewerState(state, id)
      expect(view.players.every((p) => p.card && !p.cardHidden)).toBe(true)
    }
  })

  it("never exposes the deck's card list", () => {
    const state = started(3)
    const view = getViewerState(state, "a")
    expect(view.category).toEqual({
      id: "test",
      name: "Test deck",
      emoji: "🧪",
      cardCount: 12,
    })
  })

  it("does not reveal how others voted, only that they voted", () => {
    let state = gameReducer(started(3), {
      type: "makeGuess",
      by: "a",
      text: "a guess",
    })
    state = gameReducer(state, { type: "castVote", by: "b", vote: "correct" })
    const view = getViewerState(state, "c")
    expect(view.players.find((p) => p.id === "b")!.hasVoted).toBe(true)
    expect(JSON.stringify(view)).not.toContain('"correct"')
  })

  it("marks late joiners as waiting with no card", () => {
    const state = gameReducer(started(3), {
      type: "join",
      player: makePlayer("z", 10),
    })
    const view = getViewerState(state, "z")
    expect(view.you!.status).toBe("waiting")
    expect(view.you!.card).toBeNull()
    expect(view.you!.cardHidden).toBe(false)
  })
})
