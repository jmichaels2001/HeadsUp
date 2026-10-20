"use client"

import { cn } from "cn"
import { Flag } from "lucide-react"
import { useState } from "react"

import { MockVideo } from "@/components/game/mock-video"
import { PlayerTile } from "@/components/game/player-tile"
import { Button } from "@/components/ui/button"
import type { ViewerPlayer, ViewerState } from "@/lib/game"
import { useRoom } from "@/lib/mock/room-provider"

import { ActionBar } from "./action-bar"
import { RoomHeader } from "./room-header"

/** Grid columns tuned for 2 to 8 players on phone and desktop. */
export function gridClassFor(count: number): string {
  if (count <= 2) return "grid-cols-2 max-w-3xl"
  if (count === 3) return "grid-cols-2 sm:grid-cols-3 max-w-5xl"
  if (count === 4) return "grid-cols-2 lg:grid-cols-4"
  if (count <= 6) return "grid-cols-2 sm:grid-cols-3 max-w-5xl"
  return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
}

export function GameScreen({ view }: { view: ViewerState }) {
  const { session, actions } = useRoom()
  const round = view.round!
  const voting = round.turn?.kind === "voting"

  return (
    <>
      <RoomHeader view={view} onLeave={session.leaveRoom}>
        {view.isHost && <EndRoundButton onConfirm={actions.endRound} />}
      </RoomHeader>

      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pb-3 sm:px-6">
        <p className="font-heading text-lg font-semibold">
          Round {round.number}
          {view.category && (
            <span className="text-muted-foreground">
              {" "}
              · {view.category.emoji} {view.category.name}
            </span>
          )}
        </p>
        <p className="text-sm font-bold text-muted-foreground">
          {round.solvedCount}/{round.playerCount} solved
        </p>
      </div>

      <main className="flex-1 px-4 pb-6 sm:px-6">
        <TileGrid view={view} votingInProgress={voting} />
      </main>

      <ActionBar view={view} />
    </>
  )
}

export function TileGrid({
  view,
  votingInProgress = false,
}: {
  view: ViewerState
  votingInProgress?: boolean
}) {
  const { videoOrientation } = useRoom()
  return (
    <ul
      className={cn(
        "mx-auto grid w-full gap-3 sm:gap-4",
        gridClassFor(view.players.length),
      )}
    >
      {view.players.map((p, i) => (
        <li key={p.id} className="min-w-0">
          <PlayerTile
            player={p}
            colorIndex={i}
            votingInProgress={votingInProgress}
            videoSlot={
              <MockVideo
                name={p.name}
                colorIndex={i}
                orientation={videoOrientation(p.id)}
                cameraOn={p.media.camera}
              />
            }
          />
        </li>
      ))}
    </ul>
  )
}

function EndRoundButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <Button size="sm" variant="destructive" onClick={onConfirm}>
          End round now
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </span>
    )
  }
  return (
    <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
      <Flag aria-hidden />
      End round
    </Button>
  )
}

export function nameOf(view: ViewerState, id: string): string {
  const p = view.players.find((x) => x.id === id)
  return p ? (p.isYou ? "You" : p.name) : "Someone"
}

export function playerById(
  view: ViewerState,
  id: string,
): ViewerPlayer | undefined {
  return view.players.find((p) => p.id === id)
}
