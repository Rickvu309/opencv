import * as Y from "yjs"
import {
  formatRunsSchema,
  isWellFormed,
  type FormatRun,
} from "@workspace/domain/internal/paper-presentation"
export type TextSpan = {
  text: Y.XmlText
  from: number
  to: number
  offset: number
}
export function textSpans(
  content: Y.XmlElement<Record<string, string | number | boolean>>
): TextSpan[] {
  const spans: TextSpan[] = []
  let offset = 0
  for (const child of content.toArray()) {
    if (child instanceof Y.XmlText) {
      spans.push({
        text: child,
        from: offset,
        to: offset + child.length,
        offset,
      })
      offset += child.length
    } else if (child instanceof Y.XmlElement && child.nodeName === "hardBreak")
      offset++
    else throw new Error("Unsupported inline embedding")
  }
  return spans
}
export function selectedRuns(
  runs: readonly FormatRun[],
  from: number,
  to: number
): FormatRun[] {
  const full = runs.map((r) => r.text).join("")
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    from >= to ||
    to > full.length ||
    !isWellFormed(full.slice(0, from)) ||
    !isWellFormed(full.slice(from, to)) ||
    !isWellFormed(full.slice(to))
  )
    throw new Error("Invalid UTF16 range")
  let offset = 0
  return formatRunsSchema.parse(
    runs.flatMap((run) => {
      const start = Math.max(from - offset, 0),
        end = Math.min(to - offset, run.text.length)
      offset += run.text.length
      return start < end ? [{ ...run, text: run.text.slice(start, end) }] : []
    })
  )
}
