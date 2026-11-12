import { createRequire } from "node:module"

import type { WordParagraph } from "@workspace/domain"

export type WordParagraphView = { node: unknown; xml: string; slice: string }

const canvas = createRequire(import.meta.url)(
  "../../../../../scripts/lib/paper-canvas-bytes.mjs"
) as {
  paragraphsOf: (bytes: Uint8Array) => WordParagraphView[]
  contentOf: (paragraph: WordParagraphView) => string
  isCarrier: (paragraph: WordParagraphView) => boolean
  hasNum: (paragraph: WordParagraphView) => boolean
  hasMark: (paragraph: WordParagraphView) => boolean
}

export const paragraphsOf = canvas.paragraphsOf
export const contentOf = canvas.contentOf

const heldReasons = [
  {
    code: "NUMBERING",
    message: "This paragraph is numbered. Paper will not change it.",
    test: canvas.hasNum,
  },
  {
    code: "CHANGE_MARK",
    message: "This paragraph has a change mark. Paper will not change it.",
    test: canvas.hasMark,
  },
]

export function projectParagraphs(
  bytes: Uint8Array,
  keys: readonly string[]
): WordParagraph[] | null {
  const views = paragraphsOf(bytes)
  if (views.length !== keys.length) return null
  return views.flatMap((view, index): WordParagraph[] => {
    if (canvas.isCarrier(view)) return []
    const handle = keys[index] as string
    const text = contentOf(view)
    const held = heldReasons.find((reason) => reason.test(view))
    if (held)
      return [
        {
          handle,
          text,
          pieces: [{ text, editable: false }],
          held: true,
          message: held.message,
          code: held.code,
        },
      ]
    return [
      {
        handle,
        text,
        pieces: [{ text, editable: true }],
        held: false,
        message: "",
        code: null,
      },
    ]
  })
}
