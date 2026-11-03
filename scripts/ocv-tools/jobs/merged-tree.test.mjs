import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { EventEmitter } from "node:events"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { tempDir } from "../../lib/temp-dir.mjs"
import { realPorts } from "../ports/index.mjs"
import { decide } from "../rules/index.mjs"
import { fixture } from "./fixture.mjs"
import {
  failedGuards,
  mergeResultFacts,
  parseMergeTree,
} from "./merged-tree.mjs"
import { GIT_ENV } from "./push-checks.mjs"
import { stepless } from "./infra-rerun.mjs"

const OID = "a".repeat(40)
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

test("merge-tree output names the conflicted files, and an error is not a conflict", () => {
  assert.deepEqual(
    parseMergeTree({
      ok: false,
      out: `${OID}\na.txt\nb.txt\n\nmessages`,
      err: "",
    }),
    { tree: OID, conflicts: ["a.txt", "b.txt"] }
  )
  assert.deepEqual(parseMergeTree({ ok: true, out: OID, err: "" }), {
    tree: OID,
    conflicts: [],
  })
  assert.match(
    parseMergeTree({ ok: false, out: "", err: "usage: git merge-tree" }).error,
    /usage/
  )
})

test("a node test report names the failed guards", () => {
  const out =
    "Failed tests:\n\n✖ docs list is stale (4.2ms)\nFAIL scripts/x.test.mjs\n"
  assert.deepEqual(failedGuards({ ok: false, out, err: "" }), [
    "docs list is stale",
    "scripts/x.test.mjs",
  ])
  assert.match(
    failedGuards({ ok: false, out: "", err: "" })[0],
    /without naming/
  )
})

test("a head that is not behind main skips the merge read", () => {
  const f = fixture()
  assert.equal(f.call("merge", "91").code, 0)
  assert.equal(f.effects("git", "merge-tree").length, 0)
  assert.equal(f.effects("git", "worktree").length, 0)
})

test("a conflict with main is refused before enqueue, naming files and the rebase", () => {
  const f = fixture({ behind: 2, conflicts: ["apps/a.ts", "docs/b.md"] })
  const r = f.call("merge", "91")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /MERGE_CONFLICT.*apps\/a\.ts, docs\/b\.md/s)
  assert.match(
    r.text,
    /git fetch origin && git rebase origin\/main && git push --force-with-lease/
  )
  assert.equal(f.effects("gh", "pr merge").length, 0)
  assert.equal(f.effects("git", "worktree").length, 0)
})

test("a merged tree that fails the guards is refused and its worktree is removed", () => {
  const f = fixture({
    behind: 1,
    guardOutput: "✖ docs/agents/checks.md is stale (3ms)\n",
  })
  const r = f.call("merge", "91")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /MERGED_TREE_FAILS.*docs\/agents\/checks\.md is stale/s)
  assert.equal(f.effects("gh", "pr merge").length, 0)
  const verbs = f.effects("git", "worktree").map((e) => e.args[1])
  assert.deepEqual(verbs.slice(-2), ["remove", "prune"])
  assert.ok(verbs.includes("add"))
})

test("the guard run drops a forced color from the shell", () => {
  const f = fixture({ behind: 1 })
  f.call("merge", "91")
  const args = f.effects("timeout")[0].args
  assert.ok(args.includes("FORCE_COLOR"))
  assert.equal(args[args.indexOf("FORCE_COLOR") - 1], "-u")
})

test("a merged tree that passes the guards enqueues and says so", () => {
  const f = fixture({ behind: 1 })
  const r = f.call("merge", "91")
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /Merged tree passes 1 quick guards/)
  assert.equal(f.effects("gh", "pr merge").length, 1)
})

test("the worktree is removed when the guard run throws", () => {
  const f = fixture({
    behind: 1,
    intercept(cmd) {
      if (cmd === "timeout") throw new Error("runner died")
    },
  })
  const r = f.call("merge", "91")
  assert.equal(r.code, 1, r.text)
  assert.match(r.text, /runner died/)
  const verbs = f.effects("git", "worktree").map((e) => e.args[1])
  assert.deepEqual(verbs.slice(-2), ["remove", "prune"])
})

