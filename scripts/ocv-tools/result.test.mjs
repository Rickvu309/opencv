import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { writeResult } from "./result.mjs"
import { tempDir } from "../lib/temp-dir.mjs"

const SPAWN_TIMEOUT_MS = 30_000

const checker = fileURLToPath(
  new URL("../lib/result-check.mjs", import.meta.url)
)

function check(file, ...expects) {
  execFileSync("node", [checker, file, ...expects], {
    encoding: "utf8",
    timeout: SPAWN_TIMEOUT_MS,
  })
}

test("pending delivery is recorded without claiming success", (t) => {
  const dir = tempDir(t, "ocv-pending-")
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

test("a write error returns null from writeResult(env, record) so ocv-tools never crashes after a push, and throws from writeResult(record) for scripts/pr", (t) => {
  const parent = tempDir(t, "ocv-unwritable-")
  const notADir = join(parent, "a-file")
  writeFileSync(notADir, "")
  const record = {
    script: "merge-pr",
    id: "unwritable",
    status: "ok",
    detail: "merged",
    startedAt: new Date(),
  }
  assert.equal(
    writeResult({ PR_RESULT_DIR: notADir, PR_RESULT_REPO: "opencv" }, record),
    null
  )
  const saved = {
    dir: process.env.PR_RESULT_DIR,
    repo: process.env.PR_RESULT_REPO,
  }
  process.env.PR_RESULT_DIR = notADir
  process.env.PR_RESULT_REPO = "opencv"
  try {
    assert.throws(() => writeResult(record), /ENOTDIR|EEXIST/)
  } finally {
    if (saved.dir === undefined) delete process.env.PR_RESULT_DIR
    else process.env.PR_RESULT_DIR = saved.dir
    if (saved.repo === undefined) delete process.env.PR_RESULT_REPO
    else process.env.PR_RESULT_REPO = saved.repo
  }
})
