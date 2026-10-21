/** Deck generations per device, for the hourly limit. */
export interface GenerationLog {
  countSince(deviceId: string, since: number): Promise<number>
  record(deviceId: string, at: number): Promise<void>
}

export class MemoryGenerationLog implements GenerationLog {
  private entries: { deviceId: string; at: number }[] = []

  async countSince(deviceId: string, since: number) {
    return this.entries.filter((e) => e.deviceId === deviceId && e.at >= since)
      .length
  }

  async record(deviceId: string, at: number) {
    this.entries.push({ deviceId, at })
  }
}
