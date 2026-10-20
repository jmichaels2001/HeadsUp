import { TokenVerifier } from "livekit-server-sdk"
import { describe, expect, it } from "vitest"

import { RoomError, RoomService, type VideoConfig } from "../room-service"
import { MemoryRoomStore } from "../store"

const video: VideoConfig = {
  url: "wss://headbands-test.livekit.cloud",
  apiKey: "test-key",
  apiSecret: "test-secret-that-is-long-enough-for-hs256",
}
const media = { mic: true, camera: true }

async function room(config: VideoConfig | null = video) {
  let n = 0
  const service = new RoomService({
    store: new MemoryRoomStore(),
    token: () => `token-${++n}`,
    roomCode: () => "ROOMA",
    playerId: () => `p${n + 1}`,
    video: config,
  })
  const host = await service.createRoom({ name: "Maya", media })
  const sam = await service.joinRoom(host.code, { name: "Sam", media })
  return { service, host, sam }
}

async function expectError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(RoomError)
  await expect(promise).rejects.toMatchObject({ code })
}

describe("RoomService.videoToken", () => {
  it("issues a token for the room's call with the player as identity", async () => {
    const { service, sam } = await room()
    const res = await service.videoToken("ROOMA", sam.token)
    expect(res.url).toBe(video.url)

    const claims = await new TokenVerifier(
      video.apiKey,
      video.apiSecret,
    ).verify(res.token)
    expect(claims.sub).toBe(sam.playerId)
    expect(claims.name).toBe("Sam")
    expect(claims.video).toMatchObject({
      room: "ROOMA",
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    })
  })

  it("rejects missing or unknown tokens", async () => {
    const { service } = await room()
    await expectError(service.videoToken("ROOMA", ""), "unauthorized")
    await expectError(service.videoToken("ROOMA", "bogus"), "unauthorized")
  })

  it("rejects a seat from another room", async () => {
    const { service, sam } = await room()
    await expectError(service.videoToken("ROOMB", sam.token), "notFound")
  })

  it("rejects players who have left", async () => {
    const { service, sam } = await room()
    await service.act("ROOMA", sam.token, { type: "leave" })
    await expectError(service.videoToken("ROOMA", sam.token), "unauthorized")
  })

  it("reports video as unavailable when LiveKit isn't configured", async () => {
    const { service, sam } = await room(null)
    await expectError(service.videoToken("ROOMA", sam.token), "unavailable")
  })

  it("still checks the seat before saying video is unavailable", async () => {
    const { service } = await room(null)
    await expectError(service.videoToken("ROOMA", "bogus"), "unauthorized")
  })
})
