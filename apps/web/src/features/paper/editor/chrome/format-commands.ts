import {
  docCommandSchema,
  type DocCommand,
  type Document,
  type PageSetup,
  type Range,
} from "@workspace/domain/paper-doc"

import { allMarked, indexDoc, ordered, textBlocksIn } from "../doc-positions.ts"
import type {
  Align,
  PaperFont,
  TextStyle,
  ToggleMark,
} from "./selection-format.ts"

const RELAXED_LINE_SPACING = 1.5
export const MPT_PER_CM = 72_000 / 2.54

function blocksIn(doc: Document, range: Range) {
  const index = indexDoc(doc)
  return textBlocksIn(doc, index, ordered(index, range))
}

export function styleCommands(
  doc: Document,
  range: Range,
  kind: TextStyle
): DocCommand[] {
  const blocks = blocksIn(doc, range)
  return blocks.length ? [{ op: "setBlockKind", blocks, kind }] : []
}

export function alignCommands(
  doc: Document,
  range: Range,
  align: Align
): DocCommand[] {
  const blocks = blocksIn(doc, range)
  return blocks.length ? [{ op: "setAlign", blocks, align }] : []
}

export function lineSpacingCommands(
  doc: Document,
  range: Range,
  current: number | null
): DocCommand[] {
  const blocks = blocksIn(doc, range)
  const lineSpacing = current === null ? RELAXED_LINE_SPACING : null
  return blocks.length ? [{ op: "setLineSpacing", blocks, lineSpacing }] : []
}

export function markCommands(
  doc: Document,
  range: Range,
  mark: ToggleMark
): DocCommand[] {
  const index = indexDoc(doc)
  const on = !allMarked(doc, index, ordered(index, range), mark)
  return [{ op: "setMark", range, mark: { type: mark }, on }]
}

export function fontCommands(range: Range, family: PaperFont): DocCommand[] {
  return [
    {
      op: "setMark",
      range,
      mark: { type: "font", attrs: { family } },
      on: true,
    },
  ]
}

export function linkCommands(
  range: Range,
  href: string,
  collapsed: boolean
): DocCommand[] {
  const trimmed = href.trim()
  const full =
    trimmed && !/^(https?:|mailto:)/i.test(trimmed)
      ? `https://${trimmed}`
      : trimmed
  const parsed = docCommandSchema.safeParse({
    op: "setLink",
    range,
    href: full || null,
    ...(collapsed && full
      ? { text: full.replace(/^(https?:\/\/|mailto:)/i, "") }
      : {}),
  })
  return parsed.success ? [parsed.data] : []
}

export function dividerCommands(range: Range): DocCommand[] {
  return [{ op: "insertBlock", at: range.to, block: "divider" }]
}

export function tableCommands(range: Range): DocCommand[] {
  return [{ op: "insertTable", at: range.to, rows: 2, cols: 2 }]
}

export function pageSetupCommands(page: PageSetup): DocCommand[] {
  return [{ op: "setPageSetup", page }]
}
