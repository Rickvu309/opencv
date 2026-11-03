import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { expiredMessage, expiredPending } from "./lib/pending-fixes.mjs"
import { unusedWebModules } from "./lib/unused-web-modules.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const SKIPPED_DIRS = new Set(["node_modules", "dist", ".turbo", "coverage"])
const SOURCE_FILE = /\.[cm]?[jt]sx?$/
const PENDING = JSON.parse(
  readFileSync(
    path.join(root, "scripts/unused-web-modules.pending.json"),
    "utf8"
  )
)

function webFiles(dir) {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      if (SKIPPED_DIRS.has(entry.name)) return []
      const relative = `${dir}/${entry.name}`
      if (entry.isDirectory()) return webFiles(relative)
      if (!SOURCE_FILE.test(entry.name)) return []
      return [
        {
          path: relative,
          text: readFileSync(path.join(root, relative), "utf8"),
        },
      ]
    }
  )
}

const MISTAKE = [
  {
    path: "apps/web/src/main.tsx",
    text: 'import { Shell } from "@/components/shell.tsx"\n',
  },
  {
    path: "apps/web/src/components/shell.tsx",
    text: "export const Shell = 1\n",
  },
  {
    path: "apps/web/src/components/orphan.tsx",
    text: "export const Orphan = 1\n",
  },
  {
    path: "apps/web/src/components/orphan.test.tsx",
    text: 'import { Orphan } from "./orphan.tsx"\n',
  },
]

const CLEAN = [
  {
    path: "apps/web/src/router.tsx",
    text: 'const Page = lazy(() => import("@/features/jobs/jobs-page"))\nimport { a } from "./lib/a.ts"\n',
  },
  {
    path: "apps/web/src/features/jobs/jobs-page.tsx",
    text: 'export { b } from "../../lib/b"\n',
  },
  { path: "apps/web/src/lib/a.ts", text: "export const a = 1\n" },
  { path: "apps/web/src/lib/b/index.ts", text: "export const b = 1\n" },
  {
    path: "apps/web/src/features/jobs/jobs.fixtures.tsx",
    text: "export const fixture = 1\n",
  },
]

test("a web module that only its test imports is reported", () => {
  assert.deepEqual(unusedWebModules(MISTAKE), [
    "apps/web/src/components/orphan.tsx",
  ])
})

test("static, lazy, re-exported, index and fixture modules stay quiet", () => {
  assert.deepEqual(unusedWebModules(CLEAN), [])
})

test("every web module under components, features and lib has a product importer", () => {
  const pending = new Set(PENDING.map((entry) => entry.file))
  const unused = unusedWebModules(webFiles("apps/web"))
  const unlisted = unused.filter((file) => !pending.has(file))
  assert.deepEqual(
    unlisted,
    [],
    `no product file imports these modules (a test, a fixture or apps/web/src/test does not count). Delete each one with its test, or wire it into a screen:\n${unlisted.join("\n")}`
  )
  const stale = [...pending].filter((file) => !unused.includes(file))
  assert.deepEqual(
    stale,
    [],
    `these pending entries are deleted or now imported. Remove them from scripts/unused-web-modules.pending.json:\n${stale.join("\n")}`
  )
})

test("every pending unused web module names an existing file, an issue and an expiry", () => {
  for (const entry of PENDING) {
    assert.ok(existsSync(path.join(root, entry.file)), `${entry.file} is gone`)
    assert.match(entry.issue, /^#\d+$/)
    assert.match(entry.expires, /^\d{4}-\d{2}-\d{2}$/)
  }
  assert.equal(expiredMessage(expiredPending(PENDING)), "")
})
