import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detectLetterCoachFocus } from "./lib/paper-coach-focus.mjs"

test("the Letter publishes its open document to Coach and returns the release", () => {
  assert.equal(
    detectLetterCoachFocus("function PaperLetterEditor() { return null }")
      .length,
    1
  )
  assert.deepEqual(
    detectLetterCoachFocus(
      "function PaperLetterEditor() { useEffect(() => holdWritingCoachFocus(doc.id), [doc.id]); return null }"
    ),
    []
  )
  assert.equal(
    detectLetterCoachFocus(
      "function PaperLetterEditor() { useEffect(() => { holdWritingCoachFocus(doc.id) }, [doc.id]); return null }"
    ).length,
    1
  )
  assert.deepEqual(
    detectLetterCoachFocus(
      readFileSync(
        new URL(
          "../apps/web/src/features/paper/paper-letter.tsx",
          import.meta.url
        ),
        "utf8"
      )
    ),
    []
  )
})
