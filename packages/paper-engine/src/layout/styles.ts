import type { Document } from "@workspace/domain/paper-doc"

import type { Mpt } from "./types.js"

export type TemplateId = Document["attrs"]["template"]
export type TextKind =
  "title" | "subtitle" | "heading" | "subheading" | "paragraph"

export type TextStyle = {
  family: string
  sizeMpt: Mpt
  bold: boolean
  italic: boolean
  color: string
  spaceBeforeMpt: Mpt
  spaceAfterMpt: Mpt
  keepWithNext: boolean
}

type Kinds = Record<TextKind, TextStyle>

const INK = "#000000"
export const LINK_COLOR = "#1155cc"
export const LIST_INDENT_MPT = 18000
export const DEFAULT_TAB_MPT = 36000
export const LIST_ITEM_SPACE_AFTER_MPT = 1000
export const TABLE_CELL_PADDING = { x: 5000, y: 3000 } as const
export const TABLE_SPACE = { before: 4000, after: 6000 } as const
export const IMAGE_SPACE_AFTER_MPT = 6000
export const DIVIDER = { height: 12000, rule: 750 } as const

function style(
  family: string,
  sizeMpt: Mpt,
  rest: Partial<TextStyle> = {}
): TextStyle {
  return {
    family,
    sizeMpt,
    bold: false,
    italic: false,
    color: INK,
    spaceBeforeMpt: 0,
    spaceAfterMpt: 3000,
    keepWithNext: false,
    ...rest,
  }
}

function cvKinds(family: string, accent: string, titleMpt: Mpt): Kinds {
  return {
    title: style(family, titleMpt, { bold: true, spaceAfterMpt: 2000 }),
    subtitle: style(family, 13000, { color: "#444444", spaceAfterMpt: 8000 }),
    heading: style(family, 13000, {
      bold: true,
      color: accent,
      spaceBeforeMpt: 10000,
      spaceAfterMpt: 3000,
      keepWithNext: true,
    }),
    subheading: style(family, 11000, {
      bold: true,
      spaceBeforeMpt: 4000,
      spaceAfterMpt: 1000,
      keepWithNext: true,
    }),
    paragraph: style(family, 11000),
  }
}

const letterFamily = "Liberation Serif"

export const TEMPLATE_STYLES: Readonly<Record<TemplateId, Kinds>> = {
  classic: cvKinds("Liberation Sans", INK, 21000),
  modern: cvKinds("Liberation Sans", "#1f3a5f", 24000),
  letter: {
    title: style(letterFamily, 16000, { bold: true, spaceAfterMpt: 6000 }),
    subtitle: style(letterFamily, 12000, { spaceAfterMpt: 10000 }),
    heading: style(letterFamily, 13000, {
      bold: true,
      spaceBeforeMpt: 8000,
      keepWithNext: true,
    }),
    subheading: style(letterFamily, 12000, {
      bold: true,
      spaceBeforeMpt: 4000,
      keepWithNext: true,
    }),
    paragraph: style(letterFamily, 12000, { spaceAfterMpt: 10000 }),
  },
}

export function pageSize(page: Document["attrs"]["page"]): { w: Mpt; h: Mpt } {
  const portrait =
    page.size === "Letter" ? { w: 612000, h: 792000 } : { w: 595276, h: 841890 }
  return page.orientation === "landscape"
    ? { w: portrait.h, h: portrait.w }
    : portrait
}
