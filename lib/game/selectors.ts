import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type GameState,
  type PendingGuess,
  type Player,
  type PlayerId,
  type RoundState,
} from "./types"

export type StartBlocker =
  "noCategory" | "notEnoughPlayers" | "tooManyPlayers" | "notEnoughCards"

/** Why the host can't start a round right now, or null if they can. */
export function getStartBlocker(state: GameState): StartBlocker | null {
  const count = state.players.length
  if (!state.category) return "noCategory"
  if (count < MIN_PLAYERS) return "notEnoughPlayers"
  if (count > MAX_PLAYERS) return "tooManyPlayers"
  if (state.category.cards.length < count) return "notEnoughCards"
  return null
}

export function isRoomFull(state: GameState): boolean {
  return state.players.length >= MAX_PLAYERS
}

/** Oldest remaining player by join time (join order breaks ties). */
export function getOldestPlayer(players: Player[]): Player | null {
  let oldest: Player | null = null
  for (const p of players) {
    if (!oldest || p.joinedAt < oldest.joinedAt) oldest = p
  }
  return oldest
}

export function isInRound(state: GameState, playerId: PlayerId): boolean {
  return !!state.round && state.round.turnOrder.includes(playerId)
}

export function isSolved(state: GameState, playerId: PlayerId): boolean {
  return !!state.round && state.round.solved.includes(playerId)
}

/** Everyone in the round except the guesser, including solved players. */
export function getEligibleVoters(
  round: RoundState,
  guess: PendingGuess,
): PlayerId[] {
  return round.turnOrder.filter((id) => id !== guess.guesserId)
}

export interface VoteTally {
  correct: number
  notYet: number
  missing: number
  eligible: number
}

export function tallyVotes(round: RoundState, guess: PendingGuess): VoteTally {
  const eligible = getEligibleVoters(round, guess)
  let correct = 0
  let notYet = 0
  for (const id of eligible) {
    const v = guess.votes[id]
    if (v === "correct") correct++
    else if (v === "notYet") notYet++
  }
  return {
    correct,
    notYet,
    missing: eligible.length - correct - notYet,
    eligible: eligible.length,
  }
}

/** Strict majority of cast votes; ties count as "not yet". */
export function isGuessConfirmed(tally: VoteTally): boolean {
  return tally.correct > tally.notYet
}

/**
 * First unsolved player in turn order, starting at `startIndex` and wrapping.
 * Returns null if everyone is solved.
 */
export function findNextUnsolved(
  round: RoundState,
  startIndex: number,
): PlayerId | null {
  const order = round.turnOrder
  for (let i = 0; i < order.length; i++) {
    const id = order[(startIndex + i) % order.length]
    if (!round.solved.includes(id)) return id
  }
  return null
}
