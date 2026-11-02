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

  const NEWLINE_PARTS = fc.array(
    fc.constantFrom("a", "é", "\n", "\r\n", "\n\n", "\n\n\n", " ", "👩"),
    { maxLength: 30 }
  )

  it("locates what offsetOf placed, for every position a paragraph holds", () => {
    fc.assert(
      fc.property(NEWLINE_PARTS, (parts) => {
        const paragraphs = paragraphsOf(parts.join(""))
        for (let index = 0; index < paragraphs.length; index += 1) {
          for (
            let offset = 0;
            offset <= paragraphs[index]!.length;
            offset += 1
          ) {
            const global = offsetOf(paragraphs, index, offset)
            expect(locate(paragraphs, global)).toEqual({ index, offset })
          }
        }
      })
    )
  })

  it("moves a caret inside a separator forward, by one character at most", () => {
    fc.assert(
      fc.property(NEWLINE_PARTS, fc.nat(80), (parts, raw) => {
        const text = parts.join("")
        const paragraphs = paragraphsOf(text)
        const offset = raw % (text.length + 1)
        const position = locate(paragraphs, offset)
        expect(position.offset).toBeGreaterThanOrEqual(0)
        expect(position.offset).toBeLessThanOrEqual(
          paragraphs[position.index]!.length
        )
        const back = offsetOf(paragraphs, position.index, position.offset)
        expect(back - offset).toBeGreaterThanOrEqual(0)
        expect(back - offset).toBeLessThanOrEqual(1)
      })
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

  it("puts the caret after a split at the global offset plus the separator", () => {
    fc.assert(
      fc.property(NEWLINE_PARTS, fc.nat(80), (parts, raw) => {
        const text = parts.join("")
        const offset = raw % (text.length + 1)
        const split = splitAt(text, offset)
        const paragraphs = paragraphsOf(split)
        const where = locate(paragraphs, offset + 2)
        const back = offsetOf(paragraphs, where.index, where.offset)
        expect(back - (offset + 2)).toBeGreaterThanOrEqual(0)
        expect(back - (offset + 2)).toBeLessThanOrEqual(1)
      })
    )
  })

  it("keeps the caret on the line after a split that follows a line break", () => {
    // "a\nb" with the caret before "b": the new break joins the old one.
    const split = splitAt("a\nb", 2)
    expect(paragraphsOf(split)).toEqual(["a", "\nb"])
    expect(locate(paragraphsOf(split), 4)).toEqual({ index: 1, offset: 1 })
  })

  it("follows a line break typed at the end of a paragraph into the next one", () => {
    expect(locate(["ab", "\ncd"], 3)).toEqual({ index: 1, offset: 0 })
  })

  it("splitAt only inserts the separator, and mergeBefore takes one out", () => {
    fc.assert(
      fc.property(NEWLINE_PARTS, fc.nat(80), (parts, raw) => {
        const text = parts.join("")
        const offset = raw % (text.length + 1)
        const split = splitAt(text, offset)
        expect(split.slice(0, offset) + split.slice(offset + 2)).toBe(text)
        const paragraphs = paragraphsOf(split)
        for (let index = 1; index < paragraphs.length; index += 1) {
          const merged = mergeBefore(split, index)
          expect(merged.body.length).toBe(split.length - 2)
          expect(paragraphsOf(merged.body).length).toBeLessThanOrEqual(
            paragraphs.length
          )
        }
      })
    )
  })
})
