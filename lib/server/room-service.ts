import { createHash, randomBytes } from "node:crypto"

import { AccessToken } from "livekit-server-sdk"

import { BUILT_IN_DECKS, findDeck } from "@/lib/decks"
import {
  createRoom,
  gameReducer,
  getViewerState,
  isRoomFull,
  type Category,
  type GameAction,
  type GameState,
  type Player,
  type PlayerId,
  type ViewerState,
} from "@/lib/game"
import type {
  ClientAction,
  JoinRequest,
  RoomErrorCode,
  RoomSnapshot,
  SeatResponse,
  VideoTokenResponse,
} from "@/lib/room/protocol"

import type { RoomStore } from "./store"

export class RoomError extends Error {
  constructor(
    readonly code: RoomErrorCode,
    message: string,
  ) {
    super(message)
  }

  get status(): number {
    switch (this.code) {
      case "notFound":
        return 404
      case "unauthorized":
        return 401
      case "invalid":
        return 400
      case "unavailable":
        return 503
      default:
        return 409
    }
  }
}

/** Players silent for longer than this are removed from the room. */
export const STALE_AFTER_MS = 120_000
/** Players silent for longer than this show as offline. */
export const OFFLINE_AFTER_MS = 40_000
const MAX_RETRIES = 5
/** Video tokens only need to outlast a session's reconnects. */
export const VIDEO_TOKEN_TTL = "6h"

/** LiveKit Cloud project credentials (server-side only). */
export interface VideoConfig {
  url: string
  apiKey: string
  apiSecret: string
}

export interface RoomServiceDeps {
  store: RoomStore
  /** Tell connected clients the room changed. Failures are ignored. */
  notify?: (code: string, version: number) => Promise<void>
  now?: () => number
  seed?: () => number
  token?: () => string
  roomCode?: () => string
  playerId?: () => string
  /** Omit to run without video; video tokens are then "unavailable". */
  video?: VideoConfig | null
  /** Custom decks by id (throws RoomError if it can't be used). */
  loadDeck?: (id: string) => Promise<Category>
  /** A round started with a custom deck (for play counts). Errors ignored. */
  onRoundStart?: (categoryId: string) => Promise<void>
}

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"

