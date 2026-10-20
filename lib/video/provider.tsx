"use client"

import {
  createLocalTracks,
  MediaDeviceFailure,
  Room,
  RoomEvent,
  Track,
  type LocalTrack,
  type Participant,
  type RemoteTrack,
  type VideoTrack,
} from "livekit-client"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import type { MediaState, PlayerId } from "@/lib/game"
import { useRoom } from "@/lib/room"

import {
  VideoContext,
  type CallStatus,
  type PreviewStatus,
  type VideoContextValue,
} from "./context"
import type { CallMedia } from "./media"

/** Wait this long before rejoining a call that dropped for good. */
const REJOIN_MS = 3_000

/** Events that change anything we read off the room. */
const ROOM_EVENTS = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackSubscribed,
  RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
  RoomEvent.ConnectionQualityChanged,
  RoomEvent.AudioPlaybackStatusChanged,
] as const

type Wanted = Pick<MediaState, "mic" | "camera">

/**
 * Joins the LiveKit call for the room you're seated in. The call is named
 * after the room code and your identity is your player id, so feeds map onto
 * tiles. Without video credentials (or in mock mode) it stays "unavailable"
 * and the UI shows placeholders.
 */
export function VideoProvider({ children }: { children: ReactNode }) {
  const { status: roomStatus, view, session, actions } = useRoom()
  const [room, setRoom] = useState<Room | null>(null)
  const [status, setStatus] = useState<CallStatus>("off")
  const [tick, setTick] = useState(0)
  const [rejoin, setRejoin] = useState(0)
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{
    status: PreviewStatus
    tracks: LocalTrack[]
  }>({ status: "idle", tracks: [] })

  // Latest values for async work without re-running the call effect.
  const previewRef = useRef<LocalTrack[]>([])
  const sessionRef = useRef(session)
  const actionsRef = useRef(actions)
  const wantedRef = useRef<Wanted>({ mic: false, camera: false })
  useEffect(() => {
    sessionRef.current = session
    actionsRef.current = actions
    if (view?.you) {
      wantedRef.current = {
        mic: view.you.media.mic,
        camera: view.you.media.camera,
      }
    }
  })

  const stopPreview = useCallback(() => {
    previewRef.current.forEach((t) => t.stop())
    previewRef.current = []
    setPreview({ status: "idle", tracks: [] })
  }, [])

  const startPreview = useCallback(async () => {
    setPreview((p) => ({ ...p, status: "requesting" }))
    let failure: unknown = null
    // Ask for both at once (one prompt), then settle for whichever works.
    for (const opts of [
      { audio: true, video: true },
      { audio: false, video: true },
      { audio: true, video: false },
    ]) {
      try {
        const tracks = await createLocalTracks(opts)
        previewRef.current.forEach((t) => t.stop())
        previewRef.current = tracks
        setPreview({ status: "ready", tracks })
        return
      } catch (err) {
        failure ??= err
        // Denied applies to both devices; don't prompt again.
        if (
          MediaDeviceFailure.getFailure(err) ===
          MediaDeviceFailure.PermissionDenied
        ) {
          break
        }
      }
    }
    const kind = MediaDeviceFailure.getFailure(failure)
    setPreview({
      status:
        kind === MediaDeviceFailure.PermissionDenied
          ? "denied"
          : kind === MediaDeviceFailure.NotFound
            ? "noDevice"
            : "error",
      tracks: [],
    })
  }, [])

  // One call per (room, seat). Reconnects within LiveKit are automatic; if it
  // gives up, `rejoin` bumps and we start over.
  const callKey =
    roomStatus === "ready" && view?.you
      ? `${view.roomCode}:${view.you.id}`
      : null

  useEffect(() => {
    if (!callKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- left the room
      setStatus("off")
      return
    }
    let closing = false
    const lk = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: { simulcast: true },
    })
    const bump = () => setTick((t) => t + 1)
    ROOM_EVENTS.forEach((e) => lk.on(e, bump))
    lk.on(RoomEvent.Reconnecting, () => setStatus("reconnecting"))
    lk.on(RoomEvent.Reconnected, () => setStatus("connected"))
    lk.on(RoomEvent.Disconnected, () => {
      if (closing) return
      setRoom(null)
      setStatus("reconnecting")
      setTimeout(() => setRejoin((n) => n + 1), REJOIN_MS)
    })

    void (async () => {
      setStatus("connecting")
      const creds = await sessionRef.current.videoToken()
      if (closing) return
      if (!creds) {
        setStatus("unavailable")
        previewRef.current.forEach((t) => t.stop())
        previewRef.current = []
        setPreview({ status: "idle", tracks: [] })
        return
      }
      try {
        await lk.connect(creds.url, creds.token)
      } catch {
        if (closing) return
        setStatus("reconnecting")
        setTimeout(() => setRejoin((n) => n + 1), REJOIN_MS)
        return
      }
      if (closing) return
      setRoom(lk)
      setStatus("connected")

      // Reuse the join-screen tracks so there's no second prompt.
      const tracks = previewRef.current
      previewRef.current = []
      setPreview({ status: "idle", tracks: [] })
      for (const track of tracks) {
        await lk.localParticipant.publishTrack(track).catch(() => track.stop())
      }
      const wanted = wantedRef.current
      await applyLocal(lk, "mic", wanted.mic)
      await applyLocal(lk, "camera", wanted.camera)
    })()

    async function applyLocal(lk: Room, kind: "mic" | "camera", on: boolean) {
      try {
        if (kind === "mic") await lk.localParticipant.setMicrophoneEnabled(on)
        else await lk.localParticipant.setCameraEnabled(on)
      } catch (err) {
        if (closing || !on) return
        setDeviceError(deviceMessage(kind, err))
        actionsRef.current.setMedia({ [kind]: false })
      }
    }

    return () => {
      closing = true
      setRoom(null)
      void lk.disconnect()
    }
  }, [callKey, rejoin])

  const setLocal = useCallback(
    async (kind: "mic" | "camera", on: boolean) => {
      setDeviceError(null)
      if (room) {
        try {
          if (kind === "mic")
            await room.localParticipant.setMicrophoneEnabled(on)
          else await room.localParticipant.setCameraEnabled(on)
        } catch (err) {
          setDeviceError(deviceMessage(kind, err))
          return
        }
      }
      actionsRef.current.setMedia({ [kind]: on })
    },
    [room],
  )

  const value = useMemo<VideoContextValue>(() => {
    const participants: Participant[] = room
      ? [room.localParticipant, ...room.remoteParticipants.values()]
      : []
    const callMedia: Record<PlayerId, CallMedia> = {}
    for (const p of participants) {
      callMedia[p.identity] = {
        mic: p.isMicrophoneEnabled,
        camera: p.isCameraEnabled,
        quality: p.connectionQuality,
      }
    }
    const videoTrack = preview.tracks.find((t) => t.kind === Track.Kind.Video)

    return {
      status,
      preview: {
        status: preview.status,
        hasVideo: !!videoTrack,
        hasAudio: preview.tracks.some((t) => t.kind === Track.Kind.Audio),
        videoTrack: (videoTrack as VideoTrack | undefined) ?? null,
        start: startPreview,
        stop: stopPreview,
      },
      cameraTrack: (playerId) => {
        const p = participants.find((x) => x.identity === playerId)
        const pub = p?.getTrackPublication(Track.Source.Camera)
        if (!pub || pub.isMuted || pub.track?.kind !== Track.Kind.Video) {
          return null
        }
        return pub.track as VideoTrack
      },
      callMedia,
      reconnecting: status === "reconnecting",
      setMic: (on) => setLocal("mic", on),
      setCamera: (on) => setLocal("camera", on),
      deviceError,
      audioBlocked: !!room && !room.canPlaybackAudio,
      enableAudio: () => void room?.startAudio(),
    }
    // `tick` re-reads the mutable room after LiveKit events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    room,
    tick,
    status,
    preview,
    deviceError,
    startPreview,
    stopPreview,
    setLocal,
  ])

  return (
    <VideoContext.Provider value={value}>
      {children}
      {room && <CallAudio room={room} tick={tick} />}
    </VideoContext.Provider>
  )
}

