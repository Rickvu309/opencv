import { coachReadLabel, humanToolText } from "./coach-tool-labels.ts"

import type { CoachToolPart } from "./coach-parts.ts"

export function isCompactCoachTool(tool: CoachToolPart) {
  return Boolean(
    tool.part.pendingActionId ||
    tool.part.undone ||
    (tool.part.ok &&
      (coachReadLabel(tool.name) || tool.part.detail?.type === "paper.replace"))
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
