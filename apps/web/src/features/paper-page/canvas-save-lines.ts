export type PageBlock = { id: string; text: string; held?: boolean }

export type LineRefusal = { id: string; text: string; note: string }

export type LineUnits = {
  lines: { id: string; text: string }[]
  rest: string[]
}

export function stillRefused(
  refusals: readonly LineRefusal[],
  blocks: readonly PageBlock[]
): LineRefusal[] {
  const texts = new Map(blocks.map((block) => [block.id, block.text]))
  return refusals.filter((line) => texts.get(line.id) === line.text)
}

export function withoutRefused(
  server: readonly PageBlock[],
  blocks: readonly PageBlock[],
  refusals: readonly LineRefusal[]
): PageBlock[] {
  const refused = new Set(stillRefused(refusals, blocks).map((line) => line.id))
  if (refused.size === 0) return blocks.slice()
  const saved = new Map(server.map((block) => [block.id, block]))
  return blocks.flatMap((block) => {
    if (!refused.has(block.id)) return [block]
    const kept = saved.get(block.id)
    return kept ? [{ ...block, text: kept.text }] : []
  })
}

export function withLine(
  server: readonly PageBlock[],
  id: string,
  text: string
): PageBlock[] {
  return server.map((block) => (block.id === id ? { ...block, text } : block))
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
  server.forEach((block, index) => {
    if (block.held || local.has(block.id)) return
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
  const removedOnly =
    rest.length === 0 &&
    server.some((block) => !block.held && !local.has(block.id))
  if (removedOnly) {
    const near = blocks.find((block) => removedNextTo.has(block.id))
    rest.push(near?.id ?? blocks[0]?.id ?? "")
  }
  return { lines, rest: rest.filter(Boolean) }
}
