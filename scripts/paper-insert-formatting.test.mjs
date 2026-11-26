import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"

import { detectPaperInsertFormatting as detect } from "./lib/paper-insert-formatting.mjs"
import { pathAtRevision } from "./lib/path-at-revision.mjs"

const path = "apps/api/src/paper/word-package/word/mutate.ts"
const historic = "29c4ce336ca6d1bbebef759244fbdf7c15096d19"

test("inserted Word paragraphs never inherit the first run properties", () => {
  assert.equal(
    detect("function inserted() { const source = runsOf(line)[0] }").length,
    1
  )
  assert.equal(
    detect("function inserted() { const source = runsOf(line).at(0) }").length,
    1
  )
  assert.deepEqual(
    detect("function inserted() { const source = runsOf(line).at(-1) }"),
    []
  )
  assert.deepEqual(
    detect("function unrelated() { const source = runsOf(line)[0] }"),
    []
  )
  assert.ok(
    detect(
      execFileSync(
        "git",
        ["show", `${historic}:${pathAtRevision(historic, path)}`],
        {
          encoding: "utf8",
        }
      ),
      path
    ).length > 0
  )
  assert.deepEqual(
    detect(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), path),
    []
  )
})
