import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises"
import { request } from "node:http"
import { homedir } from "node:os"
import path from "node:path"
import { once } from "node:events"

const port = process.env.PORT
assert(port, "Set PORT to this worktree's assigned web port")
const split = process.argv.includes("--split")
const publicOrigin = process.env.VITE_PUBLIC_ORIGIN || "https://opencv.me"
const appOrigin = process.env.VITE_APP_ORIGIN || "https://app.opencv.me"
const publicHost = new URL(publicOrigin).hostname
const appHost = new URL(appOrigin).hostname
const scratch = await mkdtemp(path.join(homedir(), "tmp/host-routing-"))
const config = (await readFile("Caddyfile", "utf8"))
  .replace("/srv", path.resolve("dist"))
  .replace(
    "import host-routing.caddy",
    `import ${path.resolve(".generated/host-routing.caddy")}`
  )
await writeFile(path.join(scratch, "Caddyfile"), config)
let logs = ""
const server = spawn(
  process.env.CADDY || "caddy",
  [
    "run",
    "--config",
    path.join(scratch, "Caddyfile"),
    "--adapter",
    "caddyfile",
  ],
  { env: process.env, stdio: ["ignore", "ignore", "pipe"] }
)
const closed = once(server, "exit")

function get(host, pathname) {
  return new Promise((resolve, reject) => {
    const req = request(
      { hostname: "127.0.0.1", port, path: pathname, headers: { Host: host } },
      (res) => {
        res.resume()
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            location: res.headers.location,
            cache: res.headers["cache-control"],
          })
        )
      }
    )
    req.on("error", reject)
    req.end()
  })
}

try {
  await new Promise((resolve, reject) => {
    server.on("error", reject)
    server.on("exit", (code) =>
      reject(new Error(`Caddy exited ${code}: ${logs}`))
    )
    server.stderr.on("data", (chunk) => {
      logs += chunk
      if (logs.includes('"msg":"serving initial configuration"')) resolve()
    })
  })
  const cases = [
    [
      publicHost,
      "/sign-in?redirect=%2Fapp%2Fpaper",
      `${appOrigin}/sign-in?redirect=%2Fapp%2Fpaper`,
    ],
    [publicHost, "/sign-up", `${appOrigin}/sign-up`],
    [publicHost, "/app", `${appOrigin}/app`],
    [
      publicHost,
      "/app/paper?doc=a%2Fb&x=1",
      `${appOrigin}/app/paper?doc=a%2Fb&x=1`,
    ],
    [appHost, "/", `${appOrigin}/app`],
    [appHost, "/?utm=a%2Fb&x=1", `${appOrigin}/app?utm=a%2Fb&x=1`],
    [appHost, "/pricing", `${publicOrigin}/pricing`],
    [appHost, "/about", `${publicOrigin}/about`],
    [appHost, "/help", `${publicOrigin}/help`],
    [appHost, "/share/token?x=a%2Fb", `${publicOrigin}/share/token?x=a%2Fb`],
    [appHost, "/u/future", `${publicOrigin}/u/future`],
    [publicHost, "/", null],
    [publicHost, "/pricing", null],
    [publicHost, "/application", null],
    [appHost, "/app/paper", null],
    [appHost, "/unknown", null],
    ["preview.example", "/app", null],
  ]
  if (publicHost === "opencv.me") {
    cases.push(["www.opencv.me", "/app/paper", `${appOrigin}/app/paper`])
    cases.push(["www.opencv.me", "/pricing", null])
  }
  for (const [host, pathname, target] of cases) {
    const response = await get(host, pathname)
    const expected = split ? target : null
    assert.equal(
      response.status,
      expected ? 307 : 200,
      `${host}${pathname}: status`
    )
    assert.equal(
      response.location,
      expected ?? undefined,
      `${host}${pathname}: location`
    )
    assert.equal(
      response.cache,
      expected ? "no-store" : "no-cache",
      `${host}${pathname}: cache`
    )
  }
  for (const host of [publicHost, appHost]) {
    assert.equal((await get(host, "/health")).status, 200)
    const missing = await get(host, "/assets/missing.js")
    assert.equal(missing.status, 404)
    assert.equal(missing.location, undefined)
  }
  console.log(
    `PASS ${split ? "split" : "single"}: ${cases.length} document routes; both health and asset handlers`
  )
} catch (error) {
  console.error(logs)
  throw error
} finally {
  server.kill("SIGTERM")
  await closed
  await rm(scratch, { recursive: true, force: true })
}
