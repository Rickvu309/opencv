import {
  appendCoachPart,
  chatToolNameSchema,
  type ChatEntryPart,
  type ChatToolName,
  type CoachStreamPart,
  type CoachToolResultPart,
} from "@workspace/domain/coach"
import type { ExecuteResult } from "../registry/registry.js"
import type { TurnReceipt } from "../registry/turn-receipts.js"
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
    | "review"
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
    ...(input.result.review !== undefined
      ? { review: input.result.review }
      : {}),
  }
}

export function withMissingReceipts(
  parts: ChatEntryPart[],
  receipts: readonly TurnReceipt[]
): ChatEntryPart[] {
  const recorded = new Set(
    parts.flatMap((part) =>
      part.type === "tool"
        ? [part.activityId, part.pendingActionId].filter(Boolean)
        : []
    )
  )
  return receipts.reduce<ChatEntryPart[]>((all, { name, result }) => {
    const key = result.activityId ?? result.pendingActionId
    const tool = chatToolNameSchema.safeParse(name)
    if (!key || !tool.success || recorded.has(key)) return all
    recorded.add(key)
    const receipt: CoachStreamPart = toolResultFromExecute({
      toolCallId: `receipt-${key}`,
      name: tool.data,
      summary: result.summary || name,
      result,
    })
    return appendCoachPart(all, receipt)
  }, parts)
}
