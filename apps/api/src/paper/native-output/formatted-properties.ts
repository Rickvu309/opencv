import {
  lineSpacingWordUnits,
  type DocumentPresentation,
  type InlinePresentation,
  type ParagraphPresentation,
} from "@workspace/domain/internal/paper-presentation"

import { xml } from "./rich-text.js"

function toggle(name: string, value: boolean | undefined): string {
  return value === undefined ? "" : `<w:${name} w:val="${value ? 1 : 0}"/>`
}

function fontName(id: NonNullable<InlinePresentation["fontId"]>): string {
  switch (id) {
    case "liberation-sans":
      return "Arial"
    case "liberation-serif":
      return "Times New Roman"
    case "liberation-mono":
      return "Courier New"
    default: {
      throw new Error(`Unsupported Paper font ${id}`)
    }
  }
}

export function inlineProperties(value: InlinePresentation): string {
  if (value.size !== undefined && value.size % 10 !== 0)
    throw new Error("Word font sizes must be an exact half point")
  const font = value.fontId ? fontName(value.fontId) : undefined
  return [
    value.characterStyle
      ? `<w:rStyle w:val="Paper-${xml(value.characterStyle)}"/>`
      : "",
    font
      ? `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/>`
      : "",
    toggle("b", value.bold),
    toggle("bCs", value.bold),
    toggle("i", value.italic),
    toggle("iCs", value.italic),
    toggle("strike", value.strike),
    value.color ? `<w:color w:val="${value.color.slice(1)}"/>` : "",
    value.size === undefined
      ? ""
      : `<w:sz w:val="${value.size / 10}"/><w:szCs w:val="${value.size / 10}"/>`,
    value.underline === undefined
      ? ""
      : `<w:u w:val="${value.underline ? "single" : "none"}"/>`,
    value.highlight
      ? `<w:shd w:val="clear" w:color="auto" w:fill="${value.highlight.slice(1)}"/>`
      : "",
  ].join("")
}

export function paragraphProperties(
  value: ParagraphPresentation,
  structure = ""
): string {
  const spacing: string[] = []
  if (value.before !== undefined) spacing.push(`w:before="${value.before}"`)
  if (value.after !== undefined) spacing.push(`w:after="${value.after}"`)
  if (value.lineSpacing) {
    const line = value.lineSpacing
    const units = lineSpacingWordUnits(line)
    if (units.kind === "refused") throw new Error(units.reason)
    const amount = units.value
    spacing.push(
      `w:line="${amount}"`,
      `w:lineRule="${line.kind === "multiple" ? "auto" : line.kind === "exact" ? "exact" : "atLeast"}"`
    )
  }
  const indent: string[] = []
  if (value.start !== undefined || value.indent?.kind === "hanging")
    indent.push(
      `w:left="${Math.max(value.start ?? 0, value.indent?.kind === "hanging" ? value.indent.value : 0)}"`
    )
  if (value.end !== undefined) indent.push(`w:right="${value.end}"`)
  if (value.indent)
    indent.push(
      `w:${value.indent.kind === "firstline" ? "firstLine" : "hanging"}="${value.indent.value}"`
    )
  return [
    value.paragraphStyle
      ? `<w:pStyle w:val="Paper-${xml(value.paragraphStyle)}"/>`
      : "",
    toggle("keepNext", value.keepNext),
    toggle("keepLines", value.keepTogether),
    toggle("widowControl", value.widowOrphan),
    structure,
    spacing.length ? `<w:spacing ${spacing.join(" ")}/>` : "",
    indent.length ? `<w:ind ${indent.join(" ")}/>` : "",
    value.alignment
      ? `<w:jc w:val="${value.alignment === "justify" ? "both" : value.alignment}"/>`
      : "",
  ].join("")
}

export function pageProperties(page: DocumentPresentation["page"]): string {
  return `<w:sectPr><w:pgSz w:w="${page.width}" w:h="${page.height}" w:orient="${page.orientation}"/><w:pgMar w:top="${page.top}" w:right="${page.end}" w:bottom="${page.bottom}" w:left="${page.start}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`
}
