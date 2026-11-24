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

test("save commits with the issue suffix and pushes, and writes or rewrites no comment on the issue", () => {
  const { ports, ctx } = task({ dirty: { [cwd]: " M b.txt\n" } })
  const r = runCli(["save", "-m", "feat: add b"], ctx)
  assert.equal(r.code, 0, r.text)
  assert.equal(
    ports.effects.find((e) => e.op === "commit").message,
    "feat: add b (#90)"
  )
  assert.ok(ports.effects.some((e) => e.op === "push"))
  assert.equal(
    ports.effects.filter((e) => /comment/i.test(e.op)).length,
    0,
    r.text
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

test("save pushes for an agent whose issue carries a newer owner note from another agent", () => {
  const { ports, ctx } = task({
    comments: [claim("me", 400), claim("other", 5)],
    dirty: { [cwd]: " M b.txt\n" },
  })
  const r = runCli(["save", "-m", "feat: add b"], ctx)
  assert.equal(r.code, 0, r.text)
  assert.ok(ports.effects.some((e) => e.op === "push"))
})

test("save outside a task and without -m is refused plainly", () => {
  const { ports, ctx } = task({ env: {}, comments: [claim("me", 5)] })
  assert.equal(runCli(["save"], ctx).code, 1)
  ports.state.branch = "scratch"
  assert.match(runCli(["save", "-m", "x"], ctx).text, /REFUSED NOT_A_TASK/)
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
