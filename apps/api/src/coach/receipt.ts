import {
  diffPaperContent,
  type ChatToolName,
  type CoachReceiptDetail,
  type CoachToolResultPart,
  type JobStage,
  type ReversalDescriptor,
  type ReversalPlan,
} from "@workspace/domain"

import type { ExecuteResult } from "../registry/registry.js"

const APPLY_STAGE: Record<JobStage, "inbox" | "sent" | "live" | "closed"> = {
  saved: "inbox",
  applied: "sent",
  interview: "live",
  offer: "live",
  closed: "closed",
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null
  return value as Record<string, unknown>
}

function text(value: unknown) {
  return typeof value === "string" ? value : ""
}

export function receiptDetail(
  command: string,
  output: unknown
): CoachReceiptDetail | undefined {
  const row = record(output)
  if (!row) return undefined
  if (command === "paper.replace") {
    const kind = row.kind
    if (kind !== "cv" && kind !== "letter" && kind !== "proof") return undefined
    return {
      type: "paper.replace",
      docKind: kind,
      docName: text(row.name) || "Document",
      hunks: diffPaperContent(kind, row.previousDocument, row.document),
    }
  }
  if (command === "job.move") {
    if (typeof row.fromStage !== "string" || typeof row.stage !== "string")
      return undefined
    if (!(row.fromStage in APPLY_STAGE) || !(row.stage in APPLY_STAGE))
      return undefined
    const from = APPLY_STAGE[row.fromStage as JobStage]
    const to = APPLY_STAGE[row.stage as JobStage]
    return {
      type: "job.move",
      title: text(row.title),
      company: text(row.company),
      from,
      to,
    }
  }
  if (
    command === "paper.create" ||
    command === "paper.import" ||
    command === "paper.duplicate"
  ) {
    const kind = row.kind
    if (kind !== "cv" && kind !== "letter" && kind !== "proof") return undefined
    const status =
      row.status === "ready" || row.status === "published"
        ? row.status
        : "draft"
    return {
      type: "paper.create",
      docKind: kind,
      name: text(row.name) || "Document",
      status,
    }
  }
  return undefined
}

export function reversalOf(
  plan: ReversalPlan,
  summary: string
): ReversalDescriptor {
  if (!plan) return { possible: false, description: summary }
  return {
    possible: true,
    description: summary,
    command: plan.command,
    input: plan.input,
  }
}

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
