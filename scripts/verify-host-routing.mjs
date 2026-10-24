import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createServer, request as httpRequest } from "node:http"
import { homedir } from "node:os"
import path from "node:path"
import { Readable } from "node:stream"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const scratch = await mkdtemp(path.join(homedir(), "tmp/opencv-host-"))
const socket = path.join(scratch, "api.sock")
const port = process.env.PORT
assert(port, "Set PORT to the assigned web port")
const calls = []
let finishStream
const upstream = createServer((req, res) => {
  calls.push({ url: req.url, headers: req.headers })
  if (req.url === "/api/coach") {
    res.writeHead(200, { "Content-Type": "text/event-stream" })
    res.write("data: first\n\n")
    finishStream = () => {
      res.end("data: last\n\n")
      finishStream = undefined
    }
    return
  }
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Set-Cookie": "session=upstream; HttpOnly; Secure; SameSite=Lax",
  })
  res.end(JSON.stringify({ ok: true }))
})
let caddy
try {
  upstream.listen(socket)
  await once(upstream, "listening")
  const config = (
    await readFile(path.join(root, "apps/web/Caddyfile"), "utf8")
  ).replace("root * /srv", `root * ${path.join(root, "apps/web/dist")}`)
  const configPath = path.join(scratch, "Caddyfile")
  await writeFile(configPath, config)
  caddy = spawn(
    process.env.CADDY_BIN || "caddy",
    ["run", "--config", configPath, "--adapter", "caddyfile"],
    {
      env: { ...process.env, PORT: port, API_UPSTREAM: `unix/${socket}` },
      stdio: ["ignore", "ignore", "pipe"],
    }
  )
  let logs = ""
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Caddy startup timed out: ${logs}`)),
      10000
    )
    caddy.on("error", reject)
    caddy.on("exit", (code) => {
      clearTimeout(timer)
      reject(new Error(`Caddy exited ${code}: ${logs}`))
    })
    caddy.stderr.on("data", (chunk) => {
      logs += chunk
      if (logs.includes("serving initial configuration")) {
        clearTimeout(timer)
        resolve()
      }
    })
  })
  const request = (host, uri, options = {}) =>
    new Promise((resolve, reject) => {
      const req = httpRequest(
        `http://127.0.0.1:${port}${uri}`,
        {
          ...options,
          headers: { Host: host, ...options.headers },
          timeout: 10000,
        },
        (res) => {
          const headers = new Headers()
          for (const [name, value] of Object.entries(res.headers)) {
            for (const item of Array.isArray(value) ? value : [value]) {
              if (item !== undefined) headers.append(name, item)
            }
          }
          resolve(
            new Response(Readable.toWeb(res), {
              status: res.statusCode,
              headers,
            })
          )
        }
      )
      req.on("error", reject)
      req.on("timeout", () =>
        req.destroy(new Error(`Request timed out: ${host}${uri}`))
      )
      req.end()
    })
  for (const host of ["opencv.me", "www.opencv.me"]) {
    const landing = await request(host, "/")
    assert.equal(landing.status, 200)
    assert.match(await landing.text(), /<div id="root"><\/div>/)
    assert.equal(landing.headers.get("cache-control"), "no-cache")
    for (const uri of [
      "/app",
      "/app/paper?doc=cv-1",
      "/sign-in?redirect=%2Fapp%2Fapply",
      "/sign-up",
    ]) {
      const response = await request(host, uri)
      assert.equal(response.status, 308)
      assert.equal(
        response.headers.get("location"),
        `https://app.opencv.me${uri}`
      )
    }
    const pitch = await request(host, "/api/pitch/public/ada", {
      headers: { Cookie: "session=private", Authorization: "Bearer private" },
    })
    assert.equal(pitch.status, 200)
    assert.equal(pitch.headers.get("set-cookie"), null)
    assert.equal(calls.at(-1).headers.cookie, undefined)
    assert.equal(calls.at(-1).headers.authorization, undefined)
    const count = calls.length
    for (const [uri, method] of [
      ["/api/pitch", "GET"],
      ["/api/auth/get-session", "GET"],
      ["/api/pitch/public/ada", "POST"],
    ]) {
      assert.equal((await request(host, uri, { method })).status, 404)
    }
    assert.equal(calls.length, count)
  }
  const emptyHome = await request("app.opencv.me", "/")
  assert.equal(emptyHome.status, 302)
  assert.equal(emptyHome.headers.get("location"), "/app")
  const home = await request("app.opencv.me", "/?welcome=1")
  assert.equal(home.status, 302)
  assert.equal(home.headers.get("location"), "/app?welcome=1")
  const share = await request("app.opencv.me", "/u/ada?ref=cv")
  assert.equal(share.headers.get("location"), "https://opencv.me/u/ada?ref=cv")
  assert.equal(
    (await request("app.opencv.me", "/app/paper?doc=cv-1")).status,
    200
  )
  const session = await request("app.opencv.me", "/api/auth/get-session", {
    headers: { Cookie: "session=private" },
  })
  assert.equal(session.status, 200)
  assert.equal(calls.at(-1).headers.cookie, "session=private")
  assert.match(session.headers.get("set-cookie"), /session=upstream/)
  assert.equal((await request("unknown.example", "/api/pitch")).status, 404)
  const stream = await request("app.opencv.me", "/api/coach")
  const reader = stream.body.getReader()
  assert.match(
    new TextDecoder().decode((await reader.read()).value),
    /data: first/
  )
  finishStream()
  await reader.cancel()
  console.log(
    "PASS: public/app redirects, SPA routes, anonymous API isolation, app cookies and live SSE through Caddy"
  )
} finally {
  finishStream?.()
  if (caddy && caddy.exitCode === null) {
    caddy.kill("SIGTERM")
    await once(caddy, "exit")
  }
  upstream.closeAllConnections()
  await new Promise((resolve) => upstream.close(resolve))
  await rm(scratch, { recursive: true, force: true })
}
