import type { SupabaseClient } from "@supabase/supabase-js"

import type { CardRecord, DeckRecord } from "@/lib/custom-decks/deck-view"
import type { DeckMeta } from "@/lib/custom-decks/protocol"

import type { CardPatch, DeckStore, LibraryQuery } from "./deck-store"
import type { ReportRecord, ReportStatus, ReportStore } from "./report-store"

const DECK_COLUMNS =
  "id, name, emoji, description, created_by, version, play_count, hidden, created_at, updated_at"
const CARD_COLUMNS = "id, deck_id, label, image_url, created_by, created_at"

interface DeckRow {
  id: string
  name: string
  emoji: string
  description: string
  created_by: string
  version: number
  play_count: number
  hidden: boolean
  created_at: string
  updated_at: string
}

interface CardRow {
  id: string
  deck_id: string
  label: string
  image_url: string | null
  created_by: string
  created_at: string
}

function fail(op: string, error: { message: string }): never {
  throw new Error(`Supabase ${op} failed: ${error.message}`)
}

function toDeck(row: DeckRow): DeckRecord {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    description: row.description,
    createdBy: row.created_by,
    version: row.version,
    playCount: row.play_count,
    hidden: row.hidden,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
  }
}

function toCard(row: CardRow): CardRecord {
  return {
    id: row.id,
    deckId: row.deck_id,
    label: row.label,
    imageUrl: row.image_url,
    createdBy: row.created_by,
    createdAt: Date.parse(row.created_at),
  }
}

const iso = (ms: number) => new Date(ms).toISOString()

/** DeckStore backed by the `decks` and `deck_cards` tables. */
export class SupabaseDeckStore implements DeckStore {
  constructor(private db: SupabaseClient) {}

  async createDeck(deck: DeckRecord) {
    const { error } = await this.db.from("decks").insert({
      id: deck.id,
      name: deck.name,
      emoji: deck.emoji,
      description: deck.description,
      created_by: deck.createdBy,
      version: deck.version,
      play_count: deck.playCount,
      hidden: deck.hidden,
      created_at: iso(deck.createdAt),
      updated_at: iso(deck.updatedAt),
    })
    if (error) fail("createDeck", error)
  }

  async getDeck(id: string) {
    const { data, error } = await this.db
      .from("decks")
      .select(DECK_COLUMNS)
      .eq("id", id)
      .maybeSingle<DeckRow>()
    if (error) fail("getDeck", error)
    return data ? toDeck(data) : null
  }

  async updateDeck(
    id: string,
    expectedVersion: number,
    meta: DeckMeta,
    now: number,
  ) {
    const { data, error } = await this.db
      .from("decks")
      .update({ ...meta, version: expectedVersion + 1, updated_at: iso(now) })
      .eq("id", id)
      .eq("version", expectedVersion)
      .select("version")
    if (error) fail("updateDeck", error)
    return (data?.length ?? 0) === 1
  }

  async deleteDeck(id: string) {
    const { error } = await this.db.from("decks").delete().eq("id", id)
    if (error) fail("deleteDeck", error)
  }

  async listDecksForDevice(deviceId: string) {
    const cards = await this.db
      .from("deck_cards")
      .select("deck_id")
      .eq("created_by", deviceId)
    if (cards.error) fail("listDecksForDevice", cards.error)
    const ids = [...new Set((cards.data ?? []).map((c) => c.deck_id))]

    // deviceId is validated ([A-Za-z0-9_-]) and deck ids are ours.
    const filter = ids.length
      ? `created_by.eq.${deviceId},id.in.(${ids.join(",")})`
      : `created_by.eq.${deviceId}`
    const { data, error } = await this.db
      .from("decks")
      .select(DECK_COLUMNS)
      .or(filter)
      .order("updated_at", { ascending: false })
      .returns<DeckRow[]>()
    if (error) fail("listDecksForDevice", error)
    return (data ?? []).map(toDeck)
  }

