import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { fakePorts } from "./fake.mjs"

const toolsDir = fileURLToPath(new URL("..", import.meta.url))
const ALLOWED_PROCESS_SPAWNERS = ["ports/proc.mjs", "result.mjs"]

function sourceModules(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceModules(path)
    if (!entry.name.endsWith(".mjs") || entry.name.endsWith(".test.mjs"))
      return []
    return [relative(toolsDir, path)]
  })
}

function processSpawners(files, read) {
  return files.filter((file) =>
    /from\s+["'](node:)?child_process["']/.test(read(file))
  )
}

test("jobs and verbs never spawn a process themselves: only the proc port and result.mjs import child_process", () => {
  const read = (file) => readFileSync(join(toolsDir, file), "utf8")
  assert.deepEqual(
    processSpawners(sourceModules(toolsDir), read).sort(),
    ALLOWED_PROCESS_SPAWNERS
  )
})

test("the spawner check fires on a job that imports child_process", () => {
  const files = {
    "jobs/push-checks.mjs": 'import { spawnSync } from "node:child_process"',
  }
  assert.deepEqual(
    processSpawners(Object.keys(files), (f) => files[f]),
    ["jobs/push-checks.mjs"]
  )
})

test("the fake records each call as a named effect with no command line, so tests assert effects, not argv", () => {
  const ports = fakePorts({ issues: [] })
  ports.gh.comment(1, "hello")
  ports.git.push("/tmp/opencv")
  assert.ok(ports.effects.length >= 2)
  for (const effect of ports.effects) {
    assert.equal(typeof effect.op, "string")
    for (const key of ["argv", "args", "cmd", "command"])
      assert.ok(!(key in effect), `${effect.op} effect records ${key}`)
  }
})
