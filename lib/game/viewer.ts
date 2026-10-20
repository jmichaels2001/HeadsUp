import { getStartBlocker, tallyVotes, type StartBlocker } from "./selectors"
import type {
  Card,
  GamePhase,
  GameState,
  GameSettings,
  MediaState,
  PlayerId,
  Vote,
} from "./types"

export type ViewerPlayerStatus = "playing" | "solved" | "waiting"

export interface ViewerPlayer {
  id: PlayerId
  name: string
  isHost: boolean
  isYou: boolean
  media: MediaState
  status: ViewerPlayerStatus
  isActive: boolean
  /**
   * The player's card as this viewer may see it. Null when the player has no
   * card (waiting) or when it's the viewer's own unrevealed card.
   */
  card: Card | null
  /** True only for the viewer's own card while it is still secret. */
  cardHidden: boolean
  /** During a vote: whether this player has voted (not how). */
  hasVoted: boolean
  isGuesser: boolean
}

export interface ViewerGuess {
  guesserId: PlayerId
  text: string
  votedCount: number
  eligibleCount: number
  /** The viewer's own vote, if any. */
  yourVote: Vote | null
  canVote: boolean
}

export type ViewerTurn =
  | { kind: "choosing"; activePlayerId: PlayerId }
  | { kind: "asking"; activePlayerId: PlayerId; question: string }
  | { kind: "voting"; activePlayerId: PlayerId; guess: ViewerGuess }

export interface ViewerRound {
  number: number
  turn: ViewerTurn | null
  solvedCount: number
  playerCount: number
  lastResult: { guesserId: PlayerId; text: string; correct: boolean } | null
  endedEarly: boolean
}

export interface ViewerCategory {
  id: string
  name: string
  emoji: string
  cardCount: number
}

export interface ViewerState {
  roomCode: string
  phase: GamePhase
  viewerId: PlayerId
  /** Null if the viewer isn't in the room. */
  you: ViewerPlayer | null
  isHost: boolean
  players: ViewerPlayer[]
  category: ViewerCategory | null
  settings: GameSettings
  startBlocker: StartBlocker | null
  round: ViewerRound | null
}

/**
 * Per-viewer projection of the game. The viewer's own unrevealed card is
 * never included: not its id, not its label. Components consume only this.
 */
export function getViewerState(
  state: GameState,
  viewerId: PlayerId,
): ViewerState {
  const round = state.round
  const turn = round?.turn ?? null
  const voting = turn?.stage.kind === "voting" ? turn.stage.guess : null
  const allRevealed = state.phase === "roundEnd"

  const players: ViewerPlayer[] = state.players.map((p) => {
    const inRound =
      !!round && state.phase !== "lobby" && p.id in round.assignments
    const solved = !!round?.solved.includes(p.id)
    const isYou = p.id === viewerId
    const visible = !isYou || solved || allRevealed
    const card = inRound && visible ? round!.assignments[p.id] : null
    return {
      id: p.id,
      name: p.name,
      isHost: p.id === state.hostId,
      isYou,
      media: p.media,
      status:
        !inRound && state.phase !== "lobby"
          ? "waiting"
          : solved
            ? "solved"
            : "playing",
      isActive: turn?.activePlayerId === p.id,
      card: card ? { ...card } : null,
      cardHidden: inRound && !visible,
      hasVoted: !!voting && p.id in voting.votes,
      isGuesser: voting?.guesserId === p.id,
    }
  })

  let viewerTurn: ViewerTurn | null = null
  if (round && turn) {
    const stage = turn.stage
    if (stage.kind === "voting") {
      const tally = tallyVotes(round, stage.guess)
      const canVote =
        round.turnOrder.includes(viewerId) && viewerId !== stage.guess.guesserId
      viewerTurn = {
        kind: "voting",
        activePlayerId: turn.activePlayerId,
        guess: {
          guesserId: stage.guess.guesserId,
          text: stage.guess.text,
          votedCount: tally.correct + tally.notYet,
          eligibleCount: tally.eligible,
          yourVote: stage.guess.votes[viewerId] ?? null,
          canVote,
        },
      }
    } else if (stage.kind === "asking") {
      viewerTurn = {
        kind: "asking",
        activePlayerId: turn.activePlayerId,
        question: stage.question,
      }
    } else {
      viewerTurn = { kind: "choosing", activePlayerId: turn.activePlayerId }
    }
  }

  const you = players.find((p) => p.isYou) ?? null

  return {
    roomCode: state.roomCode,
    phase: state.phase,
    viewerId,
    you,
    isHost: state.hostId === viewerId,
    players,
    category: state.category
      ? {
          id: state.category.id,
          name: state.category.name,
          emoji: state.category.emoji,
          cardCount: state.category.cards.length,
        }
      : null,
    settings: state.settings,
    startBlocker: getStartBlocker(state),
    round:
      round && state.phase !== "lobby"
        ? {
            number: round.number,
            turn: viewerTurn,
            solvedCount: round.solved.length,
            playerCount: round.turnOrder.length,
            lastResult: round.lastResult,
            endedEarly: round.endedEarly,
          }
        : null,
  }
}
