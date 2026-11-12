import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  TEST_FILE,
  detect,
  outsideReads,
  repoTopLevel,
} from "./lib/test-outside-reads.mjs"

const root = fileURLToPath(new URL("..", import.meta.url))
const topLevel = new Set(["apps", "packages", "scripts", ".railway"])
const testFile = "apps/api/src/registry/names.test.ts"

const SCANS_WEB = `
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..")
const scanRoots = ["apps/web/src", "packages/domain/src"]
`

const fixtureRepo = (apiTurbo) => {
  const files = {
    "turbo.json": JSON.stringify({
      globalDependencies: ["package.json"],
      tasks: { test: { inputs: ["$TURBO_DEFAULT$", ".env*"] } },
    }),
    "apps/api/package.json": JSON.stringify({
      name: "api",
      dependencies: { "@workspace/domain": "workspace:*" },
    }),
    "packages/domain/package.json": JSON.stringify({
      name: "@workspace/domain",
    }),
    ...(apiTurbo ? { "apps/api/turbo.json": JSON.stringify(apiTurbo) } : {}),
  }
  return { read: (rel) => files[rel] ?? null }
}

const DECLARED = {
  extends: ["//"],
  tasks: {
    test: {
      inputs: ["$TURBO_DEFAULT$", ".env*", "$TURBO_ROOT$/apps/web/src/**"],
    },
  },
}

test("an api test that scans web source with no declared input fires", () => {
  const hits = detect(SCANS_WEB, testFile, fixtureRepo(null), topLevel)
  assert.deepEqual(
    hits.map((hit) => hit.target),
    ["apps/web/src"]
  )
  assert.match(hits[0].text, /\$TURBO_ROOT\$\/apps\/web\/src\/\*\*/)
})

test("an api test whose outside reads are inputs or dependencies stays quiet", () => {
  assert.deepEqual(
    detect(SCANS_WEB, testFile, fixtureRepo(DECLARED), topLevel),
    []
  )
})

test("relative reads resolve against the test file and anchors are not reads", () => {
  const text = `
const repo = path.resolve(here, "../../../..")
const api = path.resolve(here, "../..")
const own = readFileSync(new URL("../../package.json", import.meta.url))
const web = new URL("../../../web/src/routes", import.meta.url)
import { grant } from "../../../../scripts/lib/write-grant.mjs"
`
  assert.deepEqual(outsideReads(text, testFile, topLevel), [
    "apps/web/src/routes",
    "scripts/lib/write-grant.mjs",
  ])
})

test("a script a test imports pulls in the scripts it imports", () => {
  const repo = fixtureRepo(null)
  const files = {
    "turbo.json": repo.read("turbo.json"),
    "apps/api/package.json": repo.read("apps/api/package.json"),
    "scripts/lib/a.mjs": `import { b } from "./b.mjs"`,
    "scripts/lib/b.mjs": `export const b = 1`,
    "apps/api/turbo.json": JSON.stringify({
      tasks: {
        test: { inputs: ["$TURBO_DEFAULT$", "$TURBO_ROOT$/scripts/lib/a.mjs"] },
      },
    }),
  }
  const io = { read: (rel) => files[rel] ?? null }
  const hits = detect(
    `import { a } from "../../../../scripts/lib/a.mjs"`,
    testFile,
    io,
    topLevel
  )
  assert.deepEqual(
    hits.map((hit) => hit.target),
    ["scripts/lib/b.mjs"]
  )
})

test("every test under apps and packages declares the files it reads outside its package", () => {
  const files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8" }
  )
    .split("\n")
    .filter((file) => TEST_FILE.test(file))
  assert.ok(files.includes(testFile))
  const repo = repoTopLevel()
  const hits = files.flatMap((file) =>
    detect(readFileSync(`${root}${file}`, "utf8"), file, undefined, repo)
  )
  assert.deepEqual(
    hits.map((hit) => hit.text),
    []
  )
})
