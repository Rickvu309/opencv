import type { WordLine } from "./classify.js"
import {
  editedRun,
  letters,
  lineWith,
  rebuiltRun,
  runsOf,
  type WordSpan,
} from "./runs.js"

function spansOf(line: WordLine) {
  let at = 0
  let keptBefore = 0
  return line.parts.flatMap((part, index) => {
    if (!part.run) {
      if (part.kept && part.kept.text !== "") keptBefore += 1
      return []
    }
    const length = part.run.text.length
    const span = {
      run: part.run,
      index,
      start: at,
      end: at + length,
      keptBefore,
    }
    at += length
    return [span]
  })
}

type Placed = ReturnType<typeof spansOf>[number]

function covering(spans: Placed[], span: WordSpan) {
  if (span.start < span.end)
    return spans.filter(
      (item) => item.start < span.end && item.end > span.start
    )
  const around = spans.filter(
    (item) =>
      item.start <= span.start &&
      span.start <= item.end &&
      (span.keptBefore === undefined || item.keptBefore === span.keptBefore)
  )
  const pick =
    span.lean === "before"
      ? (around.find((item) => item.start < span.start) ?? around[0])
      : ([...around].reverse().find((item) => item.end > span.start) ??
        around.at(-1))
  return pick ? [pick] : []
}

export function rewrite(
  line: WordLine,
  changes: readonly WordSpan[]
): WordLine | "MIXED_FORMAT" | "HELD_GAP" | "SPANS" | "CARET" {
  const spans = spansOf(line)
  const texts = spans.map((span) => span.run.text)
  const ordered = [...changes].sort((left, right) => right.start - left.start)
  for (const [at, change] of ordered.entries()) {
    const right = ordered[at - 1]
    if (
      change.start < 0 ||
      change.start > change.end ||
      change.end > line.text.length ||
      (right &&
        (change.end > right.start ||
          (change.start === change.end && right.start === change.start)))
    )
      return "SPANS"
    const covered = covering(spans, change)
    const first = covered[0]
    const last = covered.at(-1)
    if (!first || !last)
      return change.keptBefore === undefined ? "SPANS" : "CARET"
    if (covered.some((item) => item.run.props !== first.run.props))
      return "MIXED_FORMAT"
    if (
      line.parts
        .slice(first.index, last.index + 1)
        .some((part) => part.kept && part.kept.text !== "")
    )
      return "HELD_GAP"
    const opening = spans.indexOf(first)
    const closing = spans.indexOf(last)
    const head = (texts[opening] ?? "").slice(0, change.start - first.start)
    const tail = (texts[closing] ?? "").slice(change.end - last.start)
    for (let index = opening; index <= closing; index += 1) texts[index] = ""
    texts[opening] = head + change.text + (opening === closing ? tail : "")
    if (closing !== opening) texts[closing] = tail
  }
  let index = 0
  const parts = line.parts.map((part) => {
    if (!part.run) return part
    const text = texts[index] ?? part.run.text
    index += 1
    return { run: editedRun(part.run, text), kept: null }
  })
  return { ...line, parts, text: texts.join("") }
}

export function splitLine(line: WordLine, at: number): [WordLine, WordLine] {
  const runs = runsOf(line)
  const spans = spansOf(line)
  const offset = letters(line.text).slice(0, at).join("").length
  const index = Math.max(
    0,
    spans.findIndex((span) => offset <= span.end)
  )
  const span = spans[index] ?? spans[0]
  if (!span) throw new Error("A line without runs cannot split.")
  const cut = offset - span.start
  return [
    lineWith(line.open, line.props, [
      ...runs.slice(0, index),
      rebuiltRun(span.run, span.run.text.slice(0, cut)),
    ]),
    lineWith("<w:p>", line.props, [
      rebuiltRun(span.run, span.run.text.slice(cut)),
      ...runs.slice(index + 1),
    ]),
  ]
}
