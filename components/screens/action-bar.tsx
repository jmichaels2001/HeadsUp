"use client"

import { cn } from "cn"
import {
  Check,
  CircleHelp,
  Hourglass,
  MessageCircleQuestion,
  PartyPopper,
  Sparkles,
  X,
} from "lucide-react"
import { useState, type FormEvent, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ViewerState } from "@/lib/game"
import { useRoom } from "@/lib/mock/room-provider"

import { nameOf, playerById } from "./game-screen"

/** Sticky bottom bar: what's happening now and what you can do about it. */
export function ActionBar({ view }: { view: ViewerState }) {
  return (
    <div className="sticky bottom-0 z-30 border-t-2 border-ink bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 sm:px-6">
        <LastResult view={view} />
        <TurnPanel view={view} />
      </div>
    </div>
  )
}

function LastResult({ view }: { view: ViewerState }) {
  const result = view.round?.lastResult
  if (!result) return null
  const guesser = playerById(view, result.guesserId)
  const who = nameOf(view, result.guesserId)
  return (
    <p
      role="status"
      className={cn(
        "flex items-center gap-2 rounded-xl border-2 border-ink px-3 py-2 text-sm font-semibold",
        result.correct ? "bg-success-soft" : "bg-muted",
      )}
    >
      {result.correct ? (
        <>
          <PartyPopper className="size-4 shrink-0" aria-hidden />
          <span>
            {who} got it!
            {guesser?.card && (
              <>
                {" "}
                {guesser.isYou ? "You were" : "They were"}{" "}
                <strong>
                  {guesser.card.emoji} {guesser.card.label}
                </strong>
                .
              </>
            )}
          </span>
        </>
      ) : (
        <>
          <X className="size-4 shrink-0" aria-hidden />
          <span>
            Not yet for {who}: &ldquo;{result.text}&rdquo;
          </span>
        </>
      )}
    </p>
  )
}

function Prompt({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-secondary [&_svg]:size-5">
          {icon}
        </span>
        <div className="min-w-0 flex-1 font-heading text-xl leading-snug font-semibold text-balance">
          {title}
        </div>
      </div>
      {children}
    </div>
  )
}

function TurnPanel({ view }: { view: ViewerState }) {
  const { actions } = useRoom()
  const turn = view.round?.turn
  const you = view.you

  if (!turn || !you) return null

  if (you.status === "waiting") {
    return (
      <Prompt icon={<Hourglass />} title="You'll get a card next round">
        <p className="text-sm text-muted-foreground">
          Hang out and help answer questions in the meantime.
        </p>
      </Prompt>
    )
  }

  const activeName = nameOf(view, turn.activePlayerId)
  const yourTurn = turn.activePlayerId === you.id
  const solvedNote = you.status === "solved" && (
    <p className="text-sm font-semibold text-success">
      You solved yours. Keep helping, your vote still counts!
    </p>
  )

  if (turn.kind === "voting") {
    const { guess } = turn
    if (!guess.canVote) {
      return (
        <Prompt
          icon={<Hourglass />}
          title={<>Your guess: &ldquo;{guess.text}&rdquo;</>}
        >
          <VoteProgress voted={guess.votedCount} total={guess.eligibleCount} />
        </Prompt>
      )
    }
    return (
      <Prompt
        icon={<CircleHelp />}
        title={
          <>
            {activeName} guesses: &ldquo;{guess.text}&rdquo;
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Is that right? Check {activeName}&apos;s card.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            variant={guess.yourVote === "correct" ? "success" : "outline"}
            aria-pressed={guess.yourVote === "correct"}
            onClick={() => actions.castVote("correct")}
          >
            <Check aria-hidden />
            Correct
          </Button>
          <Button
            size="lg"
            variant={guess.yourVote === "notYet" ? "destructive" : "outline"}
            aria-pressed={guess.yourVote === "notYet"}
            onClick={() => actions.castVote("notYet")}
          >
            <X aria-hidden />
            Not yet
          </Button>
        </div>
        <VoteProgress voted={guess.votedCount} total={guess.eligibleCount} />
        {solvedNote}
      </Prompt>
    )
  }

  if (turn.kind === "asking") {
    if (yourTurn) {
      return (
        <Prompt
          icon={<MessageCircleQuestion />}
          title={
            turn.question ? (
              <>You asked: &ldquo;{turn.question}&rdquo;</>
            ) : (
              "Ask your question out loud"
            )
          }
        >
          <p className="text-sm text-muted-foreground">
            Listen to the group&apos;s answer, then continue.
          </p>
          <Button size="lg" onClick={actions.questionAnswered}>
            {view.settings.passAfterQuestion
              ? "Got my answer, pass the turn"
              : "Got my answer"}
          </Button>
        </Prompt>
      )
    }
    return (
      <Prompt
        icon={<MessageCircleQuestion />}
        title={
          turn.question ? (
            <>
              {activeName} asks: &ldquo;{turn.question}&rdquo;
            </>
          ) : (
            `${activeName} is asking a question`
          )
        }
      >
        <p className="text-sm text-muted-foreground">Answer out loud!</p>
        {solvedNote}
      </Prompt>
    )
  }

  if (yourTurn) return <YourTurnActions />

  return (
    <Prompt icon={<Hourglass />} title={`${activeName}'s turn`}>
      <p className="text-sm text-muted-foreground">
        Waiting for {activeName} to ask a question or make a guess.
      </p>
      {solvedNote}
    </Prompt>
  )
}

function YourTurnActions() {
  const { actions } = useRoom()
  const [mode, setMode] = useState<"choose" | "ask" | "guess">("choose")
  const [text, setText] = useState("")

  function submit(e: FormEvent) {
    e.preventDefault()
    if (mode === "ask") actions.askQuestion(text)
    if (mode === "guess" && text.trim()) actions.makeGuess(text)
  }

  if (mode === "choose") {
    return (
      <Prompt icon={<Sparkles />} title="Your turn!">
        <p className="text-sm text-muted-foreground">
          Ask the group a yes/no question about your card, or take a guess.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button size="lg" onClick={() => setMode("ask")}>
            <MessageCircleQuestion aria-hidden />
            Ask
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => setMode("guess")}
          >
            <CircleHelp aria-hidden />
            Guess
          </Button>
        </div>
      </Prompt>
    )
  }

  const asking = mode === "ask"
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <label
        htmlFor="turn-input"
        className="font-heading text-xl font-semibold"
      >
        {asking ? "What's your question?" : "Who or what are you?"}
      </label>
      <Input
        id="turn-input"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={120}
        placeholder={asking ? "Am I an animal? (optional)" : "I'm a penguin!"}
      />
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={() => {
            setMode("choose")
            setText("")
          }}
        >
          Back
        </Button>
        <Button
          type="submit"
          size="lg"
          variant={asking ? "default" : "secondary"}
          disabled={!asking && !text.trim()}
        >
          {asking ? "Ask the group" : "Submit guess"}
        </Button>
      </div>
    </form>
  )
}

function VoteProgress({ voted, total }: { voted: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-3 flex-1 overflow-hidden rounded-full border-2 border-ink bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={voted}
        aria-label="Votes in"
      >
        <div
          className="h-full bg-primary transition-[width]"
          style={{ width: `${total ? (voted / total) * 100 : 0}%` }}
        />
      </div>
      <span className="text-sm font-bold text-muted-foreground">
        {voted}/{total} voted
      </span>
    </div>
  )
}
