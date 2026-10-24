import { useState } from "react"
import type { ThreadToolPart } from "@workspace/domain"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { ErrorBanner } from "@/components/error-banner.tsx"
import {
  Tool,
  ToolContent,
  ToolHeader,
} from "@/components/ai-elements/tool.tsx"
import {
  receiptHeadline,
  receiptReversalNote,
} from "@/features/home/coach-receipt.ts"
import { RichReceiptBody } from "@/features/home/rich-receipts.tsx"

export const UNDO_FAILED_COPY =
  "Couldn't undo this change. Try again, or edit it yourself."

type Props = {
  part: ThreadToolPart
  canUndo: boolean
  onUndo?: () => Promise<void>
  enter?: boolean
  enterDelayMs?: number
  announceUndone?: boolean
}

export function CoachToolLine({
  part,
  canUndo,
  onUndo,
  enter,
  enterDelayMs,
  announceUndone,
}: Props) {
  const note = receiptReversalNote(part)
  const [pending, setPending] = useState(false)
  const [undoError, setUndoError] = useState<string | null>(null)
  const collapsed = part.undone === true

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

  return (
    <Tool
      role="status"
      aria-label={part.ok ? "Command succeeded" : "Command failed"}
      data-coach-receipt-enter={enter || undefined}
      data-coach-receipt-collapse={collapsed || undefined}
      className={cn(
        enter && "coach-receipt-enter",
        collapsed && "coach-receipt-collapse"
      )}
      style={
        enter && enterDelayMs
          ? { animationDelay: `${enterDelayMs}ms` }
          : undefined
      }
    >
      <div
        className={cn("min-w-0", collapsed && "coach-receipt-collapse-inner")}
      >
        <ToolHeader state={part.ok ? "completed" : "error"}>
          {receiptHeadline(part)}
        </ToolHeader>
        <ToolContent>
          {announceUndone ? (
            <p className="coach-undone-flash" data-slot="coach-undone">
              Undone
            </p>
          ) : null}
          {part.ok && part.detail && !collapsed ? (
            <div className="min-w-0">
              <RichReceiptBody detail={part.detail} />
            </div>
          ) : null}
          {!part.ok ? <p>Nothing changed.</p> : null}
          {note && !collapsed ? (
            <p className="min-w-0 [overflow-wrap:anywhere] break-words">
              {note}
            </p>
          ) : null}
          {canUndo ? (
            <div className="pt-0.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                aria-label="Undo"
                disabled={pending}
                onClick={() => void undo()}
              >
                {pending ? "Undoing…" : "Undo"}
              </Button>
            </div>
          ) : null}
          {undoError ? (
            <ErrorBanner variant="inline">{undoError}</ErrorBanner>
          ) : null}
        </ToolContent>
      </div>
    </Tool>
  )
}
