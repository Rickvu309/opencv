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
const replySaved = `export function apply(draft, reply) {
  return { ...draft, saved: reply.saved }
}
`
const earlyTrue = `function isStored(local) {
  if (!local) return true
  return local.transaction === "complete"
}
export function apply(draft, local, matched) {
  return { ...draft, saved: isStored(local) && matched }
}
`
const nestedReturn = `function isStored(local) {
  const unused = () => {
    return local.transaction === "complete"
  }
  return true
}
export function apply(draft, local, matched) {
  return { ...draft, saved: isStored(local) && matched }
}
`
const copiedFlag = `export function apply(draft, matched) {
  const next = { ...draft }
  next.saved = matched
  return next
}
`
const receiptTransaction = `export function apply(draft, receipt) {
  return { ...draft, saved: receipt.transaction === "complete" }
}
`
const stringKey = `export function apply(draft, matched) {
  return { ...draft, "saved": matched }
}
`
const shorthand = `export function apply(draft, reply) {
  const { saved } = reply
  return { ...draft, saved }
}
`
const shadow = `const stored = local.transaction === "complete"
export function apply(draft, stored) {
  return { ...draft, saved: stored }
}
`
const earlyFalse = `function isStored(local) {
  if (!local) return false
  return local.transaction === "complete"
}
export function apply(draft, local, matched) {
  return { ...draft, saved: isStored(local) && matched }
}
`
const innerConst = `function isStored(local) {
  const done = local.transaction === "complete"
  return done
}
export function apply(draft, local, matched) {
  return { ...draft, saved: isStored(local) && matched }
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
  assert.deepEqual(detect(earlyFalse, "fixture"), [])
  assert.deepEqual(detect(innerConst, "fixture"), [])
})

test("a copied saved flag or a bypassing helper return is not Saved", () => {
  for (const text of [
    replySaved,
    earlyTrue,
    nestedReturn,
    copiedFlag,
    receiptTransaction,
    stringKey,
    shorthand,
    shadow,
  ]) {
    assert.deepEqual(detect(text, "fixture"), [
      { kind: "package-ack", detail: "ack-saved" },
    ])
  }
})

test("the journal and acknowledgement sources stay quiet", () => {
  for (const path of [
    "apps/web/src/lib/paper-package-journal.ts",
    "apps/web/src/lib/paper-package-ack.ts",
  ]) {
    assert.deepEqual(detect(read(path), path), [])
  }
})
