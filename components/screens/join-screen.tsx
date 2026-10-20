"use client"

import { ArrowLeft, Mic, MicOff, Video, VideoOff } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type FormEvent } from "react"

import { MockVideo } from "@/components/game/mock-video"
import { TrackVideo } from "@/components/game/participant-video"
import { StatusScreen } from "@/components/game/status-screen"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRoom } from "@/lib/room"
import { isValidRoomCode } from "@/lib/room/protocol"
import { useVideo } from "@/lib/video"

import { AppHeader } from "./app-header"

type Step = "name" | "media" | "joining" | JoinFailure
type JoinFailure = "full" | "notFound" | "error"

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

const DEVICE_PROBLEM: Partial<Record<string, string>> = {
  declined: "No camera for now. You can turn it on later from the room.",
  denied:
    "Your browser blocked the camera and mic. Allow them in the address bar to be seen.",
  noDevice: "We couldn't find a camera or microphone.",
  error: "Your camera or mic didn't start. Another app may be using it.",
}

/** Name + camera check, then create a room (no code) or join `code`. */
export function JoinScreen({ code }: { code?: string }) {
  const creating = !code
  const router = useRouter()
  const { ready, session } = useRoom()
  const [step, setStep] = useState<Step>("name")
  const [name, setName] = useState("")
  const [nameError, setNameError] = useState<string | null>(null)
  const { preview } = useVideo()
  const [declined, setDeclined] = useState(false)
  const [mic, setMic] = useState(true)
  const [camera, setCamera] = useState(true)
  const joined = useRef(false)

  // Leaving without joining: let go of the camera. Joining hands the tracks
  // to the call instead, so there's no second permission prompt.
  const stopPreview = preview.stop
  useEffect(
    () => () => {
      if (!joined.current) stopPreview()
    },
    [stopPreview],
  )

  const valid = creating || isValidRoomCode(code)
  const alreadySeated = ready && !!code && session.hasSeat(code)

  // Back on the join page for a room you're already in: go straight there.
  useEffect(() => {
    if (alreadySeated && step === "name") router.replace(`/room/${code}`)
  }, [alreadySeated, step, code, router])

  const deviceReady = preview.status === "ready"
  const asked =
    declined || (preview.status !== "idle" && preview.status !== "requesting")

  async function join() {
    setStep("joining")
    joined.current = true
    const media = {
      mic: deviceReady && preview.hasAudio && mic,
      camera: deviceReady && preview.hasVideo && camera,
    }
    const trimmed = name.trim()
    if (creating) {
      const res = await session.createRoom(trimmed, media)
      if (res.ok) router.replace(`/room/${res.code}`)
      else {
        joined.current = false
        setStep("error")
      }
      return
    }
    const res = await session.joinRoom(code, trimmed, media)
    if (res === "ok") router.replace(`/room/${code}`)
    else {
      joined.current = false
      setStep(res)
    }
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
              {preview.videoTrack && camera ? (
                <TrackVideo track={preview.videoTrack} mirror />
              ) : (
                <MockVideo
                  name={name}
                  colorIndex={0}
                  orientation="landscape"
                  cameraOn={false}
                />
              )}
            </div>

            {!asked && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  size="lg"
                  className="flex-1"
                  disabled={preview.status === "requesting"}
                  onClick={() => void preview.start()}
                >
                  {preview.status === "requesting"
                    ? "Waiting for your browser…"
                    : "Allow camera & mic"}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setDeclined(true)}
                >
                  Not now
                </Button>
              </div>
            )}

            {deviceReady && (
              <div className="flex gap-2">
                <Button
                  variant={mic ? "outline" : "destructive"}
                  disabled={!preview.hasAudio}
                  onClick={() => setMic((v) => !v)}
                  aria-pressed={!mic}
                >
                  {mic ? <Mic aria-hidden /> : <MicOff aria-hidden />}
                  {mic ? "Mic on" : "Muted"}
                </Button>
                <Button
                  variant={camera ? "outline" : "destructive"}
                  disabled={!preview.hasVideo}
                  onClick={() => setCamera((v) => !v)}
                  aria-pressed={!camera}
                >
                  {camera ? <Video aria-hidden /> : <VideoOff aria-hidden />}
                  {camera ? "Camera on" : "Camera off"}
                </Button>
              </div>
            )}

            {deviceReady && (!preview.hasAudio || !preview.hasVideo) && (
              <p className="rounded-xl border-2 border-ink bg-warning-soft p-3 text-sm font-semibold text-warning">
                {preview.hasVideo
                  ? "We couldn't find a microphone. Friends will see you but not hear you."
                  : "We couldn't find a camera. Friends will hear you but not see you."}
              </p>
            )}

            {asked && !deviceReady && (
              <p className="rounded-xl border-2 border-ink bg-warning-soft p-3 text-sm font-semibold text-warning">
                {DEVICE_PROBLEM[declined ? "declined" : preview.status] ??
                  DEVICE_PROBLEM.declined}{" "}
                You can still play, but friends won&apos;t see you.
              </p>
            )}

            <Button
              size="lg"
              variant="secondary"
              disabled={!asked}
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
