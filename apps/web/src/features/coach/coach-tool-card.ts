import { coachReadLabel, humanToolText } from "./coach-tool-labels.ts"
import { documentEditDetail } from "./coach-receipt.ts"

import type { CoachToolPart } from "./coach-parts.ts"

export function refusedApproval(tool: CoachToolPart) {
  const { approval } = tool.part
  return !tool.part.pendingActionId &&
    (approval === "denied" || approval === "expired")
    ? approval
    : null
}

export function refusedApprovalLine(status: "denied" | "expired") {
  return status === "expired"
    ? "Expired · ask Coach again"
    : "Denied · nothing changed"
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
