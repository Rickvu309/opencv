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

export function withStoredOutcome(part: ChatToolPart): ChatToolPart {
  const outcome = storedOutcome(part)
  return {
    ...part,
    outcome,
    ...(outcome === "denied" || outcome === "expired"
      ? { approval: outcome }
      : {}),
    ...(outcome === "undone" ? { undone: true } : {}),
  }
}

export function readStoredParts(stored: unknown[] | null): ChatMessagePart[] {
  return (stored ?? []).flatMap((raw) => {
    const parsed = chatMessagePartSchema.safeParse(upgradePart(raw))
    if (!parsed.success) return []
    return [
      parsed.data.type === "tool"
        ? withStoredOutcome(parsed.data)
        : parsed.data,
    ]
  })
}
