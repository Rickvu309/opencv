import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detect } from "./lib/paper-package-ack.mjs"

const clean = `export function apply(draft, acknowledgement, transaction) {
  const saved =
    transaction === "complete" &&
    acknowledgement.kind === "receipt" &&
    acknowledgement.generation === draft.generation
  return { ...draft, words: draft.words, saved }
}
`
const mistake = `export function apply(draft, acknowledgement) {
  if (acknowledgement.kind === "receipt") return { ...draft, saved: true }
  return draft
}
`

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8")

test("the clean fixture does not treat an acknowledgement as Saved", () => {
  assert.deepEqual(detect(clean, "fixture"), [])
})

test("the mistake fixture treats an acknowledgement alone as Saved", () => {
  assert.deepEqual(detect(mistake, "fixture"), [
    { kind: "package-ack", detail: "ack-saved" },
  ])
  assert.deepEqual(detect(mistake, "other.ts"), [])
})

test("the journal and acknowledgement sources stay quiet", () => {
  for (const path of [
    "apps/web/src/lib/paper-package-journal.ts",
    "apps/web/src/lib/paper-package-ack.ts",
  ]) {
    assert.deepEqual(detect(read(path), path), [])
  }
})
