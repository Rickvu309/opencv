import type {
  BlockId,
  Document,
  Pos,
  Range,
  Run,
} from "@workspace/domain/paper-doc"
import { textContainers, type TextContainer } from "@workspace/paper-engine"

export type DocIndex = {
  order: Map<string, number>
  containers: TextContainer[]
}

export function indexDoc(doc: Document): DocIndex {
  const order = new Map<string, number>()
  doc.content.forEach((block, n) => order.set(block.attrs.id, n))
  return { order, containers: textContainers(doc) }
}

export function comparePos(index: DocIndex, a: Pos, b: Pos): number {
  const block =
    (index.order.get(a.block) ?? 0) - (index.order.get(b.block) ?? 0)
  if (block !== 0) return block
  const row = (a.cell?.row ?? 0) - (b.cell?.row ?? 0)
  if (row !== 0) return row
  const col = (a.cell?.col ?? 0) - (b.cell?.col ?? 0)
  if (col !== 0) return col
  return a.offset - b.offset
}

export function ordered(index: DocIndex, range: Range): Range {
  return comparePos(index, range.from, range.to) <= 0
    ? range
    : { from: range.to, to: range.from }
}

export const samePos = (a: Pos, b: Pos) =>
  a.block === b.block &&
  a.offset === b.offset &&
  a.cell?.row === b.cell?.row &&
  a.cell?.col === b.cell?.col

const sameContainer = (container: TextContainer, pos: Pos) =>
  container.block === pos.block &&
  container.cell?.row === pos.cell?.row &&
  container.cell?.col === pos.cell?.col

export function containerAt(
  index: DocIndex,
  pos: Pos
): { container: TextContainer; at: number } | null {
  const at = index.containers.findIndex((each) => sameContainer(each, pos))
  return at < 0 ? null : { container: index.containers[at]!, at }
}

export function textBetween(index: DocIndex, range: Range): string {
  const { from, to } = ordered(index, range)
  const start = containerAt(index, from)
  const end = containerAt(index, to)
  if (!start || !end) return ""
  if (start.at === end.at)
    return start.container.text.slice(from.offset, to.offset)
  const parts = [start.container.text.slice(from.offset)]
  for (let n = start.at + 1; n < end.at; n += 1)
    parts.push(index.containers[n]!.text)
  parts.push(end.container.text.slice(0, to.offset))
  return parts.join("\n")
}

export function textBlocksIn(
  doc: Document,
  index: DocIndex,
  range: Range
): BlockId[] {
  const { from, to } = ordered(index, range)
  const first = index.order.get(from.block) ?? 0
  const last = index.order.get(to.block) ?? first
  return doc.content
    .slice(first, last + 1)
    .filter((block) => block.type === "text_block")
    .map((block) => block.attrs.id)
}

function runsAt(doc: Document, pos: Pos): readonly Run[] {
  const block = doc.content.find((each) => each.attrs.id === pos.block)
  if (!block) return []
  if (block.type === "text_block") return block.content ?? []
  if (block.type === "table" && pos.cell)
    return block.content[pos.cell.row]?.content[pos.cell.col]?.content ?? []
  return []
}

function markedSpans(runs: readonly Run[], type: string) {
  const spans: { from: number; to: number; marked: boolean }[] = []
  let at = 0
  for (const run of runs) {
    if (run.type !== "text") {
      at += 1
      continue
    }
    spans.push({
      from: at,
      to: at + run.text.length,
      marked: (run.marks ?? []).some((mark) => mark.type === type),
    })
    at += run.text.length
  }
  return spans
}

export function allMarked(
  doc: Document,
  index: DocIndex,
  range: Range,
  type: string
): boolean {
  const { from, to } = ordered(index, range)
  if (samePos(from, to)) {
    const spans = markedSpans(runsAt(doc, from), type)
    const before = spans.find(
      (span) => span.from < from.offset && from.offset <= span.to
    )
    return before?.marked ?? false
  }
  const start = containerAt(index, from)
  const end = containerAt(index, to)
  if (!start || !end) return false
  let any = false
  for (let n = start.at; n <= end.at; n += 1) {
    const container = index.containers[n]!
    const lo = n === start.at ? from.offset : 0
    const hi = n === end.at ? to.offset : container.text.length
    const pos = { block: container.block, cell: container.cell, offset: 0 }
    for (const span of markedSpans(runsAt(doc, pos), type)) {
      if (span.to <= lo || span.from >= hi) continue
      any = true
      if (!span.marked) return false
    }
  }
  return any
}
