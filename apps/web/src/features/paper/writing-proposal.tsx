import { useEffect, useReducer, useSyncExternalStore } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { parseActivityId, parsePendingActionId } from "@workspace/domain"
import { Button } from "@workspace/ui/components/button"

import { messageOf } from "@/features/paper/paper-library-support.ts"
import { runContractCommand, undoActivity } from "@/lib/contract-client.ts"
import {
  subscribeWritingProposal,
  writingProposal,
  type WritingChange,
} from "@/lib/writing-proposal.ts"

type ProposalPhase = "idle" | "approving" | "approved" | "undoing" | "undone"

type ProposalState = {
  phase: ProposalPhase
  error: string | null
  activityId: string | null
  toolCallId: string | null
}

type ProposalEvent =
  | { type: "reset"; toolCallId: string | null }
  | { type: "approving" }
  | { type: "undoing" }
  | { type: "approved"; activityId: string | null }
  | { type: "undone" }
  | { type: "failed"; message: string }

const IDLE: ProposalState = {
  phase: "idle",
  error: null,
  activityId: null,
  toolCallId: null,
}

function proposalReducer(
  state: ProposalState,
  event: ProposalEvent
): ProposalState {
  switch (event.type) {
    case "reset":
      if (state.toolCallId === event.toolCallId) return state
      return { ...IDLE, toolCallId: event.toolCallId }
    case "approving":
      return { ...state, phase: "approving", error: null }
    case "undoing":
      return { ...state, phase: "undoing", error: null }
    case "approved":
      return {
        ...state,
        phase: "approved",
        error: null,
        activityId: event.activityId,
      }
    case "undone":
      return { ...state, phase: "undone", error: null }
    case "failed":
      return {
        ...state,
        phase:
          state.phase === "approving"
            ? "idle"
            : state.phase === "undoing"
              ? "approved"
              : state.phase,
        error: event.message,
      }
  }
}

const changeTitles = {
  setText: "Change a line",
  insert: "Add a line",
  delete: "Remove a line",
} as const

function shownWords(change: WritingChange, text: string) {
  return change.op !== "replace" && text === "" ? "(empty line)" : text
}

function activityIdFrom(result: unknown) {
  if (!result || typeof result !== "object") return null
  if ("activityId" in result && typeof result.activityId === "string") {
    return result.activityId
  }
  if ("id" in result && typeof result.id === "string") return result.id
  return null
}

export function WritingProposalCard({
  docId,
  onApplied,
}: {
  docId: string
  onApplied: () => Promise<void>
}) {
  const queryClient = useQueryClient()
  const proposal = useSyncExternalStore(
    subscribeWritingProposal,
    writingProposal,
    () => null
  )
  const [{ phase, error, activityId }, dispatch] = useReducer(
    proposalReducer,
    IDLE
  )
  const toolCallId = proposal?.toolCallId ?? null
  useEffect(() => {
    dispatch({ type: "reset", toolCallId })
  }, [toolCallId])

  if (!proposal || proposal.docId !== docId) return null
  const pending = proposal.pendingActionId
  const busy = phase === "approving" || phase === "undoing"

  async function approve() {
    if (!pending || busy || phase === "approved" || phase === "undone") return
    dispatch({ type: "approving" })
    try {
      const result = await runContractCommand(queryClient, "actions.approve", {
        pendingActionId: parsePendingActionId(pending),
      })
      dispatch({ type: "approved", activityId: activityIdFrom(result) })
      try {
        await onApplied()
      } catch (cause) {
        dispatch({
          type: "failed",
          message: messageOf(cause, "Could not read this page. Try again."),
        })
      }
    } catch (cause) {
      dispatch({
        type: "failed",
        message: messageOf(cause, "Could not apply this edit. Try again."),
      })
    }
  }

  async function undo() {
    if (!activityId || busy || phase !== "approved") return
    dispatch({ type: "undoing" })
    try {
      parseActivityId(activityId)
      await undoActivity(queryClient, activityId)
      dispatch({ type: "undone" })
      try {
        await onApplied()
      } catch (cause) {
        dispatch({
          type: "failed",
          message: messageOf(cause, "Could not read this page. Try again."),
        })
      }
    } catch (cause) {
      dispatch({
        type: "failed",
        message: messageOf(cause, "Could not undo this edit. Try again."),
      })
    }
  }

  return (
    <section
      aria-label="Coach proposal"
      className="mx-auto flex w-[min(100%-3rem,8.5in)] flex-col gap-3 pt-4"
    >
      <h2 className="text-sm font-medium">Coach proposal</h2>
      <p className="text-sm text-muted-foreground">
        This change waits for you.
      </p>
      <ol className="flex flex-col gap-3">
        {proposal.changes.map((change, index) => (
          <li key={index} className="flex flex-col gap-2">
            {change.op === "replace" ? null : (
              <p className="text-sm font-medium">{changeTitles[change.op]}</p>
            )}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-3">
              {change.op === "insert" ? null : (
                <div className="flex flex-col gap-1 rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">Before</p>
                  <p className="break-words whitespace-pre-wrap">
                    {shownWords(change, change.before)}
                  </p>
                </div>
              )}
              {change.op === "delete" ? null : (
                <div className="flex flex-col gap-1 rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">After</p>
                  <p className="break-words whitespace-pre-wrap">
                    {shownWords(change, change.after)}
                  </p>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {phase === "idle" || phase === "approving" ? (
          <Button
            type="button"
            className="h-11 md:h-9"
            disabled={!pending || busy}
            onClick={() => void approve()}
          >
            Approve
          </Button>
        ) : null}
        {activityId && (phase === "approved" || phase === "undoing") ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 md:h-9"
            disabled={busy}
            onClick={() => void undo()}
          >
            Undo
          </Button>
        ) : null}
        {phase === "approved" ? <p>Approved</p> : null}
        {phase === "undone" ? <p>Undone</p> : null}
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  )
}
