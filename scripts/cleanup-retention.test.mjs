import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import test from "node:test"
import { detect } from "./lib/cleanup-retention.mjs"

test("cleanup cannot discard a remote lease, linked issues or the caller's containing root", () => {
  for (const mistake of [
    "git.deleteRemoteBranch(main, wt.branch)",
    "const labels = issueNo ? gh.issueLabels(issueNo) : []",
    "trees.filter(w => !excluded.includes(w.path))",
  ])
    assert.deepEqual(detect(mistake), [1])
  assert.deepEqual(
    detect(
      "git.deleteRemoteBranch(main, wt.branch, retained.oid); const labels = issues.flatMap(n => gh.issueLabels(n)); trees.filter(w => !roots.includes(w.path))"
    ),
    []
  )
  assert.equal(
    detect(
      execFileSync("git", ["show", "17c5eb8b:scripts/ocv-tools/work.mjs"], {
        encoding: "utf8",
      })
    ).length,
    3
  )
  assert.deepEqual(
    detect(
      readFileSync(new URL("./ocv-tools/work.mjs", import.meta.url), "utf8")
    ),
    []
  )
})
