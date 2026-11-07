import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { detect } from "./lib/mcp-transport.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const HANDLER = "apps/api/src/connections/http.ts"
const INTRODUCED = "b08e87a1cd4188c748a3e6487a0a4875720d75c6"

const MISTAKE = `
routes.all("/mcp", async (c) =>
  transaction(async () => {
    const origin = c.req.header("Origin")
    if (origin && !webOrigins.includes(origin))
      return c.json({ error: "invalid_origin" }, 403)
  })
)
`

const CLEAN = `
export function mcpHostNames(authUrl: string, webOrigins: string[]) {
  return localhostAllowedOrigins()
}
export function mcpOriginNames(authUrl: string, webOrigins: string[]) {
  return mcpHostNames(authUrl, webOrigins)
}
routes.use("/mcp", async (c, next) => {
  const origin = c.req.header("Origin")
  if (origin && isAllowedOrigin(webOrigins, origin)) return next()
  return originValidation(mcpOriginNames(authUrl, webOrigins))(c, next)
})
routes.all("/mcp", async (c) => {
  const result = await transaction(async () => registry.read(name, input, actor))
  return handler.fetch(c.req.raw)
})
`

function walk(dir) {
  const files = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) files.push(...walk(full))
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts"))
      files.push(full)
  }
  return files
}

const WRAPPED = [
  `routes.all("/mcp", async (c) => await transaction(async () => handler.fetch(c.req.raw)))`,
  `routes.all("/mcp", async (c) => (transaction(async () => handler.fetch(c.req.raw))))`,
  `routes.all("/mcp", async (c) => {
    return await transaction(async () => handler.fetch(c.req.raw))
  })`,
  `routes.all("/mcp", async (c) => {
    const response = await transaction(async () => handler.fetch(c.req.raw))
    return response
  })`,
  `routes.all("/mcp", async (c) =>
    transaction(async () => handler.fetch(c.req.raw)).then((response) => response)
  )`,
]

test("a route wrapped in one database seat or a site list is caught", () => {
  const fired = detect(MISTAKE)
  assert.ok(fired.some((hit) => hit.kind === "transaction"))
  assert.ok(fired.some((hit) => hit.kind === "allowlist"))
  assert.deepEqual(detect(CLEAN), [])
})

test("await, parentheses, return, assignment and then still hold the seat", () => {
  for (const source of WRAPPED) {
    assert.ok(
      detect(source).some((hit) => hit.kind === "transaction"),
      source
    )
  }
  assert.deepEqual(detect(CLEAN), [])
})

test("the live door stays quiet", () => {
  const offenders = walk(path.join(root, "apps/api/src")).flatMap((file) =>
    detect(readFileSync(file, "utf8"), path.relative(root, file)).map(
      (hit) => `${path.relative(root, file)}:${hit.line} ${hit.kind}`
    )
  )
  assert.deepEqual(offenders, [])
})

test("the handler that held the seat for the whole call is caught", (t) => {
  let old
  try {
    old = execFileSync("git", ["show", `${INTRODUCED}:${HANDLER}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
  } catch {
    return t.skip(`commit ${INTRODUCED} is not in this clone`)
  }
  const fired = detect(old, HANDLER)
  assert.ok(fired.some((hit) => hit.kind === "transaction"))
  assert.ok(fired.some((hit) => hit.kind === "allowlist"))
})
