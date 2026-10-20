import { describe, expect, it, vi } from "vitest"

import { gameReducer } from "@/lib/game"
import type { JoinRequest } from "@/lib/room/protocol"

import {
  hashToken,
  OFFLINE_AFTER_MS,
  RoomError,
  RoomService,
  STALE_AFTER_MS,
} from "../room-service"
import { MemoryRoomStore } from "../store"

const media = { mic: true, camera: true }
const as = (name: string): JoinRequest => ({ name, media })

function setup() {
  const store = new MemoryRoomStore()
  let clock = 1_000_000
  let n = 0
  const notify = vi.fn(async () => {})
  const service = new RoomService({
    store,
    notify,
    now: () => clock,
    seed: () => 7,
    token: () => `token-${++n}`,
    roomCode: () => "ROOMA",
    playerId: () => `p${n + 1}`,
  })
  return {
    service,
    store,
    notify,
    advance: (ms: number) => {
      clock += ms
    },
  }
}

async function roomWith(names: string[]) {
  const ctx = setup()
  const host = await ctx.service.createRoom(as(names[0]))
  const others = []
  for (const name of names.slice(1)) {
    others.push(await ctx.service.joinRoom(host.code, as(name)))
  }
  return { ...ctx, host, others, seats: [host, ...others] }
}

async function expectError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(RoomError)
  await expect(promise).rejects.toMatchObject({ code })
}

