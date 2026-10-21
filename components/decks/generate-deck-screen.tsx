"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { AppHeader } from "@/components/screens/app-header"
import { buttonVariants } from "@/components/ui/button"

import { GenerateDeckForm } from "./generate-deck-form"

export function GenerateDeckScreen() {
  const router = useRouter()
  return (
    <>
      <AppHeader>
        <Link
          href="/decks"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          My decks
        </Link>
      </AppHeader>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pb-16 sm:px-6">
        <div>
          <h1 className="text-title font-bold">Generate a deck with AI</h1>
          <p className="text-muted-foreground">
            Describe a theme and Claude writes the cards. You won&apos;t see
            them, so you can play the deck yourself. Friends can still add their
            own cards afterwards.
          </p>
        </div>
        <div className="rounded-2xl border-2 border-ink bg-card p-5 shadow-pop">
          <GenerateDeckForm
            onGenerated={(deck) => router.push(`/decks/${deck.id}`)}
          />
        </div>
      </main>
    </>
  )
}
