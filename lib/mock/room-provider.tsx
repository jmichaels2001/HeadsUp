"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  createRoom,
  gameReducer,
  getEligibleVoters,
  getViewerState,
  isRoomFull,
  MAX_PLAYERS,
  type GameAction,
  type GameSettings,
  type GameState,
  type MediaState,
  type PlayerId,
  type ViewerState,
  type Vote,
} from "@/lib/game"

import { BUILT_IN_DECKS, findDeck } from "./decks"
import {
  makeMockPlayer,
  MOCK_NAMES,
  mockMediaFor,
  randomSeed,
  type VideoOrientation,
} from "./players"

/**
 * Phase 1 stand-in for the realtime room. Raw GameState lives only here;
 * components get the per-viewer projection via `useRoom().view`.
 */

export type DevOverlay = "none" | "loading" | "error" | "reconnecting"

export type JoinResult = "ok" | "full"

interface Stored {
  game: GameState | null
  viewerId: PlayerId | null
  orientations: Record<PlayerId, VideoOrientation>
}

const STORAGE_KEY = "headbands:mock-room"
const EMPTY: Stored = { game: null, viewerId: null, orientations: {} }

export interface RoomContextValue {
  /** False until stored state has been read on the client. */
  ready: boolean
  view: ViewerState | null
  overlay: DevOverlay
  videoOrientation: (playerId: PlayerId) => VideoOrientation
  session: {
    createRoom: (code: string, name: string, media: MediaState) => void
    joinRoom: (code: string, name: string, media: MediaState) => JoinResult
    leaveRoom: () => void
  }
  actions: {
    selectCategory: (categoryId: string) => void
    updateSettings: (settings: Partial<GameSettings>) => void
    startRound: () => void
    askQuestion: (question: string) => void
    questionAnswered: () => void
    makeGuess: (text: string) => void
    castVote: (vote: Vote) => void
    endRound: () => void
    nextRound: () => void
    backToLobby: () => void
    setMedia: (media: Partial<MediaState>) => void
  }
  dev: {
    setViewer: (playerId: PlayerId) => void
    loadScenario: (playerCount: number, phase: "lobby" | "playing") => void
    addMockPlayer: () => void
    removePlayer: (playerId: PlayerId) => void
    fillVotes: (vote: Vote) => void
    setOverlay: (overlay: DevOverlay) => void
    toggleOrientation: (playerId: PlayerId) => void
    reset: () => void
  }
}

const RoomContext = createContext<RoomContextValue | null>(null)

function loadStored(): Stored {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Stored) } : EMPTY
  } catch {
    return EMPTY
  }
}

function saveStored(stored: Stored) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // Storage may be unavailable (private mode); the mock still works in memory.
  }
}

function defaultOrientation(index: number): VideoOrientation {
  return index % 3 === 2 ? "portrait" : "landscape"
}

