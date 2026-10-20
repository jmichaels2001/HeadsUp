"use client"

import { cn } from "cn"
import { Search } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deckApi } from "@/lib/custom-decks/client"
import type { LibraryItem, LibrarySort } from "@/lib/custom-decks/protocol"

const SEARCH_DELAY_MS = 250

/** Search + sort over the public library; the caller renders each deck. */
export function LibraryBrowser({
  renderItem,
  label,
  className,
}: {
  renderItem: (item: LibraryItem) => ReactNode
  /** Makes the list a radio group (for pickers), named by this label. */
  label?: string
  className?: string
}) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<LibrarySort>("newest")
  const [items, setItems] = useState<LibraryItem[] | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(
      async () => {
        try {
          const result = await deckApi.library(query, sort)
          if (!cancelled) {
            setItems(result)
            setError(false)
          }
        } catch {
          if (!cancelled) setError(true)
        }
      },
      query ? SEARCH_DELAY_MS : 0,
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, sort, attempt])

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Search decks</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            placeholder="Search decks"
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-10 text-base"
          />
        </label>
        <div
          role="radiogroup"
          aria-label="Sort"
          className="flex rounded-xl border-2 border-ink bg-muted p-1"
        >
          {(
            [
              ["newest", "Newest"],
              ["popular", "Most played"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={sort === id}
              onClick={() => setSort(id)}
              className={cn(
                "rounded-lg px-3 text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
                sort === id ? "bg-card shadow-pop-sm" : "hover:bg-card/60",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
          Couldn&apos;t load the library.
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAttempt((n) => n + 1)}
          >
            Try again
          </Button>
        </div>
      ) : !items ? (
        <p className="text-sm text-muted-foreground">Loading decks…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {query
            ? `No decks match “${query}”.`
            : "No decks in the library yet. Decks show up here once they have 10 cards."}
        </p>
      ) : (
        <div
          role={label ? "radiogroup" : "list"}
          aria-label={label}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {items.map((item) => (
            <div
              key={item.id}
              role={label ? undefined : "listitem"}
              className="flex"
            >
              {renderItem(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function libraryDetail(item: LibraryItem): string {
  const plays =
    item.playCount === 1 ? "played once" : `played ${item.playCount} times`
  return `${item.cardCount} cards · ${plays}`
}
