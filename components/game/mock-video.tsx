import { cn } from "cn"
import { VideoOff } from "lucide-react"

import type { VideoOrientation } from "@/lib/mock/players"

import { PlayerAvatar, playerColor } from "./player-avatar"

/**
 * Placeholder for a participant's video feed. The real LiveKit track replaces
 * this via PlayerTile's `videoSlot` in Phase 3. Portrait feeds are
 * letterboxed inside the tile, like a phone camera would be.
 */
export function MockVideo({
  name,
  colorIndex,
  orientation,
  cameraOn,
}: {
  name: string
  colorIndex: number
  orientation: VideoOrientation
  cameraOn: boolean
}) {
  return (
    <div className="flex size-full items-center justify-center bg-ink/90">
      <div
        data-orientation={orientation}
        className={cn(
          "relative flex items-center justify-center overflow-hidden",
          orientation === "landscape"
            ? "aspect-video max-h-full w-full"
            : "aspect-[9/16] h-full max-w-full",
          cameraOn ? playerColor(colorIndex) : "bg-ink",
        )}
      >
        {cameraOn ? (
          <>
            {/* Faux "person" silhouette */}
            <div className="absolute bottom-0 left-1/2 h-1/3 w-3/5 -translate-x-1/2 rounded-t-full bg-ink/15" />
            <PlayerAvatar
              name={name}
              colorIndex={colorIndex}
              size="lg"
              className="relative -mt-[10%] scale-[0.6] bg-card/70 sm:scale-90 lg:scale-100"
            />
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-background/80">
            <VideoOff className="size-6" aria-hidden />
            <span className="text-xs font-semibold">Camera off</span>
          </div>
        )}
      </div>
    </div>
  )
}
