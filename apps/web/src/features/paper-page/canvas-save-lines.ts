export type PageBlock = { id: string; text: string; held?: boolean }

export type LineRefusal = {
  id: string
  text: string
  note: string
  removed?: true
}

export type LineUnits = {
  lines: { id: string; text: string }[]
  rest: string[]
  removed: { id: string; text: string }[]
}

export function uniqueRefusals(
  refusals: readonly LineRefusal[]
): LineRefusal[] {
  const seen = new Map<string, LineRefusal>()
  for (const line of refusals) seen.set(line.id, line)
  return [...seen.values()]
}

export function sameRefusals(
  left: readonly LineRefusal[],
  right: readonly LineRefusal[]
) {
  return (
    left.length === right.length &&
    left.every(
      (line, index) =>
        line.id === right[index]?.id &&
        line.text === right[index]?.text &&
        line.note === right[index]?.note &&
        !!line.removed === !!right[index]?.removed
    )
  )
}

export function stillRefused(
  refusals: readonly LineRefusal[],
  blocks: readonly PageBlock[]
): LineRefusal[] {
  const texts = new Map(blocks.map((block) => [block.id, block.text]))
  return uniqueRefusals(
    refusals.filter((line) =>
      line.removed ? !texts.has(line.id) : texts.get(line.id) === line.text
    )
  )
}

export function withoutRefused(
  server: readonly PageBlock[],
  blocks: readonly PageBlock[],
  refusals: readonly LineRefusal[]
): PageBlock[] {
  const kept = stillRefused(refusals, blocks)
  if (kept.length === 0) return blocks.slice()
  const refused = new Set(kept.filter((line) => !line.removed).map((l) => l.id))
  const removed = new Set(kept.filter((line) => line.removed).map((l) => l.id))
  const saved = new Map(server.map((block) => [block.id, block]))
  const sending = blocks.flatMap((block) => {
    if (!refused.has(block.id)) return [block]
    const prior = saved.get(block.id)
    return prior ? [{ ...block, text: prior.text }] : []
  })
  server.forEach((block, index) => {
    if (!removed.has(block.id)) return
    const before = server
      .slice(0, index)
      .reverse()
      .find((item) => sending.some((line) => line.id === item.id))
    const at = before
      ? sending.findIndex((line) => line.id === before.id) + 1
      : 0
    sending.splice(at, 0, { ...block })
  })
  return sending
}

export function withLine(
  server: readonly PageBlock[],
  id: string,
  text: string
): PageBlock[] {
  return server.map((block) => (block.id === id ? { ...block, text } : block))
}

export function landedRenames(
  sent: readonly PageBlock[],
  landed: readonly PageBlock[]
): Record<string, string> | null {
  if (sent.length !== landed.length) return null
  const renames: Record<string, string> = {}
  for (const [index, block] of sent.entries()) {
    const next = landed[index]
    if (!next || next.text !== block.text || !!next.held !== !!block.held)
      return null
    if (next.id !== block.id) renames[block.id] = next.id
  }
  return renames
}

export function lineUnits(
  server: readonly PageBlock[],
  blocks: readonly PageBlock[]
): LineUnits {
  const saved = new Map(server.map((block) => [block.id, block]))
  const local = new Set(blocks.map((block) => block.id))
  const fresh = (index: number) => {
    const block = blocks[index]
    return block !== undefined && !saved.has(block.id)
  }
  const removedNextTo = new Set<string>()
  const removed: { id: string; text: string }[] = []
  server.forEach((block, index) => {
    if (block.held || local.has(block.id)) return
    removed.push({ id: block.id, text: block.text })
    const before = server[index - 1]
    const after = server[index + 1]
    if (before) removedNextTo.add(before.id)
    if (after) removedNextTo.add(after.id)
  })
  const lines: { id: string; text: string }[] = []
  const rest: string[] = []
  blocks.forEach((block, index) => {
    const kept = saved.get(block.id)
    if (!kept) {
      rest.push(block.id)
      return
    }
    if (block.held || kept.text === block.text) return
    if (fresh(index - 1) || fresh(index + 1) || removedNextTo.has(block.id)) {
      rest.push(block.id)
      return
    }
    lines.push({ id: block.id, text: block.text })
  })
  return { lines, rest, removed }
}
