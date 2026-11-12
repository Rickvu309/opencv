import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { readFileSync, symlinkSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { tempDir } from "../../lib/temp-dir.mjs"
import { push, world } from "../jobs/hook-world.mjs"
import { LockUnavailable, isolatedEnv, lockDir } from "./proc.mjs"

const PROC = fileURLToPath(new URL("./proc.mjs", import.meta.url))

function holder(
  dir,
  name,
  { limit = 30, env = isolatedEnv(process.env) } = {}
) {
  const log = join(dir, "order.log")
  const release = join(dir, `release-${name}`)
  const code = `
    import { appendFileSync, existsSync } from "node:fs"
    import { machineLock } from ${JSON.stringify(PROC)}
    const r = machineLock(() => {
      appendFileSync(${JSON.stringify(log)}, "${name} start\\n")
      process.stdout.write("held\\n")
      while (!existsSync(${JSON.stringify(release)}))
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
      appendFileSync(${JSON.stringify(log)}, "${name} end\\n")
      return "${name}"
    }, { dir: ${JSON.stringify(dir)}, limit: ${limit} })
    process.stdout.write(JSON.stringify(r) + "\\n")
  `
  const child = spawn(process.execPath, ["--input-type=module", "-e", code], {
    env,
  })
  const out = { stdout: "", stderr: "" }
  const seen = (stream, text) =>
    new Promise((resolve) => {
      const check = () => out[stream].includes(text) && resolve()
      child[stream].on("data", check)
      check()
    })
  child.stdout.on("data", (d) => (out.stdout += d))
  child.stderr.on("data", (d) => (out.stderr += d))
  const done = new Promise((resolve) =>
    child.on("close", (status, signal) => resolve({ ...out, status, signal }))
  )
  return {
    child,
    done,
    log,
    held: seen("stdout", "held"),
    waiting: seen("stderr", "another local pre-check is running"),
    release: () => writeFileSync(release, ""),
  }
}

const resultOf = (run) => JSON.parse(run.stdout.trim().split("\n").at(-1))

test("two local pre-checks run one after the other: the second waits, says so, and runs after the first releases", async (t) => {
  const dir = tempDir(t, "ocv-lock-")
  const a = holder(dir, "a")
  await a.held
  const b = holder(dir, "b")
  b.release()
  await b.waiting
  a.release()
  const [ra, rb] = await Promise.all([a.done, b.done])
  assert.deepEqual(readFileSync(a.log, "utf8").trim().split("\n"), [
    "a start",
    "a end",
    "b start",
    "b end",
  ])
  assert.equal(resultOf(ra).value, "a")
  assert.equal(resultOf(rb).value, "b")
  assert.match(
    rb.stderr,
    /another local pre-check is running on this machine \(one at a time\); waited \d+ s so far, giving up after 30 s\./
  )
  assert.match(
    rb.stderr,
    /waited \d+ s for another local pre-check; running now\./
  )
})

test("a killed holder does not block the next run: the kernel releases the lock", async (t) => {
  const dir = tempDir(t, "ocv-lock-")
  const a = holder(dir, "a")
  await a.held
  a.child.kill("SIGKILL")
  await a.done
  const b = holder(dir, "b", { limit: 10 })
  b.release()
  const r = resultOf(await b.done)
  assert.equal(r.ok, true, r.reason)
  assert.equal(r.value, "b")
})

test("past the limit the waiting run gives up, says what to do, and runs nothing", async (t) => {
  const dir = tempDir(t, "ocv-lock-")
  const a = holder(dir, "a")
  await a.held
  const b = holder(dir, "b", { limit: 1 })
  b.release()
  const r = resultOf(await b.done)
  a.release()
  await a.done
  assert.equal(r.ok, false)
  assert.equal(r.value, undefined)
  assert.match(
    r.reason,
    /held the machine lock .* past the 1 s limit, so these tests did not run and no pass is recorded; run scripts\/ocv-tools\.mjs check again when it finishes/
  )
  assert.ok(!readFileSync(a.log, "utf8").includes("b start"))
})

test("the lock folder comes from the account's home, the same whatever HOME and XDG_STATE_HOME say, and never under /tmp", (t) => {
  const here = lockDir()
  assert.match(here, /\/\.local\/state\/ocv-tools$/)
  assert.ok(!here.startsWith("/tmp/") && !here.startsWith(`${tmpdir()}/`))
  const sandbox = tempDir(t, "ocv-lock-home-")
  const shown = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { lockDir } from ${JSON.stringify(PROC)}; process.stdout.write(lockDir())`,
    ],
    {
      env: {
        PATH: process.env.PATH,
        HOME: sandbox,
        XDG_STATE_HOME: join(sandbox, "state"),
      },
      encoding: "utf8",
      timeout: 30000,
    }
  )
  assert.equal(shown.stdout, here, shown.stderr)
  for (const home of ["", "relative/home"])
    assert.throws(
      () => lockDir({ home, env: { CI: "true" } }),
      (error) =>
        error instanceof LockUnavailable &&
        /needs this account's home folder from the password database/.test(
          error.message
        )
    )
  for (const home of ["/tmp/runner-home", join(tmpdir(), "h")]) {
    assert.throws(
      () => lockDir({ home, env: {} }),
      (error) =>
        error instanceof LockUnavailable &&
        /a temporary folder .*; outside CI \(CI=true\) the tool refuses it/.test(
          error.message
        )
    )
    assert.equal(
      lockDir({ home, env: { CI: "true" } }),
      join(home, ".local", "state", "ocv-tools")
    )
  }
})

test("without flock on PATH the tool refuses to run the tests, says why, and never runs them unlocked", (t) => {
  const dir = tempDir(t, "ocv-lock-")
  const bin = join(dir, "bin")
  mkdirSync(bin)
  symlinkSync("/bin/sh", join(bin, "sh"))
  const ran = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { machineLock } from ${JSON.stringify(PROC)}
       const r = machineLock(() => "ran", { dir: ${JSON.stringify(dir)} })
       process.stdout.write(JSON.stringify(r))`,
    ],
    { env: { PATH: bin }, encoding: "utf8", timeout: 30000 }
  )
  const r = JSON.parse(ran.stdout)
  assert.equal(r.ok, false, ran.stderr)
  assert.equal(r.value, undefined)
  assert.match(
    r.reason,
    /the flock command was not found on PATH, .* the tests did not run; install util-linux/
  )
})

test("a run that gives up on the lock records no pass", () => {
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
})
