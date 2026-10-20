"use client"

import { cn } from "cn"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"

import { StatusScreen } from "@/components/game/status-screen"
import { AppHeader } from "@/components/screens/app-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AdminDeck, ReportReason } from "@/lib/custom-decks/protocol"

/**
 * Moderation UI. The one place that shows every card in a deck: moderators
 * need to see what was reported. Data comes from the server page.
 */

const REASONS: Record<ReportReason, string> = {
  offensive: "Offensive",
  spam: "Spam",
  other: "Other",
}

type Action = "dismiss" | "hide" | "unhide" | "delete"

async function post(path: string, body?: unknown, method = "POST") {
  const res = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      message?: string
    } | null
    throw new Error(err?.message ?? "Something went wrong.")
  }
}

export function AdminNotConfigured() {
  return (
    <>
      <AppHeader />
      <main className="flex flex-1 items-center px-4 py-10">
        <StatusScreen
          kind="error"
          title="Admin isn't configured"
          description="Set ADMIN_SECRET on the server to turn on moderation."
        />
      </main>
    </>
  )
}

export function AdminSignIn() {
  const router = useRouter()
  const [secret, setSecret] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await post("/api/admin/session", { secret })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 items-center px-4 py-10">
        <form
          onSubmit={onSubmit}
          className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-2xl border-2 border-ink bg-card p-6 shadow-pop"
        >
          <h1 className="text-title font-bold">Moderation</h1>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Admin secret
            <Input
              type="password"
              autoComplete="current-password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || !secret}>
            Sign in
          </Button>
        </form>
      </main>
    </>
  )
}

export function AdminScreen({ decks }: { decks: AdminDeck[] }) {
  const router = useRouter()

  async function signOut() {
    await post("/api/admin/session", undefined, "DELETE").catch(() => {})
    router.refresh()
  }

  return (
    <>
      <AppHeader>
        <Button size="sm" variant="ghost" onClick={() => void signOut()}>
          Sign out
        </Button>
      </AppHeader>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-16 sm:px-6">
        <div>
          <h1 className="text-title font-bold">Moderation</h1>
          <p className="text-muted-foreground">
            Reported and hidden decks. Decks with reports from 3 different
            browsers are hidden automatically.
          </p>
        </div>
        {decks.length === 0 ? (
          <StatusScreen
            kind="empty"
            title="Nothing to review"
            description="No open reports and no hidden decks."
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {decks.map((deck) => (
              <AdminDeckCard key={deck.id} deck={deck} />
            ))}
          </ul>
        )}
      </main>
    </>
  )
}

function AdminDeckCard({ deck }: { deck: AdminDeck }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(action: Action) {
    setBusy(true)
    setError(null)
    try {
      await post(`/api/admin/decks/${encodeURIComponent(deck.id)}`, {
        action,
      })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-card p-4 shadow-pop-sm">
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-3xl leading-none">
          {deck.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-semibold">{deck.name}</h2>
          {deck.description && (
            <p className="text-sm text-muted-foreground">{deck.description}</p>
          )}
          <p className="text-xs font-bold text-muted-foreground">
            {deck.cards.length} cards · played {deck.playCount} times ·{" "}
            {deck.reports.length} open{" "}
            {deck.reports.length === 1 ? "report" : "reports"}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border-2 border-ink px-2 py-0.5 text-xs font-bold uppercase",
            deck.hidden ? "bg-destructive-soft" : "bg-success-soft",
          )}
        >
          {deck.hidden ? "Hidden" : "Visible"}
        </span>
      </div>

      {deck.reports.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-xl bg-muted p-3 text-sm">
          {deck.reports.map((r) => (
            <li key={r.id}>
              <span className="font-semibold">{REASONS[r.reason]}</span>
              {r.note && <span>: {r.note}</span>}
              <span className="text-muted-foreground">
                {" "}
                · {new Date(r.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      <details className="rounded-xl border-2 border-ink/20 p-3">
        <summary className="cursor-pointer text-sm font-semibold">
          Show all {deck.cards.length} cards
        </summary>
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {deck.cards.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              {c.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- resized on upload
                <img
                  src={c.imageUrl}
                  alt=""
                  className="size-8 rounded border border-ink object-contain"
                />
              )}
              {c.label}
            </li>
          ))}
        </ul>
      </details>

      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {deck.reports.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void act("dismiss")}
          >
            Dismiss reports
          </Button>
        )}
        {deck.hidden ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void act("unhide")}
          >
            Unhide
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void act("hide")}
          >
            Hide
          </Button>
        )}
        {confirmDelete ? (
          <>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => void act("delete")}
            >
              Delete for good
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </Button>
        )}
      </div>
    </li>
  )
}
