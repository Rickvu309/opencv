import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir, userInfo } from "node:os"
import { join } from "node:path"

const RUN_TIMEOUT_MS = 30 * 60 * 1000

export const KEPT_GIT_ENV = Object.freeze([
  "GIT_ASKPASS",
  "GIT_EDITOR",
  "GIT_PAGER",
  "GIT_SSH",
  "GIT_SSH_COMMAND",
  "GIT_TERMINAL_PROMPT",
])

export const DROPPED_CHILD_ENV = Object.freeze([
  "NODE_TEST_CONTEXT",
  "FORCE_COLOR",
  "CLICOLOR_FORCE",
])

export function isolatedEnv(base = process.env) {
  const env = {}
  for (const [name, value] of Object.entries(base)) {
    if (value === undefined) continue
    if (name.startsWith("GIT_") && !KEPT_GIT_ENV.includes(name)) continue
    if (DROPPED_CHILD_ENV.includes(name)) continue
    env[name] = value
  }
  return env
}

export function childEnv(cmd, options = {}, base = process.env) {
  const own = cmd === "git" ? { ...base } : isolatedEnv(base)
  const env = { ...own, ...(options.env ?? {}) }
  env.GH_PROMPT_DISABLED = "1"
  env.GIT_TERMINAL_PROMPT = "0"
  if (cmd === "git" && !env.GIT_EDITOR) env.GIT_EDITOR = "true"
  return env
}

export function realRunner() {
  return function run(cmd, args, options = {}) {
    const r = spawnSync(cmd, args, {
      ...(options.bytes ? {} : { encoding: "utf8" }),
      cwd: options.cwd,
      env: childEnv(cmd, options),
      input:
        options.bytes && typeof options.input === "string"
          ? Buffer.from(options.input, "utf8")
          : options.input,
      stdio: options.inherit ? ["ignore", "inherit", "inherit"] : undefined,
      maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
      timeout: options.timeout ?? RUN_TIMEOUT_MS,
    })
    const failure = r.error
      ? `${r.error.code === "ENOBUFS" ? "output passed the buffer limit, so it was cut short: " : ""}${r.error.message}`
      : r.signal
        ? `killed by ${r.signal}`
        : ""
    const stderr = String(r.stderr ?? "").trim()
    if (options.bytes)
      return {
        ok: r.status === 0 && !r.error && !r.signal,
        out: Buffer.isBuffer(r.stdout) ? r.stdout : Buffer.alloc(0),
        err: [failure, stderr].filter(Boolean).join("; "),
      }
    const stdout = r.stdout ?? ""
    return {
      ok: r.status === 0 && !r.error && !r.signal,
      out: options.raw ? stdout : stdout.trim(),
      err: [failure, stderr].filter(Boolean).join("; "),
    }
  }
}

export function procAdapter(run) {
  return {
    run,
    listening(port) {
      const ss = run("ss", ["-ltnH"])
      if (ss.ok)
        return ss.out
          .split("\n")
          .some((line) =>
            new RegExp(`[:.]${port}$`).test(line.trim().split(/\s+/)[3] ?? "")
          )
      const lsof = run("lsof", [`-iTCP:${port}`, "-sTCP:LISTEN"])
      return lsof.ok && lsof.out !== ""
    },
  }
}

export const LOCK_WAIT_SECONDS = 1200
const SAY_EVERY_MS = 30000

const HOLD = [
  'flock -x -w "$1" "$2"',
  'sh -c \'echo held > "$1"; while [ -f "$1" ] && kill -0 "$2" 2>/dev/null; do sleep 1; done\'',
  'ocv-lock-held "$3" "$4"',
  '|| echo gave-up > "$3"',
].join(" ")

export class LockUnavailable extends Error {}

const accountHome = () => {
  try {
    return userInfo().homedir
  } catch {
    return ""
  }
}

export function lockDir({ home = accountHome(), env = process.env } = {}) {
  const under = (dir, root) => dir === root || dir.startsWith(`${root}/`)
  if (!home || !home.startsWith("/"))
    throw new LockUnavailable(
      `the machine lock needs this account's home folder from the password database and found ${JSON.stringify(home)}; no local pre-check runs without it, so run scripts/ocv-tools.mjs check from a normal login shell`
    )
  const temporary = ["/tmp", tmpdir()].some((root) => under(home, root))
  if (temporary && env.CI !== "true")
    throw new LockUnavailable(
      `the machine lock would sit under ${home}, a temporary folder that is a small memory-backed disk on a developer machine; outside CI (CI=true) the tool refuses it, so give this account a home folder outside /tmp`
    )
  return join(home, ".local", "state", "ocv-tools")
}

export function flockAvailable() {
  const probe = spawnSync("flock", ["--version"], {
    stdio: "ignore",
    timeout: 10000,
  })
  return !probe.error && probe.status === 0
}

const pause = (ms) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

const readFlag = (flag) =>
  existsSync(flag) ? readFileSync(flag, "utf8").trim() : ""

export function machineLock(
  fn,
  {
    dir,
    limit = LOCK_WAIT_SECONDS,
    say = (line) => process.stderr.write(`${line}\n`),
  } = {}
) {
  if (!flockAvailable())
    return {
      ok: false,
      waited: 0,
      reason:
        "the flock command was not found on PATH, so the one-at-a-time machine lock cannot be taken and the tests did not run; install util-linux (Debian or Ubuntu: apt install util-linux; macOS: brew install util-linux, then put its bin folder on PATH) and run scripts/ocv-tools.mjs check again",
    }
  try {
    dir = dir ?? lockDir()
  } catch (error) {
    if (!(error instanceof LockUnavailable)) throw error
    return { ok: false, waited: 0, reason: error.message }
  }
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
