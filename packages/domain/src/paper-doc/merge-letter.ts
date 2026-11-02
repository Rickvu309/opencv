import type { LetterPaper } from "./document.js"
import { flatItems, mergeItems } from "./merge-items.js"
import {
  flatRun,
  groupIndexById,
  isListBlock,
  itemsOfGroup,
  listGroups,
} from "./merge-lists.js"
import { rebaseRuns } from "./merge-text.js"
import type {
  Heading,
  ListItem,
  NodeId,
  Paragraph,
  ProseBlock,
} from "./nodes.js"
import { plainTextOfRuns, type RichText } from "./rich-text.js"

type Unit = {
  readonly id: string
  readonly text: string
  readonly content: RichText
  readonly block: number
  readonly node: Paragraph | Heading | null
}

type Source = number

function unitsOf(blocks: readonly ProseBlock[]): Unit[] {
  return blocks.flatMap((block, index): Unit[] => {
    if (block.type === "divider") return []
    if (block.type === "paragraph" || block.type === "heading") {
      const text = plainTextOfRuns(block.content)
      return text.trim() === ""
        ? []
        : [
            {
              id: block.id,
              text,
              content: block.content,
              block: index,
              node: block,
            },
          ]
    }
    return flatItems([block])
      .map((entry) => ({
        id: entry.item.id as string,
        text: plainTextOfRuns(entry.item.content),
        content: entry.item.content,
        block: index,
        node: null,
      }))
      .filter((unit) => unit.text.trim() !== "")
  })
}

const CELL_LIMIT = 4_000_000

function align(before: readonly string[], after: readonly string[]) {
  const matches = new Array<number>(after.length).fill(-1)
  let head = 0
  while (
    head < before.length &&
    head < after.length &&
    before[head] === after[head]
  ) {
    matches[head] = head
    head += 1
  }
  let tail = 0
  while (
    tail < before.length - head &&
    tail < after.length - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    matches[after.length - 1 - tail] = before.length - 1 - tail
    tail += 1
  }
  const rows = before.length - head - tail
  const cols = after.length - head - tail
  const pairs: [number, number][] = []
  if (rows > 0 && cols > 0 && rows * cols <= CELL_LIMIT) {
    const best = Array.from({ length: rows + 1 }, () =>
      new Array<number>(cols + 1).fill(0)
    )
    for (let i = rows - 1; i >= 0; i -= 1) {
      for (let j = cols - 1; j >= 0; j -= 1) {
        best[i]![j] =
          before[head + i] === after[head + j]
            ? best[i + 1]![j + 1]! + 1
            : Math.max(best[i + 1]![j]!, best[i]![j + 1]!)
      }
    }
    let i = 0
    let j = 0
    while (i < rows && j < cols) {
      if (before[head + i] === after[head + j]) {
        pairs.push([head + i, head + j])
        i += 1
        j += 1
      } else if (best[i + 1]![j]! >= best[i]![j + 1]!) i += 1
      else j += 1
    }
  }
  for (const [from, to] of pairs) matches[to] = from
  return { matches, head, tail }
}

function withPairedEdits(
  matches: number[],
  beforeCount: number,
  afterCount: number
): { source: Source[]; changed: Set<number> } {
  const source = [...matches]
  const changed = new Set<number>()
  let nextBefore = 0
  let nextAfter = 0
  const gap = (beforeEnd: number, afterEnd: number) => {
    const deletes = beforeEnd - nextBefore
    const inserts = afterEnd - nextAfter
    for (let k = 0; k < Math.min(deletes, inserts); k += 1) {
      source[nextAfter + k] = nextBefore + k
      changed.add(nextAfter + k)
    }
  }
  for (let j = 0; j < afterCount; j += 1) {
    const from = matches[j]!
    if (from < 0) continue
    gap(from, j)
    nextBefore = from + 1
    nextAfter = j + 1
  }
  gap(beforeCount, afterCount)
  return { source, changed }
}

