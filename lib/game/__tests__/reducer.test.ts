import { describe, expect, it } from "vitest"

import { gameReducer } from "../reducer"
import { getStartBlocker } from "../selectors"
import {
  active,
  apply,
  ask,
  guessAndVote,
  lobby,
  makePlayer,
  started,
  voiceLobby,
} from "./helpers"

describe("starting a round", () => {
  it("deals a unique card to every player and starts with the first player", () => {
    const state = started(4)
    expect(state.phase).toBe("playing")
    const cards = Object.values(state.round!.assignments).map((c) => c.id)
    expect(cards).toHaveLength(4)
    expect(new Set(cards).size).toBe(4)
    expect(active(state)).toBe("a")
  })

  it("only lets the host start", () => {
    const state = gameReducer(lobby(3), {
      type: "startRound",
      by: "b",
      seed: 1,
    })
    expect(state.phase).toBe("lobby")
  })

  it("blocks start when the deck has fewer cards than players", () => {
    const state = lobby(4, 3)
    expect(getStartBlocker(state)).toBe("notEnoughCards")
    expect(
      gameReducer(state, { type: "startRound", by: "a", seed: 1 }).phase,
    ).toBe("lobby")
  })

  it("blocks start with fewer than 2 players", () => {
    expect(getStartBlocker(lobby(1))).toBe("notEnoughPlayers")
  })

  it("caps the room at 8 players", () => {
    const full = lobby(8)
    const next = gameReducer(full, {
      type: "join",
      player: makePlayer("z", 99),
    })
    expect(next.players).toHaveLength(8)
  })
})

describe("turn order", () => {
  it("passes the turn in fixed order after a question is answered", () => {
    let state = started(3)
    state = ask(state, "a")
    expect(active(state)).toBe("b")
    state = ask(state, "b")
    expect(active(state)).toBe("c")
    state = ask(state, "c")
    expect(active(state)).toBe("a")
  })

  it("ignores actions from players whose turn it isn't", () => {
    const state = started(3)
    const next = gameReducer(state, {
      type: "askQuestion",
      by: "b",
      question: "?",
    })
    expect(next).toBe(state)
  })

  it("keeps the turn after a question when passAfterQuestion is off", () => {
    let state = apply(
      lobby(3),
      {
        type: "updateSettings",
        by: "a",
        settings: { passAfterQuestion: false },
      },
      { type: "startRound", by: "a", seed: 42 },
    )
    state = ask(state, "a")
    expect(active(state)).toBe("a")
    expect(state.round!.turn!.stage.kind).toBe("choosing")
  })

  it("passes the turn after a wrong guess", () => {
    const state = guessAndVote(started(3), "a", { b: "notYet", c: "notYet" })
    expect(active(state)).toBe("b")
    expect(state.round!.solved).toEqual([])
    expect(state.round!.lastResult).toMatchObject({
      guesserId: "a",
      correct: false,
    })
  })

  it("skips solved players", () => {
    let state = guessAndVote(started(3), "a", { b: "correct", c: "correct" })
    expect(state.round!.solved).toEqual(["a"])
    expect(active(state)).toBe("b")
    state = ask(state, "b")
    expect(active(state)).toBe("c")
    state = ask(state, "c")
    expect(active(state)).toBe("b") // a is skipped
  })

  it("rotates the first player each round", () => {
    let state = started(3)
    state = apply(
      state,
      { type: "endRound", by: "a" },
      { type: "nextRound", by: "a", seed: 7 },
    )
    expect(active(state)).toBe("b")
  })
})

