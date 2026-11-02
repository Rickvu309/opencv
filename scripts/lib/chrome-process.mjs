import { spawn } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { makeTempDir } from "./temp-dir.mjs"

const GROUP_EXIT_DEADLINE_MS = 3000
const START_DEADLINE_MS = 20000
const START_ATTEMPTS = 2
const MAX_LIFETIME_MS = 30 * 60 * 1000
const WATCHDOG = fileURLToPath(new URL("chrome-watchdog.mjs", import.meta.url))
const SIGNALS = { SIGINT: 2, SIGTERM: 15, SIGHUP: 1 }

export function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN
  const cache = join(homedir(), ".cache", "ms-playwright")
  if (existsSync(cache)) {
    for (const dir of readdirSync(cache).sort().reverse()) {
      if (!dir.startsWith("chromium-")) continue
      for (const arch of ["chrome-linux-arm64", "chrome-linux"]) {
        const bin = join(cache, dir, arch, "chrome")
        if (existsSync(bin)) return bin
      }
    }
  }
  return "chromium"
}

const processGroupGone = (pgid) => {
  try {
    process.kill(-pgid, 0)
    return false
  } catch {
    return true
  }
}

const killGroup = (chrome) => {
  try {
    process.kill(-chrome.pid, "SIGKILL")
  } catch {
    chrome.kill("SIGKILL")
  }
}

function startChrome({ name, startDeadlineMs, extraArgs, maxLifetimeMs }) {
  const root = join(homedir(), "tmp", name)
  mkdirSync(root, { recursive: true })
  const profile = makeTempDir("profile-", root)
  const chrome = spawn(
    findChrome(),
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--force-color-profile=srgb",
      ...extraArgs,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"], detached: true }
  )
  const watchdog = spawn(
    process.execPath,
    [WATCHDOG, String(chrome.pid), profile, String(maxLifetimeMs)],
    { stdio: ["pipe", "ignore", "ignore"], detached: true }
  )
  watchdog.unref()
  watchdog.stdin.unref()
  watchdog.on("error", () => {})
  watchdog.stdin.on("error", () => {})

  const onExit = () => {
    killGroup(chrome)
    rmSync(profile, { recursive: true, force: true })
  }
  const onSignal = (signal) => {
    kill().finally(() => {
      if (process.listenerCount(signal) === 0)
        process.exit(128 + SIGNALS[signal])
    })
  }
  const handlers = Object.keys(SIGNALS).map((signal) => {
    const handler = () => onSignal(signal)
    process.on(signal, handler)
    return [signal, handler]
  })
  process.on("exit", onExit)

  let killing
  const kill = () => {
    killing ??= (async () => {
      process.off("exit", onExit)
      for (const [signal, handler] of handlers) process.off(signal, handler)
      killGroup(chrome)
      chrome.stderr.destroy()
      const deadline = Date.now() + GROUP_EXIT_DEADLINE_MS
      while (!processGroupGone(chrome.pid) && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 10))
      rmSync(profile, { recursive: true, force: true })
      watchdog.stdin.end()
    })()
    return killing
  }
  const wsUrl = new Promise((resolve, reject) => {
    let log = ""
    const started = Date.now()
    const timer = setTimeout(() => {
      const error = new Error(
        `chrome did not start after ${Date.now() - started} ms: ${log.slice(-300)}`
      )
      error.startTimeout = true
      reject(error)
    }, startDeadlineMs)
    chrome.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    chrome.on("exit", () => {
      clearTimeout(timer)
      reject(new Error(`chrome exited at start: ${log.slice(-300)}`))
    })
    chrome.stderr.on("data", (chunk) => {
      log += chunk
      const hit = /DevTools listening on (ws:\/\/\S+)/.exec(log)
      if (hit) {
        clearTimeout(timer)
        watchdog.stdin.write("ready\n")
        resolve(hit[1])
      }
    })
  })
  return { wsUrl, kill }
}

export async function launchChrome({
  name,
  startDeadlineMs = START_DEADLINE_MS,
  extraArgs = [],
  maxLifetimeMs = Number(process.env.CHROME_MAX_LIFETIME_MS) || MAX_LIFETIME_MS,
}) {
  let attempt = 0
  while (true) {
    attempt += 1
    const started = startChrome({
      name,
      startDeadlineMs,
      extraArgs,
      maxLifetimeMs,
    })
    try {
      return { wsUrl: await started.wsUrl, kill: started.kill }
    } catch (error) {
      await started.kill()
      if (!error.startTimeout || attempt >= START_ATTEMPTS) throw error
    }
  }
}
