"use client"

import { Plus } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { StatusScreen } from "@/components/game/status-screen"
import { AppHeader } from "@/components/screens/app-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { deckApi } from "@/lib/custom-decks/client"
import type { DeckListItem } from "@/lib/custom-decks/protocol"

/** Decks this browser created or added cards to. */
export function MyDecksScreen() {
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
    // Fetch on mount; the effect only kicks off the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  return (
    <>
      <AppHeader>
        <Link
          href="/library"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Library
        </Link>
        <Link
          href="/decks/generate"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          ✨ Generate
        </Link>
        <Link href="/decks/new" className={buttonVariants({ size: "sm" })}>
          <Plus />
          New deck
        </Link>
      </AppHeader>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pb-16 sm:px-6">
        <div>
          <h1 className="text-title font-bold">My decks</h1>
          <p className="text-muted-foreground">
            Make a deck, then share its link so friends can add cards. Nobody
            sees cards they didn&apos;t add, so everyone can still play.
          </p>
        </div>

        {error ? (
          <StatusScreen kind="error" title="Couldn't load your decks">
            <Button onClick={() => void load()}>Try again</Button>
          </StatusScreen>
        ) : !decks ? (
          <StatusScreen kind="loading" title="Loading decks…" />
        ) : decks.length === 0 ? (
          <StatusScreen
            kind="empty"
            title="No decks yet"
            description="Decks you create or add cards to show up here."
          >
            <Link href="/decks/new" className={buttonVariants()}>
              Create a deck
            </Link>
          </StatusScreen>
        ) : (
          <ul className="grid gap-3">
            {decks.map((deck) => (
              <li key={deck.id}>
                <Link
                  href={`/decks/${deck.id}`}
                  className="flex items-center gap-4 rounded-2xl border-2 border-ink bg-card p-4 shadow-pop-sm outline-none hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring/40"
                >
                  <span aria-hidden className="text-4xl leading-none">
                    {deck.emoji}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-lg font-semibold">
                      {deck.name}
                    </span>
                    {deck.description && (
                      <span className="truncate text-sm text-muted-foreground">
                        {deck.description}
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {deck.totalCardCount} cards · {deck.myCardCount} yours
                    </span>
                  </span>
                  {deck.ai && (
                    <span className="rounded-full border-2 border-ink bg-secondary px-2 py-0.5 text-xs font-bold uppercase">
                      ✨ AI
                    </span>
                  )}
                  {deck.hidden && (
                    <span className="rounded-full border-2 border-ink bg-destructive-soft px-2 py-0.5 text-xs font-bold uppercase">
                      Under review
                    </span>
                  )}
                  {!deck.playable && (
                    <span className="rounded-full border-2 border-ink bg-warning-soft px-2 py-0.5 text-xs font-bold uppercase">
                      Draft
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
