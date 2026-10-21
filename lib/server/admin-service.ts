import { createHash, timingSafeEqual } from "node:crypto"

import type { AdminDeck } from "@/lib/custom-decks/protocol"

import type { DeckStore } from "./deck-store"
import type { ReportStore } from "./report-store"
import { RoomError } from "./room-service"

export const ADMIN_COOKIE = "headbands_admin"

/** What the admin cookie holds: a hash, so the secret itself never leaves. */
export function adminToken(secret: string): string {
  return createHash("sha256").update(`headbands-admin:${secret}`).digest("hex")
}

/** False when admin isn't configured (no secret) or the token doesn't match. */
export function isAdminToken(
  secret: string | undefined,
  token: string | undefined,
): boolean {
  if (!secret || !token) return false
  const expected = Buffer.from(adminToken(secret))
  const given = Buffer.from(token)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export function isAdminSecret(
  secret: string | undefined,
  attempt: string,
): boolean {
  return !!secret && isAdminToken(secret, adminToken(attempt))
}

export type AdminAction = "dismiss" | "hide" | "unhide" | "delete"

/** Moderation for reported and hidden decks. Callers check the cookie. */
export class AdminService {
  constructor(
    private decks: DeckStore,
    private reports: ReportStore,
  ) {}

  /** Decks with open reports or hidden, most reported first. */
  async listFlagged(): Promise<AdminDeck[]> {
    const open = await this.reports.openReports()
    const hidden = await this.decks.listHiddenDecks()
    const ids = [
      ...new Set([...open.map((r) => r.deckId), ...hidden.map((d) => d.id)]),
    ]
    const decks = await this.decks.getDecks(ids)
    const result = await Promise.all(
      decks.map(async (deck): Promise<AdminDeck> => {
        const cards = await this.decks.getCards(deck.id)
        return {
          id: deck.id,
          name: deck.name,
          emoji: deck.emoji,
          description: deck.description,
          hidden: deck.hidden,
          playCount: deck.playCount,
          generatedFrom: deck.generatedFrom,
          cards: cards
            .sort((a, b) => a.createdAt - b.createdAt)
            .map((c) => ({
              id: c.id,
              label: c.label,
              imageUrl: c.imageUrl,
              ai: c.createdBy === null,
            })),
          reports: open
            .filter((r) => r.deckId === deck.id)
            .map((r) => ({
              id: r.id,
              reason: r.reason,
              note: r.note,
              createdAt: r.createdAt,
            })),
        }
      }),
    )
    return result.sort((a, b) => b.reports.length - a.reports.length)
  }

  async act(id: string, action: AdminAction): Promise<{ ok: true }> {
    if (!(await this.decks.getDeck(id))) {
      throw new RoomError("notFound", "Deck not found.")
    }
    switch (action) {
      case "dismiss":
        await this.reports.closeReports(id, "dismissed")
        await this.decks.setHidden(id, false)
        break
      case "hide":
        await this.reports.closeReports(id, "actioned")
        await this.decks.setHidden(id, true)
        break
      case "unhide":
        await this.decks.setHidden(id, false)
        break
      case "delete":
        await this.decks.deleteDeck(id)
        break
    }
    return { ok: true }
  }
}
