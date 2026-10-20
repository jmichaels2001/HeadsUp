"use client"

import { cn } from "cn"
import {
  Check,
  Copy,
  Keyboard,
  Mic,
  TriangleAlert,
  UserPlus,
} from "lucide-react"
import { useState } from "react"

import { MediaIndicators } from "@/components/game/media-indicators"
import { PlayerChip } from "@/components/game/player-chip"
import { Button } from "@/components/ui/button"
import { MAX_PLAYERS, type StartBlocker, type ViewerState } from "@/lib/game"
import { getDeckSummaries } from "@/lib/mock/decks"
import { useRoom } from "@/lib/mock/room-provider"

import { RoomHeader } from "./room-header"

const DECKS = getDeckSummaries()

const QUESTION_MODES = [
  {
    id: "type",
    label: "Type",
    icon: Keyboard,
    description: "Type the question; everyone taps Yes or No.",
  },
  {
    id: "voice",
    label: "Voice",
    icon: Mic,
    description: "Ask out loud; end your turn when you've heard.",
  },
] as const

export function startBlockerMessage(
  blocker: StartBlocker | null,
  view: ViewerState,
): string | null {
  switch (blocker) {
    case "noCategory":
      return "Pick a category to start."
    case "notEnoughPlayers":
      return "You need at least 2 players to start."
    case "tooManyPlayers":
      return `Rooms fit up to ${MAX_PLAYERS} players.`
    case "notEnoughCards":
      return `${view.category?.name} has ${view.category?.cardCount} cards, but there are ${view.players.length} players.`
    default:
      return null
  }
}

export function NeedMoreCardsAlert({ view }: { view: ViewerState }) {
  if (view.startBlocker !== "notEnoughCards") return null
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-xl border-2 border-ink bg-warning-soft p-4 text-warning"
    >
      <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        <p className="font-heading text-lg font-semibold">Need more cards</p>
        <p className="text-sm font-semibold">
          {startBlockerMessage("notEnoughCards", view)}{" "}
          {view.isHost
            ? "Pick a bigger deck to start."
            : "The host needs to pick a bigger deck."}
        </p>
      </div>
    </div>
  )
}

