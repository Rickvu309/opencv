import {
  humanizeCommandFailCopy,
  PAPER_KIND_LABEL,
  type CoachReceiptDetail,
  type ThreadToolPart,
} from "@workspace/domain"

const RECEIPT_STAGES: { id: string; label: string; dot: string }[] = [
  { id: "inbox", label: "Inbox", dot: "bg-chart-1" },
  { id: "prep", label: "Prep", dot: "bg-chart-2" },
  { id: "sent", label: "Sent", dot: "bg-chart-3" },
  { id: "live", label: "Live", dot: "bg-chart-4" },
  { id: "closed", label: "Closed", dot: "bg-chart-5" },
  { id: "saved", label: "Saved", dot: "bg-chart-5" },
  { id: "applied", label: "Applied", dot: "bg-chart-4" },
  { id: "interview", label: "Interview", dot: "bg-chart-2" },
  { id: "offer", label: "Offer", dot: "bg-chart-3" },
]

export function commandNameFromTool(name: string) {
  return name.includes(".") ? name : name.replace("_", ".")
}

export function stageLabel(stage: string) {
  return RECEIPT_STAGES.find((item) => item.id === stage)?.label ?? stage
}

export { RECEIPT_STAGES }

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
