import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "../../lib/merged-tree-setup.mjs"

test("a merged-tree setup failure is a refusal, never a successful skip", () => {
  assert.deepEqual(
    detect(readFileSync(new URL("./merged-tree.mjs", import.meta.url), "utf8")),
    []
  )
  assert.deepEqual(
    detect(
      "if (!commit.ok)\n  return { skipped: `could not build the merged commit: ${commit.err}` }"
    ),
    [2]
  )
  assert.deepEqual(detect("const skipped = 1\nreturn { ran: 0, skipped }"), [2])
  assert.deepEqual(
    detect(
      "if (!commit.ok)\n  return { ran: 0, swept: 0, failed: [`could not build the merged commit (${commit.err})`] }"
    ),
    []
  )
})
