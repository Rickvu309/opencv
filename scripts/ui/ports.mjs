import { execFileSync, spawn } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { createServer } from "node:net"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

export const SCRATCH_ROOT = join(homedir(), "tmp", "ocv-ui")
export const DEFAULT_PEN = join(homedir(), "tmp", "opencv-ui", "opencv.pen")

const repoRoot = () =>
  execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim()

const isFree = (port) =>
  new Promise((resolve) => {
    const server = createServer()
    server.once("error", () => resolve(false))
    server.listen({ port }, () => server.close(() => resolve(true)))
  })

const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const stop = (pid, signal) => {
  for (const target of [-pid, pid]) {
    try {
      process.kill(target, signal)
      return
    } catch {
      continue
    }
  }
}

const start = (command, args, { cwd, env, log }) => {
  const out = openSync(log, "a")
  const child = spawn(command, args, {
    cwd,
    env,
    detached: true,
    stdio: ["ignore", out, out],
  })
  child.unref()
  return child.pid
}

const run = (command, args, { cwd, env, log, timeoutMs }) =>
  new Promise((resolve) => {
    const out = openSync(log, "a")
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", out, out],
      timeout: timeoutMs,
    })
    child.once("exit", (code) => resolve(code ?? 1))
    child.once("error", () => resolve(1))
  })

const request = async (url, init) => {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  })
  return {
    status: response.status,
    text: await response.text(),
    setCookie: response.headers.getSetCookie(),
  }
}

export function realPorts() {
  return {
    env: process.env,
    repo: repoRoot(),
    scratchRoot: SCRATCH_ROOT,
    defaultPen: DEFAULT_PEN,
    fs: {
      exists: (path) => existsSync(path),
      read: (path) => readFileSync(path, "utf8"),
      readOptional: (path) =>
        existsSync(path) ? readFileSync(path, "utf8") : "",
      readBytes: (path) => readFileSync(path),
      write: (path, data) => {
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, data)
      },
      mkdir: (path) => mkdirSync(path, { recursive: true }),
      remove: (path) => rmSync(path, { recursive: true, force: true }),
    },
    proc: { start, run, alive, stop },
    net: { isFree },
    http: {
      get: (url) => request(url, { method: "GET" }),
      post: (url, body, headers) =>
        request(url, { method: "POST", headers, body: JSON.stringify(body) }),
    },
    clock: {
      now: () => Date.now(),
      pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    },
    browser: {
      launch: async () => {
        const { chromium } = await import("playwright-core")
        return chromium.launch({ headless: true })
      },
    },
  }
}
