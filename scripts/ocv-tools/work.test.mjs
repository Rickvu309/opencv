import assert from "node:assert/strict"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { claimMarker, holderOf } from "./claim-marker.mjs"
import { finishedWorktrees } from "./work.mjs"
import { NOW, ctxFor, fakePorts, issue, minutesAgo, pr } from "./ports/fake.mjs"

const cwd = "/tmp/opencv.worktrees/90-keep-my-search"
const main = "/tmp/opencv"
const wt = "/tmp/opencv.worktrees/90-keep"

const claim = (agent, minutes, id = 7) => ({
  databaseId: id,
  createdAt: minutesAgo(minutes),
  updatedAt: minutesAgo(minutes),
  body: claimMarker({ agent, at: "client", branch: "feat/90-x" }),
})

function task(over = {}) {
  const ports = fakePorts({
    cwd,
    branch: over.branch ?? "feat/90-keep-my-search",
    env: over.env ?? { OCV_TOOLS_AGENT: "me" },
    issues: [
      issue(90, {
        ...over.issue,
        comments: over.comments ?? [claim("me", 100)],
      }),
    ],
    prs: over.prs,
    dirty: over.dirty ?? {},
    patch: over.patch,
    failAdd: over.failAdd,
    failDiff: over.failDiff,
    places: over.places,
    onCommit: over.onCommit,
    onPush: over.onPush,
  })
  return { ports, ctx: ctxFor(ports) }
}

