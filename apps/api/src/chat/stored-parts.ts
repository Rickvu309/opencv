import { chatToolNameSchema, type ChatMessagePart } from "@workspace/domain"

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

export function readStoredParts(stored: unknown[] | null): ChatMessagePart[] {
  return (stored ?? []).map(upgradePart) as ChatMessagePart[]
}