function defaultRoomCode(): string {
  const bytes = randomBytes(5)
  return Array.from(bytes, (b) => CODE_LETTERS[b % CODE_LETTERS.length]).join(
    "",
  )
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Server-side room logic: authenticates players by token, runs the pure game
 * reducer, saves with optimistic concurrency, and returns per-viewer state.
 */
export class RoomService {
  private store: RoomStore
  private notify: (code: string, version: number) => Promise<void>
  private now: () => number
  private seed: () => number
  private token: () => string
  private roomCode: () => string
  private playerId: () => string
  private video: VideoConfig | null
  private loadDeck: ((id: string) => Promise<Category>) | null
  private onRoundStart: (categoryId: string) => Promise<void>

  constructor(deps: RoomServiceDeps) {
    this.store = deps.store
    this.notify = deps.notify ?? (async () => {})
    this.now = deps.now ?? Date.now
    this.seed = deps.seed ?? (() => randomBytes(4).readUInt32BE() >>> 1)
    this.token = deps.token ?? (() => randomBytes(32).toString("base64url"))
    this.roomCode = deps.roomCode ?? defaultRoomCode
    this.playerId =
      deps.playerId ?? (() => `p_${randomBytes(6).toString("base64url")}`)
    this.video = deps.video ?? null
    this.loadDeck = deps.loadDeck ?? null
    this.onRoundStart = deps.onRoundStart ?? (async () => {})
  }

  async createRoom(input: JoinRequest): Promise<SeatResponse> {
    const player = this.newPlayer(input)
    for (let i = 0; i < 10; i++) {
      const code = this.roomCode()
      const state = createRoom(code, player, BUILT_IN_DECKS[0])
      if (await this.store.createRoom(code, state)) {
        return this.seat(code, player.id, state, 0)
      }
    }
    throw new RoomError("unavailable", "Couldn't find a free room code.")
  }

  async joinRoom(code: string, input: JoinRequest): Promise<SeatResponse> {
    const player = this.newPlayer(input)
    const result = await this.mutate(code, (state) => {
      if (isRoomFull(state)) throw new RoomError("full", "This room is full.")
      return gameReducer(state, { type: "join", player })
    })
    return this.seat(code, player.id, result.state, result.version)
  }

  async getRoom(code: string, token: string): Promise<RoomSnapshot> {
    const playerId = await this.authenticate(code, token)
    const room = await this.store.getRoom(code)
    if (!room) throw new RoomError("notFound", "Room not found.")
    return this.snapshot(code, room.state, room.version, playerId)
  }

  async act(
    code: string,
    token: string,
    action: ClientAction,
  ): Promise<RoomSnapshot> {
    const playerId = await this.authenticate(code, token)
    const gameAction = await this.toGameAction(playerId, action)
    const result = await this.mutate(code, (state) => {
      const next = gameReducer(state, gameAction)
      if (next === state) {
        throw new RoomError("rejected", "That move isn't allowed right now.")
      }
      return next
    })
    if (action.type === "leave") await this.store.removeSeat(code, playerId)
    const category = result.state.category
    if (
      (action.type === "startRound" || action.type === "nextRound") &&
      result.state.phase === "playing" &&
      category &&
      !category.builtIn
    ) {
      await this.onRoundStart(category.id).catch(() => {})
    }
    return this.snapshot(code, result.state, result.version, playerId)
  }

  /**
   * A LiveKit token for this player: the call is named after the room code
   * and the participant identity is the player id, so feeds map onto tiles.
   */
  async videoToken(code: string, token: string): Promise<VideoTokenResponse> {
    const playerId = await this.authenticate(code, token)
    if (!this.video) {
      throw new RoomError("unavailable", "Video isn't set up for this game.")
    }
    const room = await this.store.getRoom(code)
    const player = room?.state.players.find((p) => p.id === playerId)
    if (!player) throw new RoomError("unauthorized", "You're not in this room.")

    const at = new AccessToken(this.video.apiKey, this.video.apiSecret, {
      identity: playerId,
      name: player.name,
      ttl: VIDEO_TOKEN_TTL,
    })
    at.addGrant({
      room: code,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    })
    return { url: this.video.url, token: await at.toJwt() }
  }

  /** Keeps the seat alive and removes players who have gone silent. */
  async heartbeat(code: string, token: string): Promise<void> {
    const playerId = await this.authenticate(code, token)
    const now = this.now()
    await this.store.touchSeat(code, playerId, now)
    await this.prune(code, now)
  }

  async prune(code: string, now = this.now()): Promise<void> {
    const seen = await this.store.lastSeen(code)
    const room = await this.store.getRoom(code)
    if (!room) return
    const stale = room.state.players
      .map((p) => p.id)
      .filter((id) => now - (seen[id] ?? 0) > STALE_AFTER_MS)
    if (stale.length === 0) return
    await this.mutate(code, (state) =>
      stale.reduce(
        (s, playerId) => gameReducer(s, { type: "leave", playerId }),
        state,
      ),
    )
    await Promise.all(stale.map((id) => this.store.removeSeat(code, id)))
  }

  private newPlayer(input: JoinRequest): Player {
    return {
      id: this.playerId(),
      name: input.name.trim(),
      joinedAt: this.now(),
      media: { ...input.media, connection: "good" },
      ...(input.deviceId && { deviceId: input.deviceId }),
    }
  }

  private async seat(
    code: string,
    playerId: PlayerId,
    state: GameState,
    version: number,
  ): Promise<SeatResponse> {
    const token = this.token()
    await this.store.addSeat(code, playerId, hashToken(token), this.now())
    return {
      code,
      playerId,
      token,
      ...(await this.snapshot(code, state, version, playerId)),
    }
  }

  private async authenticate(code: string, token: string): Promise<PlayerId> {
    if (!token) throw new RoomError("unauthorized", "Missing player token.")
    const playerId = await this.store.findSeat(code, hashToken(token))
    if (!playerId) {
      const room = await this.store.getRoom(code)
      if (!room) throw new RoomError("notFound", "Room not found.")
      throw new RoomError("unauthorized", "You're not in this room.")
    }
    return playerId
  }

  private async toGameAction(
    by: PlayerId,
    action: ClientAction,
  ): Promise<GameAction> {
    switch (action.type) {
      case "selectCategory": {
        // Custom decks are snapshotted now, so later edits don't affect
        // this room until the host picks the deck again.
        const category =
          findDeck(action.categoryId) ??
          (await this.loadDeck?.(action.categoryId).catch((err: unknown) => {
            // A 404 here would read as "room not found" to the client.
            if (err instanceof RoomError && err.code === "notFound") {
              throw new RoomError("invalid", "That deck isn't available.")
            }
            throw err
          }))
        if (!category) throw new RoomError("invalid", "Unknown category.")
        return { type: "selectCategory", by, category }
      }
      case "startRound":
      case "nextRound":
        return { type: action.type, by, seed: this.seed() }
      case "setMedia":
        return { type: "setMedia", playerId: by, media: action.media }
      case "leave":
        return { type: "leave", playerId: by }
      default:
        return { ...action, by }
    }
  }

  /** Read-modify-write with a version check, retrying on conflicts. */
  private async mutate(
    code: string,
    update: (state: GameState) => GameState,
  ): Promise<{ state: GameState; version: number }> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const room = await this.store.getRoom(code)
      if (!room) throw new RoomError("notFound", "Room not found.")
      const next = update(room.state)
      if (next === room.state) return room
      if (await this.store.updateRoom(code, room.version, next)) {
        const version = room.version + 1
        await this.notify(code, version).catch(() => {})
        return { state: next, version }
      }
    }
    throw new RoomError("conflict", "The room is busy, try again.")
  }

  private async snapshot(
    code: string,
    state: GameState,
    version: number,
    playerId: PlayerId,
  ): Promise<RoomSnapshot> {
    const seen = await this.store.lastSeen(code)
    const now = this.now()
    const view: ViewerState = getViewerState(state, playerId)
    const players = view.players.map((p) =>
      now - (seen[p.id] ?? 0) > OFFLINE_AFTER_MS
        ? { ...p, media: { ...p.media, connection: "offline" as const } }
        : p,
    )
    return {
      version,
      view: {
        ...view,
        players,
        you: players.find((p) => p.isYou) ?? null,
      },
    }
  }
}
