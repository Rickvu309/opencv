import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"

const text = (rel) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")

test("rule markers and hereFact stay private", () => {
  const doc = text("./doc.mjs")
  assert.doesNotMatch(doc, /export const BEGIN/)
  assert.doesNotMatch(doc, /export const END/)
  assert.match(doc, /const BEGIN =/)
  assert.match(doc, /const END =/)
  const claim = text("../claim.mjs")
  assert.doesNotMatch(claim, /export function hereFact/)
  assert.match(claim, /function hereFact/)
})