test("a lockfile that differs skips the merged-tree guards with a line", () => {
  const f = fixture({
    behind: 1,
    intercept(cmd, a) {
      if (
        cmd === "git" &&
        a[0] === "rev-parse" &&
        String(a[1]).includes("pnpm-lock")
      )
        return {
          ok: true,
          out: String(a[1]).startsWith("HEAD") ? "x" : "y",
          err: "",
        }
    },
  })
  const r = f.call("merge", "91")
  assert.equal(r.code, 0, r.text)
  assert.match(r.text, /guards skipped: the merge changes the lockfile/)
  assert.equal(f.effects("git", "worktree").length, 0)
})

test("merge --wait names the conflicted files when the queue drops a conflict", () => {
  const f = fixture({
    queue: true,
    behind: 0,
    removedEvents: [{ reason: "MERGE_CONFLICT", at: "t" }],
    inQueue: false,
    conflicts: ["apps/a.ts"],
  })
  f.s.behind = 0
  const wait = f.call("merge", "91", "--wait")
  assert.equal(wait.code, 2, wait.text)
  assert.match(
    wait.text,
    /LEFT_QUEUE.*MERGE_CONFLICT.*conflicts with origin\/main in apps\/a\.ts/s
  )
  assert.match(wait.text, /git rebase origin\/main/)
  assert.equal(f.effects("gh", "run rerun").length, 0)
})

const BILLING_RUN = 41549654357
const BILLING_JOB = 125633833595
const billingNote = {
  path: ".github",
  start_line: 1,
  annotation_level: "failure",
  message:
    "The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings",
}
const runnerNotice = {
  path: ".github",
  start_line: 1,
  annotation_level: "notice",
  message:
    "The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026.",
}
const answer = (cmd, args, key, value) =>
  cmd === "gh" && args.slice(0, 2).join(" ") === key ? value : null

test("merge --wait reruns a ci run with no steps once, then queues the PR again and merges only after that", () => {
  let enqueues = 0
  const f = fixture({
    queue: true,
    inQueue: false,
    rollup: [ci("failure")],
    runs: [failedRun()],
    runJobs: [
      { id: 11, steps: [] },
      { id: 12, steps: [] },
    ],
    annotations: [runnerNotice],
    intercept(cmd, a, options, s) {
      if (!answer(cmd, a, "pr merge", true)) return null
      enqueues += 1
      if (enqueues === 2) {
        s.pull.state = "MERGED"
        s.pull.mergeCommit = { oid: "done" }
      }
      return { ok: true, out: "", err: "" }
    },
    onPause(total, s) {
      if (f.effects("gh", "run rerun").length > 0) s.rollup = [ci("success")]
    },
  })
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 0, r.text)
  assert.deepEqual(f.effects("gh", "run rerun")[0].args, [
    "run",
    "rerun",
    "7",
    "--failed",
  ])
  assert.match(r.text, /Infra: run 7 ran no step in any of its 2 jobs/)
  assert.match(r.text, /rerun of run 7 passed, so PR #91 was queued again/)
  const kinds = f.ports.effects
    .filter((e) => e.op === "proc" && e.cmd === "gh")
    .map((e) => e.args.slice(0, 2).join(" "))
    .filter((pair) => pair === "run rerun" || pair === "pr merge")
  assert.deepEqual(kinds, ["pr merge", "run rerun", "pr merge"])
  assert.equal(enqueues, 2)
})

test("billing block seen in a recorded ci run refuses with exit 4 and never reruns", () => {
  const f = fixture({
    queue: true,
    inQueue: false,
    rollup: [ci("failure")],
    runs: [failedRun({ id: BILLING_RUN })],
    runJobs: [{ id: BILLING_JOB, steps: [] }],
    annotations: [billingNote],
  })
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 4, r.text)
  assert.match(r.text, /BILLING_BLOCKED.*run 41549654357/s)
  assert.match(r.text, /rerun or a new merge will not help/)
  assert.match(r.text, /Billing & plans.*Rickvu309/s)
  assert.equal(f.effects("gh", "run rerun").length, 0)
  assert.equal(f.effects("gh", "pr merge").length, 1)
})

