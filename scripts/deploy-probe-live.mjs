import { execFileSync } from "node:child_process"

const READ_POSTS = /^\/api\/reads\/[a-zA-Z.]+$/

export function readOnlyRequest(method, url) {
  if (method === "GET" || method === "HEAD") return true
  return method === "POST" && READ_POSTS.test(new URL(url).pathname)
}

export function liveHttp({ fetch: fetchImpl = fetch, origin } = {}) {
  function refuseWrites(url, { method = "GET" } = {}) {
    if (!readOnlyRequest(method, url))
      throw new Error(
        `the probe makes no writes; refused ${method} ${new URL(url).pathname}`
      )
  }
  async function send(url, { method = "GET", body, session } = {}) {
    return fetchImpl(url, {
      method,
      headers: {
        "User-Agent": "opencv-deploy-probe",
        ...(origin ? { Origin: origin } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(session ? { Cookie: session } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    })
  }
  const answered = async (url, options, work) => {
    refuseWrites(url, options)
    try {
      return await work()
    } catch (error) {
      return {
        status: 0,
        failure:
          error.name === "TimeoutError" ? "no answer in 30 s" : "no answer",
      }
    }
  }
  return {
    json: (url, options) =>
      answered(url, options, async () => {
        const response = await send(url, options)
        let body = null
        try {
          body = await response.json()
        } catch {
          body = null
        }
        return { status: response.status, body }
      }),
    text: (url) =>
      answered(url, {}, async () => {
        const response = await send(url)
        return {
          status: response.status,
          text: (await response.text()).slice(0, 200),
        }
      }),
    bytes: (url, options) =>
      answered(url, options, async () => {
        const response = await send(url, options)
        return {
          status: response.status,
          type: response.headers.get("content-type") ?? "",
          bytes: new Uint8Array(await response.arrayBuffer()),
        }
      }).then((answer) => ({ type: "", bytes: new Uint8Array(), ...answer })),
  }
}

export function liveBrowser({ launch } = {}) {
  return {
    async visibleText(url, { session, api, settle }) {
      const start =
        launch ??
        (async () => {
          const { chromium } = await import("playwright-core")
          return chromium.launch({ headless: true })
        })
      const browser = await start()
      try {
        const context = await browser.newContext()
        const [name, ...rest] = session.split("=")
        await context.addCookies([{ name, value: rest.join("="), url: api }])
        const page = await context.newPage()
        const refused = []
        await page.route("**/*", (route) => {
          const request = route.request()
          if (readOnlyRequest(request.method(), request.url()))
            return route.continue()
          refused.push(`${request.method()} ${new URL(request.url()).pathname}`)
          return route.abort()
        })
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 })
        await page
          .waitForFunction(
            (texts) =>
              texts.some((text) => document.body?.innerText.includes(text)),
            settle,
            { timeout: 45_000 }
          )
          .catch(() => undefined)
        return {
          text: (
            await page.evaluate(() => document.body?.innerText ?? "")
          ).slice(0, 4000),
          refused,
        }
      } finally {
        await browser.close()
      }
    },
  }
}

export function liveClock() {
  return {
    now: () => Date.now(),
    pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  }
}

export function liveIssues({
  labels,
  run = (args) => execFileSync("gh", args, { encoding: "utf8" }),
} = {}) {
  return {
    openLabels: () =>
      Object.values(labels).filter(
        (label) =>
          JSON.parse(
            run([
              "issue",
              "list",
              "--state",
              "open",
              "--label",
              label,
              "--json",
              "number",
            ])
          ).length > 0
      ),
    apply(action) {
      if (action.do === "open")
        return run([
          "issue",
          "create",
          "--title",
          `${action.label}: ${action.note.split("\n")[0]}`,
          "--label",
          action.label,
          "--body",
          action.note,
        ])
      const [issue] = JSON.parse(
        run([
          "issue",
          "list",
          "--state",
          "open",
          "--label",
          action.label,
          "--json",
          "number",
        ])
      )
      return issue
        ? run([
            "issue",
            "close",
            String(issue.number),
            "--comment",
            action.note,
          ])
        : ""
    },
  }
}
