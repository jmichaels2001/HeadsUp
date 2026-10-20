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
}

export interface Card {
  id: CardId
  label: string
  emoji?: string
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

export interface PendingGuess {
  guesserId: PlayerId
  text: string
  votes: Record<PlayerId, Vote>
}

export type TurnStage =
  | { kind: "choosing" }
  | { kind: "asking"; question: string }
  | { kind: "voting"; guess: PendingGuess }

export interface TurnState {
  activePlayerId: PlayerId
  stage: TurnStage
}

export interface GuessResult {
  guesserId: PlayerId
  text: string
  correct: boolean
}

export interface RoundState {
  number: number
  /** Fixed turn order for this round (players dealt in at the start). */
  turnOrder: PlayerId[]
  /** Card dealt to each player in the round. Removed when a player leaves. */
  assignments: Record<PlayerId, Card>
  solved: PlayerId[]
  /** Null once the round has ended. */
  turn: TurnState | null
  lastResult: GuessResult | null
  endedEarly: boolean
}

export interface GameSettings {
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

export const DEFAULT_SETTINGS: GameSettings = { passAfterQuestion: true }
