"use client"

import { ArrowLeft, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  useCallback,
  useEffect,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from "react"

import { StatusScreen } from "@/components/game/status-screen"
import { AppHeader } from "@/components/screens/app-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DeckApiError, deckApi } from "@/lib/custom-decks/client"
import { imageFromClipboard } from "@/lib/custom-decks/image-resize"
import {
  MAX_CARD_LABEL,
  MAX_DECK_CARDS,
  MAX_DECK_DESCRIPTION,
  MAX_DECK_NAME,
  MIN_PLAYABLE_CARDS,
  type DeckMeta,
  type DeckView,
} from "@/lib/custom-decks/protocol"
import type { Card } from "@/lib/game"

import { CardImageField } from "./card-image-field"

const EMPTY_META: DeckMeta = { name: "", emoji: "🃏", description: "" }

function message(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong."
}

/** Create a deck (no `deckId`) or edit one. You only ever see your own cards. */
export function DeckEditor({ deckId }: { deckId?: string }) {
  const router = useRouter()
  const [view, setView] = useState<DeckView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!deckId) return
    try {
      setView(await deckApi.get(deckId))
      setLoadError(null)
    } catch (err) {
      setLoadError(
        err instanceof DeckApiError && err.status === 404
          ? "This deck doesn't exist any more."
          : message(err),
      )
    }
  }, [deckId])

  useEffect(() => {
    // Fetch on mount; the effect only kicks off the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const header = (
    <AppHeader>
      <Link
        href="/decks"
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft />
        My decks
      </Link>
    </AppHeader>
  )

  if (deckId && !view) {
    return (
      <>
        {header}
        <main className="flex flex-1 items-center px-4 py-10">
          {loadError ? (
            <StatusScreen kind="error" title="Couldn't open this deck">
              <p className="text-muted-foreground">{loadError}</p>
              <Button onClick={() => void load()}>Try again</Button>
            </StatusScreen>
          ) : (
            <StatusScreen kind="loading" title="Opening deck…" />
          )}
        </main>
      </>
    )
  }

  return (
    <>
      {header}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pb-16 sm:px-6">
        <h1 className="text-title font-bold">
          {view ? "Edit deck" : "New deck"}
        </h1>
        <MetaForm
          key={view ? `${view.id}:${view.version}` : "new"}
          view={view}
          onCreated={(created) => router.replace(`/decks/${created.id}`)}
          onSaved={setView}
          onReload={() => void load()}
        />
        {view && (
          <>
            <CardsSection view={view} onChange={setView} />
            <DeleteDeck view={view} onDeleted={() => router.push("/decks")} />
          </>
        )}
      </main>
    </>
  )
}

function MetaForm({
  view,
  onCreated,
  onSaved,
  onReload,
}: {
  view: DeckView | null
  onCreated: (view: DeckView) => void
  onSaved: (view: DeckView) => void
  onReload: () => void
}) {
  const saved: DeckMeta = view
    ? { name: view.name, emoji: view.emoji, description: view.description }
    : EMPTY_META
  const [meta, setMeta] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)

  const dirty =
    meta.name !== saved.name ||
    meta.emoji !== saved.emoji ||
    meta.description !== saved.description

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!meta.name.trim()) {
      setError("Give your deck a name.")
      return
    }
    if (!meta.emoji.trim()) {
      setError("Pick an emoji for your deck.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (view) {
        onSaved(
          await deckApi.update(view.id, {
            meta,
            expectedVersion: view.version,
          }),
        )
      } else {
        onCreated(await deckApi.create(meta))
      }
    } catch (err) {
      if (err instanceof DeckApiError && err.conflict) setConflict(true)
      setError(message(err))
    } finally {
      setSaving(false)
    }
  }

  const set = (patch: Partial<DeckMeta>) => {
    setMeta((m) => ({ ...m, ...patch }))
    setError(null)
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-2xl border-2 border-ink bg-card p-5 shadow-pop"
    >
      <div className="flex gap-3">
        <label className="flex w-20 flex-col gap-1 text-sm font-semibold">
          Emoji
          <Input
            value={meta.emoji}
            maxLength={16}
            onChange={(e) => set({ emoji: e.target.value })}
            className="text-center text-2xl"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
          Name
          <Input
            value={meta.name}
            maxLength={MAX_DECK_NAME}
            placeholder="e.g. Movie villains"
            onChange={(e) => set({ name: e.target.value })}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Description
        <Input
          value={meta.description}
          maxLength={MAX_DECK_DESCRIPTION}
          placeholder="Optional"
          onChange={(e) => set({ description: e.target.value })}
        />
      </label>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 text-sm font-semibold text-destructive"
        >
          {error}
          {conflict && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onReload}
            >
              Reload
            </Button>
          )}
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving || (!!view && !dirty)}>
          {view ? (saving ? "Saving…" : "Save details") : "Create deck"}
        </Button>
      </div>
    </form>
  )
}

