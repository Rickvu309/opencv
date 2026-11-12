import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { tempDir } from "../../lib/temp-dir.mjs"
import { affectedPlan } from "./affected-tests.mjs"
import { GIT_ENV } from "./push-checks.mjs"

const root = fileURLToPath(new URL("../../../", import.meta.url))
const GIT_WRITING_TESTS = [
  "scripts/ocv-tools/ports/git-cleanup.test.mjs",
  "scripts/ocv-tools/ports/git.test.mjs",
]

function cleanEnv() {
  const env = { ...process.env }
  for (const name of [...GIT_ENV, "NODE_TEST_CONTEXT"]) delete env[name]
  return env
}

function throwawayRepo(t) {
  const dir = tempDir(t, "ref-safety-")
  const clone = join(dir, "repo")
  execFileSync(
    "git",
    ["clone", "--quiet", "--local", "--no-checkout", root, clone],
    { env: cleanEnv() }
  )
  const repo = join(clone, ".git")
  const refs = () =>
    execFileSync("git", ["--git-dir", repo, "for-each-ref"], {
      env: cleanEnv(),
      encoding: "utf8",
    })
  return { repo, refs }
}

const hookEnv = (repo) => ({ ...cleanEnv(), GIT_DIR: repo })

test("the affected-test runner keeps every ref of the repository the hook runs in, even when a test writes refs in its own scratch clone", (t) => {
  const { repo, refs } = throwawayRepo(t)
  const before = refs()
  const [step] = affectedPlan(
    {
      groups: [
        {
          runner: "scripts",
          files: GIT_WRITING_TESTS.map((file) => ({ file })),
          dropped: [],
        },
      ],
    },
    root
  )
  const r = spawnSync(step.cmd, step.args, {
    cwd: step.cwd,
    env: hookEnv(repo),
    encoding: "utf8",
    timeout: 180_000,
  })
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`.slice(-2000))
  assert.equal(refs(), before)
})

const SCRATCH_TEST = `import { execFileSync } from "node:child_process"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
test("writes refs in its own scratch repository", () => {
  const dir = mkdtempSync(join(tmpdir(), "scratch-"))
  const git = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: dir, input: "" })
  git("init", "-q")
  const tree = git("hash-object", "-t", "tree", "-w", "--stdin").toString().trim()
  const commit = git("commit-tree", tree, "-m", "init").toString().trim()
  git("update-ref", "refs/heads/main", commit)
})
`

test("the mistake fixture fires: a test that writes refs in its scratch repository, run with the hook's GIT_DIR as the runner at 4fe94a7e ran it, moves the repository's main; the runner now keeps it", (t) => {
  const top = tempDir(t, "ref-safety-top-")
  mkdirSync(join(top, "scripts"))
  writeFileSync(join(top, "scripts/scratch.test.mjs"), SCRATCH_TEST)
  const leaked = throwawayRepo(t)
  const leakedBefore = leaked.refs()
  const raw = spawnSync("node", ["--test", "scripts/scratch.test.mjs"], {
    cwd: top,
    env: hookEnv(leaked.repo),
    encoding: "utf8",
    timeout: 60_000,
  })
  assert.notEqual(
    leaked.refs(),
    leakedBefore,
    `${raw.stdout}\n${raw.stderr}`.slice(-1500)
  )
  const kept = throwawayRepo(t)
  const keptBefore = kept.refs()
  const [step] = affectedPlan(
    {
      groups: [
        {
          runner: "scripts",
          files: [{ file: "scripts/scratch.test.mjs" }],
          dropped: [],
        },
      ],
    },
    top
  )
  const r = spawnSync(step.cmd, step.args, {
    cwd: step.cwd,
    env: hookEnv(kept.repo),
    encoding: "utf8",
    timeout: 60_000,
  })
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`.slice(-2000))
  assert.equal(kept.refs(), keptBefore)
})
