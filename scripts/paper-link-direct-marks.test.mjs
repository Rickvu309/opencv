import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detectDirectMarks as detect } from "./lib/paper-link-patterns.mjs"

test("Word link styling preserves direct marks instead of stripping their XML", () => {
  for (const mark of ["b", "i", "u", "strike"])
    assert.ok(
      detect(`properties.replace(/<w:${mark}\\b[^>]*\\/>/g, "")`).length > 0
    )
  assert.deepEqual(
    detect(String.raw`properties.replace(/<w:color\b[^>]*\/>/g, "")`),
    []
  )
  assert.deepEqual(detect("wordRun(text, properties, href, links)"), [])
  assert.deepEqual(
    detect(
      readFileSync(
        new URL(
          "../apps/api/src/paper/native-output/rich-text.ts",
          import.meta.url
        ),
        "utf8"
      )
    ),
    []
  )
})
