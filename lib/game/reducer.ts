import { dealCards } from "./deal"
import {
  findNextUnsolved,
  getOldestPlayer,
  getQuestionOutcome,
  getStartBlocker,
  isGuessConfirmed,
  isRoomFull,
  tallyAnswers,
  tallyVotes,
} from "./selectors"
import {
  DEFAULT_SETTINGS,
  MIN_PLAYERS,
  type Answer,
  type Category,
  type GameSettings,
  type GameState,
  type MediaState,
  type Player,
  type PlayerId,
  type RoundState,
  type Vote,
} from "./types"

export type GameAction =
  | { type: "join"; player: Player }
  | { type: "leave"; playerId: PlayerId }
  | { type: "setMedia"; playerId: PlayerId; media: Partial<MediaState> }
  | { type: "selectCategory"; by: PlayerId; category: Category }
  | { type: "updateSettings"; by: PlayerId; settings: Partial<GameSettings> }
  | { type: "startRound"; by: PlayerId; seed: number }
  | { type: "askQuestion"; by: PlayerId; question: string }
  /** Type mode: a player answers the pending question. */
  | { type: "answerQuestion"; by: PlayerId; answer: Answer }
  /** Voice mode: the player asked out loud and ends their turn. */
  | { type: "questionAnswered"; by: PlayerId }
  /** Text is required in type mode; voice-mode guesses are made out loud. */
  | { type: "makeGuess"; by: PlayerId; text: string }
  | { type: "castVote"; by: PlayerId; vote: Vote }
  | { type: "endRound"; by: PlayerId }
  | { type: "nextRound"; by: PlayerId; seed: number }
  | { type: "backToLobby"; by: PlayerId }

export function createRoom(
  roomCode: string,
  host: Player,
  category: Category | null = null,
): GameState {
  return {
    roomCode,
    players: [host],
    hostId: host.id,
    phase: "lobby",
    category,
    settings: DEFAULT_SETTINGS,
    roundsPlayed: 0,
    round: null,
  }
}

