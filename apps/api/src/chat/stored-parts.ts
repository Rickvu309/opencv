import { chatToolNameSchema, type ChatMessagePart } from "@workspace/domain"

// Chats saved before the Coach stream contract carry the model's `paper_replace`
// tool names and receipt kinds named after commands that no longer exist.
const LEGACY_RECEIPT_KIND: Record<string, string> = {
  "paper.updateContent": "paper.replace",
  "apply.moveCard": "job.move",
  "paper.createDoc": "paper.create",
}

function registryName(name: string) {
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
    typeof detail?.type === "string" ? LEGACY_RECEIPT_KIND[detail.type] : null
  return {
    ...row,
    ...(typeof row.name === "string" ? { name: registryName(row.name) } : {}),
    ...(kind ? { detail: { ...detail, type: kind } } : {}),
  }
}

/** The one place stored chat parts are read: old names and receipt kinds come back as the current ones. */
export function readStoredParts(stored: unknown[] | null): ChatMessagePart[] {
  return (stored ?? []).map(upgradePart) as ChatMessagePart[]
}
