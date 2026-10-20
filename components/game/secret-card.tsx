import { cn } from "cn"

import type { Card } from "@/lib/game"

export type CardSize = "sm" | "md" | "lg"

const frame = {
  sm: "min-h-16 rounded-xl px-2 py-1.5 gap-0.5",
  md: "min-h-20 rounded-xl px-3 py-2 gap-1",
  lg: "min-h-36 rounded-2xl px-5 py-4 gap-2",
} satisfies Record<CardSize, string>

const emojiSize = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-5xl",
} satisfies Record<CardSize, string>

const imageSize = {
  sm: "h-10",
  md: "h-14",
  lg: "h-28",
} satisfies Record<CardSize, string>

const labelSize = {
  sm: "text-sm",
  md: "text-label",
  lg: "text-title",
} satisfies Record<CardSize, string>

/** A face-up card. Only ever rendered with a card the viewer may see. */
export function SecretCard({
  card,
  size = "md",
  highlight,
  className,
}: {
  card: Card
  size?: CardSize
  /** Celebrate a freshly revealed card. */
  highlight?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center border-2 border-ink bg-card text-center text-ink shadow-pop",
        highlight && "bg-secondary",
        frame[size],
        className,
      )}
    >
      {card.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- card images are resized on upload
        <img
          src={card.imageUrl}
          alt=""
          className={cn("w-auto max-w-full object-contain", imageSize[size])}
        />
      ) : (
        card.emoji && (
          <span aria-hidden className={cn("leading-none", emojiSize[size])}>
            {card.emoji}
          </span>
        )
      )}
      <span
        className={cn(
          "font-heading font-semibold text-balance break-words",
          labelSize[size],
        )}
      >
        {card.label}
      </span>
    </div>
  )
}

/**
 * Placeholder where a card would be: the viewer's own hidden card ("?"),
 * or an empty slot for a player waiting for the next round.
 */
export function CardSlot({
  variant = "hidden",
  size = "md",
  className,
}: {
  variant?: "hidden" | "waiting"
  size?: CardSize
  className?: string
}) {
  return (
    <div
      role="img"
      aria-label={
        variant === "hidden" ? "Your card (hidden)" : "No card this round"
      }
      className={cn(
        "flex w-full flex-col items-center justify-center border-2 border-dashed border-ink/50 text-center",
        variant === "hidden"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground",
        frame[size],
        className,
      )}
    >
      {variant === "hidden" ? (
        <>
          <span
            aria-hidden
            className={cn(
              "font-heading leading-none font-bold",
              size === "lg"
                ? "text-6xl"
                : size === "md"
                  ? "text-4xl"
                  : "text-2xl",
            )}
          >
            ?
          </span>
          {size !== "sm" && (
            <span className="text-xs font-bold tracking-wide uppercase">
              Your card
            </span>
          )}
        </>
      ) : (
        <span className="text-xs font-bold tracking-wide uppercase">
          Joins next round
        </span>
      )}
    </div>
  )
}
