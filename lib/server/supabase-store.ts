import type { SupabaseClient } from "@supabase/supabase-js"

import type { GameState, PlayerId } from "@/lib/game"
import { ROOM_CHANGED_EVENT, roomChannel } from "@/lib/room/protocol"

import type { RoomRecord, RoomStore } from "./store"

const UNIQUE_VIOLATION = "23505"

function fail(op: string, error: { message: string }): never {
  throw new Error(`Supabase ${op} failed: ${error.message}`)
}

/** RoomStore backed by the `rooms` and `room_players` tables. */
export class SupabaseRoomStore implements RoomStore {
  constructor(private db: SupabaseClient) {}

  async createRoom(code: string, state: GameState) {
    const { error } = await this.db
      .from("rooms")
      .insert({ code, state, version: 0 })
    if (error?.code === UNIQUE_VIOLATION) return false
    if (error) fail("createRoom", error)
    return true
  }

  async getRoom(code: string): Promise<RoomRecord | null> {
    const { data, error } = await this.db
      .from("rooms")
      .select("code, state, version")
      .eq("code", code)
      .maybeSingle()
    if (error) fail("getRoom", error)
    return data as RoomRecord | null
  }

  async updateRoom(code: string, expectedVersion: number, state: GameState) {
    const { data, error } = await this.db
      .from("rooms")
      .update({
        state,
        version: expectedVersion + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("code", code)
      .eq("version", expectedVersion)
      .select("version")
    if (error) fail("updateRoom", error)
    return (data?.length ?? 0) === 1
  }

  async addSeat(
    code: string,
    playerId: PlayerId,
    tokenHash: string,
    now: number,
  ) {
    const { error } = await this.db.from("room_players").insert({
      room_code: code,
      player_id: playerId,
      token_hash: tokenHash,
      last_seen: new Date(now).toISOString(),
    })
    if (error) fail("addSeat", error)
  }

  async findSeat(code: string, tokenHash: string) {
    const { data, error } = await this.db
      .from("room_players")
      .select("player_id")
      .eq("room_code", code)
      .eq("token_hash", tokenHash)
      .maybeSingle()
    if (error) fail("findSeat", error)
    return (data?.player_id as string | undefined) ?? null
  }

  async touchSeat(code: string, playerId: PlayerId, now: number) {
    const { error } = await this.db
      .from("room_players")
      .update({ last_seen: new Date(now).toISOString() })
      .eq("room_code", code)
      .eq("player_id", playerId)
    if (error) fail("touchSeat", error)
  }

  async lastSeen(code: string) {
    const { data, error } = await this.db
      .from("room_players")
      .select("player_id, last_seen")
      .eq("room_code", code)
    if (error) fail("lastSeen", error)
    return Object.fromEntries(
      (data ?? []).map((row) => [
        row.player_id as string,
        Date.parse(row.last_seen as string),
      ]),
    )
  }

  async removeSeat(code: string, playerId: PlayerId) {
    const { error } = await this.db
      .from("room_players")
      .delete()
      .eq("room_code", code)
      .eq("player_id", playerId)
    if (error) fail("removeSeat", error)
  }
}

/** Broadcast "room changed" over Realtime REST, without subscribing. */
export function supabaseNotifier(db: SupabaseClient) {
  return async (code: string, version: number) => {
    const channel = db.channel(roomChannel(code))
    try {
      await channel.httpSend(ROOM_CHANGED_EVENT, { version })
    } finally {
      await db.removeChannel(channel)
    }
  }
}
