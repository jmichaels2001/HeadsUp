"use client"

import { cn } from "cn"
import { Check, ExternalLink, RefreshCw } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState, type ReactNode } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { deckApi } from "@/lib/custom-decks/client"
import {
  MIN_PLAYABLE_CARDS,
  type DeckListItem,
} from "@/lib/custom-decks/protocol"
import { getDeckSummaries } from "@/lib/decks"
import type { ViewerState } from "@/lib/game"
import { useRoom } from "@/lib/room"

const BUILT_IN = getDeckSummaries()
const isBuiltIn = (id: string | undefined) => BUILT_IN.some((d) => d.id === id)

type Tab = "builtIn" | "mine"

/** The lobby's category picker: built-in decks and the host's own decks. */
export function DeckPicker({ view }: { view: ViewerState }) {
  const { actions, backend } = useRoom()
  const selectedId = view.category?.id
  const [tab, setTab] = useState<Tab>(
    !selectedId || isBuiltIn(selectedId) ? "builtIn" : "mine",
  )
  const host = view.players.find((p) => p.isHost)

  return (
    <div className="rounded-2xl border-2 border-ink bg-card p-4 shadow-pop-sm sm:p-5">
      <h2 className="mb-1 text-xl font-semibold">Category</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {view.isHost
          ? "Pick the deck everyone's cards come from."
          : `${host?.name ?? "The host"} picks the deck.`}
      </p>

      {view.isHost && (
        <div
          role="tablist"
          aria-label="Deck source"
          className="mb-4 grid grid-cols-2 gap-1 rounded-xl border-2 border-ink bg-muted p-1"
        >
          {(
            [
              ["builtIn", "Built-in"],
              ["mine", "My decks"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "rounded-lg px-3 py-1.5 font-heading font-semibold outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
                tab === id ? "bg-card shadow-pop-sm" : "hover:bg-card/60",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!view.isHost && view.category && !isBuiltIn(selectedId) ? (
        <DeckGrid>
          <DeckTile
            emoji={view.category.emoji}
            name={view.category.name}
            detail={`${view.category.cardCount} cards`}
            selected
            disabled
          />
        </DeckGrid>
      ) : tab === "builtIn" || !view.isHost ? (
        <DeckGrid>
          {BUILT_IN.map((deck) => (
            <DeckTile
              key={deck.id}
              emoji={deck.emoji}
              name={deck.name}
              description={deck.description}
              detail={`${deck.cardCount} cards`}
              warn={deck.cardCount < view.players.length}
              selected={selectedId === deck.id}
              disabled={!view.isHost}
              onSelect={() => actions.selectCategory(deck.id)}
            />
          ))}
        </DeckGrid>
      ) : backend === "mock" ? (
        <p className="rounded-xl bg-muted p-3 text-sm font-semibold">
          Your own decks need server mode.
        </p>
      ) : (
        <MyDecks view={view} onSelect={(id) => actions.selectCategory(id)} />
      )}
    </div>
  )
}

function MyDecks({
  view,
  onSelect,
}: {
  view: ViewerState
  onSelect: (id: string) => void
}) {
  const [decks, setDecks] = useState<DeckListItem[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      setDecks(await deckApi.listMine())
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    // Fetch on mount and whenever the host comes back from editing a deck.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    const onFocus = () => void load()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [load])

  const makeDeck = (
    <Link
      href="/decks/new"
      target="_blank"
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      <ExternalLink />
      Make a deck
    </Link>
  )

  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
        Couldn&apos;t load your decks.
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    )
  }
  if (!decks) {
    return <p className="text-sm text-muted-foreground">Loading decks…</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {decks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No decks yet. Make one, have friends add cards, then pick it here.
        </p>
      ) : (
        <DeckGrid>
          {decks.map((deck) => (
            <DeckTile
              key={deck.id}
              emoji={deck.emoji}
              name={deck.name}
              description={deck.description}
              detail={
                deck.playable
                  ? `${deck.totalCardCount} cards · ${deck.myCardCount} yours`
                  : `Draft: ${deck.totalCardCount}/${MIN_PLAYABLE_CARDS} cards`
              }
              warn={!deck.playable}
              selected={view.category?.id === deck.id}
              disabled={!deck.playable}
              onSelect={() => onSelect(deck.id)}
            />
          ))}
        </DeckGrid>
      )}
      <div className="flex flex-wrap gap-2">
        {makeDeck}
        <Button size="sm" variant="ghost" onClick={() => void load()}>
          <RefreshCw />
          Refresh
        </Button>
      </div>
    </div>
  )
}

function DeckGrid({ children }: { children: ReactNode }) {
  return (
    <div
      role="radiogroup"
      aria-label="Category"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {children}
    </div>
  )
}

function DeckTile({
  emoji,
  name,
  description,
  detail,
  warn,
  selected,
  disabled,
  onSelect,
}: {
  emoji: string
  name: string
  description?: string
  detail: string
  warn?: boolean
  selected: boolean
  disabled?: boolean
  onSelect?: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-xl border-2 border-ink p-3 text-left transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:cursor-default",
        selected
          ? "bg-secondary shadow-pop-sm"
          : "bg-background enabled:hover:bg-muted",
        !selected && disabled && "opacity-60",
      )}
    >
      <span aria-hidden className="text-3xl leading-none">
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 font-heading text-lg font-semibold">
          <span className="truncate">{name}</span>
          {selected && <Check className="size-4 shrink-0" aria-hidden />}
        </span>
        {description && (
          <span className="block text-sm text-muted-foreground">
            {description}
          </span>
        )}
        <span
          className={cn(
            "mt-1 block text-xs font-bold",
            warn ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {detail}
        </span>
      </span>
    </button>
  )
}
