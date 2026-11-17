import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect } from "./lib/paper-rich-convergence.mjs"

test("rich concurrency validates merges and retains refused live content", () => {
  assert.equal(
    detect("if (pending && !sameState(before, after)) return rejected").length,
    1
  )
  assert.equal(
    detect(
      "const session = {client: () => active() && ready && !conflict ? client : null}"
    ).length,
    1
  )
  assert.deepEqual(detect("if (!adapter.read(merged)) return rejected"), [])
  assert.deepEqual(
    detect(
      "const session = {client: () => active() && (ready || conflict) ? client : null}"
    ),
    []
  )
  for (const file of [
    "packages/paper-crdt/src/client.ts",
    "apps/web/src/lib/paper-native-transport.ts",
  ])
    assert.deepEqual(
      detect(
        readFileSync(new URL("../" + file, import.meta.url), "utf8"),
        file
      ),
      []
    )
})

test("rich merge acceptance preserves unacknowledged content before validation", () => {
  const mistake =
    "try { if (!this.adapter.read(merged)) return rejected } finally { merged.destroy() }"
  assert.equal(detect(mistake).length, 1)
  const clean =
    "try { restorations = preservePendingContent(this.ydoc, this.server, merged); restorePendingContent(merged, restorations); if (!this.adapter.read(merged)) return rejected } finally { merged.destroy() }"
  assert.deepEqual(detect(clean), [])
})
