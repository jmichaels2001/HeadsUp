import type { ReportReason } from "@/lib/custom-decks/protocol"

export type ReportStatus = "open" | "dismissed" | "actioned"

export interface ReportRecord {
  id: string
  deckId: string
  deviceId: string
  reason: ReportReason
  note: string
  status: ReportStatus
  createdAt: number
}

/** Deck reports. Supabase in prod, memory in tests/dev. */
export interface ReportStore {
  /** Adds a report, or updates this device's open report on the deck. */
  saveOpenReport(report: ReportRecord): Promise<void>
  /** Open reports, for some decks or all of them. */
  openReports(deckIds?: string[]): Promise<ReportRecord[]>
  /** Closes every open report on a deck. */
  closeReports(
    deckId: string,
    status: Exclude<ReportStatus, "open">,
  ): Promise<void>
}

export class MemoryReportStore implements ReportStore {
  private reports: ReportRecord[] = []

  async saveOpenReport(report: ReportRecord) {
    const existing = this.reports.find(
      (r) =>
        r.deckId === report.deckId &&
        r.deviceId === report.deviceId &&
        r.status === "open",
    )
    if (existing) {
      existing.reason = report.reason
      existing.note = report.note
    } else {
      this.reports.push({ ...report })
    }
  }

  async openReports(deckIds?: string[]) {
    return this.reports
      .filter(
        (r) => r.status === "open" && (!deckIds || deckIds.includes(r.deckId)),
      )
      .map((r) => ({ ...r }))
  }

  async closeReports(deckId: string, status: Exclude<ReportStatus, "open">) {
    for (const r of this.reports) {
      if (r.deckId === deckId && r.status === "open") r.status = status
    }
  }
}
