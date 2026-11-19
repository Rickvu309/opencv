import { FileText, Wrench } from "lucide-react"
import { coachToolLabel, humanToolText } from "./coach-tool-labels.ts"
import {
  coachActionView,
  type CoachActionView,
  documentRecordStateLine,
  receiptStateLine,
  refusedApprovalLine,
} from "./coach-tool-card.ts"
import { documentChangeCount, documentEditDetail } from "./coach-receipt.ts"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { parseChatId, parsePendingActionId } from "@workspace/domain"
import { coachPaperOptions } from "@/lib/coach-context.ts"
import { useChatStore } from "./use-chat-store.ts"
import {
  queryKey,
  refreshReads,
  runContractCommand,
} from "@/lib/contract-client.ts"
import { useReducer, useRef } from "react"
import { Link } from "@tanstack/react-router"

import { ActionCard } from "@workspace/ui/components/action-card"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { ErrorBanner } from "@/components/error-banner.tsx"
import { ApiError } from "@/lib/api-error.ts"
import { notifyWritingRefresh } from "@/lib/writing-refresh.ts"
import {
  receiptReversalNote,
  receiptShowsUndo,
} from "@/features/coach/coach-receipt.ts"
import { DiffBlock, ReceiptDetail } from "@/features/coach/rich-receipts.tsx"
import { WordBatchPreview } from "@/features/coach/word-batch-preview.tsx"
import { useWordBatchApproval } from "@/lib/writing-proposal.ts"

import type { CoachToolPart } from "./coach-parts.ts"

export const UNDO_FAILED_COPY =
  "Couldn't undo this change. Try again, or edit it yourself."

