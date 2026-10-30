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
test("a closed issue refuses; failed closure is reported", () => {
  const f = fixture({ issueState: "CLOSED" })
  const r = f.call("merge", "91")
  assert.equal(r.code, 2)
  assert.match(r.text, /PR_METADATA.*issue #90 is closed/s)
  assert.equal(f.effects("gh", "pr merge").length, 0)
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

test("a wrong title or a missing closing line cannot merge", () => {
  for (const over of [{ title: "Keep my search" }, { body: "no keyword" }]) {
    const f = fixture()
    Object.assign(f.s.pull, over)
    const r = f.call("merge", "91")
    assert.equal(r.code, 2)
    assert.match(r.text, /PR_METADATA/)
    assert.equal(f.effects("gh", "pr merge").length, 0)
  }
})
test("a mass deletion cannot merge unless the files are generated", () => {
  const names = Array.from({ length: 26 }, (_, i) => `d/f${i}.txt`)
  const f = fixture({ deleted: names })
  const r = f.call("merge", "91")
  assert.equal(r.code, 2)
  assert.match(r.text, /MASS_DELETE.*26 files \(limit 25\)/s)
  assert.match(r.text, /needs-human-review/)
  assert.equal(f.effects("gh", "pr merge").length, 0)
  assert.equal(
    fixture({ deleted: names, generated: names }).call("merge", "91").code,
    0
  )
  const lines = fixture({ deleted: ["big.txt"], numstat: "0\t2500\tbig.txt" })
  assert.match(lines.call("merge", "91").text, /2500 lines/)
})
test("a renamed-away ci.yml is seen through the diff without renames", () => {
  const f = fixture({ deleteCi: true })
  f.s.intercept = (cmd, a) =>
    cmd === "git" &&
    a[0] === "diff" &&
    a.includes("--no-renames") &&
    !a.includes("--numstat") &&
    !a.includes("--diff-filter=D")
      ? {
          ok: true,
          out: ".github/workflows/ci.yml\0.github/workflows/nightly.yml",
          err: "",
        }
      : null
  const r = f.call("merge", "91")
  assert.equal(r.code, 2)
  assert.match(r.text, /CI_WORKFLOW_KEPT/)
})