describe("RoomService", () => {
  it("creates a room with the creator as host", async () => {
    const { service } = setup()
    const seat = await service.createRoom(as("Maya"))
    expect(seat.code).toBe("ROOMA")
    expect(seat.view.isHost).toBe(true)
    expect(seat.view.you?.name).toBe("Maya")
    expect(seat.token).toBeTruthy()
  })

  it("stores only a hash of the token", async () => {
    const { service, store } = setup()
    const seat = await service.createRoom(as("Maya"))
    expect(await store.findSeat(seat.code, seat.token)).toBeNull()
    expect(await store.findSeat(seat.code, hashToken(seat.token))).toBe(
      seat.playerId,
    )
  })

  it("lets friends join by code", async () => {
    const { others } = await roomWith(["Maya", "Sam"])
    expect(others[0].view.players.map((p) => p.name)).toEqual(["Maya", "Sam"])
    expect(others[0].view.isHost).toBe(false)
  })

  it("rejects joining an unknown room", async () => {
    const { service } = setup()
    await expectError(service.joinRoom("NOPE1", as("Sam")), "notFound")
  })

  it("rejects joining a full room", async () => {
    const { service, host } = await roomWith([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
    ])
    await expectError(service.joinRoom(host.code, as("z")), "full")
  })

  it("rejects requests without a valid token", async () => {
    const { service, host } = await roomWith(["Maya", "Sam"])
    await expectError(service.getRoom(host.code, "bogus"), "unauthorized")
    await expectError(service.getRoom(host.code, ""), "unauthorized")
    await expectError(
      service.act(host.code, "bogus", { type: "startRound" }),
      "unauthorized",
    )
  })

  it("acts as the token's player, whatever the client claims", async () => {
    const { service, host, others } = await roomWith(["Maya", "Sam"])
    // Sam is not host, so Sam can't start, even though the host could.
    await expectError(
      service.act(host.code, others[0].token, { type: "startRound" }),
      "rejected",
    )
    const started = await service.act(host.code, host.token, {
      type: "startRound",
    })
    expect(started.view.phase).toBe("playing")
  })

  it("rejects moves that break the turn rules", async () => {
    const { service, host, others } = await roomWith(["Maya", "Sam"])
    await service.act(host.code, host.token, { type: "startRound" })
    // It's Maya's turn, not Sam's.
    await expectError(
      service.act(host.code, others[0].token, {
        type: "askQuestion",
        question: "Am I alive?",
      }),
      "rejected",
    )
  })

  it("uses a server-chosen seed to deal", async () => {
    const { service, store, host } = await roomWith(["Maya", "Sam"])
    const before = (await store.getRoom(host.code))!.state
    await service.act(host.code, host.token, { type: "startRound" })
    const after = (await store.getRoom(host.code))!.state
    const expected = gameReducer(before, {
      type: "startRound",
      by: host.playerId,
      seed: 7,
    })
    expect(after.round?.assignments).toEqual(expected.round?.assignments)
  })

  it("never returns the requester's own card", async () => {
    const { service, store, seats } = await roomWith(["Maya", "Sam", "Priya"])
    await service.act("ROOMA", seats[0].token, { type: "startRound" })
    const state = (await store.getRoom("ROOMA"))!.state
    for (const seat of seats) {
      const { view } = await service.getRoom("ROOMA", seat.token)
      const card = state.round!.assignments[seat.playerId]
      const json = JSON.stringify(view)
      expect(json).not.toContain(card.id)
      expect(json).not.toContain(card.label)
    }
  })

  it("resolves categories on the server", async () => {
    const { service, host } = await roomWith(["Maya", "Sam"])
    const snap = await service.act(host.code, host.token, {
      type: "selectCategory",
      categoryId: "food",
    })
    expect(snap.view.category?.id).toBe("food")
    await expectError(
      service.act(host.code, host.token, {
        type: "selectCategory",
        categoryId: "nope",
      }),
      "invalid",
    )
  })

  it("bumps the version and notifies on every change", async () => {
    const { service, notify, host } = await roomWith(["Maya", "Sam"])
    notify.mockClear()
    const snap = await service.act(host.code, host.token, {
      type: "startRound",
    })
    expect(snap.version).toBe(2)
    expect(notify).toHaveBeenCalledWith("ROOMA", 2)
  })

  it("retries when another write lands first", async () => {
    const { service, store, host } = await roomWith(["Maya", "Sam"])
    const realUpdate = store.updateRoom.bind(store)
    let raced = false
    vi.spyOn(store, "updateRoom").mockImplementation(async (code, v, s) => {
      if (!raced) {
        raced = true
        // Someone else writes first (e.g. a heartbeat prune or another click).
        const room = (await store.getRoom(code))!
        await realUpdate(code, room.version, room.state)
        return realUpdate(code, v, s)
      }
      return realUpdate(code, v, s)
    })
    const snap = await service.act(host.code, host.token, {
      type: "startRound",
    })
    expect(snap.view.phase).toBe("playing")
    expect(raced).toBe(true)
  })

  it("gives up after repeated conflicts", async () => {
    const { service, store, host } = await roomWith(["Maya", "Sam"])
    vi.spyOn(store, "updateRoom").mockResolvedValue(false)
    await expectError(
      service.act(host.code, host.token, { type: "startRound" }),
      "conflict",
    )
  })

  it("removes the seat when a player leaves", async () => {
    const { service, others, host } = await roomWith(["Maya", "Sam"])
    await service.act(host.code, others[0].token, { type: "leave" })
    await expectError(
      service.getRoom(host.code, others[0].token),
      "unauthorized",
    )
    const { view } = await service.getRoom(host.code, host.token)
    expect(view.players.map((p) => p.name)).toEqual(["Maya"])
  })

  it("prunes silent players and migrates host", async () => {
    const { service, advance, seats } = await roomWith(["Maya", "Sam", "Priya"])
    await service.act("ROOMA", seats[0].token, { type: "startRound" })
    advance(STALE_AFTER_MS - 1000)
    await service.heartbeat("ROOMA", seats[1].token)
    await service.heartbeat("ROOMA", seats[2].token)
    advance(2000) // Maya (host) has now been silent too long.
    await service.heartbeat("ROOMA", seats[1].token)

    const { view } = await service.getRoom("ROOMA", seats[1].token)
    expect(view.players.map((p) => p.name)).toEqual(["Sam", "Priya"])
    expect(view.isHost).toBe(true)
    expect(view.round?.playerCount).toBe(2)
    await expectError(service.getRoom("ROOMA", seats[0].token), "unauthorized")
  })

  it("shows quiet players as offline before pruning them", async () => {
    const { service, advance, seats } = await roomWith(["Maya", "Sam"])
    advance(OFFLINE_AFTER_MS + 1000)
    await service.heartbeat("ROOMA", seats[0].token)
    const { view } = await service.getRoom("ROOMA", seats[0].token)
    expect(view.players.map((p) => p.media.connection)).toEqual([
      "good",
      "offline",
    ])
  })

  it("lets late joiners wait for the next round", async () => {
    const { service, host } = await roomWith(["Maya", "Sam"])
    await service.act(host.code, host.token, { type: "startRound" })
    const late = await service.joinRoom(host.code, as("Leo"))
    expect(late.view.you?.status).toBe("waiting")
  })
})