/**
 * Pure game reducer. Invalid actions (wrong player, wrong phase, etc.)
 * return the state unchanged.
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "join":
      return join(state, action.player)
    case "leave":
      return leave(state, action.playerId)
    case "setMedia":
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId
            ? { ...p, media: { ...p.media, ...action.media } }
            : p,
        ),
      }
    case "selectCategory":
      if (!isHost(state, action.by) || state.phase !== "lobby") return state
      return { ...state, category: action.category }
    case "updateSettings":
      if (!isHost(state, action.by) || state.phase !== "lobby") return state
      return { ...state, settings: { ...state.settings, ...action.settings } }
    case "startRound":
      if (!isHost(state, action.by) || state.phase !== "lobby") return state
      return dealRound(state, action.seed)
    case "nextRound":
      if (!isHost(state, action.by) || state.phase !== "roundEnd") return state
      return dealRound(state, action.seed)
    case "askQuestion": {
      // Type mode only: in voice mode questions are asked out loud and the
      // player ends their turn with questionAnswered.
      if (state.settings.questionMode !== "type") return state
      const question = action.question.trim()
      if (!question) return state
      return withTurn(state, action.by, (round) => ({
        ...round,
        turn: {
          activePlayerId: action.by,
          stage: { kind: "asking", question, answers: {} },
        },
        lastResult: null,
      }))
    }
    case "answerQuestion":
      return answerQuestion(state, action.by, action.answer)
    case "questionAnswered":
      if (state.settings.questionMode !== "voice") return state
      return withTurn(state, action.by, (round) =>
        afterQuestion(state, round, action.by),
      )
    case "makeGuess": {
      const text = action.text.trim()
      if (state.settings.questionMode === "type" && !text) return state
      return withTurn(state, action.by, (round) => ({
        ...round,
        turn: {
          activePlayerId: action.by,
          stage: {
            kind: "voting",
            guess: { guesserId: action.by, text, votes: {} },
          },
        },
        lastResult: null,
      }))
    }
    case "castVote":
      return castVote(state, action.by, action.vote)
    case "endRound":
      if (!isHost(state, action.by) || state.phase !== "playing") return state
      return finishRound(state, true)
    case "backToLobby":
      if (!isHost(state, action.by) || state.phase !== "roundEnd") return state
      return { ...state, phase: "lobby", round: null }
  }
}

function isHost(state: GameState, playerId: PlayerId): boolean {
  return state.hostId === playerId
}

function join(state: GameState, player: Player): GameState {
  if (isRoomFull(state)) return state
  if (state.players.some((p) => p.id === player.id)) return state
  // Late joiners are added to the room but not to the round's turn order,
  // so they wait for the next round.
  return {
    ...state,
    players: [...state.players, player],
    hostId: state.hostId ?? player.id,
  }
}

function leave(state: GameState, playerId: PlayerId): GameState {
  if (!state.players.some((p) => p.id === playerId)) return state
  const players = state.players.filter((p) => p.id !== playerId)
  const hostId =
    state.hostId === playerId
      ? (getOldestPlayer(players)?.id ?? null)
      : state.hostId
  let next: GameState = { ...state, players, hostId }

  const round = state.round
  if (!round || !round.turnOrder.includes(playerId)) return next

  // Remove the leaver and their card from play.
  const leaverIndex = round.turnOrder.indexOf(playerId)
  const turnOrder = round.turnOrder.filter((id) => id !== playerId)
  const assignments = { ...round.assignments }
  delete assignments[playerId]
  let nextRound: RoundState = {
    ...round,
    turnOrder,
    assignments,
    solved: round.solved.filter((id) => id !== playerId),
  }
  next = { ...next, round: nextRound }

  if (state.phase !== "playing" || !round.turn) return next

  if (turnOrder.length < MIN_PLAYERS) return finishRound(next, true)

  const turn = round.turn
  if (turn.activePlayerId === playerId) {
    // The player after the leaver now sits at the leaver's old index.
    const nextId = findNextUnsolved(nextRound, leaverIndex % turnOrder.length)
    if (!nextId) return finishRound(next, false)
    nextRound = {
      ...nextRound,
      turn: { activePlayerId: nextId, stage: { kind: "choosing" } },
    }
    return { ...next, round: nextRound }
  }

  if (turn.stage.kind === "voting") {
    const votes = { ...turn.stage.guess.votes }
    delete votes[playerId]
    nextRound = {
      ...nextRound,
      turn: {
        ...turn,
        stage: { kind: "voting", guess: { ...turn.stage.guess, votes } },
      },
    }
    next = { ...next, round: nextRound }
    return maybeResolveVote(next)
  }

  if (turn.stage.kind === "asking") {
    const answers = { ...turn.stage.answers }
    delete answers[playerId]
    nextRound = {
      ...nextRound,
      turn: { ...turn, stage: { ...turn.stage, answers } },
    }
    next = { ...next, round: nextRound }
    return maybeResolveQuestion(next)
  }

  return next
}

function dealRound(state: GameState, seed: number): GameState {
  if (getStartBlocker(state) !== null || !state.category) return state
  const turnOrder = state.players.map((p) => p.id)
  const assignments = dealCards(state.players, state.category.cards, seed)
  if (!assignments) return state
  // Rotate who goes first each round.
  const first = turnOrder[state.roundsPlayed % turnOrder.length]
  return {
    ...state,
    phase: "playing",
    roundsPlayed: state.roundsPlayed + 1,
    round: {
      number: state.roundsPlayed + 1,
      turnOrder,
      assignments,
      solved: [],
      turn: { activePlayerId: first, stage: { kind: "choosing" } },
      lastResult: null,
      endedEarly: false,
    },
  }
}

/** Apply `update` only if it's `playerId`'s turn and they're choosing. */
function withTurn(
  state: GameState,
  playerId: PlayerId,
  update: (round: RoundState) => RoundState,
): GameState {
  const round = state.round
  if (state.phase !== "playing" || !round?.turn) return state
  if (round.turn.activePlayerId !== playerId) return state
  if (round.turn.stage.kind !== "choosing") return state
  const nextRound = update(round)
  if (!nextRound.turn) return finishRound({ ...state, round: nextRound }, false)
  return { ...state, round: nextRound }
}