  async listVisibleDecks({ query, sort, limit }: LibraryQuery) {
    let request = this.db.from("decks").select(DECK_COLUMNS).eq("hidden", false)
    const needle = query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)
    if (needle) request = request.ilike("name", `%${needle}%`)
    if (sort === "popular") {
      request = request.order("play_count", { ascending: false })
    }
    const { data, error } = await request
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<DeckRow[]>()
    if (error) fail("listVisibleDecks", error)
    return (data ?? []).map(toDeck)
  }

  async listHiddenDecks() {
    const { data, error } = await this.db
      .from("decks")
      .select(DECK_COLUMNS)
      .eq("hidden", true)
      .returns<DeckRow[]>()
    if (error) fail("listHiddenDecks", error)
    return (data ?? []).map(toDeck)
  }

  async getDecks(ids: string[]) {
    if (!ids.length) return []
    const { data, error } = await this.db
      .from("decks")
      .select(DECK_COLUMNS)
      .in("id", ids)
      .returns<DeckRow[]>()
    if (error) fail("getDecks", error)
    return (data ?? []).map(toDeck)
  }

  async setHidden(id: string, hidden: boolean) {
    const { error } = await this.db
      .from("decks")
      .update({ hidden })
      .eq("id", id)
    if (error) fail("setHidden", error)
  }

  async incrementPlayCount(id: string) {
    const { error } = await this.db.rpc("increment_deck_play_count", {
      deck: id,
    })
    if (error) fail("incrementPlayCount", error)
  }

  async getCards(deckId: string) {
    const { data, error } = await this.db
      .from("deck_cards")
      .select(CARD_COLUMNS)
      .eq("deck_id", deckId)
      .returns<CardRow[]>()
    if (error) fail("getCards", error)
    return (data ?? []).map(toCard)
  }

  async getCardCreators(deckIds: string[]) {
    const result: Record<string, string[]> = Object.fromEntries(
      deckIds.map((id) => [id, []]),
    )
    if (!deckIds.length) return result
    const { data, error } = await this.db
      .from("deck_cards")
      .select("deck_id, created_by")
      .in("deck_id", deckIds)
    if (error) fail("getCardCreators", error)
    for (const row of data ?? []) result[row.deck_id]?.push(row.created_by)
    return result
  }

  async addCard(card: CardRecord) {
    const { error } = await this.db.from("deck_cards").insert({
      id: card.id,
      deck_id: card.deckId,
      label: card.label,
      image_url: card.imageUrl,
      created_by: card.createdBy,
      created_at: iso(card.createdAt),
    })
    if (error) fail("addCard", error)
  }

  async updateCard(deckId: string, cardId: string, patch: CardPatch) {
    const { error } = await this.db
      .from("deck_cards")
      .update({
        ...(patch.label !== undefined && { label: patch.label }),
        ...(patch.imageUrl !== undefined && { image_url: patch.imageUrl }),
      })
      .eq("deck_id", deckId)
      .eq("id", cardId)
    if (error) fail("updateCard", error)
  }

  async deleteCard(deckId: string, cardId: string) {
    const { error } = await this.db
      .from("deck_cards")
      .delete()
      .eq("deck_id", deckId)
      .eq("id", cardId)
    if (error) fail("deleteCard", error)
  }
}

interface ReportRow {
  id: string
  deck_id: string
  device_id: string
  reason: ReportRecord["reason"]
  note: string
  status: ReportStatus
  created_at: string
}

/** ReportStore backed by the `deck_reports` table (migration 0003). */
export class SupabaseReportStore implements ReportStore {
  constructor(private db: SupabaseClient) {}

  async saveOpenReport(report: ReportRecord) {
    const { data, error } = await this.db
      .from("deck_reports")
      .update({ reason: report.reason, note: report.note })
      .eq("deck_id", report.deckId)
      .eq("device_id", report.deviceId)
      .eq("status", "open")
      .select("id")
    if (error) fail("saveOpenReport", error)
    if (data?.length) return
    const insert = await this.db.from("deck_reports").insert({
      id: report.id,
      deck_id: report.deckId,
      device_id: report.deviceId,
      reason: report.reason,
      note: report.note,
      status: "open",
      created_at: iso(report.createdAt),
    })
    if (insert.error) fail("saveOpenReport", insert.error)
  }

  async openReports(deckIds?: string[]) {
    if (deckIds && !deckIds.length) return []
    let request = this.db
      .from("deck_reports")
      .select("id, deck_id, device_id, reason, note, status, created_at")
      .eq("status", "open")
    if (deckIds) request = request.in("deck_id", deckIds)
    const { data, error } = await request
      .order("created_at", { ascending: true })
      .returns<ReportRow[]>()
    if (error) fail("openReports", error)
    return (data ?? []).map((row): ReportRecord => ({
      id: row.id,
      deckId: row.deck_id,
      deviceId: row.device_id,
      reason: row.reason,
      note: row.note,
      status: row.status,
      createdAt: Date.parse(row.created_at),
    }))
  }

  async closeReports(deckId: string, status: Exclude<ReportStatus, "open">) {
    const { error } = await this.db
      .from("deck_reports")
      .update({ status })
      .eq("deck_id", deckId)
      .eq("status", "open")
    if (error) fail("closeReports", error)
  }
}