export function MockRoomProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Stored>(EMPTY)
  const [ready, setReady] = useState(false)
  const [overlay, setOverlay] = useState<DevOverlay>("none")

  useEffect(() => {
    // Read sessionStorage after mount so server and client render the same.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStored(loadStored())
    setReady(true)
  }, [])

  useEffect(() => {
    if (ready) saveStored(stored)
  }, [ready, stored])

  const { game, viewerId } = stored

  const dispatch = useCallback((action: GameAction) => {
    setStored((s) => (s.game ? { ...s, game: gameReducer(s.game, action) } : s))
  }, [])

  const withOrientations = useCallback((s: Stored, game: GameState): Stored => {
    const orientations = { ...s.orientations }
    game.players.forEach((p, i) => {
      orientations[p.id] ??= defaultOrientation(i)
    })
    return { ...s, game, orientations }
  }, [])

  const value = useMemo<RoomContextValue>(() => {
    const by = viewerId ?? ""
    const view = game && viewerId ? getViewerState(game, viewerId) : null

    return {
      ready,
      view,
      overlay,
      videoOrientation: (id) => stored.orientations[id] ?? "landscape",
      session: {
        createRoom: (code, name, media) => {
          const you = { ...makeMockPlayer(name, Date.now()), media }
          const room = createRoom(code, you, BUILT_IN_DECKS[0])
          setStored((s) => ({
            ...withOrientations(s, room),
            viewerId: you.id,
          }))
        },
        joinRoom: (code, name, media) => {
          // In the mock, any unknown code opens a demo room with friends.
          let room =
            game && game.roomCode === code ? game : seedDemoRoom(code, 3)
          if (isRoomFull(room)) return "full"
          const you = { ...makeMockPlayer(name, Date.now()), media }
          room = gameReducer(room, { type: "join", player: you })
          setStored((s) => ({
            ...withOrientations(s, room),
            viewerId: you.id,
          }))
          return "ok"
        },
        leaveRoom: () => {
          setStored((s) =>
            s.game && s.viewerId
              ? {
                  ...s,
                  game: gameReducer(s.game, {
                    type: "leave",
                    playerId: s.viewerId,
                  }),
                  viewerId: null,
                }
              : s,
          )
        },
      },
      actions: {
        selectCategory: (categoryId) => {
          const category = findDeck(categoryId)
          if (category) dispatch({ type: "selectCategory", by, category })
        },
        updateSettings: (settings) =>
          dispatch({ type: "updateSettings", by, settings }),
        startRound: () =>
          dispatch({ type: "startRound", by, seed: randomSeed() }),
        askQuestion: (question) =>
          dispatch({ type: "askQuestion", by, question }),
        questionAnswered: () => dispatch({ type: "questionAnswered", by }),
        makeGuess: (text) => dispatch({ type: "makeGuess", by, text }),
        castVote: (vote) => dispatch({ type: "castVote", by, vote }),
        endRound: () => dispatch({ type: "endRound", by }),
        nextRound: () =>
          dispatch({ type: "nextRound", by, seed: randomSeed() }),
        backToLobby: () => dispatch({ type: "backToLobby", by }),
        setMedia: (media) =>
          dispatch({ type: "setMedia", playerId: by, media }),
      },
      dev: {
        setViewer: (id) => setStored((s) => ({ ...s, viewerId: id })),
        loadScenario: (count, phase) => {
          let room = seedDemoRoom(game?.roomCode ?? "DEMO1", count)
          if (phase === "playing") {
            room = gameReducer(room, {
              type: "startRound",
              by: room.hostId!,
              seed: randomSeed(),
            })
          }
          setStored(() => ({
            ...withOrientations(EMPTY, room),
            viewerId: room.players[0].id,
          }))
        },
        addMockPlayer: () => {
          if (!game || game.players.length >= MAX_PLAYERS) return
          const used = new Set(game.players.map((p) => p.name))
          const name =
            MOCK_NAMES.find((n) => !used.has(n)) ??
            `Guest ${game.players.length + 1}`
          const player = makeMockPlayer(
            name,
            Date.now(),
            mockMediaFor(game.players.length),
          )
          setStored((s) =>
            s.game
              ? withOrientations(
                  s,
                  gameReducer(s.game, { type: "join", player }),
                )
              : s,
          )
        },
        removePlayer: (playerId) => {
          setStored((s) => {
            if (!s.game) return s
            const next = gameReducer(s.game, { type: "leave", playerId })
            const viewerGone = s.viewerId === playerId
            return {
              ...s,
              game: next,
              viewerId: viewerGone ? (next.players[0]?.id ?? null) : s.viewerId,
            }
          })
        },
        fillVotes: (vote) => {
          setStored((s) => {
            const round = s.game?.round
            const stage = round?.turn?.stage
            if (!s.game || !round || stage?.kind !== "voting") return s
            // Everyone except the current viewer, so they can cast the last vote.
            const voters = getEligibleVoters(round, stage.guess).filter(
              (id) =>
                !(id in stage.guess.votes) &&
                (id !== s.viewerId || stage.guess.guesserId === s.viewerId),
            )
            const game = voters.reduce(
              (g, id) => gameReducer(g, { type: "castVote", by: id, vote }),
              s.game,
            )
            return { ...s, game }
          })
        },
        setOverlay,
        toggleOrientation: (id) =>
          setStored((s) => ({
            ...s,
            orientations: {
              ...s.orientations,
              [id]:
                s.orientations[id] === "portrait" ? "landscape" : "portrait",
            },
          })),
        reset: () => {
          setStored(EMPTY)
          setOverlay("none")
        },
      },
    }
  }, [
    game,
    viewerId,
    ready,
    overlay,
    stored.orientations,
    dispatch,
    withOrientations,
  ])

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
}

/** Mock room with `count` friends; the first one hosts. */
function seedDemoRoom(code: string, count: number): GameState {
  const now = Date.now() - 60_000
  const players = MOCK_NAMES.slice(0, Math.min(count, MAX_PLAYERS)).map(
    (name, i) => makeMockPlayer(name, now + i, mockMediaFor(i)),
  )
  let room = createRoom(code, players[0], BUILT_IN_DECKS[0])
  for (const player of players.slice(1)) {
    room = gameReducer(room, { type: "join", player })
  }
  return room
}

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext)
  if (!ctx) throw new Error("useRoom must be used inside MockRoomProvider")
  return ctx
}
