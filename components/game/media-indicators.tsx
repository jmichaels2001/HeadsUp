import { cn } from "cn"
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Wifi,
  WifiLow,
  WifiOff,
} from "lucide-react"

import type { MediaState } from "@/lib/game"

const pill =
  "inline-flex size-6 items-center justify-center rounded-full border-2 border-ink sm:size-7 [&_svg]:size-3 sm:[&_svg]:size-3.5"

export function MediaIndicators({
  media,
  className,
}: {
  media: MediaState
  className?: string
}) {
  const { mic, camera, connection } = media
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span
        className={cn(
          pill,
          mic
            ? "bg-card text-ink"
            : "bg-destructive text-destructive-foreground",
        )}
        title={mic ? "Mic on" : "Muted"}
      >
        {mic ? <Mic aria-label="Mic on" /> : <MicOff aria-label="Muted" />}
      </span>
      <span
        className={cn(
          pill,
          camera
            ? "bg-card text-ink"
            : "bg-destructive text-destructive-foreground",
        )}
        title={camera ? "Camera on" : "Camera off"}
      >
        {camera ? (
          <Video aria-label="Camera on" />
        ) : (
          <VideoOff aria-label="Camera off" />
        )}
      </span>
      <span
        className={cn(
          pill,
          connection === "good" && "bg-card text-success",
          connection === "poor" && "bg-warning-soft text-warning",
          connection === "reconnecting" && "bg-warning-soft text-warning",
          connection === "offline" &&
            "bg-destructive text-destructive-foreground",
        )}
        title={CONNECTION_LABEL[connection]}
      >
        {connection === "good" ? (
          <Wifi aria-label={CONNECTION_LABEL.good} />
        ) : connection === "offline" ? (
          <WifiOff aria-label={CONNECTION_LABEL.offline} />
        ) : (
          <WifiLow aria-label={CONNECTION_LABEL[connection]} />
        )}
      </span>
    </span>
  )
}

const CONNECTION_LABEL: Record<MediaState["connection"], string> = {
  good: "Good connection",
  poor: "Weak connection",
  reconnecting: "Reconnecting",
  offline: "Offline",
}
