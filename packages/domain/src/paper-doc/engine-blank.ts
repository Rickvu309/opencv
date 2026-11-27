import { blockIdSchema, type Document } from "./engine-document.js"

const ONE_INCH_MPT = 72000

export function emptyPaper(
  kind: "cv" | "letter",
  id = kind === "cv" ? "paragraph-1" : "letter-1"
): Document {
  return {
    type: "doc",
    attrs: {
      schema: 1,
      template: kind === "cv" ? "classic" : "letter",
      page: {
        size: "A4",
        orientation: "portrait",
        marginsMpt: {
          top: ONE_INCH_MPT,
          right: ONE_INCH_MPT,
          bottom: ONE_INCH_MPT,
          left: ONE_INCH_MPT,
        },
      },
    },
    content: [
      {
        type: "text_block",
        attrs: {
          id: blockIdSchema.parse(id),
          kind: "paragraph",
          list: null,
          level: 0,
          align: "left",
          lineSpacing: null,
          keepWithNext: null,
        },
      },
    ],
  }
}

export function blankCv(id?: string): Document {
  return emptyPaper("cv", id)
}

export function blankLetter(id?: string): Document {
  return emptyPaper("letter", id)
}
