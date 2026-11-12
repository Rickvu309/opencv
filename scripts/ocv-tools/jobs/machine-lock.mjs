import { spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export const LOCK_WAIT_SECONDS = 1200
const SAY_EVERY_MS = 30000

const HOLD = [
  'flock -x -w "$1" "$2"',
  'sh -c \'echo held > "$1"; while [ -f "$1" ] && kill -0 "$2" 2>/dev/null; do sleep 1; done\'',
  'ocv-lock-held "$3" "$4"',
  '|| echo gave-up > "$3"',
].join(" ")

export function lockDir(env = process.env) {
  const state = env.XDG_STATE_HOME || join(homedir(), ".local", "state")
  return join(state, "ocv-tools")
}

const pause = (ms) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

const readFlag = (flag) =>
  existsSync(flag) ? readFileSync(flag, "utf8").trim() : ""

export function withMachineLock(
  fn,
  {
    dir = lockDir(),
    limit = LOCK_WAIT_SECONDS,
    say = (line) => process.stderr.write(`${line}\n`),
  } = {}
) {
  mkdirSync(dir, { recursive: true })
  const lock = join(dir, "affected-tests.lock")
  const flag = join(dir, `held-${process.pid}-${Date.now()}`)
  const holder = spawn(
    "sh",
    ["-c", HOLD, "ocv-lock", String(limit), lock, flag, String(process.pid)],
    { detached: true, stdio: "ignore" }
  )
  holder.unref()
  const start = Date.now()
  let told = 0
  try {
    for (;;) {
      const state = readFlag(flag)
      const waited = Math.round((Date.now() - start) / 1000)
      if (state === "held") {
        if (told)
          say(
            `affected tests: waited ${waited} s for another local pre-check; running now.`
          )
        return { ok: true, waited, value: fn() }
      }
      if (state === "gave-up")
        return {
          ok: false,
          waited,
          reason: `another local pre-check held the machine lock (${lock}) for ${waited} s, past the ${limit} s limit, so these tests did not run and no pass is recorded; run scripts/ocv-tools.mjs check again when it finishes`,
        }
      if (Date.now() - start >= (told ? told * SAY_EVERY_MS : 1000)) {
        say(
          `affected tests: another local pre-check is running on this machine (one at a time); waited ${waited} s so far, giving up after ${limit} s.`
        )
        told += 1
      }
      pause(200)
    }
  } finally {
    rmSync(flag, { force: true })
    try {
      process.kill(-holder.pid, "SIGTERM")
    } catch {}
  }
}
