import {
  Confirmation,
  ConfirmationRequest,
  ConfirmationAccepted,
  ConfirmationRejected,
  ConfirmationActions,
  ConfirmationAction,
} from "@/components/ai-elements/confirmation.tsx"
import { FileText } from "lucide-react"
import { coachToolLabel, humanToolText } from "./coach-tool-labels.ts"
import {
  isCompactCoachTool,
  coachActionView,
  type CoachActionView,
  refusedApprovalLine,
  toolCardProps,
} from "./coach-tool-card.ts"
import { documentChangeCount, documentEditDetail } from "./coach-receipt.ts"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  parseChatId,
  parsePendingActionId,
  richReviewSchema,
} from "@workspace/domain"
import { coachPaperOptions } from "@/lib/coach-context.ts"
import { useChatStore } from "./use-chat-store.ts"
import {
  queryKey,
  refreshReads,
  runContractCommand,
} from "@/lib/contract-client.ts"
import { useReducer, useRef } from "react"

import { Button } from "@workspace/ui/components/button"
import { ToolCallCard } from "@workspace/ui/components/tool-call-card"

import { ErrorBanner } from "@/components/error-banner.tsx"
import { ApiError } from "@/lib/api-error.ts"
import { notifyWritingRefresh } from "@/lib/writing-refresh.ts"
import {
  receiptReversalNote,
  receiptShowsUndo,
} from "@/features/coach/coach-receipt.ts"
import { DiffBlock, ReceiptDetail } from "@/features/coach/rich-receipts.tsx"
import { WordBatchPreview } from "@/features/coach/word-batch-preview.tsx"
import { RichPaperPreview } from "./rich-paper-preview.tsx"
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

export function CoachToolCard({ tool }: { tool: CoachToolPart }) {
  return isCompactCoachTool(tool) ? null : (
    <ToolCallCard {...toolCardProps(tool)} />
  )
}

type ExtrasProps = {
  tool: CoachToolPart
  undoLabel?: string
  canUndo: boolean
  onUndo?: () => Promise<void>
}

const RECEIPT_HIT =
  "relative after:absolute after:inset-[min(0px,calc((100%-44px)/2))] after:content-['']"

const RECORD_ACTION = `inline-flex h-11 shrink-0 items-center rounded-[7px] px-2.5 text-xs font-medium text-foreground no-underline transition-colors duration-(--duration-micro) ease-(--ease-micro) hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-accent active:opacity-80 md:h-[26px] ${RECEIPT_HIT}`

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

function DocumentTile({ quiet = false }: { quiet?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        quiet
          ? "grid size-[26px] shrink-0 place-items-center rounded-[7px] bg-muted text-muted-foreground"
          : "grid size-[26px] shrink-0 place-items-center rounded-[7px] bg-foreground text-background"
      }
    >
      <FileText className="size-[13px]" />
    </span>
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
  const undone = view.state === "undone"
  return (
    <div className="min-w-0 space-y-2">
      <div
        data-slot="coach-action-record"
        data-state={view.state}
        className="flex w-full min-w-0 flex-wrap items-center gap-2.5 rounded-[12px] border border-border px-3 py-2.5"
      >
        <div className="flex min-w-[min(100%,10rem)] flex-1 items-center gap-2.5">
          <DocumentTile quiet={undone} />
          <div className="min-w-0 flex-1">
            <p className="text-[0.78125rem] leading-[1.25] font-semibold [overflow-wrap:anywhere] text-foreground">
              {view.headline}
            </p>
            <p className="text-xs leading-4 text-muted-foreground">
              {undone ? "Undone" : "Applied"}
            </p>
          </div>
        </div>
        {view.docId ? (
          <a href={`/paper/${view.docId}`} className={RECORD_ACTION}>
            Open
          </a>
        ) : null}
        {!undone && canUndo && view.canUndo ? (
          <Button
            className={`h-11 rounded-[7px] px-2.5 text-xs md:h-[26px] ${RECEIPT_HIT}`}
            type="button"
            variant="ghost"
            size="xs"
            aria-label={undoLabel}
            disabled={busy}
            onClick={() => void undo()}
          >
            {busy ? "Undoing…" : "Undo"}
          </Button>
        ) : null}
      </div>
      {error ? (
        <ErrorBanner variant="inline">{humanToolText(error)}</ErrorBanner>
      ) : null}
    </div>
  )
}

export function CoachToolExtras({
  tool,
  undoLabel = "Undo",
  canUndo,
  onUndo,
}: ExtrasProps) {
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
        <div className="min-w-0 text-xs text-muted-foreground">
          <CoachApproval
            id={tool.part.pendingActionId ?? ""}
            status={tool.part.approval ?? "pending"}
            command={tool.name}
            tool={tool}
            review={tool.part.review}
          />
        </div>
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
        <ReceiptExtras
          tool={tool}
          undoLabel={undoLabel}
          canUndo={canUndo}
          onUndo={onUndo}
        />
      )
  }
}

