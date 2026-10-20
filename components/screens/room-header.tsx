"use client"

import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import type { ViewerState } from "@/lib/game"

import { AppHeader } from "./app-header"

export function RoomHeader({
  view,
  onLeave,
  children,
}: {
  view: ViewerState
  onLeave: () => void
  children?: ReactNode
}) {
  const router = useRouter()
  return (
    <AppHeader>
      <span className="rounded-full border-2 border-ink bg-card px-3 py-1 font-heading font-semibold tracking-widest">
        {view.roomCode}
      </span>
      {children}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onLeave()
          router.push("/")
        }}
      >
        <LogOut aria-hidden />
        Leave
      </Button>
    </AppHeader>
  )
}
