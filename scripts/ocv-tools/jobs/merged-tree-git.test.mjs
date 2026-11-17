import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { tempDir } from "../../lib/temp-dir.mjs"
import { realPorts } from "../ports/index.mjs"
import { decide } from "../rules/index.mjs"
import { mergeResultFacts } from "./merged-tree.mjs"
import { isolatedEnv } from "../ports/proc.mjs"

function runGit(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    env: isolatedEnv(process.env),
    encoding: "utf8",
  }).trim()
}

function repoWithTheMistake(t, headFiles) {
  const root = tempDir(t, "merged-tree-")
  const origin = join(root, "origin.git")
  const clone = join(root, "clone")
  mkdirSync(origin)
  runGit(origin, "init", "--bare", "-b", "main")
  runGit(root, "clone", "--no-hardlinks", origin, clone)
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
    const kept = isolatedEnv(process.env)
    const env = {
      ...Object.fromEntries(
        Object.keys(process.env)
          .filter((name) => !(name in kept))
          .map((name) => [name, undefined])
      ),
      HOME: home,
    }
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
  mainMoves(clone, { "scripts/local-port-range.test.mjs": FORBIDDEN_GUARD })
  const ctx = realCtx(clone, root)
  const facts = mergeResultFacts(ctx, 5, headOf(clone))
  assert.deepEqual(facts.conflicts, [])
  assert.deepEqual(facts.failed, [
    "forbidden.txt is never added: AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: true !== false",
  ])
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
  mainMoves(clone, { "scripts/local-port-range.test.mjs": FORBIDDEN_GUARD })
  const facts = mergeResultFacts(realCtx(clone, root), 5, headOf(clone))
  assert.deepEqual(facts.failed, [])
  assert.match(facts.lines[0], /passes 1 quick guards/)
  assert.equal(runGit(clone, "worktree", "list").split("\n").length, 1)
})

test("real git: the worktree is removed when the guard run throws", (t) => {
  const { root, clone } = repoWithTheMistake(t, { "other.txt": "x\n" })
  mainMoves(clone, { "scripts/local-port-range.test.mjs": FORBIDDEN_GUARD })
  const ctx = realCtx(clone, root)
  const run = ctx.ports.proc.run
  ctx.ports.proc.run = (cmd, ...rest) => {
    if (cmd === "timeout") throw new Error("runner died")
    return run(cmd, ...rest)
  }
  assert.throws(() => mergeResultFacts(ctx, 5, headOf(clone)), /runner died/)
  assert.equal(runGit(clone, "worktree", "list").split("\n").length, 1)
})

test("real git: a lockfile main changed is installed inside the merged tree, and a failed install refuses and leaves nothing behind", (t) => {
  const { root, clone } = repoWithTheMistake(t, { "other.txt": "x\n" })
  mainMoves(clone, { "pnpm-lock.yaml": "lock 2\n" })
  runGit(clone, "reset", "--hard", "HEAD~1")
  const ctx = realCtx(clone, root)
  const run = ctx.ports.proc.run
  const installs = []
  ctx.ports.proc.run = (cmd, args, options) => {
    if (cmd === "timeout" && args[1] === "pnpm") {
      installs.push({
        args,
        lock: readFileSync(join(options.cwd, "pnpm-lock.yaml"), "utf8"),
        worktrees: runGit(clone, "worktree", "list").split("\n").length,
      })
      return { ok: false, out: "", err: "ERR_PNPM_OUTDATED_LOCKFILE" }
    }
    return run(cmd, args, options)
  }
  const facts = mergeResultFacts(ctx, 5, headOf(clone))
  assert.deepEqual(installs, [
    {
      args: ["600", "pnpm", "install", "--frozen-lockfile"],
      lock: "lock 2\n",
      worktrees: 2,
    },
  ])
  assert.match(
    facts.failed[0],
    /could not install .*ERR_PNPM_OUTDATED_LOCKFILE/
  )
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
