import {
  Confirmation,
  ConfirmationRequest,
  ConfirmationAccepted,
  ConfirmationRejected,
  ConfirmationActions,
  ConfirmationAction,
} from "@/components/ai-elements/confirmation.tsx"
import { Badge } from "@workspace/ui/components/badge"
import { FileText } from "lucide-react"
import {
  coachReadLabel,
  coachToolLabel,
  humanToolText,
} from "./coach-tool-labels.ts"
import {
  isCompactCoachTool,
  refusedApproval,
  refusedApprovalLine,
  toolCardProps,
} from "./coach-tool-card.ts"
import { documentEditDetail, receiptHeadline } from "./coach-receipt.ts"
import { useQueryClient } from "@tanstack/react-query"
import { parseChatId, parsePendingActionId } from "@workspace/domain"
import { useChatStore } from "./use-chat-store.ts"
import { refreshReads, runContractCommand } from "@/lib/contract-client.ts"
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

export function CoachToolExtras({
  tool,
  undoLabel = "Undo",
  canUndo,
  onUndo,
}: ExtrasProps) {
  const { part } = tool
  const edit =
    part.ok && !part.pendingActionId ? documentEditDetail(part.detail) : null
  const readLabel = part.ok ? coachReadLabel(tool.name) : undefined
  const note =
    edit || readLabel || part.pendingActionId ? null : receiptReversalNote(part)
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

  if (readLabel && !part.pendingActionId && !part.undone)
    return <p className="text-[13px] text-muted-foreground">{readLabel}</p>

  if (part.undone) {
    return <p className="text-xs text-muted-foreground">Undone</p>
  }

  const refused = refusedApproval(tool)
  if (refused)
    return (
      <p role="status" className="text-[13px] text-muted-foreground">
        {refusedApprovalLine(refused)}
      </p>
    )

  return (
    <div className="min-w-0 space-y-2 text-xs text-muted-foreground">
      {part.pendingActionId ? (
        <CoachApproval
          id={part.pendingActionId}
          status={part.approval ?? "pending"}
          command={tool.name}
          tool={tool}
          review={part.review}
        />
      ) : null}
      {part.ok && !part.pendingActionId && !edit && part.detail ? (
        <ReceiptDetail detail={part.detail} />
      ) : null}
      {note ? (
        <p className="min-w-0 [overflow-wrap:anywhere] break-words">
          {humanToolText(note)}
        </p>
      ) : null}
      <div
        className={
          edit
            ? "flex w-full min-w-0 items-center gap-2.5 rounded-[12px] border border-border px-3 py-2.5"
            : "flex min-w-0 items-center gap-1.5"
        }
      >
        {edit ? (
          <>
            <span
              aria-hidden="true"
              className="grid size-[26px] shrink-0 place-items-center rounded-[7px] bg-foreground text-background"
            >
              <FileText className="size-[13px]" />
            </span>
            <p className="min-w-0 flex-1 text-[12.5px] leading-[1.2] font-semibold [overflow-wrap:anywhere] text-foreground">
              {receiptHeadline(part)}
            </p>
            {edit.docId ? (
              <a
                href={`/paper/${edit.docId}`}
                className={`inline-flex h-11 shrink-0 items-center rounded-[7px] glow px-2.5 text-xs font-medium no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:opacity-80 md:h-[26px] ${RECEIPT_HIT}`}
              >
                Open
              </a>
            ) : null}
          </>
        ) : null}
        {canUndo && receiptShowsUndo(part) ? (
          <Button
            className={
              edit
                ? `h-11 rounded-[7px] px-2.5 text-xs md:h-[26px] ${RECEIPT_HIT}`
                : `h-11 md:h-6 ${RECEIPT_HIT}`
            }
            type="button"
            variant="ghost"
            size="xs"
            aria-label={undoLabel}
            disabled={pending}
            onClick={() => void undo()}
          >
            {pending ? "Undoing…" : "Undo"}
          </Button>
        ) : null}
      </div>
      {undoError ? (
        <ErrorBanner variant="inline">{humanToolText(undoError)}</ErrorBanner>
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
  tool,
  review,
}: {
  id: string
  status: "pending" | "approved" | "denied" | "expired"
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
  const documentName = detail ? detail.docName : "your document"
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
          ? "gap-2.5 rounded-[12px] border border-border px-3 py-2.5 text-foreground"
          : "border-0 bg-transparent p-0 text-[13px] text-muted-foreground"
      }
    >
      <ConfirmationRequest>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 text-[12.5px] leading-[1.2] font-semibold [overflow-wrap:anywhere]">
            {command === "paper.edit"
              ? `Coach wants to edit ${documentName}`
              : `Coach wants to ${coachToolLabel(command).replace(/^./, (letter) => letter.toLowerCase())}`}
          </h3>
          <Badge variant="outline">Needs your approval</Badge>
        </div>
        {detail?.hunks.length ? (
          <DiffBlock detail={detail} />
        ) : batch.state !== "none" ? null : (
          <div className="space-y-1 text-sm leading-relaxed text-muted-foreground">
            <p>{humanToolText(tool.part.summary)}</p>
            <p>
              {command === "paper.edit"
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
          effectiveStatus === "expired" ? "expired" : "denied"
        )}
      </ConfirmationRejected>
      <ConfirmationActions className="justify-start self-start">
        {batch.state === "withheld" ? null : (
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
