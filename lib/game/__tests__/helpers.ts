import { createRoom, gameReducer, type GameAction } from "../reducer"
import type { Category, GameState, Player } from "../types"

export function makePlayer(id: string, joinedAt = 0): Player {
  return {
    id,
    name: id.toUpperCase(),
    joinedAt,
    media: { mic: true, camera: true, connection: "good" },
  }
}

export function makeCategory(size: number): Category {
  return {
    id: "test",
    name: "Test deck",
    description: "",
    emoji: "🧪",
    visibility: "private",
    builtIn: true,
    cards: Array.from({ length: size }, (_, i) => ({
      id: `card-${i}`,
      label: `Secret Thing ${i}`,
    })),
  }
}

export function apply(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce(gameReducer, state)
}

/** Room with players a, b, c, ... (a is host) in the lobby. */
export function lobby(count: number, deckSize = 12): GameState {
  const ids = "abcdefgh".slice(0, count).split("")
  let state = createRoom("ROOM", makePlayer(ids[0], 0), makeCategory(deckSize))
  ids.slice(1).forEach((id, i) => {
    state = gameReducer(state, { type: "join", player: makePlayer(id, i + 1) })
  })
  return state
}

/** Round in progress; `a` goes first. */
export function started(count: number): GameState {
  return apply(lobby(count), { type: "startRound", by: "a", seed: 42 })
}

export function active(state: GameState): string | undefined {
  return state.round?.turn?.activePlayerId
}

/** Have `guesser` guess and every listed voter vote. */
export function guessAndVote(
  state: GameState,
  guesser: string,
  votes: Record<string, "correct" | "notYet">,
): GameState {
  let next = gameReducer(state, {
    type: "makeGuess",
    by: guesser,
    text: "a guess",
  })
  for (const [by, vote] of Object.entries(votes)) {
    next = gameReducer(next, { type: "castVote", by, vote })
  }
  return next
}

/** Room in the lobby with voice-mode questions. */
export function voiceLobby(count: number): GameState {
  return gameReducer(lobby(count), {
    type: "updateSettings",
    by: "a",
    settings: { questionMode: "voice" },
  })
}

/** `by` asks a question; in type mode everyone else answers it (default "yes"). */
export function ask(
  state: GameState,
  by: string,
  answers: Record<string, "yes" | "no"> = {},
): GameState {
  let next = gameReducer(state, {
    type: "askQuestion",
    by,
    question: "Am I alive?",
  })
  if (state.settings.questionMode === "voice") {
    return gameReducer(next, { type: "questionAnswered", by })
  }
  for (const id of next.round!.turnOrder) {
    if (id === by) continue
    next = gameReducer(next, {
      type: "answerQuestion",
      by: id,
      answer: answers[id] ?? "yes",
    })
  }
  return next
}
