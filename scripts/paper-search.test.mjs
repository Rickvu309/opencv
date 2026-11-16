import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/paper-search.mjs"

const path = "packages/paper-crdt/src/native-layout-search.ts"
const mistakes = [
  "export function paperSearchMatches(doc, query) { const needle = normalizedIndex(query, matchCase).text; for (const segment of graphemes.segment(original)) search(segment) }\nfunction replacement() {}",
  "replace(text: string, all: boolean) { view.dispatch(tr.replaceWith(from, to, text)) }, destroy() {}",
  "const position = old ? tr.mapping.map(old.from) : 0",
  "export function paperSearchMatches(doc, query) { const needle = normalize(query, matchCase); return blockIndexes(doc).find(needle) }\nfunction replacement() {}",
]
const clean = [
  "export function paperSearchMatches(doc, query) { const needle = normalizedIndex(query, matchCase).text; return blockIndexes(doc).find(needle) }\nfunction replacement() {}",
  'replace(text: string, all: boolean) { tr.setMeta(key, {kind: "replace", after: tr.mapping.map(current.to, 1)}); view.dispatch(tr) }, destroy() {}',
  "const position = relativePositionToAbsolutePosition(anchor) ?? tr.mapping.map(old.from)",
  "export function paperSearchMatches(doc, query) { const needle = normalizedIndex(query, matchCase).text; return blockIndexes(doc).find(needle) }\nfunction replacement() {}",
]

for (const [index, mistake] of mistakes.entries())
  test(`search regression ${index + 1} fires and its fix stays quiet`, () => {
    assert.equal(detect(mistake, path).length, 1)
    assert.deepEqual(detect(clean[index], path), [])
    assert.deepEqual(detect(mistake, "src/other.ts"), [])
  })

test("Paper search keeps incremental indexes, replacement continuation and Yjs anchors", () => {
  assert.deepEqual(
    detect(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), path),
    []
  )
})