test("billing block on a queue run is refused with exit 4, not told to enqueue again", () => {
  const f = fixture({
    queue: true,
    inQueue: false,
    removedEvents: [{ reason: "FAILED_CHECKS", at: "t" }],
    runs: [
      failedRun({
        id: BILLING_RUN,
        event: "merge_group",
        head_branch: "gh-readonly-queue/main/pr-91-abc",
      }),
    ],
    runJobs: [{ id: BILLING_JOB, steps: [] }],
    annotations: [billingNote],
  })
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 4, r.text)
  assert.match(r.text, /BILLING_BLOCKED/)
  assert.doesNotMatch(r.text, /enqueue it again/)
  assert.equal(f.effects("gh", "run rerun").length, 0)
})

test("merge refuses a billing-blocked ci before it enqueues", () => {
  const f = fixture({
    checks: [
      {
        id: 1,
        name: "ci",
        status: "completed",
        conclusion: "failure",
        head_sha: "head-1",
      },
    ],
    runs: [failedRun({ id: BILLING_RUN })],
    runJobs: [{ id: BILLING_JOB, steps: [] }],
    annotations: [billingNote],
  })
  const r = f.call("merge", "91")
  assert.equal(r.code, 4, r.text)
  assert.match(r.text, /BILLING_BLOCKED/)
  assert.doesNotMatch(r.text, /CI_REQUIRED/)
  assert.equal(f.effects("gh", "pr merge").length, 0)
  assert.equal(f.effects("gh", "run rerun").length, 0)
})

test("a failed ci with steps, or with no billing note, still refuses as CI_REQUIRED", () => {
  const failed = [
    {
      id: 1,
      name: "ci",
      status: "completed",
      conclusion: "failure",
      head_sha: "head-1",
    },
  ]
  const noNote = fixture({
    checks: failed,
    runs: [failedRun()],
    runJobs: [{ id: 5, steps: [] }],
    annotations: [runnerNotice],
  })
  assert.match(noNote.call("merge", "91").text, /CI_REQUIRED/)
  const withSteps = fixture({
    checks: failed,
    runs: [failedRun()],
    runJobs: [{ id: 5, steps: [{ name: "x" }] }],
    annotations: [billingNote],
  })
  assert.match(withSteps.call("merge", "91").text, /CI_REQUIRED/)
})

test("a second ci run with no steps is refused as infra, not rerun again", () => {
  const f = fixture({
    queue: true,
    inQueue: false,
    rollup: [ci("failure")],
    runs: [failedRun()],
    runJobs: [{ steps: [] }],
  })
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /CI_FAILED/)
  assert.equal(f.effects("gh", "run rerun").length, 1)
})

test("a ci run whose jobs ran steps is not rerun", () => {
  const f = fixture({
    queue: true,
    inQueue: false,
    rollup: [ci("failure")],
    runs: [failedRun()],
    runJobs: [{ steps: [{ name: "x" }] }, { steps: [] }],
  })
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 2, r.text)
  assert.equal(f.effects("gh", "run rerun").length, 0)
  assert.equal(stepless([{ steps: [] }]), true)
  assert.equal(stepless([]), false)
})

test("a queue run with no steps is reported as infra with the enqueue command", () => {
  const f = fixture({
    queue: true,
    inQueue: false,
    removedEvents: [{ reason: "FAILED_CHECKS", at: "t" }],
    runs: [
      failedRun({
        id: 9,
        event: "merge_group",
        head_branch: "gh-readonly-queue/main/pr-91-abc",
      }),
    ],
    runJobs: [{ id: 3, steps: [] }],
  })
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /Infra: run 9 ran no step in any job/)
  assert.match(r.text, /merge 91 --wait once to enqueue it again/)
  assert.match(r.text, /fails the same way again, stop and tell the owner/)
  assert.equal(f.effects("gh", "run rerun").length, 0)
})

