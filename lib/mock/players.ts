import type { MediaState, Player } from "@/lib/game"

export const MOCK_NAMES = [
  "Maya",
  "Sam",
  "Priya",
  "Leo",
  "Ana",
  "Kofi",
  "Jun",
  "Zoe",
  "Omar",
  "Ivy",
]

export type VideoOrientation = "landscape" | "portrait"

export function randomId(prefix = "p"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function randomRoomCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  return Array.from(
    { length: 5 },
    () => letters[Math.floor(Math.random() * letters.length)],
  ).join("")
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6)
}

export function makeMockPlayer(
  name: string,
  joinedAt: number,
  media: Partial<MediaState> = {},
): Player {
  return {
    id: randomId(),
    name,
    joinedAt,
    media: { mic: true, camera: true, connection: "good", ...media },
  }
}

/** Mixes in some variety so indicators are visible in the prototype. */
export function mockMediaFor(index: number): Partial<MediaState> {
  if (index % 5 === 3) return { mic: false }
  if (index % 7 === 5) return { camera: false }
  if (index % 6 === 4) return { connection: "poor" }
  return {}
}
