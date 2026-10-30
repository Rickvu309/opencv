import assert from "node:assert/strict"
import test from "node:test"
import { fixture } from "./fixture.mjs"

test("merge pins squash to the checked head and closes the linked issue", () => {
  const f = fixture()
  const r = f.call("merge", "91")
  assert.equal(r.code, 0, r.text)
  assert.deepEqual(f.effects("gh", "pr merge")[0].args, [
    "pr",
    "merge",
    "91",
    "--squash",
    "--match-head-commit",
    "head-1",
  ])
  assert.equal(f.s.issueState, "CLOSED")
  assert.equal(f.effects("gh", "issue close").length, 1)
})
test("queued merge leaves issues open until a later rerun observes the merge", () => {
  const f = fixture({ queue: true })
  assert.match(f.call("merge", "91").text, /Queued/)
  assert.equal(f.s.issueState, "OPEN")
  assert.equal(f.effects("gh", "issue close").length, 0)
  f.s.pull.state = "MERGED"
  f.s.pull.mergeCommit = { oid: "done" }
  assert.equal(f.call("merge", "91").code, 0)
  assert.equal(f.s.issueState, "CLOSED")
  assert.equal(f.effects("gh", "pr merge").length, 1)
})
test("already closed issues are left closed; failed closure is reported", () => {
  const f = fixture({ issueState: "CLOSED" })
  assert.equal(f.call("merge", "91").code, 0)
  assert.equal(f.effects("gh", "issue close").length, 0)
  const bad = fixture({ closeWorks: false })
  assert.equal(bad.call("merge", "91").code, 1)
  assert.match(bad.call("merge", "91").text, /still open/)
})
test("draft, human review, author and CI failures cannot merge", () => {
  for (const over of [
    { isDraft: true },
    { labels: [{ name: "needs-human-review" }] },
    { author: { login: "other" } },
  ]) {
    const f = fixture()
    Object.assign(f.s.pull, over)
    assert.equal(f.call("merge", "91").code, 2)
    assert.equal(f.effects("gh", "pr merge").length, 0)
  }
  for (const checks of [
    [],
    [
      {
        id: 1,
        name: "ci",
        status: "completed",
        conclusion: "failure",
        head_sha: "head-1",
      },
    ],
    [
      {
        id: 1,
        name: "ci",
        status: "completed",
        conclusion: "success",
        head_sha: "old-head",
      },
    ],
  ]) {
    const f = fixture({ checks })
    assert.match(f.call("merge", "91").text, /CI_REQUIRED/)
    assert.equal(f.effects("gh", "pr merge").length, 0)
  }
})
test("latest pending ci overrides an older success", () => {
  const f = fixture()
  f.s.checks.push({
    id: 2,
    name: "ci",
    status: "in_progress",
    conclusion: null,
    head_sha: "head-1",
  })
  assert.match(f.call("merge", "91").text, /CI_REQUIRED/)
})
test("merge preserves CI deletion and risk gates", () => {
  for (const over of [
    { changed: [".github/workflows/ci.yml"], deleteCi: true },
    { changed: ["scripts/check.mjs"] },
  ]) {
    const f = fixture(over)
    assert.equal(f.call("merge", "91").code, 2)
    assert.equal(f.effects("gh", "pr merge").length, 0)
  }
  const f = fixture({
    changed: ["scripts/check.mjs"],
    issueLabels: ["risk:high"],
  })
  assert.equal(f.call("merge", "91").code, 0)
})

test("a failed merge never closes the issue", () => {
  const f = fixture({
    intercept(cmd, args) {
      if (cmd === "gh" && args[0] === "pr" && args[1] === "merge")
        return { ok: false, out: "", err: "head changed" }
    },
  })
  assert.equal(f.call("merge", "91").code, 1)
  assert.equal(f.s.issueState, "OPEN")
  assert.equal(f.effects("gh", "issue close").length, 0)
})
