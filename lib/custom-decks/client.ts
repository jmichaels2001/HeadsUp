import type { ApiError } from "@/lib/room/protocol"

import { getDeviceId } from "./device-id"
import { shrinkImage } from "./image-resize"
import {
  DEVICE_HEADER,
  type AddCardRequest,
  type DeckListItem,
  type DeckMeta,
  type DeckView,
  type GenerateDeckRequest,
  type ImageUploadResponse,
  type LibraryItem,
  type LibrarySort,
  type ReportRequest,
  type UpdateCardRequest,
  type UpdateDeckRequest,
} from "./protocol"

export class DeckApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError | null,
  ) {
    super(body?.message ?? "Something went wrong. Try again.")
  }

  get conflict() {
    return this.body?.error === "conflict"
  }
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    cache: "no-store",
    headers: {
      [DEVICE_HEADER]: getDeviceId(),
      ...(init.body !== undefined && { "content-type": "application/json" }),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  if (!res.ok) {
    throw new DeckApiError(res.status, await res.json().catch(() => null))
  }
  return res.json() as Promise<T>
}

const deckPath = (id: string) => `/api/decks/${encodeURIComponent(id)}`
const cardPath = (id: string, cardId: string) =>
  `${deckPath(id)}/cards/${encodeURIComponent(cardId)}`

export const deckApi = {
  listMine: () => request<DeckListItem[]>("/api/decks"),
  library: (query: string, sort: LibrarySort) =>
    request<LibraryItem[]>(
      `/api/decks/library?${new URLSearchParams({ q: query, sort })}`,
    ),
  aiStatus: () => request<{ enabled: boolean }>("/api/decks/generate"),
  generate: (body: GenerateDeckRequest) =>
    request<DeckView>("/api/decks/generate", { method: "POST", body }),
  report: (id: string, body: ReportRequest) =>
    request<{ ok: true }>(`${deckPath(id)}/report`, { method: "POST", body }),
  create: (meta: DeckMeta) =>
    request<DeckView>("/api/decks", { method: "POST", body: meta }),
  get: (id: string) => request<DeckView>(deckPath(id)),
  update: (id: string, body: UpdateDeckRequest) =>
    request<DeckView>(deckPath(id), { method: "PATCH", body }),
  remove: (id: string) =>
    request<{ ok: true }>(deckPath(id), { method: "DELETE" }),
  addCard: (id: string, body: AddCardRequest) =>
    request<DeckView>(`${deckPath(id)}/cards`, { method: "POST", body }),
  updateCard: (id: string, cardId: string, body: UpdateCardRequest) =>
    request<DeckView>(cardPath(id, cardId), { method: "PATCH", body }),
  removeCard: (id: string, cardId: string) =>
    request<DeckView>(cardPath(id, cardId), { method: "DELETE" }),

  /** Shrink in the browser, then upload. Returns the image URL. */
  async uploadImage(file: Blob): Promise<string> {
    const image = await shrinkImage(file)
    const res = await fetch("/api/card-images", {
      method: "POST",
      headers: { "content-type": image.type },
      body: image,
    })
    if (!res.ok) {
      throw new DeckApiError(res.status, await res.json().catch(() => null))
    }
    return ((await res.json()) as ImageUploadResponse).url
  },
}
