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
 * The letter body is one plain string. Paragraphs are a view over it: the
 * literal blank line "\n\n" separates them, so splitting and joining never
 * change a character. A single "\n" stays a line break inside a paragraph.
 */
const SEPARATOR = "\n\n"

export type BodyPosition = { index: number; offset: number }

export function paragraphsOf(body: string): string[] {
  return body.split(SEPARATOR)
}

export function bodyOf(paragraphs: readonly string[]): string {
  return paragraphs.join(SEPARATOR)
}

/** The paragraph and offset inside it for an offset into the whole body.
 * An offset strictly inside a separator reads as the next paragraph's start. */
export function locate(
  paragraphs: readonly string[],
  globalOffset: number
): BodyPosition {
  let remaining = Math.max(0, globalOffset)
  for (let index = 0; index < paragraphs.length; index += 1) {
    const length = paragraphs[index]!.length
    if (remaining <= length) return { index, offset: remaining }
    remaining -= length + SEPARATOR.length
    // An offset inside a separator moves forward to the start of the next
    // paragraph, so a line break typed at a paragraph's end is followed.
    if (remaining < 0) return { index: index + 1, offset: 0 }
  }
  const last = Math.max(0, paragraphs.length - 1)
  return { index: last, offset: paragraphs[last]?.length ?? 0 }
}

/** The inverse of locate for every position a paragraph can hold. */
export function offsetOf(
  paragraphs: readonly string[],
  index: number,
  offset: number
): number {
  let total = 0
  for (let at = 0; at < index; at += 1) {
    total += paragraphs[at]!.length + SEPARATOR.length
  }
  return total + offset
}

/** Insert a paragraph break at a global offset. */
export function splitAt(body: string, offset: number): string {
  return body.slice(0, offset) + SEPARATOR + body.slice(offset)
}

/** Remove the separator before paragraph `index`. Returns the body and the
 * global offset of the joint, where the caret belongs. */
export function mergeBefore(
  body: string,
  index: number
): { body: string; joint: number } {
  const paragraphs = paragraphsOf(body)
  if (index <= 0 || index >= paragraphs.length) return { body, joint: 0 }
  const joint = offsetOf(paragraphs, index - 1, paragraphs[index - 1]!.length)
  return {
    body: body.slice(0, joint) + body.slice(joint + SEPARATOR.length),
    joint,
  }
}
