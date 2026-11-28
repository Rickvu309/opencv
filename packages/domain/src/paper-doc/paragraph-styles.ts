import { paragraphSchema } from "./presentation-values.js"

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
