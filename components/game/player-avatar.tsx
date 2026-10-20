import { cn } from "cn"

const PLAYER_COLORS = [
  "bg-player-1",
  "bg-player-2",
  "bg-player-3",
  "bg-player-4",
  "bg-player-5",
  "bg-player-6",
  "bg-player-7",
  "bg-player-8",
]

export function playerColor(index: number): string {
  return PLAYER_COLORS[((index % 8) + 8) % 8]
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

export function PlayerAvatar({
  name,
  colorIndex,
  size = "md",
  className,
}: {
  name: string
  colorIndex: number
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border-2 border-ink font-heading font-semibold text-ink",
        playerColor(colorIndex),
        size === "sm" && "size-7 text-xs",
        size === "md" && "size-9 text-sm",
        size === "lg" && "size-20 text-3xl",
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
