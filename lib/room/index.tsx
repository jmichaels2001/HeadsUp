"use client"

import type { ReactNode } from "react"

import { MockRoomProvider } from "@/lib/mock/room-provider"

import { ServerRoomProvider } from "./server-provider"

export * from "./context"

/**
 * "server": real rooms via the API (Supabase when configured, an in-memory
 * store in local dev otherwise). "mock": Phase 1 single-tab mock with the full
 * dev panel. Defaults to server once Supabase is configured.
 */
export const ROOM_BACKEND: "mock" | "server" =
  process.env.NEXT_PUBLIC_ROOM_BACKEND === "mock"
    ? "mock"
    : process.env.NEXT_PUBLIC_ROOM_BACKEND === "server" ||
        process.env.NEXT_PUBLIC_SUPABASE_URL
      ? "server"
      : "mock"

export function RoomProvider({ children }: { children: ReactNode }) {
  return ROOM_BACKEND === "server" ? (
    <ServerRoomProvider>{children}</ServerRoomProvider>
  ) : (
    <MockRoomProvider>{children}</MockRoomProvider>
  )
}
