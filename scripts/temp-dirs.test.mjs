import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { SLOW } from "../packages/guards/run-tests.mjs"
import { tempDir } from "./lib/temp-dir.mjs"

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
  const run = spawnSync(process.execPath, ["--test", ...suite], {
    cwd: root,
    env: { ...env, TMPDIR: sandbox, HOME: home },
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
  const homeTmp = path.join(home, "tmp")
  const appeared = existsSync(homeTmp)
  assert.equal(
    appeared,
    false,
    `the ocv-tools tests wrote under HOME/tmp: ${appeared ? readdirSync(homeTmp).slice(0, 5).join(", ") || "(empty directory)" : ""}`
  )
})
