import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  detect,
  envReads,
  isProductFile,
  staleDeletions,
} from "./lib/env-switch.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const mistake = `export function createPaperPackageRoutes() {
  const routes = new Hono()
  routes.use("*", async (c, next) => {
    if (process.env.PAPER_PACKAGE_ENABLED !== "true") return c.notFound()
    c.header("cache-control", "private, no-store")
    return requireSession(auth, db)(c, next)
  })
  return routes
}
`

const clean = `export function createPaperPackageRoutes() {
  const routes = new Hono()
  routes.use("*", async (c, next) => {
    c.header("cache-control", "private, no-store")
    return requireSession(auth, db)(c, next)
  })
  const origin = process.env.WEB_ORIGINS
  const api = import.meta.env.VITE_API_URL
  if (process.env.NODE_ENV === "production") routes.get("/", () => origin)
  return routes
}
`

const kinds = (problems) => problems.map(({ kind, name }) => `${kind}:${name}`)

test("a product feature gated on an unlisted environment switch fires", () => {
  assert.deepEqual(
    kinds(detect(mistake, "apps/api/src/paper/word-package/package-http.ts")),
    ["unlisted-env-switch:PAPER_PACKAGE_ENABLED"]
  )
  assert.equal(
    detect(mistake, "apps/api/src/paper/word-package/package-http.ts")[0].line,
    4
  )
})

test("real configuration stays quiet", () => {
  assert.deepEqual(
    detect(clean, "apps/api/src/paper/word-package/package-http.ts"),
    []
  )
})

test("every way of reading a switch fires in api and web product code", () => {
  for (const [text, file] of [
    [
      "if (import.meta.env.VITE_NEW_EDITOR) show()",
      "apps/web/src/features/paper/a.tsx",
    ],
    [
      'if (process.env["WORD_PAGES"] === "on") show()',
      "apps/api/src/paper/a.ts",
    ],
    ["const { WORD_PAGES } = process.env", "apps/api/src/paper/a.ts"],
  ])
    assert.equal(detect(text, file).length, 1, text)
})

test("tests and files outside product code may set switches", () => {
  assert.deepEqual(
    detect(mistake, "apps/api/src/paper/word-package/package-http.test.ts"),
    []
  )
  assert.deepEqual(detect(mistake, "apps/web/src/test/setup.ts"), [])
  assert.deepEqual(detect(mistake, "scripts/ui/stack.mjs"), [])
})

function productFiles(dir) {
  const found = []
  for (const entry of readdirSync(path.join(root, dir), {
    withFileTypes: true,
  })) {
    if (entry.name === "node_modules") continue
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...productFiles(rel))
    else if (/\.(ts|tsx)$/.test(entry.name) && isProductFile(rel))
      found.push(rel)
  }
  return found
}

function liveProductFiles() {
  return [...productFiles("apps/api/src"), ...productFiles("apps/web/src")]
}

test("api and web product code read no unlisted environment switch", () => {
  const problems = []
  for (const file of liveProductFiles())
    for (const problem of detect(
      readFileSync(path.join(root, file), "utf8"),
      file
    ))
      problems.push(`${file}:${problem.line} ${problem.name}`)
  assert.deepEqual(problems, [])
})

test("a deleted switch left on the being-deleted list fires", () => {
  assert.deepEqual(
    kinds(
      staleDeletions(
        ["COACH_DURABLE"],
        new Set(["PAPER_AGENT_TOOLS", "COACH_DURABLE"])
      )
    ),
    ["deleted-switch-still-allowed:PAPER_AGENT_TOOLS"]
  )
  assert.deepEqual(
    staleDeletions(["COACH_DURABLE"], new Set(["COACH_DURABLE"])),
    []
  )
})

test("reading the deleted agent tools switch fires again", () => {
  assert.deepEqual(
    kinds(
      detect(
        'if (process.env.PAPER_AGENT_TOOLS !== "on") return false',
        "apps/api/src/registry/delegate-policy.ts"
      )
    ),
    ["unlisted-env-switch:PAPER_AGENT_TOOLS"]
  )
})

test("every switch on the being-deleted list is still read by product code", () => {
  const read = liveProductFiles().flatMap((file) =>
    envReads(readFileSync(path.join(root, file), "utf8"), file).map(
      ({ name }) => name
    )
  )
  assert.deepEqual(staleDeletions(read), [])
})
