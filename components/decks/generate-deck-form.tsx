"use client"

import { LoaderCircle, Sparkles } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deckApi } from "@/lib/custom-decks/client"
import {
  MAX_AI_CARDS,
  MAX_AI_PROMPT,
  MIN_AI_CARDS,
  type DeckView,
} from "@/lib/custom-decks/protocol"

const COUNTS = [10, 15, 20, 30, MAX_AI_CARDS].filter((n) => n >= MIN_AI_CARDS)

/**
 * Prompt + card count. The result is a blind deck: nobody, including you,
 * sees its cards, so you can play it too.
 */
export function GenerateDeckForm({
  onGenerated,
}: {
  onGenerated: (deck: DeckView) => void
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [prompt, setPrompt] = useState("")
  const [count, setCount] = useState(20)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    deckApi
      .aiStatus()
      .then((s) => !cancelled && setEnabled(s.enabled))
      .catch(() => !cancelled && setEnabled(false))
    return () => {
      cancelled = true
    }
  }, [])

  if (enabled === null) {
    return <p className="text-sm text-muted-foreground">Checking AI…</p>
  }
  if (!enabled) {
    return (
      <p className="rounded-xl bg-muted p-3 text-sm font-semibold">
        AI generation isn&apos;t configured on this server.
      </p>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!prompt.trim()) {
      setError("Describe the deck you want, e.g. “90s cartoon characters”.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      onGenerated(await deckApi.generate({ prompt, count }))
      setPrompt("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make that deck.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        What should the deck be about?
        <Input
          value={prompt}
          maxLength={MAX_AI_PROMPT}
          placeholder="e.g. 90s cartoon characters"
          disabled={busy}
          onChange={(e) => {
            setPrompt(e.target.value)
            setError(null)
          }}
        />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Cards
          <select
            value={count}
            disabled={busy}
            onChange={(e) => setCount(Number(e.target.value))}
            className="h-11 rounded-xl border-2 border-ink bg-card px-3 text-base outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
          >
            {COUNTS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {busy ? "Making your deck…" : "Generate"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Nobody sees the cards, including you, so everyone can play. Up to 10
        decks an hour.
      </p>
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