/** Plays everyone else's mic. Hidden; never recorded. */
function CallAudio({ room, tick }: { room: Room; tick: number }) {
  void tick
  const tracks: RemoteTrack[] = []
  for (const p of room.remoteParticipants.values()) {
    const track = p.getTrackPublication(Track.Source.Microphone)?.track
    if (track) tracks.push(track)
  }
  return (
    <>
      {tracks.map((t) => (
        <RemoteAudio key={t.sid} track={t} />
      ))}
    </>
  )
}

function RemoteAudio({ track }: { track: RemoteTrack }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    track.attach(el)
    return () => {
      track.detach(el)
    }
  }, [track])
  return <audio ref={ref} autoPlay className="hidden" />
}

function deviceMessage(kind: "mic" | "camera", err: unknown): string {
  const device = kind === "mic" ? "microphone" : "camera"
  switch (MediaDeviceFailure.getFailure(err)) {
    case MediaDeviceFailure.PermissionDenied:
      return `Your browser blocked the ${device}. Allow it in the address bar, then try again.`
    case MediaDeviceFailure.NotFound:
      return `No ${device} found.`
    case MediaDeviceFailure.DeviceInUse:
      return `Your ${device} is in use by another app.`
    default:
      return `Couldn't turn on your ${device}.`
  }
}
