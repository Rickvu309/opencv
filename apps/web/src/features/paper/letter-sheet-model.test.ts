import fc from "fast-check"
import { describe, expect, it } from "vitest"

import {
  bodyOf,
  locate,
  mergeBefore,
  offsetOf,
  paragraphsOf,
  splitAt,
} from "./letter-sheet-model"

const TRICKY = [
  "",
  "\n\n",
  "\n\n\n",
  "\n\n\n\n",
  "a\r\n\r\nb",
  "Trailing\n\n",
  "\n\nLeading",
  "emoji 👩‍💻\n\nCJK 履歴書\n\né",
  "line\nbreak\n\nnext",
]

describe("letter sheet model", () => {
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

  it("locates and offsets are inverse for offsets inside a paragraph", () => {
    const text = "ab\n\n\n\ncd\n\n"
    const paragraphs = paragraphsOf(text)
    for (let index = 0; index < paragraphs.length; index += 1) {
      for (let offset = 0; offset <= paragraphs[index]!.length; offset += 1) {
        const global = offsetOf(paragraphs, index, offset)
        expect(locate(paragraphs, global)).toEqual({ index, offset })
      }
    }
  })

  it("offsetOf after locate returns the offset outside a separator", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("a", "b", "\n", "\n\n", "é"), {
          maxLength: 30,
        }),
        fc.nat(80),
        (parts, raw) => {
          const text = parts.join("")
          const paragraphs = paragraphsOf(text)
          const offset = raw % (text.length + 1)
          const position = locate(paragraphs, offset)
          const back = offsetOf(paragraphs, position.index, position.offset)
          const inSeparator = back !== offset
          if (!inSeparator) return
          // Inside a separator the caret snaps to the end of the paragraph
          // before it, never past it.
          expect(back).toBeLessThan(offset)
          expect(offset - back).toBeLessThan(2)
        }
      )
    )
  })

  it("clamps a caret past the end to the last paragraph", () => {
    expect(locate(["ab", "cd"], 99)).toEqual({ index: 1, offset: 2 })
    expect(locate(["ab"], -3)).toEqual({ index: 0, offset: 0 })
  })

  it("splitAt adds one blank line at the offset", () => {
    expect(splitAt("hello world", 5)).toBe("hello\n\n world")
    expect(paragraphsOf(splitAt("hello world", 5))).toEqual(["hello", " world"])
    expect(splitAt("", 0)).toBe("\n\n")
  })

  it("mergeBefore removes the separator and reports the joint", () => {
    expect(mergeBefore("ab\n\ncd", 1)).toEqual({ body: "abcd", joint: 2 })
    expect(mergeBefore("ab\n\ncd\n\nef", 2)).toEqual({
      body: "ab\n\ncdef",
      joint: 6,
    })
    expect(mergeBefore("ab\n\ncd", 0)).toEqual({ body: "ab\n\ncd", joint: 0 })
    expect(mergeBefore("ab", 3)).toEqual({ body: "ab", joint: 0 })
  })

  it("splitAt then mergeBefore returns the original body", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), fc.nat(80), (text, raw) => {
        const offset = raw % (text.length + 1)
        const split = splitAt(text, offset)
        const position = locate(paragraphsOf(split), offset + 2)
        if (position.offset === 0 && position.index > 0) {
          const merged = mergeBefore(split, position.index)
          expect(merged.body).toBe(text)
          expect(merged.joint).toBe(offset)
        }
      })
    )
  })
})
