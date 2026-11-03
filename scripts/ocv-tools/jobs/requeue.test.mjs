import assert from "node:assert/strict"
import test from "node:test"
import { fixture } from "./fixture.mjs"

const ci = (conclusion) => ({
  name: "ci",
  status: "completed",
  conclusion,
  completedAt: "t",
})
const failedRun = (over = {}) => ({
  id: 7,
  path: ".github/workflows/ci.yml",
  status: "completed",
  conclusion: "failure",
  event: "pull_request",
  head_branch: "fix/90-keep-my-search",
  ...over,
})

test("an infra rerun that passes queues the pull request once, and a second infra failure does not queue it again", () => {
  let phase = "failing"
  const f = fixture({
    queue: true,
    inQueue: false,
    rollup: [ci("failure")],
    runs: [failedRun()],
    runJobs: [
      { id: 11, steps: [] },
      { id: 12, steps: [] },
    ],
    onPause(_total, s) {
      const merges = f.effects("gh", "pr merge").length
      if (phase === "failing" && f.effects("gh", "run rerun").length > 0) {
        s.rollup = [ci("success")]
        phase = "reran"
        return
      }
      if (phase === "reran" && merges >= 2) {
        s.inQueue = true
        phase = "queued"
        return
      }
      if (phase === "queued") {
        s.inQueue = false
        phase = "dropped"
        return
      }
      if (phase === "dropped") {
        s.rollup = [ci("failure")]
        phase = "again"
      }
    },
  })
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /CI_FAILED/)
  assert.equal(f.effects("gh", "run rerun").length, 1)
  assert.equal(f.effects("gh", "pr merge").length, 2)
  assert.deepEqual(
    f.effects("gh", "pr merge").map((e) => e.args),
    [
      ["pr", "merge", "91", "--squash", "--match-head-commit", "head-1"],
      ["pr", "merge", "91", "--squash", "--match-head-commit", "head-1"],
    ]
  )
})
