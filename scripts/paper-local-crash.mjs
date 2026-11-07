import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { withTempDir } from "./lib/temp-dir.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const webRequire = createRequire(
  new URL("../apps/web/package.json", import.meta.url)
)
const { createServer } = await import(pathToFileURL(webRequire.resolve("vite")))
const chromePath =
  process.env.PAPER_CRASH_CHROME ??
  path.join(
    homedir(),
    ".cache/ms-playwright/chromium-1248/chrome-linux-arm64/chrome"
  )
const reportPath =
  process.env.PAPER_CRASH_REPORT ??
  path.join(homedir(), "tmp/1150-crash-results.json")
const runs = Number(process.env.PAPER_CRASH_RUNS ?? 20)
const blocks = Number(process.env.PAPER_CRASH_BLOCKS ?? 2)
const port = 5150
const rows = []
const latencies = []
const entry = readFileSync(
  new URL("./fixtures/paper-local-crash-entry.mjs", import.meta.url),
  "utf8"
)

class Connection {
  next = 1
  pending = new Map()
  listeners = new Set()
  constructor(ws) {
    this.ws = ws
    ws.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data)
      if (message.id) {
        const pending = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error)
          pending?.reject(new Error(JSON.stringify(message.error)))
        else pending?.resolve(message.result)
      } else {
        for (const listener of this.listeners) listener(message)
      }
    })
    ws.addEventListener("close", () => {
      for (const pending of this.pending.values())
        pending.reject(new Error("browser closed"))
      this.pending.clear()
    })
  }
  send(method, params = {}, sessionId) {
    const id = this.next++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params, sessionId }))
    })
  }
}

async function launch(profile) {
  for (const name of ["SingletonLock", "SingletonCookie", "SingletonSocket"])
    rmSync(path.join(profile, name), { force: true })
  const child = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-session-crashed-bubble",
      "--disable-background-networking",
      `--user-data-dir=${profile}`,
      "--remote-debugging-port=0",
      "about:blank",
    ],
    { detached: true, stdio: ["ignore", "ignore", "pipe"] }
  )
  let stderr = ""
  const address = await new Promise((resolve, reject) => {
    const onData = (chunk) => {
      stderr += chunk.toString()
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (match) {
        child.stderr.off("data", onData)
        child.stderr.resume()
        resolve(match[1])
      }
    }
    child.stderr.on("data", onData)
    child.once("error", reject)
    child.once("exit", (code) =>
      reject(new Error(`Chrome exited ${code}: ${stderr.slice(-1000)}`))
    )
  })
  const ws = new WebSocket(address)
  await once(ws, "open")
  const cdp = new Connection(ws)
  return { child, cdp, profile }
}

async function page(browser, doc, tab) {
  const { targetId } = await browser.cdp.send("Target.createTarget", {
    url: "about:blank",
  })
  const { sessionId } = await browser.cdp.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  })
  const send = (method, params) => browser.cdp.send(method, params, sessionId)
  let inputComplete
  const input = new Promise((resolve) => {
    inputComplete = resolve
  })
  const ready = new Promise((resolve, reject) => {
    const deadline = AbortSignal.timeout(30_000)
    deadline.addEventListener(
      "abort",
      () => reject(new Error(`Paper did not become ready: ${doc}/${tab}`)),
      { once: true }
    )
    const listener = (message) => {
      if (message.sessionId !== sessionId) return
      if (message.method === "Runtime.exceptionThrown")
        reject(new Error(JSON.stringify(message.params.exceptionDetails)))
      if (message.method !== "Runtime.bindingCalled") return
      const signal = JSON.parse(message.params.payload)
      if (signal.kind === "input") {
        latencies.push(signal.durationMs)
        inputComplete(signal.finishedAt)
      }
      if (signal.kind === "ready") resolve()
    }
    browser.cdp.listeners.add(listener)
  })
  await send("Runtime.enable")
  await send("Runtime.addBinding", { name: "crashSignal" })
  await send("Page.navigate", {
    url: `http://localhost:${port}/__paper-crash?doc=${doc}&tab=${tab}&blocks=${blocks}`,
  })
  await ready
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails)
      throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  return { send, evaluate, targetId, input }
}

