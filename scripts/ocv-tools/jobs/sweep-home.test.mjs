import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { cpSync, mkdirSync, symlinkSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { SLOW } from "../../../packages/guards/run-tests.mjs"
import { tempDir } from "../../lib/temp-dir.mjs"
import { GIT_ENV } from "./push-checks.mjs"

const root = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../.."
)
const SELF = "scripts/ocv-tools/jobs/sweep-home.test.mjs"

function tracked(...specs) {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", ...specs],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean)
}

function gitQuiet(args) {
  execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
    encoding: "utf8",
  })
}

test("the ocv-tools tests pass while an unrelated merge worktree sits in the temp folder", (t) => {
  const home = tempDir(t, "sweep-home-")
  const mirror = path.join(home, "mirror")
  const foreign = path.join(home, "tmp", "ocv-merge-999-deadbeef")
  mkdirSync(path.join(home, "tmp"), { recursive: true })
  gitQuiet(["clone", "--shared", "--no-checkout", root, mirror])
  gitQuiet(["-C", mirror, "worktree", "add", "--detach", foreign, "HEAD"])
  cpSync(path.join(root, "scripts"), path.join(foreign, "scripts"), {
    recursive: true,
  })
  symlinkSync(
    path.join(root, "node_modules"),
    path.join(foreign, "node_modules")
  )
  const listed = execFileSync(
    "git",
    ["-C", mirror, "worktree", "list", "--porcelain"],
    { encoding: "utf8" }
  )
  assert.ok(listed.includes(`worktree ${foreign}`))
  const suite = tracked(
    "scripts/ocv-tools/*.test.mjs",
    "scripts/ocv-tools/**/*.test.mjs"
  ).filter((file) => file !== SLOW && file !== SELF)
  assert.ok(suite.length > 10, "the ocv-tools test list is empty")
  const env = {
    ...process.env,
    HOME: home,
    TMPDIR: path.join(home, "inner-tmp"),
  }
  delete env.NODE_TEST_CONTEXT
  delete env.FORCE_COLOR
  delete env.CLICOLOR_FORCE
  for (const name of GIT_ENV) delete env[name]
  const run = spawnSync(
    process.execPath,
    ["--test", "--test-concurrency=2", ...suite],
    {
      cwd: foreign,
      env,
      encoding: "utf8",
    }
  )
  assert.equal(run.status, 0, run.stdout.slice(-2000) + run.stderr.slice(-1000))
})
