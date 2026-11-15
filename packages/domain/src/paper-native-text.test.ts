import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { rebaseRuns, retainUnderline } from "./paper-doc/merge-text.ts"
import { normalizeRuns, type RichText } from "./paper-doc/rich-text.ts"
import { mergeWords } from "./paper-doc/word-merge.ts"

describe("marked Unicode text", () => {
  it("keeps every UTF-16 unit and each mark when inserting after emoji", () => {
    const source: RichText = [
      { text: "Việt 😀 ", bold: true, underline: true },
      { text: "team", italic: true },
    ]
    assert.deepEqual(rebaseRuns(source, "Việt 😀 dear team"), [
      { text: "Việt 😀 dear ", bold: true, underline: true },
      { text: "team", italic: true },
    ])
    assert.deepEqual(source, [
      { text: "Việt 😀 ", bold: true, underline: true },
      { text: "team", italic: true },
    ])
  })

  it("replaces a whole surrogate pair without crossing a mark boundary", () => {
    const source: RichText = [
      { text: "Việt 😀", underline: true },
      { text: " team", italic: true },
    ]
    assert.deepEqual(rebaseRuns(source, "Việt 😃 team"), [
      { text: "Việt 😃", underline: true },
      { text: " team", italic: true },
    ])
    assert.deepEqual(rebaseRuns(source, "Việt  team"), [
      { text: "Việt ", underline: true },
      { text: " team", italic: true },
    ])
  })

  it("retains underline while accepting changed words and other marks", () => {
    assert.deepEqual(
      retainUnderline(
        [{ text: "Việt 😀 team", underline: true }],
        [
          { text: "Việt 😀 ", bold: true },
          { text: "colleagues", italic: true },
        ]
      ),
      [
        { text: "Việt 😀 ", bold: true, underline: true },
        { text: "colleagues", italic: true, underline: true },
      ]
    )
  })

  it("preserves an underline-only change during a word merge", () => {
    const base: RichText = [{ text: "Việt 😀 team", bold: true }]
    const marked: RichText = [
      { text: "Việt 😀 team", bold: true, underline: true },
    ]
    assert.deepEqual(mergeWords(base, marked, base), marked)
    assert.deepEqual(mergeWords(base, base, marked), marked)
  })

  it("keeps adjacent runs separate when only underline differs", () => {
    assert.deepEqual(
      normalizeRuns([
        { text: "Việt", bold: true, underline: true },
        { text: " 😀", bold: true },
      ]),
      [
        { text: "Việt", bold: true, underline: true },
        { text: " 😀", bold: true },
      ]
    )
  })
})
