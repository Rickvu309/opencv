import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detectMixedTextUnits } from "./lib/paper-text-marks.mjs"

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
