import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import test from "node:test"
import { detect } from "./lib/cleanup-discovery.mjs"

test("cleanup cannot hide registered worktrees behind a directory prefix", () => {
  assert.deepEqual(
    detect("git.worktrees(main).filter(w => w.path.startsWith(`${root}/`))"),
    [1]
  )
  assert.deepEqual(
    detect("git.worktrees(main).filter(w => w.path !== main)"),
    []
  )
  assert.ok(
    detect(
      execFileSync("git", ["show", "59c277a8:scripts/ocv-tools/work.mjs"], {
        encoding: "utf8",
      })
    ).length > 0
  )
  assert.deepEqual(
    detect(
      readFileSync(new URL("./ocv-tools/work.mjs", import.meta.url), "utf8")
    ),
    []
  )
})
