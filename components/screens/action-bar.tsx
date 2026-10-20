"use client"

import { cn } from "cn"
import {
  Check,
  CircleHelp,
  Hourglass,
  MessageCircleQuestion,
  PartyPopper,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react"
import { useState, type FormEvent, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { QuestionMode, ViewerState } from "@/lib/game"
import { useRoom } from "@/lib/room"

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
  const base =
    "flex items-center gap-2 rounded-xl border-2 border-ink px-3 py-2 text-sm font-semibold [&>svg]:size-4 [&>svg]:shrink-0"

  if (result.kind === "question") {
    const who = nameOf(view, result.askerId)
    const label = { yes: "Yes", no: "No", unsure: "Unsure" }[result.outcome]
    return (
      <p
        role="status"
        className={cn(
          base,
          result.outcome === "yes" && "bg-success-soft",
          result.outcome === "no" && "bg-destructive-soft",
          result.outcome === "unsure" && "bg-warning-soft",
        )}
      >
        {result.outcome === "yes" ? (
          <ThumbsUp aria-hidden />
        ) : result.outcome === "no" ? (
          <ThumbsDown aria-hidden />
        ) : (
          <CircleHelp aria-hidden />
        )}
        <span>
          {who} asked &ldquo;{result.question}&rdquo;: <strong>{label}</strong>{" "}
          ({result.yes} yes, {result.no} no)
        </span>
      </p>
    )
  }

  const guesser = playerById(view, result.guesserId)
  const who = nameOf(view, result.guesserId)
  return (
    <p
      role="status"
      className={cn(base, result.correct ? "bg-success-soft" : "bg-muted")}
    >
      {result.correct ? (
        <>
          <PartyPopper aria-hidden />
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
          <X aria-hidden />
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
    const q = turn.question

    if (q.mode === "voice") {
      if (yourTurn) {
        return (
          <Prompt
            icon={<MessageCircleQuestion />}
            title="Ask your question out loud"
          >
            <p className="text-sm text-muted-foreground">
              Listen to the group&apos;s answer, then tap below.
            </p>
            <Button size="lg" onClick={actions.questionAnswered}>
              {view.settings.passAfterQuestion ? "End turn" : "Got my answer"}
            </Button>
          </Prompt>
        )
      }
      return (
        <Prompt
          icon={<MessageCircleQuestion />}
          title={`${activeName} is asking a question`}
        >
          <p className="text-sm text-muted-foreground">Answer out loud!</p>
          {solvedNote}
        </Prompt>
      )
    }

    if (!q.canAnswer) {
      return (
        <Prompt
          icon={<Hourglass />}
          title={<>You asked: &ldquo;{q.text}&rdquo;</>}
        >
          <p className="text-sm text-muted-foreground">
            Waiting for everyone to answer.
          </p>
          <VoteProgress
            voted={q.answeredCount}
            total={q.eligibleCount}
            label="answered"
          />
        </Prompt>
      )
    }

    return (
      <Prompt
        icon={<MessageCircleQuestion />}
        title={
          <>
            {activeName} asks: &ldquo;{q.text}&rdquo;
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Check {activeName}&apos;s card and answer.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            variant={q.yourAnswer === "yes" ? "success" : "outline"}
            aria-pressed={q.yourAnswer === "yes"}
            onClick={() => actions.answerQuestion("yes")}
          >
            <ThumbsUp aria-hidden />
            Yes
          </Button>
          <Button
            size="lg"
            variant={q.yourAnswer === "no" ? "destructive" : "outline"}
            aria-pressed={q.yourAnswer === "no"}
            onClick={() => actions.answerQuestion("no")}
          >
            <ThumbsDown aria-hidden />
            No
          </Button>
        </div>
        <VoteProgress
          voted={q.answeredCount}
          total={q.eligibleCount}
          label="answered"
        />
        {solvedNote}
      </Prompt>
    )
  }

  if (yourTurn) return <YourTurnActions mode={view.settings.questionMode} />

  return (
    <Prompt icon={<Hourglass />} title={`${activeName}'s turn`}>
      <p className="text-sm text-muted-foreground">
        Waiting for {activeName} to ask a question or make a guess.
      </p>
      {solvedNote}
    </Prompt>
  )
}

function YourTurnActions({ mode: questionMode }: { mode: QuestionMode }) {
  const { actions } = useRoom()
  const [mode, setMode] = useState<"choose" | "ask" | "guess">("choose")
  const [text, setText] = useState("")

  function submit(e: FormEvent) {
    e.preventDefault()
    if (mode === "ask" && text.trim()) actions.askQuestion(text)
    if (mode === "guess" && text.trim()) actions.makeGuess(text)
  }

  if (mode === "choose") {
    return (
      <Prompt icon={<Sparkles />} title="Your turn!">
        <p className="text-sm text-muted-foreground">
          Ask the group a yes/no question about your card, or take a guess.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            onClick={() =>
              // Voice mode: no typing, just ask out loud.
              questionMode === "voice"
                ? actions.askQuestion("")
                : setMode("ask")
            }
          >
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
        placeholder={asking ? "Am I an animal?" : "I'm a penguin!"}
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
          disabled={!text.trim()}
        >
          {asking ? "Ask the group" : "Submit guess"}
        </Button>
      </div>
    </form>
  )
}

function VoteProgress({
  voted,
  total,
  label = "voted",
}: {
  voted: number
  total: number
  label?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-3 flex-1 overflow-hidden rounded-full border-2 border-ink bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={voted}
        aria-label={`${label} so far`}
      >
        <div
          className="h-full bg-primary transition-[width]"
          style={{ width: `${total ? (voted / total) * 100 : 0}%` }}
        />
      </div>
      <span className="text-sm font-bold text-muted-foreground">
        {voted}/{total} {label}
      </span>
    </div>
  )
}
