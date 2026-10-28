import { useQueryClient } from "@tanstack/react-query"
import { parseChatId, parsePendingActionId } from "@workspace/domain"
import { useChatStore } from "./use-chat-store.ts"
import { refreshReads, runContractCommand } from "@/lib/contract-client.ts"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { ToolCallCard } from "@workspace/ui/components/tool-call-card"

import { ErrorBanner } from "@/components/error-banner.tsx"
import {
  receiptReversalNote,
  receiptShowsUndo,
} from "@/features/coach/coach-receipt.ts"
import { ReceiptDetail } from "@/features/coach/rich-receipts.tsx"

import type { CoachToolPart } from "./coach-parts.ts"

export const UNDO_FAILED_COPY =
  "Couldn't undo this change. Try again, or edit it yourself."

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
  const [pending, setPending] = useState(false)
  const [undoError, setUndoError] = useState<string | null>(null)

  async function undo() {
    if (!onUndo || pending) return
    setPending(true)
    setUndoError(null)
    try {
      await onUndo()
    } catch {
      setUndoError(UNDO_FAILED_COPY)
    } finally {
      setPending(false)
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
        />
      ) : null}
      {part.ok && part.detail ? <ReceiptDetail detail={part.detail} /> : null}
      {note ? (
        <p className="min-w-0 [overflow-wrap:anywhere] break-words">{note}</p>
      ) : null}
      {canUndo && receiptShowsUndo(part) ? (
        <Button
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
}: {
  id: string
  status: "pending" | "approved" | "denied" | "expired"
}) {
  const client = useQueryClient()
  const { activeChatId } = useChatStore()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function decide(approve: boolean) {
    if (working) return
    setWorking(true)
    setError(null)
    try {
      await runContractCommand(
        client,
        approve ? "actions.approve" : "actions.deny",
        { pendingActionId: parsePendingActionId(id) }
      )
      await refreshReads(client, [{ query: "chat.list" }])
      if (activeChatId)
        await refreshReads(client, [
          { query: "chat.get", input: { chatId: parseChatId(activeChatId) } },
        ])
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not update this action. Try again."
      )
    } finally {
      setWorking(false)
    }
  }
  return (
    <div className="space-y-2">
      {status === "pending" ? (
        <>
          <p>Review this action before it runs.</p>
          <div className="flex gap-2">
            <Button
              size="xs"
              disabled={working}
              onClick={() => void decide(true)}
            >
              Approve
            </Button>
            <Button
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
