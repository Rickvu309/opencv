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
  const queuedReceipt = receipt()
  assert.equal(
    queuedReceipt.status,
    "pending",
    JSON.stringify({
      tempRoot: process.env.TMPDIR,
      receiptPath: join(f.ctx.env.PR_RESULT_DIR, "opencv-merge-pr-91.json"),
      receipt: queuedReceipt,
      queue: f.s.queue,
      enqueued: f.s.enqueued,
      pullState: f.s.pull.state,
      issueState: f.s.issueState,
      mergeCalls: f.effects("gh", "pr merge").map((effect) => effect.args),
      closeCalls: f.effects("gh", "issue close").length,
    })
  )
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
  assert.match(
    waited.text,
    /Fix: PR #91 already merged at head-2\. This clone recorded head-1\. Check that merge by hand\. Do not run merge --wait again\./
  )
  assert.doesNotMatch(waited.text, /merge 91 --wait/)
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
  assert.match(
    again.text,
    /Fix: Check the commits from head-1 to head-2\. If they are yours, run scripts\/ocv-tools\.mjs merge 91 to queue and record the new head, then scripts\/ocv-tools\.mjs merge 91 --wait\./
  )
  assert.doesNotMatch(again.text, /Merged PR #91/)
  assert.equal(pushed.effects("gh", "pr merge").length, 1)
  assert.equal(pushed.s.issueState, "OPEN")
})
test("the HEAD_MOVED fix records the new head so a later wait does not refuse it", () => {
  const f = fixture({
    queue: true,
    onPause(_total, s) {
      if (s.pull.headRefOid !== "head-2") return
      s.pull.state = "MERGED"
      s.pull.mergeCommit = { oid: "ours" }
    },
  })
  assert.match(f.call("merge", "91").text, /Queued/)
  f.s.pull.headRefOid = "head-2"
  f.s.checks[0].head_sha = "head-2"
  f.s.inQueue = false
  const refused = f.call("merge", "91", "--wait")
  assert.equal(refused.code, 2, refused.text)
  assert.match(
    refused.text,
    /Fix: Check the commits from head-1 to head-2\. If they are yours, run scripts\/ocv-tools\.mjs merge 91 to queue and record the new head, then scripts\/ocv-tools\.mjs merge 91 --wait\./
  )
  const queued = f.call("merge", "91")
  assert.equal(queued.code, 0, queued.text)
  assert.match(queued.text, /Queued PR #91 at head-2/)
  assert.doesNotMatch(queued.text, /HEAD_MOVED/)
  const waited = f.call("merge", "91", "--wait")
  assert.equal(waited.code, 0, waited.text)
  assert.match(waited.text, /Merged PR #91/)
  assert.doesNotMatch(waited.text, /HEAD_MOVED/)
  assert.equal(f.s.issueState, "CLOSED")
})
test("merge --wait does not report MERGED when this clone has no recorded head", () => {
  const merged = fixture()
  Object.assign(merged.s.pull, {
    state: "MERGED",
    headRefOid: "foreign",
    mergeCommit: { oid: "foreign-merge" },
  })
  const refused = merged.call("merge", "91", "--wait")
  assert.equal(refused.code, 2, refused.text)
  assert.match(refused.text, /REFUSED UNRECORDED_HEAD/)
  assert.match(refused.text, /PR #91 merged at foreign/)
  assert.match(refused.text, /did not record that head/)
  assert.match(refused.text, /no head for this clone to compare/)
  assert.match(
    refused.text,
    /Fix: PR #91 merged at foreign\. This clone did not record that head\. Check the merge by hand\. Do not close the issue from this result\./
  )
  assert.doesNotMatch(refused.text, /Merged PR #91/)
  assert.equal(merged.s.issueState, "OPEN")
  assert.equal(merged.effects("gh", "issue close").length, 0)
  assert.equal(merged.effects("gh", "pr merge").length, 0)

  const queued = fixture({
    queue: true,
    inQueue: true,
    queuedHead: "queued-sha",
  })
  queued.s.pull.headRefOid = "live-sha"
  const waiting = queued.call("merge", "91", "--wait")
  assert.equal(waiting.code, 2, waiting.text)
  assert.match(waiting.text, /REFUSED UNRECORDED_HEAD/)
  assert.match(waiting.text, /in the merge queue at live-sha/)
  assert.match(waiting.text, /GitHub's queue entry is queued-sha/)
  assert.match(waiting.text, /did not record that head/)
  assert.doesNotMatch(waiting.text, /Merged PR #91/)
  assert.equal(queued.s.issueState, "OPEN")
  assert.equal(queued.effects("gh", "issue close").length, 0)
  assert.equal(queued.effects("gh", "pr merge").length, 0)

  const matched = fixture({
    inQueue: true,
    queuedHead: "same-sha",
  })
  Object.assign(matched.s.pull, {
    state: "MERGED",
    headRefOid: "same-sha",
    mergeCommit: { oid: "merge-sha" },
  })
  const compared = matched.call("merge", "91", "--wait")
  assert.equal(compared.code, 2, compared.text)
  assert.match(compared.text, /PR #91 merged at same-sha/)
  assert.match(compared.text, /GitHub's queue entry is same-sha/)
  assert.match(compared.text, /did not record that head/)
  assert.doesNotMatch(compared.text, /Merged PR #91/)
  assert.equal(matched.s.issueState, "OPEN")
  assert.equal(matched.effects("gh", "issue close").length, 0)
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
test("merge --wait skips the merged-tree check when the PR is already queued", () => {
  const f = fixture({ queue: true })
  assert.match(f.call("merge", "91").text, /Queued PR #91/)
  f.s.behind = 1
  f.s.guardOutput = "✖ docs/agents/checks.md is stale (3ms)\n"
  f.s.onPause = (_total, s) => {
    s.pull.state = "MERGED"
    s.pull.mergeCommit = { oid: "queued-merge" }
  }
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /already in the merge queue/)
  assert.match(r.text, /Merged PR #91 as queued-merge/)
  assert.doesNotMatch(r.text, /MERGED_TREE_FAILS/)
  assert.equal(f.effects("git", "merge-tree").length, 0)
  assert.equal(f.effects("git", "worktree").length, 0)
  assert.equal(f.effects("gh", "pr merge").length, 1)
  assert.equal(f.s.issueState, "CLOSED")
})
test("merge --wait reports a queue drop instead of a merged-tree refusal", () => {
  const f = fixture({ queue: true })
  assert.match(f.call("merge", "91").text, /Queued/)
  f.s.behind = 1
  f.s.guardOutput = "✖ docs/agents/checks.md is stale (3ms)\n"
  f.s.onPause = (_total, s) => {
    s.inQueue = false
    s.removedEvents = [{ reason: "MERGE_CONFLICT", at: "t" }]
    s.conflicts = ["apps/a.ts"]
  }
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /LEFT_QUEUE/)
  assert.match(r.text, /apps\/a\.ts/)
  assert.doesNotMatch(r.text, /MERGED_TREE_FAILS/)
  assert.equal(f.effects("git", "worktree").length, 0)
  assert.equal(f.effects("gh", "pr merge").length, 1)
  assert.equal(f.s.issueState, "OPEN")
})
test("merge --wait on an already merged PR skips the merged-tree check", () => {
  const f = fixture()
  assert.equal(f.call("merge", "91").code, 0)
  f.s.behind = 1
  f.s.guardOutput = "✖ docs/agents/checks.md is stale (3ms)\n"
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /already merged/)
  assert.match(r.text, /Merged PR #91 as merged-1/)
  assert.doesNotMatch(r.text, /MERGED_TREE_FAILS/)
  assert.equal(f.effects("git", "merge-tree").length, 0)
  assert.equal(f.effects("git", "worktree").length, 0)
})
test("merge --wait still refuses a failing merged tree before the PR is queued", () => {
  const f = fixture({
    behind: 1,
    guardOutput: "✖ docs/agents/checks.md is stale (3ms)\n",
  })
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /MERGED_TREE_FAILS/)
  assert.equal(f.effects("gh", "pr merge").length, 0)
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
