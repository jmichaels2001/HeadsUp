// Core game types. Pure data, no React or SDK imports.

export type PlayerId = string
export type CardId = string

export const MAX_PLAYERS = 8
export const MIN_PLAYERS = 2

export type ConnectionStatus = "good" | "poor" | "reconnecting" | "offline"

export interface MediaState {
  mic: boolean
  camera: boolean
  connection: ConnectionStatus
}

export interface Player {
  id: PlayerId
  name: string
  /** Join timestamp; the oldest remaining player becomes host. */
  joinedAt: number
  media: MediaState
  /** This player's browser, to keep them from being dealt their own cards. */
  deviceId?: string
}

export interface Card {
  id: CardId
  label: string
  /** Built-in decks use emojis; custom cards use images. */
  emoji?: string
  imageUrl?: string
  /**
   * Device ids of the browsers that added a custom card (more than one when
   * duplicates were merged). Nobody is dealt a card they created.
   */
  creators?: string[]
}

export type CategoryVisibility = "private" | "room" | "public"

export type CollaboratorRole = "owner" | "editor" | "viewer"

/** Types only for now: collaborative/public categories arrive in Phase 4. */
export interface Collaborator {
  userId: string
  role: CollaboratorRole
}

export interface Category {
  id: string
  name: string
  description: string
  emoji: string
  cards: Card[]
  visibility: CategoryVisibility
  builtIn: boolean
  ownerId?: string
  collaborators?: Collaborator[]
}

export type Vote = "correct" | "notYet"

export type Answer = "yes" | "no"

/** Group answer to a typed question; a tie is "unsure". */
export type QuestionOutcome = "yes" | "no" | "unsure"

export interface PendingGuess {
  guesserId: PlayerId
  /** Empty for voice-mode guesses, which are made out loud. */
  text: string
  votes: Record<PlayerId, Vote>
}

export type TurnStage =
  | { kind: "choosing" }
  | {
      kind: "asking"
      question: string
      /** Type mode only: everyone but the asker answers yes/no. */
      answers: Record<PlayerId, Answer>
    }
  | { kind: "voting"; guess: PendingGuess }

export interface TurnState {
  activePlayerId: PlayerId
  stage: TurnStage
}

export interface GuessResult {
  kind: "guess"
  guesserId: PlayerId
  /** Empty for voice-mode guesses. */
  text: string
  correct: boolean
}

export interface QuestionResult {
  kind: "question"
  askerId: PlayerId
  question: string
  outcome: QuestionOutcome
  yes: number
  no: number
}

export type TurnResult = GuessResult | QuestionResult

export interface RoundState {
  number: number
  /** Fixed turn order for this round (players dealt in at the start). */
  turnOrder: PlayerId[]
  /** Card dealt to each player in the round. Removed when a player leaves. */
  assignments: Record<PlayerId, Card>
  solved: PlayerId[]
  /** Null once the round has ended. */
  turn: TurnState | null
  lastResult: TurnResult | null
  endedEarly: boolean
}

/**
 * "type": the asker types a question and everyone else answers Yes / No.
 * "voice": players ask and guess out loud (on the video call). The player
 * taps End turn after a question; a guess goes straight to the group vote.
 */
export type QuestionMode = "type" | "voice"

export interface GameSettings {
  questionMode: QuestionMode
  /**
   * If true (default), the turn passes once a question is answered.
   * If false, the asker keeps the turn and may ask again or guess.
   * A wrong guess always passes the turn.
   */
  passAfterQuestion: boolean
}

export type GamePhase = "lobby" | "playing" | "roundEnd"

export interface GameState {
  roomCode: string
  /** Everyone in the room, in join order. */
  players: Player[]
  hostId: PlayerId | null
  phase: GamePhase
  category: Category | null
  settings: GameSettings
  /** Number of rounds started so far. */
  roundsPlayed: number
  round: RoundState | null
}

export const DEFAULT_SETTINGS: GameSettings = {
  questionMode: "type",
  passAfterQuestion: true,
}
