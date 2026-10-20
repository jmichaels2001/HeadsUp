import { cn } from "cn"
import { Check, CircleCheck } from "lucide-react"
import type { ReactNode } from "react"

import type { ViewerPlayer } from "@/lib/game"

import { MediaIndicators } from "./media-indicators"
import { PlayerChip } from "./player-chip"
import { CardSlot, SecretCard, type CardSize } from "./secret-card"

/**
 * One participant: their card "on their headband" above their video.
 * `videoSlot` is where the real video track goes in Phase 3.
 */
export function PlayerTile({
  player,
  colorIndex,
  videoSlot,
  cardSize = "md",
  votingInProgress = false,
  className,
}: {
  player: ViewerPlayer
  colorIndex: number
  videoSlot: ReactNode
  cardSize?: CardSize
  votingInProgress?: boolean
  className?: string
}) {
  const solved = player.status === "solved"

  return (
    <article
      aria-label={`${player.name}${player.isYou ? " (you)" : ""}`}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-2xl border-2 border-ink bg-card p-2 shadow-pop-sm",
        player.isActive &&
          "bg-turn ring-4 ring-turn ring-offset-2 ring-offset-background",
        solved && !player.isActive && "bg-success-soft",
        className,
      )}
    >
      <div className="relative">
        {player.card ? (
          <SecretCard
            card={player.card}
            size={cardSize}
            highlight={solved && player.isYou}
          />
        ) : (
          <CardSlot
            size={cardSize}
            variant={player.cardHidden ? "hidden" : "waiting"}
          />
        )}
        {solved && (
          <span className="absolute -top-2 -right-2 inline-flex items-center gap-1 rounded-full border-2 border-ink bg-success px-2 py-0.5 text-xs font-bold text-success-foreground">
            <CircleCheck className="size-3.5" aria-hidden />
            Solved
          </span>
        )}
      </div>

      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border-2 border-ink lg:aspect-video">
        {videoSlot}
        {player.isActive && (
          <span className="absolute top-2 left-2 rounded-full border-2 border-ink bg-turn px-2 py-0.5 text-xs font-bold text-ink">
            {player.isYou ? "Your turn" : "Their turn"}
          </span>
        )}
        {votingInProgress &&
          !player.isGuesser &&
          player.status !== "waiting" && (
            <span
              className={cn(
                "absolute top-2 right-2 inline-flex items-center gap-1 rounded-full border-2 border-ink px-2 py-0.5 text-xs font-bold",
                player.hasVoted
                  ? "bg-card text-ink"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {player.hasVoted ? (
                <>
                  <Check className="size-3.5" aria-hidden /> Voted
                </>
              ) : (
                "Voting…"
              )}
            </span>
          )}
        <MediaIndicators
          media={player.media}
          className="absolute right-2 bottom-2"
        />
      </div>

      <PlayerChip
        player={player}
        colorIndex={colorIndex}
        size="sm"
        className="px-1"
      />
    </article>
  )
}
