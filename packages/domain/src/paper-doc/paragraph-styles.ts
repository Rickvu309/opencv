import {
  inlineSchema,
  paragraphSchema,
  styleIdSchema,
} from "./presentation-values.js"

export const paperParagraphStyles = [
  {
    id: "normal",
    label: "Normal text",
    wordId: "Normal",
    size: 220,
    bold: false,
    outline: null,
  },
  {
    id: "title",
    label: "Title",
    wordId: "Title",
    size: 520,
    bold: false,
    outline: null,
  },
  {
    id: "heading-1",
    label: "Heading 1",
    wordId: "Heading1",
    size: 400,
    bold: true,
    outline: 0,
  },
  {
    id: "heading-2",
    label: "Heading 2",
    wordId: "Heading2",
    size: 320,
    bold: true,
    outline: 1,
  },
  {
    id: "heading-3",
    label: "Heading 3",
    wordId: "Heading3",
    size: 280,
    bold: true,
    outline: 2,
  },
] as const

export type PaperParagraphStyle = (typeof paperParagraphStyles)[number]["id"]

export function paperParagraphStyle(id: string | null | undefined) {
  return paperParagraphStyles.find((style) => style.id === id)
}

export function paragraphStyleValues(id: string) {
  const style = paperParagraphStyle(id)
  return style
    ? paragraphSchema.parse(
        style.id === "normal" ? {} : { after: 120, keepNext: true }
      )
    : undefined
}

export function paragraphInlineValues(id: string | null | undefined) {
  const style = paperParagraphStyle(id)
  return inlineSchema.parse(style ? { size: style.size, bold: style.bold } : {})
}

export function wordParagraphStyleId(id: string) {
  return paperParagraphStyle(id)?.wordId ?? `Paper-${id}`
}

export function effectiveParagraphStyle(
  type: string,
  style: string | null | undefined,
  level?: unknown
) {
  if (type === "heading") {
    const heading = paperParagraphStyles.find(
      (item) => item.outline !== null && item.outline + 1 === level
    )
    if (heading) return styleIdSchema.parse(heading.id)
  }
  return style == null ? undefined : styleIdSchema.parse(style)
}
