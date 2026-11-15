import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  detectMixedTextUnits,
  detectUnboundedHrefTrim,
} from "./lib/paper-text-marks.mjs"

test("rich text preserves UTF-16 positions around emoji", () => {
  assert.ok(
    detectMixedTextUnits(
      "Array.from(text, (_, index) => ({ text: text[index], bold: true }))"
    ).length > 0
  )
  assert.deepEqual(
    detectMixedTextUnits(
      "Array.from({ length: text.length }, (_, index) => ({ text: text[index], bold: true }))"
    ),
    []
  )
  assert.deepEqual(
    detectMixedTextUnits(
      "Array.from(text, (character) => ({ text: character, bold: true }))"
    ),
    []
  )
  assert.deepEqual(
    detectMixedTextUnits(
      readFileSync(
        new URL(
          "../packages/domain/src/paper-doc/merge-text.ts",
          import.meta.url
        ),
        "utf8"
      )
    ),
    []
  )
})

test("href trimming cannot restart an unbounded whitespace suffix search", () => {
  assert.ok(
    detectUnboundedHrefTrim(String.raw`value.replace(/(?:\s|\p{Cc})+$/u, "")`)
      .length > 0
  )
  assert.deepEqual(
    detectUnboundedHrefTrim(String.raw`value.replace(/^(?:\s|\p{Cc})+/u, "")`),
    []
  )
  assert.deepEqual(
    detectUnboundedHrefTrim(String.raw`value.replace(/\s$/u, "")`),
    []
  )
  assert.deepEqual(
    detectUnboundedHrefTrim(
      String.raw`while (end > start && /[\s\p{Cc}]/u.test(value.charAt(end - 1))) end -= 1`
    ),
    []
  )
  assert.deepEqual(
    detectUnboundedHrefTrim(
      readFileSync(
        new URL(
          "../packages/domain/src/paper-doc/rich-text.ts",
          import.meta.url
        ),
        "utf8"
      )
    ),
    []
  )
})
