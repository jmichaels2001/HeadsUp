import "server-only"

import { createClient } from "@supabase/supabase-js"

import { AdminService } from "./admin-service"
import { claudeDeckGenerator, DEFAULT_AI_MODEL } from "./ai-deck"
import { DeckService } from "./deck-service"
import { MemoryDeckStore, type DeckStore } from "./deck-store"
import { MemoryImageStore, SupabaseImageStore } from "./image-store"
import { RoomService, type VideoConfig } from "./room-service"
import { MemoryGenerationLog, type GenerationLog } from "./generation-log"
import { MemoryReportStore, type ReportStore } from "./report-store"
import { MemoryRoomStore } from "./store"
import {
  SupabaseDeckStore,
  SupabaseGenerationLog,
  SupabaseReportStore,
} from "./supabase-deck-store"
import { SupabaseRoomStore, supabaseNotifier } from "./supabase-store"

export { RoomError } from "./room-service"

const globalForRooms = globalThis as unknown as {
  headbandsRoomService?: RoomService
  headbandsDeckService?: DeckService
  headbandsAdminService?: AdminService
  headbandsDeckStores?: DeckStores
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
      loadDeck: (id) => getDeckService().loadForRoom(id),
      onRoundStart: (id) => getDeckService().recordPlay(id),
    })
  } else if (process.env.NODE_ENV !== "production") {
    service = new RoomService({
      store: new MemoryRoomStore(),
      video: videoConfig(),
      loadDeck: (id) => getDeckService().loadForRoom(id),
      onRoundStart: (id) => getDeckService().recordPlay(id),
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
  const { decks, reports, generations } = getDeckStores()
  const apiKey = process.env.ANTHROPIC_API_KEY
  const service = new DeckService({
    store: decks,
    reports,
    generations,
    images: db ? new SupabaseImageStore(db) : getMemoryImages(),
    generator: apiKey
      ? claudeDeckGenerator({
          apiKey,
          model: process.env.ANTHROPIC_MODEL || DEFAULT_AI_MODEL,
        })
      : null,
  })
  globalForRooms.headbandsDeckService = service
  return service
}

/** Moderation. Routes must check the admin cookie before using it. */
export function getAdminService(): AdminService {
  if (!globalForRooms.headbandsAdminService) {
    const { decks, reports } = getDeckStores()
    globalForRooms.headbandsAdminService = new AdminService(decks, reports)
  }
  return globalForRooms.headbandsAdminService
}

interface DeckStores {
  decks: DeckStore
  reports: ReportStore
  generations: GenerationLog
}

/** Shared by the deck and admin services, so memory mode sees one world. */
function getDeckStores(): DeckStores {
  if (globalForRooms.headbandsDeckStores) {
    return globalForRooms.headbandsDeckStores
  }
  const db = supabaseAdmin()
  let stores: DeckStores
  if (db) {
    stores = {
      decks: new SupabaseDeckStore(db),
      reports: new SupabaseReportStore(db),
      generations: new SupabaseGenerationLog(db),
    }
  } else if (process.env.NODE_ENV !== "production") {
    stores = {
      decks: new MemoryDeckStore(),
      reports: new MemoryReportStore(),
      generations: new MemoryGenerationLog(),
    }
  } else {
    throw notConfigured()
  }
  globalForRooms.headbandsDeckStores = stores
  return stores
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
