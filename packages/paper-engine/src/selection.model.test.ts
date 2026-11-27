import fc from "fast-check"
import { describe, expect, it } from "vitest"
import type { SelectionCommand } from "@workspace/domain/paper-doc"

import {
  documentText,
  selectionRange,
  textContainers,
  type EditorState,
} from "./index.js"
import { newEngine, person } from "./engine.test-support.js"
import { globalOf, paper, posAt, typed } from "./model.test-support.js"

const unit = fc.constantFrom(
  "char",
  "word",
  "line",
  "lineEdge",
  "block",
  "doc" as const
)
const dir = fc.constantFrom(1, -1 as const)
const move = fc.record({
  op: fc.constant("move" as const),
  unit,
  dir,
  extend: fc.boolean(),
})
const pick = fc.record({
  op: fc.constant("pick" as const),
  a: fc.nat(400),
  b: fc.nat(400),
})
const command = fc.oneof(
  move,
  pick,
  fc.constantFrom(
    { op: "selectAll" as const },
    { op: "selectWord" as const },
    { op: "selectBlock" as const }
  )
)

describe("selection", () => {
  it("a move without extend always collapses, and an extending move keeps the anchor", () => {
    fc.assert(
      fc.property(
        paper,
        fc.array(command, { maxLength: 15 }),
        (start, commands) => {
          const engine = newEngine()
          let state: EditorState = engine.load(start, 0, "tab-1")
          const text = documentText(start)
          for (const each of commands) {
            const before = engine.read(state).selection
            const selectionCommand: SelectionCommand =
              each.op === "pick"
                ? {
                    op: "select",
                    selection: {
                      kind: "text",
                      anchor: posAt(start, each.a),
                      head: posAt(start, each.b),
                    },
                  }
                : each
            state = engine.select(state, selectionCommand)
            const { doc, selection } = engine.read(state)
            expect(documentText(doc)).toBe(text)
            if (selection.kind === "text") {
              for (const pos of [selection.anchor, selection.head]) {
                const container = textContainers(doc).find(
                  (c) => c.block === pos.block
                )!
                expect(pos.offset).toBeLessThanOrEqual(container.text.length)
              }
            }
            if (each.op !== "move") continue
            expect(selection.kind).toBe("text")
            if (selection.kind !== "text") continue
            if (!each.extend) expect(selection.anchor).toEqual(selection.head)
            else if (before.kind === "text")
              expect(selection.anchor).toEqual(before.anchor)
          }
        }
      ),
      { numRuns: 10_000, seed: 2213 }
    )
  })

  it("select all, then a move without extend, then typing inserts at one point and keeps all text", () => {
    fc.assert(
      fc.property(paper, unit, dir, typed, (start, moveUnit, moveDir, text) => {
        const engine = newEngine()
        let state = engine.select(engine.load(start, 0, "tab-1"), {
          op: "selectAll",
        })
        state = engine.select(state, {
          op: "move",
          unit: moveUnit,
          dir: moveDir,
          extend: false,
        })
        const { doc, selection } = engine.read(state)
        const range = selectionRange(doc, selection)
        const before = documentText(doc)
        const caret = globalOf(doc, range.from)
        expect(globalOf(doc, range.to)).toBe(caret)
        if (moveDir > 0 && ["char", "lineEdge", "doc"].includes(moveUnit))
          expect(caret).toBe(before.length)
        if (moveDir < 0 && ["char", "doc"].includes(moveUnit))
          expect(caret).toBe(0)
        const result = engine.run(
          state,
          [{ op: "insertText", range, text }],
          person
        )
        if ("refusal" in result) throw new Error(JSON.stringify(result.refusal))
        expect(documentText(engine.read(result.state).doc)).toBe(
          before.slice(0, caret) + text + before.slice(caret)
        )
      }),
      { numRuns: 10_000, seed: 2214 }
    )
  })
})
