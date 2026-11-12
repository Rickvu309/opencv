import { coachReadLabel, humanToolText } from "./coach-tool-labels.ts"
import {
  humanizeCommandFailCopy,
  type CoachReceiptDetail,
  type ChatToolPart,
} from "@workspace/domain"

const RECEIPT_STAGES: { id: string; label: string; dot: string }[] = [
  { id: "saved", label: "Saved", dot: "bg-chart-1" },
  { id: "applied", label: "Applied", dot: "bg-chart-2" },
  { id: "interview", label: "Interview", dot: "bg-chart-3" },
  { id: "offer", label: "Offer", dot: "bg-chart-4" },
  { id: "closed", label: "Closed", dot: "bg-chart-5" },
]

export function stageLabel(stage: string) {
  return RECEIPT_STAGES.find((item) => item.id === stage)?.label ?? stage
}

export { RECEIPT_STAGES }

export function namedReceiptHeadline(detail: CoachReceiptDetail) {
  if (detail.type === "paper.replace") {
    const changes = detail.hunks.reduce(
      (total, hunk) =>
        total +
        hunk.lines.filter(
          (line, index) =>
            line.kind !== "eq" &&
            (index === 0 || hunk.lines[index - 1]?.kind === "eq")
        ).length,
      0
    )
    return `Edited ${detail.docName} · ${changes} change${changes === 1 ? "" : "s"}`
  }
  if (detail.type === "job.move") {
    return `Moved ${detail.title} at ${detail.company} from ${stageLabel(detail.from)} to ${stageLabel(detail.to)}`
  }
  return `Created ${detail.name}`
}

export function receiptHeadline(part: ChatToolPart) {
  if (!part.ok) return humanizeCommandFailCopy(part.summary)
  if (part.detail) return namedReceiptHeadline(part.detail)
  return coachReadLabel(part.name) ?? humanToolText(part.summary)
}

export function receiptReversalNote(part: ChatToolPart) {
  if (!part.reversal) return null
  if (part.reversal.possible) {
    if (!part.activityId) return null
    return `Reversible — ${part.reversal.description}`
  }
  return part.reversal.description
}

export function receiptShowsUndo(part: ChatToolPart) {
  return (
    part.ok &&
    part.reversal?.possible === true &&
    part.undone !== true &&
    Boolean(part.activityId)
  )
}
