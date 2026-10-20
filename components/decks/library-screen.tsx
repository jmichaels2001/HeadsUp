"use client"

import { Plus } from "lucide-react"
import Link from "next/link"

import { AppHeader } from "@/components/screens/app-header"
import { buttonVariants } from "@/components/ui/button"

import { LibraryBrowser, libraryDetail } from "./library-browser"
import { ReportDeck } from "./report-deck"

/** Everyone's playable decks. Open one to add your own cards to it. */
export function LibraryScreen() {
  return (
    <>
      <AppHeader>
        <Link
          href="/decks"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          My decks
        </Link>
        <Link href="/decks/new" className={buttonVariants({ size: "sm" })}>
          <Plus />
          New deck
        </Link>
      </AppHeader>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-16 sm:px-6">
        <div>
          <h1 className="text-title font-bold">Deck library</h1>
          <p className="text-muted-foreground">
            Every deck with at least 10 cards. You won&apos;t see a deck&apos;s
            cards here, so you can still play it. Open one to add your own.
          </p>
        </div>
        <LibraryBrowser
          renderItem={(item) => (
            <div className="flex w-full flex-col gap-2 rounded-2xl border-2 border-ink bg-card p-4 shadow-pop-sm">
              <Link
                href={`/decks/${item.id}`}
                className="flex items-start gap-3 rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
              >
                <span aria-hidden className="text-3xl leading-none">
                  {item.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-heading text-lg font-semibold">
                    {item.name}
                  </span>
                  {item.description && (
                    <span className="block text-sm text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                  <span className="mt-1 block text-xs font-bold text-muted-foreground">
                    {libraryDetail(item)}
                  </span>
                </span>
              </Link>
              <div className="flex justify-end">
                <ReportDeck deckId={item.id} name={item.name} />
              </div>
            </div>
          )}
        />
      </main>
    </>
  )
}
