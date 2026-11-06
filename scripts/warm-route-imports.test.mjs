import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { detect, inspect } from "./lib/warm-route-imports.mjs"

const route = "@/routes/editor.tsx"
const nested = "@/features/editor.tsx"
const leaf = "@/features/toolbar.tsx"
const warm = (...names) =>
  `await Promise.all([${names.map((name) => `import("${name}")`).join(",")}])`
const sources = new Map([
  ["apps/web/src/routes/editor.tsx", warm(nested)],
  ["apps/web/src/features/editor.tsx", warm(leaf)],
  ["apps/web/src/features/toolbar.tsx", warm(route)],
])
const io = { read: (name) => sources.get(name) ?? null }

test("finds missing nested warmup imports through multiple levels and cycles", () => {
  assert.deepEqual(detect(warm(route), "warm.ts", io), [nested, leaf].sort())
})

test("accepts a warmup that awaits every nested import", () => {
  assert.deepEqual(detect(warm(route, nested, leaf), "warm.ts", io), [])
})

test("signed-in route warmup includes every nested dynamic import", () => {
  const file = "apps/web/src/test/warm-routes.ts"
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
  assert.deepEqual(inspect(source, file), [])
})
