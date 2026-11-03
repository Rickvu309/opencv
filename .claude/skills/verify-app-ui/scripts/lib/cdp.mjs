import { writeFileSync } from "node:fs"

import { launchChrome } from "../../../../../scripts/lib/chrome-process.mjs"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const KEYS = {
  Tab: { code: "Tab", vk: 9 },
  Escape: { code: "Escape", vk: 27 },
  Enter: { code: "Enter", vk: 13 },
  k: { code: "KeyK", vk: 75 },
  PageDown: { code: "PageDown", vk: 34 },
  ArrowLeft: { code: "ArrowLeft", vk: 37 },
  ArrowRight: { code: "ArrowRight", vk: 39 },
  "[": { code: "BracketLeft", vk: 219, text: "[" },
}

export async function launchBrowser({ startDeadlineMs, extraArgs = [] } = {}) {
  const started = await launchChrome({
    name: "verify-app-ui",
    startDeadlineMs,
    extraArgs,
  })
  const wsUrl = started.wsUrl
  const killChromeGroupAndCleanUp = started.kill
  let socket
  try {
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
        if (!verdict)
          return call("Fetch.continueRequest", { requestId }).catch(() => {})
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
      await call("Input.dispatchKeyEvent", {
        type: k.text ? "keyDown" : "rawKeyDown",
        ...(k.text ? { text: k.text } : {}),
        ...base,
      })
      await call("Input.dispatchKeyEvent", { type: "keyUp", ...base })
    }
    const insertText = (text) => call("Input.insertText", { text })
    const mouse = (mouseEventType, x, y, clickCount = 1) =>
      call("Input.dispatchMouseEvent", {
        type: mouseEventType,
        x,
        y,
        button: "left",
        buttons: mouseEventType === "mouseReleased" ? 0 : 1,
        clickCount,
      })
    const hover = (x, y) =>
      call("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x,
        y,
        button: "none",
        buttons: 0,
      })
    const screenshot = async (file, fullPage, clip) => {
      const { data } = await call("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: fullPage,
        ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
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
      insertText,
      mouse,
      hover,
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
