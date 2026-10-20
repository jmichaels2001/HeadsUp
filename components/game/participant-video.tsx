"use client"

import { cn } from "cn"
import type { VideoTrack } from "livekit-client"
import { useEffect, useRef } from "react"

import type { ViewerPlayer } from "@/lib/game"
import { useRoom, type VideoOrientation } from "@/lib/room"
import { useVideo } from "@/lib/video"

import { MockVideo } from "./mock-video"

/** A player's video, wired to the room and the call. */
export function PlayerVideo({
  player,
  colorIndex,
}: {
  player: ViewerPlayer
  colorIndex: number
}) {
  const { videoOrientation } = useRoom()
  const { cameraTrack } = useVideo()
  return (
    <ParticipantVideo
      track={cameraTrack(player.id)}
      mirror={player.isYou}
      name={player.name}
      colorIndex={colorIndex}
      orientation={videoOrientation(player.id)}
      cameraOn={player.media.camera}
    />
  )
}

/**
 * A player's tile video: their live camera when there is one, otherwise the
 * Phase 1 placeholder. Feeds are letterboxed (object-contain), so portrait
 * phones and landscape webcams both fit. Your own feed is mirrored.
 */
export function ParticipantVideo({
  track,
  name,
  colorIndex,
  orientation,
  cameraOn,
  mirror = false,
}: {
  track: VideoTrack | null
  name: string
  colorIndex: number
  orientation: VideoOrientation
  cameraOn: boolean
  mirror?: boolean
}) {
  if (!track) {
    return (
      <MockVideo
        name={name}
        colorIndex={colorIndex}
        orientation={orientation}
        cameraOn={cameraOn}
      />
    )
  }
  return <TrackVideo track={track} mirror={mirror} />
}

export function TrackVideo({
  track,
  mirror,
}: {
  track: VideoTrack
  mirror: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    track.attach(el)
    return () => {
      track.detach(el)
    }
  }, [track])

  return (
    <div className="flex size-full items-center justify-center bg-ink/90">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={cn("size-full object-contain", mirror && "-scale-x-100")}
      />
    </div>
  )
}
