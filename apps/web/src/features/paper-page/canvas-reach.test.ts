import { describe, expect, it } from "vitest"

import type { WritingDraft } from "./canvas-edit.ts"
import { reachSpan } from "./canvas-reach.ts"

const draft: WritingDraft = {
  blocks: [
    { id: "p1", text: "Thesis on social commerce" },
    { id: "p2", text: "" },
  ],
  caret: { blockId: "p1", offset: 0 },
  nextId: 3,
}

const at = (offset: number, blockId = "p1") => ({
  anchor: { blockId, offset },
  focus: { blockId, offset },
})

const span = (from: number, to: number) => ({
  anchor: { blockId: "p1", offset: from },
  focus: { blockId: "p1", offset: to },
})

describe("how far a word or line delete reaches", () => {
  it("reaches back over the word before the caret at the end, middle and start of a word", () => {
    expect(reachSpan(draft, at(25), "backward", "word")).toEqual(span(17, 25))
    expect(reachSpan(draft, at(17), "backward", "word")).toEqual(span(10, 17))
    expect(reachSpan(draft, at(20), "backward", "word")).toEqual(span(17, 20))
  })

  it("reaches forward over the next word", () => {
    expect(reachSpan(draft, at(0), "forward", "word")).toEqual(span(0, 6))
    expect(reachSpan(draft, at(6), "forward", "word")).toEqual(span(6, 9))
  })

  it("reaches to the start or end of the line", () => {
    expect(reachSpan(draft, at(10), "backward", "line")).toEqual(span(0, 10))
    expect(reachSpan(draft, at(10), "forward", "line")).toEqual(span(10, 25))
  })

  it("stays at the caret at a line's edge, so the delete joins lines like Backspace", () => {
    expect(reachSpan(draft, at(0), "backward", "word")).toEqual(at(0))
    expect(reachSpan(draft, at(25), "forward", "line")).toEqual(at(25))
    expect(reachSpan(draft, at(0, "p2"), "backward", "word")).toEqual(
      at(0, "p2")
    )
  })

  it("keeps a selection and a single character as they are", () => {
    expect(reachSpan(draft, span(2, 5), "backward", "word")).toEqual(span(2, 5))
    expect(reachSpan(draft, at(4), "backward", "character")).toEqual(at(4))
  })
})
