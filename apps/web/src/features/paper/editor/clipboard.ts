import {
  isSafeHref,
  type Block,
  type BlockId,
  type Document,
  type Pos,
  type Range,
  type Run,
  type Selection,
} from "@workspace/domain/paper-doc"

import type { DocIndex } from "./doc-positions.ts"
import type { PaperClipboard } from "./input-port.ts"

const tags = {
  title: "h1",
  subtitle: "h2",
  heading: "h1",
  subheading: "h2",
  paragraph: "p",
}
const markTags = { bold: "strong", italic: "em", underline: "u", strike: "s" }

function writeRuns(
  target: HTMLElement,
  runs: readonly Run[],
  from = 0,
  to = Infinity
) {
  let offset = 0
  let plain = ""
  for (const run of runs) {
    const start = offset
    offset += run.type === "text" ? run.text.length : 1
    if (offset <= from || start >= to) continue
    if (run.type === "hard_break") {
      target.append(document.createElement("br"))
      plain += "\n"
      continue
    }
    const slice = run.text.slice(Math.max(0, from - start), to - start)
    plain += slice
    let node: Node = document.createTextNode(slice)
    for (const mark of run.marks ?? []) {
      if (mark.type === "link" && isSafeHref(mark.attrs.href)) {
        const link = document.createElement("a")
        link.href = mark.attrs.href
        link.append(node)
        node = link
      } else if (mark.type in markTags) {
        const element = document.createElement(
          markTags[mark.type as keyof typeof markTags]
        )
        element.append(node)
        node = element
      }
    }
    target.append(node)
  }
  return plain
}

function cellNumber(pos: Pos, cols: number) {
  return pos.cell ? pos.cell.row * cols + pos.cell.col : 0
}

export function copySelection(
  doc: Document,
  index: DocIndex,
  selection: Selection,
  range: Range
): PaperClipboard {
  const root = document.createElement("div")
  const plain: string[] = []
  const first =
    selection.kind === "all" ? 0 : (index.order.get(range.from.block) ?? 0)
  const last =
    selection.kind === "all"
      ? doc.content.length - 1
      : (index.order.get(range.to.block) ?? first)
  const lists: { list: HTMLElement; item: HTMLElement }[] = []

  for (const block of doc.content.slice(first, last + 1)) {
    const from =
      selection.kind === "text" && range.from.block === block.attrs.id
        ? range.from
        : undefined
    const to =
      selection.kind === "text" && range.to.block === block.attrs.id
        ? range.to
        : undefined
    if (block.type !== "text_block" || block.attrs.list === null)
      lists.length = 0
    if (block.type === "text_block") {
      const list = block.attrs.list
      let target: HTMLElement
      if (list) {
        const level = Math.min(block.attrs.level, lists.length)
        const tag = list === "bullet" ? "UL" : "OL"
        if (lists[level]?.list.tagName !== tag) {
          lists.length = level
          const element = document.createElement(tag.toLowerCase())
          const parent = lists[level - 1]?.item ?? root
          parent.append(element)
          lists[level] = { list: element, item: element }
        }
        lists.length = level + 1
        target = document.createElement("li")
        lists[level]!.list.append(target)
        lists[level]!.item = target
      } else if (from && to && block.attrs.kind === "paragraph") {
        target = root
      } else {
        target = document.createElement(tags[block.attrs.kind])
        root.append(target)
      }
      plain.push(
        writeRuns(target, block.content ?? [], from?.offset, to?.offset)
      )
    } else if (block.type === "table") {
      const cols = block.attrs.columnsMpt.length
      if (
        from?.cell &&
        to?.cell &&
        cellNumber(from, cols) === cellNumber(to, cols)
      ) {
        const cell = block.content[from.cell.row]?.content[from.cell.col]
        plain.push(writeRuns(root, cell?.content ?? [], from.offset, to.offset))
        continue
      }
      const table = document.createElement("table")
      const start = from ? cellNumber(from, cols) : 0
      const end = to ? cellNumber(to, cols) : Infinity
      const rows = block.content.slice(
        Math.floor(start / cols),
        Math.floor(end / cols) + 1
      )
      rows.forEach((row, i) => {
        const tr = table.insertRow()
        const cells = row.content.map((cell, col) => {
          const n = (i + Math.floor(start / cols)) * cols + col
          const td = tr.insertCell()
          if (n < start || n > end) return ""
          return writeRuns(
            td,
            cell.content ?? [],
            n === start ? from?.offset : 0,
            n === end ? to?.offset : Infinity
          )
        })
        plain.push(cells.join("\t"))
      })
      root.append(table)
    } else if (block.type === "divider") {
      root.append(document.createElement("hr"))
    } else if (block.type === "image" && block.attrs.alt) {
      const paragraph = document.createElement("p")
      paragraph.textContent = block.attrs.alt
      root.append(paragraph)
      plain.push(block.attrs.alt)
    }
  }
  return { html: root.innerHTML, text: plain.join("\n") }
}

export function plainFragment(
  text: string,
  inCell: boolean,
  id: () => BlockId
): Block[] | Run[] {
  const lines = text.split(/\r\n|\r|\n/)
  if (lines.length === 1) return [{ type: "text", text }]
  if (inCell)
    return lines.flatMap((line, n): Run[] => [
      ...(n ? [{ type: "hard_break" } as const] : []),
      ...(line ? [{ type: "text", text: line } as const] : []),
    ])
  return lines.map((line): Block => ({
    type: "text_block",
    attrs: {
      id: id(),
      kind: "paragraph",
      list: null,
      level: 0,
      align: "left",
      lineSpacing: null,
      keepWithNext: null,
    },
    ...(line ? { content: [{ type: "text", text: line }] } : {}),
  }))
}
