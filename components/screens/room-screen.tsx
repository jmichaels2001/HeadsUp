"use client"

import Link from "next/link"
import { useMemo } from "react"

import { CallNotices } from "@/components/game/call-controls"
import {
  ReconnectingBanner,
  StatusScreen,
} from "@/components/game/status-screen"
import { buttonVariants } from "@/components/ui/button"
import { useRoom } from "@/lib/room"
import { useVideo, withCallMedia } from "@/lib/video"

import { AppHeader } from "./app-header"
import { GameScreen } from "./game-screen"
import { LobbyScreen } from "./lobby-screen"
import { RoundEndScreen } from "./round-end-screen"

export function RoomScreen({ code }: { code: string }) {
  const {
    ready,
    status,
    view: roomView,
    overlay,
    reconnecting: dropped,
  } = useRoom()
  const call = useVideo()
  // Live mic/camera/link state from the call, on top of the room's view.
  const view = useMemo(
    () =>
      roomView && withCallMedia(roomView, call.callMedia, call.reconnecting),
    [roomView, call.callMedia, call.reconnecting],
  )

  if (!ready || overlay === "loading" || (status === "loading" && !view)) {
    return (
      <Centered>
        <StatusScreen
          kind="loading"
          title="Loading room…"
          description={`Room ${code}`}
        />
      </Centered>
    )
  }

  if (status === "notFound") {
    return (
      <Centered header>
        <StatusScreen
          kind="error"
          title="Room not found"
          description={`Room ${code} doesn't exist anymore. Rooms close when everyone leaves.`}
        >
          <Link href="/" className={buttonVariants()}>
            Back home
          </Link>
        </StatusScreen>
      </Centered>
    )
  }

  if (overlay === "error" || status === "error") {
    return (
      <Centered header>
        <StatusScreen
          kind="error"
          title="Something went wrong"
          description="We couldn't load this room. Check your connection and try again."
        >
          <Link href={`/room/${code}`} className={buttonVariants()}>
            Try again
          </Link>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Back home
          </Link>
        </StatusScreen>
      </Centered>
    )
  }

  if (!view || view.roomCode !== code || !view.you) {
    return (
      <Centered header>
        <StatusScreen
          kind="error"
          title="You're not in this room yet"
          description={`Room ${code} isn't open on this device. Join with a name to hop in.`}
        >
          <Link href={`/join/${code}`} className={buttonVariants()}>
            Join room {code}
          </Link>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Back home
          </Link>
        </StatusScreen>
      </Centered>
    )
  }

  const reconnecting =
    dropped ||
    overlay === "reconnecting" ||
    roomView?.you?.media.connection === "reconnecting"

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {reconnecting && <ReconnectingBanner />}
      <CallNotices />
      <div
        className="flex flex-1 flex-col"
        aria-busy={reconnecting}
        inert={reconnecting || undefined}
      >
        {view.phase === "lobby" && <LobbyScreen view={view} />}
        {view.phase === "playing" && <GameScreen view={view} />}
        {view.phase === "roundEnd" && <RoundEndScreen view={view} />}
      </div>
    </div>
  )
}

function Centered({
  children,
  header,
}: {
  children: React.ReactNode
  header?: boolean
}) {
  return (
    <>
      {header && <AppHeader />}
      <main className="flex flex-1 items-center px-4 py-10">{children}</main>
    </>
  )
}
