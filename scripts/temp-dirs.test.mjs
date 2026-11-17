import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { SLOW } from "../packages/guards/run-tests.mjs"
import { detect } from "./lib/home-tmp.mjs"
import { canJudgeFolders } from "./lib/temp-run.mjs"
import { tempDir } from "./lib/temp-dir.mjs"

const SUITE_TIMEOUT_MS = 10 * 60 * 1000
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
    .filter((file) => file && existsSync(path.join(root, file)))

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

test("a test file that builds a folder under the home temp directory is caught", () => {
  const mistake = [
    'mkdirSync(join(process.env.HOME, "tmp"), { recursive: true })',
    'const dir = makeTempDir("ocv-pending-", join(process.env.HOME, "tmp"))',
    'mkdirSync(join(homedir(), "tmp"), { recursive: true })',
  ].join("\n")
  assert.deepEqual(detect(mistake), [1, 2, 3])
  assert.deepEqual(detect('const dir = tempDir(t, "ocv-pending-")\n'), [])
  assert.deepEqual(detect("const home = process.env.HOME\n"), [])
  assert.deepEqual(detect('const dir = join(root, "tmp")\n'), [])
})

test("the ocv-tools tests leave no temporary folder behind", (t) => {
  const sandbox = tempDir(t, "temp-dirs-run-")
  const home = tempDir(t, "temp-dirs-home-")
  const before = readdirSync(sandbox).length
  const suite = tracked(
    "scripts/ocv-tools/*.test.mjs",
    "scripts/ocv-tools/**/*.test.mjs"
  ).filter((file) => file !== SLOW)
  assert.ok(suite.length > 10, "the ocv-tools test list is empty")
  const { NODE_TEST_CONTEXT: _outer, ...env } = process.env
  const run = spawnSync(
    process.execPath,
    ["--test", "--test-reporter=spec", ...suite],
    {
      cwd: root,
      env: { ...env, TMPDIR: sandbox, HOME: home },
      encoding: "utf8",
      timeout: SUITE_TIMEOUT_MS,
    }
  )
  if (!canJudgeFolders(t, run)) return
  const left = readdirSync(sandbox)
  assert.equal(before, 0)
  assert.equal(
    left.length,
    0,
    `the ocv-tools tests left ${left.length} entries in their temp directory (${before} before): ${left.slice(0, 5).join(", ")}`
  )
  const homeTmp = path.join(home, "tmp")
  const appeared = existsSync(homeTmp)
  assert.equal(
    appeared,
    false,
    `the ocv-tools tests wrote under HOME/tmp: ${appeared ? readdirSync(homeTmp).slice(0, 5).join(", ") || "(empty directory)" : ""}`
  )
})
