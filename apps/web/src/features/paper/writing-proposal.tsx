import { useEffect, useReducer, useSyncExternalStore } from "react"
import { Button } from "@workspace/ui/components/button"

import {
  noteWritingProposalOutcome,
  subscribeWritingOutcome,
  subscribeWritingProposal,
  writingOutcome,
  writingProposal,
} from "@/lib/writing-proposal.ts"
import { subscribeWritingRefresh } from "@/lib/writing-refresh.ts"

const DOCK_MISSING = "Open Coach from the dock to review this change."

type ReviewErrorAction = { type: "set"; message: string | null }

function reviewErrorReducer(
  _state: string | null,
  action: ReviewErrorAction
): string | null {
  return action.message
}

function suggestionLine(count: number) {
  const changes = Math.max(count, 1)
  return changes === 1
    ? "Coach suggested 1 change"
    : `Coach suggested ${changes} changes`
}

function openCoach(dock: HTMLElement) {
  if (dock.getAttribute("aria-expanded") !== "true") dock.click()
  requestAnimationFrame(() => {
    const panel = document.getElementById("coach-panel")
    const card = panel?.querySelector('[aria-label="Review Coach action"]')
    const button = card?.querySelector("button:not([disabled])")
    if (button instanceof HTMLElement) {
      button.focus()
      return
    }
    if (card instanceof HTMLElement) card.focus()
  })
}

export function WritingProposalCard({ docId }: { docId: string }) {
  const proposal = useSyncExternalStore(
    subscribeWritingProposal,
    writingProposal,
    () => null
  )
  const outcome = useSyncExternalStore(
    subscribeWritingOutcome,
    writingOutcome,
    () => null
  )
  const [reviewError, dispatchReviewError] = useReducer(
    reviewErrorReducer,
    null
  )
  useEffect(
    () =>
      subscribeWritingRefresh(() => {
        const live = writingProposal()
        if (!live || live.docId !== docId || live.withheld) return
        noteWritingProposalOutcome(docId, "approved")
      }),
    [docId]
  )

  const mine = proposal?.docId === docId ? proposal : null
  const settled = !mine && outcome?.docId === docId ? outcome : null
  if (!reviewError && !mine && !settled) return null

  function review() {
    const dock = document.querySelector("[data-dock-coach]")
    if (!(dock instanceof HTMLElement)) {
      dispatchReviewError({ type: "set", message: DOCK_MISSING })
      return
    }
    dispatchReviewError({ type: "set", message: null })
    openCoach(dock)
  }

  const showReview = Boolean(reviewError || mine)
  return (
    <section
      aria-label="Coach proposal"
      data-slot="writing-proposal-notice"
      className="mx-auto flex w-[min(100%-3rem,816px)] flex-wrap items-center gap-x-3 gap-y-2 pt-4"
    >
      {reviewError ? (
        <p role="alert" className="text-sm text-destructive">
          {reviewError}
        </p>
      ) : mine?.withheld ? (
        <p role="status" className="text-sm text-muted-foreground/84">
          {mine.withheld}
        </p>
      ) : mine ? (
        <p className="text-sm text-foreground">
          {suggestionLine(mine.changes.length)}
        </p>
      ) : settled ? (
        <p role="status" className="text-sm text-muted-foreground/84">
          {settled.phase === "approved" ? "Approved" : "Undone"}
        </p>
      ) : null}
      {showReview ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 md:h-8"
          onClick={review}
        >
          Review in Coach
        </Button>
      ) : null}
    </section>
  )
}
