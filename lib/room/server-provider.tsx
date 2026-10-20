"use client"

import { usePathname } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import type { ViewerPlayer, ViewerState } from "@/lib/game"

import {
  RoomContext,
  type DevOverlay,
  type JoinResult,
  type RoomContextValue,
  type RoomStatus,
} from "./context"
import {
  ROOM_CHANGED_EVENT,
  roomChannel,
  type ApiError,
  type ClientAction,
  type RoomSnapshot,
  type Seat,
  type SeatResponse,
  type VideoTokenResponse,
} from "./protocol"
import { loadSeats, saveSeats } from "./seats"
import { getBrowserSupabase } from "./supabase-browser"

const HEARTBEAT_MS = 15_000
/** Safety-net refresh; realtime pings normally make this unnecessary. */
const POLL_WITH_REALTIME_MS = 15_000
const POLL_WITHOUT_REALTIME_MS = 2_000

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError | null,
  ) {
    super(body?.message ?? `HTTP ${status}`)
  }
}

async function request<T>(
  path: string,
  init: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    cache: "no-store",
    headers: {
      ...(init.body !== undefined && { "content-type": "application/json" }),
      ...(init.token && { authorization: `Bearer ${init.token}` }),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  if (!res.ok) {
    throw new HttpError(res.status, await res.json().catch(() => null))
  }
  return res.json() as Promise<T>
}

/** Code of the room in the URL, if we're on /room/[code]. */
function roomCodeFrom(pathname: string | null): string | null {
  const match = pathname?.match(/^\/room\/([A-Za-z0-9]+)/)
  return match ? match[1].toUpperCase() : null
}

/**
 * Real multiplayer room: the server runs the rules and returns this player's
 * view. Supabase Realtime pings trigger refetches and drive presence; polling
 * and a heartbeat keep things honest if the socket drops.
 */
export function ServerRoomProvider({ children }: { children: ReactNode }) {
  const code = roomCodeFrom(usePathname())
  const [seats, setSeats] = useState<Record<string, Seat>>({})
  const [ready, setReady] = useState(false)
  const [snapshot, setSnapshot] = useState<
    (RoomSnapshot & { code: string }) | null
  >(null)
  const [status, setStatus] = useState<RoomStatus>("loading")
  const [reconnecting, setReconnecting] = useState(false)
  const [realtimeLive, setRealtimeLive] = useState(false)
  const [online, setOnline] = useState<Set<string> | null>(null)
  const [overlay, setOverlay] = useState<DevOverlay>("none")
  const versionRef = useRef(-1)

  useEffect(() => {
    // Read localStorage after mount so server and client render the same.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeats(loadSeats())
    setReady(true)
  }, [])

  const updateSeats = useCallback(
    (update: (s: Record<string, Seat>) => Record<string, Seat>) => {
      setSeats((prev) => {
        const next = update(prev)
        saveSeats(next)
        return next
      })
    },
    [],
  )

  const seat = code ? seats[code] : undefined
  const token = seat?.token

  /** Accept a snapshot unless we've already seen a newer one. */
  const apply = useCallback((roomCode: string, snap: RoomSnapshot) => {
    if (snap.version < versionRef.current) return
    versionRef.current = snap.version
    setSnapshot({ ...snap, code: roomCode })
    setStatus("ready")
    setReconnecting(false)
  }, [])

  const dropSeat = useCallback(
    (roomCode: string) => {
      updateSeats((s) => {
        const next = { ...s }
        delete next[roomCode]
        return next
      })
    },
    [updateSeats],
  )

  const handleError = useCallback(
    (roomCode: string, err: unknown) => {
      if (err instanceof HttpError) {
        if (err.status === 401) {
          dropSeat(roomCode)
          setStatus("notSeated")
        } else if (err.status === 404) {
          dropSeat(roomCode)
          setStatus("notFound")
        }
        // 409 (move rejected / busy) and 400: the fetch below resyncs.
      } else {
        setReconnecting(true)
      }
    },
    [dropSeat],
  )

  const refresh = useCallback(async () => {
    if (!code || !token) return
    try {
      apply(code, await request<RoomSnapshot>(`/api/rooms/${code}`, { token }))
    } catch (err) {
      handleError(code, err)
    }
  }, [code, token, apply, handleError])

  // Load the room in the URL.
  useEffect(() => {
    versionRef.current = -1
    /* eslint-disable react-hooks/set-state-in-effect -- reset per room */
    setSnapshot(null)
    setOnline(null)
    if (!ready || !code) return
    if (!token) {
      setStatus("notSeated")
      return
    }
    setStatus("loading")
    /* eslint-enable react-hooks/set-state-in-effect */
    void refresh()
  }, [ready, code, token, refresh])

  // Heartbeat keeps the seat; the server prunes silent players.
  useEffect(() => {
    if (!code || !token) return
    const beat = () =>
      request(`/api/rooms/${code}/heartbeat`, { method: "POST", token }).catch(
        (err) => handleError(code, err),
      )
    void beat()
    const id = setInterval(beat, HEARTBEAT_MS)
    return () => clearInterval(id)
  }, [code, token, handleError])

  // Polling safety net.
  useEffect(() => {
    if (!code || !token) return
    const id = setInterval(
      refresh,
      realtimeLive ? POLL_WITH_REALTIME_MS : POLL_WITHOUT_REALTIME_MS,
    )
    return () => clearInterval(id)
  }, [code, token, realtimeLive, refresh])

  // Catch up whenever the tab comes back or the network returns.
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    const onOffline = () => setReconnecting(true)
    window.addEventListener("online", onWake)
    window.addEventListener("offline", onOffline)
    document.addEventListener("visibilitychange", onWake)
    return () => {
      window.removeEventListener("online", onWake)
      window.removeEventListener("offline", onOffline)
      document.removeEventListener("visibilitychange", onWake)
    }
  }, [refresh])

  // Realtime: "room changed" pings and presence.
  const playerId = seat?.playerId
  useEffect(() => {
    const supabase = getBrowserSupabase()
    if (!supabase || !code || !playerId) return
    const channel = supabase.channel(roomChannel(code), {
      config: { presence: { key: playerId } },
    })
    channel
      .on("broadcast", { event: ROOM_CHANGED_EVENT }, ({ payload }) => {
        const version = (payload as { version?: number })?.version ?? Infinity
        if (version > versionRef.current) void refresh()
      })
      .on("presence", { event: "sync" }, () => {
        setOnline(new Set(Object.keys(channel.presenceState())))
      })
      .subscribe((state) => {
        if (state === "SUBSCRIBED") {
          setRealtimeLive(true)
          void channel.track({ at: Date.now() })
          void refresh() // catch anything missed while disconnected
        } else {
          setRealtimeLive(false)
        }
      })
    return () => {
      setRealtimeLive(false)
      void supabase.removeChannel(channel)
    }
  }, [code, playerId, refresh])

  const send = useCallback(
    async (action: ClientAction) => {
      if (!code || !token) return
      try {
        apply(
          code,
          await request<RoomSnapshot>(`/api/rooms/${code}/actions`, {
            method: "POST",
            token,
            body: action,
          }),
        )
      } catch (err) {
        handleError(code, err)
        void refresh()
      }
    },
    [code, token, apply, handleError, refresh],
  )

  const value = useMemo<RoomContextValue>(() => {
    const view =
      snapshot && snapshot.code === code
        ? withPresence(snapshot.view, online, reconnecting)
        : null

    const seatUp = (res: SeatResponse) => {
      updateSeats((s) => ({
        ...s,
        [res.code]: {
          code: res.code,
          playerId: res.playerId,
          token: res.token,
        },
      }))
    }

    return {
      backend: "server",
      ready,
      status,
      view,
      reconnecting,
      overlay,
      setOverlay,
      videoOrientation: () => "landscape",
      session: {
        createRoom: async (name, media) => {
          try {
            const res = await request<SeatResponse>("/api/rooms", {
              method: "POST",
              body: { name, media },
            })
            seatUp(res)
            return { ok: true, code: res.code }
          } catch {
            return { ok: false }
          }
        },
        joinRoom: async (roomCode, name, media): Promise<JoinResult> => {
          try {
            const res = await request<SeatResponse>(
              `/api/rooms/${roomCode}/join`,
              { method: "POST", body: { name, media } },
            )
            seatUp(res)
            return "ok"
          } catch (err) {
            if (err instanceof HttpError) {
              if (err.body?.error === "full") return "full"
              if (err.status === 404) return "notFound"
            }
            return "error"
          }
        },
        hasSeat: (roomCode) => !!seats[roomCode],
        videoToken: async () => {
          if (!code || !token) return null
          try {
            return await request<VideoTokenResponse>(
              `/api/rooms/${code}/video-token`,
              { method: "POST", token },
            )
          } catch {
            return null // not configured (503) or seat gone
          }
        },
        leaveRoom: () => {
          if (!code || !token) return
          void request(`/api/rooms/${code}/actions`, {
            method: "POST",
            token,
            body: { type: "leave" },
          }).catch(() => {})
          dropSeat(code)
          setSnapshot(null)
        },
      },
      actions: {
        selectCategory: (categoryId) =>
          send({ type: "selectCategory", categoryId }),
        updateSettings: (settings) =>
          send({ type: "updateSettings", settings }),
        startRound: () => send({ type: "startRound" }),
        askQuestion: (question) => send({ type: "askQuestion", question }),
        answerQuestion: (answer) => send({ type: "answerQuestion", answer }),
        questionAnswered: () => send({ type: "questionAnswered" }),
        makeGuess: (text) => send({ type: "makeGuess", text }),
        castVote: (vote) => send({ type: "castVote", vote }),
        endRound: () => send({ type: "endRound" }),
        nextRound: () => send({ type: "nextRound" }),
        backToLobby: () => send({ type: "backToLobby" }),
        setMedia: (media) => send({ type: "setMedia", media }),
      },
      dev: null,
    }
  }, [
    snapshot,
    code,
    token,
    online,
    reconnecting,
    ready,
    status,
    overlay,
    seats,
    send,
    dropSeat,
    updateSeats,
  ])

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
}

/**
 * Overlay live presence on the server's view: players missing from the
 * channel show offline, and your own tile shows reconnecting if you drop.
 */
function withPresence(
  view: ViewerState,
  online: Set<string> | null,
  reconnecting: boolean,
): ViewerState {
  const players: ViewerPlayer[] = view.players.map((p) => {
    let connection = p.media.connection
    if (p.isYou) {
      connection = reconnecting ? "reconnecting" : "good"
    } else if (online) {
      connection = online.has(p.id)
        ? connection === "offline"
          ? "good"
          : connection
        : "offline"
    }
    return connection === p.media.connection
      ? p
      : { ...p, media: { ...p.media, connection } }
  })
  return { ...view, players, you: players.find((p) => p.isYou) ?? null }
}
