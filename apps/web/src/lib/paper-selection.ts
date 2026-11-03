import type { CoachContextItem } from "@workspace/domain"

const MAX_BLOCK_IDS = 50
const BLOCK_ID = /^[A-Za-z0-9_-]{1,64}$/

let selection: { docId: string; ids: string[] } | null = null

export function setPaperSelection(docId: string, ids: readonly string[]) {
  const usable = ids.filter((id) => BLOCK_ID.test(id)).slice(0, MAX_BLOCK_IDS)
  selection = usable.length > 0 ? { docId, ids: usable } : null
}

export function withSelectedBlocks(
  context: CoachContextItem[] | undefined
): CoachContextItem[] | undefined {
  if (!selection) return context
  const { docId, ids } = selection
  const rest = (context ?? []).filter(
    (item) => !(item.kind === "paper" && item.id === docId)
  )
  return [...rest, { kind: "paper", id: docId, blockIds: ids }]
}
