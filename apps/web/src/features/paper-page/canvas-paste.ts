import {
  insertText,
  pointSpan,
  splitParagraph,
  type TextSpan,
  type WritingDraft,
} from "./canvas-edit.ts"

export function plainCharacters(value: string) {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n")
}

export function pastePlain(
  draft: WritingDraft,
  span: TextSpan,
  value: string
): WritingDraft {
  const lines = plainCharacters(value).split("\n")
  let next = insertText(draft, span, "")
  lines.forEach((line, index) => {
    if (index > 0) next = splitParagraph(next, pointSpan(next.caret))
    if (line) next = insertText(next, pointSpan(next.caret), line)
  })
  return next
}
