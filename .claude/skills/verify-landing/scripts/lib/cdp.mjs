import { writeFileSync } from "node:fs"

import { launchChrome } from "../../../../../scripts/lib/chrome-process.mjs"

const SIGNED_OUT_SESSION = "null"

export async function launchBrowser({ startDeadlineMs } = {}) {
  const started = await launchChrome({
    name: "verify-landing",
    startDeadlineMs,
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

  async function openPage({ width, height, mobile, reducedMotion, url }) {
    const { targetId } = await send("Target.createTarget", {
      url: "about:blank",
    })
    const { sessionId } = await send("Target.attachToTarget", {
      targetId,
      flatten: true,
    })
    const call = (method, params) => send(method, params, sessionId)
    await call("Page.enable")
    const origin = new URL(url).origin
    listeners.push((message) => {
      if (
        message.sessionId !== sessionId ||
        message.method !== "Fetch.requestPaused"
      )
        return
      const { requestId, request, resourceType } = message.params
      if (
        request.url.startsWith(origin) ||
        !["Fetch", "XHR"].includes(resourceType)
      ) {
        return call("Fetch.continueRequest", { requestId })
      }
      call("Fetch.fulfillRequest", {
        requestId,
        responseCode: request.method === "OPTIONS" ? 204 : 200,
        responseHeaders: [
          { name: "content-type", value: "application/json" },
          { name: "access-control-allow-origin", value: origin },
          { name: "access-control-allow-credentials", value: "true" },
          { name: "access-control-allow-headers", value: "*" },
          { name: "access-control-allow-methods", value: "*" },
        ],
        body: Buffer.from(SIGNED_OUT_SESSION).toString("base64"),
      })
    })
    await call("Fetch.enable", {
      patterns: [{ urlPattern: "*", requestStage: "Request" }],
    })
    await call("Runtime.enable")
    await call("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    })
    if (mobile)
      await call("Emulation.setTouchEmulationEnabled", {
        enabled: true,
        maxTouchPoints: 5,
      })
    await call("Emulation.setEmulatedMedia", {
      features: [
        {
          name: "prefers-reduced-motion",
          value: reducedMotion ? "reduce" : "no-preference",
        },
      ],
    })
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
    let giveUpTimer
    const gaveUp = new Promise((resolve) => {
      giveUpTimer = setTimeout(resolve, 30000)
    })
    await Promise.race([loaded, gaveUp])
    clearTimeout(giveUpTimer)
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
    const screenshot = async (file, fullPage) => {
      const { data } = await call("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: fullPage,
      })
      writeFileSync(file, Buffer.from(data, "base64"))
    }
    const close = () => send("Target.closeTarget", { targetId })
    return { evaluate, screenshot, close }
  }

  async function quit() {
    socket.close()
    await killChromeGroupAndCleanUp()
  }

  return { openPage, quit }
}