export function LobbyScreen({ view }: { view: ViewerState }) {
  const { actions, session } = useRoom()
  const host = view.players.find((p) => p.isHost)
  const openSeats = MAX_PLAYERS - view.players.length
  const alone = view.players.length === 1
  const blockerText = startBlockerMessage(view.startBlocker, view)

  return (
    <>
      <RoomHeader view={view} onLeave={session.leaveRoom} />
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="flex flex-col gap-4">
          <InviteCard code={view.roomCode} />

          <div className="rounded-2xl border-2 border-ink bg-card p-4 shadow-pop-sm sm:p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-xl font-semibold">Players</h2>
              <span className="text-sm font-bold text-muted-foreground">
                {view.players.length}/{MAX_PLAYERS}
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {view.players.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl border-2 border-ink/15 bg-background px-3 py-2"
                >
                  <PlayerChip player={p} colorIndex={i} />
                  <MediaIndicators media={p.media} />
                </li>
              ))}
              {Array.from({ length: openSeats }, (_, i) => (
                <li
                  key={`open-${i}`}
                  className="flex items-center gap-2 rounded-xl border-2 border-dashed border-ink/20 px-3 py-2 text-sm font-semibold text-muted-foreground"
                >
                  <UserPlus className="size-4" aria-hidden />
                  Open seat
                </li>
              ))}
            </ul>
            {alone && (
              <p className="mt-4 rounded-xl bg-secondary/60 p-3 text-sm font-semibold text-ink">
                It&apos;s just you so far. Share the invite link to bring
                friends in.
              </p>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="rounded-2xl border-2 border-ink bg-card p-4 shadow-pop-sm sm:p-5">
            <h2 className="mb-1 text-xl font-semibold">Category</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {view.isHost
                ? "Pick the deck everyone's cards come from."
                : `${host?.name ?? "The host"} picks the deck.`}
            </p>
            <div
              role="radiogroup"
              aria-label="Category"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {DECKS.map((deck) => {
                const selected = view.category?.id === deck.id
                const tooSmall = deck.cardCount < view.players.length
                return (
                  <button
                    key={deck.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!view.isHost}
                    onClick={() => actions.selectCategory(deck.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border-2 border-ink p-3 text-left transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:cursor-default",
                      selected
                        ? "bg-secondary shadow-pop-sm"
                        : "bg-background enabled:hover:bg-muted",
                      !selected && !view.isHost && "opacity-60",
                    )}
                  >
                    <span aria-hidden className="text-3xl leading-none">
                      {deck.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 font-heading text-lg font-semibold">
                        {deck.name}
                        {selected && <Check className="size-4" aria-hidden />}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {deck.description}
                      </span>
                      <span
                        className={cn(
                          "mt-1 block text-xs font-bold",
                          tooSmall
                            ? "text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {deck.cardCount} cards
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-ink bg-card p-4 shadow-pop-sm sm:p-5">
            <h2 className="mb-3 text-xl font-semibold">House rules</h2>
            <fieldset className="mb-4">
              <legend className="mb-2 font-semibold">Questions</legend>
              <div
                role="radiogroup"
                aria-label="Question mode"
                className="grid grid-cols-2 gap-2"
              >
                {QUESTION_MODES.map((m) => {
                  const selected = view.settings.questionMode === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!view.isHost}
                      onClick={() =>
                        actions.updateSettings({ questionMode: m.id })
                      }
                      className={cn(
                        "flex flex-col items-start gap-0.5 rounded-xl border-2 border-ink p-3 text-left outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:cursor-default",
                        selected
                          ? "bg-secondary shadow-pop-sm"
                          : "bg-background enabled:hover:bg-muted",
                        !selected && !view.isHost && "opacity-60",
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5 font-heading text-lg font-semibold">
                        <m.icon className="size-4" aria-hidden />
                        {m.label}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {m.description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-5 accent-primary"
                checked={view.settings.passAfterQuestion}
                disabled={!view.isHost}
                onChange={(e) =>
                  actions.updateSettings({
                    passAfterQuestion: e.target.checked,
                  })
                }
              />
              <span>
                <span className="block font-semibold">
                  Pass the turn after each question
                </span>
                <span className="block text-sm text-muted-foreground">
                  Off: keep asking until you make a guess. A wrong guess always
                  passes the turn.
                </span>
              </span>
            </label>
          </div>

          <NeedMoreCardsAlert view={view} />

          {view.isHost ? (
            <div className="flex flex-col gap-2">
              <Button
                size="xl"
                disabled={view.startBlocker !== null}
                onClick={actions.startRound}
                aria-describedby={blockerText ? "start-blocker" : undefined}
              >
                Start game
              </Button>
              {blockerText && view.startBlocker !== "notEnoughCards" && (
                <p
                  id="start-blocker"
                  className="text-center text-sm font-semibold text-muted-foreground"
                >
                  {blockerText}
                </p>
              )}
            </div>
          ) : (
            <p
              role="status"
              className="rounded-xl border-2 border-dashed border-ink/30 p-4 text-center font-semibold text-muted-foreground"
            >
              Waiting for {host?.name ?? "the host"} to start the game…
            </p>
          )}
        </section>
      </main>
    </>
  )
}

function InviteCard({ code }: { code: string }) {
  const [copied, setCopied] = useState<"link" | "error" | null>(null)

  async function copy() {
    const url = `${window.location.origin}/join/${code}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied("link")
    } catch {
      setCopied("error")
    }
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-ink bg-primary p-4 text-primary-foreground shadow-pop sm:p-5">
      <div>
        <p className="text-sm font-bold tracking-wide uppercase opacity-90">
          Room code
        </p>
        <p className="font-heading text-4xl font-bold tracking-[0.2em]">
          {code}
        </p>
      </div>
      <Button variant="secondary" onClick={copy} aria-live="polite">
        {copied === "link" ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied === "link"
          ? "Link copied!"
          : copied === "error"
            ? "Couldn't copy"
            : "Copy invite link"}
      </Button>
    </div>
  )
}
