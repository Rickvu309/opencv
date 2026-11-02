import { isLetterDocument, type LetterDocument } from "@workspace/domain"

/** A stored document as a letter. A row that is not a strict letter still
 * shows its body; anything without one reads as empty. */
export function letterOf(source: unknown): LetterDocument {
  if (isLetterDocument(source)) return source
  const markdown =
    source && typeof source === "object"
      ? (source as { markdown?: unknown }).markdown
      : undefined
  return { markdown: typeof markdown === "string" ? markdown : "" }
}

/**
 * The letter body is one plain string, and the paragraphs are a view over it:
 * the literal blank line "\n\n" separates them, so splitting and joining never
 * change a character of a string nobody edited. A single "\n" is a line break
 * inside a paragraph.
 *
 * While the writer edits, the paragraph array is the source of truth for the
 * view. The string is derived from it with `saveBody`. A soft break typed at
 * the end of a paragraph stays in that paragraph on screen, with the caret
 * after it, although the stored string cannot say which paragraph owns the
 * third newline of "\n\n\n".
 */
const SEPARATOR = "\n\n"

export type BodyPosition = { index: number; offset: number }

export type ParagraphEdit = {
  paragraphs: string[]
  /** Where the caret belongs, when it is not where the browser left it. */
  caret: BodyPosition | null
}

export function paragraphsOf(body: string): string[] {
  return body.split(SEPARATOR)
}

/** Every paragraph joined with the blank line, byte for byte. */
export function bodyOf(paragraphs: readonly string[]): string {
  return paragraphs.join(SEPARATOR)
}

/** The string to store for the paragraphs on screen. A line break at the very
 * end of a paragraph has nothing after it to break from, and kept in the
 * string it would read as the start of the next paragraph on reload. So it
 * is cut. A break followed by text, and every start, stay exactly. */
export function saveBody(paragraphs: readonly string[]): string {
  return bodyOf(paragraphs.map((text) => text.replace(/\n+$/, "")))
}

/** The paragraph and offset inside a list for an offset into its join. An
 * offset strictly inside a separator reads as the next paragraph's start. */
export function locate(
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

/** True when a blank line sits inside the text, not just after its end. */
function holdsBlankLine(text: string): boolean {
  return text.replace(/\n+$/, "").includes(SEPARATOR)
}

/**
 * A paragraph field changed to `value` with the caret at `caret`. A line break
 * the writer just typed (`soft`) stays in the paragraph, wherever the caret is.
 * Any other change that leaves a blank line inside the text, a paste or the
 * next key after two soft breaks, cuts the text into paragraphs, because the
 * stored string would read that blank line as a paragraph break anyway. The
 * caret goes with the text it was after.
 */
export function editParagraph(
  paragraphs: readonly string[],
  index: number,
  value: string,
  caret: number,
  soft: boolean
): ParagraphEdit {
  const next = paragraphs.slice()
  if (soft || !holdsBlankLine(value)) {
    next[index] = value
    return { paragraphs: next, caret: null }
  }
  const parts = paragraphsOf(value)
  next.splice(index, 1, ...parts)
  const where = locate(parts, caret)
  return {
    paragraphs: next,
    caret: { index: index + where.index, offset: where.offset },
  }
}

/** Enter: cut paragraph `index` at the selection, which Enter replaces. */
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

/** Backspace at the start of paragraph `index`, or Delete at the end of the one
 * before it: the paragraph joins the one above, and the caret sits at the joint. */
export function mergeParagraph(
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
