"use client"

import { Mic, MicOff, Video, VideoOff, Volume2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { ViewerPlayer } from "@/lib/game"
import { useVideo } from "@/lib/video"

/** Your mic and camera toggles, for the room header. */
export function MediaToggles({ you }: { you: ViewerPlayer }) {
  const { setMic, setCamera } = useVideo()
  const { mic, camera } = you.media
  return (
    <span className="flex items-center gap-1">
      <Button
        size="icon-sm"
        variant={mic ? "outline" : "destructive"}
        aria-pressed={!mic}
        aria-label={mic ? "Mute mic" : "Unmute mic"}
        title={mic ? "Mute mic" : "Unmute mic"}
        onClick={() => void setMic(!mic)}
      >
        {mic ? <Mic aria-hidden /> : <MicOff aria-hidden />}
      </Button>
      <Button
        size="icon-sm"
        variant={camera ? "outline" : "destructive"}
        aria-pressed={!camera}
        aria-label={camera ? "Turn camera off" : "Turn camera on"}
        title={camera ? "Turn camera off" : "Turn camera on"}
        onClick={() => void setCamera(!camera)}
      >
        {camera ? <Video aria-hidden /> : <VideoOff aria-hidden />}
      </Button>
    </span>
  )
}

/**
 * Floating notices about the call: blocked sound (browsers need a tap before
 * playing audio) and camera/mic errors.
 */
export function CallNotices() {
  const { audioBlocked, enableAudio, deviceError } = useVideo()
  if (!audioBlocked && !deviceError) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex flex-col items-center gap-2 px-4">
      {audioBlocked && (
        <Button
          size="lg"
          variant="secondary"
          className="pointer-events-auto"
          onClick={enableAudio}
        >
          <Volume2 aria-hidden />
          Tap to enable sound
        </Button>
      )}
      {deviceError && (
        <p
          role="alert"
          className="pointer-events-auto max-w-md rounded-xl border-2 border-ink bg-warning-soft px-3 py-2 text-sm font-semibold text-warning shadow-pop-sm"
        >
          {deviceError}
        </p>
      )}
    </div>
  )
}
