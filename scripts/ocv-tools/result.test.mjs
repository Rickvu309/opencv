// The node writer produces a schema-1 record that result-check accepts.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { writeResult } from "./result.mjs"

const checker = fileURLToPath(
  new URL("../lib/result-check.mjs", import.meta.url)
)

function check(file, ...expects) {
  execFileSync("node", [checker, file, ...expects], { encoding: "utf8" })
}

test("pending delivery is recorded without claiming success", () => {
  mkdirSync(join(process.env.HOME, "tmp"), { recursive: true })
  const dir = mkdtempSync(join(process.env.HOME, "tmp", "ocv-pending-"))
  const next = "Observe the PR merge before cleanup"
  const file = writeResult(
    { PR_RESULT_DIR: dir, PR_RESULT_REPO: "opencv" },
    {
      script: "merge-pr",
      id: "queued-node",
      status: "pending",
      detail: "queued PR #764",
      next,
      startedAt: new Date(),
    }
  )
  check(file, "status=pending", "cause=none", `next=${next}`)
  assert.throws(() => check(file, "status=ok"))
})
