import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { detect } from "./lib/ci-git-background.mjs"
import { tempDir } from "./lib/temp-dir.mjs"
import { isolatedEnv } from "./ocv-tools/ports/proc.mjs"

const SETUP = ".github/actions/setup/action.yml"
const SPAWN_TIMEOUT_MS = 30_000
const setupText = readFileSync(new URL(`../${SETUP}`, import.meta.url), "utf8")

const STARTS_BACKGROUND_GIT = `runs:
  steps:
    - run: |
        echo ready
      shell: bash
`

const NO_BACKGROUND_GIT = `runs:
  steps:
    - run: |
        sudo git config --system maintenance.auto false
        sudo git config --system gc.auto 0
      shell: bash
`

const OWNER_OF_THE_COMMIT = [
  "[user]",
  "\tname = t",
  "\temail = t@example.com",
  "",
]

function commitTrace(t, systemConfig) {
  const dir = tempDir(t, "ci-git-background-")
  const home = join(dir, "home")
  const repo = join(dir, "repo")
  mkdirSync(home)
  mkdirSync(repo)
  const system = join(dir, "system.gitconfig")
  writeFileSync(system, systemConfig)
  writeFileSync(join(home, ".gitconfig"), OWNER_OF_THE_COMMIT.join("\n"))
  const env = {
    ...isolatedEnv(process.env),
    HOME: home,
    GIT_CONFIG_SYSTEM: system,
    GIT_TRACE: "1",
  }
  const git = (...args) => {
    const done = spawnSync("git", args, {
      cwd: repo,
      env,
      encoding: "utf8",
      timeout: SPAWN_TIMEOUT_MS,
    })
    assert.equal(done.status, 0, `git ${args.join(" ")}: ${done.stderr}`)
    return done.stderr
  }
  git("init", "--quiet", "--initial-branch=main")
  writeFileSync(join(repo, "a.txt"), "a\n")
  git("add", "-A")
  return git("commit", "--quiet", "-m", "a")
}

test("the detector fires on a setup that leaves background git on and stays quiet once both settings are there", () => {
  assert.equal(detect(STARTS_BACKGROUND_GIT, SETUP).length, 2)
  assert.deepEqual(detect(NO_BACKGROUND_GIT, SETUP), [])
  assert.deepEqual(detect(STARTS_BACKGROUND_GIT, "other/action.yml"), [])
})

test("the real setup step turns background git off for every repository on the runner", () => {
  assert.deepEqual(detect(setupText, SETUP), [])
})

test("with the settings the setup step writes, a commit in a throwaway repository starts no background git", (t) => {
  const trace = commitTrace(
    t,
    "[maintenance]\n\tauto = false\n[gc]\n\tauto = 0\n"
  )
  assert.doesNotMatch(trace, /maintenance run|gc --auto/)
})
