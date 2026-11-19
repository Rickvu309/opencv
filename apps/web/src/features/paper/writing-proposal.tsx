import {
  useEffect,
  useReducer,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { clearStoppedLetter } from "./paper-letter-resume.ts"
import { Button } from "@workspace/ui/components/button"

import {
  subscribeWritingOutcome,
  subscribeWritingProposal,
  writingOutcome,
  writingProposal,
} from "@/lib/writing-proposal.ts"

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
    if (card instanceof HTMLElement) {
      card.tabIndex = -1
      card.focus()
    }
  })
}

export function WritingDocumentNoticeSync({
  docId,
  text,
  onText,
}: {
  docId: string
  text: string
  onText: (text: string) => void
}) {
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      onText(text)
      if (text.trim().length > 0) clearStoppedLetter(docId)
    })
    return () => {
      active = false
    }
  })
  return null
}

export function WritingProposalCard({
  docId,
  children,
}: {
  docId: string
  children?: ReactNode
}) {
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

  const mine = proposal?.docId === docId ? proposal : null
  const settled = !mine && outcome?.docId === docId ? outcome : null

  function review() {
    const dock = document.querySelector("[data-dock-coach]")
    if (!(dock instanceof HTMLElement)) {
      dispatchReviewError({ type: "set", message: DOCK_MISSING })
      return
    }
    dispatchReviewError({ type: "set", message: null })
    openCoach(dock)
  }

  if (!reviewError && !mine && !settled) return children

  const showReview = Boolean(reviewError || mine)
  return (
    <section
      aria-label={reviewError || mine || settled ? "Coach proposal" : undefined}
      data-slot="writing-proposal-notice"
      className="flex min-h-24 w-full shrink-0 flex-wrap items-center justify-between gap-3 py-3 md:min-h-16"
    >
      {reviewError ? (
        <p
          role="alert"
          className="min-w-0 flex-1 basis-40 text-sm wrap-anywhere text-destructive"
        >
          {reviewError}
        </p>
      ) : mine?.withheld ? (
        <p
          role="status"
          className="min-w-0 flex-1 basis-40 text-sm wrap-anywhere text-muted-foreground"
        >
          {mine.withheld}
        </p>
      ) : mine ? (
        <p
          key={mine.pendingActionId ?? mine.toolCallId}
          role="status"
          className="min-w-0 flex-1 basis-40 text-sm wrap-anywhere text-foreground"
        >
          {suggestionLine(mine.changes.length)}
        </p>
      ) : settled ? (
        <p
          role="status"
          className="min-w-0 flex-1 basis-40 text-sm wrap-anywhere text-muted-foreground"
        >
          {settled.phase === "approved"
            ? "Coach's change approved"
            : "Coach's change undone"}
        </p>
      ) : null}
      {showReview ? (
        <Button
          type="button"
          variant="outline"
          className="ms-auto h-auto min-h-11 max-w-full whitespace-normal md:min-h-8"
          onClick={review}
        >
          Review in Coach
        </Button>
      ) : null}
    </section>
  )
}
