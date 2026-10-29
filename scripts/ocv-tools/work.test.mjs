import assert from "node:assert/strict"
import test from "node:test"
import { runCli } from "./cli.mjs"
import { claimMarker } from "./claim-marker.mjs"
import { ctxFor, fakePorts, issue, minutesAgo, pr } from "./ports/fake.mjs"

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
    issues: [issue(90, { comments: over.comments ?? [claim("me", 100)] })],
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

test("cleanup from inside the worktree infers the issue; --force removes unsaved work; --all keeps unmerged", () => {
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
  assert.equal(forced.code, 0, forced.text)
  assert.equal(ports.state.worktrees.length, 0)
})
