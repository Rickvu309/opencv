import type {
  Block,
  BlockId,
  Document,
  Range,
  Run,
  Selection,
} from "@workspace/domain/paper-doc"

export type TextContainer = {
  block: BlockId
  cell?: { row: number; col: number }
  text: string
}

const runsText = (runs: readonly Run[] | undefined) =>
  (runs ?? []).map((run) => (run.type === "text" ? run.text : "\n")).join("")

function blockContainers(block: Block): TextContainer[] {
  if (block.type === "text_block") {
    return [{ block: block.attrs.id, text: runsText(block.content) }]
  }
  if (block.type === "table") {
    return block.content.flatMap((row, rowIndex) =>
      row.content.map((cell, col) => ({
        block: block.attrs.id,
        cell: { row: rowIndex, col },
        text: runsText(cell.content),
      }))
    )
  }
  return []
}

export function textContainers(doc: Document): TextContainer[] {
  return doc.content.flatMap(blockContainers)
}

export function documentText(doc: Document): string {
  return doc.content
    .map((block) =>
      blockContainers(block)
        .map((container) => container.text)
        .join("\t")
    )
    .join("\n")
}

const startOf = (container: TextContainer) =>
  container.cell
    ? { block: container.block, cell: container.cell, offset: 0 }
    : { block: container.block, offset: 0 }

const endOf = (container: TextContainer) => ({
  ...startOf(container),
  offset: container.text.length,
})

function spanOf(containers: TextContainer[], blocks: Block[]): Range {
  const first = containers[0]
  const last = containers.at(-1)
  if (first && last) return { from: startOf(first), to: endOf(last) }
  return {
    from: { block: blocks[0]!.attrs.id, offset: 0 },
    to: { block: blocks.at(-1)!.attrs.id, offset: 1 },
  }
}

export function selectionRange(doc: Document, selection: Selection): Range {
  if (selection.kind === "text") {
    return { from: selection.anchor, to: selection.head }
  }
  if (selection.kind === "all") {
    return spanOf(textContainers(doc), doc.content)
  }
  const block = doc.content.find((each) => each.attrs.id === selection.block)
  if (!block) return spanOf(textContainers(doc), doc.content)
  return spanOf(blockContainers(block), [block])
}
