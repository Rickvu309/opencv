import fc from "fast-check"
import { describe, expect, it } from "vitest"

import {
  bodyOf,
  editParagraph,
  paragraphAtJoinOffset,
  mergeWithPrevious,
  paragraphsOf,
  saveBody,
  splitParagraph,
  type ParagraphEdit,
} from "./letter-sheet-model"

const TRICKY = [
  "",
  "\n\n",
  "\n\n\n",
  "\n\n\n\n",
  "a\r\n\r\nb",
  "Trailing\n\n",
  "\n\nLeading",
  "emoji 👩‍💻\n\nCJK 履歴書\n\né",
  "line\nbreak\n\nnext",
]

describe("letter sheet model: split and join", () => {
  it("joins what it split for every string", () => {
    for (const text of TRICKY) expect(bodyOf(paragraphsOf(text))).toBe(text)
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (text) => {
        expect(bodyOf(paragraphsOf(text))).toBe(text)
      })
    )
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("a", "é", "\n", "\r", "\n\n", " ", "👩"), {
          maxLength: 40,
        }),
        (parts) => {
          const text = parts.join("")
          expect(bodyOf(paragraphsOf(text))).toBe(text)
        }
      )
    )
  })

  it("splits on a blank line only", () => {
    expect(paragraphsOf("one\ntwo\n\nthree")).toEqual(["one\ntwo", "three"])
    expect(paragraphsOf("")).toEqual([""])
    expect(paragraphsOf("\n\n\n")).toEqual(["", "\n"])
  })

  it("never ends a paragraph that has another after it with a line break", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("a", "\n", "\n\n", " "), { maxLength: 40 }),
        (parts) => {
          const loaded = paragraphsOf(parts.join(""))
          for (const text of loaded.slice(0, -1))
            expect(text.endsWith("\n")).toBe(false)
        }
      )
    )
  })

  it("locates a caret in a join, and moves one inside a separator forward", () => {
    expect(paragraphAtJoinOffset(["ab", "cd"], 0)).toEqual({
      index: 0,
      offset: 0,
    })
    expect(paragraphAtJoinOffset(["ab", "cd"], 2)).toEqual({
      index: 0,
      offset: 2,
    })
    expect(paragraphAtJoinOffset(["ab", "cd"], 3)).toEqual({
      index: 1,
      offset: 0,
    })
    expect(paragraphAtJoinOffset(["ab", "cd"], 6)).toEqual({
      index: 1,
      offset: 2,
    })
    expect(paragraphAtJoinOffset(["ab", "cd"], 99)).toEqual({
      index: 1,
      offset: 2,
    })
    expect(paragraphAtJoinOffset(["ab"], -3)).toEqual({ index: 0, offset: 0 })
  })
})

describe("letter sheet model: editing", () => {
  it("keeps a soft break at a paragraph's end in that paragraph", () => {
    const edit = editParagraph(
      ["Alpha", "Bravo two.", "Charlie"],
      1,
      "Bravo two.\n",
      11,
      true
    )
    expect(edit.paragraphs).toEqual(["Alpha", "Bravo two.\n", "Charlie"])
    expect(edit.caret).toBeNull()
    const typed = editParagraph(edit.paragraphs, 1, "Bravo two.\nX", 12, false)
    expect(typed.paragraphs).toEqual(["Alpha", "Bravo two.\nX", "Charlie"])
    expect(saveBody(typed.paragraphs)).toBe("Alpha\n\nBravo two.\nX\n\nCharlie")
  })

  it("keeps a soft break typed twice in place, then cuts at the next key", () => {
    const first = editParagraph(["ab", "cd"], 0, "ab\n\n", 4, true)
    expect(first.paragraphs).toEqual(["ab\n\n", "cd"])
    expect(first.caret).toBeNull()
    const next = editParagraph(first.paragraphs, 0, "ab\n\nX", 5, false)
    expect(next.paragraphs).toEqual(["ab", "X", "cd"])
    expect(next.caret).toEqual({ index: 1, offset: 1 })
  })

  it("cuts a paste that brings in a blank line, with the caret at its end", () => {
    const edit = editParagraph(["xy"], 0, "xone\n\ntwo\n\nthreey", 17, false)
    expect(edit.paragraphs).toEqual(["xone", "two", "threey"])
    expect(edit.caret).toEqual({ index: 2, offset: 6 })
    const tail = editParagraph(["ab"], 0, "ab line\n", 8, false)
    expect(tail.paragraphs).toEqual(["ab line\n"])
  })

  it("splits at a selection and puts the caret at the next paragraph", () => {
    const edit = splitParagraph(["abcdef", "z"], 0, 2, 4)
    expect(edit.paragraphs).toEqual(["ab", "ef", "z"])
    expect(edit.caret).toEqual({ index: 1, offset: 0 })
    const after = splitParagraph(["a\nb"], 0, 2, 2)
    expect(after.paragraphs).toEqual(["a\n", "b"])
  })

  it("merges into the paragraph above and puts the caret at the joint", () => {
    const edit = mergeWithPrevious(["ab", "cd", "ef"], 1)
    expect(edit.paragraphs).toEqual(["abcd", "ef"])
    expect(edit.caret).toEqual({ index: 0, offset: 2 })
    expect(mergeWithPrevious(["ab"], 0).paragraphs).toEqual(["ab"])
    expect(mergeWithPrevious(["ab"], 3).caret).toBeNull()
  })

  it("saves a line break followed by text exactly, and cuts one at the very end", () => {
    expect(saveBody(["a\nb", "c"])).toBe("a\nb\n\nc")
    expect(saveBody(["a\n", "c"])).toBe("a\n\nc")
    expect(saveBody(["a\n\n", "c\n"])).toBe("a\n\nc")
    expect(saveBody(["a", "\nc"])).toBe("a\n\n\nc")
  })
})

