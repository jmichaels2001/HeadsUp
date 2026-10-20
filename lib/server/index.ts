import "server-only"

import { createClient } from "@supabase/supabase-js"

import { DeckService } from "./deck-service"
import { MemoryDeckStore } from "./deck-store"
import { MemoryImageStore, SupabaseImageStore } from "./image-store"
import { RoomService, type VideoConfig } from "./room-service"
import { MemoryRoomStore } from "./store"
import { SupabaseDeckStore } from "./supabase-deck-store"
import { SupabaseRoomStore, supabaseNotifier } from "./supabase-store"

export { RoomError } from "./room-service"

const globalForRooms = globalThis as unknown as {
  headbandsRoomService?: RoomService
  headbandsDeckService?: DeckService
  headbandsMemoryImages?: MemoryImageStore
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

  const db = supabaseAdmin()
  let service: RoomService

  if (db) {
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
    throw notConfigured()
  }

  globalForRooms.headbandsRoomService = service
  return service
}

/** The app's DeckService, with the same Supabase-or-memory choice. */
export function getDeckService(): DeckService {
  if (globalForRooms.headbandsDeckService) {
    return globalForRooms.headbandsDeckService
  }

  const db = supabaseAdmin()
  let service: DeckService

  if (db) {
    service = new DeckService({
      store: new SupabaseDeckStore(db),
      images: new SupabaseImageStore(db),
    })
  } else if (process.env.NODE_ENV !== "production") {
    service = new DeckService({
      store: new MemoryDeckStore(),
      images: getMemoryImages(),
    })
  } else {
    throw notConfigured()
  }

  globalForRooms.headbandsDeckService = service
  return service
}

/** Card images for local dev without Supabase; null when Supabase is on. */
export function getMemoryImageStore(): MemoryImageStore | null {
  return supabaseAdmin() ? null : getMemoryImages()
}

function getMemoryImages(): MemoryImageStore {
  globalForRooms.headbandsMemoryImages ??= new MemoryImageStore()
  return globalForRooms.headbandsMemoryImages
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!url || !secret) return null
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function notConfigured() {
  return new Error(
    "Supabase isn't configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.",
  )
}

/** LiveKit Cloud credentials, or null to run without video. */
function videoConfig(): VideoConfig | null {
  const url = process.env.LIVEKIT_URL
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  return url && apiKey && apiSecret ? { url, apiKey, apiSecret } : null
}
