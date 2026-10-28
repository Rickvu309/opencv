import { type ChatToolName, type CoachToolResultPart } from "@workspace/domain"
import type { ExecuteResult } from "../registry/registry.js"
import { receiptDetail, reversalOf } from "../registry/receipt.js"

export function toolResultFromExecute(input: {
  toolCallId: string
  name: ChatToolName
  summary: string
  result: Pick<
    ExecuteResult,
    | "pending"
    | "pendingActionId"
    | "summary"
    | "command"
    | "output"
    | "activityId"
    | "reversal"
  >
}): CoachToolResultPart {
  const summary = input.result.summary || input.summary
  const detail = input.result.pending
    ? undefined
    : receiptDetail(input.result.command ?? input.name, input.result.output)
  return {
    type: "tool-result",
    toolCallId: input.toolCallId,
    name: input.name,
    summary,
    ok: true,
    reversal: input.result.pending
      ? { possible: false, description: summary }
      : reversalOf(input.result.reversal, summary),
    result: { ok: true, data: input.result.output ?? null },
    ...(detail ? { detail } : {}),
    ...(input.result.activityId ? { activityId: input.result.activityId } : {}),
    ...(input.result.pending && input.result.pendingActionId
      ? {
          pendingActionId: input.result.pendingActionId,
          command: input.result.command ?? input.name,
        }
      : {}),
  }
}
