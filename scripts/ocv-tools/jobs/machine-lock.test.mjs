import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { tempDir } from "../../lib/temp-dir.mjs"
import { isolatedEnv } from "../ports/proc.mjs"
import { push, world } from "./hook-world.mjs"
import { lockDir } from "./machine-lock.mjs"

const LOCK = fileURLToPath(new URL("./machine-lock.mjs", import.meta.url))

function holder(dir, { holdMs, limit = 30 }) {
  const code = `
    import { withMachineLock } from ${JSON.stringify(LOCK)}
    const r = withMachineLock(() => {
      const start = Date.now()
      process.stdout.write("held\\n")
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${holdMs})
      return { start, end: Date.now() }
    }, { dir: ${JSON.stringify(dir)}, limit: ${limit} })
    process.stdout.write(JSON.stringify(r) + "\\n")
  `
  const child = spawn(process.execPath, ["--input-type=module", "-e", code], {
    env: isolatedEnv(process.env),
  })
  const out = { stdout: "", stderr: "" }
  child.stdout.on("data", (d) => (out.stdout += d))
  child.stderr.on("data", (d) => (out.stderr += d))
  const done = new Promise((resolve) =>
    child.on("close", (status, signal) => resolve({ ...out, status, signal }))
  )
  const held = new Promise((resolve) =>
    child.stdout.on("data", () => out.stdout.includes("held") && resolve())
  )
  return { child, done, held }
}

const resultOf = (run) => JSON.parse(run.stdout.trim().split("\n").at(-1))

test("two local pre-checks started together run one after the other, and the second says it is waiting", async (t) => {
  const dir = tempDir(t, "ocv-lock-")
  const a = holder(dir, { holdMs: 1500 })
  const b = holder(dir, { holdMs: 1500 })
  const [ra, rb] = await Promise.all([a.done, b.done])
  const [x, y] = [resultOf(ra).value, resultOf(rb).value].sort(
    (p, q) => p.start - q.start
  )
  assert.ok(x.end <= y.start, `the runs overlapped: ${JSON.stringify([x, y])}`)
  assert.match(
    ra.stderr + rb.stderr,
    /another local pre-check is running on this machine \(one at a time\); waited \d+ s so far, giving up after 30 s\./
  )
  assert.match(
    ra.stderr + rb.stderr,
    /waited \d+ s for another local pre-check; running now\./
  )
})

test("a killed holder does not block the next run: the kernel releases the lock", async (t) => {
  const dir = tempDir(t, "ocv-lock-")
  const a = holder(dir, { holdMs: 60000 })
  await a.held
  a.child.kill("SIGKILL")
  await a.done
  const started = Date.now()
  const b = holder(dir, { holdMs: 10, limit: 10 })
  const rb = await b.done
  assert.equal(resultOf(rb).ok, true, rb.stderr)
  assert.ok(Date.now() - started < 5000, "the next run waited on a dead holder")
})

test("past the limit the waiting run gives up, says what to do, and runs nothing", async (t) => {
  const dir = tempDir(t, "ocv-lock-")
  const a = holder(dir, { holdMs: 4000 })
  await a.held
  const b = holder(dir, { holdMs: 10, limit: 1 })
  const rb = await b.done
  const r = resultOf(rb)
  assert.equal(r.ok, false)
  assert.equal(r.value, undefined)
  assert.match(
    r.reason,
    /held the machine lock .* past the 1 s limit, so these tests did not run and no pass is recorded; run scripts\/ocv-tools\.mjs check again when it finishes/
  )
  await a.done
})

test("a run that gives up on the lock records no pass, and the lock sits outside every worktree and /tmp", () => {
  const w = world({
    changed: ["scripts/a.test.mjs"],
    tests: ["scripts/a.test.mjs"],
    lock: () => ({
      ok: false,
      reason: "another local pre-check held the machine lock",
    }),
  })
  const r = w.call(["pre-push"], { stdin: push(["refs/heads/feat/1-x"]) })
  assert.equal(r.code, 2, r.text)
  assert.match(r.text, /held the machine lock/)
  assert.deepEqual(w.receipts(), [])
  assert.ok(!w.s.calls.some((c) => c.args.includes("--test")))
  const dir = lockDir({ XDG_STATE_HOME: "" })
  assert.match(dir, /\/\.local\/state\/ocv-tools$/)
  assert.ok(!dir.startsWith("/tmp"))
})
