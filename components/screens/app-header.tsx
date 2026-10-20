import Link from "next/link"
import type { ReactNode } from "react"

export function Logo() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 rounded-lg font-heading text-2xl font-bold text-ink outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
    >
      <span
        aria-hidden
        className="flex size-9 -rotate-6 items-center justify-center rounded-lg border-2 border-ink bg-secondary text-lg shadow-pop-sm"
      >
        ?
      </span>
      Headbands
    </Link>
  )
}

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <Logo />
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </header>
  )
}
