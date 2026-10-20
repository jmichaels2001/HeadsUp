"use client"

import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"

import { CardSlot, SecretCard } from "@/components/game/secret-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { normalizeRoomCode, randomRoomCode } from "@/lib/mock/players"

import { AppHeader } from "./app-header"

const STEPS = [
  {
    title: "Everyone gets a card",
    body: "You can see everyone's card, just not your own.",
  },
  {
    title: "Ask or guess",
    body: "On your turn, ask the group a yes/no question or take a guess.",
  },
  {
    title: "The group decides",
    body: "Everyone votes Correct or Not yet. Majority wins.",
  },
]

export function LandingScreen() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)

  function onJoin(e: FormEvent) {
    e.preventDefault()
    const normalized = normalizeRoomCode(code)
    if (normalized.length < 4) {
      setError("Room codes are 4 to 6 letters.")
      return
    }
    router.push(`/join/${normalized}`)
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-2">
        <section className="flex flex-col gap-6">
          <h1 className="text-display font-bold text-balance text-ink sm:text-[3.75rem]">
            Who am I? <span className="text-primary">Ask your friends.</span>
          </h1>
          <p className="max-w-prose text-lg text-muted-foreground">
            A headbands party game for video calls. Everyone sees your card
            except you. Ask questions, make guesses, and figure out who you are.
          </p>

          <div className="flex flex-col gap-5 rounded-2xl border-2 border-ink bg-card p-5 shadow-pop sm:p-6">
            <Button
              size="xl"
              className="w-full"
              onClick={() => router.push(`/join/${randomRoomCode()}?create=1`)}
            >
              Create a room
            </Button>
            <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
              <span className="h-0.5 flex-1 bg-border" />
              or join with a code
              <span className="h-0.5 flex-1 bg-border" />
            </div>
            <form onSubmit={onJoin} className="flex flex-col gap-2" noValidate>
              <label htmlFor="room-code" className="sr-only">
                Room code
              </label>
              <div className="flex gap-2">
                <Input
                  id="room-code"
                  value={code}
                  onChange={(e) => {
                    setCode(normalizeRoomCode(e.target.value))
                    setError(null)
                  }}
                  placeholder="ABCDE"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  aria-invalid={!!error}
                  aria-describedby={error ? "room-code-error" : undefined}
                  className="font-heading tracking-[0.3em] uppercase"
                />
                <Button type="submit" size="lg" variant="secondary">
                  Join
                </Button>
              </div>
              {error && (
                <p
                  id="room-code-error"
                  className="text-sm font-semibold text-destructive"
                >
                  {error}
                </p>
              )}
            </form>
          </div>
        </section>

        <section aria-label="How to play" className="flex flex-col gap-6">
          <div
            aria-hidden
            className="mx-auto grid w-full max-w-md grid-cols-3 items-end gap-3"
          >
            <SecretCard
              card={{ id: "x1", label: "Penguin", emoji: "🐧" }}
              className="-rotate-6"
            />
            <CardSlot className="-translate-y-4" />
            <SecretCard
              card={{ id: "x2", label: "Pizza", emoji: "🍕" }}
              className="rotate-6"
            />
          </div>
          <ol className="grid gap-3">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex gap-4 rounded-2xl border-2 border-ink bg-card p-4"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-secondary font-heading text-lg font-bold">
                  {i + 1}
                </span>
                <div>
                  <h2 className="text-lg font-semibold">{step.title}</h2>
                  <p className="text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  )
}
