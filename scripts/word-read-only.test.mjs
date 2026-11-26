import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detect } from "./lib/word-read-only.mjs"

test("the Word module checks a read-only package before it drafts an edit", () => {
  const mistake =
    "async function draft() { const opened = await PaperPackage.open(bytes, context); const drafted = mutateWord(bytes, side, ops) }"
  const clean = mistake.replace(
    "const drafted",
    "if (opened.readOnly()) return refused(); const drafted"
  )
  const late = mistake.replace(
    "const drafted = mutateWord(bytes, side, ops)",
    "const drafted = mutateWord(bytes, side, ops); opened.readOnly()"
  )
  assert.deepEqual(
    detect(mistake).map(({ kind }) => kind),
    ["unchecked-read-only-package"]
  )
  assert.deepEqual(detect(clean), [])
  assert.deepEqual(
    detect(late).map(({ kind }) => kind),
    ["unchecked-read-only-package"]
  )
  const source = readFileSync(
    new URL(
      "../apps/api/src/paper/word-package/word/document.ts",
      import.meta.url
    ),
    "utf8"
  )
  assert.deepEqual(detect(source), [])
  const mutation = source.replace("if (opened.readOnly())", "if (false)")
  assert.notEqual(source, mutation)
  assert.deepEqual(
    detect(mutation).map(({ kind }) => kind),
    ["unchecked-read-only-package"]
  )
})
