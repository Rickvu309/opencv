import type { CoachReceiptDetail, ThreadToolPart } from "@workspace/domain"

import {
  commandNameFromTool,
  receiptHeadline,
} from "@/features/home/coach-receipt.ts"
import type { HomeMessage } from "@/features/home/threads.ts"

export type UpdateContentDetail = Extract<
  CoachReceiptDetail,
  { type: "paper.updateContent" }
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
      part: ThreadToolPart
    }
  | { kind: "diff"; key: string; detail: UpdateContentDetail }

export type CoachToolPart = Extract<CoachPart, { kind: "tool" }>

/** One Coach turn as renderable parts, in the order the Coach produced them. */
export function toCoachParts(message: HomeMessage): CoachPart[] {
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
      name: commandNameFromTool(part.name),
      label: receiptHeadline(part),
      status: part.ok ? "done" : "error",
      part,
    }
    const diff =
      part.ok && !part.undone && part.detail?.type === "paper.updateContent"
        ? part.detail
        : null
    return diff
      ? [tool, { kind: "diff", key: `${key}-diff`, detail: diff }]
      : [tool]
  })
}

export type CoachBlock =
  { type: "part"; part: CoachPart } | { type: "tools"; parts: CoachToolPart[] }

/** Adjacent tool steps fold into one group; every other part stands alone. */
export function groupCoachParts(parts: readonly CoachPart[]): CoachBlock[] {
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
