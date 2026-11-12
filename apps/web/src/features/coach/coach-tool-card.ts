import { coachReadLabel, humanToolText } from "./coach-tool-labels.ts"
import { documentEditDetail } from "./coach-receipt.ts"

import type { CoachToolPart } from "./coach-parts.ts"

export function refusedApproval(tool: CoachToolPart) {
  const { approval } = tool.part
  return !tool.part.pendingActionId &&
    (approval === "denied" || approval === "expired" || approval === "stopped")
    ? approval
    : null
}

const REFUSED_APPROVAL_LINE = {
  denied: "Denied · nothing changed",
  expired: "Expired · ask Coach again",
  stopped: "Stopped · ask Coach again",
} as const

export function refusedApprovalLine(
  status: keyof typeof REFUSED_APPROVAL_LINE
) {
  return REFUSED_APPROVAL_LINE[status]
}

export function isCompactCoachTool(tool: CoachToolPart) {
  return Boolean(
    tool.part.pendingActionId ||
    refusedApproval(tool) ||
    tool.part.undone ||
    (tool.part.ok &&
      (coachReadLabel(tool.name) || documentEditDetail(tool.part.detail)))
  )
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
