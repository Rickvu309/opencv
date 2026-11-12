import type { CoachReceiptDetail, ChatToolPart } from "@workspace/domain"

import { receiptHeadline } from "@/features/coach/coach-receipt.ts"
import type { ChatViewMessage } from "@/features/coach/chat-messages.ts"

export type UpdateContentDetail = Extract<
  CoachReceiptDetail,
  { type: "paper.replace" }
>

export type CoachToolStatus = "running" | "done" | "error"

export type CoachPart =
  | { kind: "text"; key: string; markdown: string }
  | {
      kind: "tool"
      key: string
      name: string
      label: string
      status: CoachToolStatus
      part: ChatToolPart
    }
  | { kind: "diff"; key: string; detail: UpdateContentDetail }

export type CoachToolPart = Extract<CoachPart, { kind: "tool" }>

export function toCoachParts(message: ChatViewMessage): CoachPart[] {
  const source = message.parts
  if (!source?.length) {
    return message.text
      ? [{ kind: "text", key: "text-0", markdown: message.text }]
      : []
  }
  return source.flatMap((part, index): CoachPart[] => {
    if (part.type === "text") {
      return part.text
        ? [{ kind: "text", key: `text-${index}`, markdown: part.text }]
        : []
    }
    const key = part.toolCallId ?? `tool-${index}`
    const tool: CoachToolPart = {
      kind: "tool",
      key,
      name: part.name,
      label: receiptHeadline(part),
      status: part.ok ? "done" : "error",
      part,
    }
    const awaitingDecision = Boolean(
      part.pendingActionId || part.approval === "pending"
    )
    const diff =
      part.ok &&
      !part.undone &&
      !awaitingDecision &&
      part.detail?.type === "paper.replace"
        ? part.detail
        : null
    return diff
      ? [tool, { kind: "diff", key: `${key}-diff`, detail: diff }]
      : [tool]
  })
}

export type CoachBlock =
  { type: "part"; part: CoachPart } | { type: "tools"; parts: CoachToolPart[] }

export function groupAdjacentToolSteps(
  parts: readonly CoachPart[]
): CoachBlock[] {
  const blocks: CoachBlock[] = []
  for (const part of parts) {
    const last = blocks.at(-1)
    if (part.kind !== "tool") {
      blocks.push({ type: "part", part })
    } else if (last?.type === "tools") {
      last.parts.push(part)
    } else {
      blocks.push({ type: "tools", parts: [part] })
    }
  }
  return blocks
}