describe("guess confirmation", () => {
  it("does not resolve until every eligible voter has voted", () => {
    const state = guessAndVote(started(4), "a", { b: "correct", c: "correct" })
    expect(state.round!.turn!.stage.kind).toBe("voting")
    expect(state.round!.solved).toEqual([])
  })

  it("confirms on a majority of correct votes", () => {
    const state = guessAndVote(started(4), "a", {
      b: "correct",
      c: "correct",
      d: "notYet",
    })
    expect(state.round!.solved).toEqual(["a"])
  })

  it("treats a tie as not yet", () => {
    const state = guessAndVote(started(3), "a", { b: "correct", c: "notYet" })
    expect(state.round!.solved).toEqual([])
    expect(state.round!.lastResult).toMatchObject({
      kind: "guess",
      correct: false,
    })
  })

  it("does not let the guesser vote", () => {
    let state = gameReducer(started(3), {
      type: "makeGuess",
      by: "a",
      text: "x",
    })
    const before = state
    state = gameReducer(state, { type: "castVote", by: "a", vote: "correct" })
    expect(state).toBe(before)
  })

  it("counts solved players as voters", () => {
    // a solves first.
    let state = guessAndVote(started(3), "a", { b: "correct", c: "correct" })
    expect(active(state)).toBe("b")
    // b guesses: voters are a (solved) and c. One vote is not enough.
    state = guessAndVote(state, "b", { c: "correct" })
    expect(state.round!.turn!.stage.kind).toBe("voting")
    state = gameReducer(state, { type: "castVote", by: "a", vote: "correct" })
    expect(state.round!.solved).toEqual(["a", "b"])
  })

  it("lets a solved player's vote break the tie", () => {
    let state = guessAndVote(started(4), "a", {
      b: "correct",
      c: "correct",
      d: "correct",
    })
    // b guesses; voters a (solved), c, d.
    state = guessAndVote(state, "b", { c: "correct", d: "notYet", a: "notYet" })
    expect(state.round!.solved).toEqual(["a"])
  })

  it("ignores empty guesses", () => {
    const state = started(3)
    expect(gameReducer(state, { type: "makeGuess", by: "a", text: "  " })).toBe(
      state,
    )
  })
})

describe("round end", () => {
  it("ends when every player is solved", () => {
    let state = guessAndVote(started(2), "a", { b: "correct" })
    expect(state.phase).toBe("playing")
    state = guessAndVote(state, "b", { a: "correct" })
    expect(state.phase).toBe("roundEnd")
    expect(state.round!.endedEarly).toBe(false)
    expect(state.round!.turn).toBeNull()
  })

  it("lets the host end the round early", () => {
    const state = apply(started(3), { type: "endRound", by: "a" })
    expect(state.phase).toBe("roundEnd")
    expect(state.round!.endedEarly).toBe(true)
  })

  it("does not let a non-host end the round", () => {
    const state = started(3)
    expect(gameReducer(state, { type: "endRound", by: "b" })).toBe(state)
  })

  it("returns to the lobby", () => {
    const state = apply(
      started(3),
      { type: "endRound", by: "a" },
      { type: "backToLobby", by: "a" },
    )
    expect(state.phase).toBe("lobby")
    expect(state.round).toBeNull()
  })
})

describe("joining and leaving", () => {
  it("makes late joiners wait for the next round", () => {
    let state = gameReducer(started(3), {
      type: "join",
      player: makePlayer("z", 10),
    })
    expect(state.players.map((p) => p.id)).toContain("z")
    expect(state.round!.turnOrder).not.toContain("z")
    expect(state.round!.assignments.z).toBeUndefined()
    state = apply(
      state,
      { type: "endRound", by: "a" },
      { type: "nextRound", by: "a", seed: 3 },
    )
    expect(state.round!.turnOrder).toContain("z")
    expect(state.round!.assignments.z).toBeDefined()
  })

  it("removes a leaver's card and passes their turn", () => {
    const state = gameReducer(started(3), { type: "leave", playerId: "a" })
    expect(state.round!.assignments.a).toBeUndefined()
    expect(state.round!.turnOrder).toEqual(["b", "c"])
    expect(active(state)).toBe("b")
  })

  it("passes the turn correctly when the last player in order leaves on their turn", () => {
    let state = ask(ask(started(3), "a"), "b")
    expect(active(state)).toBe("c")
    state = gameReducer(state, { type: "leave", playerId: "c" })
    expect(active(state)).toBe("a")
  })

  it("migrates host to the oldest remaining player", () => {
    const state = gameReducer(lobby(3), { type: "leave", playerId: "a" })
    expect(state.hostId).toBe("b")
  })

  it("resolves a pending vote when the last missing voter leaves", () => {
    let state = guessAndVote(started(4), "a", { b: "correct", c: "correct" })
    state = gameReducer(state, { type: "leave", playerId: "d" })
    expect(state.round!.solved).toEqual(["a"])
  })

  it("drops the leaver's vote", () => {
    let state = guessAndVote(started(4), "a", { b: "correct" })
    state = gameReducer(state, { type: "leave", playerId: "b" })
    const stage = state.round!.turn!.stage
    expect(stage.kind === "voting" && stage.guess.votes).toEqual({})
  })

  it("ends the round when fewer than 2 players remain", () => {
    const state = gameReducer(started(2), { type: "leave", playerId: "b" })
    expect(state.phase).toBe("roundEnd")
  })
})

