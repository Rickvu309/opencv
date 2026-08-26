import {
  humanizeCommandFailCopy,
  PAPER_KIND_LABEL,
  type CoachReceiptDetail,
  type ThreadToolPart,
} from "@workspace/domain"

import { STAGES } from "@/features/apply/apply-types.ts"

export function commandNameFromTool(name: string) {
  return name.includes(".") ? name : name.replace("_", ".")
}

function stageLabel(stage: string) {
  return STAGES.find((item) => item.id === stage)?.label ?? stage
}

export function namedReceiptHeadline(detail: CoachReceiptDetail) {
  if (detail.type === "paper.updateContent") {
    return `Updated ${PAPER_KIND_LABEL[detail.docKind]} ${detail.docName}`
  }
  if (detail.type === "apply.moveCard") {
    return `Moved ${detail.title} at ${detail.company} from ${stageLabel(detail.from)} to ${stageLabel(detail.to)}`
  }
  return `Created ${PAPER_KIND_LABEL[detail.docKind]} ${detail.name}`
}

export function receiptHeadline(part: ThreadToolPart) {
  if (!part.ok) return humanizeCommandFailCopy(part.summary)
  if (part.detail) return namedReceiptHeadline(part.detail)
  return part.summary
}

export function receiptReversalNote(part: ThreadToolPart) {
  if (!part.reversal) return null
  if (part.reversal.possible) {
    return `Reversible — ${part.reversal.description}`
  }
  return part.reversal.description
}

export function receiptShowsUndo(part: ThreadToolPart) {
  return (
    part.ok &&
    part.reversal?.possible === true &&
    part.undone !== true &&
    Boolean(part.toolCallId)
  )
}
