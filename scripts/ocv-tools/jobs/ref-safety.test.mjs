import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { tempDir } from "../../lib/temp-dir.mjs"
import { isolatedEnv } from "../ports/proc.mjs"

const root = fileURLToPath(new URL("../../../", import.meta.url))
const SELF = "scripts/ocv-tools/jobs/ref-safety.test.mjs"
const WHOLE_SUITE = "scripts/ocv-tools/jobs/sweep-home.test.mjs"
const SPAWNS = /child_process|realRunner|realPorts/

const PROC = new URL("../ports/proc.mjs", import.meta.url).href
const PLAN = new URL("./affected-tests.mjs", import.meta.url).href
const RUNNERS = new URL("./test-runners.mjs", import.meta.url).href
const TOOL_PROCESS = `import { realRunner } from ${JSON.stringify(PROC)}
import { affectedPlan } from ${JSON.stringify(PLAN)}
import { SCRIPTS_RUNNER } from ${JSON.stringify(RUNNERS)}
const { top, files } = JSON.parse(process.env.REF_SAFETY_PLAN)
const run = realRunner()
const group = { runner: "scripts", files: files.map((file) => ({ file })), dropped: [] }
let failed = 0
for (const step of affectedPlan({ groups: [group], runners: [SCRIPTS_RUNNER] }, top)) {
  const r = run(step.cmd, step.args, { cwd: step.cwd, timeout: 240000 })
  process.stdout.write(r.out + "\\n")
  if (!r.ok) {
    failed += 1
    process.stderr.write(r.out.slice(-1500) + "\\n" + r.err.slice(-1500))
  }
}
process.exit(failed ? 1 : 0)
`

function spawningToolTests() {
  return execFileSync(
    "git",
    [
      "ls-files",
      "scripts/ocv-tools/*.test.mjs",
      "scripts/ocv-tools/**/*.test.mjs",
    ],
    { cwd: root, env: isolatedEnv(process.env), encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean)
    .filter((file) => file !== SELF && file !== WHOLE_SUITE)
    .filter((file) => SPAWNS.test(readFileSync(join(root, file), "utf8")))
}

function throwawayRepo(t) {
  const dir = tempDir(t, "ref-safety-")
  const clone = join(dir, "repo")
  const git = (...args) =>
    execFileSync("git", args, {
      env: isolatedEnv(process.env),
      encoding: "utf8",
    })
  git("clone", "--quiet", "--local", "--no-checkout", root, clone)
  const repo = join(clone, ".git")
  const state = () => ({
    refs: git("--git-dir", repo, "for-each-ref"),
    config: git("--git-dir", repo, "config", "--local", "--list"),
    worktrees: git("--git-dir", repo, "worktree", "list", "--porcelain"),
  })
  return { repo, state }
}

const hookEnv = (repo, extra = {}) => ({
  ...isolatedEnv(process.env),
  GIT_DIR: repo,
  GIT_INDEX_FILE: join(repo, "index"),
  ...extra,
})

function asTool(repo, top, files, extra) {
  return spawnSync(
    process.execPath,
    ["--input-type=module", "-e", TOOL_PROCESS],
    {
      cwd: top,
      env: hookEnv(repo, {
        REF_SAFETY_PLAN: JSON.stringify({ top, files }),
        ...extra,
      }),
      encoding: "utf8",
      timeout: 300_000,
    }
  )
}

test("the delivery tool's own process-spawning tests, run by the tool inside a hook of a repository, leave its refs, local config and worktrees unchanged", (t) => {
  const files = spawningToolTests()
  assert.ok(
    files.includes("scripts/ocv-tools/ports/git.test.mjs") &&
      files.includes("scripts/ocv-tools/ports/git-cleanup.test.mjs") &&
      files.includes("scripts/ocv-tools/jobs/merged-tree-git.test.mjs"),
    files.join("\n")
  )
  const { repo, state } = throwawayRepo(t)
  const before = state()
  const r = asTool(repo, root, files)
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`.slice(-3000))
  assert.match(r.stdout.replace(/\s/g, ""), /^\.{10,}$/)
  assert.deepEqual(state(), before)
})

const SCRATCH_TEST = `import { execFileSync } from "node:child_process"
import { join } from "node:path"
import test from "node:test"
test("writes a ref, a config value and a worktree in its own scratch repository", () => {
  const dir = process.env.REF_SAFETY_SCRATCH
  const git = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: dir, input: "" })
  git("init", "-q")
  const tree = git("hash-object", "-t", "tree", "-w", "--stdin").toString().trim()
  const commit = git("commit-tree", tree, "-m", "init").toString().trim()
  git("update-ref", "refs/heads/main", commit)
  git("config", "core.hooksPath", "/dev/null")
  git("worktree", "add", "--detach", join(dir, "side"), commit)
})
`

test("the mistake fixture fires: a test that writes in its scratch repository, given the hook's git variables as the first runner of #1414 gave them, writes the hook's repository; the tool's runner keeps it unchanged", (t) => {
  const top = tempDir(t, "ref-safety-top-")
  mkdirSync(join(top, "scripts"))
  writeFileSync(join(top, "scripts/scratch.test.mjs"), SCRATCH_TEST)
  const leaked = throwawayRepo(t)
  const leakedBefore = leaked.state()
  const raw = spawnSync(
    process.execPath,
    ["--test", "scripts/scratch.test.mjs"],
    {
      cwd: top,
      env: hookEnv(leaked.repo, {
        REF_SAFETY_SCRATCH: tempDir(t, "ref-safety-scratch-"),
      }),
      encoding: "utf8",
      timeout: 60_000,
    }
  )
  const leakedAfter = leaked.state()
  assert.notEqual(leakedAfter.refs, leakedBefore.refs, raw.stderr)
  assert.notEqual(leakedAfter.config, leakedBefore.config, raw.stderr)
  assert.notEqual(leakedAfter.worktrees, leakedBefore.worktrees, raw.stderr)
  const kept = throwawayRepo(t)
  const keptBefore = kept.state()
  const r = asTool(kept.repo, top, ["scripts/scratch.test.mjs"], {
    REF_SAFETY_SCRATCH: tempDir(t, "ref-safety-scratch-"),
  })
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`.slice(-2000))
  assert.deepEqual(kept.state(), keptBefore)
})