describe("typed questions", () => {
  function asked(count: number) {
    return gameReducer(started(count), {
      type: "askQuestion",
      by: "a",
      question: "Am I an animal?",
    })
  }

  it("is the default question mode", () => {
    expect(lobby(2).settings.questionMode).toBe("type")
  })

  it("requires question text", () => {
    const state = started(3)
    expect(
      gameReducer(state, { type: "askQuestion", by: "a", question: " " }),
    ).toBe(state)
  })

  it("waits for everyone but the asker to answer", () => {
    const state = apply(asked(4), {
      type: "answerQuestion",
      by: "b",
      answer: "yes",
    })
    expect(state.round!.turn!.stage.kind).toBe("asking")
    expect(active(state)).toBe("a")
  })

  it("answers by majority and passes the turn", () => {
    const state = ask(started(4), "a", { b: "yes", c: "yes", d: "no" })
    expect(state.round!.lastResult).toEqual({
      kind: "question",
      askerId: "a",
      question: "Am I alive?",
      outcome: "yes",
      yes: 2,
      no: 1,
    })
    expect(active(state)).toBe("b")
  })

  it("answers no by majority", () => {
    const state = ask(started(4), "a", { b: "no", c: "no", d: "yes" })
    expect(state.round!.lastResult).toMatchObject({ outcome: "no" })
  })

  it("is unsure on a tie", () => {
    const state = ask(started(3), "a", { b: "yes", c: "no" })
    expect(state.round!.lastResult).toMatchObject({
      outcome: "unsure",
      yes: 1,
      no: 1,
    })
  })

  it("does not let the asker answer", () => {
    const state = asked(3)
    expect(
      gameReducer(state, { type: "answerQuestion", by: "a", answer: "yes" }),
    ).toBe(state)
  })

  it("counts solved players as answerers", () => {
    // a solves, then b asks: a and c must both answer.
    let state = guessAndVote(started(3), "a", { b: "correct", c: "correct" })
    state = apply(
      state,
      { type: "askQuestion", by: "b", question: "Am I big?" },
      { type: "answerQuestion", by: "c", answer: "no" },
    )
    expect(state.round!.turn!.stage.kind).toBe("asking")
    state = gameReducer(state, {
      type: "answerQuestion",
      by: "a",
      answer: "no",
    })
    expect(state.round!.lastResult).toMatchObject({ outcome: "no" })
    expect(active(state)).toBe("c")
  })

  it("lets players change their answer until everyone is in", () => {
    const state = apply(
      asked(4),
      { type: "answerQuestion", by: "b", answer: "yes" },
      { type: "answerQuestion", by: "b", answer: "no" },
    )
    const stage = state.round!.turn!.stage
    expect(stage.kind === "asking" && stage.answers).toEqual({ b: "no" })
  })

  it("resolves when the last missing answerer leaves", () => {
    let state = apply(
      asked(4),
      { type: "answerQuestion", by: "b", answer: "yes" },
      { type: "answerQuestion", by: "c", answer: "yes" },
    )
    state = gameReducer(state, { type: "leave", playerId: "d" })
    expect(state.round!.lastResult).toMatchObject({ outcome: "yes", yes: 2 })
    expect(active(state)).toBe("b")
  })

  it("ignores the voice-mode end-question action", () => {
    const state = asked(3)
    expect(gameReducer(state, { type: "questionAnswered", by: "a" })).toBe(
      state,
    )
  })
})

describe("voice questions", () => {
  function voiceStarted(count: number) {
    return gameReducer(voiceLobby(count), {
      type: "startRound",
      by: "a",
      seed: 42,
    })
  }

  it("allows asking without text", () => {
    const state = gameReducer(voiceStarted(3), {
      type: "askQuestion",
      by: "a",
      question: "",
    })
    expect(state.round!.turn!.stage.kind).toBe("asking")
  })

  it("passes the turn when the asker ends it, with no group vote", () => {
    const state = ask(voiceStarted(3), "a")
    expect(active(state)).toBe("b")
    expect(state.round!.lastResult).toBeNull()
  })

  it("ignores Yes / No answers", () => {
    const state = gameReducer(voiceStarted(3), {
      type: "askQuestion",
      by: "a",
      question: "",
    })
    expect(
      gameReducer(state, { type: "answerQuestion", by: "b", answer: "yes" }),
    ).toBe(state)
  })
})
