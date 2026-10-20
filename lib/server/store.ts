import type { GameState, PlayerId } from "@/lib/game"

export interface RoomRecord {
  code: string
  state: GameState
  version: number
}

/** Persistence for rooms and player seats. Supabase in prod, memory in tests. */
export interface RoomStore {
  /** Returns false if the code is already taken. */
  createRoom(code: string, state: GameState): Promise<boolean>
  getRoom(code: string): Promise<RoomRecord | null>
  /** Compare-and-set on version. Returns false if someone else wrote first. */
  updateRoom(
    code: string,
    expectedVersion: number,
    state: GameState,
  ): Promise<boolean>
  addSeat(
    code: string,
    playerId: PlayerId,
    tokenHash: string,
    now: number,
  ): Promise<void>
  findSeat(code: string, tokenHash: string): Promise<PlayerId | null>
  touchSeat(code: string, playerId: PlayerId, now: number): Promise<void>
  /** Last heartbeat per seated player, in epoch ms. */
  lastSeen(code: string): Promise<Record<PlayerId, number>>
  removeSeat(code: string, playerId: PlayerId): Promise<void>
}

interface MemorySeat {
  playerId: PlayerId
  tokenHash: string
  lastSeen: number
}

/** In-process store for tests and local dev without Supabase. */
export class MemoryRoomStore implements RoomStore {
  private rooms = new Map<string, RoomRecord>()
  private seats = new Map<string, MemorySeat[]>()

  async createRoom(code: string, state: GameState) {
    if (this.rooms.has(code)) return false
    this.rooms.set(code, { code, state, version: 0 })
    this.seats.set(code, [])
    return true
  }

  async getRoom(code: string) {
    const room = this.rooms.get(code)
    return room ? structuredClone(room) : null
  }

  async updateRoom(code: string, expectedVersion: number, state: GameState) {
    const room = this.rooms.get(code)
    if (!room || room.version !== expectedVersion) return false
    this.rooms.set(code, {
      code,
      state: structuredClone(state),
      version: expectedVersion + 1,
    })
    return true
  }

  async addSeat(
    code: string,
    playerId: PlayerId,
    tokenHash: string,
    now: number,
  ) {
    this.seats.get(code)?.push({ playerId, tokenHash, lastSeen: now })
  }

  async findSeat(code: string, tokenHash: string) {
    return (
      this.seats.get(code)?.find((s) => s.tokenHash === tokenHash)?.playerId ??
      null
    )
  }

  async touchSeat(code: string, playerId: PlayerId, now: number) {
    const seat = this.seats.get(code)?.find((s) => s.playerId === playerId)
    if (seat) seat.lastSeen = now
  }

  async lastSeen(code: string) {
    return Object.fromEntries(
      (this.seats.get(code) ?? []).map((s) => [s.playerId, s.lastSeen]),
    )
  }

  async removeSeat(code: string, playerId: PlayerId) {
    const seats = this.seats.get(code)
    if (seats)
      this.seats.set(
        code,
        seats.filter((s) => s.playerId !== playerId),
      )
  }
}
