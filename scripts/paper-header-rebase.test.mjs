import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detectHeaderRebase as detect } from "./lib/paper-blank-canvas.mjs"

test("header rebase refuses a side-only presence decision", () => {
  const mistake =
    "function withMergedHeader(target, input) { if (!input.theirs.header) target.header = input.ours.header }"
  assert.equal(detect(mistake).length, 1)
  const clean =
    "function withMergedHeader(target, input) { const merged = mergeHeader({ base: input.base.header, ours: input.ours.header, theirs: input.theirs.header }); target.header = merged.header }"
  assert.deepEqual(detect(clean), [])
  const path = "packages/domain/src/paper-doc/rebase.ts"
  assert.deepEqual(
    detect(readFileSync(new URL("../" + path, import.meta.url), "utf8")),
    []
  )
  const historic = execFileSync("git", ["show", "d64d3db9:" + path], {
    encoding: "utf8",
  })
  assert.equal(detect(historic).length, 1)
})
