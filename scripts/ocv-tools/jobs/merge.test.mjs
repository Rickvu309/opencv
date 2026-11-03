import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fixture } from "./fixture.mjs"
import { classify } from "./merge.mjs"

test("classify settles one snapshot into the five outcomes", () => {
  const base = {
    state: "OPEN",
    head: "h1",
    inQueue: true,
    queueState: "AWAITING_CHECKS",
    ci: null,
    removed: null,
    waited: 30,
  }
  assert.equal(
    classify({ ...base, state: "MERGED" }, true, "h1").kind,
    "MERGED"
  )
  assert.deepEqual(classify({ ...base, head: "h2" }, true, "h1"), {
    kind: "HEAD_MOVED",
    from: "h1",
    to: "h2",
  })
  assert.equal(
    classify(
      {
        ...base,
        inQueue: false,
        ci: { status: "completed", conclusion: "failure" },
      },
      true,
      "h1"
    ).kind,
    "CI_FAILED"
  )
  assert.deepEqual(
    classify(
      {
        ...base,
        inQueue: false,
        removed: { reason: "FAILED_CHECKS", at: "2026-10-30T18:42:00Z" },
      },
      true,
      "h1"
    ),
    { kind: "LEFT_QUEUE", reason: "FAILED_CHECKS", at: "2026-10-30T18:42:00Z" }
  )
  assert.equal(
    classify(
      {
        ...base,
        inQueue: false,
        ci: { status: "completed", conclusion: "success" },
        removed: { reason: "FAILED_CHECKS", at: "t" },
      },
      true,
      "h1"
    ).kind,
    "LEFT_QUEUE",
    "the queue's failed build removes the PR while the head's own ci stays green"
  )
  assert.equal(
    classify({ ...base, state: "CLOSED" }, true, "h1").kind,
    "LEFT_QUEUE"
  )
  assert.equal(
    classify({ ...base, waited: 45 * 60 }, true, "h1").kind,
    "QUEUE_TIMEOUT"
  )
  assert.equal(classify(base, true, "h1"), null)
})

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
test("merge --wait stays until the queue merges, then closes the issue", () => {
  let paused = 0
  const f = fixture({
    queue: true,
    onPause: (total, s) => {
      paused = total
      if (total >= 45) {
        s.pull.state = "MERGED"
        s.pull.mergeCommit = { oid: "done" }
      }
    },
  })
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /Merged PR #91/)
  assert.equal(f.s.issueState, "CLOSED")
  assert.equal(paused, 45)
})
test("queued merge names the wait command as the next step", () => {
  const f = fixture({ queue: true })
  assert.match(f.call("merge", "91").text, /merge 91 --wait/)
})
test("merge --wait refuses a foreign head the first merge did not queue", () => {
  const already = fixture({ queue: true })
  assert.match(already.call("merge", "91").text, /Queued/)
  already.s.pull.headRefOid = "head-2"
  already.s.pull.state = "MERGED"
  already.s.pull.mergeCommit = { oid: "foreign" }
  already.s.checks[0].head_sha = "head-2"
  const waited = already.call("merge", "91", "--wait")
  assert.equal(waited.code, 2, waited.text)
  assert.match(waited.text, /HEAD_MOVED/)
  assert.doesNotMatch(waited.text, /Merged PR #91/)
  assert.equal(already.s.issueState, "OPEN")
  assert.equal(already.effects("gh", "pr merge").length, 1)
  assert.equal(already.effects("gh", "issue close").length, 0)

  const pushed = fixture({ queue: true })
  assert.match(pushed.call("merge", "91").text, /Queued/)
  pushed.s.pull.headRefOid = "head-2"
  pushed.s.checks[0].head_sha = "head-2"
  pushed.s.queue = false
  const again = pushed.call("merge", "91", "--wait")
  assert.equal(again.code, 2, again.text)
  assert.match(again.text, /HEAD_MOVED/)
  assert.doesNotMatch(again.text, /Merged PR #91/)
  assert.equal(pushed.effects("gh", "pr merge").length, 1)
  assert.equal(pushed.s.issueState, "OPEN")
})
test("merge --wait fails when the PR closes without merging", () => {
  const f = fixture({
    queue: true,
    onPause: (_, s) => {
      s.pull.state = "CLOSED"
    },
  })
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /LEFT_QUEUE/)
  assert.equal(f.s.issueState, "OPEN")
})
test("merge --wait gives up after 45 minutes", () => {
  let paused = 0
  const f = fixture({
    queue: true,
    onPause: (total) => {
      paused = total
    },
  })
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /QUEUE_TIMEOUT/)
  assert.equal(paused, 45 * 60)
  assert.equal(f.s.issueState, "OPEN")
})
