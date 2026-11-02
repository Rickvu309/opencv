import {
  normalizeRuns,
  plainTextOfRuns,
  type RichText,
  type TextRun,
} from "./rich-text.js"

type Marks = Pick<TextRun, "bold" | "italic" | "href">

function marksPerUnit(runs: RichText): Marks[] {
  return runs.flatMap((run) =>
    Array.from({ length: run.text.length }, () => ({
      ...(run.bold ? { bold: true as const } : {}),
      ...(run.italic ? { italic: true as const } : {}),
      ...(run.href ? { href: run.href } : {}),
    }))
  )
}

function isHighSurrogate(code: number) {
  return code >= 0xd800 && code <= 0xdbff
}

function isLowSurrogate(code: number) {
  return code >= 0xdc00 && code <= 0xdfff
}

export function rebaseRuns(old: RichText, text: string): RichText {
  const oldText = plainTextOfRuns(old)
  if (oldText === text) return old
  const limit = Math.min(oldText.length, text.length)
  let prefix = 0
  while (prefix < limit && oldText[prefix] === text[prefix]) prefix += 1
  if (prefix > 0 && isHighSurrogate(oldText.charCodeAt(prefix - 1))) {
    prefix -= 1
  }
  let suffix = 0
  while (
    suffix < limit - prefix &&
    oldText[oldText.length - 1 - suffix] === text[text.length - 1 - suffix]
  ) {
    suffix += 1
  }
  if (
    suffix > 0 &&
    isLowSurrogate(oldText.charCodeAt(oldText.length - suffix))
  ) {
    suffix -= 1
  }
  const marks = marksPerUnit(old)
  const inserted: Marks = prefix > 0 ? (marks[prefix - 1] ?? {}) : {}
  const runs: TextRun[] = Array.from(text, (_, index) => {
    const from = text.length - suffix
    const source =
      index < prefix
        ? marks[index]
        : index >= from
          ? marks[oldText.length - (text.length - index)]
          : inserted
    return { text: text[index] ?? "", ...(source ?? {}) }
  })
  return normalizeRuns(runs)
}