test("save commits with the issue suffix, pushes and refreshes the single claim comment", () => {
  const { ports, ctx } = task({ dirty: { [cwd]: " M b.txt\n" } })
  const r = runCli(["save", "-m", "feat: add b"], ctx)
  assert.equal(r.code, 0, r.text)
  assert.equal(
    ports.effects.find((e) => e.op === "commit").message,
    "feat: add b (#90)"
  )
  assert.ok(ports.effects.some((e) => e.op === "push"))
  assert.match(
    ports.effects.find((e) => e.op === "editComment").body,
    /claim agent=me at=2026-10-29T10:20:00.000Z branch=feat\/90-x/
  )
  assert.match(r.text, /Saved #90 on feat\/90-keep-my-search at abc1234/)
  const again = runCli(["save", "-m", "x (#90)"], ctx)
  assert.equal(again.code, 0, again.text)
  assert.match(again.text, /Nothing to save/)
  ports.state.dirty[cwd] = " M c.txt\n"
  runCli(["save", "-m", "feat: add c (#90)"], ctx)
  assert.equal(
    ports.effects.filter((e) => e.op === "commit").at(-1).message,
    "feat: add c (#90)"
  )
})

test("save by an agent that lost the claim exits 3 and writes a patch", () => {
  const { ports, ctx } = task({
    comments: [claim("me", 400), claim("other", 5)],
    dirty: { [cwd]: " M b.txt\n" },
    patch: "diff --git a/b.txt\nlost work\n",
  })
  const r = runCli(["save", "-m", "feat: add b"], ctx)
  assert.equal(r.code, 3)
  assert.match(r.text, /LOST #90: other holds the claim now/)
  assert.match(r.text, /patch: \/tmp\/lost\/90-2026-10-29T12-00-00-000Z\.patch/)
  assert.match(
    ports.written["lost/90-2026-10-29T12-00-00-000Z.patch"],
    /lost work/
  )
  assert.ok(!ports.effects.some((e) => e.op === "commit"))
  assert.ok(!ports.effects.some((e) => e.op === "editComment"))
})

test("save with no agent id, outside a task and without -m is refused plainly", () => {
  const { ports, ctx } = task({ env: {}, comments: [claim("me", 5)] })
  assert.equal(runCli(["save", "-m", "x"], ctx).code, 3)
  assert.equal(runCli(["save"], ctx).code, 1)
  ports.state.branch = "scratch"
  assert.match(runCli(["save", "-m", "x"], ctx).text, /REFUSED NOT_A_TASK/)
})

test("a LOST patch keeps a blank context line", () => {
  const { ports, ctx } = task({
    comments: [claim("other", 1)],
    patch: " \n",
  })
  const r = runCli(["save", "-m", "feat: edit blank"], ctx)
  assert.equal(r.code, 3, r.text)
  const patch = ports.written["lost/90-2026-10-29T12-00-00-000Z.patch"]
  assert.ok(patch.split("\n").includes(" "))
})

test("LOST does not claim the work was saved when git add or diff fails", () => {
  const added = task({
    comments: [claim("other", 1, 8)],
    failAdd: true,
  })
  const add = runCli(["save", "-m", "feat: x"], added.ctx)
  assert.equal(add.code, 1)
  assert.match(add.text, /git add failed: add broke/)
  assert.equal(
    added.ports.written["lost/90-2026-10-29T12-00-00-000Z.patch"],
    undefined
  )
  const differed = task({
    comments: [claim("other", 1, 8)],
    failDiff: true,
  })
  const diff = runCli(["save", "-m", "feat: x"], differed.ctx)
  assert.equal(diff.code, 1)
  assert.match(diff.text, /git diff failed: diff broke/)
})

test("save refuses a normal clone and a worktree outside the worktree root", () => {
  const outside = "/tmp/elsewhere"
  const { ports, ctx } = task({
    places: {
      [main]: {
        topOk: true,
        top: main,
        branch: "feat/91-not-linked",
        gitDirOk: true,
        gitDir: `${main}/.git`,
        commonOk: true,
        common: `${main}/.git`,
      },
      [outside]: {
        topOk: true,
        top: outside,
        branch: "feat/92-outside-here",
        gitDirOk: true,
        gitDir: `${main}/.git/worktrees/out`,
        commonOk: true,
        common: `${main}/.git`,
      },
    },
  })
  ctx.cwd = main
  assert.match(
    runCli(["save", "-m", "feat: sneak"], ctx).text,
    /REFUSED NOT_A_TASK/
  )
  ctx.cwd = outside
  assert.match(
    runCli(["save", "-m", "feat: no"], ctx).text,
    /REFUSED NOT_A_TASK/
  )
  assert.ok(!ports.effects.some((e) => e.op === "commit"))
})

test("save reports LOST when ownership flips while git push runs", () => {
  let ports
  ports = fakePorts({
    cwd,
    env: { OCV_TOOLS_AGENT: "me" },
    issues: [issue(90, { comments: [claim("me", 10)] })],
    dirty: { [cwd]: " M b.txt\n" },
    onPush() {
      ports.state.issues.get(90).comments.push(claim("other", 1, 9))
    },
  })
  const r = runCli(["save", "-m", "feat: add b"], ctxFor(ports))
  assert.equal(r.code, 3, r.text)
  assert.match(
    r.text,
    /your push already reached origin\/feat\/90-keep-my-search; other now holds #90/
  )
  assert.match(r.text, /\nFix: /)
  assert.doesNotMatch(r.text, /claim is refreshed/)
  const ops = ports.effects.map((e) => e.op)
  const edits = ops.flatMap((op, i) => (op === "editComment" ? [i] : []))
  assert.equal(edits.length, 1)
  assert.ok(edits[0] < ops.indexOf("push"))
  assert.equal(
    ports.written["lost/90-2026-10-29T12-00-00-000Z.patch"],
    undefined
  )
})

test("save keeps a patch when ownership flips during push and work is uncommitted", () => {
  let ports
  ports = fakePorts({
    cwd,
    env: { OCV_TOOLS_AGENT: "me" },
    issues: [issue(90, { comments: [claim("me", 10)] })],
    dirty: { [cwd]: " M b.txt\n" },
    onPush() {
      ports.state.issues.get(90).comments.push(claim("other", 1, 9))
      ports.state.dirty[cwd] = " M during.txt\n"
      ports.state.patch = "diff\nduring\n"
    },
  })
  const r = runCli(["save", "-m", "feat: add b"], ctxFor(ports))
  assert.equal(r.code, 3, r.text)
  assert.match(
    r.text,
    /your push already reached origin\/feat\/90-keep-my-search; other now holds #90/
  )
  assert.match(r.text, /patch: \/tmp\/lost\/90-/)
  assert.match(
    ports.written["lost/90-2026-10-29T12-00-00-000Z.patch"],
    /during/
  )
  assert.equal(ports.effects.filter((e) => e.op === "editComment").length, 1)
})

test("save does not push when another agent takes the claim before the push", () => {
  let ports
  ports = fakePorts({
    cwd,
    env: { OCV_TOOLS_AGENT: "me" },
    issues: [issue(90, { comments: [claim("me", 10)] })],
    dirty: { [cwd]: " M b.txt\n" },
    onCommit() {
      ports.state.issues.get(90).comments.push(claim("other", 1, 8))
    },
  })
  const r = runCli(["save", "-m", "feat: add b"], ctxFor(ports))
  assert.equal(r.code, 3, r.text)
  assert.match(r.text, /LOST #90: other holds/)
  assert.match(
    ports.effects.find((e) => e.op === "commit").message,
    /add b \(#90\)/
  )
  assert.ok(!ports.effects.some((e) => e.op === "push"))
  assert.ok(!ports.effects.some((e) => e.op === "editComment"))
})

test("cleanup refuses unsaved work and an unmerged pull request, then lists what it removed", () => {
  const ports = fakePorts({
    cwd: main,
    branch: "feat/90-keep",
    worktrees: [{ path: wt, branch: "feat/90-keep" }],
    dirty: { [wt]: "?? x.txt\n" },
  })
  const ctx = ctxFor(ports)
  const dirty = runCli(["cleanup", "90"], ctx)
  assert.equal(dirty.code, 2)
  assert.match(dirty.text, /REFUSED DIRTY.*x\.txt/s)
  assert.equal(ports.state.worktrees.length, 1)
  ports.state.dirty[wt] = ""
  assert.match(runCli(["cleanup", "#90"], ctx).text, /REFUSED NOT_MERGED/)
  assert.equal(ports.state.worktrees.length, 1)
  ports.state.prs = [pr(5, { state: "MERGED", head: "feat/90-keep" })]
  const dry = runCli(["cleanup", "90", "--dry-run"], ctx)
  assert.match(dry.text, /would remove .*90-keep/)
  assert.ok(!ports.effects.some((e) => e.op === "removeWorktree"))
  assert.equal(ports.state.worktrees.length, 1)
  const ok = runCli(["cleanup", "90"], ctx)
  assert.equal(ok.code, 0, ok.text)
  assert.match(ok.text, /Removed:\n {2}.*90-keep {2}\(feat\/90-keep\)/)
  assert.equal(ports.state.worktrees.length, 0)
  assert.ok(ports.effects.some((e) => e.op === "deleteBranch"))
  assert.match(runCli(["cleanup", "90"], ctx).text, /REFUSED NO_WORKTREE/)
})

test("cleanup deletes the remote branch only while it still exists, and says nothing when the queue already removed it", () => {
  const gone = fakePorts({
    cwd: main,
    branch: "feat/90-keep",
    worktrees: [{ path: wt, branch: "feat/90-keep" }],
    prs: [pr(5, { state: "MERGED", head: "feat/90-keep" })],
  })
  const quiet = runCli(["cleanup", "90"], ctxFor(gone))
  assert.equal(quiet.code, 0, quiet.text)
  assert.ok(!gone.effects.some((e) => e.op === "deleteRemoteBranch"))
  assert.doesNotMatch(quiet.text, /Warning|remote ref/)

  const kept = fakePorts({
    cwd: main,
    branch: "feat/90-keep",
    worktrees: [{ path: wt, branch: "feat/90-keep" }],
    remoteBranches: ["feat/90-keep"],
    prs: [pr(5, { state: "MERGED", head: "feat/90-keep" })],
  })
  const deleted = runCli(["cleanup", "90"], ctxFor(kept))
  assert.equal(deleted.code, 0, deleted.text)
  assert.ok(kept.effects.some((e) => e.op === "deleteRemoteBranch"))
  assert.doesNotMatch(deleted.text, /Warning/)
})

test("cleanup from inside the worktree infers the issue; dirty work survives --force; --all keeps unmerged", () => {
  const ports = fakePorts({
    cwd: wt,
    branch: "feat/90-keep",
    worktrees: [{ path: wt, branch: "feat/90-keep" }],
    dirty: { [wt]: "?? x.txt\n" },
  })
  const ctx = ctxFor(ports)
  assert.match(runCli(["cleanup"], ctx).text, /REFUSED DIRTY/)
  const all = runCli(["cleanup", "--all"], ctx)
  assert.match(all.text, /kept feat\/90-keep: .*no merged/)
  ports.state.prs = [pr(5, { state: "MERGED", head: "feat/90-keep" })]
  const forced = runCli(["cleanup", "--force"], ctx)
  assert.match(forced.text, /REFUSED DIRTY/)
  assert.equal(ports.state.worktrees.length, 1)
})

test("cleanup closes an issue a merged pull request left open, with no Closes keyword", () => {
  const ports = fakePorts({
    cwd: main,
    branch: "feat/90-keep",
    worktrees: [{ path: wt, branch: "feat/90-keep" }],
  })
  ports.state.prs = [pr(5, { state: "MERGED", head: "feat/90-keep" })]
  const dry = runCli(["cleanup", "90", "--dry-run"], ctxFor(ports))
  assert.doesNotMatch(dry.text, /Closed issue/)
  assert.equal(ports.state.issues.get(90).state, "OPEN")
  const ok = runCli(["cleanup", "90"], ctxFor(ports))
  assert.match(ok.text, /Closed issue #90: PR #5 merged and left it open/)
  assert.equal(ports.state.issues.get(90).state, "CLOSED")
  assert.equal(ports.effects.filter((e) => e.op === "closeIssue").length, 1)
})

test("save refreshes the claim right before git push, so slow pre-push checks cannot expire it", () => {
  const { ports, ctx } = task({ dirty: { [cwd]: " M b.txt\n" } })
  const r = runCli(["save", "-m", "feat: add b"], ctx)
  assert.equal(r.code, 0, r.text)
  const ops = ports.effects.map((e) => e.op)
  assert.equal(ops[ops.indexOf("push") - 1], "editComment")
})

function racedTask(postOtherClaimOnEdit) {
  let ports
  ports = fakePorts({
    cwd,
    env: { OCV_TOOLS_AGENT: "me" },
    issues: [issue(90, { comments: [claim("me", 10)] })],
    dirty: { [cwd]: " M b.txt\n" },
    onEditComment(_id, editCount) {
      if (editCount === postOtherClaimOnEdit)
        ports.state.issues.get(90).comments.push(claim("other", 0, 9))
    },
  })
  return { ports, ctx: ctxFor(ports) }
}

test("a claim posted after save's last read but before its push is caught by the post-push check", () => {
  const { ports, ctx } = racedTask(1)
  const r = runCli(["save", "-m", "feat: add b"], ctx)
  assert.equal(r.code, 3, r.text)
  assert.match(
    r.text,
    /your push already reached origin\/feat\/90-keep-my-search; other now holds #90/
  )
  const ops = ports.effects.map((e) => e.op)
  assert.ok(ops.indexOf("editComment") < ops.indexOf("push"))
  assert.equal(ops.filter((op) => op === "editComment").length, 1)
})

test("the residual race: a claim posted after save's post-push read wins, save still succeeds, and the next save is LOST", () => {
  const { ports, ctx } = racedTask(2)
  const first = runCli(["save", "-m", "feat: add b"], ctx)
  assert.equal(first.code, 0, first.text)
  const ops = ports.effects.map((e) => e.op)
  assert.equal(ops.at(-1), "editComment")
  assert.ok(ops.indexOf("push") < ops.lastIndexOf("editComment"))
  const comments = ports.state.issues.get(90).comments
  assert.equal(holderOf(comments, NOW).agent, "other")
  ports.state.dirty[cwd] = " M c.txt\n"
  const next = runCli(["save", "-m", "feat: add c"], ctx)
  assert.equal(next.code, 3, next.text)
  assert.match(next.text, /LOST #90: other holds the claim now/)
})

test("finished worktrees are best effort: a GitHub failure lists none instead of refusing", () => {
  const ctx = {
    ports: {
      git: {
        worktrees: () => [{ path: "/r/80-old-fix", branch: "fix/80-old-fix" }],
      },
      gh: {
        prs: () => {
          throw new Error("gh is down")
        },
      },
    },
  }
  assert.deepEqual(finishedWorktrees(ctx, { main: "/m", root: "/r" }), [])
})

test("save refuses bad issue titles and live PR metadata before commit or push", () => {
  const pull = {
    number: 91,
    state: "OPEN",
    headRefName: "feat/90-keep-my-search",
    title: "feat: keep my search (#90)",
    body: "Closes #90",
  }
  for (const over of [
    { issue: { title: "Keep my search" } },
    { prs: [{ ...pull, title: "feat: keep my search (#89)" }] },
    { prs: [{ ...pull, body: "Closes #89" }] },
  ]) {
    const { ctx, ports } = task({ ...over, dirty: { [cwd]: " M b.txt\n" } })
    const result = runCli(["save", "-m", "fix: keep my search"], ctx)
    assert.equal(result.code, 2, result.text)
    assert.match(result.text, /PR_METADATA/)
    assert.ok(!ports.effects.some((e) => ["commit", "push"].includes(e.op)))
  }
  const { ctx } = task({ prs: [pull], dirty: { [cwd]: " M b.txt\n" } })
  assert.equal(runCli(["save", "-m", "fix: keep my search"], ctx).code, 0)
})
