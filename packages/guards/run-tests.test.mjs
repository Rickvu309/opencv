import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { runFiles } from "./run-tests.mjs"

function fixtures(files) {
  const dir = mkdtempSync(join(tmpdir(), "guards-runner-"))
  for (const [name, body] of Object.entries(files))
    writeFileSync(join(dir, name), body)
  return dir
}

test("a file that passes its tests but never exits fails with its name instead of hanging", async () => {
  const dir = fixtures({
    "fine.test.mjs": `import { test } from "node:test"\ntest("fine", () => {})\n`,
    // The tests finish and a live timer keeps the process open, as an orphaned browser does.
    "stuck.test.mjs": `import { test } from "node:test"\ntest("done", () => {})\nsetInterval(() => {}, 1000)\n`,
  })
  const lines = []
  try {
    const started = Date.now()
    const results = await runFiles(["fine.test.mjs", "stuck.test.mjs"], {
      timeoutMs: 3000,
      cwd: dir,
      log: (line) => lines.push(line),
    })
    assert.ok(Date.now() - started < 20000, "returned within the deadline")
    const byFile = Object.fromEntries(results.map((r) => [r.file, r]))
    assert.equal(byFile["fine.test.mjs"].ok, true)
    assert.equal(byFile["stuck.test.mjs"].ok, false)
    assert.equal(byFile["stuck.test.mjs"].timedOut, true)
    assert.match(lines.join("\n"), /TIMEOUT stuck\.test\.mjs/)
    assert.doesNotMatch(lines.join("\n"), /TIMEOUT fine\.test\.mjs/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("a test that never settles fails with its file and test name", async () => {
  const dir = fixtures({
    "wait.test.mjs": `import { test } from "node:test"\ntest("never settles", () => new Promise(() => {}))\n`,
  })
  const lines = []
  try {
    const [result] = await runFiles(["wait.test.mjs"], {
      timeoutMs: 2000,
      cwd: dir,
      log: (line) => lines.push(line),
    })
    assert.equal(result.ok, false)
    assert.match(lines.join("\n"), /never settles/)
    assert.match(lines.join("\n"), /wait\.test\.mjs/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("a failing file is reported by name and does not stop the others", async () => {
  const dir = fixtures({
    "bad.test.mjs": `import { test } from "node:test"\ntest("bad", () => { throw new Error("boom") })\n`,
    "good.test.mjs": `import { test } from "node:test"\ntest("good", () => {})\n`,
  })
  const lines = []
  try {
    const results = await runFiles(["bad.test.mjs", "good.test.mjs"], {
      timeoutMs: 5000,
      cwd: dir,
      log: (line) => lines.push(line),
    })
    assert.deepEqual(results.map((r) => [r.file, r.ok]).sort(), [
      ["bad.test.mjs", false],
      ["good.test.mjs", true],
    ])
    assert.match(lines.join("\n"), /FAIL bad\.test\.mjs/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
