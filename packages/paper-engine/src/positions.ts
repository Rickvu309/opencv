import type { Node } from "prosemirror-model"
import type { BlockId, Pos } from "@workspace/domain/paper-doc"

export type Container = {
  block: BlockId
  cell?: { row: number; col: number }
  start: number
  size: number
  blockIndex: number
}

export type BlockEntry = { node: Node; pos: number; index: number }

export type PosIndex = {
  containers: readonly Container[]
  blocks: ReadonlyMap<string, BlockEntry>
}

const cache = new WeakMap<Node, PosIndex>()

function build(doc: Node): PosIndex {
  const containers: Container[] = []
  const blocks = new Map<string, BlockEntry>()
  doc.forEach((node, offset, index) => {
    const block = node.attrs.id as BlockId
    blocks.set(block, { node, pos: offset, index })
    if (node.type.name === "text_block") {
      containers.push({
        block,
        start: offset + 1,
        size: node.content.size,
        blockIndex: index,
      })
    } else if (node.type.name === "table") {
      node.forEach((row, rowOffset, rowIndex) => {
        row.forEach((cell, cellOffset, col) => {
          containers.push({
            block,
            cell: { row: rowIndex, col },
            start: offset + 1 + rowOffset + 1 + cellOffset + 1,
            size: cell.content.size,
            blockIndex: index,
          })
        })
      })
    }
  })
  return { containers, blocks }
}

export function posIndex(doc: Node): PosIndex {
  let index = cache.get(doc)
  if (!index) {
    index = build(doc)
    cache.set(doc, index)
  }
  return index
}

export function containerOf(doc: Node, pos: Pos): Container | null {
  return (
    posIndex(doc).containers.find(
      (container) =>
        container.block === pos.block &&
        container.cell?.row === pos.cell?.row &&
        container.cell?.col === pos.cell?.col
    ) ?? null
  )
}

export function toPm(doc: Node, pos: Pos): number | null {
  const container = containerOf(doc, pos)
  if (container) {
    return pos.offset <= container.size ? container.start + pos.offset : null
  }
  const entry = posIndex(doc).blocks.get(pos.block)
  if (!entry || pos.cell || !entry.node.isAtom || pos.offset > 1) return null
  return pos.offset === 0 ? entry.pos : entry.pos + entry.node.nodeSize
}

export function containerAt(doc: Node, pm: number): Container | null {
  return (
    posIndex(doc).containers.find(
      (container) =>
        container.start <= pm && pm <= container.start + container.size
    ) ?? null
  )
}

export function fromPm(doc: Node, pm: number): Pos {
  const { containers, blocks } = posIndex(doc)
  const container =
    containerAt(doc, pm) ??
    containers.find((candidate) => candidate.start >= pm) ??
    containers.at(-1)
  if (!container) {
    const first = [...blocks.values()][0]!
    return { block: first.node.attrs.id as BlockId, offset: 0 }
  }
  const offset = Math.max(0, Math.min(container.size, pm - container.start))
  return container.cell
    ? { block: container.block, cell: container.cell, offset }
    : { block: container.block, offset }
}
