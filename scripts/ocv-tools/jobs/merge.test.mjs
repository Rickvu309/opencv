import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
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
test("a merge GitHub has not finished leaves the issue open until a later run sees it merged", () => {
  const f = fixture({ mergeLater: true })
  const first = f.call("merge", "91")
  assert.match(first.text, /has not merged yet/)
  const receipt = () =>
    JSON.parse(
      readFileSync(
        join(f.ctx.env.PR_RESULT_DIR, "opencv-merge-pr-91.json"),
        "utf8"
      )
    )
  assert.equal(receipt().status, "pending")
  assert.equal(f.s.issueState, "OPEN")
  assert.equal(f.effects("gh", "issue close").length, 0)
  f.s.pull.state = "MERGED"
  f.s.pull.mergeCommit = { oid: "done" }
  assert.equal(f.call("merge", "91").code, 0)
  assert.equal(f.s.issueState, "CLOSED")
  assert.equal(receipt().status, "ok")
  assert.equal(f.effects("gh", "pr merge").length, 1)
})

test("a pull request on auto-merge whose check is still running is left to GitHub", () => {
  const f = fixture()
  f.s.pull.autoMergeRequest = { mergeMethod: "SQUASH" }
  f.s.checks = [
    {
      id: 2,
      name: "ci",
      status: "in_progress",
      conclusion: null,
      head_sha: "head-1",
    },
  ]
  const r = f.call("merge", "91")
  assert.equal(r.code, 0, r.text)
  assert.match(
    r.text,
    /is on auto-merge: GitHub merges head-1 when ci is green/
  )
  assert.equal(f.effects("gh", "pr merge").length, 0)
  assert.equal(f.s.issueState, "OPEN")
})

test("the merge command has no wait flag and no merge queue words", () => {
  const f = fixture()
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 2)
  assert.match(r.text, /UNKNOWN_FLAG/)
  const source = readFileSync(new URL("./merge.mjs", import.meta.url), "utf8")
  assert.doesNotMatch(source, /queue|merged tree|--wait/i)
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
test("an expected failure citing a closed or closing issue refuses the merge", () => {
  const pinned = (issue) =>
    `it.fails(\n  "#${issue}: a known bug stays pinned",\n  async () => {}\n)\n`
  const closing = fixture({
    headFiles: { "apps/api/src/a.test.ts": pinned(90) },
  })
  const r = closing.call("merge", "91")
  assert.equal(r.code, 2)
  assert.match(
    r.text,
    /PIN_ISSUE_OPEN.*a\.test\.ts:1 cites #90, which this pull request closes/s
  )
  assert.equal(closing.effects("gh", "pr merge").length, 0)
  const closed = fixture({
    headFiles: {
      "apps/api/src/b.test.ts":
        "onServer(\n  `${KNOWN.issue}: a race`,\n)\nit.fails(`${KNOWN.issue}: pinned`, () => {})\n",
      "apps/api/src/test/known.ts": 'export const KNOWN = { issue: "#77" }\n',
    },
    issueStates: { 77: "CLOSED" },
  })
  assert.match(
    closed.call("merge", "91").text,
    /b\.test\.ts:4 cites #77, which is closed/
  )
  const open = fixture({
    headFiles: { "apps/api/src/a.test.ts": pinned(77) },
    issueStates: { 77: "OPEN" },
  })
  assert.doesNotMatch(open.call("merge", "91").text, /PIN_ISSUE_OPEN/)
})
test("draft, author and CI failures cannot merge", () => {
  for (const over of [{ isDraft: true }, { author: { login: "other" } }]) {
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
test("a mass deletion can merge when the other merge checks pass", () => {
  const names = Array.from({ length: 26 }, (_, i) => `d/f${i}.txt`)
  for (const options of [
    { deleted: names },
    { deleted: names, generated: names },
    { deleted: ["big.txt"], numstat: "0\t2500\tbig.txt" },
  ]) {
    const f = fixture(options)
    const result = f.call("merge", "91")
    assert.equal(result.code, 0, result.text)
    assert.equal(f.effects("gh", "pr merge").length, 1)
  }
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
