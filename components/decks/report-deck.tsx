"use client"

import { Flag } from "lucide-react"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deckApi } from "@/lib/custom-decks/client"
import {
  MAX_REPORT_NOTE,
  REPORT_REASONS,
  type ReportReason,
} from "@/lib/custom-decks/protocol"

const LABELS: Record<ReportReason, string> = {
  offensive: "Offensive",
  spam: "Spam",
  other: "Something else",
}

/** A Report button that opens a small inline form. */
export function ReportDeck({ deckId, name }: { deckId: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>("offensive")
  const [note, setNote] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")
  const [error, setError] = useState<string | null>(null)

  if (state === "sent") {
    return (
      <p role="status" className="text-sm font-semibold text-muted-foreground">
        Thanks, a moderator will take a look.
      </p>
    )
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label={`Report ${name}`}
      >
        <Flag />
        Report
      </Button>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setState("sending")
    setError(null)
    try {
      await deckApi.report(deckId, { reason, note })
      setState("sent")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the report.")
      setState("idle")
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full flex-col gap-3 rounded-xl border-2 border-ink bg-muted p-3"
    >
      <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
        <legend className="mb-1 text-sm font-semibold">
          What&apos;s wrong with {name}?
        </legend>
        {REPORT_REASONS.map((r) => (
          <label key={r} className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={`reason-${deckId}`}
              value={r}
              checked={reason === r}
              onChange={() => setReason(r)}
              className="size-4 accent-primary"
            />
            {LABELS[r]}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Note (optional)
        <Input
          value={note}
          maxLength={MAX_REPORT_NOTE}
          onChange={(e) => setNote(e.target.value)}
          className="h-10 text-base"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={state === "sending"}>
          Send report
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
