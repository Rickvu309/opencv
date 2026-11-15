import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { rebaseRuns, retainUnderline } from "./paper-doc/merge-text.ts"
import {
  normalizeRuns,
  type RichText,
  type SafeHref,
} from "./paper-doc/rich-text.ts"
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

describe("bounded link normalization", () => {
  const runsWithHref = (href: string) =>
    normalizeRuns([
      { text: "Việt 😀", underline: true, href: href as SafeHref },
    ])

  it("trims exactly Unicode whitespace and control characters at both edges", () => {
    const edgeCharacters = Array.from({ length: 65536 }, (_, code) =>
      String.fromCharCode(code)
    ).filter((character) => /[\s\p{Cc}]/u.test(character))
    const href = "https://example.com/Việt😀"
    assert.deepEqual(
      runsWithHref(
        edgeCharacters.join("") + href + edgeCharacters.reverse().join("")
      ),
      [{ text: "Việt 😀", underline: true, href }]
    )
    assert.deepEqual(runsWithHref("\t \u0085\u009f"), [
      { text: "Việt 😀", underline: true },
    ])
  })

  it("preserves complete links at the limit despite arbitrarily long padding", () => {
    const prefix = "https://example.com/"
    const href = prefix + "x".repeat(2000 - prefix.length)
    assert.deepEqual(
      runsWithHref("\t".repeat(32768) + href + "\t".repeat(32768)),
      [{ text: "Việt 😀", underline: true, href }]
    )
    assert.deepEqual(runsWithHref(href + "x"), [
      { text: "Việt 😀", underline: true },
    ])
  })

  it("refuses meaningful invalid input without trimming or truncating it away", () => {
    for (const href of [
      "\tjavascript:alert(1)\t",
      "https://",
      "https://example.com/a\tb",
      "https://example.com/a\u0000b",
      "https://example.com/a\u007fb",
      "https://example.com/\u200b",
      "\u200bhttps://example.com/",
      "https://example.com/" + "\t".repeat(32768) + "x",
    ]) {
      assert.deepEqual(runsWithHref(href), [
        { text: "Việt 😀", underline: true },
      ])
    }
  })
})
