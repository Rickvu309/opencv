import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { detect } from "./lib/dev-scan.mjs"

const root = fileURLToPath(new URL("..", import.meta.url))
const vitePath = "apps/web/vite.config.ts"

const MISTAKE = `resolve: {
  alias: {
    "@workspace/domain": path.resolve(__dirname, "../../packages/domain/src/index.ts"),
  },
}
`
const CLEAN = `resolve: {
  alias: {
    "@workspace/domain": path.resolve(__dirname, "../../packages/domain/src/index.ts"),
    "@workspace/paper-engine": path.resolve(__dirname, "../../packages/paper-engine/src/index.ts"),
  },
}
`

function workspacePackages() {
  const found = new Map()
  for (const name of readdirSync(join(root, "packages"))) {
    const file = join(root, "packages", name, "package.json")
    if (!existsSync(file)) continue
    const pkg = JSON.parse(readFileSync(file, "utf8"))
    found.set(pkg.name, pkg)
  }
  return found
}

function distEntry(pkg) {
  const exp = pkg.exports?.["."]
  const imported = typeof exp === "string" ? exp : exp?.import
  return typeof imported === "string" && imported.includes("/dist/")
    ? imported
    : null
}

function sourceAlias(viteText, name) {
  const lines = viteText.split("\n")
  const at = lines.findIndex((line) => line.includes(`"${name}"`))
  if (at < 0) return null
  return /packages\/[\w.-]+\/src\/[\w./-]+/.exec(
    lines.slice(at, at + 6).join("\n")
  )?.[0]
}

test("a dev config that aliases domain but not paper-engine fires", () => {
  const hits = detect(MISTAKE, vitePath)
  assert.equal(hits.length, 1)
  assert.match(hits[0].text, /paper-engine/)
})

test("a dev config that aliases paper-engine to its source stays quiet", () => {
  assert.deepEqual(detect(CLEAN, vitePath), [])
  assert.deepEqual(detect(MISTAKE, "apps/web/vite.config.js"), [])
})

test("every workspace package the web app loads from dist is aliased to source that exists", () => {
  const viteText = readFileSync(join(root, vitePath), "utf8")
  const web = JSON.parse(
    readFileSync(join(root, "apps/web/package.json"), "utf8")
  )
  const packages = workspacePackages()
  const missing = []
  for (const name of Object.keys(web.dependencies)) {
    const pkg = packages.get(name)
    if (!pkg || !distEntry(pkg)) continue
    const target = sourceAlias(viteText, name)
    if (!target || !existsSync(join(root, target))) missing.push(name)
  }
  assert.deepEqual(missing, [])
  assert.deepEqual(detect(viteText, vitePath), [])
})
