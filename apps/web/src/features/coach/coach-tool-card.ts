import type { ChatToolPart } from "@workspace/domain"

import { coachReadLabel, humanToolText } from "./coach-tool-labels.ts"

import type { CoachToolPart } from "./coach-parts.ts"
import {
  documentEditDetail,
  receiptHeadline,
  receiptShowsUndo,
} from "./coach-receipt.ts"

const REFUSED_APPROVAL_LINE = {
  denied: "Denied. Nothing changed.",
  expired: "Expired. Ask Coach again.",
  stopped: "Stopped. Ask Coach again.",
} as const

export function refusedApprovalLine(
  status: keyof typeof REFUSED_APPROVAL_LINE
) {
  return REFUSED_APPROVAL_LINE[status]
}

export function isCompactCoachTool(tool: CoachToolPart) {
  return coachActionView(tool.part).kind !== "receipt"
}

export function toolCardProps(tool: CoachToolPart) {
  const failed = tool.status === "error"
  const needsApproval =
    tool.part.approval === "pending" ||
    Boolean(tool.part.pendingActionId && !tool.part.approval)
  return {
    name: humanToolText(tool.label),
    status: needsApproval
      ? "awaiting"
      : failed
        ? "error"
        : tool.status === "done"
          ? "success"
          : "running",
    result:
      tool.status === "done" ? humanToolText(tool.part.summary) : undefined,
    error: failed ? "Nothing changed." : undefined,
    defaultOpen: failed,
    className: isCompactCoachTool(tool) ? "hidden" : undefined,
  } as const
}

type RefusedStatus = "denied" | "expired" | "stopped"

export type CoachActionView =
  | { kind: "proposed" }
  | { kind: "refused"; status: RefusedStatus }
  | {
      kind: "document"
      state: "applied" | "undone"
      headline: string
      docId: string | null
      canUndo: boolean
    }
  | { kind: "undone" }
  | { kind: "read"; label: string }
  | { kind: "receipt" }

const DOCUMENT_EDIT = "paper.edit"

function refusedStatus(part: ChatToolPart): RefusedStatus | null {
  const { approval } = part
  return !part.pendingActionId &&
    (approval === "denied" || approval === "expired" || approval === "stopped")
    ? approval
    : null
}

function documentIdOf(part: ChatToolPart): string | null {
  const detail =
    documentEditDetail(part.detail) ??
    (part.detail?.type === "paper.create" ? part.detail : null)
  if (detail?.docId) return detail.docId
  const input = part.reversal?.input
  if (!input || typeof input !== "object") return null
  if ("docId" in input && typeof input.docId === "string") return input.docId
  return "doc" in input && typeof input.doc === "string" ? input.doc : null
}

function isDocumentRecord(part: ChatToolPart) {
  return (
    part.ok &&
    (documentEditDetail(part.detail) !== null || part.name === DOCUMENT_EDIT)
  )
}

export function coachActionView(part: ChatToolPart): CoachActionView {
  if (part.pendingActionId) return { kind: "proposed" }
  const refused = refusedStatus(part)
  if (refused) return { kind: "refused", status: refused }
  if (isDocumentRecord(part))
    return {
      kind: "document",
      state: part.undone ? "undone" : "applied",
      headline: receiptHeadline(part),
      docId: documentIdOf(part),
      canUndo: receiptShowsUndo(part),
    }
  if (part.undone) return { kind: "undone" }
  const label = part.ok ? coachReadLabel(part.name) : undefined
  if (label) return { kind: "read", label }
  return { kind: "receipt" }
}
