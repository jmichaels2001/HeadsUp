"use client"

import { ArrowLeft, Mic, MicOff, Video, VideoOff } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, type FormEvent } from "react"

import { MockVideo } from "@/components/game/mock-video"
import { StatusScreen } from "@/components/game/status-screen"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRoom } from "@/lib/room"
import { isValidRoomCode } from "@/lib/room/protocol"

import { AppHeader } from "./app-header"

type Step = "name" | "media" | "joining" | JoinFailure
type JoinFailure = "full" | "notFound" | "error"
type Permission = "prompt" | "granted" | "denied"

const MAX_NAME = 20

const FAILURES: Record<JoinFailure, { title: string; description: string }> = {
  full: {
    title: "This room is full",
    description: "Rooms fit up to 8 players. Ask the host to start a new room.",
  },
  notFound: {
    title: "Room not found",
    description:
      "Check the code with your friends. Rooms disappear if everyone leaves.",
  },
  error: {
    title: "Couldn't connect",
    description: "Something went wrong reaching the game. Try again.",
  },
}

/** Name + camera check, then create a room (no code) or join `code`. */
export function JoinScreen({ code }: { code?: string }) {
  const creating = !code
  const router = useRouter()
  const { ready, session } = useRoom()
  const [step, setStep] = useState<Step>("name")
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState<string | null>(null)
  const [permission, setPermission] = useState<Permission>("prompt")
  const [mic, setMic] = useState(true)
  const [camera, setCamera] = useState(true)

  const valid = creating || isValidRoomCode(code)
  const alreadySeated = ready && !!code && session.hasSeat(code)

  // Back on the join page for a room you're already in: go straight there.
  useEffect(() => {
    if (alreadySeated && step === "name") router.replace(`/room/${code}`)
  }, [alreadySeated, step, code, router])

  async function join() {
    setStep("joining")
    const media = {
      mic: permission === "granted" && mic,
      camera: permission === "granted" && camera,
    }
    const trimmed = name.trim()
    if (creating) {
      const res = await session.createRoom(trimmed, media)
      if (res.ok) router.replace(`/room/${res.code}`)
      else setStep("error")
      return
    }
    const res = await session.joinRoom(code, trimmed, media)
    if (res === "ok") router.replace(`/room/${code}`)
    else setStep(res)
  }

  if (!valid) {
    return (
      <>
        <AppHeader />
        <main className="flex flex-1 items-center px-4 py-10">
          <StatusScreen
            kind="error"
            title="That code doesn't look right"
            description="Room codes are 4 to 6 letters or numbers."
          >
            <Link href="/" className={buttonVariants()}>
              Back home
            </Link>
          </StatusScreen>
        </main>
      </>
    )
  }

  if (step === "joining" || alreadySeated) {
    return (
      <main className="flex flex-1 items-center px-4 py-10">
        <StatusScreen
          kind="loading"
          title={creating ? "Creating your room…" : "Joining room…"}
          description={code ? `Room ${code}` : undefined}
        />
      </main>
    )
  }

  if (step in FAILURES) {
    const failure = FAILURES[step as JoinFailure]
    return (
      <>
        <AppHeader />
        <main className="flex flex-1 items-center px-4 py-10">
          <StatusScreen
            kind="error"
            title={failure.title}
            description={failure.description}
          >
            {step === "error" && (
              <Button onClick={() => void join()}>Try again</Button>
            )}
            <Link
              href="/"
              className={buttonVariants({
                variant: step === "error" ? "outline" : "default",
              })}
            >
              Back home
            </Link>
          </StatusScreen>
        </main>
      </>
    )
  }

  function onName(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setNameError("Pick a name so your friends know who you are.")
      return
    }
    setStep("media")
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 pt-4 pb-16">
        <div>
          <p className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
            {creating ? "New room" : "Joining room"}
          </p>
          {creating ? (
            <p className="font-heading text-4xl font-bold text-ink">
              Start a game
            </p>
          ) : (
            <p className="font-heading text-4xl font-bold tracking-[0.2em] text-ink">
              {code}
            </p>
          )}
        </div>

        {step === "name" ? (
          <form
            onSubmit={onName}
            noValidate
            className="flex flex-col gap-4 rounded-2xl border-2 border-ink bg-card p-5 shadow-pop sm:p-6"
          >
            <h1 className="text-title font-semibold">
              What should we call you?
            </h1>
            <label htmlFor="display-name" className="sr-only">
              Display name
            </label>
            <Input
              id="display-name"
              autoFocus
              value={name}
              maxLength={MAX_NAME}
              onChange={(e) => {
                setName(e.target.value)
                setNameError(null)
              }}
              placeholder="Your name"
              autoComplete="nickname"
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "name-error" : undefined}
            />
            {nameError && (
              <p
                id="name-error"
                className="text-sm font-semibold text-destructive"
              >
                {nameError}
              </p>
            )}
            <Button type="submit" size="lg">
              Continue
            </Button>
          </form>
        ) : (
          <section className="flex flex-col gap-4 rounded-2xl border-2 border-ink bg-card p-5 shadow-pop sm:p-6">
            <button
              type="button"
              onClick={() => setStep("name")}
              className="inline-flex items-center gap-1 self-start text-sm font-semibold text-muted-foreground hover:text-ink"
            >
              <ArrowLeft className="size-4" aria-hidden /> Change name
            </button>
            <h1 className="text-title font-semibold">Camera and mic check</h1>
            <p className="text-muted-foreground">
              Your friends need to see your face to show you your card. Nothing
              is ever recorded.
            </p>

            <div className="aspect-[4/3] overflow-hidden rounded-xl border-2 border-ink">
              <MockVideo
                name={name}
                colorIndex={0}
                orientation="landscape"
                cameraOn={permission === "granted" && camera}
              />
            </div>

            {permission === "prompt" && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={() => setPermission("granted")}
                >
                  Allow camera &amp; mic
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setPermission("denied")}
                >
                  Not now
                </Button>
              </div>
            )}

            {permission === "granted" && (
              <div className="flex gap-2">
                <Button
                  variant={mic ? "outline" : "destructive"}
                  onClick={() => setMic((v) => !v)}
                  aria-pressed={!mic}
                >
                  {mic ? <Mic aria-hidden /> : <MicOff aria-hidden />}
                  {mic ? "Mic on" : "Muted"}
                </Button>
                <Button
                  variant={camera ? "outline" : "destructive"}
                  onClick={() => setCamera((v) => !v)}
                  aria-pressed={!camera}
                >
                  {camera ? <Video aria-hidden /> : <VideoOff aria-hidden />}
                  {camera ? "Camera on" : "Camera off"}
                </Button>
              </div>
            )}

            {permission === "denied" && (
              <p className="rounded-xl border-2 border-ink bg-warning-soft p-3 text-sm font-semibold text-warning">
                You can still play, but friends won&apos;t see you. You can turn
                your camera on later.
              </p>
            )}

            <Button
              size="lg"
              variant="secondary"
              disabled={permission === "prompt"}
              onClick={() => void join()}
            >
              {creating ? "Create room" : "Join room"}
            </Button>
          </section>
        )}
      </main>
    </>
  )
}
