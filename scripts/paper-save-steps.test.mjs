import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import test from "node:test"
import { detectPaperSaveCommandReplay } from "./lib/paper-save-steps.mjs"

const save = new URL("../apps/api/src/paper/operations/save/", import.meta.url)

test("person saves validate steps without replaying commands", () => {
  assert.equal(
    detectPaperSaveCommandReplay("engine.run(state, change.commands, origin)")
      .length,
    1
  )
  assert.deepEqual(
    detectPaperSaveCommandReplay("await engineLog.append(docId, change)"),
    []
  )
  for (const file of readdirSync(save, { recursive: true })) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue
    assert.deepEqual(
      detectPaperSaveCommandReplay(
        readFileSync(new URL(file, save), "utf8"),
        file
      ),
      [],
      file
    )
  }
})
