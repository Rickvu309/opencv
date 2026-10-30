// Runs the shell suites of merge-pr.sh and its rules, which use a stub gh and a throwaway git repo.
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"

for (const name of ["test-merge-pr.sh", "test-merge-pr-gates.sh"]) {
  test(name, () => {
    const run = spawnSync(
      "bash",
      [fileURLToPath(new URL(`./${name}`, import.meta.url))],
      { encoding: "utf8" }
    )
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`.slice(-3000))
  })
}
