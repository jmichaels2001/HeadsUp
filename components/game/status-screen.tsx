import { cn } from "cn"
import { CircleX, LoaderCircle, RefreshCw, Users } from "lucide-react"
import type { ReactNode } from "react"

export type StatusKind = "empty" | "loading" | "error" | "reconnecting"

const ICONS = {
  empty: Users,
  loading: LoaderCircle,
  error: CircleX,
  reconnecting: RefreshCw,
} satisfies Record<StatusKind, unknown>

/** Full-panel empty / loading / error / reconnecting state. */
export function StatusScreen({
  kind,
  title,
  description,
  children,
  className,
}: {
  kind: StatusKind
  title: string
  description?: string
  children?: ReactNode
  className?: string
}) {
  const Icon = ICONS[kind]
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border-2 border-ink bg-card p-8 text-center shadow-pop",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-16 items-center justify-center rounded-full border-2 border-ink",
          kind === "error" && "bg-destructive-soft text-destructive",
          kind === "empty" && "bg-secondary text-ink",
          (kind === "loading" || kind === "reconnecting") &&
            "bg-primary/10 text-primary",
        )}
      >
        <Icon
          className={cn(
            "size-8",
            (kind === "loading" || kind === "reconnecting") &&
              "animate-spin [animation-duration:1.6s] motion-reduce:animate-none",
          )}
          aria-hidden
        />
      </span>
      <h2 className="text-title font-semibold text-ink">{title}</h2>
      {description && <p className="text-muted-foreground">{description}</p>}
      {children && (
        <div className="flex flex-wrap justify-center gap-3">{children}</div>
      )}
    </div>
  )
}

/** Thin banner shown over the room while your connection recovers. */
export function ReconnectingBanner() {
  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 border-b-2 border-ink bg-warning-soft px-4 py-2 text-sm font-bold text-warning"
    >
      <RefreshCw
        className="size-4 animate-spin [animation-duration:1.6s] motion-reduce:animate-none"
        aria-hidden
      />
      Reconnecting… your game is safe, hang tight.
    </div>
  )
}
