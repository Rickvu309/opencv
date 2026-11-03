import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
} from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { SLOW } from "../packages/guards/run-tests.mjs"
import { tempDir } from "./lib/temp-dir.mjs"
import { GIT_ENV } from "./ocv-tools/jobs/push-checks.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const HELPER = "scripts/lib/temp-dir.mjs"
const SELF = "scripts/temp-dirs.test.mjs"
const SOURCE = /\.(?:[cm]?[jt]s)$/
const CREATOR = /\bmkdtemp(?:Sync)?\b/

const tracked = (...specs) =>
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", ...specs],
    {
      cwd: root,
      encoding: "utf8",
    }
  )
    .split("\n")
    .filter(Boolean)

export function strayCreators(files, read) {
  const found = []
  for (const file of files) {
    if (file === HELPER || file === SELF || !SOURCE.test(file)) continue
    read(file)
      .split("\n")
      .forEach((line, index) => {
        if (CREATOR.test(line)) found.push(`${file}:${index + 1}`)
      })
  }
  return found
}

test("only the shared helper makes temporary folders under scripts and packages/guards", () => {
  const stray = strayCreators(tracked("scripts", "packages/guards"), (file) =>
    readFileSync(path.join(root, file), "utf8")
  )
  assert.deepEqual(
    stray,
    [],
    `${stray.join(", ")} make a temporary folder without scripts/lib/temp-dir.mjs. Use makeTempDir, tempDir(t, ...) or withTempDir from it so the folder is removed when the test ends, even on failure.`
  )
})

test("the scan flags a direct call and passes the helper and a helper user", () => {
  const sources = {
    "scripts/a.test.mjs": 'const d = mkdtempSync(join(tmpdir(), "x-"))\n',
    "scripts/b.test.mjs": 'import { fs } from "x"\nawait fs.mkdtemp("y")\n',
    "scripts/c.test.mjs": 'const d = makeTempDir("x-")\n',
    [HELPER]: "mkdtempSync(join(root, prefix))\n",
    "scripts/notes.md": "mkdtempSync\n",
  }
  assert.deepEqual(
    strayCreators(Object.keys(sources), (file) => sources[file]),
    ["scripts/a.test.mjs:1", "scripts/b.test.mjs:2"]
  )
})

function toolSuite() {
  const suite = tracked(
    "scripts/ocv-tools/*.test.mjs",
    "scripts/ocv-tools/**/*.test.mjs"
  ).filter((file) => file !== SLOW)
  assert.ok(suite.length > 10, "the ocv-tools test list is empty")
  return suite
}

function gitQuiet(args) {
  execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
    encoding: "utf8",
  })
}

test("the ocv-tools tests leave no temporary folder behind", (t) => {
  const sandbox = tempDir(t, "temp-dirs-run-")
  const before = readdirSync(sandbox).length
  const { NODE_TEST_CONTEXT: _outer, ...env } = process.env
  const run = spawnSync(process.execPath, ["--test", ...toolSuite()], {
    cwd: root,
    env: { ...env, TMPDIR: sandbox },
    encoding: "utf8",
  })
  assert.equal(run.status, 0, run.stdout.slice(-2000) + run.stderr.slice(-1000))
  const left = readdirSync(sandbox)
  assert.equal(before, 0)
  assert.equal(
    left.length,
    0,
    `the ocv-tools tests left ${left.length} entries in their temp directory (${before} before): ${left.slice(0, 5).join(", ")}`
  )
})

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
    ["--test", "--test-concurrency=2", ...toolSuite()],
    {
      cwd: foreign,
      env,
      encoding: "utf8",
    }
  )
  assert.equal(run.status, 0, run.stdout.slice(-2000) + run.stderr.slice(-1000))
})