/** Pass the turn to the next unsolved player after `fromId`. */
function advanceTurn(round: RoundState, fromId: PlayerId): RoundState {
  const index = round.turnOrder.indexOf(fromId)
  const nextId = findNextUnsolved(round, index + 1)
  return {
    ...round,
    turn: nextId
      ? { activePlayerId: nextId, stage: { kind: "choosing" } }
      : null,
  }
}

/** After a question: pass the turn, or keep it if the house rule says so. */
function afterQuestion(
  state: GameState,
  round: RoundState,
  askerId: PlayerId,
): RoundState {
  return state.settings.passAfterQuestion
    ? advanceTurn(round, askerId)
    : {
        ...round,
        turn: { activePlayerId: askerId, stage: { kind: "choosing" } },
      }
}

function answerQuestion(
  state: GameState,
  playerId: PlayerId,
  answer: Answer,
): GameState {
  const round = state.round
  if (state.phase !== "playing" || !round?.turn) return state
  if (state.settings.questionMode !== "type") return state
  const stage = round.turn.stage
  if (stage.kind !== "asking") return state
  if (playerId === round.turn.activePlayerId) return state
  if (!round.turnOrder.includes(playerId)) return state

  const next: GameState = {
    ...state,
    round: {
      ...round,
      turn: {
        ...round.turn,
        stage: { ...stage, answers: { ...stage.answers, [playerId]: answer } },
      },
    },
  }
  return maybeResolveQuestion(next)
}

/** Once everyone but the asker has answered, record the result and move on. */
function maybeResolveQuestion(state: GameState): GameState {
  const round = state.round
  if (state.settings.questionMode !== "type") return state
  if (!round?.turn || round.turn.stage.kind !== "asking") return state
  const askerId = round.turn.activePlayerId
  const { question, answers } = round.turn.stage
  const tally = tallyAnswers(round, askerId, answers)
  if (tally.missing > 0) return state

  const resolved = afterQuestion(
    state,
    {
      ...round,
      lastResult: {
        kind: "question",
        askerId,
        question,
        outcome: getQuestionOutcome(tally),
        yes: tally.yes,
        no: tally.no,
      },
    },
    askerId,
  )
  const next = { ...state, round: resolved }
  return resolved.turn ? next : finishRound(next, false)
}

function castVote(state: GameState, voterId: PlayerId, vote: Vote): GameState {
  const round = state.round
  if (state.phase !== "playing" || !round?.turn) return state
  const stage = round.turn.stage
  if (stage.kind !== "voting") return state
  if (voterId === stage.guess.guesserId) return state
  if (!round.turnOrder.includes(voterId)) return state

  const next: GameState = {
    ...state,
    round: {
      ...round,
      turn: {
        ...round.turn,
        stage: {
          kind: "voting",
          guess: {
            ...stage.guess,
            votes: { ...stage.guess.votes, [voterId]: vote },
          },
        },
      },
    },
  }
  return maybeResolveVote(next)
}

/** Once every eligible voter has voted, apply the majority result. */
function maybeResolveVote(state: GameState): GameState {
  const round = state.round
  if (!round?.turn || round.turn.stage.kind !== "voting") return state
  const guess = round.turn.stage.guess
  const tally = tallyVotes(round, guess)
  if (tally.missing > 0) return state

  const correct = isGuessConfirmed(tally)
  const solved = correct ? [...round.solved, guess.guesserId] : round.solved
  const resolved = advanceTurn(
    {
      ...round,
      solved,
      lastResult: {
        kind: "guess",
        guesserId: guess.guesserId,
        text: guess.text,
        correct,
      },
    },
    guess.guesserId,
  )
  const next = { ...state, round: resolved }
  return resolved.turn ? next : finishRound(next, false)
}

function finishRound(state: GameState, endedEarly: boolean): GameState {
  if (!state.round) return state
  return {
    ...state,
    phase: "roundEnd",
    round: { ...state.round, turn: null, endedEarly },
  }
}
