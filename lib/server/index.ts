import "server-only"

import { createClient } from "@supabase/supabase-js"

import { RoomService, type VideoConfig } from "./room-service"
import { MemoryRoomStore } from "./store"
import { SupabaseRoomStore, supabaseNotifier } from "./supabase-store"

export { RoomError } from "./room-service"

const globalForRooms = globalThis as unknown as {
  headbandsRoomService?: RoomService
}

/**
 * The app's RoomService. Uses Supabase when its env vars are set; otherwise an
 * in-memory store for local dev (rooms vanish on restart, no realtime push,
 * clients fall back to polling).
 */
export function getRoomService(): RoomService {
  if (globalForRooms.headbandsRoomService) {
    return globalForRooms.headbandsRoomService
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY
  let service: RoomService

  if (url && secret) {
    const db = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    service = new RoomService({
      store: new SupabaseRoomStore(db),
      notify: supabaseNotifier(db),
      video: videoConfig(),
    })
  } else if (process.env.NODE_ENV !== "production") {
    service = new RoomService({
      store: new MemoryRoomStore(),
      video: videoConfig(),
    })
  } else {
    throw new Error(
      "Supabase isn't configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.",
    )
  }

  globalForRooms.headbandsRoomService = service
  return service
}

/** LiveKit Cloud credentials, or null to run without video. */
function videoConfig(): VideoConfig | null {
  const url = process.env.LIVEKIT_URL
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  return url && apiKey && apiSecret ? { url, apiKey, apiSecret } : null
}
