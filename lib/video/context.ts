"use client"

import type { VideoTrack } from "livekit-client"
import { createContext, useContext } from "react"

import type { PlayerId } from "@/lib/game"

import type { CallMedia } from "./media"

/**
 * What the UI gets from the video layer. Video never carries game data; it
 * only adds live feeds and real mic/camera/link state on top of the room.
 */

/**
 * - off: not in a room
 * - unavailable: video isn't configured (or mock mode); tiles show placeholders
 */
export type CallStatus =
  "off" | "connecting" | "connected" | "reconnecting" | "unavailable"

/** Camera/mic check on the join screen. */
export type PreviewStatus =
  "idle" | "requesting" | "ready" | "denied" | "noDevice" | "error"

export interface VideoContextValue {
  status: CallStatus
  preview: {
    status: PreviewStatus
    hasVideo: boolean
    hasAudio: boolean
    videoTrack: VideoTrack | null
    /** Ask for camera and mic. Tracks are reused when the call connects. */
    start: () => Promise<void>
    /** Release the camera and mic if they weren't handed to a call. */
    stop: () => void
  }
  /** A player's live camera feed, or null to show the placeholder. */
  cameraTrack: (playerId: PlayerId) => VideoTrack | null
  /** Mic/camera/quality for everyone currently on the call. */
  callMedia: Readonly<Record<PlayerId, CallMedia>>
  /** Your own call is reconnecting. */
  reconnecting: boolean
  /** Your mic/camera: applied to the call and saved to the room. */
  setMic: (on: boolean) => Promise<void>
  setCamera: (on: boolean) => Promise<void>
  /** Why your camera or mic couldn't turn on, if it failed. */
  deviceError: string | null
  /** The browser blocked sound until the player taps something. */
  audioBlocked: boolean
  enableAudio: () => void
}

export const VideoContext = createContext<VideoContextValue | null>(null)

export function useVideo(): VideoContextValue {
  const ctx = useContext(VideoContext)
  if (!ctx) throw new Error("useVideo must be used inside VideoProvider")
  return ctx
}
