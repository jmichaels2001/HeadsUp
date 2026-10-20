"use client"

import { cn } from "cn"
import { CircleCheck, CircleX } from "lucide-react"

import { PlayerVideo } from "@/components/game/participant-video"
import { PlayerChip } from "@/components/game/player-chip"
import { SecretCard } from "@/components/game/secret-card"
import { Button } from "@/components/ui/button"
import type { ViewerState } from "@/lib/game"
import { useRoom } from "@/lib/room"

import { NeedMoreCardsAlert } from "./lobby-screen"
import { RoomHeader } from "./room-header"

export function RoundEndScreen({ view }: { view: ViewerState }) {
  const { actions, session } = useRoom()
  const round = view.round!
  const host = view.players.find((p) => p.isHost)
  const dealt = view.players.filter((p) => p.card)

  return (
    <>
      <RoomHeader view={view} onLeave={session.leaveRoom} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-16 sm:px-6">
        <div className="text-center">
          <p className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
            Round {round.number}
            {round.endedEarly ? " · ended early" : " · complete"}
          </p>
          <h1 className="text-display font-bold">The big reveal</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            {round.solvedCount} of {round.playerCount} players figured it out.
          </p>
        </div>

        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {dealt.map((p) => {
            const solved = p.status === "solved"
            const colorIndex = view.players.indexOf(p)
            return (
              <li
                key={p.id}
                className={cn(
                  "flex flex-col items-center gap-3 rounded-2xl border-2 border-ink p-3 shadow-pop-sm",
                  solved ? "bg-success-soft" : "bg-card",
                )}
              >
                <SecretCard card={p.card!} size="md" highlight={p.isYou} />
                <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border-2 border-ink">
                  <PlayerVideo player={p} colorIndex={colorIndex} />
                </div>
                <PlayerChip player={p} colorIndex={colorIndex} size="sm" />
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-bold",
                    solved ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {solved ? (
                    <CircleCheck className="size-4" aria-hidden />
                  ) : (
                    <CircleX className="size-4" aria-hidden />
                  )}
                  {solved ? "Guessed it" : "Didn't get it"}
                </span>
              </li>
            )
          })}
        </ul>

        <div className="mx-auto flex w-full max-w-md flex-col gap-3">
          <NeedMoreCardsAlert view={view} />
          {view.isHost ? (
            <>
              <Button
                size="xl"
                disabled={view.startBlocker !== null}
                onClick={actions.nextRound}
              >
                Next round
              </Button>
              <Button size="lg" variant="outline" onClick={actions.backToLobby}>
                Back to lobby
              </Button>
            </>
          ) : (
            <p
              role="status"
              className="rounded-xl border-2 border-dashed border-ink/30 p-4 text-center font-semibold text-muted-foreground"
            >
              Waiting for {host?.name ?? "the host"} to start the next round…
            </p>
          )}
        </div>
      </main>
    </>
  )
}
