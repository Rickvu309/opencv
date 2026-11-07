import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "../../lib/merge-inspection-failure.mjs"

const mistake = `export function mergeResultFacts(ctx, n, head) {
  if (!fetchPull(ctx, n))
    return { n, head, lines: ["Merged-tree check skipped: git fetch failed."] }
  const behind = isBehind(ctx, head)
  if (behind === null)
    return { n, head, lines: ["Merged-tree check skipped: git rev-list failed."] }
  const merged = mergeTreeOf(ctx, head)
  if (merged.error)
    return { n, head, lines: [merged.error] }
}`

const clean = `export function mergeResultFacts(ctx, n, head) {
  if (!fetchPull(ctx, n))
    return { n, head, lines: [], failed: ["git fetch failed"] }
  const behind = isBehind(ctx, head)
  if (behind === null)
    return { n, head, lines: [], failed: ["git rev-list failed"] }
  const merged = mergeTreeOf(ctx, head)
  if (merged.error)
    return { n, head, lines: [], failed: [merged.error] }
}`

test("git inspection failures must return a refusal in merge result facts", () => {
  assert.deepEqual(detect(mistake), [2, 5, 8])
  assert.deepEqual(detect(clean), [])
  assert.deepEqual(
    detect(clean.replaceAll('failed: ["git fetch failed"]', "failed: []")),
    [2]
  )
  assert.deepEqual(
    detect(readFileSync(new URL("./merged-tree.mjs", import.meta.url), "utf8")),
    []
  )
})
