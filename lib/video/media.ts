import type {
  ConnectionStatus,
  MediaState,
  PlayerId,
  ViewerState,
} from "@/lib/game"

/**
 * Pure helpers that overlay what the video call knows (mic, camera, link
 * quality) on the room's view. No LiveKit imports, so they're easy to test.
 */

export type CallQuality = "excellent" | "good" | "poor" | "lost" | "unknown"

export interface CallMedia {
  mic: boolean
  camera: boolean
  quality: CallQuality
}

const SEVERITY: Record<ConnectionStatus, number> = {
  good: 0,
  poor: 1,
  reconnecting: 2,
  offline: 3,
}

function fromQuality(quality: CallQuality): ConnectionStatus {
  return quality === "poor" || quality === "lost" ? "poor" : "good"
}

function worst(a: ConnectionStatus, b: ConnectionStatus): ConnectionStatus {
  return SEVERITY[a] >= SEVERITY[b] ? a : b
}

/**
 * The call is the source of truth for mic and camera once a player is on it.
 * Connection is the worse of room presence and call quality, plus your own
 * call reconnecting.
 */
export function mergeMedia(
  base: MediaState,
  call: CallMedia | undefined,
  callReconnecting = false,
): MediaState {
  let connection = base.connection
  if (call) connection = worst(connection, fromQuality(call.quality))
  if (callReconnecting) connection = worst(connection, "reconnecting")
  if (!call && connection === base.connection) return base
  return {
    mic: call ? call.mic : base.mic,
    camera: call ? call.camera : base.camera,
    connection,
  }
}

/** The view with every player's media merged with the call's. */
export function withCallMedia(
  view: ViewerState,
  call: Readonly<Record<PlayerId, CallMedia>>,
  youReconnecting: boolean,
): ViewerState {
  let changed = false
  const players = view.players.map((p) => {
    const media = mergeMedia(p.media, call[p.id], p.isYou && youReconnecting)
    if (media === p.media) return p
    changed = true
    return { ...p, media }
  })
  if (!changed) return view
  return { ...view, players, you: players.find((p) => p.isYou) ?? null }
}
