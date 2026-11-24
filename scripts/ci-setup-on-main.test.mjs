import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { detect, mainMovingBlock } from "./lib/ci-setup-on-main.mjs"
import { tempDir } from "./lib/temp-dir.mjs"
import { isolatedEnv } from "./ocv-tools/ports/proc.mjs"

const SETUP = ".github/actions/setup/action.yml"
const SPAWN_TIMEOUT_MS = 30_000
const setupText = readFileSync(new URL(`../${SETUP}`, import.meta.url), "utf8")

const MOVES_A_CHECKED_OUT_MAIN = `runs:
  steps:
    - run: |
        git show-ref --verify --quiet refs/remotes/origin/main || git fetch origin main:refs/remotes/origin/main
        git branch -f main origin/main
      shell: bash
`

const LEAVES_MAIN_FIRST = `runs:
  steps:
    - run: |
        git show-ref --verify --quiet refs/remotes/origin/main || git fetch origin main:refs/remotes/origin/main
        git checkout --quiet --detach
        git branch -f main origin/main
      shell: bash
`

function checkout(t) {
  const dir = tempDir(t, "ci-setup-on-main-")
  const home = join(dir, "home")
  mkdirSync(home)
  const env = { ...isolatedEnv(process.env), HOME: home }
  const sh = (cwd, command, args) =>
    spawnSync(command, args, {
      cwd,
      env,
      encoding: "utf8",
      timeout: SPAWN_TIMEOUT_MS,
    })
  const git = (cwd, ...args) => {
    const done = sh(cwd, "git", [
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@example.com",
      ...args,
    ])
    assert.equal(done.status, 0, `git ${args.join(" ")}: ${done.stderr}`)
    return done.stdout.trim()
  }
  const remote = join(dir, "remote")
  mkdirSync(remote)
  git(remote, "init", "--quiet", "--initial-branch=main")
  writeFileSync(join(remote, "a.txt"), "a\n")
  git(remote, "add", "-A")
  git(remote, "commit", "--quiet", "-m", "a")
  git(dir, "clone", "--quiet", "--no-hardlinks", remote, "work")
  const work = join(dir, "work")
  return {
    work,
    git: (...args) => git(work, ...args),
    setup: (text) => sh(work, "bash", ["-e", "-c", mainMovingBlock(text)]),
  }
}

test("the detector fires on a setup that moves a checked-out main and stays quiet once it leaves the branch first", () => {
  assert.equal(detect(MOVES_A_CHECKED_OUT_MAIN, SETUP).length, 1)
  assert.deepEqual(detect(LEAVES_MAIN_FIRST, SETUP), [])
  assert.deepEqual(detect(MOVES_A_CHECKED_OUT_MAIN, "other/action.yml"), [])
})

test("the real setup step leaves the branch before it moves main", () => {
  assert.ok(mainMovingBlock(setupText), "setup still moves main")
  assert.deepEqual(detect(setupText, SETUP), [])
})

test("on a push to main, where main is checked out, the old setup step fails and the real one passes", (t) => {
  const repo = checkout(t)
  assert.equal(repo.git("symbolic-ref", "--short", "HEAD"), "main")
  const head = repo.git("rev-parse", "HEAD")
  const old = repo.setup(MOVES_A_CHECKED_OUT_MAIN)
  assert.notEqual(old.status, 0)
  assert.match(old.stderr, /cannot force update the branch 'main'/)
  const real = repo.setup(setupText)
  assert.equal(real.status, 0, real.stderr)
  assert.equal(repo.git("rev-parse", "HEAD"), head)
  assert.equal(repo.git("rev-parse", "main"), head)
})

test("on a pull request, where the head is already detached, the real setup step moves main to origin/main", (t) => {
  const repo = checkout(t)
  const base = repo.git("rev-parse", "HEAD")
  repo.git("checkout", "--quiet", "--detach")
  writeFileSync(join(repo.work, "b.txt"), "b\n")
  repo.git("add", "-A")
  repo.git("commit", "--quiet", "-m", "b")
  const head = repo.git("rev-parse", "HEAD")
  const real = repo.setup(setupText)
  assert.equal(real.status, 0, real.stderr)
  assert.equal(repo.git("rev-parse", "HEAD"), head)
  assert.equal(repo.git("rev-parse", "main"), base)
})
