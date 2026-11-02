import assert from "node:assert/strict"
import { existsSync, mkdtempSync, rmSync, watch, writeFileSync } from "node:fs"
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

function manualTimers() {
  const pending = new Set()
  return {
    timers: {
      start: (callback) => {
        const handle = { callback }
        pending.add(handle)
        return handle
      },
      stop: (handle) => pending.delete(handle),
    },
    expire: () => {
      for (const handle of [...pending]) handle.callback()
    },
  }
}

function fileAppears(dir, name) {
  return new Promise((resolve) => {
    const watcher = watch(dir, () => {
      if (!existsSync(join(dir, name))) return
      watcher.close()
      resolve()
    })
    if (existsSync(join(dir, name))) {
      watcher.close()
      resolve()
    }
  })
}

test("a file that passes its tests but never exits fails with its name instead of hanging", async () => {
  const dir = fixtures({
    "fine.test.mjs": `import { test } from "node:test"\ntest("fine", () => {})\n`,
    "stuck.test.mjs": `import { test } from "node:test"\nimport { writeFileSync } from "node:fs"\nimport { createServer } from "node:net"\ntest("done", () => {})\ncreateServer().listen(0)\nwriteFileSync("stuck-ready", "")\n`,
  })
  const lines = []
  const clock = manualTimers()
  try {
    const running = runFiles(["fine.test.mjs", "stuck.test.mjs"], {
      timeoutMs: 3000,
      concurrency: 1,
      timers: clock.timers,
      cwd: dir,
      log: (line) => lines.push(line),
    })
    await fileAppears(dir, "stuck-ready")
    clock.expire()
    const results = await running
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
      timeoutMs: 500,
      timers: manualTimers().timers,
      cwd: dir,
      log: (line) => lines.push(line),
    })
    assert.equal(result.ok, false)
    assert.equal(result.timedOut, false)
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
      timers: manualTimers().timers,
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
