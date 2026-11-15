import { humanToolText } from "./coach-tool-labels.ts"
import { coachActionView } from "./coach-action-record.ts"

import type { CoachToolPart } from "./coach-parts.ts"

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