function undoFailureCopy(cause: unknown) {
  if (!(cause instanceof ApiError)) return UNDO_FAILED_COPY
  const reason = cause.message.trim()
  if (
    (cause.status === 409 || cause.code === "CONFLICT") &&
    reason.includes("Undo was skipped")
  ) {
    return reason
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

type LineProps = {
  tool: CoachToolPart
  undoLabel?: string
  canUndo: boolean
  onUndo?: () => Promise<void>
}

const TOUCH_HIT =
  "relative after:absolute after:inset-[min(0px,calc((100%-44px)/2))] after:content-['']"

const RECORD_ACTION = cn(
  "rounded-sm px-2.5 text-xs text-foreground no-underline md:h-[26px]",
  TOUCH_HIT
)

const DECISION = cn("rounded-md px-3 text-[13px]", TOUCH_HIT)

function useUndoAction(onUndo?: () => Promise<void>) {
  const [{ busy, error }, dispatch] = useReducer(actionReducer, IDLE_ACTION)
  async function undo() {
    if (!onUndo || busy) return
    dispatch({ type: "started" })
    try {
      await onUndo()
    } catch (cause) {
      dispatch({ type: "failed", message: undoFailureCopy(cause) })
    } finally {
      dispatch({ type: "settled" })
    }
  }
  return { busy, error, undo }
}

function UndoButton({
  label,
  busy,
  onUndo,
}: {
  label: string
  busy: boolean
  onUndo: () => void
}) {
  return (
    <Button
      className={RECORD_ACTION}
      type="button"
      variant="ghost"
      size="touch"
      aria-label={label}
      disabled={busy}
      onClick={onUndo}
    >
      {busy ? "Undoing…" : "Undo"}
    </Button>
  )
}

function DocumentActionRecord({
  view,
  undoLabel,
  canUndo,
  onUndo,
}: {
  view: Extract<CoachActionView, { kind: "document" }>
  undoLabel: string
  canUndo: boolean
  onUndo?: () => Promise<void>
}) {
  const { busy, error, undo } = useUndoAction(onUndo)
  const showUndo = view.state !== "undone" && canUndo && view.canUndo
  const open = view.docId ? (
    <Link
      to="/paper/$docId"
      params={{ docId: view.docId }}
      className={cn(
        buttonVariants({ variant: "ghost", size: "touch" }),
        RECORD_ACTION
      )}
    >
      Open
    </Link>
  ) : null
  return (
    <ActionCard
      data-state={view.state}
      icon={<FileText />}
      title={view.name}
      state={documentRecordStateLine(view)}
      actions={
        open || showUndo ? (
          <>
            {open}
            {showUndo ? (
              <UndoButton
                label={undoLabel}
                busy={busy}
                onUndo={() => void undo()}
              />
            ) : null}
          </>
        ) : null
      }
    >
      {error ? (
        <ErrorBanner variant="inline">{humanToolText(error)}</ErrorBanner>
      ) : null}
    </ActionCard>
  )
}

function ToolReceipt({ tool, undoLabel, canUndo, onUndo }: LineProps) {
  const { part } = tool
  const note = receiptReversalNote(part)
  const { busy, error, undo } = useUndoAction(onUndo)
  const detail = part.ok && part.detail ? part.detail : null
  return (
    <ActionCard
      icon={<Wrench />}
      title={humanToolText(tool.label)}
      state={
        tool.status === "error" ? (
          <span role="status">{receiptStateLine(tool)}</span>
        ) : (
          receiptStateLine(tool)
        )
      }
      actions={
        canUndo && receiptShowsUndo(part) ? (
          <UndoButton
            label={undoLabel ?? "Undo"}
            busy={busy}
            onUndo={() => void undo()}
          />
        ) : null
      }
    >
      {detail || note || error ? (
        <>
          {detail ? <ReceiptDetail detail={detail} /> : null}
          {note ? (
            <p className="min-w-0 [overflow-wrap:anywhere] break-words">
              {humanToolText(note)}
            </p>
          ) : null}
          {error ? (
            <ErrorBanner variant="inline">{humanToolText(error)}</ErrorBanner>
          ) : null}
        </>
      ) : null}
    </ActionCard>
  )
}

export function CoachToolLine({
  tool,
  undoLabel = "Undo",
  canUndo,
  onUndo,
}: LineProps) {
  const view = coachActionView(tool.part)
  switch (view.kind) {
    case "read":
      return <p className="text-[13px] text-muted-foreground">{view.label}</p>
    case "undone":
      return <p className="text-xs text-muted-foreground">Undone</p>
    case "refused":
      return (
        <p role="status" className="text-[13px] text-muted-foreground">
          {refusedApprovalLine(view.status)}
        </p>
      )
    case "proposed":
      return (
        <CoachApproval
          id={tool.part.pendingActionId ?? ""}
          status={tool.part.approval ?? "pending"}
          command={tool.name}
          tool={tool}
          review={tool.part.review}
        />
      )
    case "document":
      return (
        <DocumentActionRecord
          view={view}
          undoLabel={undoLabel}
          canUndo={canUndo}
          onUndo={onUndo}
        />
      )
    case "receipt":
      return (
        <ToolReceipt
          tool={tool}
          undoLabel={undoLabel}
          canUndo={canUndo}
          onUndo={onUndo}
        />
      )
  }
}

function reviewDocId(review: unknown) {
  return review &&
    typeof review === "object" &&
    "docId" in review &&
    typeof review.docId === "string"
    ? review.docId
    : null
}

function useDocumentName(docId: string | null) {
  const papers = useQuery({
    queryKey: queryKey({ query: "paper.list" }),
    queryFn: coachPaperOptions,
    enabled: docId !== null,
    retry: false,
  })
  return docId
    ? (papers.data?.find((doc) => doc.id === docId)?.name ?? null)
    : null
}

function CoachApproval({
  id,
  status,
  command,
  tool,
  review,
}: {
  id: string
  status: NonNullable<CoachToolPart["part"]["approval"]>
  command: string
  tool: CoachToolPart
  review?: unknown
}) {
  const client = useQueryClient()
  const { activeChatId } = useChatStore()
  const batch = useWordBatchApproval(id, review)
  const [{ busy: working, error }, dispatch] = useReducer(
    actionReducer,
    IDLE_ACTION
  )
  const lock = useRef(false)
  const [decision, setDecision] = useReducer(
    (_previous: boolean | null, approved: boolean) => approved,
    null
  )
  const effectiveStatus =
    decision === null ? status : decision ? "approved" : "denied"
  async function decide(approve: boolean) {
    if (lock.current || working || effectiveStatus !== "pending") return
    lock.current = true
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
      setDecision(approve)
    } catch (cause) {
      lock.current = false
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
  const detail = documentEditDetail(tool.part.detail)
  const isDocument = command === "paper.edit"
  const storedName = useDocumentName(
    isDocument && !detail ? reviewDocId(review) : null
  )
  const subject = isDocument
    ? (detail?.docName ?? storedName ?? "Your document")
    : coachToolLabel(command)
  const changeCount = detail?.hunks.length
    ? documentChangeCount(detail)
    : batch.state === "ready"
      ? batch.changes.length
      : 0
  const waiting = isDocument
    ? changeCount > 0
      ? `${changeCount} change${changeCount === 1 ? "" : "s"} to approve`
      : "Edit to approve"
    : "Action to approve"
  if (effectiveStatus !== "pending")
    return (
      <p role="status" className="text-[13px] text-muted-foreground">
        {effectiveStatus === "approved"
          ? "Approved"
          : refusedApprovalLine(effectiveStatus)}
      </p>
    )
  return (
    <ActionCard
      role="region"
      aria-label="Review Coach action"
      icon={isDocument ? <FileText /> : <Wrench />}
      title={subject}
      state={waiting}
      actions={
        <>
          {batch.state === "withheld" ? null : (
            <Button
              className={DECISION}
              size="touch"
              type="button"
              variant="primary"
              disabled={working}
              onClick={() => void decide(true)}
            >
              Approve
            </Button>
          )}
          <Button
            className={DECISION}
            size="touch"
            type="button"
            variant="default"
            disabled={working}
            onClick={() => void decide(false)}
          >
            Deny
          </Button>
        </>
      }
    >
      {detail?.hunks.length ? (
        <DiffBlock detail={detail} />
      ) : batch.state !== "none" ? null : (
        <div className="space-y-1 text-sm leading-relaxed text-muted-foreground">
          <p>{humanToolText(tool.part.summary)}</p>
          <p>
            {isDocument
              ? "Coach will change the text in your Paper. The proposed words are not available in this Chat. Open the document in Paper to review the current text before deciding."
              : "Review this change before allowing Coach to apply it."}
          </p>
        </div>
      )}
      <WordBatchPreview batch={batch} />
      {error ? (
        <ErrorBanner variant="inline">{humanToolText(error)}</ErrorBanner>
      ) : null}
    </ActionCard>
  )
}
