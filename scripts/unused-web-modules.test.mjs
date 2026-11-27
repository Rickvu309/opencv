import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { unusedWebModules } from "./lib/unused-web-modules.mjs"

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..")
const SKIPPED_DIRS = new Set(["node_modules", "dist", ".turbo", "coverage"])
const SOURCE_FILE = /\.[cm]?[jt]sx?$/

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
    path: "apps/web/src/main.tsx",
    text: 'import "./router"\n',
  },
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

test("a module reached only through a .js import counts as used", () => {
  assert.deepEqual(
    unusedWebModules([
      {
        path: "apps/web/src/main.tsx",
        text: 'import "./router.js"\n',
      },
      {
        path: "apps/web/src/router.tsx",
        text: 'import { a } from "./lib/a.js"\nconst Page = lazy(() => import("@/features/jobs/jobs-page.js"))\n',
      },
      { path: "apps/web/src/lib/a.ts", text: "export const a = 1\n" },
      {
        path: "apps/web/src/features/jobs/jobs-page.tsx",
        text: "export const JobsPage = 1\n",
      },
      { path: "apps/web/src/lib/orphan.ts", text: "export const orphan = 1\n" },
    ]),
    ["apps/web/src/lib/orphan.ts"]
  )
})

test("an unreachable import cycle is reported", () => {
  const cycle = [
    { path: "apps/web/src/main.tsx", text: "" },
    { path: "apps/web/src/lib/a.ts", text: 'import "./b"\n' },
    { path: "apps/web/src/lib/b.ts", text: 'import "./a"\n' },
  ]
  assert.deepEqual(unusedWebModules(cycle), [
    "apps/web/src/lib/a.ts",
    "apps/web/src/lib/b.ts",
  ])
  assert.deepEqual(
    unusedWebModules([
      { ...cycle[0], text: 'import "./lib/a"\n' },
      ...cycle.slice(1),
    ]),
    []
  )
})

test("an unreachable route does not keep its dependencies alive", () => {
  assert.deepEqual(
    unusedWebModules([
      { path: "apps/web/src/main.tsx", text: "" },
      {
        path: "apps/web/src/routes/old.tsx",
        text: 'import "../features/old/page"\n',
      },
      {
        path: "apps/web/src/features/old/page.tsx",
        text: 'import "../../lib/old"\n',
      },
      { path: "apps/web/src/lib/old.ts", text: "export const old = 1\n" },
    ]),
    [
      "apps/web/src/features/old/page.tsx",
      "apps/web/src/lib/old.ts",
      "apps/web/src/routes/old.tsx",
    ]
  )
})

test("tests, fixtures and declarations cannot bridge product imports", () => {
  assert.deepEqual(
    unusedWebModules([
      {
        path: "apps/web/src/main.tsx",
        text: 'import "./test/setup"\nimport "./lib/demo.fixtures"\nimport "./types.d.ts"\n',
      },
      { path: "apps/web/src/test/setup.ts", text: 'import "../lib/orphan"\n' },
      {
        path: "apps/web/src/lib/demo.fixtures.ts",
        text: 'import "./orphan"\n',
      },
      { path: "apps/web/src/types.d.ts", text: 'import "./lib/orphan"\n' },
      { path: "apps/web/src/lib/orphan.ts", text: "export const orphan = 1\n" },
      { path: "apps/web/vite.config.ts", text: 'import "./src/lib/orphan"\n' },
    ]),
    ["apps/web/src/lib/orphan.ts"]
  )
})

test("modules without an application entry point are reported", () => {
  assert.deepEqual(unusedWebModules(CLEAN.slice(1)), [
    "apps/web/src/features/jobs/jobs-page.tsx",
    "apps/web/src/lib/a.ts",
    "apps/web/src/lib/b/index.ts",
    "apps/web/src/router.tsx",
  ])
})

test("every web module under components, features and lib has a product importer", () => {
  const unused = unusedWebModules(webFiles("apps/web"))
  assert.deepEqual(
    unused,
    [],
    `the application entry point cannot reach these modules (a test, a fixture or apps/web/src/test does not count). Delete each one with its test, or wire it into a screen:\n${unused.join("\n")}`
  )
})