type Step =
  | { kind: "type"; at: number; text: string }
  | { kind: "soft"; at: number }
  | { kind: "enter"; at: number }
  | { kind: "backspace"; at: number }
  | { kind: "paste"; at: number; text: string }

const STEP = fc.oneof(
  fc.record({
    kind: fc.constant("type" as const),
    at: fc.nat(),
    text: fc.constantFrom("a", "bc", " ", "é", "👩"),
  }),
  fc.record({ kind: fc.constant("soft" as const), at: fc.nat() }),
  fc.record({ kind: fc.constant("enter" as const), at: fc.nat() }),
  fc.record({ kind: fc.constant("backspace" as const), at: fc.nat() }),
  fc.record({
    kind: fc.constant("paste" as const),
    at: fc.nat(),
    text: fc.constantFrom("x\n\ny", " Line\n", "\n", "p\nq", "\n\n"),
  })
)

function keystrokeOnParagraphs(
  state: { paragraphs: string[]; index: number; offset: number },
  step: Step
) {
  const { paragraphs } = state
  const index = Math.min(state.index, paragraphs.length - 1)
  const text = paragraphs[index]!
  const offset = Math.min(state.offset, text.length)
  const put = (value: string, caret: number, soft: boolean) => {
    const edit = editParagraph(paragraphs, index, value, caret, soft)
    return settle(edit, index, caret)
  }
  const settle = (edit: ParagraphEdit, from: number, caret: number) => ({
    paragraphs: edit.paragraphs,
    index: edit.caret?.index ?? from,
    offset: edit.caret?.offset ?? caret,
  })
  const inField = (at: number) => at % (text.length + 1)
  if (step.kind === "type" || step.kind === "paste") {
    const value = text.slice(0, offset) + step.text + text.slice(offset)
    return put(value, offset + step.text.length, false)
  }
  if (step.kind === "soft") {
    return put(
      text.slice(0, offset) + "\n" + text.slice(offset),
      offset + 1,
      true
    )
  }
  if (step.kind === "enter") {
    const at = inField(step.at)
    return settle(splitParagraph(paragraphs, index, at, at), index, 0)
  }
  if (offset === 0) {
    return settle(mergeWithPrevious(paragraphs, index), index, 0)
  }
  const value = text.slice(0, offset - 1) + text.slice(offset)
  return put(value, offset - 1, false)
}

describe("letter sheet model: edit, save, reload", () => {
  it("reloads the saved string as the same paragraphs", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("a", "b c", "\n", "\n\n", ""), {
          maxLength: 8,
        }),
        fc.array(STEP, { maxLength: 40 }),
        (seed, steps) => {
          let state = {
            paragraphs: paragraphsOf(seed.join("")),
            index: 0,
            offset: 0,
          }
          for (const step of steps) {
            const caretParagraph = step.at % state.paragraphs.length
            state = {
              ...state,
              index: caretParagraph,
              offset: step.at % (state.paragraphs[caretParagraph]!.length + 1),
            }
            state = keystrokeOnParagraphs(state, step)
            const saved = saveBody(state.paragraphs)
            const reloaded = paragraphsOf(saved)
            const cut = state.paragraphs.map((text) => text.replace(/\n+$/, ""))
            const blankLineInside = cut.some((text) => text.includes("\n\n"))
            if (!blankLineInside) expect(reloaded).toEqual(cut)
            expect(saveBody(reloaded)).toBe(saved)
          }
        }
      ),
      { numRuns: 400 }
    )
  })

  it("keeps a soft break followed by text through save and reload", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("a", "bc", " "), {
          minLength: 1,
          maxLength: 4,
        }),
        fc.array(fc.constantFrom("d", "ef"), { minLength: 1, maxLength: 3 }),
        (heads, tails) => {
          const head = heads.join("")
          const tail = tails.join("")
          const paragraphs = ["first", head, "last"]
          const soft = editParagraph(
            paragraphs,
            1,
            `${head}\n`,
            head.length + 1,
            true
          )
          const typed = editParagraph(
            soft.paragraphs,
            1,
            `${head}\n${tail}`,
            head.length + 1 + tail.length,
            false
          )
          expect(paragraphsOf(saveBody(typed.paragraphs))).toEqual([
            "first",
            `${head}\n${tail}`,
            "last",
          ])
        }
      )
    )
  })

  it("leaves a string nobody edited as it is", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (text) => {
        const loaded = paragraphsOf(text)
        const last = loaded.length - 1
        expect(saveBody(loaded)).toBe(
          bodyOf(loaded.slice(0, last)) +
            (last > 0 ? "\n\n" : "") +
            loaded[last]!.replace(/\n+$/, "")
        )
        if (!text.endsWith("\n")) expect(saveBody(loaded)).toBe(text)
      })
    )
  })
})
