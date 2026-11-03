import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { affectedServices, services } from "./services.mjs"

const names = (files) => affectedServices(files).map((s) => s.name)

test("service watch patterns match .railway/railway.ts", () => {
  const source = readFileSync(
    new URL("../../.railway/railway.ts", import.meta.url),
    "utf8"
  )
  for (const service of services) {
    const block = source.slice(source.indexOf(`service("${service.name}"`))
    const list = block.match(/watchPatterns:\s*\[([^\]]*)\]/)[1]
    const patterns = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1])
    assert.deepEqual(service.watchPatterns, patterns, service.name)
  }
  assert.deepEqual(
    services.map((s) => s.name),
    [...source.matchAll(/service\("(\w+)"/g)].map((m) => m[1])
  )
})

test("an api change affects api only", () => {
  assert.deepEqual(names(["apps/api/src/a.ts"]), ["api"])
})

test("a web change affects web only", () => {
  assert.deepEqual(names(["apps/web/src/b.tsx"]), ["web"])
})

test("a shared package change affects both", () => {
  assert.deepEqual(names(["packages/domain/src/x.ts"]), ["api", "web"])
})

test("package.json affects api and not web", () => {
  assert.deepEqual(names(["package.json"]), ["api"])
})

test("docs and scripts affect nothing", () => {
  assert.deepEqual(names(["docs/deploy.md", "scripts/pr.mjs", "README.md"]), [])
})

test("a pattern does not match a sibling directory", () => {
  assert.deepEqual(names(["apps/api-docs/readme.md", "apps/webx/a.ts"]), [])
})

test("railway.ts owns only the application services and keeps the api variables the cutover flips by hand", () => {
  const source = readFileSync(
    new URL("../../.railway/railway.ts", import.meta.url),
    "utf8"
  )
  assert.doesNotMatch(source, /postgres|volume/i)
  assert.match(source, /AUTH_URL: preserve\(\)/)
  assert.match(source, /WEB_ORIGINS: preserve\(\)/)
})
