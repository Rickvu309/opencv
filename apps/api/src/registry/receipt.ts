import { createHash } from "node:crypto"
import { type JobStage } from "@workspace/domain/apply"
import {
  type CoachReceiptDetail,
  type ReversalDescriptor,
} from "@workspace/domain/coach"
import { type ReversalPlan } from "@workspace/domain/kernel"
import { changeHunks, diffPaperContent } from "@workspace/domain/paper-doc"

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
      ...(text(row.id) ? { docId: text(row.id) } : {}),
      docKind: kind,
      docName: text(row.name) || "Document",
      hunks: diffPaperContent(kind, row.previousDocument, row.document),
    }
  }
  if (command === "paper.edit") {
    const kind = row.kind
    if (kind !== "cv" && kind !== "letter") return undefined
    if (!Array.isArray(row.changes) || !text(row.editId)) return undefined
    return {
      type: "paper.replace",
      ...(text(row.docId) ? { docId: text(row.docId) } : {}),
      docKind: kind,
      docName: text(row.name) || "Document",
      hunks: changeHunks(row.changes as Parameters<typeof changeHunks>[0]),
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
    command === "paper.start" ||
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
      ...(text(row.id) || text(row.docId)
        ? { docId: text(row.id) || text(row.docId) }
        : {}),
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

function canonical(input: unknown): string {
  if (Array.isArray(input)) return `[${input.map(canonical).join(",")}]`
  if (input !== null && typeof input === "object")
    return `{${Object.entries(input)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, value]) => `${JSON.stringify(key)}:${canonical(value)}`)
      .join(",")}}`
  const value = JSON.stringify(input)
  if (value === undefined) throw new Error("Intent input must be JSON")
  return value
}

export function inputHash(input: unknown) {
  return createHash("sha256").update(canonical(input)).digest("hex")
}
