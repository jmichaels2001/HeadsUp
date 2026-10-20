"use client"

import { cn } from "cn"
import { Bug, Eye, UserMinus, UserPlus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { PlayerAvatar } from "@/components/game/player-avatar"
import { Button } from "@/components/ui/button"
import { MAX_PLAYERS, type ConnectionStatus } from "@/lib/game"
import { useRoom, type DevOverlay } from "@/lib/mock/room-provider"

const OVERLAYS: DevOverlay[] = ["none", "loading", "error", "reconnecting"]
const CONNECTIONS: ConnectionStatus[] = [
  "good",
  "poor",
  "reconnecting",
  "offline",
]

/**
 * Dev-only tools: view the game as any player, load 2/4/6/8-player scenarios,
 * fill votes, and force loading/error/reconnecting states. Uses only the
 * viewer projection plus the mock's dev hooks.
 */
export function DevPanel() {
  const router = useRouter()
  const { view, dev, actions, overlay, videoOrientation } = useRoom()
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed top-3 right-3 z-50 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-ink px-3 py-1.5 text-xs font-bold text-background shadow-pop-sm sm:top-auto sm:right-auto sm:bottom-3 sm:left-16"
      >
        <Bug className="size-4" aria-hidden />
        Dev
        {view?.you && <span className="opacity-80">· {view.you.name}</span>}
      </button>
    )
  }

  const voting = view?.round?.turn?.kind === "voting"

  function load(count: number, phase: "lobby" | "playing") {
    dev.loadScenario(count, phase)
    router.push(`/room/${view?.roomCode ?? "DEMO1"}`)
  }

  return (
    <aside
      aria-label="Developer tools"
      className="fixed inset-x-2 bottom-2 z-50 flex max-h-[75vh] flex-col overflow-hidden rounded-2xl border-2 border-ink bg-card text-sm shadow-pop sm:inset-x-auto sm:left-16 sm:w-80"
    >
      <div className="flex items-center justify-between border-b-2 border-ink bg-ink px-3 py-2 text-background">
        <span className="inline-flex items-center gap-1.5 font-bold">
          <Bug className="size-4" aria-hidden /> Dev tools
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close dev tools"
          className="rounded p-0.5 hover:bg-background/20"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto p-3">
        <Section title="Load scenario">
          <div className="grid grid-cols-4 gap-1.5">
            {[2, 4, 6, 8].map((n) => (
              <Button
                key={`p${n}`}
                size="sm"
                onClick={() => load(n, "playing")}
              >
                {n}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Players, round in progress. Lobby:
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {[2, 4, 6, 8].map((n) => (
              <Button
                key={`l${n}`}
                size="sm"
                variant="outline"
                onClick={() => load(n, "lobby")}
              >
                {n}
              </Button>
            ))}
          </div>
        </Section>

        {view && (
          <Section title="View as player">
            <ul className="flex flex-col gap-1">
              {view.players.map((p, i) => (
                <li key={p.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => dev.setViewer(p.id)}
                    aria-pressed={p.isYou}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 rounded-lg border-2 px-2 py-1 text-left font-semibold",
                      p.isYou
                        ? "border-ink bg-secondary"
                        : "border-transparent hover:bg-muted",
                    )}
                  >
                    <PlayerAvatar name={p.name} colorIndex={i} size="sm" />
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {p.isHost ? "host " : ""}
                      {p.isActive ? "turn " : ""}
                      {p.status !== "playing" ? p.status : ""}
                    </span>
                    {p.isYou && (
                      <Eye className="size-4 shrink-0" aria-label="Viewing" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => dev.toggleOrientation(p.id)}
                    className="rounded-md px-1.5 py-1 text-xs font-bold hover:bg-muted"
                    title="Toggle video orientation"
                  >
                    {videoOrientation(p.id) === "portrait" ? "▯" : "▭"}
                  </button>
                  <button
                    type="button"
                    onClick={() => dev.removePlayer(p.id)}
                    className="rounded-md p-1 hover:bg-destructive-soft"
                    aria-label={`Make ${p.name} leave`}
                    title="Make this player leave"
                  >
                    <UserMinus className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="outline"
              disabled={view.players.length >= MAX_PLAYERS}
              onClick={dev.addMockPlayer}
            >
              <UserPlus aria-hidden /> Add player
              {view.phase !== "lobby" && " (late joiner)"}
            </Button>
          </Section>
        )}

        {voting && (
          <Section title="Fill other votes">
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                size="sm"
                variant="success"
                onClick={() => dev.fillVotes("correct")}
              >
                All correct
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => dev.fillVotes("notYet")}
              >
                All not yet
              </Button>
            </div>
          </Section>
        )}

        {view?.you && (
          <Section title={`${view.you.name}'s media`}>
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => actions.setMedia({ mic: !view.you!.media.mic })}
              >
                Mic {view.you.media.mic ? "on" : "off"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  actions.setMedia({ camera: !view.you!.media.camera })
                }
              >
                Cam {view.you.media.camera ? "on" : "off"}
              </Button>
            </div>
            <Segmented
              value={view.you.media.connection}
              options={CONNECTIONS}
              onChange={(connection) => actions.setMedia({ connection })}
            />
          </Section>
        )}

        <Section title="Force screen state">
          <Segmented
            value={overlay}
            options={OVERLAYS}
            onChange={dev.setOverlay}
          />
        </Section>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            dev.reset()
            router.push("/")
          }}
        >
          Reset everything
        </Button>
      </div>
    </aside>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="font-sans text-xs font-bold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: T[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-md border-2 px-2 py-0.5 text-xs font-bold",
            o === value
              ? "border-ink bg-ink text-background"
              : "border-ink/20 hover:bg-muted",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
