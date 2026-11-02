import { isLetterDocument, type LetterDocument } from "@workspace/domain"

export function readStoredLetter(source: unknown): LetterDocument {
  if (isLetterDocument(source)) return source
  const markdown =
    source && typeof source === "object"
      ? (source as { markdown?: unknown }).markdown
      : undefined
  return { markdown: typeof markdown === "string" ? markdown : "" }
}

const SEPARATOR = "\n\n"

export type BodyPosition = { index: number; offset: number }

export type ParagraphEdit = {
  paragraphs: string[]
  caret: BodyPosition | null
}

export function paragraphsOf(body: string): string[] {
  return body.split(SEPARATOR)
}

export function bodyOf(paragraphs: readonly string[]): string {
  return paragraphs.join(SEPARATOR)
}

export function saveBody(paragraphs: readonly string[]): string {
  return bodyOf(paragraphs.map(withoutTrailingBreaks))
}

export function paragraphAtJoinOffset(
  paragraphs: readonly string[],
  globalOffset: number
): BodyPosition {
  let remaining = Math.max(0, globalOffset)
  for (let index = 0; index < paragraphs.length; index += 1) {
    const length = paragraphs[index]!.length
    if (remaining <= length) return { index, offset: remaining }
    remaining -= length + SEPARATOR.length
    if (remaining < 0) return { index: index + 1, offset: 0 }
  }
  const last = Math.max(0, paragraphs.length - 1)
  return { index: last, offset: paragraphs[last]?.length ?? 0 }
}

function withoutTrailingBreaks(text: string): string {
  return text.replace(/\n+$/, "")
}

function holdsBlankLine(text: string): boolean {
  return withoutTrailingBreaks(text).includes(SEPARATOR)
}

export function editParagraph(
  paragraphs: readonly string[],
  index: number,
  value: string,
  caret: number,
  typedBreak: boolean
): ParagraphEdit {
  const next = paragraphs.slice()
  if (typedBreak || !holdsBlankLine(value)) {
    next[index] = value
    return { paragraphs: next, caret: null }
  }
  const parts = paragraphsOf(value)
  next.splice(index, 1, ...parts)
  const where = paragraphAtJoinOffset(parts, caret)
  return {
    paragraphs: next,
    caret: { index: index + where.index, offset: where.offset },
  }
}

export function splitParagraph(
  paragraphs: readonly string[],
  index: number,
  start: number,
  end: number
): ParagraphEdit {
  const text = paragraphs[index] ?? ""
  const next = paragraphs.slice()
  next.splice(index, 1, text.slice(0, start), text.slice(end))
  return { paragraphs: next, caret: { index: index + 1, offset: 0 } }
}

export function mergeWithPrevious(
  paragraphs: readonly string[],
  index: number
): ParagraphEdit {
  if (index <= 0 || index >= paragraphs.length)
    return { paragraphs: paragraphs.slice(), caret: null }
  const above = paragraphs[index - 1]!
  const next = paragraphs.slice()
  next.splice(index - 1, 2, above + paragraphs[index]!)
  return {
    paragraphs: next,
    caret: { index: index - 1, offset: above.length },
  }
}