function CardsSection({
  view,
  onChange,
}: {
  view: DeckView
  onChange: (view: DeckView) => void
}) {
  const missing = MIN_PLAYABLE_CARDS - view.totalCardCount
  const full = view.totalCardCount >= MAX_DECK_CARDS

  return (
    <section className="flex flex-col gap-3" aria-labelledby="cards-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="cards-heading" className="text-label font-semibold">
          Your cards ({view.myCards.length})
        </h2>
        <p className="text-sm text-muted-foreground">
          Paste an image into a card row, or use Add image.
        </p>
      </div>

      {full ? (
        <p className="rounded-xl border-2 border-ink bg-muted p-3 text-sm font-semibold">
          This deck is full ({MAX_DECK_CARDS} cards).
        </p>
      ) : (
        <NewCardRow deckId={view.id} onAdded={onChange} />
      )}

      <ul className="flex flex-col gap-2">
        {view.myCards
          .slice()
          .reverse()
          .map((card) => (
            <CardRow
              key={card.id}
              deckId={view.id}
              card={card}
              onChange={onChange}
            />
          ))}
      </ul>

      <div className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-ink/50 p-4 text-center">
        <p className="font-semibold">
          {view.otherCardCount === 0
            ? "No cards from other players yet."
            : `${view.otherCardCount} more ${view.otherCardCount === 1 ? "card" : "cards"} by other players`}
        </p>
        <p className="text-sm text-muted-foreground">
          You can&apos;t see other players&apos; cards, so you can still play
          with them. {view.totalCardCount} of up to {MAX_DECK_CARDS} cards in
          total.
        </p>
      </div>

      {missing > 0 && (
        <p
          role="status"
          className="rounded-xl border-2 border-ink bg-warning-soft p-3 text-sm font-semibold"
        >
          Draft: add {missing} more {missing === 1 ? "card" : "cards"} (from
          anyone) to make this deck playable.
        </p>
      )}
    </section>
  )
}

/** Shared paste-or-pick upload state for a card row. */
function useImageUpload(onUploaded: (url: string) => Promise<void> | void) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: Blob) {
    setUploading(true)
    setError(null)
    try {
      await onUploaded(await deckApi.uploadImage(file))
    } catch (err) {
      setError(message(err))
    } finally {
      setUploading(false)
    }
  }

  function onPaste(e: ClipboardEvent) {
    const file = imageFromClipboard(e.clipboardData)
    if (!file) return
    e.preventDefault()
    void upload(file)
  }

  return { uploading, error, setError, upload, onPaste }
}

function NewCardRow({
  deckId,
  onAdded,
}: {
  deckId: string
  onAdded: (view: DeckView) => void
}) {
  const [label, setLabel] = useState("")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const image = useImageUpload((url) => setImageUrl(url))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!label.trim()) {
      image.setError("Type a name for the card.")
      return
    }
    setAdding(true)
    try {
      onAdded(await deckApi.addCard(deckId, { label, imageUrl }))
      setLabel("")
      setImageUrl(null)
      image.setError(null)
    } catch (err) {
      image.setError(message(err))
    } finally {
      setAdding(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      onPaste={image.onPaste}
      noValidate
      className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-secondary/40 p-4"
    >
      <div className="flex gap-2">
        <label htmlFor="new-card" className="sr-only">
          New card
        </label>
        <Input
          id="new-card"
          value={label}
          maxLength={MAX_CARD_LABEL}
          placeholder="Add a card, e.g. Darth Vader"
          onChange={(e) => {
            setLabel(e.target.value)
            image.setError(null)
          }}
        />
        <Button type="submit" size="lg" disabled={adding || image.uploading}>
          Add
        </Button>
      </div>
      <CardImageField
        imageUrl={imageUrl}
        uploading={image.uploading}
        label={label}
        onPick={(file) => void image.upload(file)}
        onRemove={() => setImageUrl(null)}
      />
      {image.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {image.error}
        </p>
      )}
    </form>
  )
}

function CardRow({
  deckId,
  card,
  onChange,
}: {
  deckId: string
  card: Card
  onChange: (view: DeckView) => void
}) {
  const [label, setLabel] = useState(card.label)
  const [busy, setBusy] = useState(false)
  const image = useImageUpload((url) => save({ imageUrl: url }))

  async function save(patch: { label?: string; imageUrl?: string | null }) {
    setBusy(true)
    image.setError(null)
    try {
      onChange(await deckApi.updateCard(deckId, card.id, patch))
    } catch (err) {
      image.setError(message(err))
      if (patch.label !== undefined) setLabel(card.label)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      onChange(await deckApi.removeCard(deckId, card.id))
    } catch (err) {
      image.setError(message(err))
      setBusy(false)
    }
  }

  function commitLabel() {
    const next = label.trim()
    if (!next) setLabel(card.label)
    else if (next !== card.label) void save({ label: next })
  }

  return (
    <li
      onPaste={image.onPaste}
      className="flex flex-col gap-2 rounded-2xl border-2 border-ink bg-card p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Card name"
          value={label}
          maxLength={MAX_CARD_LABEL}
          disabled={busy}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
            if (e.key === "Escape") setLabel(card.label)
          }}
          className="min-w-40 flex-1"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={busy}
          onClick={() => void remove()}
          aria-label={`Remove ${card.label}`}
        >
          <Trash2 />
        </Button>
      </div>
      <CardImageField
        imageUrl={card.imageUrl ?? null}
        uploading={image.uploading}
        label={card.label}
        onPick={(file) => void image.upload(file)}
        onRemove={() => void save({ imageUrl: null })}
      />
      {image.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {image.error}
        </p>
      )}
    </li>
  )
}

function DeleteDeck({
  view,
  onDeleted,
}: {
  view: DeckView
  onDeleted: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!view.canDelete) {
    return (
      <p className="text-sm text-muted-foreground">
        Other players have cards in this deck, so it can&apos;t be deleted. You
        can remove your own cards.
      </p>
    )
  }

  async function onDelete() {
    try {
      await deckApi.remove(view.id)
      onDeleted()
    } catch (err) {
      setError(message(err))
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {confirming ? (
        <>
          <span className="font-semibold">Delete this deck for everyone?</span>
          <Button variant="destructive" onClick={() => void onDelete()}>
            Delete
          </Button>
          <Button variant="outline" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button variant="outline" onClick={() => setConfirming(true)}>
          <Trash2 />
          Delete deck
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
