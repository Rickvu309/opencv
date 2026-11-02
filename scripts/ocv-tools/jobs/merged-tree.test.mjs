import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
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

test("merge --wait reruns a ci run with no steps once and reports infra", () => {
  const f = fixture({
    queue: true,
    inQueue: false,
    rollup: [ci("failure")],
    runs: [failedRun()],
    runJobs: [{ steps: [] }, { steps: [] }],
    onPause(total, s) {
      if (s.reran) return
      s.reran = f.effects("gh", "run rerun").length > 0
      if (!s.reran) return
      s.rollup = [ci("success")]
      s.pull.state = "MERGED"
      s.pull.mergeCommit = { oid: "done" }
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
  assert.equal(f.effects("gh", "run rerun").length, 1)
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
    runJobs: [{ steps: [] }],
  })
  const r = f.call("merge", "91", "--wait")
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /Infra: run 9 ran no step in any job/)
  assert.match(r.text, /merge 91 --wait to enqueue it again/)
  assert.equal(f.effects("gh", "run rerun").length, 0)
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
