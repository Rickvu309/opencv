import {
  COACH_READ_TOOLS,
  ERROR_CODES,
  errorEnvelope,
  humanizeCommandFailCopy,
  PAPER_KIND_LABEL,
  coachReceiptDetailSchema,
  diffPaperContent,
  isApplyStage,
  type ApplyCard,
  type CoachReceiptDetail,
  type CommandEnvelope,
  type PaperDoc,
  type ReversalDescriptor,
  type ThreadListItem,
  type UserProfile,
} from "@workspace/domain"

import type { CommandRegistry } from "../commands/registry.js"

const READ_REVERSAL: ReversalDescriptor = {
  possible: false,
  description: "This read does not change anything.",
}

const STAGE_LABEL: Record<string, string> = {
  inbox: "Inbox",
  prep: "Prep",
  sent: "Sent",
  live: "Live",
  closed: "Closed",
}

export function toolNameToCommandName(toolName: string) {
  return toolName.replace("_", ".")
}

export function reversalForTool(
  name: string,
  registry: CommandRegistry
): ReversalDescriptor | undefined {
  const command = registry.get(toolNameToCommandName(name))
  if (command) return command.reversal
  if ((Object.values(COACH_READ_TOOLS) as string[]).includes(name)) {
    return READ_REVERSAL
  }
  return undefined
}

export function envelopeFromToolOutput(output: unknown): CommandEnvelope {
  if (output && typeof output === "object" && "ok" in output) {
    if ("reversal" in output) {
      const envelope = { ...(output as Record<string, unknown>) }
      delete envelope.reversal
      return envelope as CommandEnvelope
    }
    return output as CommandEnvelope
  }
  return errorEnvelope(
    ERROR_CODES.VALIDATION_ERROR,
    "Tool returned an unexpected result"
  )
}

export function summarizeToolResult(
  name: string,
  result: CommandEnvelope
): string {
  if (!result.ok) return humanizeCommandFailCopy(result.error.message)

  switch (name) {
    case "apply_listCards":
      return `Listed ${countLabel(asArray(result.data).length, "Apply card")}`
    case "apply_createCard":
    case "apply_updateCard": {
      const card = asApplyCard(result.data)
      return card
        ? `${name === "apply_createCard" ? "Created" : "Updated"} ${card.title} at ${card.company}`
        : `Ran ${name}`
    }
    case "apply_moveCard": {
      const card = asApplyCard(result.data)
      return card
        ? `Moved ${card.title} at ${card.company} to ${stageLabel(card.stage)}`
        : `Ran ${name}`
    }
    case "apply_toggleStar": {
      const card = asApplyCard(result.data)
      if (!card) return `Ran ${name}`
      return card.starred
        ? `Starred ${card.title} at ${card.company}`
        : `Unstarred ${card.title} at ${card.company}`
    }
    case "paper_listDocs":
      return `Listed ${countLabel(asArray(result.data).length, "Paper document")}`
    case "paper_getDoc":
    case "paper_createDoc":
    case "paper_renameDoc":
    case "paper_updateContent":
    case "paper_setStatus":
    case "paper_linkApplyCard": {
      const doc = asPaperDoc(result.data)
      if (!doc) return `Ran ${name}`
      if (name === "paper_getDoc") return `Read ${doc.name}`
      if (name === "paper_createDoc") {
        return `Created ${PAPER_KIND_LABEL[doc.kind]} ${doc.name}`
      }
      if (name === "paper_renameDoc") return `Renamed Paper doc to ${doc.name}`
      if (name === "paper_updateContent") {
        return `Updated content of ${doc.name}`
      }
      if (name === "paper_setStatus") return `Set ${doc.name} to ${doc.status}`
      return doc.applyCardId
        ? `Linked ${doc.name} to an Apply card`
        : `Unlinked ${doc.name} from Apply`
    }
    case "profile_get": {
      const profile = asProfile(result.data)
      return profile ? `Read profile for ${profile.name}` : `Ran ${name}`
    }
    case "threads_create":
    case "threads_rename": {
      const thread = asThread(result.data)
      if (!thread) return `Ran ${name}`
      return name === "threads_create"
        ? `Created Thread ${thread.title}`
        : `Renamed Thread to ${thread.title}`
    }
    default:
      return `Ran ${name}`
  }
}

function asArray(data: unknown): unknown[] {
  return Array.isArray(data) ? data : []
}

function asRecord(data: unknown): Record<string, unknown> | null {
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : null
}

function asApplyCard(data: unknown): ApplyCard | null {
  const row = asRecord(data)
  if (
    !row ||
    typeof row.title !== "string" ||
    typeof row.company !== "string" ||
    typeof row.stage !== "string"
  ) {
    return null
  }
  return row as unknown as ApplyCard
}

function asPaperDoc(data: unknown): PaperDoc | null {
  const row = asRecord(data)
  if (!row || typeof row.name !== "string") return null
  return row as unknown as PaperDoc
}

function asProfile(data: unknown): UserProfile | null {
  const row = asRecord(data)
  if (!row || typeof row.name !== "string") return null
  return row as unknown as UserProfile
}

function asThread(data: unknown): ThreadListItem | null {
  const row = asRecord(data)
  if (!row || typeof row.title !== "string") return null
  return row as unknown as ThreadListItem
}

function stageLabel(stage: string) {
  return STAGE_LABEL[stage] ?? stage
}

function countLabel(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

export function receiptDetailForTool(
  name: string,
  result: CommandEnvelope,
  reversal?: ReversalDescriptor
): CoachReceiptDetail | undefined {
  if (!result.ok) return undefined

  if (name === "paper_updateContent") {
    const doc = asPaperDoc(result.data)
    const previous = reversalContent(reversal)
    if (!doc || previous === undefined) return undefined
    const hunks = diffPaperContent(doc.kind, previous, doc.content)
    if (hunks.length === 0) return undefined
    return parseDetail({
      type: "paper.updateContent",
      docKind: doc.kind,
      docName: doc.name,
      hunks,
    })
  }

  if (name === "apply_moveCard") {
    const card = asApplyCard(result.data)
    const from = reversalStage(reversal)
    if (!card || !from || !isApplyStage(card.stage) || from === card.stage) {
      return undefined
    }
    return parseDetail({
      type: "apply.moveCard",
      title: card.title,
      company: card.company,
      from,
      to: card.stage,
    })
  }

  if (name === "paper_createDoc") {
    const doc = asPaperDoc(result.data)
    if (!doc) return undefined
    return parseDetail({
      type: "paper.createDoc",
      docKind: doc.kind,
      name: doc.name,
      status: doc.status,
    })
  }

  return undefined
}

function parseDetail(value: unknown): CoachReceiptDetail | undefined {
  const parsed = coachReceiptDetailSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

function reversalContent(reversal?: ReversalDescriptor): unknown {
  if (!reversal?.input || typeof reversal.input !== "object") return undefined
  const input = reversal.input as { content?: unknown }
  return input.content
}

function reversalStage(reversal?: ReversalDescriptor) {
  if (!reversal?.input || typeof reversal.input !== "object") return undefined
  const stage = (reversal.input as { stage?: unknown }).stage
  return isApplyStage(stage) ? stage : undefined
}
