import { useQueryClient } from "@tanstack/react-query"
import { parseChatId, parsePendingActionId } from "@workspace/domain"
import { useChatStore } from "./use-chat-store.ts"
import { refreshReads, runContractCommand } from "@/lib/contract-client.ts"
import { useReducer } from "react"

import { Button } from "@workspace/ui/components/button"
import { ToolCallCard } from "@workspace/ui/components/tool-call-card"

import { ErrorBanner } from "@/components/error-banner.tsx"
import { ApiError } from "@/lib/api-error.ts"
import { notifyWritingRefresh } from "@/lib/writing-refresh.ts"
import {
  receiptReversalNote,
  receiptShowsUndo,
} from "@/features/coach/coach-receipt.ts"
import { ReceiptDetail } from "@/features/coach/rich-receipts.tsx"

import type { CoachToolPart } from "./coach-parts.ts"

export const UNDO_FAILED_COPY =
  "Couldn't undo this change. Try again, or edit it yourself."

function undoFailureCopy(cause: unknown) {
  if (
    cause instanceof ApiError &&
    (cause.status === 409 || cause.code === "CONFLICT") &&
    cause.message.trim() !== ""
  ) {
    return cause.message
  }
  return UNDO_FAILED_COPY
}

type ActionState = { busy: boolean; error: string | null }

type ActionEvent =
  | { type: "started" }
  | { type: "failed"; message: string }
  | { type: "settled" }

const IDLE_ACTION: ActionState = { busy: false, error: null }

function actionReducer(state: ActionState, event: ActionEvent): ActionState {
  switch (event.type) {
    case "started":
      return { busy: true, error: null }
    case "failed":
      return { ...state, error: event.message }
    case "settled":
      return { ...state, busy: false }
  }
}

// eslint-disable-next-line react-refresh/only-export-components -- shared with the grouped renderer
export function toolCardProps(tool: CoachToolPart) {
  const failed = tool.status === "error"
  const needsApproval = tool.part.approval === "pending"
  return {
    name: needsApproval ? `Awaiting approval: ${tool.label}` : tool.label,
    args: { command: tool.name },
    status: needsApproval
      ? "running"
      : failed
        ? "error"
        : tool.status === "done"
          ? "success"
          : "running",
    result: tool.status === "done" ? tool.part.summary : undefined,
    error: failed ? "Nothing changed." : undefined,
    defaultOpen: failed,
  } as const
}

export function CoachToolCard({ tool }: { tool: CoachToolPart }) {
  return <ToolCallCard {...toolCardProps(tool)} />
}

type ExtrasProps = {
  tool: CoachToolPart
  undoLabel?: string
  canUndo: boolean
  onUndo?: () => Promise<void>
}

export function CoachToolExtras({
  tool,
  undoLabel = "Undo",
  canUndo,
  onUndo,
}: ExtrasProps) {
  const { part } = tool
  const note = receiptReversalNote(part)
  const [{ busy: pending, error: undoError }, dispatch] = useReducer(
    actionReducer,
    IDLE_ACTION
  )

  async function undo() {
    if (!onUndo || pending) return
    dispatch({ type: "started" })
    try {
      await onUndo()
    } catch (cause) {
      dispatch({ type: "failed", message: undoFailureCopy(cause) })
    } finally {
      dispatch({ type: "settled" })
    }
  }

  if (part.undone) {
    return <p className="text-xs text-muted-foreground">Undone</p>
  }

  return (
    <div className="min-w-0 space-y-2 text-xs text-muted-foreground">
      {part.pendingActionId ? (
        <CoachApproval
          id={part.pendingActionId}
          status={part.approval ?? "pending"}
          command={tool.name}
        />
      ) : null}
      {part.ok && part.detail ? <ReceiptDetail detail={part.detail} /> : null}
      {note ? (
        <p className="min-w-0 [overflow-wrap:anywhere] break-words">{note}</p>
      ) : null}
      {canUndo && receiptShowsUndo(part) ? (
        <Button
          className="h-11 md:h-6"
          type="button"
          variant="outline"
          size="xs"
          aria-label={undoLabel}
          disabled={pending}
          onClick={() => void undo()}
        >
          {pending ? "Undoing…" : "Undo"}
        </Button>
      ) : null}
      {undoError ? (
        <ErrorBanner variant="inline">{undoError}</ErrorBanner>
      ) : null}
    </div>
  )
}

export function CoachToolLine(props: ExtrasProps) {
  return (
    <div className="min-w-0 space-y-2">
      <CoachToolCard tool={props.tool} />
      <CoachToolExtras {...props} />
    </div>
  )
}

function CoachApproval({
  id,
  status,
  command,
}: {
  id: string
  status: "pending" | "approved" | "denied" | "expired"
  command: string
}) {
  const client = useQueryClient()
  const { activeChatId } = useChatStore()
  const [{ busy: working, error }, dispatch] = useReducer(
    actionReducer,
    IDLE_ACTION
  )
  async function decide(approve: boolean) {
    if (working) return
    dispatch({ type: "started" })
    try {
      await runContractCommand(
        client,
        approve ? "actions.approve" : "actions.deny",
        { pendingActionId: parsePendingActionId(id) }
      )
      if (approve && command === "paper.edit") notifyWritingRefresh()
      await refreshReads(client, [{ query: "chat.list" }])
      if (activeChatId)
        await refreshReads(client, [
          { query: "chat.get", input: { chatId: parseChatId(activeChatId) } },
        ])
    } catch (cause) {
      dispatch({
        type: "failed",
        message:
          cause instanceof Error
            ? cause.message
            : "Could not update this action. Try again.",
      })
    } finally {
      dispatch({ type: "settled" })
    }
  }
  return (
    <div className="space-y-2">
      {status === "pending" ? (
        <>
          <p>Review this action before it runs.</p>
          <div className="flex gap-2">
            <Button
              className="h-11 md:h-6"
              size="xs"
              disabled={working}
              onClick={() => void decide(true)}
            >
              Approve
            </Button>
            <Button
              className="h-11 md:h-6"
              size="xs"
              variant="outline"
              disabled={working}
              onClick={() => void decide(false)}
            >
              Deny
            </Button>
          </div>
        </>
      ) : (
        <p>
          {status === "approved"
            ? "Approved"
            : status === "denied"
              ? "Denied · nothing changed"
              : "Expired · ask Coach again"}
        </p>
      )}
      {error ? <ErrorBanner variant="inline">{error}</ErrorBanner> : null}
    </div>
  )
}
