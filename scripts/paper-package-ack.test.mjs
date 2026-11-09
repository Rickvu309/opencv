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
const matchedOnly = `export function apply(draft, stored, matched) {
  return { ...draft, saved: matched }
}
`
const storedOrMatched = `export function apply(draft, stored, matched) {
  return { ...draft, saved: stored || matched }
}
`
const inverted = `export function apply(draft, local) {
  const saved = local.transaction !== "complete" && local.words === draft.words
  return { ...draft, saved }
}
`
const arrowFirst = `const apply = (draft, receipt) => ({ ...draft, saved: receipt.ok })
function other() {
  return 1
}
`
const helper = `function isStored(local) {
  return local.transaction === "complete"
}
export function apply(draft, local, receipt) {
  return { ...draft, saved: isStored(local) && receipt.words === draft.words }
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

test("a receipt match or an or-expression is not Saved", () => {
  for (const text of [matchedOnly, storedOrMatched, inverted, arrowFirst]) {
    assert.deepEqual(detect(text, "fixture"), [
      { kind: "package-ack", detail: "ack-saved" },
    ])
  }
})

test("a helper that checks the completed transaction stays quiet", () => {
  assert.deepEqual(detect(helper, "fixture"), [])
})

test("the journal and acknowledgement sources stay quiet", () => {
  for (const path of [
    "apps/web/src/lib/paper-package-journal.ts",
    "apps/web/src/lib/paper-package-ack.ts",
  ]) {
    assert.deepEqual(detect(read(path), path), [])
  }
})
