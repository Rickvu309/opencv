import {
  chatMessagePartSchema,
  chatToolNameSchema,
  type ChatMessagePart,
  type ChatToolOutcome,
  type ChatToolPart,
} from "@workspace/domain"

const LEGACY_DENIAL_SUMMARY = "Action was not approved"

const RECEIPT_KIND_OF_RETIRED_COMMAND: Record<string, string> = {
  "paper.updateContent": "paper.replace",
  "apply.moveCard": "job.move",
  "paper.createDoc": "paper.create",
}

function registryNameFromModelToolName(name: string) {
  if (chatToolNameSchema.safeParse(name).success) return name
  const dotted = name.replace("_", ".")
  return chatToolNameSchema.safeParse(dotted).success ? dotted : name
}

function upgradePart(part: unknown): unknown {
  if (typeof part !== "object" || part === null) return part
  const row = part as Record<string, unknown>
  if (row.type !== "tool") return part
  const detail = row.detail as { type?: unknown } | undefined
  const kind =
    typeof detail?.type === "string"
      ? RECEIPT_KIND_OF_RETIRED_COMMAND[detail.type]
      : null
  return {
    ...row,
    ...(typeof row.name === "string"
      ? { name: registryNameFromModelToolName(row.name) }
      : {}),
    ...(kind ? { detail: { ...detail, type: kind } } : {}),
  }
}

function storedOutcome(part: ChatToolPart): ChatToolOutcome {
  if (part.outcome) return part.outcome
  if (part.undone) return "undone"
  if (part.approval === "pending") return "waiting"
  if (part.approval) return part.approval
  if (part.summary === LEGACY_DENIAL_SUMMARY) return "denied"
  return part.ok ? "approved" : "failed"
}

function withStoredOutcome(part: ChatToolPart): ChatToolPart {
  const outcome = storedOutcome(part)
  return {
    ...part,
    outcome,
    ...(outcome === "denied" || outcome === "expired" || outcome === "stopped"
      ? { approval: outcome }
      : {}),
    ...(outcome === "undone" ? { undone: true } : {}),
  }
}

export const UNREADABLE_STEP_LINE = "This step could not be read"

export type StoredPart =
  { readable: true; part: ChatMessagePart } | { readable: false; raw: unknown }

export function readStoredParts(stored: unknown[] | null): StoredPart[] {
  return (stored ?? []).map((raw) => {
    const parsed = chatMessagePartSchema.safeParse(upgradePart(raw))
    if (!parsed.success) return { readable: false, raw }
    return {
      readable: true,
      part:
        parsed.data.type === "tool"
          ? withStoredOutcome(parsed.data)
          : parsed.data,
    }
  })
}

export function chatViewPart(stored: StoredPart): ChatMessagePart {
  return stored.readable
    ? stored.part
    : { type: "text", text: UNREADABLE_STEP_LINE }
}

export function readChatViewParts(stored: unknown[] | null): ChatMessagePart[] {
  return readStoredParts(stored).map(chatViewPart)
}

export function readExportedParts(stored: unknown[] | null): unknown[] {
  return readStoredParts(stored).map((part) =>
    part.readable ? part.part : part.raw
  )
}