async function kill(browser, gap, started, inputFinishedAt) {
  const exited = once(browser.child, "exit")
  const deliver = () => {
    const actualGap = performance.now() - started
    process.kill(-browser.child.pid, "SIGKILL")
    return {
      actualGap,
      inputToKillMs:
        performance.timeOrigin + performance.now() - inputFinishedAt,
    }
  }
  const timing =
    gap === 0
      ? deliver()
      : await new Promise((resolve) =>
          setTimeout(() => resolve(deliver()), gap)
        )
  await exited
  return timing
}

const server = await createServer({
  configFile: path.join(root, "apps/web/vite.config.ts"),
  root: path.join(root, "apps/web"),
  logLevel: "error",
  server: { port, strictPort: true, host: "127.0.0.1" },
  plugins: [
    {
      name: "paper-crash-fixture",
      resolveId(id) {
        if (id === "/__paper-crash-entry.mjs") return "\0paper-crash-entry"
      },
      load(id) {
        if (id === "\0paper-crash-entry") return entry
      },
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/__paper-crash?")) return next()
          const html = await vite.transformIndexHtml(
            req.url,
            '<!doctype html><html><head><title>Paper crash test</title></head><body><script type="module" src="/__paper-crash-entry.mjs"></script></body></html>'
          )
          res.setHeader("Content-Type", "text/html")
          res.end(html)
        })
      },
    },
  ],
})

try {
  await server.listen()
  await withTempDir(
    "paper-crash-",
    async (profile) => {
      let browser = await launch(profile)
      try {
        await page(browser, "00000000-0000-4000-8000-000000000000", "prepare")
        const closed = once(browser.child, "exit")
        await browser.cdp.send("Browser.close").catch(() => {})
        await closed
        browser = await launch(profile)
        let sequence = 0
        for (const tabs of [1, 2]) {
          for (const gap of tabs === 1 ? [0, 5, 10, 20, 40] : [20]) {
            for (let run = 1; run <= runs; run += 1) {
              const doc = `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`
              const pages = await Promise.all(
                Array.from({ length: tabs }, (_, at) =>
                  page(browser, doc, `tab-${at}`)
                )
              )
              const tokens = pages.map((_, at) => `WORDS-${sequence}-${at}-END`)
              await Promise.all(
                pages.map((live, at) =>
                  live.evaluate(
                    `document.getElementById(${JSON.stringify(at ? "b" : "a")}).focus()`
                  )
                )
              )
              await Promise.all(
                pages.map((live, at) =>
                  live.send("Input.insertText", { text: tokens[at] })
                )
              )
              const inputFinishedAt = await Promise.all(
                pages.map((live) => live.input)
              )
              const timing = await kill(
                browser,
                gap,
                performance.now(),
                Math.max(...inputFinishedAt)
              )
              browser = await launch(profile)
              const restored = await page(browser, doc, "reopened")
              const values = await restored.evaluate(
                '[...document.querySelectorAll("input")].map(input => input.value)'
              )
              const survived = tokens.map((token) =>
                values.some((value) => value.includes(token))
              )
              rows.push({ tabs, gap, run, ...timing, survived })
              writeFileSync(
                reportPath,
                JSON.stringify(
                  {
                    chrome: chromePath,
                    blocks,
                    rows,
                    inputHandlerMs: latencies,
                  },
                  null,
                  2
                )
              )
              await browser.cdp.send("Target.closeTarget", {
                targetId: restored.targetId,
              })
            }
            const group = rows.filter(
              (row) => row.tabs === tabs && row.gap === gap
            )
            console.log(
              JSON.stringify({
                tabs,
                gap,
                passed: group.filter((row) => row.survived.every(Boolean))
                  .length,
                runs: group.length,
              })
            )
          }
        }
      } finally {
        if (
          browser.child.exitCode === null &&
          browser.child.signalCode === null
        ) {
          const exited = once(browser.child, "exit")
          process.kill(-browser.child.pid, "SIGKILL")
          await exited
        }
      }
    },
    path.join(homedir(), "tmp")
  )
} finally {
  await server.close()
}
console.log(
  JSON.stringify({
    reportPath,
    runs: rows.length,
    inputSamples: latencies.length,
  })
)
assert.ok(
  rows.every((row) => row.survived.every(Boolean)),
  "A SIGKILL lost typed words; keep the safety target unchanged"
)