const leftover = (home) => join(home, "tmp", "ocv-merge-1-deadbeef")
const listing = (paths) =>
  paths.map((path) => `worktree ${path}\nHEAD abc\ndetached\n`).join("\n")

test("a leftover merged-tree worktree from another PR is swept by the next run", () => {
  const f = fixture({
    behind: 1,
    intercept(cmd, a) {
      if (cmd === "git" && a[0] === "worktree" && a[1] === "list")
        return {
          ok: true,
          out: listing(["/repo", leftover(f.ctx.env.HOME ?? homedir())]),
          err: "",
        }
    },
  })
  const r = f.call("merge", "91")
  assert.equal(r.code, 0, r.text)
  const removed = f.effects("git", "worktree remove").map((e) => e.args.at(-1))
  assert.ok(removed.includes(leftover(f.ctx.env.HOME ?? homedir())))
  assert.match(r.text, /Removed 1 leftover merged-tree worktrees/)
})

test("a merged-tree worktree younger than the guard limit is left alone", () => {
  const f = fixture({
    behind: 1,
    intercept(cmd, a) {
      if (cmd === "stat")
        return { ok: true, out: String(f.ctx.now() / 1000 - 5), err: "" }
      if (cmd === "git" && a[0] === "worktree" && a[1] === "list")
        return {
          ok: true,
          out: listing(["/repo", leftover(f.ctx.env.HOME ?? homedir())]),
          err: "",
        }
    },
  })
  f.call("merge", "91")
  const removed = f.effects("git", "worktree remove").map((e) => e.args.at(-1))
  assert.ok(!removed.includes(leftover(f.ctx.env.HOME ?? homedir())))
})

test("a stop signal during the guard run removes the worktree and exits", () => {
  const exits = []
  const host = Object.assign(new EventEmitter(), {
    exit: (code) => exits.push(code),
  })
  let removedAtSignal = null
  const f = fixture({
    behind: 1,
    intercept(cmd) {
      if (cmd !== "timeout") return null
      const before = f.effects("git", "worktree remove").length
      host.emit("SIGTERM")
      removedAtSignal = f.effects("git", "worktree remove").length - before
      return { ok: true, out: "1 passed", err: "" }
    },
  })
  f.ctx.host = host
  f.call("merge", "91")
  assert.deepEqual(exits, [143])
  assert.equal(removedAtSignal, 1)
  assert.equal(host.listenerCount("SIGTERM"), 0)
  assert.equal(host.listenerCount("SIGINT"), 0)
})

test("merge-result rows pass when nothing is wrong", () => {
  assert.equal(
    decide("merge-result", { mergeResult: { n: 1, conflicts: [], failed: [] } })
      .ok,
    true
  )
})

function runGit(cwd, ...args) {
  const env = { ...process.env }
  for (const name of GIT_ENV) delete env[name]
  return execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim()
}

function repoWithTheMistake(t, headFiles) {
  const root = tempDir(t, "merged-tree-")
  const origin = join(root, "origin.git")
  const clone = join(root, "clone")
  mkdirSync(origin)
  runGit(origin, "init", "--bare", "-b", "main")
  runGit(root, "clone", origin, clone)
  runGit(clone, "config", "user.email", "t@example.com")
  runGit(clone, "config", "user.name", "t")
  mkdirSync(join(clone, "scripts"))
  writeFileSync(join(clone, "pnpm-lock.yaml"), "lock\n")
  writeFileSync(join(clone, "shared.txt"), "base\n")
  runGit(clone, "add", ".")
  runGit(
    clone,
    "-c",
    "commit.gpgsign=false",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-m",
    "base"
  )
  runGit(clone, "push", "origin", "main")
  runGit(clone, "checkout", "-b", "work")
  for (const [name, text] of Object.entries(headFiles))
    writeFileSync(join(clone, name), text)
  runGit(clone, "add", ".")
  runGit(
    clone,
    "-c",
    "commit.gpgsign=false",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-m",
    "head"
  )
  const head = runGit(clone, "rev-parse", "HEAD")
  runGit(clone, "push", "origin", "work:refs/pull/5/head")
  runGit(clone, "checkout", "main")
  return { root, clone, head }
}

