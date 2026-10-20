import { cn } from "cn"
import { CircleCheck, Crown } from "lucide-react"

import type { ViewerPlayer } from "@/lib/game"

import { PlayerAvatar } from "./player-avatar"

export function PlayerChip({
  player,
  colorIndex,
  size = "md",
  className,
}: {
  player: Pick<ViewerPlayer, "name" | "isHost" | "isYou" | "status">
  colorIndex: number
  size?: "sm" | "md"
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-2 font-semibold text-ink",
        size === "sm" ? "text-sm" : "text-base",
        className,
      )}
    >
      <PlayerAvatar name={player.name} colorIndex={colorIndex} size={size} />
      <span className="truncate">{player.name}</span>
      {player.isYou && (
        <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-background">
          You
        </span>
      )}
      {player.isHost && (
        <Crown
          className="size-4 shrink-0 fill-secondary text-ink"
          aria-label="Host"
        />
      )}
      {player.status === "solved" && (
        <CircleCheck
          className="size-4 shrink-0 fill-success text-success-foreground"
          aria-label="Solved"
        />
      )}
    </span>
  )
}
