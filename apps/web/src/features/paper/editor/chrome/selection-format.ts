import type { Document, PageSetup, Range } from "@workspace/domain/paper-doc"

import { allMarked, indexDoc, ordered, textBlocksIn } from "../doc-positions.ts"

export const PAPER_FONTS = [
  { family: "Liberation Sans", short: "Sans", css: "paper-liberation-sans" },
  { family: "Liberation Serif", short: "Serif", css: "paper-liberation-serif" },
  { family: "Liberation Mono", short: "Mono", css: "paper-liberation-mono" },
  { family: "Carlito", short: "Carlito", css: "paper-carlito" },
] as const

export type PaperFont = (typeof PAPER_FONTS)[number]["family"]

export const TEXT_STYLES = [
  { kind: "title", label: "Title" },
  { kind: "heading", label: "Heading" },
  { kind: "subheading", label: "Subheading" },
  { kind: "paragraph", label: "Normal" },
] as const

export type TextStyle = (typeof TEXT_STYLES)[number]["kind"]
export type Align = "left" | "center" | "right" | "justify"
export type ToggleMark = "bold" | "italic" | "underline" | "strike"

export type SelectionFormat = {
  style: TextStyle
  font: PaperFont
  align: Align
  list: "bullet" | "numbered" | null
  lineSpacing: number | null
  marks: Record<ToggleMark, boolean>
  collapsed: boolean
  page: PageSetup
}

const MARKS: ToggleMark[] = ["bold", "italic", "underline", "strike"]

function styleOf(kind: string): TextStyle {
  if (kind === "title" || kind === "heading" || kind === "subheading")
    return kind
  return "paragraph"
}

function fontAt(doc: Document, range: Range): PaperFont {
  const block = doc.content.find((each) => each.attrs.id === range.from.block)
  if (block?.type !== "text_block") return "Liberation Sans"
  let at = 0
  for (const run of block.content ?? []) {
    const length = run.type === "text" ? run.text.length : 1
    const inside =
      run.type === "text" &&
      at <= range.from.offset &&
      range.from.offset <= at + length
    if (inside) {
      const font = run.marks?.find((mark) => mark.type === "font")
      if (font?.type === "font") return font.attrs.family
      return "Liberation Sans"
    }
    at += length
  }
  return "Liberation Sans"
}

export function selectionFormat(
  doc: Document,
  selected: Range
): SelectionFormat {
  const index = indexDoc(doc)
  const range = ordered(index, selected)
  const first = textBlocksIn(doc, index, range)[0]
  const block = doc.content.find((each) => each.attrs.id === first)
  const attrs = block?.type === "text_block" ? block.attrs : null
  const marks = Object.fromEntries(
    MARKS.map((mark) => [mark, allMarked(doc, index, range, mark)])
  ) as Record<ToggleMark, boolean>
  return {
    style: styleOf(attrs?.kind ?? "paragraph"),
    font: fontAt(doc, range),
    align: attrs?.align ?? "left",
    list: attrs?.list ?? null,
    lineSpacing: attrs?.lineSpacing ?? null,
    marks,
    collapsed:
      range.from.block === range.to.block &&
      range.from.offset === range.to.offset,
    page: doc.attrs.page,
  }
}
