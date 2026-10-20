"use client"

import { useEffect } from "react"

import { StatusScreen } from "@/components/game/status-screen"
import { Button } from "@/components/ui/button"

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex flex-1 items-center px-4 py-10">
      <StatusScreen
        kind="error"
        title="Something went wrong"
        description="The game hit a snag. Try again, and if it keeps happening, reload the page."
      >
        <Button onClick={() => retry()}>Try again</Button>
      </StatusScreen>
    </main>
  )
}
