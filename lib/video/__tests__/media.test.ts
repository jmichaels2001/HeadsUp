import { describe, expect, it } from "vitest"

import { getViewerState, type MediaState } from "@/lib/game"
import { lobby } from "@/lib/game/__tests__/helpers"

import { mergeMedia, withCallMedia, type CallMedia } from "../media"

const base: MediaState = { mic: true, camera: true, connection: "good" }
const call = (over: Partial<CallMedia> = {}): CallMedia => ({
  mic: true,
  camera: true,
  quality: "excellent",
  ...over,
})

describe("mergeMedia", () => {
  it("keeps the room's media for players not on the call", () => {
    expect(mergeMedia(base, undefined)).toBe(base)
  })

  it("takes mic and camera from the call", () => {
    expect(mergeMedia(base, call({ mic: false, camera: false }))).toEqual({
      mic: false,
      camera: false,
      connection: "good",
    })
    expect(
      mergeMedia({ ...base, mic: false, camera: false }, call()),
    ).toMatchObject({ mic: true, camera: true })
  })

  it("shows a poor or lost call link as a weak connection", () => {
    expect(mergeMedia(base, call({ quality: "poor" })).connection).toBe("poor")
    expect(mergeMedia(base, call({ quality: "lost" })).connection).toBe("poor")
    expect(mergeMedia(base, call({ quality: "unknown" })).connection).toBe(
      "good",
    )
  })

  it("never hides room presence that is worse than the call", () => {
    const offline = { ...base, connection: "offline" as const }
    expect(mergeMedia(offline, call()).connection).toBe("offline")
  })

  it("shows your own call reconnecting", () => {
    expect(mergeMedia(base, call(), true).connection).toBe("reconnecting")
    expect(mergeMedia(base, undefined, true).connection).toBe("reconnecting")
  })
})

describe("withCallMedia", () => {
  const view = getViewerState(lobby(3), "a")

  it("returns the same view when nothing changes", () => {
    expect(withCallMedia(view, {}, false)).toBe(view)
  })

  it("merges per player and keeps `you` in step", () => {
    const next = withCallMedia(
      view,
      { a: call({ mic: false }), c: call({ quality: "poor" }) },
      false,
    )
    expect(
      next.players.map((p) => [p.id, p.media.mic, p.media.connection]),
    ).toEqual([
      ["a", false, "good"],
      ["b", true, "good"],
      ["c", true, "poor"],
    ])
    expect(next.you?.media.mic).toBe(false)
  })

  it("only marks you as reconnecting", () => {
    const next = withCallMedia(view, {}, true)
    expect(next.players.map((p) => p.media.connection)).toEqual([
      "reconnecting",
      "good",
      "good",
    ])
    expect(next.you?.media.connection).toBe("reconnecting")
  })
})
