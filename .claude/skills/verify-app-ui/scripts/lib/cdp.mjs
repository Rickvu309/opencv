// A tiny Chrome DevTools Protocol client, copied from verify-landing and extended for a signed-in tour:
// console capture, request interception (answer or hold an api call), key presses and polling.
// No dependency: Node 24 has a global WebSocket.
import { spawn } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function findChrome() {
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

const KEYS = {
  Tab: { code: "Tab", vk: 9 },
  Escape: { code: "Escape", vk: 27 },
  Enter: { code: "Enter", vk: 13 },
  k: { code: "KeyK", vk: 75 },
}

export async function launchBrowser() {
  const root = join(homedir(), "tmp", "verify-app-ui")
  mkdirSync(root, { recursive: true })
  const profile = mkdtempSync(join(root, "profile-"))
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
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  )
  const wsUrl = await new Promise((resolve, reject) => {
    let log = ""
    const timer = setTimeout(
      () => reject(new Error(`chrome did not start: ${log.slice(-300)}`)),
      20000
    )
    chrome.on("error", (error) => reject(error))
    chrome.stderr.on("data", (chunk) => {
      log += chunk
      const hit = /DevTools listening on (ws:\/\/\S+)/.exec(log)
      if (hit) {
        clearTimeout(timer)
        resolve(hit[1])
      }
    })
  })
  const socket = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = () => reject(new Error("devtools socket failed"))
  })
  let nextId = 0
  const pending = new Map()
  const listeners = []
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    if (message.id) {
      const call = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) call.reject(new Error(message.error.message))
      else call.resolve(message.result)
    } else {
      for (const listener of listeners) listener(message)
    }
  }
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params, sessionId }))
    })

  // intercept(request) returns null (let it through), "hold" (keep it paused until release()),
  // "fail" (refuse the connection, as if the api were down) or { status, body } (answer it without reaching the api). Only /api/ calls are offered to it.
  // timezone (an IANA name) and now (an ISO instant the page clock starts at) let a check
  // reproduce a design frame's dates; the page clock then runs forward from now.
  async function openPage({
    width,
    height,
    mobile,
    reducedMotion,
    intercept,
    timezone,
    now,
  }) {
    const { targetId } = await send("Target.createTarget", {
      url: "about:blank",
    })
    const { sessionId } = await send("Target.attachToTarget", {
      targetId,
      flatten: true,
    })
    const call = (method, params) => send(method, params, sessionId)
    const logs = []
    const held = []
    let handler = intercept ?? null
    listeners.push((message) => {
      if (message.sessionId !== sessionId) return
      const { method, params } = message
      if (method === "Runtime.consoleAPICalled") {
        if (["error", "warning"].includes(params.type)) {
          const text = params.args
            .map((a) => a.value ?? a.description ?? "")
            .join(" ")
          logs.push({ kind: `console.${params.type}`, text })
        }
      } else if (method === "Runtime.exceptionThrown") {
        const d = params.exceptionDetails
        logs.push({
          kind: "exception",
          text: d.exception?.description ?? d.text,
        })
      } else if (method === "Log.entryAdded") {
        if (params.entry.level === "error")
          logs.push({
            kind: "log.error",
            text: `${params.entry.text} ${params.entry.url ?? ""}`,
          })
      } else if (method === "Fetch.requestPaused") {
        const { requestId, request } = params
        const verdict =
          handler && request.url.includes("/api/") ? handler(request) : null
        if (!verdict) return call("Fetch.continueRequest", { requestId })
        if (verdict === "hold") return held.push(requestId)
        if (verdict === "fail")
          return call("Fetch.failRequest", {
            requestId,
            errorReason: "ConnectionRefused",
          })
        call("Fetch.fulfillRequest", {
          requestId,
          responseCode: verdict.status,
          responseHeaders: [
            { name: "content-type", value: "application/json" },
            {
              name: "access-control-allow-origin",
              value: request.headers.Origin ?? "*",
            },
            { name: "access-control-allow-credentials", value: "true" },
          ],
          body: Buffer.from(JSON.stringify(verdict.body)).toString("base64"),
        })
      }
    })
    await call("Page.enable")
    await call("Log.enable")
    await call("Runtime.enable")
    await call("Fetch.enable", {
      patterns: [{ urlPattern: "*/api/*", requestStage: "Request" }],
    })
    await call("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    })
    if (timezone)
      await call("Emulation.setTimezoneOverride", { timezoneId: timezone })
    if (now) {
      const start = new Date(now).getTime()
      await call("Page.addScriptToEvaluateOnNewDocument", {
        source: `(() => {
          const Real = Date, shift = ${start} - Real.now()
          class Fixed extends Real {
            constructor(...args) { if (args.length === 0) super(Real.now() + shift); else super(...args) }
            static now() { return Real.now() + shift }
          }
          globalThis.Date = Fixed
        })()`,
      })
    }
    await call("Emulation.setEmulatedMedia", {
      features: [
        {
          name: "prefers-reduced-motion",
          value: reducedMotion ? "reduce" : "no-preference",
        },
      ],
    })
    const evaluate = async (expression) => {
      const { result, exceptionDetails } = await call("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
      if (exceptionDetails) {
        throw new Error(
          exceptionDetails.exception?.description ?? exceptionDetails.text
        )
      }
      return result.value
    }
    const goto = async (url) => {
      const loaded = new Promise((resolve) => {
        const listener = (message) => {
          if (
            message.sessionId === sessionId &&
            message.method === "Page.loadEventFired"
          ) {
            listeners.splice(listeners.indexOf(listener), 1)
            resolve()
          }
        }
        listeners.push(listener)
      })
      await call("Page.navigate", { url })
      await Promise.race([loaded, sleep(30000)])
    }
    const waitFor = async (expression, timeout = 15000) => {
      const end = Date.now() + timeout
      while (Date.now() < end) {
        if (await evaluate(`Boolean(${expression})`).catch(() => false))
          return true
        await sleep(100)
      }
      return false
    }
    const key = async (name, { ctrl = false } = {}) => {
      const k = KEYS[name]
      const base = {
        key: name,
        code: k.code,
        windowsVirtualKeyCode: k.vk,
        modifiers: ctrl ? 2 : 0,
      }
      await call("Input.dispatchKeyEvent", { type: "rawKeyDown", ...base })
      await call("Input.dispatchKeyEvent", { type: "keyUp", ...base })
    }
    const screenshot = async (file, fullPage) => {
      const { data } = await call("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: fullPage,
      })
      writeFileSync(file, Buffer.from(data, "base64"))
    }
    const release = async () => {
      for (const requestId of held.splice(0))
        await call("Fetch.continueRequest", { requestId })
    }
    const setIntercept = (fn) => {
      handler = fn
    }
    const close = () => send("Target.closeTarget", { targetId })
    return {
      evaluate,
      goto,
      waitFor,
      key,
      screenshot,
      release,
      setIntercept,
      logs,
      close,
      sleep,
    }
  }

  async function quit() {
    socket.close()
    chrome.kill("SIGKILL")
    await new Promise((resolve) => chrome.once("exit", resolve))
    rmSync(profile, { recursive: true, force: true })
  }

  return { openPage, quit }
}