function realCtx(clone, home, guard) {
  const ports = realPorts()
  const base = ports.proc.run
  ports.proc.run = (cmd, args, options = {}) => {
    const env = Object.fromEntries(GIT_ENV.map((name) => [name, undefined]))
    return base(cmd, args, { ...options, env: { ...options.env, ...env } })
  }
  return { cwd: clone, ports, env: { HOME: home }, guard }
}

function mainMoves(clone, files) {
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(clone, name, ".."), { recursive: true })
    writeFileSync(join(clone, name), text)
  }
  runGit(clone, "add", ".")
  runGit(
    clone,
    "-c",
    "commit.gpgsign=false",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-m",
    "main moves"
  )
  runGit(clone, "push", "origin", "main")
}

const FORBIDDEN_GUARD = `import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import test from "node:test"
test("forbidden.txt is never added", () => {
  assert.equal(existsSync("forbidden.txt"), false)
})
`

test("real git: main gains a guard the head breaks, so the merged tree fails and nothing is left behind", (t) => {
  const { root, clone } = repoWithTheMistake(t, { "forbidden.txt": "x\n" })
  mainMoves(clone, { "scripts/adr-citations.test.mjs": FORBIDDEN_GUARD })
  const ctx = realCtx(clone, root)
  const facts = mergeResultFacts(ctx, 5, headOf(clone))
  assert.deepEqual(facts.conflicts, [])
  assert.deepEqual(facts.failed, ["forbidden.txt is never added"])
  assert.equal(
    decide("merge-result", { mergeResult: facts }).refusals[0].id,
    "MERGED_TREE_FAILS"
  )
  assert.equal(runGit(clone, "worktree", "list").split("\n").length, 1)
  assert.equal(
    existsSync(join(root, "tmp", "ocv-merge-5-" + headOf(clone).slice(0, 8))),
    false
  )
})

function headOf(clone) {
  runGit(clone, "fetch", "origin", "refs/pull/5/head")
  return runGit(clone, "rev-parse", "FETCH_HEAD")
}

test("real git: a head that touches what main touched conflicts and names the file", (t) => {
  const { root, clone } = repoWithTheMistake(t, { "shared.txt": "head\n" })
  mainMoves(clone, { "shared.txt": "main\n" })
  const facts = mergeResultFacts(realCtx(clone, root), 5, headOf(clone))
  assert.deepEqual(facts.conflicts, ["shared.txt"])
  assert.equal(
    decide("merge-result", { mergeResult: facts }).refusals[0].id,
    "MERGE_CONFLICT"
  )
  assert.equal(runGit(clone, "worktree", "list").split("\n").length, 1)
})

test("real git: a clean merge passes the guards and leaves no worktree", (t) => {
  const { root, clone } = repoWithTheMistake(t, { "other.txt": "x\n" })
  mainMoves(clone, { "scripts/adr-citations.test.mjs": FORBIDDEN_GUARD })
  const facts = mergeResultFacts(realCtx(clone, root), 5, headOf(clone))
  assert.deepEqual(facts.failed, [])
  assert.match(facts.lines[0], /passes 1 quick guards/)
  assert.equal(runGit(clone, "worktree", "list").split("\n").length, 1)
})

test("real git: the worktree is removed when the guard run throws", (t) => {
  const { root, clone } = repoWithTheMistake(t, { "other.txt": "x\n" })
  mainMoves(clone, { "scripts/adr-citations.test.mjs": FORBIDDEN_GUARD })
  const ctx = realCtx(clone, root)
  const run = ctx.ports.proc.run
  ctx.ports.proc.run = (cmd, ...rest) => {
    if (cmd === "timeout") throw new Error("runner died")
    return run(cmd, ...rest)
  }
  assert.throws(() => mergeResultFacts(ctx, 5, headOf(clone)), /runner died/)
  assert.equal(runGit(clone, "worktree", "list").split("\n").length, 1)
})
