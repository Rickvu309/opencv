import type { ChatToolPart } from "@workspace/domain"

import { coachReadLabel } from "./coach-tool-labels.ts"
import {
  documentEditDetail,
  receiptHeadline,
  receiptShowsUndo,
} from "./coach-receipt.ts"

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

export function documentIdOf(part: ChatToolPart): string | null {
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
