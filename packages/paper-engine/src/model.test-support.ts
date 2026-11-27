import fc from "fast-check"
import type { Document, Pos, Run } from "@workspace/domain/paper-doc"

import { textContainers } from "./index.js"
import { paperOf, textBlock } from "./engine.test-support.js"

const glyph = fc.constantFrom("a", "b", "c", " ", "é", "😀", ".")
const word = fc
  .array(glyph, { minLength: 1, maxLength: 6 })
  .map((parts) => parts.join(""))
export const typed = fc
  .array(fc.oneof(glyph, fc.constant("\n")), { maxLength: 5 })
  .map((parts) => parts.join(""))

const run: fc.Arbitrary<Run> = fc.oneof(
  {
    weight: 5,
    arbitrary: fc
      .record({ text: word, bold: fc.boolean(), italic: fc.boolean() })
      .map(({ text, bold, italic }): Run => {
        const marks = [
          ...(bold ? [{ type: "bold" as const }] : []),
          ...(italic ? [{ type: "italic" as const }] : []),
        ]
        return marks.length
          ? { type: "text", text, marks }
          : { type: "text", text }
      }),
  },
  { weight: 1, arbitrary: fc.constant<Run>({ type: "hard_break" }) }
)

const block = fc.record({
  runs: fc.array(run, { maxLength: 3 }),
  list: fc.constantFrom(null, "bullet" as const, "numbered" as const),
  level: fc.integer({ min: 0, max: 3 }),
})

export const paper: fc.Arbitrary<Document> = fc
  .array(block, { minLength: 1, maxLength: 5 })
  .map((blocks) =>
    paperOf(
      blocks.map((spec, index) =>
        textBlock(`b${index}`, {
          runs: spec.runs,
          list: spec.list,
          level: spec.list ? spec.level : 0,
        })
      )
    )
  )

function starts(doc: Document) {
  const containers = textContainers(doc)
  let next = 0
  return containers.map((container) => {
    const start = next
    next += container.text.length + 1
    return { container, start }
  })
}

export function posAt(doc: Document, global: number): Pos {
  const spans = starts(doc)
  const total = spans.at(-1)!.start + spans.at(-1)!.container.text.length
  const g = global % (total + 1)
  const span = spans.findLast((each) => each.start <= g)!
  return { block: span.container.block, offset: g - span.start }
}

export function globalOf(doc: Document, pos: Pos): number {
  const span = starts(doc).find((each) => each.container.block === pos.block)!
  return span.start + pos.offset
}

export function blockStart(doc: Document, index: number) {
  return starts(doc)[index]!
}
