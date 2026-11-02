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

const GROUP_EXIT_DEADLINE_MS = 3000

function processGroupGone(pgid) {
  try {
    process.kill(-pgid, 0)
    return false
  } catch {
    return true
  }
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
    { stdio: ["ignore", "ignore", "pipe"], detached: true }
  )
  const killChromeGroupAndCleanUp = async () => {
    try {
      process.kill(-chrome.pid, "SIGKILL")
    } catch {
      chrome.kill("SIGKILL")
    }
    chrome.stderr.destroy()
    const deadline = Date.now() + GROUP_EXIT_DEADLINE_MS
    while (!processGroupGone(chrome.pid) && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 10))
    rmSync(profile, { recursive: true, force: true })
  }
  let socket
  try {
    const wsUrl = await new Promise((resolve, reject) => {
      let log = ""
      const timer = setTimeout(
        () => reject(new Error(`chrome did not start: ${log.slice(-300)}`)),
        20000
      )
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
          resolve(hit[1])
        }
      })
    })
    socket = new WebSocket(wsUrl)
    await new Promise((resolve, reject) => {
      socket.onopen = resolve
      socket.onerror = () => reject(new Error("devtools socket failed"))
    })
  } catch (error) {
    await killChromeGroupAndCleanUp()
    throw error
  }
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
    let interceptedRequests = 0
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
        interceptedRequests++
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
    if (intercept !== false)
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
      let timer
      const gaveUp = new Promise((resolve) => {
        timer = setTimeout(resolve, 30000)
      })
      await Promise.race([loaded, gaveUp])
      clearTimeout(timer)
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
    const mouse = (mouseEventType, x, y) =>
      call("Input.dispatchMouseEvent", {
        type: mouseEventType,
        x,
        y,
        button: "left",
        buttons: mouseEventType === "mouseReleased" ? 0 : 1,
        clickCount: 1,
      })
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
      interceptedRequests = 0
    }
    const interceptHits = () => interceptedRequests
    const close = () => send("Target.closeTarget", { targetId })
    return {
      evaluate,
      goto,
      waitFor,
      key,
      mouse,
      screenshot,
      release,
      setIntercept,
      interceptHits,
      logs,
      close,
      sleep,
    }
  }

  async function quit() {
    socket.close()
    await killChromeGroupAndCleanUp()
  }

  return { openPage, quit }
}