function ReceiptExtras({
  tool,
  undoLabel = "Undo",
  canUndo,
  onUndo,
}: ExtrasProps) {
  const { part } = tool
  const note = receiptReversalNote(part)
  const { busy, error, undo } = useUndoAction(onUndo)
  return (
    <div className="min-w-0 space-y-2 text-xs text-muted-foreground">
      {part.ok && part.detail ? <ReceiptDetail detail={part.detail} /> : null}
      {note ? (
        <p className="min-w-0 [overflow-wrap:anywhere] break-words">
          {humanToolText(note)}
        </p>
      ) : null}
      {canUndo && receiptShowsUndo(part) ? (
        <div className="flex min-w-0 items-center gap-1.5">
          <Button
            className={`h-11 md:h-6 ${RECEIPT_HIT}`}
            type="button"
            variant="ghost"
            size="xs"
            aria-label={undoLabel}
            disabled={busy}
            onClick={() => void undo()}
          >
            {busy ? "Undoing…" : "Undo"}
          </Button>
        </div>
      ) : null}
      {error ? (
        <ErrorBanner variant="inline">{humanToolText(error)}</ErrorBanner>
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
  const rich = command === "paper.editRich"
  const richReview = richReviewSchema.safeParse(review)
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
      if (approve && (command === "paper.edit" || rich)) notifyWritingRefresh()
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
  const isDocument = command === "paper.edit" || rich
  const storedName = useDocumentName(
    isDocument && !detail && !rich ? reviewDocId(review) : null
  )
  const subject = isDocument
    ? richReview.success
      ? richReview.data.name
      : (detail?.docName ?? storedName ?? "Your document")
    : coachToolLabel(command)
  const changeCount = richReview.success
    ? richReview.data.changes.length
    : detail?.hunks.length
      ? documentChangeCount(detail)
      : batch.state === "ready"
        ? batch.changes.length
        : 0
  const action = isDocument
    ? changeCount > 0
      ? `${changeCount} proposed change${changeCount === 1 ? "" : "s"}`
      : "Proposed edit"
    : "Proposed action"
  const state =
    effectiveStatus === "pending" ? "approval-requested" : "approval-responded"
  const approved = effectiveStatus === "approved"
  return (
    <Confirmation
      state={state}
      approval={effectiveStatus === "pending" ? { id } : { id, approved }}
      role={effectiveStatus === "pending" ? "region" : "status"}
      aria-label={
        effectiveStatus === "pending" ? "Review Coach action" : undefined
      }
      className={
        effectiveStatus === "pending"
          ? "gap-3 rounded-[12px] border border-border px-3 py-3 text-foreground"
          : "border-0 bg-transparent p-0 text-[13px] text-muted-foreground"
      }
    >
      <ConfirmationRequest>
        <div
          data-slot="coach-approval-header"
          className="flex min-w-0 items-center gap-2.5"
        >
          {isDocument ? <DocumentTile /> : null}
          <div className="min-w-0 flex-1">
            <h3 className="text-[0.78125rem] leading-[1.25] font-semibold [overflow-wrap:anywhere] text-foreground">
              {subject}
            </h3>
            <p className="text-xs leading-4 text-muted-foreground">
              <span>{action}</span>
              <span aria-hidden="true"> · </span>
              <span>Needs your approval</span>
            </p>
          </div>
        </div>
        {rich ? (
          <RichPaperPreview review={review} />
        ) : detail?.hunks.length ? (
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
      </ConfirmationRequest>
      <ConfirmationAccepted>Approved</ConfirmationAccepted>
      <ConfirmationRejected>
        {refusedApprovalLine(
          effectiveStatus === "expired" || effectiveStatus === "stopped"
            ? effectiveStatus
            : "denied"
        )}
      </ConfirmationRejected>
      <ConfirmationActions className="justify-start self-start">
        {batch.state === "withheld" || (rich && !richReview.success) ? null : (
          <ConfirmationAction
            variant="primary"
            disabled={working}
            onClick={() => void decide(true)}
          >
            Approve
          </ConfirmationAction>
        )}
        <ConfirmationAction
          variant="default"
          disabled={working}
          onClick={() => void decide(false)}
        >
          Deny
        </ConfirmationAction>
      </ConfirmationActions>
      {error ? (
        <ErrorBanner variant="inline">{humanToolText(error)}</ErrorBanner>
      ) : null}
    </Confirmation>
  )
}
