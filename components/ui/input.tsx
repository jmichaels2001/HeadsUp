import { cn } from "cn"
import type { ComponentProps } from "react"

function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-xl border-2 border-ink bg-card px-4 text-lg text-ink outline-none placeholder:text-muted-foreground focus-visible:ring-4 focus-visible:ring-ring/40 disabled:opacity-50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
