import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/property-seed.mjs"

const root = new URL("../", import.meta.url)
const FILE = "packages/paper-crdt/src/interleave.test.ts"

const RANDOM_ON_EVERY_RUN = `import fc from "fast-check"
import * as Y from "yjs"
function fork(from) {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, from)
  return doc
}
it("keeps what was typed", () => {
  fc.assert(fc.property(scenario, check), { numRuns: 60 })
})
`

const SAME_ON_EVERY_RUN = `import fc from "fast-check"
import * as Y from "yjs"
function fork(from, clientID) {
  const doc = new Y.Doc()
  doc.clientID = clientID
  Y.applyUpdate(doc, from)
  return doc
}
it("keeps what was typed", () => {
  fc.assert(fc.property(scenario, check), { numRuns: 60, seed: 1 })
})
`

test("the detector fires on a property with a random seed and random document ids, and stays quiet once both are fixed", () => {
  assert.equal(detect(RANDOM_ON_EVERY_RUN, FILE).length, 2)
  assert.deepEqual(detect(SAME_ON_EVERY_RUN, FILE), [])
  assert.equal(
    detect(RANDOM_ON_EVERY_RUN, "packages/paper-engine/src/a.test.ts").length,
    2
  )
  assert.deepEqual(detect(RANDOM_ON_EVERY_RUN, "apps/web/src/a.test.ts"), [])
})

test("every property test of the Paper editing package gives the same result on the same commit", () => {
  const files = execFileSync("git", ["ls-files", "packages/paper-engine/src"], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  })
    .split("\n")
    .filter((file) => /\.test\.tsx?$/.test(file))
  const hits = files.flatMap((file) =>
    detect(readFileSync(new URL(file, root), "utf8"), file).map(
      (hit) => `${file}: ${hit}`
    )
  )
  assert.deepEqual(hits, [])
})