export function mergeLetter(
  current: LetterPaper,
  sent: LetterPaper
): LetterPaper {
  const units = unitsOf(current.blocks)
  const sentBlocks = sent.blocks.filter(
    (block) => plainTextOfRuns(textOf(block)).trim() !== ""
  )
  const sentTexts = sentBlocks.map((block) => plainTextOfRuns(textOf(block)))
  const { matches } = align(
    units.map((unit) => unit.text),
    sentTexts
  )
  const { source } = withPairedEdits(matches, units.length, sentTexts.length)

  const taken = new Set<string>(units.map((unit) => unit.id))
  const idFor = (index: number): string => {
    const from = source[index]!
    if (from >= 0) return units[from]!.id
    const base = sentBlocks[index]!.id
    let id: string = base
    for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`
    taken.add(id)
    return id
  }

  const ids = sentTexts.map((_, index) => idFor(index))
  const groups = listGroups(current.blocks)
  const owner = groupIndexById(current.blocks, groups)
  const known = new Map(
    groups.flatMap((group) =>
      flatItems(itemsOfGroup(current.blocks, group)).map(
        (entry) => [entry.item.id as string, entry.item] as const
      )
    )
  )
  const ownerOfUnit = (index: number): number | null => {
    const from = source[index]!
    return from < 0 ? null : (owner.get(units[from]!.id) ?? null)
  }
  const groupOf = sentTexts.map((_, index) => ownerOfUnit(index))
  for (let index = 0; index < sentTexts.length; index += 1) {
    if (source[index]! >= 0) continue
    let end = index
    while (end < sentTexts.length && source[end]! < 0) end += 1
    const before = index > 0 ? groupOf[index - 1] : null
    const after = end < sentTexts.length ? groupOf[end] : null
    if (before !== null && before === after) {
      for (let k = index; k < end; k += 1) groupOf[k] = before ?? null
    }
    index = end - 1
  }

  const zero = current.blocks
    .map((block, index) => ({ block, index }))
    .filter(
      ({ block, index }) =>
        !isListBlock(block) && !units.some((unit) => unit.block === index)
    )
  const emitted = new Set<number>()
  const blocks: ProseBlock[] = []
  const flushBefore = (limit: number) => {
    for (const entry of zero) {
      if (entry.index < limit && !emitted.has(entry.index)) {
        emitted.add(entry.index)
        blocks.push(entry.block)
      }
    }
  }
  const used = new Set<number>()
  let index = 0
  while (index < sentTexts.length) {
    const group = groupOf[index] ?? null
    const from = source[index]!
    if (group === null) {
      if (from >= 0) flushBefore(units[from]!.block)
      const old = from >= 0 ? units[from]!.node : null
      const text = sentTexts[index]!
      if (old) {
        blocks.push({
          ...old,
          content: rebaseRuns(old.content, text),
        } as ProseBlock)
      } else {
        blocks.push({
          id: ids[index] as NodeId,
          type: "paragraph",
          content: sentBlocks[index]
            ? textOf(sentBlocks[index]!)
            : ([] as never),
        })
      }
      index += 1
      continue
    }
    let end = index
    while (end < sentTexts.length && groupOf[end] === group) end += 1
    const firstSource = source.slice(index, end).find((s) => s >= 0)
    if (firstSource !== undefined) flushBefore(units[firstSource]!.block)
    const run: ListItem[] = []
    for (let k = index; k < end; k += 1) {
      const previous = run[run.length - 1]
      const old = known.get(ids[k]!)
      run.push({
        id: ids[k] as NodeId,
        type: old?.type ?? previous?.type ?? "bullet",
        content: textOf(sentBlocks[k]!),
        children: [],
      })
    }
    if (used.has(group)) {
      blocks.push(...(flatRun(run, known) as ProseBlock[]))
    } else {
      used.add(group)
      const items = itemsOfGroup(current.blocks, groups[group]!)
      blocks.push(...(mergeItems(items, run) as ProseBlock[]))
    }
    index = end
  }
  flushBefore(Number.MAX_SAFE_INTEGER)
  return { ...current, blocks }
}

function textOf(block: ProseBlock): RichText {
  return "content" in block ? block.content : ([] as never)
}
