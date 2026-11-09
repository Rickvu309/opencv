import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import test from "node:test"
import { detect } from "./lib/cleanup-process-readability.mjs"

test("an unreadable process cannot veto every worktree", () => {
  assert.deepEqual(
    detect(
      "try { for (const pid of pids) inspect(pid) } catch { return { safe: false } }"
    ),
    [1]
  )
  assert.deepEqual(
    detect(
      "for (const pid of pids) { try { inspect(pid) } catch { warnings.add(pid) } }"
    ),
    []
  )
  assert.ok(
    detect(
      execFileSync(
        "git",
        ["show", "5bbda529:scripts/ocv-tools/ports/activity.mjs"],
        { encoding: "utf8" }
      )
    ).length > 0
  )
  assert.deepEqual(
    detect(
      readFileSync(
        new URL("./ocv-tools/ports/activity.mjs", import.meta.url),
        "utf8"
      )
    ),
    []
  )
})
