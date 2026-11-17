import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { detect } from "./lib/api-build-test-files.mjs"

const root = fileURLToPath(new URL("..", import.meta.url))
const api = (file) => `/repo/apps/api/src/${file}`

test("the API production compiler must not include test-only files", () => {
  const files = execFileSync(
    process.execPath,
    [
      path.join(root, "apps/api/node_modules/typescript/bin/tsc"),
      "--listFilesOnly",
      "-p",
      "apps/api/tsconfig.build.json",
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
  )
    .trim()
    .split("\n")
  assert.ok(files.some((file) => file.endsWith("/apps/api/src/index.ts")))
  assert.deepEqual(detect(files), [])
})

test("test folders, fixtures, suites and helpers fire even when imported transitively", () => {
  const files = [
    "test/seed-sessions.ts",
    "connections/test/projection.ts",
    "auth.fixtures.ts",
    "paper/package-fixtures.ts",
    "coach/worker-fixture.test-support.ts",
    "paper/photo-lifetime.support.ts",
    "paper/page.test.ts",
    "registry/contract.type-test.ts",
  ].map(api)
  assert.deepEqual(detect(files), files)
  assert.deepEqual(
    detect([api("test/seed-sessions.ts").replaceAll("/", "\\")]),
    [api("test/seed-sessions.ts")]
  )
})

test("production modules, declarations and dependency test folders stay quiet", () => {
  assert.deepEqual(
    detect([
      api("index.ts"),
      api("registry/registry.ts"),
      api("paper/latest.ts"),
      "/repo/apps/api/node_modules/library/test/index.d.ts",
      "/repo/apps/api/dist/test/old.js",
    ]),
    []
  )
})
